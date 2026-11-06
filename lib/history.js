import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { redactForLog } from './safety.js';

const BASE = process.env.WORKMODE_CLOUD_MODE === '1' && process.env.WORKMODE_DATA_DIR
  ? path.resolve(process.env.WORKMODE_DATA_DIR)
  : path.join(os.homedir(), '.work-mode');
const FILE = path.join(BASE, 'task-history.json');
const MAX_HISTORY = 60;
let writeQueue = Promise.resolve();

async function readAll() {
  try {
    const data = JSON.parse(await fs.readFile(FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}
export async function listHistory() {
  return (await readAll()).map(({ id, task, phase, answer, startedAt, finishedAt, steps }) =>
    ({ id, task, phase, answer, startedAt, finishedAt, steps })).reverse();
}
export async function recordTask(record) {
  const task = {
    id: crypto.randomUUID(),
    task: redactForLog(record.task).slice(0, 3000),
    phase: String(record.phase || 'unknown'),
    answer: redactForLog(record.answer || '').slice(0, 3000),
    startedAt: String(record.startedAt || ''),
    finishedAt: new Date().toISOString(),
    steps: Math.max(0, Number(record.steps) || 0),
    actions: (record.actions || []).slice(-40).map(a => ({
      at: a.at, message: redactForLog(a.message)
    }))
  };
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    await fs.mkdir(BASE, { recursive: true, mode: 0o700 });
    const all = await readAll();
    all.push(task);
    const staged = FILE + '.tmp';
    await fs.writeFile(staged, JSON.stringify(all.slice(-MAX_HISTORY), null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(staged, FILE);
  });
  await writeQueue;
  return task.id;
}
export async function historyEntry(id) {
  return (await readAll()).find(entry => entry.id === id) || null;
}
