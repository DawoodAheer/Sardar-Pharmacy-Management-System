import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import WebSocket from 'ws';
import {
  getScannerUrl,
  initMobileScannerWebSocket,
  selectLaptopLanIPv4,
} from './mobileScannerController.js';

const waitForMessage = (socket, predicate) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Timed out waiting for scanner message')), 3000);
  const onMessage = (raw) => {
    const message = JSON.parse(raw.toString());
    if (!predicate(message)) return;
    clearTimeout(timeout);
    socket.off('message', onMessage);
    resolve(message);
  };
  socket.on('message', onMessage);
});

const waitForOpen = (socket) => new Promise((resolve, reject) => {
  socket.once('open', resolve);
  socket.once('error', reject);
});

test('chooses the Wi-Fi address over Tailscale and virtual adapters', () => {
  const interfaces = {
    Tailscale: [{ family: 'IPv4', internal: false, address: '100.77.201.45' }],
    'vEthernet (Default Switch)': [{ family: 'IPv4', internal: false, address: '172.18.16.1' }],
    'Wi-Fi': [{ family: 'IPv4', internal: false, address: '192.168.100.50' }],
  };

  assert.equal(selectLaptopLanIPv4(interfaces), '192.168.100.50');
});

test('pairs phone and laptop through the same scanner session and forwards scans', async () => {
  const previousFrontendPort = process.env.FRONTEND_PORT;
  process.env.FRONTEND_PORT = '5173';

  const server = http.createServer();
  const wss = initMobileScannerWebSocket(server);
  const sockets = [];

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    let sessionData;
    getScannerUrl(
      { get: () => 'http://localhost:5173/', query: { frontendPort: '5174' } },
      { json: (data) => { sessionData = data; } }
    );
    assert.equal(new URL(sessionData.scannerUrl).port, '5174');
    assert.equal(new URL(sessionData.scannerUrl).pathname, '/mobile-scanner');

    const wsBase = `ws://127.0.0.1:${server.address().port}/ws/scanner?sessionId=${sessionData.sessionId}`;
    const laptop = new WebSocket(`${wsBase}&role=laptop`);
    sockets.push(laptop);
    const laptopReady = waitForMessage(laptop, (msg) => msg.type === 'connected');
    await waitForOpen(laptop);
    await laptopReady;

    const laptopSeesPhone = waitForMessage(laptop, (msg) => msg.type === 'mobile_connected');
    const phone = new WebSocket(`${wsBase}&role=mobile`);
    sockets.push(phone);
    const phoneReady = waitForMessage(phone, (msg) => msg.type === 'connected');
    const phoneSeesLaptop = waitForMessage(phone, (msg) => msg.type === 'laptop_connected');
    await waitForOpen(phone);
    const [phoneStatus] = await Promise.all([phoneReady, laptopSeesPhone, phoneSeesLaptop]);
    assert.equal(phoneStatus.role, 'mobile');
    assert.equal(phoneStatus.laptopConnected, true);

    const scanReceived = waitForMessage(laptop, (msg) => msg.type === 'scan_result');
    phone.send(JSON.stringify({ type: 'scan_result', data: { barcode: '1234567890' } }));
    assert.equal((await scanReceived).data.barcode, '1234567890');
  } finally {
    for (const socket of sockets) socket.terminate();
    await new Promise((resolve) => wss.close(resolve));
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    if (previousFrontendPort === undefined) delete process.env.FRONTEND_PORT;
    else process.env.FRONTEND_PORT = previousFrontendPort;
  }
});
