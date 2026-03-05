import { Composio } from "@composio/core";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) {
        console.error("Missing COMPOSIO_API_KEY");
        return;
    }

    const composio = new Composio({ apiKey });
    try {
        const toolkits = await (composio.toolkits as any).get({ limit: 1000 });
        console.log("Total toolkits found:", toolkits.length);

        const youtubeToolkits = toolkits.filter((t: any) =>
            t.slug.toLowerCase().includes("youtube") ||
            t.name.toLowerCase().includes("youtube")
        );

        console.log("YouTube-related toolkits:");
        youtubeToolkits.forEach((t: any) => {
            console.log(`- Slug: ${t.slug}, Name: ${t.name}, Is App: ${t.isApp}`);
        });

    } catch (error) {
        console.error("Error fetching toolkits:", error);
    }
}

main();
