// Event name constants used across the application
export const Events = {
  REQUEST_SUBMITTED: 'request.submitted',
  REQUEST_APPROVED: 'request.approved',
  REQUEST_REJECTED: 'request.rejected',
  REQUEST_CANCELLED: 'request.cancelled',
  BALANCE_REFRESHED: 'balance.refreshed',
  BALANCE_UPDATED: 'balance.updated',
  HCM_SYNC_FAILED: 'hcm.sync.failed',
  HCM_BATCH_RECEIVED: 'hcm.batch.received',
} as const;

// Event payload interfaces
export interface RequestSubmittedEvent {
  requestId: string;
  employeeId: string;
}

export interface RequestApprovedEvent {
  requestId: string;
  employeeId: string;
  locationId: string;
  leaveType: string;
  totalDays: number;
}

export interface RequestRejectedEvent {
  requestId: string;
  employeeId: string;
  totalDays: number;
  locationId: string;
  leaveType: string;
}

export interface RequestCancelledEvent {
  requestId: string;
  employeeId: string;
  totalDays: number;
  locationId: string;
  leaveType: string;
}

export interface BalanceRefreshedEvent {
  employeeId: string;
  locationId: string;
  leaveType: string;
  before: { totalDays: number; usedDays: number };
  after: { totalDays: number; usedDays: number };
}

export interface HcmSyncFailedEvent {
  requestId: string;
  error: string;
  retryCount: number;
}

export interface HcmBatchReceivedEvent {
  jobId: string;
  recordCount: number;
}
