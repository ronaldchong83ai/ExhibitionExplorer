'use client';

import { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import type { Exhibition, HomePageInfo, HomeInfoType } from '@/types';
import { formatDateDDMMMYYYY, formatDatetimeDDMMMYYYY } from '@/lib/date';

const TYPE_CONFIG: Record<HomeInfoType, { label: string; badge: string; icon: string }> = {
  EVENT_INFO: { label: 'Event Info', badge: 'badge-blue', icon: '📋' },
  ANNOUNCEMENT: { label: 'Announcement', badge: 'badge-purple', icon: '📢' },
  IMPORTANT_NOTICE: { label: 'Important', badge: 'badge-coral', icon: '⚠️' },
};

export default function HomePage() {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [selectedExhibitionId, setSelectedExhibitionId] = useState<string | null>(null);
  const [exhibition, setExhibition] = useState<Exhibition | null>(null);
  const [infos, setInfos] = useState<HomePageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);

  // Exhibition Registration states & scanner refs
  const [userRegistration, setUserRegistration] = useState<{ adultsCount: number; childrenCount: number } | null>(null);
  const [showRegModal, setShowRegModal] = useState(false);
  const [regStep, setRegStep] = useState<'scan' | 'select'>('scan');
  const [scannedScanId, setScannedScanId] = useState('');
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [adultsCount, setAdultsCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [submittingReg, setSubmittingReg] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load saved exhibition selection from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('selectedExhibitionId');
    if (saved) setSelectedExhibitionId(saved);
  }, []);

  useEffect(() => {
    const fetchHomeData = async () => {
      setLoading(true);
      const q = selectedExhibitionId ? `?exhibitionId=${selectedExhibitionId}` : '';
      try {
        const res = await fetch(`/api/home${q}`);
        const data = await res.json();
        if (data.success && data.data) {
          setExhibition(data.data.exhibition);
          setExhibitions(data.data.exhibitions || []);
          setInfos(data.data.infos || []);
          setUserRegistration(data.data.userRegistration || null);
          if (data.data.exhibition && !selectedExhibitionId) {
            setSelectedExhibitionId(data.data.exhibition.id);
            localStorage.setItem('selectedExhibitionId', data.data.exhibition.id);
          }
        }
      } catch (err) {
        console.error("Failed to load home data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHomeData();
  }, [selectedExhibitionId]);

  const startScanner = async () => {
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        setScanning(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.play().catch(e => console.error("Play failed:", e));
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = requestAnimationFrame(tick);
          }
        }, 50);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setScanError("Could not access camera. Please grant permissions or enter the code manually.");
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

  const handleCodeScanned = (codeStr: string) => {
    const cleanCode = codeStr.trim();
    if (!cleanCode) return;

    if (exhibition?.scanId && exhibition.scanId.trim()) {
      if (cleanCode.toLowerCase() !== exhibition.scanId.trim().toLowerCase()) {
        setScanError(`Scanned code "${cleanCode}" does not match this exhibition's Scan ID ("${exhibition.scanId}").`);
        return;
      }
    }

    playBeep();
    stopScanner();
    setScannedScanId(cleanCode);
    setScanError(null);
    setRegStep('select');
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
          handleCodeScanned(code.data);
          return;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const openRegistrationModal = () => {
    setRegStep('scan');
    setScannedScanId('');
    setManualCodeInput('');
    setScanError(null);
    setAdultsCount(userRegistration?.adultsCount ?? 1);
    setChildrenCount(userRegistration?.childrenCount ?? 0);
    setShowRegModal(true);
    setTimeout(() => {
      startScanner();
    }, 100);
  };

  const closeRegistrationModal = () => {
    stopScanner();
    setShowRegModal(false);
  };

  const handleSubmitRegistration = async () => {
    if (!exhibition) return;
    setSubmittingReg(true);
    try {
      const res = await fetch('/api/exhibitions/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exhibitionId: exhibition.id,
          scanId: scannedScanId,
          adultsCount,
          childrenCount,
        }),
      });
      const data = await res.json();
      if (data.success && data.registration) {
        setUserRegistration(data.registration);
        closeRegistrationModal();
      } else {
        alert(data.error || 'Failed to submit registration');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to submit registration');
    } finally {
      setSubmittingReg(false);
    }
  };

  if (loading && !exhibition) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: 120, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 100, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 100, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 100 }} />
      </div>
    );
  }

  const renderStyledTitle = (title: string) => {
    const colors = ['#F6921E', '#3B82F6', '#10B981'];
    let colorIndex = 0;
    return (
      <span style={{ display: 'inline-block' }}>
        {title.split('').map((char, idx) => {
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
      </span>
    );
  };

  return (
    <div className="page-container">
      {/* Exhibition Hero - Clickable to Switch */}
      {exhibition && (
        <div 
          className="hero-card animate-slide-up" 
          style={{ border: '1px solid var(--color-border-accent)' }}
        >
          <div className="hero-gradient" />
          <div className="hero-content">
            <h1 className="hero-title" style={{ marginTop: 4 }}>{renderStyledTitle(exhibition.title)}</h1>
            <p className="hero-desc">{exhibition.description}</p>
            <div className="hero-date">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>
                {formatDateDDMMMYYYY(exhibition.eventPeriodFrom)}
                {' — '}
                {formatDateDDMMMYYYY(exhibition.eventPeriodTo)}
              </span>
            </div>

            {/* Register for Exhibition Button & Status */}
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                type="button"
                onClick={openRegistrationModal}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}
              >
                🎟️ Register for Exhibition
              </button>
              {userRegistration && (
                <span style={{ fontWeight: 600, color: '#10B981', fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  ✓ Registered {userRegistration.childrenCount} Children and {userRegistration.adultsCount} Adults
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exhibition Registration Modal */}
      {showRegModal && exhibition && (
        <>
          <div className="modal-overlay" onClick={closeRegistrationModal} style={{ zIndex: 1100 }} />
          <div className="modal-content animate-slide-up" style={{ maxWidth: '480px', width: '92%', zIndex: 1101, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            <div className="admin-form" style={{ marginTop: 0 }}>
              <h3 style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-1)' }}>
                🎟️ Register for Exhibition
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
                {exhibition.title}
              </p>

              {regStep === 'scan' ? (
                <div>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    Please scan the LinkRay board for this exhibition to proceed:
                  </p>

                  {scanError && (
                    <div style={{ padding: '8px 12px', background: 'rgba(255, 107, 107, 0.15)', border: '1px solid rgba(255, 107, 107, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-accent-coral)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-3)' }}>
                      ⚠️ {scanError}
                    </div>
                  )}

                  {/* Camera Scanner View */}
                  <div className="camera-preview" style={{ margin: '0 auto var(--space-4) auto', position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
                    <video ref={videoRef} className="camera-video" playsInline style={{ width: '100%', height: '220px', objectFit: 'cover' }} />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="scan-frame">
                      <div className="scan-corner tl" />
                      <div className="scan-corner tr" />
                      <div className="scan-corner bl" />
                      <div className="scan-corner br" />
                      <div className="scan-line" />
                    </div>
                  </div>

                  {/* Manual Scan ID Code Entry Option */}
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>Enter Scan ID manually:</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        className="form-input"
                        placeholder={exhibition.scanId ? `e.g. ${exhibition.scanId}` : 'Enter Scan ID'}
                        value={manualCodeInput}
                        onChange={e => setManualCodeInput(e.target.value)}
                        style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCodeScanned(manualCodeInput); } }}
                      />
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => handleCodeScanned(manualCodeInput)}
                        style={{ padding: '6px 14px', fontSize: 'var(--font-size-xs)' }}
                      >
                        Verify
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-4)' }}>
                    <button className="btn btn-secondary btn-full" type="button" onClick={closeRegistrationModal}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', color: '#10B981', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-4)', fontWeight: 500 }}>
                    ✓ Scan ID verified: <strong>{scannedScanId}</strong>
                  </div>

                  <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                    <label className="form-label">Number of Adults (including self)</label>
                    <select
                      className="form-input"
                      value={adultsCount}
                      onChange={e => setAdultsCount(Number(e.target.value))}
                      style={{ fontSize: 'var(--font-size-sm)' }}
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>
                          {num === 1 ? '1 Adult (Self)' : `${num} Adults (Including self)`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                    <label className="form-label">Number of Children</label>
                    <select
                      className="form-input"
                      value={childrenCount}
                      onChange={e => setChildrenCount(Number(e.target.value))}
                      style={{ fontSize: 'var(--font-size-sm)' }}
                    >
                      {Array.from({ length: 11 }, (_, i) => i).map(num => (
                        <option key={num} value={num}>
                          {num === 0 ? '0 Children' : num === 1 ? '1 Child' : `${num} Children`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-actions" style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" type="button" onClick={() => setRegStep('scan')}>Back</button>
                    <button className="btn btn-primary" type="button" onClick={handleSubmitRegistration} disabled={submittingReg}>
                      {submittingReg ? 'Submitting...' : 'Submit Registration'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Info Cards */}
      <div className="info-section">
        {loading ? (
          <div className="skeleton" style={{ height: 100 }} />
        ) : infos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p className="empty-state-text">No announcements right now</p>
          </div>
        ) : (
          infos.map((info, idx) => {
            const config = TYPE_CONFIG[info.type];
            const isExpanded = expandedId === info.id;
            return (
              <div
                key={info.id}
                className={`info-card card card-interactive animate-slide-up stagger-${Math.min(idx + 1, 5)}`}
                onClick={() => setExpandedId(isExpanded ? null : info.id)}
              >
                <div className="info-card-header">
                  <span className="info-icon">{config.icon}</span>
                  <div className="info-card-meta">
                    <span className={`badge ${config.badge}`}>{config.label}</span>
                    <h3 className="info-card-title">{info.title}</h3>
                    {info.displayFrom && info.displayTo && (
                      <span className="info-card-date" style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                        🕒 {formatDatetimeDDMMMYYYY(info.displayFrom)} - {formatDatetimeDDMMMYYYY(info.displayTo)}
                      </span>
                    )}
                  </div>
                  <svg
                    className={`chevron ${isExpanded ? 'rotated' : ''}`}
                    width="20" height="20" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
                <p className="info-card-desc">{info.description}</p>
                {isExpanded && info.details && (
                  <div className="info-card-details animate-fade-in">
                    <p>{info.details}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Exhibition Selector Bottom Sheet */}
      {showSelector && (
        <>
          <div className="modal-overlay" onClick={() => setShowSelector(false)} />
          <div className="modal-content animate-slide-up" style={{ maxHeight: '80%', paddingBottom: 'calc(var(--space-6) + var(--safe-bottom))' }}>
            <div className="modal-handle" />
            <div className="selector-container" style={{ padding: 'var(--space-4) 0' }}>
              <h3 className="section-title" style={{ padding: '0 var(--space-4)', marginBottom: 'var(--space-4)' }}>Select Exhibition</h3>
              <div className="exhibition-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: '0 var(--space-4)' }}>
                {exhibitions.map((ex) => (
                  <button
                    key={ex.id}
                    className={`selector-item card card-interactive ${selectedExhibitionId === ex.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedExhibitionId(ex.id);
                      localStorage.setItem('selectedExhibitionId', ex.id);
                      setShowSelector(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 'var(--space-4)',
                      background: selectedExhibitionId === ex.id ? 'var(--color-bg-glass-hover)' : 'var(--color-bg-card)',
                      border: selectedExhibitionId === ex.id ? '1px solid var(--color-accent-blue)' : '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: selectedExhibitionId === ex.id ? 'var(--shadow-glow-blue)' : 'none'
                    }}
                  >
                    <h4 style={{ fontWeight: 600, color: selectedExhibitionId === ex.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', marginBottom: 4 }}>{ex.title}</h4>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                      {formatDateDDMMMYYYY(ex.eventPeriodFrom)} - {formatDateDDMMMYYYY(ex.eventPeriodTo)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .hero-card {
          position: relative;
          border-radius: var(--radius-xl);
          overflow: hidden;
          margin-bottom: var(--space-6);
          background: var(--color-bg-card);
          border: 1px solid var(--color-border-accent);
        }
        .hero-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 50%, rgba(6, 182, 212, 0.05) 100%);
        }
        .hero-content {
          position: relative;
          padding: var(--space-6);
        }
        .hero-title {
          font-size: var(--font-size-2xl);
          font-weight: 800;
          margin-bottom: var(--space-3);
          line-height: 1.3;
        }
        .hero-desc {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          margin-bottom: var(--space-4);
          line-height: 1.6;
        }
        .hero-date {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--color-accent-cyan);
          font-size: var(--font-size-sm);
          font-weight: 500;
        }
        .info-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .info-card {
          padding: var(--space-4) !important;
        }
        .info-card-header {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
        }
        .info-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .info-card-meta {
          flex: 1;
        }
        .info-card-title {
          font-size: var(--font-size-base);
          font-weight: 600;
          margin-top: var(--space-2);
          line-height: 1.4;
        }
        .info-card-desc {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          line-height: 1.5;
        }
        .info-card-details {
          margin-top: var(--space-3);
          padding-top: var(--space-3);
          border-top: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          line-height: 1.6;
        }
        .chevron {
          flex-shrink: 0;
          color: var(--color-text-tertiary);
          transition: transform var(--transition-fast);
          margin-top: 4px;
        }
        .chevron.rotated {
          transform: rotate(180deg);
        }
      `}</style>
    </div>
  );
}
