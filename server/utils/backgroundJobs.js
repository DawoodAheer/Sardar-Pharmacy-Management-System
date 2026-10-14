import { fork } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import BackgroundJob from '../models/BackgroundJob.js';

export const JOB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../job-data');
let child, timer, stopping = false, claiming = false;
export async function enqueueJob(type, owner, payload) {
  if (await BackgroundJob.countDocuments({ status: { $in: ['queued', 'running'] } }) >= 20) {
    const error = new Error('Background queue is full. Wait for a job to finish.'); error.statusCode = 429; throw error;
  }
  const job = new BackgroundJob({ type, owner: owner || null });
  if (payload) {
    await fs.mkdir(JOB_DIR, { recursive: true });
    job.payloadFile = `${job._id}.json`;
    await fs.writeFile(path.join(JOB_DIR, job.payloadFile), JSON.stringify(payload), { flag: 'wx', mode: 0o600 });
  }
  try { await job.save(); } catch (error) {
    if (job.payloadFile) await fs.rm(path.join(JOB_DIR, job.payloadFile), { force: true });
    throw error;
  }
  return { jobId: String(job._id), status: job.status, message: 'Queued for background processing.' };
}

async function pump() {
  if (child || stopping || claiming) return;
  claiming = true;
  let job;
  try { job = await BackgroundJob.findOneAndUpdate({ status: 'queued' }, { $set: { status: 'running', startedAt: new Date() } }, { sort: { createdAt: 1 }, new: true }); }
  finally { claiming = false; }
  if (!job) return;
  if (stopping) {
    await BackgroundJob.updateOne({ _id: job._id, status: 'running' }, { $set: { status: 'queued' }, $unset: { startedAt: 1 } });
    return;
  }
  try {
    child = fork(fileURLToPath(new URL('./jobWorker.js', import.meta.url)), [String(job._id)], {
      execArgv: ['--max-old-space-size=512'], stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
  } catch (error) {
    await BackgroundJob.updateOne({ _id: job._id }, { $set: { status: 'failed', error: 'Could not start background worker.', finishedAt: new Date() } });
    throw error;
  }
  const active = child;
  const limit = setTimeout(() => active.kill(), 30 * 60 * 1000); limit.unref();
  let ended = false;
  const done = async () => {
    if (ended) return; ended = true;
    clearTimeout(limit); child = null;
    await BackgroundJob.updateOne({ _id: job._id, status: 'running' }, { $set: {
      status: 'failed', error: 'Worker stopped before completion. Import transactions can safely be retried.', finishedAt: new Date(),
    } }).catch(console.error);
  };
  active.once('error', done); active.once('exit', done);
}

export async function startJobQueue() {
  // One API/worker dispatcher per database. Interrupted work is reported, never silently lost.
  stopping = false;
  await BackgroundJob.updateMany({ status: 'running' }, { $set: { status: 'failed', error: 'Server restarted during processing. Please retry.', finishedAt: new Date() } });
  timer = setInterval(() => pump().catch(console.error), 1000); timer.unref();
}
export function stopJobQueue() { stopping = true; clearInterval(timer); child?.kill(); }
