'use client';

import { useState } from 'react';

export default function ScannerPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [mode, setMode] = useState<'qr' | 'linkray'>('qr');

  return (
    <div className="page-container">
      <h2 className="page-title">📷 Scanner</h2>

      {/* Mode Tabs */}
      <div className="tabs">
        <button className={`tab ${mode === 'qr' ? 'active' : ''}`} onClick={() => setMode('qr')}>
          QR Code
        </button>
        <button className={`tab ${mode === 'linkray' ? 'active' : ''}`} onClick={() => setMode('linkray')}>
          LinkRay
        </button>
      </div>

      {mode === 'qr' ? (
        <div className="scanner-card card animate-scale-in">
          <div className="camera-preview">
            <div className="scan-frame">
              <div className="scan-corner tl" />
              <div className="scan-corner tr" />
              <div className="scan-corner bl" />
              <div className="scan-corner br" />
              <div className="scan-line" />
            </div>
            <p className="scan-instruction">Point camera at QR code</p>
          </div>
          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: 'var(--space-4)' }}
            onClick={() => setScanResult('DEMO-QR-' + Date.now())}
          >
            Simulate Scan
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
          <h4 style={{ marginBottom: 'var(--space-2)' }}>✅ Scan Result</h4>
          <p style={{ color: 'var(--color-accent-green)', fontSize: 'var(--font-size-sm)', wordBreak: 'break-all' }}>
            {scanResult}
          </p>
          <button
            className="btn btn-secondary btn-full"
            style={{ marginTop: 'var(--space-3)' }}
            onClick={() => setScanResult(null)}
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
        }
        .scan-frame {
          width: 200px;
          height: 200px;
          position: relative;
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
