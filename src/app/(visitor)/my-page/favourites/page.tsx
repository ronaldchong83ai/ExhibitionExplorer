'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Favourite, StageEvent, Exhibitor } from '@/types';

export default function FavouritesPage() {
  const router = useRouter();
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [stageEvents, setStageEvents] = useState<Record<string, StageEvent>>({});
  const [exhibitors, setExhibitors] = useState<Record<string, Exhibitor>>({});
  const [tab, setTab] = useState<'all' | 'exhibitors' | 'stages'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/favourites')
      .then(res => res.json())
      .then(async (data) => {
        if (data.success) {
          setFavourites(data.data);
          // Fetch details for each favourite
          const stageMap: Record<string, StageEvent> = {};
          const exhibMap: Record<string, Exhibitor> = {};

          for (const fav of data.data) {
            if (fav.type === 'STAGE_EVENT') {
              const res = await fetch(`/api/stages/${fav.targetId}`);
              const d = await res.json();
              if (d.success) stageMap[fav.targetId] = d.data;
            } else {
              const res = await fetch(`/api/exhibitors/${fav.targetId}`);
              const d = await res.json();
              if (d.success) exhibMap[fav.targetId] = d.data.exhibitor;
            }
          }
          setStageEvents(stageMap);
          setExhibitors(exhibMap);
        }
        setLoading(false);
      });
  }, []);

  const filtered = favourites.filter(f => {
    if (tab === 'exhibitors') return f.type === 'EXHIBITOR';
    if (tab === 'stages') return f.type === 'STAGE_EVENT';
    return true;
  });

  return (
    <div className="page-container">
      <button onClick={() => router.back()} className="back-link">
        ← Back to My Page
      </button>
      <h2 className="page-title">⭐ Favourites</h2>

      <div className="tabs">
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All</button>
        <button className={`tab ${tab === 'exhibitors' ? 'active' : ''}`} onClick={() => setTab('exhibitors')}>Exhibitors</button>
        <button className={`tab ${tab === 'stages' ? 'active' : ''}`} onClick={() => setTab('stages')}>Stages</button>
      </div>

      {loading ? (
        [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 12 }} />)
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⭐</div>
          <p className="empty-state-text">No favourites yet. Star exhibitors or stage events to save them!</p>
        </div>
      ) : (
        <div className="fav-list">
          {filtered.map((fav, idx) => {
            const isStage = fav.type === 'STAGE_EVENT';
            const stage = stageEvents[fav.targetId];
            const exhibitor = exhibitors[fav.targetId];
            return (
              <div
                key={fav.id}
                className={`fav-card card card-interactive animate-slide-up stagger-${Math.min(idx + 1, 5)}`}
                onClick={() => router.push(isStage ? `/stages/${fav.targetId}` : `/exhibitors/${fav.targetId}`)}
              >
                <div className="fav-icon">{isStage ? '🎭' : '🏢'}</div>
                <div className="fav-info">
                  <span className={`badge ${isStage ? 'badge-purple' : 'badge-blue'}`}>{isStage ? 'Stage Event' : 'Exhibitor'}</span>
                  <h3 className="fav-name">{isStage ? stage?.title : exhibitor?.name}</h3>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .back-link {
          color: var(--color-accent-blue);
          font-size: var(--font-size-sm);
          margin-bottom: var(--space-3);
          display: inline-block;
        }
        .fav-list { display: flex; flex-direction: column; gap: var(--space-3); }
        .fav-card { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4) !important; }
        .fav-icon { font-size: 1.5rem; }
        .fav-info { flex: 1; }
        .fav-name { font-size: var(--font-size-base); font-weight: 600; margin-top: var(--space-1); }
      `}</style>
    </div>
  );
}
