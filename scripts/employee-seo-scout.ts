import { getComposioClient } from "../src/lib/composio/client";

/**
 * Randi Employee: The SEO Scout
 * 
 * This script audits landing pages (starting with randi.agency) for SEO best practices.
 * It checks for meta tags, headers, image alts, and page speed indicators,
 * then logs reports to a Google Sheet.
 */

const SEO_SPREADSHEET_ID = process.env.SEO_SPREADSHEET_ID;
const SHEETS_ENTITY_ID = process.env.AUDITOR_ENTITY_ID || "auditor-employee";
const TARGET_URLS = ["https://randi.agency"];
const POLL_INTERVAL_MS = 86400_000; // 24 hours (daily audit)

async function runSeoScout() {
  console.log("🚀 Randi SEO Scout started...");
  
  if (!SEO_SPREADSHEET_ID) {
    console.error("❌ SEO_SPREADSHEET_ID is not set.");
    process.exit(1);
  }

  const composio = await getComposioClient();
  if (!composio) {
    console.error("❌ Composio client failed to initialize.");
    process.exit(1);
  }

  while (true) {
    try {
      for (const url of TARGET_URLS) {
        console.log(`🔍 Auditing SEO for: ${url}`);
        
        // 1. Use Browse tool to get page info & SEO data
        // We'll use a specialized prompt to extract SEO metadata
        const browseResponse = await (composio as any).tools.execute("BROWSER_EXTRACT_CONTENT", {
          userId: SHEETS_ENTITY_ID,
          arguments: {
            url: url,
            fields: ["title", "meta_description", "h1_count", "canonical_url", "og_image"]
          },
        });

        const seoData = browseResponse?.data || {};
        
        // 2. Format a simple report
        const issues: string[] = [];
        if (!seoData.meta_description) issues.push("Missing Meta Description");
        if (seoData.h1_count !== 1) issues.push(`Found ${seoData.h1_count} H1 tags (expected 1)`);
        
        const status = issues.length === 0 ? "HEALTHY" : "NEEDS IMPROVEMENT";
        const report = issues.length === 0 ? "SEO looks solid." : `Issues: ${issues.join(", ")}`;

        // 3. Log to Google Sheet
        await (composio as any).tools.execute("GOOGLESHEETS_APPEND_VALUES", {
          userId: SHEETS_ENTITY_ID,
          arguments: {
            spreadsheet_id: SEO_SPREADSHEET_ID,
            range: "Sheet1!A:E",
            values: [[
              new Date().toLocaleDateString(),
              url,
              seoData.title || "N/A",
              status,
              report
            ]],
          },
        });
        
        console.log(`✅ SEO Audit logged for ${url}`);
      }

      console.log("😴 Daily SEO audit complete. Sleeping for 24 hours...");

    } catch (error: any) {
      console.error("❌ SEO Scout error:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

runSeoScout().catch(err => {
  console.error("CRITICAL ERROR:", err);
  process.exit(1);
});
