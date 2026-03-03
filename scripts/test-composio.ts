import { Composio } from "@composio/core";

const c = new Composio({ apiKey: "ak_oSSj50fSHljUC5oUmS0N" });

async function main() {
    // List ALL connected accounts to see which entity IDs are being used
    try {
        const accounts = await c.connectedAccounts.list({ limit: 50 });
        console.log("=== ALL CONNECTED ACCOUNTS WITH ENTITY IDS ===");
        const entities = new Set<string>();
        for (const acct of accounts.items) {
            const entityId = (acct as any).entityId || (acct as any).entity_id || (acct as any).userId || "unknown";
            entities.add(entityId);
            if (acct.status === "ACTIVE") {
                console.log(`  [ACTIVE] ${acct.toolkit.slug} -> entity: ${entityId}`);
            }
        }
        console.log("\n=== UNIQUE ENTITY IDS ===");
        for (const e of entities) {
            console.log(`  - "${e}"`);
        }
    } catch (e: any) {
        console.error("Error:", e.message);
    }

    // Try with a fake user ID to see if tools come back empty
    const fakeUserId = "did:privy:test123";
    try {
        const tools = await c.tools.get(fakeUserId, { toolkits: ["gmail"], limit: 5 });
        console.log(`\n=== GMAIL TOOLS FOR "${fakeUserId}" ===`);
        console.log("Count:", Array.isArray(tools) ? tools.length : "not-array");
    } catch (e: any) {
        console.error(`Gmail tools for ${fakeUserId} error:`, e.message);
    }
}

main();
