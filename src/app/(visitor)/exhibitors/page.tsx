'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Exhibitor, Exhibition } from '@/types';

export default function ExhibitorsPage() {
  const router = useRouter();
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
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
    const fetchExhibitors = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedExhibitionId) {
        params.set('exhibitionId', selectedExhibitionId);
      }
      if (search) {
        params.set('q', search);
      }
      try {
        const res = await fetch(`/api/exhibitors?${params.toString()}`);
        const data = await res.json();
        if (data.success && data.data) {
          setExhibitors(data.data.exhibitors || []);
          setExhibition(data.data.exhibition || null);
        }
      } catch (err) {
        console.error("Failed to load exhibitors:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchExhibitors, 300);
    return () => clearTimeout(timer);
  }, [search, selectedExhibitionId]);

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
        {renderStyledPageTitle("🏢 Exhibitors")}
      </h2>
      {exhibition && (
        <p className="page-subtitle" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: 'var(--space-4)' }}>
          For {exhibition.title}
        </p>
      )}

      <div className="search-wrapper" style={{ marginBottom: 'var(--space-5)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="search-input"
          placeholder="Search exhibitors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          id="exhibitors-search"
        />
      </div>

      {loading ? (
        [1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton" style={{ height: 100, marginBottom: 12 }} />
        ))
      ) : exhibitors.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏢</div>
          <p className="empty-state-text">{search ? 'No exhibitors match your search' : 'No exhibitors yet'}</p>
        </div>
      ) : (
        <div className="exhibitor-list">
          {exhibitors.map((exhibitor, idx) => (
            <div
              key={exhibitor.id}
              className={`exhibitor-card card card-interactive animate-slide-up stagger-${Math.min(idx + 1, 5)}`}
              onClick={() => router.push(`/exhibitors/${exhibitor.id}`)}
            >
              <div className="exhibitor-header">
                {exhibitor.imageUrl ? (
                  <img
                    src={exhibitor.imageUrl}
                    alt={exhibitor.name}
                    className="exhibitor-avatar"
                    style={{ objectFit: 'cover', border: '1px solid var(--color-border)' }}
                  />
                ) : (
                  <div className="exhibitor-avatar">
                    {exhibitor.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="exhibitor-info">
                  <h3 className="exhibitor-name">{exhibitor.name}</h3>
                  <span className="badge badge-green">Booth {exhibitor.boothNumber}</span>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="chevron-icon">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
              <p className="exhibitor-desc">{exhibitor.description}</p>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .exhibitor-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .exhibitor-card {
          padding: var(--space-4) !important;
        }
        .exhibitor-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
        }
        .exhibitor-avatar {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          background: var(--gradient-cool);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: var(--font-size-lg);
          color: white;
          flex-shrink: 0;
        }
        .exhibitor-info {
          flex: 1;
          min-width: 0;
        }
        .exhibitor-name {
          font-size: var(--font-size-base);
          font-weight: 600;
          margin-bottom: var(--space-1);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .exhibitor-desc {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .chevron-icon {
          color: var(--color-text-tertiary);
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
