'use client';

import { useState, useEffect } from 'react';
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
          </div>
        </div>
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
