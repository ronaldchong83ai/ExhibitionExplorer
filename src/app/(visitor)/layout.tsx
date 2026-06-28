'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { SessionUser } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  exhibitorOrAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/home', label: 'Home', icon: '🏠' },
  { href: '/stages', label: 'Stage Info', icon: '🎭' },
  { href: '/facility-booking', label: 'Facility Booking', icon: '📅' },
  { href: '/exhibitors', label: 'Exhibitor List', icon: '🏢' },
  { href: '/venue-map', label: 'Venue Map', icon: '🗺️' },
  { href: '/scanner', label: 'QR Code Scan', icon: '📷' },
  { href: '/coupons', label: 'Coupon/Gift', icon: '🎫' },
  { href: '/feedback', label: 'Feedback', icon: '💬' },
  { href: '/my-page', label: 'My Page', icon: '👤' },
  { href: '/exhibitor', label: 'Exhibitor Page', icon: '💼', exhibitorOrAdminOnly: true },
  { href: '/admin', label: 'Admin Page', icon: '⚙️', adminOnly: true },
];

export default function VisitorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.success) {
        setUser(data.data);
        
        // Fetch full profile info for profile picture
        try {
          const profileRes = await fetch('/api/my-profile');
          const profileData = await profileRes.json();
          if (profileData.success && profileData.data) {
            setProfilePic(profileData.data.profilePic || null);
          } else {
            setProfilePic(null);
          }
        } catch (profileErr) {
          console.error('Failed to load profile pic:', profileErr);
          setProfilePic(null);
        }
      } else {
        setUser(null);
        setProfilePic(null);
        router.push('/login');
      }
    } catch {
      setUser(null);
      setProfilePic(null);
      router.push('/login');
    }
  }, [router]);

  const fetchNotificationCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/unread-count');
      const data = await res.json();
      if (data.success) {
        setUnreadCount(data.data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchSession();
    fetchNotificationCount();

    // Listen for custom profile update events
    window.addEventListener('session-update', fetchSession);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      }).catch(err => {
        console.error('Service worker registration failed:', err);
      });
    }

    return () => {
      window.removeEventListener('session-update', fetchSession);
    };
  }, [fetchSession, fetchNotificationCount]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (item.adminOnly && user?.role !== 'ADMIN') return false;
    if (item.exhibitorOrAdminOnly && user?.role !== 'EXHIBITOR' && user?.role !== 'ADMIN') return false;
    if (item.href === '/exhibitor' && user?.role === 'ADMIN') return false;
    if (item.href === '/feedback' && user?.role === 'ADMIN') return false;
    return true;
  });

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <button
          className="header-menu-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
          id="menu-toggle"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 12h18M3 6h18M3 18h18"/>
          </svg>
        </button>

        <h1 className="header-title">Exhibition Explorer</h1>

        <Link href="/notifications" className="header-bell-btn" id="notifications-bell">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {unreadCount > 0 && <span className="notification-dot" />}
        </Link>
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {profilePic ? (
                <img src={profilePic} alt="Profile" />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() || '?'
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name || 'Loading...'}</span>
              <span className="sidebar-user-role badge badge-blue">{user?.role || ''}</span>
            </div>
          </div>
        </div>

        <div className="sidebar-nav">
          {filteredNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${pathname?.startsWith(item.href) ? 'active' : ''}`}
              onClick={closeSidebar}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
              {pathname?.startsWith(item.href) && <span className="sidebar-active-dot" />}
            </Link>
          ))}
        </div>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="sidebar-link logout-btn" id="logout-btn">
            <span className="sidebar-icon">🚪</span>
            <span className="sidebar-label">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}
