import { Composio } from "@composio/core";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.error("No API key");
    return;
  }
  const client = new Composio({ apiKey });
  try {
    const toolkits = await client.toolkits.get({ limit: 5 });
    console.log("Toolkits type:", typeof toolkits);
    console.log("Is array:", Array.isArray(toolkits));
    console.log("Keys:", Object.keys(toolkits));
    if ((toolkits as any).items) {
       console.log("Found items array with length:", (toolkits as any).items.length);
    }
  } catch (e) {
    console.error(e);
  }
}

main();
