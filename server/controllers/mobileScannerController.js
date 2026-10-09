import { WebSocketServer } from 'ws';
import os from 'os';
import crypto from 'crypto';
import multer from 'multer';
import Tesseract from 'tesseract.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Session store ─────────────────────────────────────────────────────────────
// Map<sessionId, { laptopWs, mobileWs, createdAt, lastScan, lastScanTime }>
const sessions = new Map();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const controllerDirectory = path.dirname(fileURLToPath(import.meta.url));
const englishOcrDataPath = path.resolve(controllerDirectory, '../node_modules/@tesseract.js-data/eng/4.0.0_best_int');
const ocrUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype));
} }).single('image');

// ── Helper: get laptop LAN IP ─────────────────────────────────────────────────
export function selectLaptopLanIPv4(ifaces) {
  const isCarrierGradeNat = (address) => {
    const [first, second] = address.split('.').map(Number);
    return first === 100 && second >= 64 && second <= 127;
  };
  const names = Object.keys(ifaces).sort((a, b) => {
    const rank = (name) => /tailscale|vpn|wireguard|docker|virtual|vmware|vbox|hyper-v|wsl|loopback|vethernet/i.test(name) ? 2 : /wi-?fi|wireless|wlan|ethernet/i.test(name) ? 0 : 1;
    return rank(a) - rank(b);
  });
  for (const name of names) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.') && !isCarrierGradeNat(iface.address)) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

export function getLaptopLocalIP() {
  return selectLaptopLanIPv4(os.networkInterfaces());
}

// ── Helper: generate session ID ───────────────────────────────────────────────
function generateSessionId() {
  return crypto.randomBytes(32).toString('base64url');
}

// ── Clean up expired sessions ─────────────────────────────────────────────────
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      session.mobileWs?.close(4001, 'Scanner session expired');
      session.laptopWs?.close(4001, 'Scanner session expired');
      sessions.delete(id);
    }
  }
}
const sessionCleanupTimer = setInterval(cleanExpiredSessions, 5 * 60 * 1000); // every 5 min
sessionCleanupTimer.unref();

// ── REST: create / get session URL ───────────────────────────────────────────
export const getScannerUrl = (req, res) => {
  const localIp = getLaptopLocalIP();
  let pageUrl;
  try { pageUrl = new URL(req.get('referer') || 'http://localhost:5174'); } catch { pageUrl = new URL('http://localhost:5174'); }
  const requestedPort = Number(req.query.frontendPort);
  const fallbackPort = Number(process.env.FRONTEND_PORT || 5174);
  const frontendPort = Number.isInteger(requestedPort) && requestedPort >= 1 && requestedPort <= 65535
    ? requestedPort
    : Number(pageUrl.port || fallbackPort);
  const sessionId = generateSessionId();

  sessions.set(sessionId, {
    laptopWs: null,
    mobileWs: null,
    createdAt: Date.now(),
    lastScan: null,
    lastScanTime: 0,
    lastScanKey: '',
    lastOcrKey: '',
    lastOcrTime: 0,
    frontendPort: String(frontendPort),
    protocol: pageUrl.protocol,
  });

  const scannerUrl = `${pageUrl.protocol}//${localIp}:${frontendPort}/mobile-scanner?sessionId=${encodeURIComponent(sessionId)}`;
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
  const DEBOUNCE_MS = 900;
  const value = String(data?.barcode || '').trim();
  if (!value || value.length > 256) return res.status(400).json({ message: 'Invalid barcode.' });
  const key = `barcode:${value.toLowerCase()}`;
  if (key === session.lastScanKey && now - session.lastScanTime < DEBOUNCE_MS) {
    return res.json({ success: true, duplicate: true });
  }

  session.lastScanRaw = value;
  session.lastScanKey = key;
  session.lastScanTime = now;
  // Forward to laptop if WebSocket is open
  if (session.laptopWs?.readyState === 1) {
    session.laptopWs.send(JSON.stringify({ type: 'scan_result', data }));
  } else {
    session.lastScan = { type: 'scan_result', data };
  }

  res.json({ success: true, duplicate: false });
};

export const scanMobileLabel = (req, res, next) => {
  ocrUpload(req, res, async (uploadError) => {
    if (uploadError) return res.status(400).json({ message: uploadError.code === 'LIMIT_FILE_SIZE' ? 'Label image is too large.' : 'Choose a JPG, PNG, or WebP label image.' });
    const sessionId = req.body?.sessionId;
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ message: 'Scanner session expired. Pair the phone again from the laptop.' });
    if (!req.file) return res.status(400).json({ message: 'No label image was received.' });
    try {
      const result = await Tesseract.recognize(req.file.buffer, 'eng', {
        langPath: englishOcrDataPath,
        gzip: true,
        cacheMethod: 'none',
      });
      const rawText = String(result.data.text || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
      if (!rawText) {
        session.lastOcrKey = '';
        return res.json({ success: true, empty: true });
      }
      const data = { rawText, confidence: Number(result.data.confidence || 0), timestamp: Date.now() };
      const now = Date.now();
      const key = `ocr:${rawText.toLowerCase()}`;
      if (key === session.lastOcrKey && now - session.lastOcrTime < 30000) {
        return res.json({ success: true, duplicate: true });
      }
      session.lastOcrKey = key;
      session.lastOcrTime = now;
      if (session.laptopWs?.readyState === 1) session.laptopWs.send(JSON.stringify({ type: 'ocr_result', data }));
      else session.lastScan = { type: 'ocr_result', data };
      res.json({ success: true, duplicate: false });
    } catch (error) {
      next(error);
    }
  });
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
    localIp: getLaptopLocalIP(),
    scannerUrl: `${session.protocol || 'http:'}//${getLaptopLocalIP()}:${session.frontendPort || process.env.FRONTEND_PORT || 5173}/mobile-scanner?sessionId=${sessionId}`,
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

    if (role !== 'laptop' && role !== 'mobile') {
      ws.close(4000, 'Invalid scanner role');
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      ws.close(4001, 'Scanner session expired');
      return;
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
      ws.send(JSON.stringify({ type: 'connected', role: 'mobile', sessionId, laptopConnected: session.laptopWs?.readyState === 1 }));

      // Notify laptop
      if (session.laptopWs?.readyState === 1) {
        session.laptopWs.send(JSON.stringify({ type: 'mobile_connected' }));
        ws.send(JSON.stringify({ type: 'laptop_connected' }));
      }
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'scan_result') {
          const now = Date.now();
          const DEBOUNCE_MS = 900;

          // Duplicate protection
          const value = String(msg.data?.barcode || '').trim();
          if (!value || value.length > 256) {
            ws.send(JSON.stringify({ type: 'ack', invalid: true }));
            return;
          }
          const key = `barcode:${value.toLowerCase()}`;
          if (key === session.lastScanKey && now - session.lastScanTime < DEBOUNCE_MS) {
            ws.send(JSON.stringify({ type: 'ack', duplicate: true }));
            return;
          }

          session.lastScanRaw = value;
          session.lastScanKey = key;
          session.lastScanTime = now;
          // Forward to laptop
          if (session.laptopWs?.readyState === 1) {
            session.laptopWs.send(JSON.stringify({ type: 'scan_result', data: msg.data }));
          } else {
            session.lastScan = { type: 'scan_result', data: msg.data };
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
