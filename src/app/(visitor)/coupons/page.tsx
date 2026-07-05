'use client';

import { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import type { Exhibition, SessionUser } from '@/types';
import { formatDateDDMMMYYYY, formatDatetimeDDMMMYYYY } from '@/lib/date';

interface VoucherWithProgress {
  id: string;
  title: string;
  description: string;
  details: string;
  requiredScanIds: string[];
  displayFrom?: string;
  displayTo?: string;
  collectedCount: number;
  totalRequired: number;
  isComplete: boolean;
  isCollected?: boolean;
}

export default function CouponsPage() {
  const [vouchers, setVouchers] = useState<VoucherWithProgress[]>([]);
  const [exhibition, setExhibition] = useState<Exhibition | null>(null);
  const [selectedExhibitionId, setSelectedExhibitionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  // Voucher Collections Manager states (for Redemptors)
  const [showCollectionsModal, setShowCollectionsModal] = useState(false);
  const [activeVoucherForCollections, setActiveVoucherForCollections] = useState<any>(null);
  const [collectedVisitors, setCollectedVisitors] = useState<any[]>([]);
  const [newVisitorEmail, setNewVisitorEmail] = useState('');
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  // Scanner states & refs for Redemptor email scan popup
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load session user and selected exhibition from localStorage
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.success) setUser(data.data);
      })
      .catch(err => console.error("Session load error:", err));

    const saved = localStorage.getItem('selectedExhibitionId');
    if (saved) setSelectedExhibitionId(saved);
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startScanner = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      setScanning(true);
      
      // Wait for DOM layout
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(e => console.error("Play failed:", e));
          
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          animationFrameRef.current = requestAnimationFrame(tick);
        }
      }, 100);
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

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {}
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
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          const scannedEmail = code.data.trim();
          stopScanner();
          playBeep();
          
          if (scannedEmail) {
            executeAddVisitor(scannedEmail);
          }
          return;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedExhibitionId) {
      params.set('exhibitionId', selectedExhibitionId);
    }
    fetch(`/api/coupons?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setVouchers(data.data.vouchers || []);
          setExhibition(data.data.exhibition || null);
          if (data.data.exhibition && !selectedExhibitionId) {
            setSelectedExhibitionId(data.data.exhibition.id);
            localStorage.setItem('selectedExhibitionId', data.data.exhibition.id);
          }
        }
      })
      .catch(err => {
        console.error("Failed to load coupons:", err);
      })
      .finally(() => setLoading(false));
  }, [selectedExhibitionId]);

  const openCollectionsManager = async (v: any) => {
    setActiveVoucherForCollections(v);
    setShowCollectionsModal(true);
    setNewVisitorEmail('');
    setCollectionsLoading(true);
    try {
      const res = await fetch(`/api/vouchers/${v.id}/collections`).then(r => r.json());
      if (res.success) {
        setCollectedVisitors(res.data || []);
      } else {
        alert(res.error || "Failed to load collections");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load collections");
    } finally {
      setCollectionsLoading(false);
    }
  };

  const executeAddVisitor = async (emailStr: string) => {
    if (!activeVoucherForCollections || !emailStr) return;

    setCollectionsLoading(true);
    try {
      const res = await fetch(`/api/vouchers/${activeVoucherForCollections.id}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailStr })
      }).then(r => r.json());

      if (res.success && res.data) {
        alert("Redeem successful!");
        setCollectedVisitors(prev => {
          if (prev.some(v => v.userId === res.data.userId)) return prev;
          const updated = [...prev, res.data];
          updated.sort((a, b) => new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime());
          return updated;
        });
        setNewVisitorEmail('');
      } else {
        alert(res.error || "Failed to add visitor");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add visitor");
    } finally {
      setCollectionsLoading(false);
    }
  };

  const addVisitorToCollections = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVoucherForCollections) return;

    const trimmedEmail = newVisitorEmail.trim();
    if (!trimmedEmail) {
      startScanner();
    } else {
      await executeAddVisitor(trimmedEmail);
    }
  };

  const deleteVisitorFromCollections = async (userId: string) => {
    if (!activeVoucherForCollections) return;
    if (!confirm("Are you sure you want to remove this visitor from the collected list?")) return;

    setCollectionsLoading(true);
    try {
      const res = await fetch(`/api/vouchers/${activeVoucherForCollections.id}/collections?userId=${userId}`, {
        method: 'DELETE'
      }).then(r => r.json());

      if (res.success) {
        setCollectedVisitors(prev => prev.filter(v => v.userId !== userId));
      } else {
        alert(res.error || "Failed to remove visitor");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to remove visitor");
    } finally {
      setCollectionsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <h2 className="page-title">🎫 Coupons & Gifts</h2>
        {[1, 2].map(i => (
          <div key={i} className="skeleton" style={{ height: 140, marginBottom: 12 }} />
        ))}
      </div>
    );
  }

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
        {renderStyledPageTitle("🎫 Coupons & Gifts")}
      </h2>
      {exhibition && (
        <p className="page-subtitle" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
          For {exhibition.title}
        </p>
      )}
      <p className="page-subtitle" style={{ marginTop: 0, marginBottom: 'var(--space-5)' }}>Collect scans at exhibition booths to redeem rewards!</p>

      {vouchers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎫</div>
          <p className="empty-state-text">No vouchers available</p>
        </div>
      ) : (
        <div className="voucher-list">
          {vouchers.map((v, idx) => {
            const isComplete = v.isComplete || v.isCollected;
            const collectedPercent = v.isCollected ? 100 : (v.collectedCount / v.totalRequired) * 100;
            return (
              <div key={v.id} className={`voucher-card card animate-slide-up stagger-${Math.min(idx + 1, 5)} ${isComplete ? 'complete' : ''} ${v.isCollected ? 'collected' : ''}`}>
                <div className="voucher-header">
                  <span className="voucher-icon">{v.isCollected ? '🎁' : v.isComplete ? '🎉' : '🎫'}</span>
                  <div className="voucher-info">
                    <h3 className="voucher-title">{v.title}</h3>
                    {v.isCollected ? (
                      <span className="badge badge-green">Collected!</span>
                    ) : v.isComplete ? (
                      <span className="badge badge-green">Redeemable!</span>
                    ) : (
                      <span className="badge badge-amber">{v.collectedCount}/{v.totalRequired} scans</span>
                    )}
                  </div>
                </div>
                <p className="voucher-desc">{v.description}</p>
                <span className="voucher-display-period" style={{ display: 'block', marginTop: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  🕒 Display: {v.displayFrom && v.displayTo ? `${formatDatetimeDDMMMYYYY(v.displayFrom)} - ${formatDatetimeDDMMMYYYY(v.displayTo)}` : 'Always active'}
                </span>
                <div className="progress-bar" style={{ marginTop: 'var(--space-3)' }}>
                  <div className="progress-fill" style={{ width: `${collectedPercent}%` }} />
                </div>
                <p className="voucher-progress-text">
                  {v.isCollected ? 'Voucher collected!' : `${v.collectedCount} of ${v.totalRequired} scans collected`}
                </p>

                {user?.role === 'REDEMPTOR' && (
                  <div className="redemptor-actions" style={{ marginTop: 'var(--space-4)' }}>
                    <button className="btn btn-secondary" onClick={() => openCollectionsManager(v)} style={{ width: '100%', height: 'auto', padding: '8px 16px' }}>
                      ⚙️ Manage Collections
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCollectionsModal && activeVoucherForCollections && (
        <>
          <div className="modal-overlay" onClick={() => setShowCollectionsModal(false)} />
          <div className="modal-content">
            <div className="modal-handle" />
            <div className="admin-form animate-scale-in" style={{ marginTop: 0 }}>
              <h4 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-3)' }}>Manage Collections: {activeVoucherForCollections.title}</h4>
              
              {/* Add Visitor Form */}
              <form onSubmit={addVisitorToCollections} style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-4)' }}>
                <input
                  className="form-input"
                  type="email"
                  placeholder="Enter visitor's email..."
                  value={newVisitorEmail}
                  onChange={e => setNewVisitorEmail(e.target.value)}
                  style={{ flex: 1 }}
                  disabled={collectionsLoading}
                />
                <button className="btn btn-primary" type="submit" disabled={collectionsLoading}>
                  Add/Scan
                </button>
              </form>

              {/* Collections List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Collected Visitors ({collectedVisitors.length})</label>
                {collectionsLoading && collectedVisitors.length === 0 ? (
                  <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textAlign: 'center', margin: '12px 0' }}>Loading...</p>
                ) : collectedVisitors.length === 0 ? (
                  <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textAlign: 'center', margin: '12px 0', fontStyle: 'italic' }}>No visitors have collected this yet.</p>
                ) : (
                  collectedVisitors.map(visitor => (
                    <div key={visitor.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 12px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <span style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{visitor.name}</span>
                        <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{visitor.email}</span>
                        <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                          🕒 Collected: {formatDatetimeDDMMMYYYY(visitor.collectedAt)}
                        </span>
                        <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                          🎁 Gifted By: {visitor.giftedBy || 'Self-collected'}
                        </span>
                      </div>
                      <button
                        className="btn btn-icon"
                        type="button"
                        onClick={() => deleteVisitorFromCollections(visitor.userId)}
                        disabled={collectionsLoading}
                        style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', fontSize: '12px', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="form-actions" style={{ marginTop: 'var(--space-4)' }}>
                <button className="btn btn-secondary" type="button" onClick={() => setShowCollectionsModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </>
      )}

      {scanning && (
        <>
          <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={stopScanner} />
          <div className="modal-content" style={{ zIndex: 1101, maxWidth: '360px' }}>
            <div className="modal-handle" />
            <div className="admin-form animate-scale-in" style={{ marginTop: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <h4 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-3)', alignSelf: 'flex-start' }}>
                📷 Scan Visitor QR Code
              </h4>
              
              {cameraError && (
                <div className="error-banner animate-fade-in" style={{ marginBottom: 'var(--space-4)', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: 'rgb(248, 113, 113)', fontSize: 'var(--font-size-sm)' }}>
                  ⚠️ {cameraError}
                </div>
              )}

              <div className="camera-preview" style={{ margin: 'var(--space-2) auto var(--space-4) auto' }}>
                <video
                  ref={videoRef}
                  className="camera-video"
                  playsInline
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div className="scan-frame">
                  <div className="scan-corner tl" />
                  <div className="scan-corner tr" />
                  <div className="scan-corner bl" />
                  <div className="scan-corner br" />
                  <div className="scan-line" />
                </div>
              </div>

              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-4)' }}>
                Align the visitor's profile QR code inside the frame to scan.
              </p>

              <button className="btn btn-secondary btn-full" onClick={stopScanner}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .voucher-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .voucher-card {
          padding: var(--space-5) !important;
        }
        .voucher-card.complete {
          border-color: rgba(16, 185, 129, 0.3);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, var(--color-bg-card) 100%);
        }
        .voucher-card.collected {
          border-color: rgba(16, 185, 129, 0.5);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, var(--color-bg-card) 100%);
        }
        .voucher-header {
          display: flex;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
        }
        .voucher-icon {
          font-size: 2rem;
          flex-shrink: 0;
        }
        .voucher-info {
          flex: 1;
        }
        .voucher-title {
          font-size: var(--font-size-lg);
          font-weight: 600;
          margin-bottom: var(--space-2);
        }
        .voucher-desc {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          line-height: 1.5;
        }
        .voucher-progress-text {
          text-align: center;
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
          margin-top: var(--space-2);
        }
        .camera-preview {
          width: 240px;
          height: 240px;
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
        .scan-frame {
          width: 160px;
          height: 160px;
          position: relative;
          z-index: 2;
        }
        .scan-corner { 
          position: absolute;
          width: 20px;
          height: 20px;
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
      `}</style>
    </div>
  );
}
