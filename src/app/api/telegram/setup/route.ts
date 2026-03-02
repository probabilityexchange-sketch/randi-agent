import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

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

        // 2. Set the webhook
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.NEXT_PUBLIC_DOMAIN}`;
        const webhookUrl = `${appUrl}/api/telegram/webhook?token=${token}`;

        const setWebhookUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
        const setWebhookRes = await fetch(setWebhookUrl);
        const setWebhookData = await setWebhookRes.json();

        if (!setWebhookData.ok) {
            return NextResponse.json({ error: "Failed to set Telegram webhook" }, { status: 500 });
        }

        // 3. Save to database
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                telegramBotToken: token,
                telegramBotUsername: botUsername
            }
        });

        return NextResponse.json({ ok: true, botUsername });
    } catch (error) {
        console.error("[Telegram Setup] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
