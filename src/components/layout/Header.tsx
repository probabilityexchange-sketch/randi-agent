'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { RandiLogo } from '@/components/branding/RandiLogo';

export function Header() {
  const { user, signIn, signOut, isAuthenticated } = useAuth();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <RandiLogo size="sm" variant="with-text" href="/" animated />
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-xs bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-md transition-colors font-medium"
              >
                Dashboard
              </Link>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {user?.walletAddress
                  ? `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}`
                  : 'Authenticated'}
              </span>
              <button
                onClick={() => signOut()}
                className="text-xs bg-muted hover:bg-muted text-foreground px-3 py-1.5 rounded-md transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn()}
              className="text-xs bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-md transition-colors font-medium"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
