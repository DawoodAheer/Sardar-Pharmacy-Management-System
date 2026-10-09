import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
// Keep one predictable desktop/mobile URL for this project. Do not move the
// workspace to another random free port: scanner QR links and browser bookmarks
// must keep pointing to the same address.
const apiPort = Number(process.env.PHARMADESK_API_PORT || 5001);
const clientPort = Number(process.env.PHARMADESK_CLIENT_PORT || 5174);
const children = [];
let shuttingDown = false;

async function isReady(port, apiPort) {
  try {
    if (port >= 5000 && port <= 5010) {
      const response = await fetch(`http://localhost:${port}/api/dev-identity`, {
        signal: AbortSignal.timeout(2500),
      });
      return response.ok && (await response.text()) === 'sardar-pharmacy-dev-api-v2';
    }
    const response = await fetch(`http://localhost:${port}/__pharmadesk_dev_identity`, {
      signal: AbortSignal.timeout(2500),
    });
    return response.ok &&
      (await response.text()) === `sardar-pharmacy-dev-client-v2:${apiPort}`;
  } catch {
    return false;
  }
}

async function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '0.0.0.0', () => server.close(() => resolve(true)));
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
  process.exitCode = exitCode;
}

function startService(label, npmArgs, env = process.env) {
  console.log(`Starting ${label}...`);
  // npm sets this to its CLI entrypoint. Running it through node avoids the
  // Windows shell=true .cmd shim and its DEP0190 warning/argument ambiguity.
  const npmCliPath = env.npm_execpath || process.env.npm_execpath;
  const command = npmCliPath ? process.execPath : 'npm';
  const args = npmCliPath ? [npmCliPath, ...npmArgs] : npmArgs;
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
    env,
  });
  children.push(child);
  child.once('error', (error) => {
    console.error(`Could not start ${label}: ${error.message}`);
    shutdown(1);
  });
  child.once('exit', (code, signal) => {
    if (!shuttingDown) {
      const unexpectedExit = code !== 0;
      console.error(
        `${label} stopped${signal ? ` (${signal})` : ` (exit ${code})`}.`
      );
      shutdown(unexpectedExit ? code || 1 : 0);
    }
  });
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));

const apiIsReady = await isReady(apiPort);
if (apiIsReady) console.log(`API is already running on port ${apiPort}; reusing it.`);
else {
  if (!await canBindPort(apiPort)) {
    throw new Error(`Port ${apiPort} is occupied by another service. Stop it, then restart; this project always uses the configured port.`);
  }
  console.log(`Starting this workspace API on port ${apiPort}...`);
  startService('API server', ['run', 'dev:server'], {
    ...process.env,
    PORT: String(apiPort),
    FRONTEND_PORT: String(clientPort),
    MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pharmadesk?replicaSet=rs0&directConnection=true',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'pharmadesk-local-development-access-secret-change-in-production',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'pharmadesk-local-development-refresh-secret-change-in-production',
  });
}

const clientIsReady = await isReady(clientPort, apiPort);
if (clientIsReady) console.log(`Client is already running on port ${clientPort}; reusing it.`);
else {
  if (!await canBindPort(clientPort)) {
    throw new Error(`Port ${clientPort} is occupied by another service. Stop it, then restart; this project always uses the configured port.`);
  }
  console.log(`Starting this workspace client at http://localhost:${clientPort}...`);
  startService(
    'Vite client',
    ['run', 'dev', '--prefix', 'client', '--', '--host', '0.0.0.0', '--port', String(clientPort), '--strictPort'],
    { ...process.env, PHARMADESK_API_PORT: String(apiPort), PHARMADESK_CLIENT_PORT: String(clientPort) }
  );
}

if (children.length === 0) {
  console.log(`Pharma Desk is already running at http://localhost:${clientPort}.`);
}
