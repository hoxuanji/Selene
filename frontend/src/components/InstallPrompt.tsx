import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Compact banner that appears when the browser supports A2HS (Add to Home Screen).
 * Dismissible and remembers the user's choice for 30 days.
 */
export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Don't show if already installed as standalone
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Don't show if user dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 30 * 24 * 60 * 60 * 1000)
      return;

    // Detect iOS Safari (no beforeinstallprompt support)
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome/.test(ua);
    if (isiOS && isSafari) {
      setIsIos(true);
      setShowBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  };

  if (!showBanner) return null;

  return (
    <>
      <div className="install-banner">
        <span className="install-banner-icon">📲</span>
        <div className="install-banner-text">
          <strong>Install Selene</strong>
          <span>Add to your home screen for quick access</span>
        </div>
        {isIos ? (
          <button
            className="install-banner-btn"
            onClick={() => setShowIosGuide(true)}
          >
            How?
          </button>
        ) : (
          <button className="install-banner-btn" onClick={handleInstall}>
            Install
          </button>
        )}
        <button
          className="install-banner-close"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {showIosGuide && (
        <div className="ios-guide-overlay" onClick={() => setShowIosGuide(false)}>
          <div
            className="ios-guide-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Install on iPhone / iPad</h3>
            <ol>
              <li>
                Tap the <strong>Share</strong> button{' '}
                <span style={{ fontSize: 20 }}>⬆</span> in Safari's toolbar
              </li>
              <li>
                Scroll down and tap <strong>"Add to Home Screen"</strong>
              </li>
              <li>
                Tap <strong>Add</strong> — done!
              </li>
            </ol>
            <button
              className="install-banner-btn"
              style={{ marginTop: 16, width: '100%' }}
              onClick={() => setShowIosGuide(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
