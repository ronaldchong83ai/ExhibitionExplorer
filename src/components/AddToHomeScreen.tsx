'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Global variable to capture the event as early as possible (before React mounts)
let globalDeferredPrompt: any = null;

if (typeof window !== 'undefined') {
  // Capture any early event that was stored on the window object by layout.tsx
  if ((window as any).deferredPrompt) {
    globalDeferredPrompt = (window as any).deferredPrompt;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    (window as any).deferredPrompt = e;
  });
}

export default function AddToHomeScreen() {
  const pathname = usePathname();
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other' | null>(null);
  const [isAlreadyInstalled, setIsAlreadyInstalled] = useState(false);

  const isMobileDevice = () => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isNarrowScreen = window.innerWidth < 768; // Allows testing via Chrome DevTools responsive emulation
    return isMobileUA || isNarrowScreen;
  };

  const isiOS = () => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent;
    return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  const isStandalone = () => {
    if (typeof window === 'undefined') return false;
    return (
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // The prompt should ONLY show on the login route
    if (pathname !== '/login') {
      setShowPrompt(false);
      return;
    }

    // Check if already in standalone PWA mode
    if (isStandalone()) {
      console.log('AddToHomeScreen: Already running in standalone PWA mode');
      return;
    }

    // Check if verified as installed via state
    if (isAlreadyInstalled) {
      console.log('AddToHomeScreen: App is already installed (verified)');
      return;
    }

    // Only show on mobile devices (or narrow screens)
    if (!isMobileDevice()) {
      console.log('AddToHomeScreen: Not a mobile or narrow screen device');
      return;
    }

    // Check if installed using getInstalledRelatedApps (Chromium only)
    if (typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator) {
      (navigator as any).getInstalledRelatedApps().then((relatedApps: any[]) => {
        if (relatedApps && relatedApps.length > 0) {
          console.log('AddToHomeScreen: App is already installed (verified via getInstalledRelatedApps)');
          setIsAlreadyInstalled(true);
        }
      }).catch((err: any) => {
        console.log('AddToHomeScreen: getInstalledRelatedApps check failed or not supported in this context', err);
      });
    }

    // Retrieve active prompt from module variable or window global
    const activePrompt = globalDeferredPrompt || (window as any).deferredPrompt;
    console.log('AddToHomeScreen: activePrompt status:', activePrompt ? 'Found' : 'Not found');

    // 1. If we already captured the beforeinstallprompt event globally
    if (activePrompt) {
      setDeferredPrompt(activePrompt);
      setPlatform('android');
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1000);
      return () => clearTimeout(timer);
    }

    // iOS detection
    if (isiOS()) {
      setPlatform('ios');
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2500);
      return () => clearTimeout(timer);
    }

    // Android/Chrome beforeinstallprompt handling (if it fires later)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      (window as any).deferredPrompt = e;
      setDeferredPrompt(e);
      setPlatform('android');
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1000);
      return () => clearTimeout(timer);
    };

    const handleAppInstalled = () => {
      console.log('AddToHomeScreen: PWA installed successfully (appinstalled event)');
      setIsAlreadyInstalled(true);
      setShowPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Fallback timer for other mobile browsers if beforeinstallprompt is not supported
    const fallbackTimer = setTimeout(() => {
      // If the browser natively supports beforeinstallprompt, we shouldn't show a fallback prompt
      // because the lack of the event implies the PWA is already installed or not installable.
      if ('onbeforeinstallprompt' in window) {
        console.log('AddToHomeScreen: Browser supports beforeinstallprompt natively but it did not fire. Suppressing fallback.');
        return;
      }

      setPlatform((prev) => {
        if (prev === null) {
          console.log('AddToHomeScreen: Fallback triggered for non-Chrome/non-iOS browser');
          setShowPrompt(true);
          return 'other';
        }
        return prev;
      });
    }, 4500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(fallbackTimer);
    };
  }, [pathname, isAlreadyInstalled]);

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('AddToHomeScreen: User accepted the install prompt');
      setIsAlreadyInstalled(true);
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (pathname !== '/login') return null;
  if (!showPrompt) return null;

  return (
    <div className="ath-overlay">
      <div className="ath-drawer animate-slide-up">
        {/* Header */}
        <div className="ath-header">
          <div className="ath-logo-container">
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="10" fill="url(#ath-logo-grad)" />
              <path d="M14 20L24 12L34 20V34H14V20Z" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M20 34V26H28V34" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
              <circle cx="24" cy="20" r="3" stroke="white" strokeWidth="2" />
              <defs>
                <linearGradient id="ath-logo-grad" x1="0" y1="0" x2="48" y2="48">
                  <stop stopColor="#3B82F6" />
                  <stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="ath-title-group">
              <h3 className="ath-title">Exhibition Explorer</h3>
              <p className="ath-subtitle">Install as a Web App</p>
            </div>
          </div>
          <button className="ath-close-btn" onClick={handleDismiss} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="ath-body">
          <p className="ath-intro">
            Add this app to your Home Screen for full-screen mode, quick offline access, and real-time event updates.
          </p>

          {platform === 'ios' && (
            <div className="ath-guide">
              <p className="ath-guide-title">How to Install on iOS:</p>
              <ol className="ath-steps">
                <li className="ath-step-item">
                  Tap the <strong className="ath-highlight">Share</strong> button in Safari's bottom toolbar:
                  <div className="ath-icon-badge">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </div>
                </li>
                <li className="ath-step-item">
                  Scroll down and tap <strong className="ath-highlight">Add to Home Screen</strong>:
                  <div className="ath-icon-badge">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  </div>
                </li>
                <li className="ath-step-item">
                  Tap <strong className="ath-highlight">Add</strong> in the top-right corner.
                </li>
              </ol>
            </div>
          )}

          {platform === 'android' && (
            <div className="ath-action-area">
              <button className="btn btn-primary btn-full btn-lg ath-install-btn" onClick={handleInstall}>
                Add to Home Screen
              </button>
            </div>
          )}

          {platform === 'other' && (
            <div className="ath-guide">
              <p className="ath-guide-title">How to Install:</p>
              <ol className="ath-steps">
                <li className="ath-step-item">
                  Tap the browser menu icon (usually <strong className="ath-highlight">⋮</strong> or <strong className="ath-highlight">⋯</strong>).
                </li>
                <li className="ath-step-item">
                  Select <strong className="ath-highlight">Add to Home screen</strong> or <strong className="ath-highlight">Install App</strong>.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {platform !== 'android' && (
          <div className="ath-footer">
            <button className="ath-later-btn" onClick={handleDismiss}>
              Maybe Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
