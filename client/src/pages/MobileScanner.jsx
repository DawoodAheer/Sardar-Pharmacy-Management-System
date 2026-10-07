import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';

// ── Icons (inline SVG to avoid any import issues on mobile) ──────────────────
const Icon = {
  camera: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  check: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  stop: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ),
  wifi: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  ),
  alert: (cls) => (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

const DEBOUNCE_MS = 3000;

export default function MobileScanner() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [phase, setPhase] = useState('connecting'); // connecting | ready | scanning | error
  const [wsStatus, setWsStatus] = useState('disconnected'); // connected | disconnected | reconnecting
  const [lastScan, setLastScan] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCamId, setSelectedCamId] = useState('');
  const [ackMsg, setAckMsg] = useState('');

  const wsRef = useRef(null);
  const html5QrRef = useRef(null);
  const lastSentRef = useRef('');
  const lastSentTimeRef = useRef(0);
  const ackTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const isScanningRef = useRef(false);

  // ── Build WS URL ──────────────────────────────────────────────────────────
  const buildWsUrl = useCallback(() => {
    const host = window.location.host; // e.g. 192.168.100.50:5173
    return `ws://${host}/ws/scanner?sessionId=${sessionId}&role=mobile`;
  }, [sessionId]);

  // ── WebSocket connection ──────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (!sessionId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setWsStatus('reconnecting');
    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      setPhase('ready');
      setErrorMsg('');

      // Send heartbeat every 20s
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'ack') {
          if (!msg.duplicate) {
            showAck('✓ Sent to laptop!');
          }
        }
        if (msg.type === 'laptop_disconnected') {
          showAck('⚠ Laptop disconnected', true);
        }
        if (msg.type === 'laptop_connected') {
          showAck('✓ Laptop reconnected');
        }
      } catch {}
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      clearInterval(pingIntervalRef.current);
      // Auto-reconnect after 3 seconds
      reconnectTimerRef.current = setTimeout(() => {
        if (isScanningRef.current) connectWs();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [buildWsUrl, sessionId]);

  // ── Show acknowledgement banner ───────────────────────────────────────────
  const showAck = (msg, isWarn = false) => {
    setAckMsg({ text: msg, warn: isWarn });
    clearTimeout(ackTimerRef.current);
    ackTimerRef.current = setTimeout(() => setAckMsg(''), 2500);
  };

  // ── Send scan result ──────────────────────────────────────────────────────
  const sendScan = useCallback((text) => {
    const now = Date.now();
    if (text === lastSentRef.current && now - lastSentTimeRef.current < DEBOUNCE_MS) {
      return; // duplicate — skip
    }
    lastSentRef.current = text;
    lastSentTimeRef.current = now;

    setLastScan(text);
    setScanCount(c => c + 1);

    const payload = JSON.stringify({ type: 'scan_result', data: { barcode: text, timestamp: now } });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload);
    } else {
      // HTTP fallback
      fetch('/api/mobile-scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, data: { barcode: text } }),
      }).catch(() => {});
    }
  }, [sessionId]);

  // ── Start continuous camera scanner ──────────────────────────────────────
  const startScanner = useCallback(() => {
    if (!selectedCamId && cameras.length === 0) return;
    const camId = selectedCamId || cameras[0]?.id;
    if (!camId) return;

    const qr = new Html5Qrcode('qr-reader');
    html5QrRef.current = qr;
    isScanningRef.current = true;
    setPhase('scanning');

    qr.start(
      camId,
      {
        fps: 10,
        qrbox: (vw, vh) => ({
          width: Math.min(vw * 0.8, 280),
          height: Math.min(vh * 0.5, 200),
        }),
        aspectRatio: 1.0,
        disableFlip: false,
      },
      (decodedText) => {
        sendScan(decodedText);
      },
      () => {} // per-frame fail — ignore
    ).catch((err) => {
      setErrorMsg(
        err?.message?.includes('Permission')
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : 'Could not start camera: ' + (err?.message || err)
      );
      setPhase('ready');
      isScanningRef.current = false;
    });

    connectWs();
  }, [selectedCamId, cameras, sendScan, connectWs]);

  // ── Stop scanner ──────────────────────────────────────────────────────────
  const stopScanner = useCallback(async () => {
    isScanningRef.current = false;
    clearTimeout(reconnectTimerRef.current);
    clearInterval(pingIntervalRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    if (html5QrRef.current?.isScanning) {
      try { await html5QrRef.current.stop(); } catch {}
    }
    html5QrRef.current = null;
    setPhase('ready');
    setWsStatus('disconnected');
  }, []);

  // ── On mount: detect cameras and connect WS ───────────────────────────────
  useEffect(() => {
    if (!sessionId) {
      setPhase('error');
      setErrorMsg('Missing session ID. Please scan the QR code from your laptop again.');
      return;
    }

    Html5Qrcode.getCameras()
      .then((devs) => {
        if (!devs?.length) {
          setPhase('error');
          setErrorMsg('No camera found on this device.');
          return;
        }
        setCameras(devs);
        // prefer back camera
        const back = devs.find(d => /back|rear|environment/i.test(d.label));
        setSelectedCamId((back || devs[0]).id);
        setPhase('ready');
      })
      .catch(() => {
        setPhase('error');
        setErrorMsg('Camera permission denied or camera unavailable. Please allow camera access and refresh this page.');
      });

    // Connect WS immediately (laptop is waiting)
    connectWs();

    return () => {
      isScanningRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      clearInterval(pingIntervalRef.current);
      clearTimeout(ackTimerRef.current);
      if (html5QrRef.current?.isScanning) {
        html5QrRef.current.stop().catch(() => {});
      }
      wsRef.current?.close();
    };
  }, [sessionId, connectWs]);

  // ── Reset debounce when medicine removed ──────────────────────────────────
  const resetScan = () => {
    lastSentRef.current = '';
    lastSentTimeRef.current = 0;
    showAck('Ready for next scan ↓');
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  const statusDot = {
    connected: 'bg-emerald-400',
    disconnected: 'bg-rose-400',
    reconnecting: 'bg-amber-400 animate-pulse',
  }[wsStatus] || 'bg-slate-400';

  if (phase === 'connecting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white flex-col gap-4">
        <div className="h-10 w-10 rounded-full border-4 border-teal-400 border-t-transparent animate-spin" />
        <p className="text-slate-300 text-sm">Connecting to pharmacy system...</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white p-6 text-center gap-4">
        {Icon.alert('h-16 w-16 text-rose-400')}
        <h1 className="text-xl font-bold text-rose-300">Scanner Error</h1>
        <p className="text-slate-300 text-sm max-w-xs">{errorMsg}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-3 rounded-2xl bg-teal-600 font-bold text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50 select-none">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon.camera('h-5 w-5 text-teal-400')}
          <span className="font-bold text-sm tracking-wide">Sardar Pharma Scanner</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className={`h-2.5 w-2.5 rounded-full ${statusDot}`} />
          {wsStatus === 'connected' ? 'Laptop Connected' :
           wsStatus === 'reconnecting' ? 'Reconnecting...' : 'Laptop Disconnected'}
        </div>
      </div>

      {/* Ack banner */}
      {ackMsg && (
        <div className={`px-4 py-2 text-center text-sm font-bold transition-all ${ackMsg.warn ? 'bg-amber-600' : 'bg-emerald-700'}`}>
          {ackMsg.text}
        </div>
      )}

      {/* Scanner viewport */}
      <div className="flex-1 flex flex-col">
        <div
          id="qr-reader"
          className={`w-full ${phase === 'scanning' ? 'block' : 'hidden'}`}
          style={{ maxHeight: '65vh' }}
        />

        {phase === 'ready' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
            <div className="w-32 h-32 rounded-3xl bg-slate-800 flex items-center justify-center border border-slate-700">
              {Icon.camera('h-16 w-16 text-slate-600')}
            </div>

            {cameras.length > 1 && (
              <select
                value={selectedCamId}
                onChange={e => setSelectedCamId(e.target.value)}
                className="w-full max-w-xs bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none"
              >
                {cameras.map(c => (
                  <option key={c.id} value={c.id}>{c.label || `Camera ${c.id.substring(0, 8)}`}</option>
                ))}
              </select>
            )}

            <button
              onClick={startScanner}
              className="w-full max-w-xs py-4 rounded-2xl bg-teal-600 text-white font-bold text-lg shadow-[0_0_30px_rgba(13,148,136,0.4)] active:scale-95 transition-transform"
            >
              Start Scanning
            </button>

            <p className="text-slate-500 text-xs text-center">
              Make sure your phone and laptop are on the same Wi-Fi network.
            </p>
          </div>
        )}

        {phase === 'scanning' && (
          <div className="p-4 space-y-3">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-900/50 border border-rose-700 text-rose-200 text-xs">
                {errorMsg}
              </div>
            )}

            {lastScan && (
              <div className="p-4 rounded-2xl bg-emerald-900/40 border border-emerald-700/50 text-center">
                {Icon.check('h-7 w-7 text-emerald-400 mx-auto mb-1')}
                <p className="text-[10px] text-emerald-400 mb-1">Last Sent to Laptop ({scanCount} total)</p>
                <p className="font-mono text-base text-emerald-300 font-bold break-all">{lastScan}</p>
                <button
                  onClick={resetScan}
                  className="mt-3 text-xs text-emerald-400 underline"
                >
                  Scan next medicine →
                </button>
              </div>
            )}

            <button
              onClick={stopScanner}
              className="w-full py-3.5 rounded-2xl bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              {Icon.stop('h-5 w-5')}
              Stop Camera
            </button>

            <p className="text-slate-500 text-[10px] text-center">
              Point camera at medicine barcode — it scans automatically.
              Same medicine will not be sent twice within 3 seconds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
