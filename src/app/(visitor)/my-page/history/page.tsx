'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionLog } from '@/types';

const ACTION_CONFIG: Record<string, { icon: string; label: string }> = {
  SCAN_QR: { icon: '📷', label: 'QR Scan' },
  SCAN_LINKRAY: { icon: '💡', label: 'LinkRay Scan' },
  REDEEM_COUPON: { icon: '🎫', label: 'Coupon Redeemed' },
  VIEW_EXHIBITOR: { icon: '🏢', label: 'Viewed Exhibitor' },
  VIEW_STAGE: { icon: '🎭', label: 'Viewed Stage Event' },
  FAVOURITE_ADD: { icon: '⭐', label: 'Added Favourite' },
  FAVOURITE_REMOVE: { icon: '💫', label: 'Removed Favourite' },
};

export default function HistoryPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/action-logs')
      .then(res => res.json())
      .then(data => {
        if (data.success) setLogs(data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="page-container">
      <button onClick={() => router.back()} className="back-link">← Back to My Page</button>
      <h2 className="page-title">📜 History</h2>

      {loading ? (
        [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 70, marginBottom: 12 }} />)
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📜</div>
          <p className="empty-state-text">No activity yet</p>
        </div>
      ) : (
        <div className="history-list">
          {logs.map((log, idx) => {
            const config = ACTION_CONFIG[log.action] || { icon: '📌', label: log.action };
            return (
              <div key={log.id} className={`history-item animate-slide-up stagger-${Math.min(idx + 1, 5)}`}>
                <span className="history-icon">{config.icon}</span>
                <div className="history-info">
                  <span className="history-label">{config.label}</span>
                  <p className="history-details">{log.details}</p>
                </div>
                <span className="history-time">{formatTime(log.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .back-link { color: var(--color-accent-blue); font-size: var(--font-size-sm); margin-bottom: var(--space-3); display: inline-block; }
        .history-list { display: flex; flex-direction: column; }
        .history-item {
          display: flex; align-items: flex-start; gap: var(--space-3);
          padding: var(--space-3) 0; border-bottom: 1px solid var(--color-border);
        }
        .history-item:last-child { border-bottom: none; }
        .history-icon { font-size: 1.25rem; margin-top: 2px; }
        .history-info { flex: 1; }
        .history-label { font-size: var(--font-size-sm); font-weight: 600; }
        .history-details { font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: 2px; }
        .history-time { font-size: var(--font-size-xs); color: var(--color-text-tertiary); white-space: nowrap; }
      `}</style>
    </div>
  );
}
