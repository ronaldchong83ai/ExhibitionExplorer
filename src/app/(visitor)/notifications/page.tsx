'use client';

import { useState, useEffect } from 'react';
import type { Notification } from '@/types';
import { formatDateDDMMMYYYY } from '@/lib/date';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        if (data.success) setNotifications(data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateDDMMMYYYY(date);
  };

  if (loading) {
    return (
      <div className="page-container">
        <h2 className="page-title">Notifications</h2>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 80, marginBottom: 12 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="page-container">
      <h2 className="page-title">🔔 Notifications</h2>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔕</div>
          <p className="empty-state-text">No notifications yet</p>
        </div>
      ) : (
        <div className="notif-list">
          {notifications.map((notif, idx) => (
            <div
              key={notif.id}
              className={`notif-card card animate-slide-up stagger-${Math.min(idx + 1, 5)} ${!notif.readAt ? 'unread' : ''}`}
            >
              <div className="notif-header">
                <h3 className="notif-title">{notif.title}</h3>
                <span className="notif-time">{formatTime(notif.createdAt)}</span>
              </div>
              <p className="notif-body">{notif.body}</p>
              {!notif.readAt && <span className="notif-unread-dot" />}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .notif-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .notif-card {
          position: relative;
          padding: var(--space-4) !important;
        }
        .notif-card.unread {
          border-left: 3px solid var(--color-accent-blue);
        }
        .notif-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-2);
        }
        .notif-title {
          font-size: var(--font-size-base);
          font-weight: 600;
          flex: 1;
        }
        .notif-time {
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
          white-space: nowrap;
          margin-left: var(--space-3);
        }
        .notif-body {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          line-height: 1.5;
        }
        .notif-unread-dot {
          position: absolute;
          top: var(--space-4);
          right: var(--space-4);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-accent-blue);
        }
      `}</style>
    </div>
  );
}
