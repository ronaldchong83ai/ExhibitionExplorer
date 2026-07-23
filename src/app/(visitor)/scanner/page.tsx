'use client';

import { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';

export default function ScannerPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [mode, setMode] = useState<'qr' | 'linkray'>('linkray');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [exhibition, setExhibition] = useState<{ title: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('selectedExhibitionId');
    if (saved) {
      fetch(`/api/home?exhibitionId=${saved}`)
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data && res.data.exhibition) {
            setExhibition(res.data.exhibition);
          }
        })
        .catch(err => console.error(err));
    }
  }, []);

  useEffect(() => {
    // Stop scanning and release resources on unmount
    return () => {
      stopScanner();
    };
  }, []);

  const [externalUrl, setExternalUrl] = useState<string | null>(null);

  const startScanner = async () => {
    setCameraError(null);
    setScanResult(null);
    setExternalUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Prefer rear camera
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS Safari
        setScanning(true);
        // Important: Wait for state change to render/display the video element, then play
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.play().catch(e => console.error("Play failed:", e));
            // Start loop
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = requestAnimationFrame(tick);
          }
        }, 50);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Could not access camera. Please ensure permissions are granted and you are using HTTPS.');
    }
  };

  const stopScanner = () => {
    setScanning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const registerScan = async (scannedCode: string) => {
    setRegistering(true);
    setRegistrationMessage(null);
    setExternalUrl(null);
    try {
      const res = await fetch('/api/scanner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scanId: scannedCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegistrationMessage({
          text: data.error || 'Failed to register scan',
          type: 'error',
        });
      } else {
        if (data.urlLink) {
          let targetUrl = data.urlLink.trim();
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = `https://${targetUrl}`;
          }
          setExternalUrl(targetUrl);

          // Open browser new tab with corresponding external URL if exists
          try {
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
          } catch (e) {
            console.error("Failed to open external URL tab:", e);
          }
        }

        if (data.matched) {
          if (data.alreadyScanned) {
            setRegistrationMessage({
              text: data.message,
              type: 'warning',
            });
          } else {
            setRegistrationMessage({
              text: data.message,
              type: 'success',
            });
          }
        } else {
          setRegistrationMessage({
            text: data.message,
            type: 'warning',
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to register scan:', err);
      setRegistrationMessage({
        text: 'A network error occurred. Please try again.',
        type: 'error',
      });
    } finally {
      setRegistering(false);
    }
  };

  const tick = () => {
    if (!videoRef.current || !canvasRef.current) {
      animationFrameRef.current = requestAnimationFrame(tick);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Set canvas dimensions matching current video frame
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;

        // Draw current frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get image data and scan
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          const scannedText = code.data;
          setScanResult(scannedText);
          stopScanner();
          // Play notification beep if possible (using browser Web Audio API)
          playBeep();
          registerScan(scannedText);
          return;
        }
      }
    }

    // Keep loop active
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // AudioContext fails silently if user has not interacted or not supported
    }
  };

  const handleToggleScanner = () => {
    if (scanning) {
      stopScanner();
    } else {
      startScanner();
    }
  };

  const renderStyledPageTitle = (title: string) => {
    const colors = ['#F6921E', '#3B82F6', '#10B981'];
    let colorIndex = 0;
    const emojiRegex = /^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}])\s*/u;
    const match = title.match(emojiRegex);
    let emoji = '';
    let text = title;
    if (match) {
      emoji = match[0];
      text = title.slice(emoji.length);
    }
    return (
      <>
        {emoji && <span>{emoji}</span>}
        {text.split('').map((char, idx) => {
          if (char === ' ') {
            return <span key={idx}> </span>;
          }
          const color = colors[colorIndex % colors.length];
          colorIndex++;
          return (
            <span key={idx} style={{ color }}>
              {char}
            </span>
          );
        })}
      </>
    );
  };

  return (
    <div className="page-container">
      <h2 className="page-title" style={{ marginBottom: exhibition ? 4 : 'var(--space-4)' }}>
        {renderStyledPageTitle("📷 Scanner")}
      </h2>
      {exhibition && (
        <p className="page-subtitle" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: 'var(--space-4)' }}>
          For {exhibition.title}
        </p>
      )}

      {/* Mode Tabs */}
      <div className="tabs">
        <button className={`tab ${mode === 'linkray' ? 'active' : ''}`} onClick={() => { stopScanner(); setMode('linkray'); }}>
          LinkRay
        </button>
        <button className={`tab ${mode === 'qr' ? 'active' : ''}`} onClick={() => { stopScanner(); setMode('qr'); }}>
          QR Code
        </button>
      </div>

      {mode === 'qr' ? (
        <div className="scanner-card card animate-scale-in">
          {cameraError && (
            <div className="error-banner animate-fade-in" style={{ marginBottom: 'var(--space-4)', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: 'rgb(248, 113, 113)', fontSize: 'var(--font-size-sm)' }}>
              ⚠️ {cameraError}
            </div>
          )}

          <div className="camera-preview">
            {/* Always render video & canvas to avoid ref being null, toggle visibility with CSS */}
            <video
              ref={videoRef}
              className="camera-video"
              playsInline
              style={{ display: scanning ? 'block' : 'none' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {scanning ? (
              <>
                <div className="scan-frame">
                  <div className="scan-corner tl" />
                  <div className="scan-corner tr" />
                  <div className="scan-corner bl" />
                  <div className="scan-corner br" />
                  <div className="scan-line" />
                </div>
                <p className="scan-instruction">Align QR code within the frame</p>
              </>
            ) : (
              <div className="camera-placeholder" onClick={handleToggleScanner}>
                <span className="camera-icon">📷</span>
                <p className="scan-instruction">Tap to start camera</p>
              </div>
            )}
          </div>
          <button
            className={`btn ${scanning ? 'btn-secondary' : 'btn-primary'} btn-full`}
            style={{ marginTop: 'var(--space-4)' }}
            onClick={handleToggleScanner}
          >
            {scanning ? 'Stop Scanner' : 'Start Scanner'}
          </button>
        </div>
      ) : (
        <div className="scanner-card card animate-scale-in">
          <div className="linkray-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
            <p className="linkray-title">LinkRay Scanner</p>
            <p className="linkray-desc">Point your device at a LinkRay-enabled light source to scan</p>
            <div className="linkray-note badge badge-amber">
              SDK Integration Pending
            </div>
          </div>
        </div>
      )}

      {scanResult && (
        <div className="scan-result card animate-slide-up" style={{ marginTop: 'var(--space-4)' }}>
          <h4 style={{ marginBottom: 'var(--space-2)' }}>
            {registering ? '🔄 Registering Scan...' : '✅ Scan Result'}
          </h4>
          <p style={{ color: 'var(--color-accent-green)', fontSize: 'var(--font-size-sm)', wordBreak: 'break-all', marginBottom: 'var(--space-2)' }}>
            {scanResult}
          </p>

          {registrationMessage && (
            <div 
              style={{
                display: 'block',
                padding: 'var(--space-3)',
                marginTop: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                lineHeight: '1.4',
                background: registrationMessage.type === 'success' 
                  ? 'rgba(16, 185, 129, 0.15)' 
                  : registrationMessage.type === 'warning'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(255, 107, 107, 0.15)',
                color: registrationMessage.type === 'success' 
                  ? 'var(--color-accent-green)' 
                  : registrationMessage.type === 'warning'
                    ? 'var(--color-accent-amber)'
                    : 'var(--color-accent-coral)',
                border: `1px solid ${
                  registrationMessage.type === 'success'
                    ? 'rgba(16, 185, 129, 0.3)'
                    : registrationMessage.type === 'warning'
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'rgba(255, 107, 107, 0.3)'
                }`
              }}
            >
              {registrationMessage.text}
            </div>
          )}

          {externalUrl && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-full"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  padding: '10px 16px',
                  fontWeight: 600,
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                🌐 Open External Page in New Tab
              </a>
            </div>
          )}

          <button
            className="btn btn-secondary btn-full"
            style={{ marginTop: 'var(--space-3)' }}
            onClick={() => {
              setScanResult(null);
              setRegistrationMessage(null);
            }}
          >
            Clear
          </button>
        </div>
      )}

      <style jsx>{`
        .scanner-card {
          padding: var(--space-5) !important;
        }
        .camera-preview {
          aspect-ratio: 1;
          max-height: 320px;
          background: var(--color-bg-primary);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          border: 1px solid var(--color-border);
        }
        .camera-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
          z-index: 1;
        }
        .camera-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          width: 100%;
          height: 100%;
          position: absolute;
          z-index: 1;
          transition: background 0.2s;
        }
        .camera-placeholder:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .camera-icon {
          font-size: 3rem;
          margin-bottom: var(--space-2);
          opacity: 0.7;
        }
        .scan-frame {
          width: 200px;
          height: 200px;
          position: relative;
          z-index: 2;
        }
        .scan-corner {
          position: absolute;
          width: 30px;
          height: 30px;
          border: 3px solid var(--color-accent-blue);
        }
        .scan-corner.tl { top: 0; left: 0; border-right: none; border-bottom: none; border-radius: 4px 0 0 0; }
        .scan-corner.tr { top: 0; right: 0; border-left: none; border-bottom: none; border-radius: 0 4px 0 0; }
        .scan-corner.bl { bottom: 0; left: 0; border-right: none; border-top: none; border-radius: 0 0 0 4px; }
        .scan-corner.br { bottom: 0; right: 0; border-left: none; border-top: none; border-radius: 0 0 4px 0; }
        .scan-line {
          position: absolute;
          top: 0;
          left: 10%;
          right: 10%;
          height: 2px;
          background: var(--color-accent-blue);
          box-shadow: 0 0 10px var(--color-accent-blue);
          animation: scan-move 2s ease-in-out infinite;
        }
        @keyframes scan-move {
          0%, 100% { top: 5%; }
          50% { top: 95%; }
        }
        .scan-instruction {
          position: absolute;
          bottom: var(--space-4);
          color: var(--color-text-tertiary);
          font-size: var(--font-size-sm);
          z-index: 2;
        }
        .linkray-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-8) 0;
          text-align: center;
        }
        .linkray-title {
          margin-top: var(--space-4);
          font-size: var(--font-size-lg);
          font-weight: 600;
        }
        .linkray-desc {
          margin-top: var(--space-2);
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          max-width: 250px;
        }
        .linkray-note {
          margin-top: var(--space-4);
        }
      `}</style>
    </div>
  );
}
