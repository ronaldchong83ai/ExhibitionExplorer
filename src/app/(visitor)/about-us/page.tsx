'use client';

import { useState, useEffect } from 'react';

export default function VisitorAboutUsPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [exhibition, setExhibition] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('selectedExhibitionId');
    if (saved) {
      fetch(`/api/home?exhibitionId=${saved}`)
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data && res.data.exhibition) {
            setExhibition(res.data.exhibition);
            return fetch(`/api/about-us?exhibitionId=${res.data.exhibition.id}`);
          }
          throw new Error('Failed to load exhibition');
        })
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data) {
            setContent(res.data.content || '');
          }
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

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
    <div className="page-container" style={{ maxWidth: 800 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .rich-content-view img {
          max-width: 100%;
          height: auto;
          border-radius: var(--radius-md);
          margin: 16px auto;
          display: block;
        }
        .rich-content-view ul, .rich-content-view ol {
          padding-left: 20px;
          margin: 12px 0;
        }
        .rich-content-view p {
          margin-bottom: 12px;
        }
      `}} />

      <h2 className="page-title" style={{ marginBottom: exhibition ? 4 : 'var(--space-4)' }}>
        {renderStyledPageTitle("ℹ️ About Us")}
      </h2>
      {exhibition && (
        <p className="page-subtitle" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: 'var(--space-6)' }}>
          For {exhibition.title}
        </p>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-8)' }}>
          Loading...
        </div>
      ) : !content ? (
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)', fontStyle: 'italic', margin: 0 }}>
            No about us information has been posted for this exhibition yet.
          </p>
        </div>
      ) : (
        <div 
          className="card rich-content-view animate-fade-in" 
          style={{ 
            padding: 'var(--space-6)', 
            lineHeight: 1.7, 
            color: 'var(--color-text-primary)', 
            fontSize: 'var(--font-size-base)',
            overflowX: 'hidden'
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}
    </div>
  );
}
