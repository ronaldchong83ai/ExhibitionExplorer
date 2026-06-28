'use client';

import { useState, useEffect } from 'react';
import type { VenueMap, Exhibition } from '@/types';

export default function VenueMapPage() {
  const [selectedExhibitionId, setSelectedExhibitionId] = useState<string | null>(null);
  const [venueMap, setVenueMap] = useState<VenueMap | null>(null);
  const [exhibition, setExhibition] = useState<Exhibition | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1.0);

  // Load selected exhibition from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('selectedExhibitionId');
    if (saved) setSelectedExhibitionId(saved);
  }, []);

  useEffect(() => {
    if (!selectedExhibitionId) {
      setLoading(false);
      return;
    }

    const fetchVenueMapData = async () => {
      setLoading(true);
      try {
        // Fetch exhibition title/details
        const exhRes = await fetch(`/api/exhibitors?exhibitionId=${selectedExhibitionId}`);
        const exhData = await exhRes.json();
        if (exhData.success && exhData.data) {
          setExhibition(exhData.data.exhibition || null);
        }

        // Fetch venue map
        const res = await fetch(`/api/venue-map?exhibitionId=${selectedExhibitionId}`);
        const data = await res.json();
        if (data.success) {
          setVenueMap(data.data || null);
        }
      } catch (err) {
        console.error("Failed to load venue map data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchVenueMapData();
  }, [selectedExhibitionId]);

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

  if (loading) {
    return (
      <div className="page-container">
        <h2 className="page-title">{renderStyledPageTitle("🗺️ Venue Map")}</h2>
        <div className="skeleton" style={{ height: 350 }} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <h2 className="page-title" style={{ marginBottom: exhibition ? 4 : 'var(--space-4)' }}>
        {renderStyledPageTitle("🗺️ Venue Map")}
      </h2>
      {exhibition && (
        <p className="page-subtitle" style={{ marginBottom: 'var(--space-4)' }}>
          For {exhibition.title}
        </p>
      )}

      {venueMap?.imageUrl && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setZoom(prev => Math.min(prev + 0.25, 4.0))}
            style={{ padding: '6px 12px', fontSize: 'var(--font-size-sm)', margin: 0 }}
          >
            ➕ Zoom In
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => setZoom(prev => Math.max(prev - 0.25, 1.0))}
            style={{ padding: '6px 12px', fontSize: 'var(--font-size-sm)', margin: 0 }}
          >
            ➖ Zoom Out
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            Zoom: {Math.round(zoom * 100)}%
          </span>
        </div>
      )}

      <div className="map-card card animate-scale-in" style={{ padding: 0 }}>
        {venueMap?.imageUrl ? (
          <div style={{ overflow: 'auto', width: '100%', maxHeight: '550px', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
            <div style={{ width: `${100 * zoom}%`, transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)', display: 'inline-block', verticalAlign: 'top' }}>
              <img
                src={venueMap.imageUrl}
                alt={`Venue Map for ${exhibition?.title || 'Exhibition'}`}
                style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 'var(--radius-sm)' }}
              />
            </div>
          </div>
        ) : (
          <div className="map-placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            <p className="map-text">Venue map will be uploaded by admin</p>
            <p className="map-subtext">Check back once the exhibition begins</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .map-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          text-align: center;
          padding: var(--space-8);
        }
        .map-text {
          margin-top: var(--space-4);
          color: var(--color-text-secondary);
          font-size: var(--font-size-base);
          font-weight: 500;
        }
        .map-subtext {
          margin-top: var(--space-2);
          color: var(--color-text-tertiary);
          font-size: var(--font-size-sm);
        }
      `}</style>
    </div>
  );
}
