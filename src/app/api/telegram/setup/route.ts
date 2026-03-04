import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth();

        const { token } = await req.json();
        if (!token) {
            return NextResponse.json({ error: "Token is required" }, { status: 400 });
        }

        // 1. Verify the token with Telegram
        const getMeUrl = `https://api.telegram.org/bot${token}/getMe`;
        const getMeRes = await fetch(getMeUrl);
        const getMeData = await getMeRes.json();

        if (!getMeData.ok) {
            return NextResponse.json({ error: "Invalid Telegram token" }, { status: 400 });
        }

        const botUsername = getMeData.result.username;

        // 2. Set the webhook - Use exact incoming request origin to avoid Telegram failing on Vercel 308 redirects
        const appUrl = req.nextUrl.origin;
        const webhookUrl = `${appUrl}/api/telegram/webhook?token=${token}`;

        const setWebhookUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
        const setWebhookRes = await fetch(setWebhookUrl);
        const setWebhookData = await setWebhookRes.json();

        if (!setWebhookData.ok) {
            console.error("Telegram setWebhook failed:", setWebhookData);
            return NextResponse.json({ error: `Failed to set Telegram webhook: ${setWebhookData.description || 'Unknown error'}` }, { status: 500 });
        }

        // 3. Save to database
        await prisma.user.update({
            where: { id: auth.userId },
            data: {
                telegramBotToken: token,
                telegramBotUsername: botUsername
            }
        });

        return NextResponse.json({ ok: true, botUsername });
    } catch (error) {
        return handleAuthError(error);
    }
}
