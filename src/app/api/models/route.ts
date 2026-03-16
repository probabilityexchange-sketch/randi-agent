import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export async function GET(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for") ?? "anon";
    const { allowed } = await checkRateLimit(`models:${ip}`, RATE_LIMITS.general);
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const kiloKey = process.env.KILO_API_KEY;
        const openRouterKey = process.env.OPENROUTER_API_KEY;
        const apiKey = kiloKey || openRouterKey;

        if (!apiKey) {
            return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
        }

        const baseUrl = kiloKey ? "https://api.kilo.ai/api/gateway/models" : "https://openrouter.ai/api/v1/models";

        const response = await fetch(baseUrl, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
            next: { revalidate: 3600 } // Cache for an hour
        });

        if (!response.ok) {
            console.error(`[Models] Fetch failed: ${response.status} from ${baseUrl}`);
            throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[Models] Received data from ${kiloKey ? "Kilo" : "OpenRouter"}. Object type: ${data.object}, Items: ${data.data?.length}`);

        // Resilient parsing for different gateway response formats
        let models: any[] = [];
        if (data && Array.isArray(data.data)) {
            models = data.data;
        } else if (data && Array.isArray(data.models)) {
            models = data.models;
        } else if (data && Array.isArray(data)) {
            models = data;
        } else if (data && typeof data === "object") {
            // Some gateways return a single "data" property that isn't a list but contains one
            const possibleLists = Object.values(data).filter(v => Array.isArray(v)) as any[][];
            if (possibleLists.length > 0) {
                models = possibleLists[0];
            }
        }

        console.log(`[Models] Parsed ${models.length} models for client`);

        // Sort: Free models first, then alphabetical
        const sortedModels = models.sort((a: any, b: any) => {
            const aFree = a.id.includes(":free");
            const bFree = b.id.includes(":free");
            if (aFree && !bFree) return -1;
            if (!aFree && bFree) return 1;
            return a.id.localeCompare(b.id);
        });

        return NextResponse.json({ models: sortedModels });
    } catch (error) {
        console.error("Error fetching models:", error);
        return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
    }
}
