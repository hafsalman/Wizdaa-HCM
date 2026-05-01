const Fastify = require('fastify');
const { v4: uuidv4 } = require('uuid');

// ─── In-Memory State ────────────────────────────────────────────────
const state = {
  balances: new Map(), // key: `${employeeId}:${locationId}:${leaveType}`
  transactions: new Map(),
  failureRate: parseFloat(process.env.HCM_FAILURE_RATE || '0.05'), // 5% transient failure
  delay: parseInt(process.env.HCM_DELAY_MS || '100', 10),
};

function balanceKey(employeeId, locationId, leaveType) {
  return `${employeeId}:${locationId}:${leaveType}`;
}

function maybeFailTransiently(reply) {
  if (Math.random() < state.failureRate) {
    reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Transient HCM failure' });
    return true;
  }
  return false;
}

async function maybeDelay() {
  if (state.delay > 0) {
    await new Promise((r) => setTimeout(r, state.delay));
  }
}

// ─── Server Setup ───────────────────────────────────────────────────
const app = Fastify({ logger: true });

// GET /hcm/balances/:employeeId/:locationId/:leaveType
app.get('/hcm/balances/:employeeId/:locationId/:leaveType', async (req, reply) => {
  await maybeDelay();
  if (maybeFailTransiently(reply)) return;

  const { employeeId, locationId, leaveType } = req.params;
  const key = balanceKey(employeeId, locationId, leaveType);

  let balance = state.balances.get(key);
  if (!balance) {
    // Auto-create a default balance if not seeded
    balance = {
      employeeId,
      locationId,
      leaveType,
      totalDays: 20,
      usedDays: 0,
    };
    state.balances.set(key, balance);
  }

  return balance;
});

// POST /hcm/time-off/submit
app.post('/hcm/time-off/submit', async (req, reply) => {
  await maybeDelay();
  if (maybeFailTransiently(reply)) return;

  const { employeeExternalId, locationId, leaveType, totalDays } = req.body;
  const key = balanceKey(employeeExternalId, locationId, leaveType);

  const balance = state.balances.get(key);
  if (!balance) {
    return reply.status(422).send({
      error: 'INVALID_DIMENSIONS',
      message: `No balance record for ${key}`,
    });
  }

  const available = balance.totalDays - balance.usedDays;
  if (available < totalDays) {
    return reply.status(422).send({
      error: 'INSUFFICIENT_BALANCE',
      message: `Available: ${available}, Requested: ${totalDays}`,
    });
  }

  // Deduct from HCM
  balance.usedDays += totalDays;
  state.balances.set(key, balance);

  const transactionId = uuidv4();
  state.transactions.set(transactionId, {
    id: transactionId,
    employeeExternalId,
    locationId,
    leaveType,
    totalDays,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString(),
  });

  return { transactionId, status: 'CONFIRMED' };
});

// DELETE /hcm/time-off/:transactionId
app.delete('/hcm/time-off/:transactionId', async (req, reply) => {
  await maybeDelay();

  const { transactionId } = req.params;
  const tx = state.transactions.get(transactionId);

  if (!tx) {
    return reply.status(404).send({ error: 'NOT_FOUND', message: 'Transaction not found' });
  }

  // Restore balance
  const key = balanceKey(tx.employeeExternalId, tx.locationId, tx.leaveType);
  const balance = state.balances.get(key);
  if (balance) {
    balance.usedDays = Math.max(0, balance.usedDays - tx.totalDays);
    state.balances.set(key, balance);
  }

  tx.status = 'CANCELLED';
  state.transactions.set(transactionId, tx);

  return { status: 'CANCELLED' };
});

// POST /hcm/batch — send batch to ReadyOn webhook
app.post('/hcm/batch', async (req, reply) => {
  const { webhookUrl } = req.body;

  const records = [];
  for (const [, balance] of state.balances) {
    records.push({
      employeeExternalId: balance.employeeId,
      locationId: balance.locationId,
      leaveType: balance.leaveType,
      totalDays: balance.totalDays,
      usedDays: balance.usedDays,
    });
  }

  // Fire and forget — send batch to ReadyOn webhook
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      return { sent: records.length, webhookStatus: response.status };
    } catch (error) {
      return { sent: 0, error: String(error) };
    }
  }

  return { records };
});

// ─── Test Utilities ─────────────────────────────────────────────────

// POST /hcm/__seed — reset and seed state
app.post('/hcm/__seed', async (req) => {
  const { balances, failureRate, delay } = req.body;

  state.balances.clear();
  state.transactions.clear();

  if (failureRate !== undefined) state.failureRate = failureRate;
  if (delay !== undefined) state.delay = delay;

  if (balances && Array.isArray(balances)) {
    for (const b of balances) {
      const key = balanceKey(b.employeeId, b.locationId, b.leaveType);
      state.balances.set(key, {
        employeeId: b.employeeId,
        locationId: b.locationId,
        leaveType: b.leaveType,
        totalDays: b.totalDays || 20,
        usedDays: b.usedDays || 0,
      });
    }
  }

  return { status: 'seeded', balanceCount: state.balances.size };
});

// POST /hcm/__simulate/anniversary/:employeeId — add bonus days
app.post('/hcm/__simulate/anniversary/:employeeId', async (req) => {
  const { employeeId } = req.params;
  const bonusDays = req.body.bonusDays || 5;
  let updated = 0;

  for (const [key, balance] of state.balances) {
    if (balance.employeeId === employeeId) {
      balance.totalDays += bonusDays;
      state.balances.set(key, balance);
      updated++;
    }
  }

  return { employeeId, bonusDays, balancesUpdated: updated };
});

// GET /hcm/__state — debug: dump all state
app.get('/hcm/__state', async () => {
  return {
    balances: Object.fromEntries(state.balances),
    transactions: Object.fromEntries(state.transactions),
    failureRate: state.failureRate,
    delay: state.delay,
  };
});

// ─── Start ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.HCM_PORT || '3001', 10);

app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  console.log(`🏥 Mock HCM Server running on http://localhost:${PORT}`);
});

module.exports = { app, state };
