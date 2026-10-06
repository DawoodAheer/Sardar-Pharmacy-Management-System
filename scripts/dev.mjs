import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const children = [];
let shuttingDown = false;

async function isReady(port) {
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

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
  process.exitCode = exitCode;
}

function startService(label, npmArgs) {
  console.log(`Starting ${label}...`);
  const child = spawn('npm', npmArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: isWindows,
    windowsHide: true,
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

const [apiReady, clientReady] = await Promise.all([
  isReady(5000),
  isReady(5173),
]);
if (apiReady) console.log('API is already running on port 5000; reusing it.');
else startService('API server', ['run', 'dev:server']);

if (clientReady) console.log('Client is already running on port 5173; reusing it.');
else startService('Vite client', ['run', 'dev:client']);

if (children.length === 0) {
  console.log('Pharma Desk is already running at http://localhost:5173.');
}
