'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VisitorFeedbackPage() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [exhibition, setExhibition] = useState<{ title: string } | null>(null);

  const characterLimit = 1000;

  useEffect(() => {
    const saved = localStorage.getItem('selectedExhibitionId');
    if (saved) {
      fetch(`/api/home?exhibitionId=${saved}`)
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data && res.data.exhibition) {
            setExhibition(res.data.exhibition);
          }
        })
        .catch(err => console.error(err));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    setError('');

    const exhibitionId = typeof window !== 'undefined' ? localStorage.getItem('selectedExhibitionId') : null;

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, exhibitionId }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setContent('');
      } else {
        setError(data.error || 'Failed to submit feedback. Please try again.');
      }
    } catch {
      setError('A network error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
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
    <div className="page-container" style={{ maxWidth: 540 }}>
      <h2 className="page-title" style={{ marginBottom: exhibition ? 4 : 'var(--space-4)' }}>
        {renderStyledPageTitle("💬 Share Your Feedback")}
      </h2>
      {exhibition && (
        <p className="page-subtitle" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: 'var(--space-4)' }}>
          For {exhibition.title}
        </p>
      )}
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
        We value your thoughts. Let us know how we can make your exhibition experience even better!
      </p>

      {success ? (
        <div className="card success-card animate-scale-in" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <div className="success-icon" style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>🎉</div>
          <h3 className="section-title" style={{ color: 'var(--color-accent-green)' }}>Thank You!</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)', lineHeight: 1.6, margin: '0 0 var(--space-4) 0' }}>
            Your feedback has been submitted successfully. Our team will review your suggestions to improve the exhibition companion app.
          </p>
          <button className="btn btn-primary" onClick={() => setSuccess(false)}>
            Submit Another Response
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="feedback-form card animate-scale-in" style={{ padding: 'var(--space-5)' }}>
          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label" htmlFor="feedback-text">
              Your Feedback
            </label>
            <textarea
              id="feedback-text"
              className="form-input"
              rows={8}
              placeholder="What did you like? What can we improve? Let us know..."
              value={content}
              onChange={(e) => setContent(e.target.value.substring(0, characterLimit))}
              required
              disabled={loading}
              style={{ resize: 'vertical', minHeight: '160px', padding: '12px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
              <span>Please keep it constructive.</span>
              <span style={{ color: content.length >= characterLimit ? 'var(--color-accent-coral)' : 'inherit' }}>
                {content.length} / {characterLimit} characters
              </span>
            </div>
          </div>

          {error && (
            <div className="form-error-msg" style={{ color: 'var(--color-accent-coral)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', fontWeight: 500 }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading || !content.trim()}
          >
            {loading ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      )}

      <style jsx>{`
        .back-link {
          color: var(--color-accent-blue);
          font-size: var(--font-size-sm);
          margin-bottom: var(--space-3);
          background: none;
          border: none;
          cursor: pointer;
          display: inline-block;
          padding: 0;
          font-family: inherit;
        }
        .success-card {
          border: 1px solid rgba(16, 185, 129, 0.2);
          background: rgba(16, 185, 129, 0.05);
        }
        .feedback-form {
          border: 1px solid var(--color-border);
          background: var(--color-bg-card);
        }
      `}</style>
    </div>
  );
}
