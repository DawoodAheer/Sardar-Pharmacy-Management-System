import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

function ensureDependencies(packageDirectory, label) {
  const manifestPath = path.join(packageDirectory, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const declared = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };
  const missing = Object.keys(declared).filter((name) => {
    const dependencyPath = path.join(packageDirectory, 'node_modules', ...name.split('/'));
    return !fs.existsSync(dependencyPath);
  });

  if (missing.length === 0) return true;

  const lockPath = path.join(packageDirectory, 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    console.error(`${label} dependencies are missing and ${path.relative(projectRoot, lockPath)} was not found.`);
    console.error('Restore the package lockfile before starting the app.');
    return false;
  }

  console.log(`${label} dependencies are missing; installing from the package lockfile...`);
  const installArgs = ['ci'];
  // The client lockfile intentionally uses legacy peer resolution (React 19
  // with packages that still declare React 18 peer ranges), matching the
  // repository's install:all command.
  if (label === 'Frontend') installArgs.push('--legacy-peer-deps');

  const result = spawnSync(isWindows ? 'npm.cmd' : 'npm', installArgs, {
    cwd: packageDirectory,
    stdio: 'inherit',
    shell: isWindows,
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    console.error(`Could not install ${label} dependencies.`);
    console.error('The first setup needs internet access or a populated npm cache. Once dependencies are installed, the pharmacy app runs locally.');
    return false;
  }

  return true;
}

if (!ensureDependencies(path.join(projectRoot, 'server'), 'Backend') ||
    !ensureDependencies(path.join(projectRoot, 'client'), 'Frontend')) {
  process.exit(1);
}

const serverRequire = createRequire(path.join(projectRoot, 'server', 'package.json'));
const mongoose = serverRequire('mongoose');
const dotenv = serverRequire('dotenv');

dotenv.config({ path: path.join(projectRoot, 'server', '.env') });

const mongoUri = process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/pharmadesk?replicaSet=rs0&directConnection=true';

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
