'use client';

import { useRouter } from 'next/navigation';

const MY_PAGE_ITEMS = [
  { href: '/my-page/profile', label: 'My Profile Details', icon: '👤', desc: 'Manage your profile information' },
  { href: '/my-page/favourites', label: 'Favourites', icon: '⭐', desc: 'Your saved exhibitors and events' },
  { href: '/my-page/history', label: 'History', icon: '📜', desc: 'Your activity log' },
  { href: '/my-page/notification-settings', label: 'Notification Settings', icon: '🔔', desc: 'Push notification preferences' },
];

export default function MyPagePage() {
  const router = useRouter();

  return (
    <div className="page-container">
      <h2 className="page-title">👤 My Page</h2>

      <div className="my-page-grid">
        {MY_PAGE_ITEMS.map((item, idx) => (
          <button
            key={item.href}
            className={`my-page-card card card-interactive animate-slide-up stagger-${idx + 1}`}
            onClick={() => router.push(item.href)}
          >
            <span className="my-page-icon">{item.icon}</span>
            <h3 className="my-page-label">{item.label}</h3>
            <p className="my-page-desc">{item.desc}</p>
          </button>
        ))}
      </div>

      <style jsx>{`
        .my-page-grid {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .my-page-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: var(--space-6) !important;
          width: 100%;
        }
        .my-page-icon {
          font-size: 2.5rem;
          margin-bottom: var(--space-3);
        }
        .my-page-label {
          font-size: var(--font-size-lg);
          font-weight: 600;
          margin-bottom: var(--space-2);
        }
        .my-page-desc {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
        }
      `}</style>
    </div>
  );
}
