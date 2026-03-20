'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { RandiLogo } from '@/components/branding/RandiLogo';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { signIn, loading, isAuthenticated, sessionReady, sessionError, retrySessionSync } =
    useAuth();
  const router = useRouter();
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    if (isAuthenticated && sessionReady) {
      // Poll /api/auth/me to verify the cookie is actually visible to the server
      // before redirecting. The Set-Cookie from syncSession() might not be
      // committed to the browser's cookie jar immediately, causing the middleware
      // to redirect back to /login in a race condition.
      const verifyAndRedirect = async () => {
        const maxAttempts = 10;
        for (let i = 0; i < maxAttempts; i++) {
          try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (res.ok && !res.redirected) {
              router.replace('/dashboard');
              return;
            }
          } catch {
            // Continue polling
          }
          await new Promise(r => setTimeout(r, 200));
        }
        // Fallback: redirect anyway after polling exhausts
        router.replace('/dashboard');
      };
      verifyAndRedirect();
    }
  }, [isAuthenticated, sessionReady, router]);

  // Auto-show retry after 10s of "Finalizing"
  useEffect(() => {
    if (isAuthenticated && !sessionReady) {
      const timer = window.setTimeout(() => setShowRetry(true), 10000);
      return () => window.clearTimeout(timer);
    }
    setShowRetry(false);
  }, [isAuthenticated, sessionReady]);

  const isFinalizing = isAuthenticated && !sessionReady;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/50">
      <Header />
      <main className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="mb-8 flex justify-center">
          <RandiLogo size="xl" variant="icon-only" />
        </div>
        <h1 className="text-3xl font-bold mb-4">
          Sign In to <span className="text-primary">Randi</span>
        </h1>
        <p className="text-muted-foreground mb-8">
          Sign in or create an account with just a few clicks. Use your social accounts or connect
          any wallet.
        </p>
        <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-4">
          <button
            onClick={() => signIn()}
            disabled={loading || isFinalizing}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Loading...' : isFinalizing ? 'Finalizing sign in...' : 'Sign In'}
          </button>

          {isFinalizing && !sessionError && (
            <div className="w-full rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 justify-center">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
              </div>
              <p className="mt-2">Setting up your session...</p>
              {showRetry && (
                <button
                  onClick={retrySessionSync}
                  className="mt-2 inline-flex rounded-md bg-primary/20 px-3 py-1 text-primary hover:bg-primary/30 transition-colors"
                >
                  Taking too long? Retry
                </button>
              )}
            </div>
          )}

          {sessionError && isFinalizing && (
            <div className="w-full rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              <p>{sessionError}</p>
              <button
                onClick={retrySessionSync}
                className="mt-2 inline-flex rounded-md bg-red-500/20 px-2 py-1 text-red-100 hover:bg-red-500/30"
              >
                Retry
              </button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">Sign in with Solana wallet or Email</p>
        </div>
      </main>
    </div>
  );
}
