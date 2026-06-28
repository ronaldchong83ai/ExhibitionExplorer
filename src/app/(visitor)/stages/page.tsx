'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { StageEvent, Exhibition } from '@/types';
import { formatDatetimeDDMMMYYYY } from '@/lib/date';

export default function StagesPage() {
  const router = useRouter();
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [exhibition, setExhibition] = useState<Exhibition | null>(null);
  const [selectedExhibitionId, setSelectedExhibitionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Load selected exhibition from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('selectedExhibitionId');
    if (saved) setSelectedExhibitionId(saved);
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedExhibitionId) {
        params.set('exhibitionId', selectedExhibitionId);
      }
      if (search) {
        params.set('q', search);
      }
      try {
        const res = await fetch(`/api/stages?${params.toString()}`);
        const data = await res.json();
        if (data.success && data.data) {
          setEvents(data.data.events || []);
          setExhibition(data.data.exhibition || null);
        }
      } catch (err) {
        console.error("Failed to load stage events:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchEvents, 300);
    return () => clearTimeout(timer);
  }, [search, selectedExhibitionId]);

  const formatDateTime = (dateStr: string) => {
    return formatDatetimeDDMMMYYYY(dateStr);
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
        {renderStyledPageTitle("🎭 Stage Events")}
      </h2>
      {exhibition && (
        <p className="page-subtitle" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: 'var(--space-4)' }}>
          For {exhibition.title}
        </p>
      )}

      {/* Search */}
      <div className="search-wrapper" style={{ marginBottom: 'var(--space-5)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="search-input"
          placeholder="Search by title, speaker, or stage..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          id="stages-search"
        />
      </div>

      {loading ? (
        [1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 120, marginBottom: 12 }} />
        ))
      ) : events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎭</div>
          <p className="empty-state-text">{search ? 'No events match your search' : 'No stage events yet'}</p>
        </div>
      ) : (
        <div className="events-list">
          {events.map((event, idx) => (
            <div
              key={event.id}
              className={`event-card card card-interactive animate-slide-up stagger-${Math.min(idx + 1, 5)}`}
              onClick={() => router.push(`/stages/${event.id}`)}
            >
              <div className="event-header">
                <span className="badge badge-blue">{event.stageNumber}</span>
                <span className="event-time">{formatDateTime(event.periodFrom)}</span>
              </div>
              <h3 className="event-title">{event.title}</h3>
              <div className="event-speakers">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>{event.speakerNames.join(', ')}</span>
              </div>
              <div className="event-duration">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>
                  {formatDateTime(event.periodFrom).split(', ')[1]} — {formatDateTime(event.periodTo).split(', ')[1]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .events-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .event-card {
          padding: var(--space-4) !important;
        }
        .event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-3);
        }
        .event-time {
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
        }
        .event-title {
          font-size: var(--font-size-lg);
          font-weight: 600;
          margin-bottom: var(--space-3);
          line-height: 1.4;
        }
        .event-speakers, .event-duration {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          margin-bottom: var(--space-2);
        }
      `}</style>
    </div>
  );
}
