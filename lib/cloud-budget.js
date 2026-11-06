import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_DAILY_LIMIT = 80000;
const DEFAULT_MONTHLY_LIMIT = 500000;
function positiveLimit(raw, fallback, label) {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1000 || n > 100000000) {
    throw new Error(label + ' must be an integer between 1000 and 100000000');
  }
  return n;
}

export class TokenBudgetExceeded extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokenBudgetExceeded';
    this.code = 'TOKEN_BUDGET_EXCEEDED';
  }
}

export function createTokenBudget({ directory, env = process.env, now = () => new Date() }) {
  if (!directory || !path.isAbsolute(directory)) throw new Error('Cloud usage storage requires an absolute directory');
  const dailyLimit = positiveLimit(env.WORKMODE_DAILY_TOKEN_LIMIT, DEFAULT_DAILY_LIMIT, 'WORKMODE_DAILY_TOKEN_LIMIT');
  const monthlyLimit = positiveLimit(env.WORKMODE_MONTHLY_TOKEN_LIMIT, DEFAULT_MONTHLY_LIMIT, 'WORKMODE_MONTHLY_TOKEN_LIMIT');
  if (monthlyLimit < dailyLimit) throw new Error('Monthly AI token limit cannot be less than daily limit');
  const filepath = path.join(directory, 'ai-usage.json');
  let writeQueue = Promise.resolve();

  function period() {
    const date = now().toISOString().slice(0, 10);
    return { date, month: date.slice(0, 7) };
  }

  async function readCurrent() {
    const p = period();
    let previous = {};
    try {
      previous = JSON.parse(await fs.readFile(filepath, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err; // Fail closed on invalid/missing-readable ledger.
    }
    const dayTokens = previous.date === p.date ? Number(previous.dayTokens) : 0;
    const monthTokens = previous.month === p.month ? Number(previous.monthTokens) : 0;
    if (!Number.isSafeInteger(dayTokens) || !Number.isSafeInteger(monthTokens) ||
        dayTokens < 0 || monthTokens < 0) throw new Error('AI usage ledger is invalid');
    return { ...p, dayTokens, monthTokens, dailyLimit, monthlyLimit,
      dailyRemaining: Math.max(0, dailyLimit - dayTokens),
      monthlyRemaining: Math.max(0, monthlyLimit - monthTokens) };
  }

  async function getStatus() {
    return writeQueue.then(readCurrent);
  }

  function check(status) {
    if (status.dailyRemaining <= 0 || status.monthlyRemaining <= 0) {
      throw new TokenBudgetExceeded('AI usage limit reached. The browser remains available; no further AI calls will be made until the usage period resets or the limits are changed.');
    }
    return status;
  }

  async function requireAvailable() {
    return check(await getStatus());
  }

  async function recordUsage(usage) {
    const total = Number(usage?.total_tokens);
    // A provider response without token accounting cannot bypass the budget.
    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error('AI provider did not report valid token usage; stopping to prevent unmetered requests.');
    }
    const job = writeQueue.catch(() => {}).then(async () => {
      const previous = await readCurrent();
      const next = { date: previous.date, month: previous.month,
        dayTokens: previous.dayTokens + total, monthTokens: previous.monthTokens + total };
      if (!Number.isSafeInteger(next.dayTokens) || !Number.isSafeInteger(next.monthTokens)) {
        throw new Error('AI usage counter overflow');
      }
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      const temp = filepath + '.tmp';
      await fs.writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
      await fs.rename(temp, filepath);
      return check({ ...previous, ...next,
        dailyRemaining: Math.max(0, dailyLimit - next.dayTokens),
        monthlyRemaining: Math.max(0, monthlyLimit - next.monthTokens) });
    });
    writeQueue = job.then(() => {}, () => {});
    return job;
  }

  return { requireAvailable, recordUsage, getStatus };
}
