import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

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

const REARM_AFTER_MS = 1400;

export default function MobileScanner() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [phase, setPhase] = useState('ready'); // ready | scanning | error
  const [wsStatus, setWsStatus] = useState('disconnected'); // connected | disconnected | reconnecting
  const [laptopConnected, setLaptopConnected] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraStarting, setCameraStarting] = useState(false);
  const [imageScanning, setImageScanning] = useState(false);
  const [ackMsg, setAckMsg] = useState('');

  const wsRef = useRef(null);
  const captureInputRef = useRef(null);
  const pageActiveRef = useRef(false);
  const html5QrRef = useRef(null);
  const lastSentRef = useRef('');
  const lastSentTimeRef = useRef(0);
  const ackTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const ocrIntervalRef = useRef(null);
  const isScanningRef = useRef(false);
  const lastDetectionAtRef = useRef(0);
  const lastBarcodeAtRef = useRef(0);
  const ocrBusyRef = useRef(false);
  const pendingScanRef = useRef(null);

  // ── Build WS URL ──────────────────────────────────────────────────────────
  const buildWsUrl = useCallback(() => {
    const host = window.location.host; // e.g. 192.168.100.50:5173
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${host}/ws/scanner?sessionId=${encodeURIComponent(sessionId)}&role=mobile`;
  }, [sessionId]);

  // ── WebSocket connection ──────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (!sessionId) return;
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return;

    setWsStatus('reconnecting');
    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      setPhase('ready');
      setErrorMsg((current) => current.startsWith('Laptop connection') ? '' : current);
      if (pendingScanRef.current) ws.send(pendingScanRef.current);

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
        if (msg.type === 'connected' && msg.role === 'mobile') setLaptopConnected(Boolean(msg.laptopConnected));
        if (msg.type === 'ack') {
          pendingScanRef.current = null;
          if (!msg.duplicate) {
            showAck('✓ Sent to laptop!');
          }
          if (msg.invalid) showAck('This barcode could not be read. Try again.', true);
        }
        if (msg.type === 'laptop_disconnected') {
          setLaptopConnected(false);
          showAck('⚠ Laptop disconnected', true);
        }
        if (msg.type === 'laptop_connected') {
          setLaptopConnected(true);
          showAck('✓ Laptop reconnected');
        }
      } catch {}
    };

    ws.onclose = (event) => {
      setWsStatus('disconnected');
      setLaptopConnected(false);
      clearInterval(pingIntervalRef.current);
      if (wsRef.current === ws) wsRef.current = null;
      if (event.code === 4001) {
        isScanningRef.current = false;
        setPhase('error');
        setErrorMsg('This scanner session expired. Pair again from the laptop to continue.');
        return;
      }
      // Keep the mobile page usable and retry even before the user starts scanning.
      if (pageActiveRef.current) setWsStatus('reconnecting');
      // Auto-reconnect after 2 seconds while this page remains open.
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (pageActiveRef.current) connectWs();
      }, 2000);
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
    if (!text) return;
    lastDetectionAtRef.current = now;
    lastBarcodeAtRef.current = now;
    if (text === lastSentRef.current) return;
    lastSentRef.current = text;
    lastSentTimeRef.current = now;
    setLastScan(text);
    setScanCount(c => c + 1);

    const payload = JSON.stringify({ type: 'scan_result', data: { barcode: text, timestamp: now } });
    pendingScanRef.current = payload;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload);
      return Promise.resolve(true);
    } else {
      // HTTP fallback
      fetch('/api/mobile-scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, data: { barcode: text } }),
      })
        .then((response) => {
          if (!response.ok) return false;
          pendingScanRef.current = null;
          return true;
        })
        .catch(() => false);
    }
  }, [sessionId]);

  const scanCapturedImage = async (event) => {
    const imageFile = event.target.files?.[0];
    event.target.value = '';
    if (!imageFile) return;

    setImageScanning(true);
    setErrorMsg('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const decoder = new Html5Qrcode('qr-reader');
      const barcode = await decoder.scanFile(imageFile, true);
      const accepted = await sendScan(barcode);
      if (!accepted) throw new Error('Scanner connection unavailable');
      showAck('Barcode sent to pharmacy computer');
    } catch {
      setErrorMsg('Barcode not found in that photo. Take a clear, close photo of the barcode and try again.');
    } finally {
      setImageScanning(false);
    }
  };

  const scanLabelFrame = useCallback(async () => {
    if (ocrBusyRef.current || Date.now() - lastBarcodeAtRef.current < 5000) return;
    const video = document.querySelector('#qr-reader video');
    if (!video?.videoWidth || !video?.videoHeight) return;
    ocrBusyRef.current = true;
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 900 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.72));
      if (!blob || blob.size > 2 * 1024 * 1024) return;
      const form = new FormData();
      form.append('image', blob, 'label.jpg');
      form.append('sessionId', sessionId);
      const response = await fetch('/api/mobile-scanner/ocr', { method: 'POST', body: form });
      if (response.status === 404) {
        setErrorMsg('This scanner link has expired. Close this page and pair again from the laptop.');
        return;
      }
      if (!response.ok) return;
      const result = await response.json();
      if (result.success && !result.duplicate) {
        showAck('Label text sent to laptop');
      }
    } catch {
      // A brief OCR/network failure is retried on the next camera frame interval.
    } finally {
      ocrBusyRef.current = false;
    }
  }, [sessionId]);

  // ── Start continuous camera scanner ──────────────────────────────────────
  const startScanner = useCallback(async () => {
    if (cameraStarting || isScanningRef.current) return;
    isScanningRef.current = true;
    setCameraStarting(true);
    setErrorMsg('');
    try {
      // Keep the QR decoder out of the initial mobile page bundle. The page
      // renders immediately; load the camera library only after a user tap.
      const { Html5Qrcode } = await import('html5-qrcode');
      const qr = new Html5Qrcode('qr-reader');
      html5QrRef.current = qr;
      isScanningRef.current = true;
      setPhase('scanning');

      await qr.start(
        { facingMode: 'environment' },
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
        () => {
          if (Date.now() - lastDetectionAtRef.current >= REARM_AFTER_MS) lastSentRef.current = '';
        } // Per-frame misses re-arm scanning after the medicine leaves view.
      );
      ocrIntervalRef.current = setInterval(scanLabelFrame, 5000);
      setCameraStarting(false);
    } catch (err) {
      setErrorMsg(
        !window.isSecureContext
          ? 'Android Chrome blocks camera access on a plain HTTP local network page. Use the USB localhost link from the laptop, or a trusted HTTPS origin.'
          : err?.message?.includes('Permission')
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : 'The camera could not start. Check that another app is not using it, then retry.'
      );
      setPhase('ready');
      isScanningRef.current = false;
      setCameraStarting(false);
      clearInterval(ocrIntervalRef.current);
      wsRef.current?.close();
      html5QrRef.current = null;
    }

    connectWs();
  }, [cameraStarting, sendScan, connectWs, scanLabelFrame]);

  // ── Stop scanner ──────────────────────────────────────────────────────────
  const stopScanner = useCallback(async () => {
    isScanningRef.current = false;
    clearTimeout(reconnectTimerRef.current);
    clearInterval(pingIntervalRef.current);
    clearInterval(ocrIntervalRef.current);
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

    // Connect WS immediately (laptop is waiting)
    pageActiveRef.current = true;
    connectWs();

    return () => {
      pageActiveRef.current = false;
      isScanningRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      clearInterval(pingIntervalRef.current);
      clearInterval(ocrIntervalRef.current);
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
          {wsStatus === 'connected' && laptopConnected ? 'Laptop Connected' :
           wsStatus === 'connected' ? 'Waiting for Laptop' :
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
            {errorMsg && <div role="alert" className="w-full max-w-sm rounded-xl border border-rose-700 bg-rose-900/60 p-3 text-center text-sm text-rose-100">{errorMsg}</div>}
            <div className="w-32 h-32 rounded-3xl bg-slate-800 flex items-center justify-center border border-slate-700">
              {Icon.camera('h-16 w-16 text-slate-600')}
            </div>

            <button
              onClick={startScanner}
              disabled={cameraStarting}
              className="w-full max-w-xs py-4 rounded-2xl bg-teal-600 text-white font-bold text-lg shadow-[0_0_30px_rgba(13,148,136,0.4)] active:scale-95 transition-transform disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cameraStarting ? 'Opening camera…' : 'Start Scanning'}
            </button>

            <input
              ref={captureInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={scanCapturedImage}
              className="hidden"
              aria-label="Take a barcode photo"
            />
            <button
              type="button"
              onClick={() => captureInputRef.current?.click()}
              disabled={imageScanning}
              className="w-full max-w-xs rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-bold text-slate-100 disabled:opacity-60"
            >
              {imageScanning ? 'Reading barcode…' : 'Use phone camera / choose barcode photo'}
            </button>

            <p className="text-slate-500 text-xs text-center">
              Keep the phone and pharmacy computer on the same Wi-Fi. If live camera access is blocked on this HTTP link, use the camera/photo button above.
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
