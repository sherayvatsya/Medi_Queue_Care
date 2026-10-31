import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { InitialLoadingScreen } from './components/InitialLoadingScreen';
import { auth } from './firebase';

function AppStartup() {
  const [showSplash, setShowSplash] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isLogoReady, setIsLogoReady] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasMinimumTimeElapsed, setHasMinimumTimeElapsed] = useState(false);

  useEffect(() => {
    let active = true;
    const minimumTimer = window.setTimeout(() => setHasMinimumTimeElapsed(true), 2000);
    const fallbackTimer = window.setTimeout(() => {
      setIsAuthReady(true);
      setIsLogoReady(true);
      setHasMinimumTimeElapsed(true);
    }, 5000);

    auth.authStateReady()
      .then(() => {
        if (active) setIsAuthReady(true);
      })
      .catch(() => {
        if (active) setIsAuthReady(true);
      });

    return () => {
      active = false;
      window.clearTimeout(minimumTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    if (showSplash && isLogoReady && isAuthReady && hasMinimumTimeElapsed) {
      setIsFadingOut(true);
    }
  }, [hasMinimumTimeElapsed, isAuthReady, isLogoReady, showSplash]);

  useEffect(() => {
    if (isFadingOut) {
      window.dispatchEvent(new Event('mediqueue:splash-exit'));
    }
  }, [isFadingOut]);

  useEffect(() => {
    if (!isFadingOut) return;
    const exitTimer = window.setTimeout(() => setShowSplash(false), 1300);
    return () => window.clearTimeout(exitTimer);
  }, [isFadingOut]);

  return (
    <>
      <App />
      {showSplash && (
        <InitialLoadingScreen
          fadingOut={isFadingOut}
          onLogoReady={() => setIsLogoReady(true)}
        />
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppStartup />
    </ThemeProvider>
  </StrictMode>,
);
