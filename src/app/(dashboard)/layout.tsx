"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, isAuthenticated, sessionReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Client-side auth guard: if the middleware let us through (e.g. during
    // the login→dashboard cookie race) but auth actually failed, redirect.
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  // Show nothing while auth is resolving to avoid flash of unauthenticated content
  if (loading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
