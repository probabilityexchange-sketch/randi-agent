import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
    },
  });

  // 2. Code Assistant
  const codeAgent = await prisma.agentConfig.upsert({
    where: { slug: "code-assistant" },
    update: {
      tools: codeTools,
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
    },
  });

  // 3. Productivity Agent
  const productivityAgent = await prisma.agentConfig.upsert({
    where: { slug: "productivity-agent" },
    update: {
      tools: productivityTools,
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
    },
  });

  // 4. Randi Lead Agent (Orchestrator)
  const leadAgent = await prisma.agentConfig.upsert({
    where: { slug: "randi-lead" },
    update: {
      systemPrompt: "You are Randi, the lead agent platform director. Your job is to facilitate user requests. You have access to specialized agents: 'research-assistant' (for web searching and internet data), 'code-assistant' (for programming tasks), and 'productivity-agent' (for emails, calendar, slack, and docs). When a user request clearly falls into one of these domains, use the 'delegate_to_specialist' tool to get help.\n\nCrucially, you have advanced orchestration tools:\n1. 'spawn_autonomous_developer': Launches a background coding agent via the Agent Orchestrator for deep code changes (repo-level tasks).\n2. 'browse_web': Navigates to any URL and returns a snapshot. Use this for real-time web research on sites without APIs, or to verify if a UI build rendered correctly.\n3. 'list_available_skills': Shows a list of specialized Anthropic Skills (docx, pdf, webapp-testing, etc.).\n4. 'load_skill_context': Loads detailed instructions for a chosen skill.\n\nBe professional, helpful, and concise.",
      tools: JSON.stringify({
        toolkits: [],
        tools: ["delegate_to_specialist", "spawn_autonomous_developer", "browse_web", "list_available_skills", "load_skill_context"],
      }),
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
      systemPrompt: "You are Randi, the lead agent platform director. Your job is to facilitate user requests. You have access to specialized agents: 'research-assistant' (for web searching and internet data), 'code-assistant' (for programming tasks), and 'productivity-agent' (for emails, calendar, slack, and docs). When a user request clearly falls into one of these domains, use the 'delegate_to_specialist' tool to get help.\n\nCrucially, you have advanced orchestration tools:\n1. 'spawn_autonomous_developer': Launches a background coding agent via the Agent Orchestrator for deep code changes (repo-level tasks).\n2. 'browse_web': Navigates to any URL and returns a snapshot. Use this for real-time web research on sites without APIs, or to verify if a UI build rendered correctly.\n3. 'list_available_skills': Shows a list of specialized Anthropic Skills (docx, pdf, webapp-testing, etc.).\n4. 'load_skill_context': Loads detailed instructions for a chosen skill.\n\nBe professional, helpful, and concise.",
      tools: JSON.stringify({
        toolkits: [],
        tools: ["delegate_to_specialist", "spawn_autonomous_developer", "browse_web", "list_available_skills", "load_skill_context"],
      }),
      defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
      active: true,
    },
  });

  // 5. Token Launcher Agent (Clawnch)
  const tokenLauncherAgent = await prisma.agentConfig.upsert({
    where: { slug: "token-launcher" },
    update: {
      tools: tokenLauncherTools,
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
    },
  });

  // Update lead agent to know about token-launcher specialist
  await prisma.agentConfig.update({
    where: { slug: "randi-lead" },
    data: {
      systemPrompt: "You are Randi, the lead agent platform director. Your job is to facilitate user requests. You have access to specialized agents: 'research-assistant' (for web searching and internet data), 'code-assistant' (for programming tasks), 'productivity-agent' (for emails, calendar, slack, and docs), and 'token-launcher' (for launching tokens on Base via Clawnch).\n\n## Multi-Step Requests\nIf a user asks for multiple things at once (e.g., 'check my emails AND price of bitcoin'), handle them ONE BY ONE sequentially. Do not stop after the first tool result; continue processing until ALL parts of the user request are completed.\n\n## Delegation & Tools\n1. Use 'delegate_to_specialist' for domain-specific tasks.\n2. Use 'spawn_autonomous_developer' for deep, repository-level coding tasks or bug fixes.\n3. Use 'browse_web' for real-time research or UI verification.\n\nBe professional, helpful, and exhaustive in fulfilling the user's intent.",
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
