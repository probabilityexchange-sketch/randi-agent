import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { resolvePrivyWallet } from "@/lib/auth/privy";
import { ensureUserHasUsername } from "@/lib/utils/username";
import { isValidSolanaAddress } from "@/lib/solana/validation";

const schema = z.object({
  wallet: z.string().optional(),
});

function isPrivyRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("status 429") || message.includes("too_many_requests");
}

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function POST(request: NextRequest) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Unauthorized", code: "missing_access_token" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const requestOrigin =
    request.headers.get("origin") ||
    request.nextUrl.origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    undefined;
  const demoAuthBypassEnabled = process.env.DEMO_AUTH_BYPASS === "true";
  const demoAuthBypassWallet = process.env.DEMO_AUTH_BYPASS_WALLET?.trim() || null;

  let wallet: string;
  try {
    wallet = await resolvePrivyWallet(accessToken, parsed.data.wallet, requestOrigin);
  } catch (error) {
    // Some wallet adapters can provide a selected address that differs from the
    // linked wallet returned by Privy. Fall back to any linked Solana wallet.
    try {
      wallet = await resolvePrivyWallet(accessToken, undefined, requestOrigin);
    } catch (fallbackError) {
      const primaryReason =
        error instanceof Error ? error.message : "Unknown Privy verification error";
      const fallbackReason =
        fallbackError instanceof Error
          ? fallbackError.message
          : "Unknown fallback verification error";

      console.error("Privy session verification failed", {
        primaryReason,
        fallbackReason,
        requestedWallet: parsed.data.wallet ?? null,
      });

      if (isPrivyRateLimitError(error) || isPrivyRateLimitError(fallbackError)) {
        return NextResponse.json(
          {
            error: "Authentication provider is rate limiting requests. Please retry shortly.",
            code: "privy_rate_limited",
          },
          {
            status: 429,
            headers: {
              "Retry-After": "15",
            },
          }
        );
      }

      if (!demoAuthBypassEnabled) {
        if (
          process.env.NODE_ENV === "development" &&
          (primaryReason.includes("No linked Solana wallet") ||
            fallbackReason.includes("No linked Solana wallet"))
        ) {
          console.warn(
            "Dev Mode: User authenticated but no Solana wallet found. Using mock address for testing."
          );
          wallet = demoAuthBypassWallet || "DevWallethE1pM8uW26x7pSxD9B5pXwYpZ6x7pSxD9B5p";
        } else {
          return NextResponse.json(
            {
              error:
                "Unable to verify authenticated wallet. If using Email login, please ensure your embedded wallet is initialized.",
              code: "wallet_verification_failed",
            },
            { status: 401 }
          );
        }
      } else {
        const fallbackWallet = parsed.data.wallet?.trim() || demoAuthBypassWallet;
        if (!fallbackWallet || !isValidSolanaAddress(fallbackWallet)) {
          return NextResponse.json(
            {
              error:
                "Demo auth bypass is enabled, but no valid wallet was provided for session creation.",
              code: "demo_bypass_missing_wallet",
            },
            { status: 401 }
          );
        }

        if (demoAuthBypassWallet && fallbackWallet !== demoAuthBypassWallet) {
          return NextResponse.json(
            {
              error: "Wallet is not allowed for demo auth bypass.",
              code: "demo_bypass_wallet_not_allowed",
            },
            { status: 401 }
          );
        }

        console.warn("DEMO_AUTH_BYPASS used to issue auth session", {
          wallet: fallbackWallet,
        });
        wallet = fallbackWallet;
      }
    }
  }

  console.log("Session Establishment Diagnostic:", {
    hasProjectId: process.env.DATABASE_URL?.includes("uoltahlxvmuyznfthgxv"),
    env: process.env.VERCEL_ENV || "unknown",
    availableVars: [
      "DATABASE_URL",
      "DIRECT_URL",
      "POSTGRES_PRISMA_URL",
      "POSTGRES_URL",
      "POSTGRES_URL_NON_POOLING",
    ].filter(v => !!process.env[v]),
  });

  try {
    const user = await prisma.user.upsert({
      where: { walletAddress: wallet },
      update: {},
      create: { walletAddress: wallet },
    });

    const username = await ensureUserHasUsername(prisma, user.id, wallet);

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      console.warn("CRITICAL: JWT_SECRET is not set or too short. Session creation will fail signature verification in middleware.");
    }

    const token = await signToken(user.id, wallet);

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username,
        tokenBalance: user.tokenBalance,
      },
    });

    const isProd = process.env.NODE_ENV === "production";
    const cookieOptions: any = {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    };

    // We no longer lock the domain to ".randi.chat" to allow the app 
    // to work across various Vercel deployments and custom domains 
    // without triggering the "double sign-in" bug caused by cookie domain mismatches.
    response.cookies.set("auth-token", token, cookieOptions);

    return response;
  } catch (error: any) {
    console.error("Critical error building server session:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      wallet
    });
    return NextResponse.json(
      {
        error: "Internal server error during session establishment",
        code: "session_creation_failed",
        detail: error.message
      },
      { status: 500 }
    );
  }
}
