'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VisitorFeedbackPage() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const characterLimit = 1000;

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

  return (
    <div className="page-container" style={{ maxWidth: 540 }}>
      <button onClick={() => router.back()} className="back-link">← Go Back</button>
      <h2 className="page-title">💬 Share Your Feedback</h2>
      <p className="page-subtitle">We value your thoughts. Let us know how we can make your exhibition experience even better!</p>

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
