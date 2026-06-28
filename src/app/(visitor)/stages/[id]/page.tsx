'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import type { StageEvent } from '@/types';
import { formatDatetimeDDMMMYYYY } from '@/lib/date';

export default function StageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<StageEvent | null>(null);
  const [isFavourite, setIsFavourite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/stages/${id}`).then(r => r.json()),
      fetch(`/api/favourites?type=STAGE_EVENT&targetId=${id}`).then(r => r.json()),
    ]).then(([eventData, favData]) => {
      if (eventData.success) setEvent(eventData.data);
      if (favData.success) setIsFavourite(favData.data);
      setLoading(false);
    });
  }, [id]);

  const toggleFavourite = async () => {
    const method = isFavourite ? 'DELETE' : 'POST';
    const res = await fetch('/api/favourites', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'STAGE_EVENT', targetId: id }),
    });
    const data = await res.json();
    if (data.success) setIsFavourite(!isFavourite);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p className="empty-state-text">Event not found</p>
        </div>
      </div>
    );
  }

  const formatDateTime = (dateStr: string) => {
    return formatDatetimeDDMMMYYYY(dateStr);
  };

  return (
    <div className="page-container">
      {/* Back + Favourite */}
      <div className="detail-nav">
        <button onClick={() => router.back()} className="back-btn" aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <button onClick={toggleFavourite} className={`star-btn ${isFavourite ? 'active' : ''}`} aria-label="Toggle favourite">
          ⭐
        </button>
      </div>

      {/* Event Details */}
      <div className="detail-card card animate-scale-in">
        <span className="badge badge-blue" style={{ marginBottom: 'var(--space-3)', display: 'inline-flex' }}>
          {event.stageNumber}
        </span>
        <h1 className="detail-title">{event.title}</h1>

        <div className="detail-info-row">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <div>
            <p className="detail-info-label">From</p>
            <p className="detail-info-value">{formatDateTime(event.periodFrom)}</p>
          </div>
        </div>

        <div className="detail-info-row">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <div>
            <p className="detail-info-label">To</p>
            <p className="detail-info-value">{formatDateTime(event.periodTo)}</p>
          </div>
        </div>

        <div className="detail-info-row">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <div>
            <p className="detail-info-label">Speakers</p>
            <div className="speakers-list">
              {event.speakerNames.map((name, i) => (
                <span key={i} className="chip">{name}</span>
              ))}
            </div>
          </div>
        </div>

        {event.details && (
          <div className="detail-section">
            <h3 className="section-title">Details</h3>
            <p className="detail-text">{event.details}</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .detail-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
        }
        .back-btn {
          padding: var(--space-2);
          border-radius: var(--radius-full);
          color: var(--color-text-secondary);
          transition: all var(--transition-fast);
        }
        .back-btn:hover {
          background: var(--color-bg-glass);
          color: var(--color-text-primary);
        }
        .detail-card {
          padding: var(--space-6) !important;
        }
        .detail-title {
          font-size: var(--font-size-2xl);
          font-weight: 700;
          margin-bottom: var(--space-5);
          line-height: 1.3;
        }
        .detail-info-row {
          display: flex;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
          align-items: flex-start;
        }
        .detail-info-row svg {
          color: var(--color-accent-blue);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .detail-info-label {
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--space-1);
        }
        .detail-info-value {
          font-size: var(--font-size-base);
          color: var(--color-text-primary);
        }
        .speakers-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-top: var(--space-1);
        }
        .detail-section {
          margin-top: var(--space-5);
          padding-top: var(--space-5);
          border-top: 1px solid var(--color-border);
        }
        .detail-text {
          color: var(--color-text-secondary);
          font-size: var(--font-size-base);
          line-height: 1.7;
        }
      `}</style>
    </div>
  );
}
