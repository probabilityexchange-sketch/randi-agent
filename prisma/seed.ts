import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString =
  process.env.DIRECT_URL?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_PRISMA_URL?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  "";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  // 0. Ensure a System User exists to own the default agents
  const systemUser = await prisma.user.upsert({
    where: { id: "system-user" },
    update: {},
    create: {
      id: "system-user",
      username: "system",
      tier: "PRO",
    },
  });

  const researchTools = JSON.stringify({
    toolkits: ["hackernews", "coinmarketcap"],
    tools: [],
  });

  const codeTools = JSON.stringify({
    toolkits: ["github"],
    tools: [],
    skills: ["react-expert", "supabase-expert", "vercel-expert", "ai-agent-generation"],
  });

  const tokenLauncherTools = JSON.stringify({
    toolkits: [],
    tools: [],
    skills: ["clawnch"],
  });

  const productivityTools = JSON.stringify({
    toolkits: ["googlecalendar", "slack", "notion", "gmail", "prompmate"],
    tools: [],
  });

  // 1. Research Assistant
  const researchAgent = await prisma.agentConfig.upsert({
    where: { slug: "research-assistant" },
    update: {
      systemPrompt: "You are an expert research assistant. Use search tools and the 'browse_web' tool to find the most up-to-date and accurate information. The 'browse_web' tool allows you to see the literal content of any webpage, which is useful for sites without APIs or deep research. Always cite your sources.",
      tools: JSON.stringify({
        toolkits: ["hackernews", "coinmarketcap"],
        tools: ["browse_web"],
      }),
      ownerId: systemUser.id,
    },
    create: {
      slug: "research-assistant",
      name: "Research Assistant",
      description: "Specializes in web search, content summarization, and deep research across the internet using real-time data.",
      image: "randi/research-assistant",
      internalPort: 80,
      tokensPerHour: 0,
      memoryLimit: BigInt(0),
      cpuLimit: BigInt(0),
      systemPrompt: "You are an expert research assistant. Use search tools and the 'browse_web' tool to find the most up-to-date and accurate information. The 'browse_web' tool allows you to see the literal content of any webpage, which is useful for sites without APIs or deep research. Always cite your sources.",
      tools: JSON.stringify({
        toolkits: ["hackernews", "coinmarketcap"],
        tools: ["browse_web"],
      }),
      defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
      active: true,
      ownerId: systemUser.id,
    },
  });

  // 2. Code Assistant
  const codeAgent = await prisma.agentConfig.upsert({
    where: { slug: "code-assistant" },
    update: {
      tools: codeTools,
      ownerId: systemUser.id,
    },
    create: {
      slug: "code-assistant",
      name: "Code Assistant",
      description: "Your expert pair programmer. Can write, debug, and explain code across multiple languages with GitHub integration.",
      image: "randi/code-assistant",
      internalPort: 80,
      tokensPerHour: 0,
      memoryLimit: BigInt(0),
      cpuLimit: BigInt(0),
      systemPrompt: "You are an expert software engineer. Provide clean, efficient, and well-documented code. Use code interpreter for verification when needed.",
      tools: codeTools,
      defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
      active: true,
      ownerId: systemUser.id,
    },
  });

  // 3. Productivity Agent (kept for backward compatibility)
  const productivityAgent = await prisma.agentConfig.upsert({
    where: { slug: "productivity-agent" },
    update: {
      tools: productivityTools,
      ownerId: systemUser.id,
    },
    create: {
      slug: "productivity-agent",
      name: "Productivity Agent",
      description: "Connects to your tools like Google Calendar, Slack, and Notion to manage your schedule and communicate efficiently.",
      image: "randi/productivity-agent",
      internalPort: 80,
      tokensPerHour: 0,
      memoryLimit: BigInt(0),
      cpuLimit: BigInt(0),
      systemPrompt: "You are a highly efficient productivity assistant. Help the user manage their time and communications professionally.",
      tools: productivityTools,
      defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
      active: true,
      ownerId: systemUser.id,
    },
  });

  // 4. Randi Lead Agent — has ALL Composio tools directly
  const leadSystemPrompt = [
    "You are Randi, the lead AI assistant on randi.chat. You handle user requests DIRECTLY using your own tools.",
    "",
    "## Your Direct Capabilities",
    "You have Gmail, Google Calendar, Slack, Notion, GitHub, HackerNews, CoinMarketCap, and web browsing tools built in.",
    "When a user asks you to check emails, look at their calendar, search the web, or check crypto prices — DO IT YOURSELF using your tools.",
    "Do NOT say you can't do something or that it's not configured. Just use your tools.",
    "",
    "## When to Delegate",
    "Only use 'delegate_to_specialist' for tasks requiring a different agent's deep expertise:",
    "- 'code-assistant': Complex programming with GitHub repo integration",
    "- 'token-launcher': Launching tokens on Base via Clawnch",
    "When you delegate, provide a bounded taskSummary, the exact subQuery, expectedOutput, scopeNotes, and completionCriteria.",
    "Delegate only a narrow subtask the specialist can complete truthfully, then merge the structured result without overstating it.",
    "",
    "## Multi-Step Requests",
    "If a user asks for multiple things (e.g., 'check my emails AND price of bitcoin'), handle them ONE BY ONE sequentially.",
    "Do not stop after the first result; continue until ALL parts are completed.",
    "",
    "## Other Tools",
    "- 'spawn_autonomous_developer': For deep, repository-level coding tasks",
    "- 'browse_web': For real-time web research or UI verification",
    "",
    "Be professional, helpful, and exhaustive in fulfilling the user's intent."
  ].join("\n");

  const leadTools = JSON.stringify({
    toolkits: ["googlecalendar", "slack", "notion", "gmail", "prompmate", "hackernews", "coinmarketcap", "github", "telegram"],
    tools: ["delegate_to_specialist", "spawn_autonomous_developer", "browse_web", "list_available_skills", "load_skill_context"],
  });

  const leadAgent = await prisma.agentConfig.upsert({
    where: { slug: "randi-lead" },
    update: {
      systemPrompt: leadSystemPrompt,
      tools: leadTools,
      ownerId: systemUser.id,
    },
    create: {
      slug: "randi-lead",
      name: "Randi (Lead)",
      description: "The primary orchestrator of the Randi platform. Can handle general queries and delegate specialized tasks to expert agents.",
      image: "randi/lead-agent",
      internalPort: 80,
      tokensPerHour: 0,
      memoryLimit: BigInt(0),
      cpuLimit: BigInt(0),
      systemPrompt: leadSystemPrompt,
      tools: leadTools,
      defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
      active: true,
      ownerId: systemUser.id,
    },
  });

  // 5. Token Launcher Agent (Clawnch)
  const tokenLauncherAgent = await prisma.agentConfig.upsert({
    where: { slug: "token-launcher" },
    update: {
      tools: tokenLauncherTools,
      ownerId: systemUser.id,
    },
    create: {
      slug: "token-launcher",
      name: "Token Launcher",
      description: "Launch ERC-20 tokens on Base via Clawnch, find collaborators through Molten agent matching, and manage your token's social presence.",
      image: "randi/token-launcher",
      internalPort: 80,
      tokensPerHour: 0,
      memoryLimit: BigInt(0),
      cpuLimit: BigInt(0),
      systemPrompt: "You are an expert token launch specialist powered by Clawnch, the leading token deployment protocol on Base.\n\nYou help users:\n1. **Launch tokens on Base** — Guide them through naming, symbol, description, logo, and wallet setup. Validate their launch parameters before posting.\n2. **Find collaborators via Molten** — Register on the Molten agent-to-agent matching network and find marketing partners, liquidity providers, community managers, and dev services.\n3. **Manage token presence** — Help craft launch announcements, social posts, and community messaging.\n\n## How Token Launches Work\nTokens are launched by posting a `!clawnch` formatted message to a supported platform (Moltbook, moltx.io, or 4claw.org). The scanner picks it up within 60 seconds and deploys the ERC-20 on Base automatically.\n\n## Your Workflow\n1. Ask the user for: token name, symbol, description, logo image URL, and their Base wallet address\n2. Use `clawnch_validate_launch` to validate the parameters\n3. Use `clawnch_check_rate_limit` to confirm the wallet hasn't launched in the last 24 hours\n4. Generate the formatted `!clawnch` post content for the user to copy and post\n5. Optionally register on Molten and create intents for marketing/liquidity if the user wants collaborators\n\nAlways validate before generating the launch post. Be encouraging but honest about the speculative nature of token launches.",
      tools: tokenLauncherTools,
      defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
      active: true,
      ownerId: systemUser.id,
    },
  });

  console.log("Seeded agents:", { researchAgent, codeAgent, productivityAgent, leadAgent, tokenLauncherAgent });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
