'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface NotifSetting {
  id: string;
  hoursBeforeEvent: number;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<NotifSetting[]>([]);
  const [newHours, setNewHours] = useState('');
  const [loading, setLoading] = useState(true);

  // Push notification state
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  const checkSubscription = useCallback(async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPushPermission(Notification.permission);
      
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } catch (err) {
        console.error('Error checking push subscription:', err);
      }
    }
  }, []);

  useEffect(() => {
    fetch('/api/notification-settings')
      .then(res => res.json())
      .then(data => {
        if (data.success) setSettings(data.data);
      })
      .finally(() => setLoading(false));

    checkSubscription();
  }, [checkSubscription]);

  const togglePushSubscription = async () => {
    if (!isSupported) return;
    setSubscribing(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (isSubscribed) {
        // Unsubscribe
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
        setIsSubscribed(false);
      } else {
        // Request Permission
        const permission = await Notification.requestPermission();
        setPushPermission(permission);
        
        if (permission !== 'granted') {
          alert('Notification permission was denied.');
          setSubscribing(false);
          return;
        }

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          alert('VAPID public key not found. Please configure .env file.');
          setSubscribing(false);
          return;
        }

        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub),
        });

        setIsSubscribed(true);
      }
    } catch (err: any) {
      console.error('Failed to toggle push subscription:', err);
      alert(`Push error: ${err.message || err}`);
    } finally {
      setSubscribing(false);
    }
  };

  const addSetting = async () => {
    const hours = parseFloat(newHours);
    if (isNaN(hours) || hours <= 0) return;

    const res = await fetch('/api/notification-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hoursBeforeEvent: hours }),
    });
    const data = await res.json();
    if (data.success) {
      setSettings(prev => [...prev, data.data]);
      setNewHours('');
    }
  };

  const removeSetting = async (id: string) => {
    const res = await fetch('/api/notification-settings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success) {
      setSettings(prev => prev.filter(s => s.id !== id));
    }
  };

  const formatHours = (h: number) => {
    if (h < 1) return `${Math.round(h * 60)} minutes`;
    if (h === 1) return '1 hour';
    return `${h} hours`;
  };

  return (
    <div className="page-container">
      <button onClick={() => router.back()} className="back-link">← Back to My Page</button>
      <h2 className="page-title">🔔 Notification Settings</h2>
      <p className="page-subtitle">Get notified before upcoming events</p>

      {/* Push Status / Enable Toggle */}
      <div className="push-status-card card animate-scale-in" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="push-status-info">
          <div className="push-status-label-row">
            <span className="push-status-icon">{isSubscribed ? '🔔' : '🔕'}</span>
            <div>
              <h3 className="section-title" style={{ margin: 0 }}>Push Notifications</h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
                {isSupported 
                  ? (isSubscribed ? 'Subscribed to alerts on this device' : 'Tap below to enable push notifications')
                  : 'Not supported on this browser/device'}
              </p>
            </div>
          </div>
          {isSupported && (
            <button 
              className={`btn btn-full ${isSubscribed ? 'btn-secondary' : 'btn-primary'}`}
              style={{ marginTop: 'var(--space-3)' }}
              disabled={subscribing}
              onClick={togglePushSubscription}
            >
              {subscribing 
                ? 'Processing...' 
                : (isSubscribed ? 'Disable Push Notifications' : 'Enable Push Notifications')}
            </button>
          )}
        </div>
      </div>

      {/* Add New */}
      <div className="add-section card" style={{ marginBottom: 'var(--space-5)' }}>
        <h3 className="section-title">Add Reminder</h3>
        <div className="add-form">
          <input
            type="number"
            className="form-input"
            placeholder="Hours before event"
            value={newHours}
            onChange={e => setNewHours(e.target.value)}
            min="0.25"
            step="0.25"
            id="notif-hours-input"
          />
          <button className="btn btn-primary" onClick={addSetting} id="notif-add-btn">Add</button>
        </div>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
          E.g., 1 for 1 hour before, 0.5 for 30 minutes before
        </p>
      </div>

      {/* Current Settings */}
      <h3 className="section-title">Active Reminders</h3>
      {loading ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : settings.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-6) 0' }}>
          <p className="empty-state-text">No reminders set</p>
        </div>
      ) : (
        <div className="settings-list">
          {settings.map(s => (
            <div key={s.id} className="setting-item card">
              <div className="setting-info">
                <span className="setting-icon">⏰</span>
                <span className="setting-text">{formatHours(s.hoursBeforeEvent)} before</span>
              </div>
              <button className="btn-icon" onClick={() => removeSetting(s.id)} aria-label="Remove">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-coral)" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .back-link { color: var(--color-accent-blue); font-size: var(--font-size-sm); margin-bottom: var(--space-3); display: inline-block; }
        .push-status-card { padding: var(--space-4) var(--space-5) !important; background: var(--color-bg-glass); border: 1px solid var(--color-border); }
        .push-status-label-row { display: flex; align-items: center; gap: var(--space-3); }
        .push-status-icon { font-size: 1.75rem; }
        .add-section { padding: var(--space-5) !important; }
        .add-form { display: flex; gap: var(--space-3); }
        .add-form input { flex: 1; }
        .settings-list { display: flex; flex-direction: column; gap: var(--space-2); }
        .setting-item { display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4) !important; }
        .setting-info { display: flex; align-items: center; gap: var(--space-3); }
        .setting-icon { font-size: 1.25rem; }
        .setting-text { font-weight: 500; }
      `}</style>
    </div>
  );
}
