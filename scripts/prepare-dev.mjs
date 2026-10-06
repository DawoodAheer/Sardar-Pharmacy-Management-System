import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverRequire = createRequire(path.join(projectRoot, 'server', 'package.json'));
const mongoose = serverRequire('mongoose');
const dotenv = serverRequire('dotenv');

dotenv.config({ path: path.join(projectRoot, 'server', '.env') });

const mongoUri = process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/pharmadesk?replicaSet=rs0&directConnection=true';

function getListeningPorts() {
  const result = spawnSync('powershell', [
    '-NoProfile',
    '-Command',
    '$ports = 5000,5173; Get-NetTCPConnection -State Listen -LocalPort $ports -ErrorAction SilentlyContinue | Select-Object LocalPort,OwningProcess | ConvertTo-Json -Compress',
  ], { encoding: 'utf8', windowsHide: true });

  if (result.error || result.status !== 0) {
    throw new Error('Unable to inspect whether development ports 5000 and 5173 are in use.');
  }

  const raw = result.stdout.trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

async function isProjectServiceReady(port) {
  try {
    const response = await fetch(`http://localhost:${port}/`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return false;
    const body = await response.text();
    return port === 5000
      ? body.includes('Sardar Medical Store API is running')
      : body.includes('/@vite/client');
  } catch {
    return false;
  }
}

async function ensureDevPortsAvailable() {
  const listeners = getListeningPorts();
  for (const port of [5000, 5173]) {
    if (await isProjectServiceReady(port)) continue;
    const listener = listeners.find((entry) => Number(entry.LocalPort) === port);
    if (listener) {
      throw new Error(
        `Port ${port} is occupied by another process (PID ${listener.OwningProcess}) and is not serving this pharmacy app. Stop that process or configure the port before starting.`
      );
    }
  }
}
async function verifyDatabase() {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2500 });
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await mongoose.connection.db.collection('users').findOne({}, { session });
    });
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}

try {
  await ensureDevPortsAvailable();
  await verifyDatabase();
  console.log('Local MongoDB is reachable and transaction-ready.');
} catch (initialError) {
  console.log('Local MongoDB is not ready; starting the persistent Docker database...');
  const docker = spawnSync('docker', ['compose', 'up', '-d', 'mongodb'], {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
  });

  if (docker.error || docker.status !== 0) {
    console.error('Could not start MongoDB with Docker Compose. Start Docker Desktop or configure a local MongoDB replica set.');
    console.error(initialError.message);
    process.exit(1);
  }

  let ready = false;
  let lastError = initialError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      await verifyDatabase();
      ready = true;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!ready) {
    console.error('MongoDB did not become transaction-ready within 60 seconds.');
    console.error(lastError.message);
    process.exit(1);
  }
  console.log('Local MongoDB is ready; existing database volume was preserved.');
}