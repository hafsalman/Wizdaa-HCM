# Technical Requirements Document (TRD)
## Time-Off Microservice — ReadyOn Platform
**Stack**: NestJS · TypeORM · Supabase (PostgreSQL) · Fastify Mock HCM · React + Vite

---

## 1. Problem Statement

ReadyOn serves as the primary interface for employees to request time off, but the Human Capital Management (HCM) system (Workday/SAP) remains the **Source of Truth** for employment data. This creates a fundamental synchronization challenge:

- **Dual-write inconsistency**: Both ReadyOn and HCM can modify balances independently.
- **External events**: Work anniversaries, year-start refreshes, and HR adjustments happen in HCM without ReadyOn's knowledge.
- **HCM unreliability**: The HCM API may be temporarily unavailable, return errors, or have inconsistent validation.

The microservice must handle all of these while providing employees with accurate, instant feedback.

---

## 2. Stakeholders & Personas

| Persona | Needs | Pain Points |
|---|---|---|
| **Employee** | See accurate balance, instant request feedback, half-day support | Stale balances, failed submissions, no visibility into sync status |
| **Manager** | Approve/reject with confidence that data is valid | Approving against stale data, double-deductions |
| **HCM System** | Push balance updates, receive time-off submissions | ReadyOn not accepting webhooks, duplicate submissions |
| **Admin** | Monitor sync health, trigger manual reconciliation | No visibility into drift, failed syncs |

---

## 3. Functional Requirements (MoSCoW)

### Must Have
- **F1**: Employee can create a time-off request (with leave type, date range, half-day options)
- **F2**: System calculates working days excluding weekends and Pakistan public holidays
- **F3**: Balance validation against both local DB and HCM (defensive — pick lower)
- **F4**: Manager can approve/reject requests
- **F5**: Balance automatically updated on approval (pending → used) and rejection (pending released)
- **F6**: HCM submission on approval with retry on failure
- **F7**: Batch sync webhook endpoint for HCM push
- **F8**: Optimistic locking on balance updates to prevent race conditions
- **F9**: Idempotency keys on mutations to prevent duplicates
- **F10**: Audit log for all state changes

### Should Have
- **F11**: Scheduled retry job for failed HCM submissions (every 5 minutes)
- **F12**: Event-driven architecture (EventEmitter2) for decoupled module communication
- **F13**: Pakistan holiday calendar seed with admin CRUD for date corrections
- **F14**: Health check endpoint with DB connectivity status
- **F15**: Employee cancellation of DRAFT/PENDING requests

### Could Have
- **F16**: HCM anniversary simulation for testing
- **F17**: Real-time balance refresh from HCM on-demand
- **F18**: Sync job history and monitoring

---

## 4. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Response latency (p95) | < 200ms for read operations |
| Consistency model | Strong consistency for balance mutations (optimistic lock) |
| Availability | Service tolerates HCM downtime via retry + local fallback |
| Idempotency window | 24 hours for duplicate detection |
| Max retry attempts | 5 with exponential backoff + jitter |
| Test coverage | ≥ 85% line, ≥ 80% branch |

---

## 5. Challenges & Mitigations

### 5.1 Balance Drift
**Challenge**: HCM can change balances at any time (anniversary, year-start, HR override).  
**Mitigation**: 
- Always re-validate with HCM at approval time (Soft State Strategy)
- Batch sync webhook to receive bulk updates
- Emit `BALANCE_REFRESHED` events to flag impacted pending requests

### 5.2 Race Conditions
**Challenge**: Two managers approve simultaneously, or concurrent requests deplete balance.  
**Mitigation**: 
- `@VersionColumn()` on `LeaveBalance` — TypeORM throws on version mismatch
- Retry loop (up to 3 attempts) on optimistic lock conflict
- `409 Conflict` response if retries exhausted

### 5.3 HCM Unreliability
**Challenge**: HCM may be down, slow, or return transient 503 errors.  
**Mitigation**:
- Exponential backoff: `(2^retryCount × 1000ms) + random(0-1000)` jitter
- Max 5 retries per operation
- Approved requests marked `hcmStatus=PENDING` when HCM is down
- Scheduled job re-drives pending submissions every 5 minutes
- Local balance used as fallback with warning logged

### 5.4 Duplicate Submissions
**Challenge**: Network retries or user double-clicks create duplicate requests.  
**Mitigation**:
- `x-idempotency-key` header on all mutations
- `IdempotencyRecord` table with 24h TTL
- Returns cached response on replay

### 5.5 Partial-Day Calculations
**Challenge**: Half-day leaves, same-day start/end, weekends, holidays.  
**Mitigation**:
- `DayCalculatorService` handles all combinations
- `decimal(10,4)` columns avoid floating-point drift
- Pakistan holidays seeded with admin correction API for lunar dates

### 5.6 Timezone Issues
**Challenge**: Employee in one timezone, system in another.  
**Mitigation**:
- `timezone` column on Employee entity (IANA format)
- All dates stored as UTC `date` type (not `timestamp`)
- Day calculation done in employee's timezone context

---

## 6. Architecture Decision Records (ADRs)

### ADR-1: EventEmitter2 vs Kafka
- **Decision**: EventEmitter2 (in-process)
- **Rationale**: Single-service deployment; Kafka adds operational complexity disproportionate to scale. EventEmitter2 is swappable to external bus when needed.
- **Trade-off**: No cross-service events, no persistence of events on crash.

### ADR-2: Supabase vs Self-Hosted PostgreSQL vs SQLite
- **Decision**: Supabase (managed PostgreSQL)
- **Rationale**: Zero infrastructure management, built-in Row-Level Security, PgBouncer connection pooling, native JSONB for audit/sync results, real-time subscriptions available for future use.
- **Trade-off**: External dependency, network latency vs local DB.

### ADR-3: Optimistic vs Pessimistic Locking
- **Decision**: Optimistic locking (`@VersionColumn`)
- **Rationale**: Reads far outnumber writes; pessimistic locks risk deadlocks under concurrent manager approvals. Optimistic lock + retry is the standard pattern for low-contention writes.
- **Trade-off**: Retry overhead on contention spikes.

### ADR-4: Supabase Auth vs Self-Signed JWT
- **Decision**: Self-signed JWT for development; Supabase Auth for production path
- **Rationale**: Development seed-token endpoint enables rapid testing. Auth module is structured to swap to Supabase Auth provider without service changes.

---

## 7. Data Flow Diagrams

### Approval Flow
```
Manager → PATCH /approve → Load Request (PENDING?)
  → Re-validate balance with HCM (real-time API)
  → Submit to HCM
    ├─ Success → CONFIRMED → status=APPROVED → balance.pending→used
    ├─ Insufficient → REJECTED locally → balance.pending released
    └─ HCM Down → hcmStatus=PENDING → schedule retry → status=APPROVED
  → Emit REQUEST_APPROVED event
  → Write AuditLog
```

### Batch Sync Flow
```
HCM → POST /sync/hcm/webhook → Parse records
  → For each: find local balance
    ├─ Drift detected → update local → emit BALANCE_REFRESHED
    └─ No drift → update lastHcmSyncAt
  → Flag PENDING requests if available < pendingDays
  → Write SyncJob summary
```

---

## 8. Security

- **Authentication**: JWT Bearer tokens (HS256)
- **Authorization**: Role-based guards (`employee`, `manager`, `admin`)
- **Input Validation**: `class-validator` with whitelist + forbidNonWhitelisted
- **Rate Limiting**: 100 req/min per IP via `@nestjs/throttler`
- **Audit Trail**: Every mutation logged with before/after snapshots
- **Webhook Security**: HCM batch webhook validates API key header

---

## 9. Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Pessimistic locking (`SELECT FOR UPDATE`) | Deadlock risk with concurrent approvals; overkill for read-heavy workload |
| Eventual consistency only | Balance staleness would violate employee trust; approval requires strong consistency |
| Polling-only HCM sync | 5-minute+ latency for balance updates; webhook push is real-time |
| Redis for idempotency | Added infrastructure for a simple key-value lookup; PostgreSQL is sufficient |
| GraphQL API | REST is simpler for CRUD operations; team familiarity; GraphQL adds resolver complexity |
| Message queue (RabbitMQ/Kafka) | Single-service deployment doesn't justify the operational overhead; EventEmitter2 is sufficient and swappable |

---

## 10. Entity Relationship Summary

```
Employee 1──∞ LeaveBalance (per location, per leaveType)
Employee 1──∞ TimeOffRequest
SyncJob (standalone — tracks sync operations)
IdempotencyRecord (standalone — 24h TTL)
PublicHoliday (standalone — seeded per year/location)
AuditLog (standalone — before/after snapshots)
```

7 entities total. Balances are per-employee, per-location as specified.

---

## 11. API Endpoint Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/seed-token` | None | Dev: create employee + get JWT |
| GET | `/employees` | JWT | List employees |
| GET | `/employees/:id` | JWT | Employee detail + balances |
| GET | `/balances/:eid/:lid` | JWT | Get balance (optional revalidate) |
| POST | `/balances/refresh/:eid/:lid` | JWT | Trigger HCM refresh |
| POST | `/time-off/requests` | JWT | Create request (idempotent) |
| GET | `/time-off/requests` | JWT | List (filterable) |
| PATCH | `/time-off/requests/:id/approve` | Manager | Approve + HCM sync |
| PATCH | `/time-off/requests/:id/reject` | Manager | Reject + release balance |
| DELETE | `/time-off/requests/:id` | JWT | Cancel (own request) |
| POST | `/sync/hcm/webhook` | API Key | Receive HCM batch |
| POST | `/sync/trigger` | Admin | Manual sync trigger |
| GET | `/sync/jobs` | Admin | Sync job history |
| GET | `/holidays` | Public | List holidays |
| POST | `/holidays/seed` | Admin | Seed Pakistan holidays |
| PATCH | `/holidays/:id` | Admin | Update holiday date |
| GET | `/audit` | Manager | Audit log |
| GET | `/health` | Public | Health check |

## Quick Start

### 1. Prerequisites
- Node.js 20+
- A Supabase project (free tier works)

### 2. Setup Mock HCM Server
```bash
cd mock-hcm
npm install
npm start
```

### 3. Setup Backend
```bash
cd time-off-service
npm install
npm run start:dev
```

### 4. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

## Test Suite

```bash
# Run all unit tests
cd time-off-service
npm test

# Run with coverage
npm run test:cov
```