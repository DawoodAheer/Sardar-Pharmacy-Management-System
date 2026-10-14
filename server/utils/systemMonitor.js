import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import mongoose from 'mongoose';
import BackgroundJob from '../models/BackgroundJob.js';
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../logs');
const histogram = monitorEventLoopDelay({ resolution: 20 }); histogram.enable();
let failures = 0, lastFailureAt = null;
export function monitorRequests(req, res, next) {
  res.once('finish', () => {
    if (res.statusCode < 500) return;
    failures++; lastFailureAt = new Date().toISOString();
    // Only route names and status: no bodies, passwords, auth headers or query strings.
    const record = JSON.stringify({ time: lastFailureAt, method: req.method, route: req.route?.path || 'unmatched', status: res.statusCode }) + '\n';
    fs.mkdir(directory, { recursive: true }).then(async () => {
      const file = path.join(directory, 'errors.jsonl');
      const size = (await fs.stat(file).catch(() => ({ size: 0 }))).size;
      if (size > 5 * 1024 * 1024) await fs.rename(file, path.join(directory, 'errors.previous.jsonl')).catch(() => {});
      await fs.appendFile(file, record);
    }).catch(() => {});
  }); next();
}
export async function getSystemStatus(_req, res, next) {
  try {
    const disk = await fs.statfs(path.dirname(directory)).catch(() => null);
    const freeDiskBytes = disk ? disk.bavail * disk.bsize : null;
    const memory = process.memoryUsage(), freeMemoryBytes = os.freemem();
    const eventLoopP99Ms = Number((histogram.percentile(99) / 1e6).toFixed(1)); histogram.reset();
    const warnings = [];
    if (freeDiskBytes !== null && freeDiskBytes < 2 * 1024 ** 3) warnings.push('Less than 2 GB free on the server disk.');
    if (freeMemoryBytes < 512 * 1024 ** 2) warnings.push('Less than 512 MB free system memory.');
    if (eventLoopP99Ms > 200) warnings.push('API event loop is delayed.');
    if (mongoose.connection.readyState !== 1) warnings.push('Database is disconnected.');
    const jobs = await BackgroundJob.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    res.json({ uptimeSeconds: Math.round(process.uptime()), databaseConnected: mongoose.connection.readyState === 1, freeDiskBytes, freeMemoryBytes, totalMemoryBytes: os.totalmem(), apiMemoryBytes: memory.rss, eventLoopP99Ms, failures, lastFailureAt, jobs, warnings });
  } catch (error) { next(error); }
}
