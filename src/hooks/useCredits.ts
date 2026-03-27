"use client";

import { useState, useEffect, useCallback } from "react";
import type { TokenTransaction, PurchaseIntentResponse } from "@/types/credits";
import { fetchApi } from "@/lib/utils/api";

const VERIFY_RETRYABLE_STATUS = new Set([503, 404]); // Allow retry on 404 for indexed lag
const VERIFY_MAX_ATTEMPTS = 15;
const VERIFY_RETRY_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export interface SubscriptionInfo {
  status: "none" | "active" | "expired";
  expiresAt: string | null;
}

export function useCredits() {
  const [balance, setBalance] = useState(0);
  const [subscription, setSubscription] = useState<SubscriptionInfo>({
    status: "none",
    expiresAt: null,
  });
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      setError(null);
      const res = await fetchApi("/api/credits/balance");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to fetch balance");
        return;
      }
      const data = await res.json();
      setBalance(data.balance);
      setTransactions(data.transactions);
      if (data.subscriptionStatus) {
        setSubscription({
          status: data.subscriptionStatus,
          expiresAt: data.subscriptionExpiresAt || null,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const initiateSubscription = async () => {
    const res = await fetchApi("/api/credits/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "monthly" }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    return res.json();
  };

  const purchasePackage = async (packageCode: string): Promise<PurchaseIntentResponse> => {
    const res = await fetchApi("/api/purchase-intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageCode }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    return res.json();
  };

  const verifyPurchase = async (
    intentId: string,
    txSig: string,
  ) => {
    let lastError = "Verification failed";

    for (let attempt = 1; attempt <= VERIFY_MAX_ATTEMPTS; attempt += 1) {
      const res = await fetchApi(`/api/purchase-intents/${intentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txSig }),
      });

      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        await fetchBalance();
        return data;
      }

      const err = await res.json().catch(() => ({ error: "Verification failed" }));
      lastError = err.error || "Verification failed";

      if (!VERIFY_RETRYABLE_STATUS.has(res.status) || attempt === VERIFY_MAX_ATTEMPTS) {
        throw new Error(lastError);
      }

      await sleep(VERIFY_RETRY_DELAY_MS);
    }

    throw new Error(lastError);
  };

  const isSubscribed =
    subscription.status === "active" &&
    subscription.expiresAt !== null &&
    new Date(subscription.expiresAt) > new Date();

  return {
    balance,
    subscription,
    isSubscribed,
    transactions,
    loading,
    error,
    initiateSubscription,
    purchasePackage,
    verifyPurchase,
    refresh: fetchBalance,
  };
}
