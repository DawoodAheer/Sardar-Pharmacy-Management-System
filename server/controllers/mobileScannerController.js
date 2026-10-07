import { WebSocketServer } from 'ws';
import os from 'os';

// ── Session store ─────────────────────────────────────────────────────────────
// Map<sessionId, { laptopWs, mobileWs, createdAt, lastScan, lastScanTime }>
const sessions = new Map();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Helper: get laptop LAN IP ─────────────────────────────────────────────────
export function getLaptopLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// ── Helper: generate session ID ───────────────────────────────────────────────
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

// ── Clean up expired sessions ─────────────────────────────────────────────────
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}
setInterval(cleanExpiredSessions, 5 * 60 * 1000); // every 5 min

// ── REST: create / get session URL ───────────────────────────────────────────
export const getScannerUrl = (req, res) => {
  const localIp = getLaptopLocalIP();
  const frontendPort = process.env.FRONTEND_PORT || 5173;
  const sessionId = generateSessionId();

  sessions.set(sessionId, {
    laptopWs: null,
    mobileWs: null,
    createdAt: Date.now(),
    lastScan: null,
    lastScanTime: 0,
  });

  const scannerUrl = `http://${localIp}:${frontendPort}/mobile-scanner?sessionId=${sessionId}`;
  res.json({ scannerUrl, sessionId, localIp, port: frontendPort });
};

// ── REST: get current scan result (polling fallback) ─────────────────────────
export const getScanResult = (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ message: 'Session not found or expired.' });
  }
  const result = session.lastScan;
  if (result) {
    session.lastScan = null; // clear after reading
  }
  res.json({ result: result || null, connected: session.mobileWs?.readyState === 1 });
};

// ── REST: submit scan (HTTP fallback for phones without WS) ──────────────────
export const submitScan = (req, res) => {
  const { sessionId, data } = req.body;
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ message: 'Session not found or expired.' });
  }

  const now = Date.now();
  const DEBOUNCE_MS = 3000;
  if (data?.barcode && data.barcode === session.lastScanRaw && now - session.lastScanTime < DEBOUNCE_MS) {
    return res.json({ success: true, duplicate: true });
  }

  session.lastScanRaw = data?.barcode;
  session.lastScanTime = now;
  session.lastScan = data;

  // Forward to laptop if WebSocket is open
  if (session.laptopWs?.readyState === 1) {
    session.laptopWs.send(JSON.stringify({ type: 'scan_result', data }));
  }

  res.json({ success: true, duplicate: false });
};

// ── REST: session status ──────────────────────────────────────────────────────
export const getSessionStatus = (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ message: 'Session not found or expired.' });
  }
  res.json({
    sessionId,
    mobileConnected: session.mobileWs?.readyState === 1,
    laptopConnected: session.laptopWs?.readyState === 1,
  });
};

// ── WebSocket server ──────────────────────────────────────────────────────────
export function initMobileScannerWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/scanner' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://localhost`);
    const sessionId = url.searchParams.get('sessionId');
    const role = url.searchParams.get('role'); // 'laptop' or 'mobile'

    if (!sessionId) {
      ws.close(4000, 'Missing sessionId');
      return;
    }

    let session = sessions.get(sessionId);
    if (!session) {
      // Auto-create session if laptop connects first via WS
      session = {
        laptopWs: null,
        mobileWs: null,
        createdAt: Date.now(),
        lastScan: null,
        lastScanRaw: null,
        lastScanTime: 0,
      };
      sessions.set(sessionId, session);
    }

    if (role === 'laptop') {
      session.laptopWs = ws;
      ws.send(JSON.stringify({ type: 'connected', role: 'laptop', sessionId }));

      // Notify mobile if already connected
      if (session.mobileWs?.readyState === 1) {
        session.mobileWs.send(JSON.stringify({ type: 'laptop_connected' }));
        ws.send(JSON.stringify({ type: 'mobile_connected' }));
      }
    } else if (role === 'mobile') {
      session.mobileWs = ws;
      ws.send(JSON.stringify({ type: 'connected', role: 'mobile', sessionId }));

      // Notify laptop
      if (session.laptopWs?.readyState === 1) {
        session.laptopWs.send(JSON.stringify({ type: 'mobile_connected' }));
      }
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'scan_result') {
          const now = Date.now();
          const DEBOUNCE_MS = 3000;

          // Duplicate protection
          if (
            msg.data?.barcode &&
            msg.data.barcode === session.lastScanRaw &&
            now - session.lastScanTime < DEBOUNCE_MS
          ) {
            ws.send(JSON.stringify({ type: 'ack', duplicate: true }));
            return;
          }

          session.lastScanRaw = msg.data?.barcode || null;
          session.lastScanTime = now;
          session.lastScan = msg.data;

          // Forward to laptop
          if (session.laptopWs?.readyState === 1) {
            session.laptopWs.send(JSON.stringify({ type: 'scan_result', data: msg.data }));
          }
          ws.send(JSON.stringify({ type: 'ack', duplicate: false }));
        }

        // Heartbeat / ping
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (e) {
        // ignore parse errors
      }
    });

    ws.on('close', () => {
      if (role === 'laptop' && session.laptopWs === ws) {
        session.laptopWs = null;
        if (session.mobileWs?.readyState === 1) {
          session.mobileWs.send(JSON.stringify({ type: 'laptop_disconnected' }));
        }
      }
      if (role === 'mobile' && session.mobileWs === ws) {
        session.mobileWs = null;
        if (session.laptopWs?.readyState === 1) {
          session.laptopWs.send(JSON.stringify({ type: 'mobile_disconnected' }));
        }
      }
    });

    ws.on('error', () => {});
  });

  console.log('[MobileScanner] WebSocket server ready on /ws/scanner');
  return wss;
}
