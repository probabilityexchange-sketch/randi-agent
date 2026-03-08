// ---------------------------------------------------------------------------
// SUPPORTED COMPOSIO TOOLKITS
// This is the curated list of toolkits exposed to users in the Integrations
// page. Each toolkit gets a category, icon emoji, and description for the UI.
// The envKey is an optional override to bypass the Composio auth-config lookup.
// ---------------------------------------------------------------------------

export type ComposioCategory =
  | "Productivity"
  | "Code & Dev"
  | "Communication"
  | "Data & Analytics"
  | "Finance"
  | "AI & Automation"
  | "CRM & Sales"
  | "Cloud & Infra";

export interface ComposioToolkitDef {
  slug: string;
  label: string;
  category: ComposioCategory;
  icon: string; // emoji
  description: string;
  envKey: string;
  capabilities?: string[];
  suggestedPrompt?: string;
}

export const SUPPORTED_COMPOSIO_TOOLKITS: readonly ComposioToolkitDef[] = [
  // ── Productivity ──────────────────────────────────────────────────────────
  {
    slug: "googlecalendar",
    label: "Google Calendar",
    category: "Productivity",
    icon: "📅",
    description: "Create events, schedule meetings, and manage availability.",
    envKey: "COMPOSIO_AUTH_CONFIG_GOOGLECALENDAR",
    capabilities: ["Plan your day", "Review upcoming events", "Schedule meetings"],
    suggestedPrompt: "Plan my day from Google Calendar.",
  },
  {
    slug: "googlesheets",
    label: "Google Sheets",
    category: "Productivity",
    icon: "📊",
    description: "Read and write spreadsheet data, run calculations.",
    envKey: "COMPOSIO_AUTH_CONFIG_GOOGLESHEETS",
    capabilities: ["Update tracking sheets", "Summarize structured data", "Read spreadsheet rows"],
    suggestedPrompt: "Summarize this sheet and highlight what matters.",
  },
  {
    slug: "googledocs",
    label: "Google Docs",
    category: "Productivity",
    icon: "📝",
    description: "Create, read, and edit Google Docs documents.",
    envKey: "COMPOSIO_AUTH_CONFIG_GOOGLEDOCS",
    capabilities: ["Create new documents", "Read document content", "Append notes to docs"],
    suggestedPrompt: "Create a new document with these meeting notes.",
  },
  {
    slug: "googledrive",
    label: "Google Drive",
    category: "Productivity",
    icon: "💾",
    description: "List, upload, download, and manage Drive files.",
    envKey: "COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE",
    capabilities: ["Search for files", "Upload and download documents", "Manage file permissions"],
    suggestedPrompt: "Find the latest PDF in my Drive and summarize it.",
  },
  {
    slug: "notion",
    label: "Notion",
    category: "Productivity",
    icon: "📒",
    description: "Create pages, update databases, and search workspaces.",
    envKey: "COMPOSIO_AUTH_CONFIG_NOTION",
    capabilities: ["Turn notes into docs", "Update knowledge bases", "Search workspaces"],
    suggestedPrompt: "Turn these notes into a cleaner brief in Notion.",
  },
  {
    slug: "airtable",
    label: "Airtable",
    category: "Productivity",
    icon: "🗃️",
    description: "Query and update Airtable bases and records.",
    envKey: "COMPOSIO_AUTH_CONFIG_AIRTABLE",
    capabilities: ["Search database records", "Update rows and statuses", "List bases and tables"],
    suggestedPrompt: "Update the status of my 'Active Tasks' in Airtable.",
  },
  {
    slug: "asana",
    label: "Asana",
    category: "Productivity",
    icon: "✅",
    description: "Manage tasks, projects, and team workflows.",
    envKey: "COMPOSIO_AUTH_CONFIG_ASANA",
    capabilities: ["Create and assign tasks", "Update project progress", "List workspace tasks"],
    suggestedPrompt: "Create a new task in Asana for 'Review PR #123'.",
  },
  {
    slug: "trello",
    label: "Trello",
    category: "Productivity",
    icon: "📋",
    description: "Create cards, move tasks across boards and lists.",
    envKey: "COMPOSIO_AUTH_CONFIG_TRELLO",
    capabilities: ["Create Trello cards", "Move cards between lists", "Search boards"],
    suggestedPrompt: "Add a new card to the 'To Do' list in Trello.",
  },
  {
    slug: "todoist",
    label: "Todoist",
    category: "Productivity",
    icon: "☑️",
    description: "Add and manage tasks and projects in Todoist.",
    envKey: "COMPOSIO_AUTH_CONFIG_TODOIST",
    capabilities: ["Add new tasks", "Complete tasks", "List daily tasks"],
    suggestedPrompt: "Add 'Buy groceries' to my Todoist inbox.",
  },
  {
    slug: "clickup",
    label: "ClickUp",
    category: "Productivity",
    icon: "🎯",
    description: "Create tasks, update statuses, and manage workspaces.",
    envKey: "COMPOSIO_AUTH_CONFIG_CLICKUP",
    capabilities: ["Create tasks and subtasks", "Update statuses", "Manage lists"],
    suggestedPrompt: "Create a new ClickUp task for the project update.",
  },
  {
    slug: "linear",
    label: "Linear",
    category: "Productivity",
    icon: "🔷",
    description: "Manage issues, cycles, and projects in Linear.",
    envKey: "COMPOSIO_AUTH_CONFIG_LINEAR",
    capabilities: ["Create issues", "Assign issues", "List active cycles"],
    suggestedPrompt: "Create a new Linear issue for the bug I found.",
  },

  // ── Code & Dev ────────────────────────────────────────────────────────────
  {
    slug: "github",
    label: "GitHub",
    category: "Code & Dev",
    icon: "🐙",
    description: "Create PRs, manage issues, push code, and search repos.",
    envKey: "COMPOSIO_AUTH_CONFIG_GITHUB",
    capabilities: ["Review issues and PRs", "Summarize repo work", "Search code"],
    suggestedPrompt: "Review this GitHub issue and suggest the next step.",
  },
  {
    slug: "gitlab",
    label: "GitLab",
    category: "Code & Dev",
    icon: "🦊",
    description: "Manage merge requests, issues, and CI/CD pipelines.",
    envKey: "COMPOSIO_AUTH_CONFIG_GITLAB",
    capabilities: ["Manage merge requests", "Track CI/CD status", "Search projects"],
    suggestedPrompt: "List my open merge requests in GitLab.",
  },
  {
    slug: "jira",
    label: "Jira",
    category: "Code & Dev",
    icon: "🔵",
    description: "Create and update issues, sprints, and epics.",
    envKey: "COMPOSIO_AUTH_CONFIG_JIRA",
    capabilities: ["Create Jira issues", "Update sprint status", "Search epics"],
    suggestedPrompt: "Create a new Jira issue for the feature request.",
  },
  {
    slug: "vercel",
    label: "Vercel",
    category: "Code & Dev",
    icon: "▲",
    description: "Deploy projects, inspect builds, and manage domains.",
    envKey: "COMPOSIO_AUTH_CONFIG_VERCEL",
    capabilities: ["Review deployments", "Track project status", "Inspect builds"],
    suggestedPrompt: "Check the latest deployment status on Vercel.",
  },
  {
    slug: "supabase",
    label: "Supabase",
    category: "Code & Dev",
    icon: "⚡",
    description: "Query databases, manage auth, and trigger Edge Functions.",
    envKey: "COMPOSIO_AUTH_CONFIG_SUPABASE",
    capabilities: ["Inspect project data", "Support database workflows", "Manage auth"],
    suggestedPrompt: "Query the 'users' table in my Supabase project.",
  },
  {
    slug: "figma",
    label: "Figma",
    category: "Code & Dev",
    icon: "🎨",
    description: "Access files, components, and comments in Figma.",
    envKey: "COMPOSIO_AUTH_CONFIG_FIGMA",
    capabilities: ["Read file comments", "Access file components", "List files"],
    suggestedPrompt: "List the latest comments in my Figma file.",
  },
  {
    slug: "sentry",
    label: "Sentry",
    category: "Code & Dev",
    icon: "🔍",
    description: "Search errors, manage issues, and track releases.",
    envKey: "COMPOSIO_AUTH_CONFIG_SENTRY",
    capabilities: ["Search errors", "Manage issues", "Track releases"],
    suggestedPrompt: "Find the latest unresolved errors in Sentry.",
  },

  // ── Communication ─────────────────────────────────────────────────────────
  {
    slug: "gmail",
    label: "Gmail",
    category: "Communication",
    icon: "📬",
    description: "Read, send, and manage Gmail messages and labels.",
    envKey: "COMPOSIO_AUTH_CONFIG_GMAIL",
    capabilities: ["Draft and review email replies", "Search inbox context", "Send messages"],
    suggestedPrompt: "Draft a reply to my latest email using these notes.",
  },
  {
    slug: "slack",
    label: "Slack",
    category: "Communication",
    icon: "💬",
    description: "Post messages, search channels, and manage workspace.",
    envKey: "COMPOSIO_AUTH_CONFIG_SLACK",
    capabilities: ["Prepare team updates", "Read channel context", "Post messages"],
    suggestedPrompt: "Write a short Slack update for the team.",
  },
  {
    slug: "discord",
    label: "Discord",
    category: "Communication",
    icon: "🎮",
    description: "Send messages, manage channels, and read server activity.",
    envKey: "COMPOSIO_AUTH_CONFIG_DISCORD",
    capabilities: ["Send channel messages", "List server activity", "Manage channels"],
    suggestedPrompt: "Send a message to the #general channel in Discord.",
  },
  {
    slug: "telegram",
    label: "Telegram",
    category: "Communication",
    icon: "✈️",
    description: "Send and receive Telegram messages through the Bot API.",
    envKey: "COMPOSIO_AUTH_CONFIG_TELEGRAM",
    capabilities: ["Draft and send short updates", "Monitor message context", "Send messages"],
    suggestedPrompt: "Draft a short Telegram update I can send.",
  },
  {
    slug: "youtube",
    label: "YouTube",
    category: "Communication",
    icon: "📺",
    description: "Search videos, list channel activity, and manage playlists.",
    envKey: "COMPOSIO_AUTH_CONFIG_YOUTUBE",
    capabilities: ["Search videos", "List channel activity", "Manage playlists"],
    suggestedPrompt: "Search for the latest AI tutorial on YouTube.",
  },
  {
    slug: "googlemeet",
    label: "Google Meet",
    category: "Communication",
    icon: "📹",
    description: "Schedule and manage Google Meet video calls.",
    envKey: "COMPOSIO_AUTH_CONFIG_GOOGLEMEET",
    capabilities: ["Schedule video calls", "Manage meeting links", "List meetings"],
    suggestedPrompt: "Schedule a Google Meet for 2 PM tomorrow.",
  },
  {
    slug: "zoom",
    label: "Zoom",
    category: "Communication",
    icon: "🎥",
    description: "Schedule meetings, list recordings, and manage webinars.",
    envKey: "COMPOSIO_AUTH_CONFIG_ZOOM",
    capabilities: ["Schedule meetings", "List recordings", "Manage webinars"],
    suggestedPrompt: "List my upcoming Zoom meetings.",
  },
  {
    slug: "twilio",
    label: "Twilio",
    category: "Communication",
    icon: "📱",
    description: "Send SMS, WhatsApp messages, and make voice calls.",
    envKey: "COMPOSIO_AUTH_CONFIG_TWILIO",
    capabilities: ["Send SMS messages", "Make voice calls", "WhatsApp messaging"],
    suggestedPrompt: "Send an SMS message using Twilio.",
  },
  {
    slug: "intercom",
    label: "Intercom",
    category: "Communication",
    icon: "💭",
    description: "Manage customer conversations and support tickets.",
    envKey: "COMPOSIO_AUTH_CONFIG_INTERCOM",
    capabilities: ["Manage conversations", "Support tickets", "List users"],
    suggestedPrompt: "List the latest active conversations in Intercom.",
  },

  // ── Data & Analytics ──────────────────────────────────────────────────────
  {
    slug: "hackernews",
    label: "Hacker News",
    category: "Data & Analytics",
    icon: "🧡",
    description: "Search and retrieve top stories from Hacker News.",
    envKey: "COMPOSIO_AUTH_CONFIG_HACKERNEWS",
    capabilities: ["Search top stories", "Retrieve story details", "Browse user activity"],
    suggestedPrompt: "What are the top stories on Hacker News right now?",
  },
  {
    slug: "reddit",
    label: "Reddit",
    category: "Data & Analytics",
    icon: "👾",
    description: "Browse subreddits, search posts, and read comments.",
    envKey: "COMPOSIO_AUTH_CONFIG_REDDIT",
    capabilities: ["Browse subreddits", "Search posts", "Read comments"],
    suggestedPrompt: "Find the latest popular posts in r/openai.",
  },
  {
    slug: "googlesearch",
    label: "Google Search",
    category: "Data & Analytics",
    icon: "🔎",
    description: "Perform real-time web searches via Google.",
    envKey: "COMPOSIO_AUTH_CONFIG_GOOGLESEARCH",
    capabilities: ["Real-time web search", "Retrieve search results", "Market research"],
    suggestedPrompt: "Search for the latest news on agentic frameworks.",
  },
  {
    slug: "serpapi",
    label: "SerpAPI",
    category: "Data & Analytics",
    icon: "🌐",
    description: "Query search engine results pages with structured output.",
    envKey: "COMPOSIO_AUTH_CONFIG_SERPAPI",
    capabilities: ["Structured search results", "Query search engines", "SEO analysis"],
    suggestedPrompt: "Use SerpAPI to search for 'best AI tools 2024'.",
  },
  {
    slug: "googleanalytics",
    label: "Google Analytics",
    category: "Data & Analytics",
    icon: "📈",
    description: "Pull site traffic, Events, and conversion reports.",
    envKey: "COMPOSIO_AUTH_CONFIG_GOOGLEANALYTICS",
    capabilities: ["Pull traffic reports", "Track events", "Conversion analysis"],
    suggestedPrompt: "Pull the last 7 days of traffic from Google Analytics.",
  },
  {
    slug: "openweather",
    label: "OpenWeather",
    category: "Data & Analytics",
    icon: "🌤️",
    description: "Real-time weather data, forecasts, and historical charts.",
    envKey: "COMPOSIO_AUTH_CONFIG_OPENWEATHER",
    capabilities: ["Real-time weather data", "Weather forecasts", "Historical charts"],
    suggestedPrompt: "What is the weather forecast for San Francisco?",
  },
  {
    slug: "firecrawl",
    label: "Firecrawl",
    category: "Data & Analytics",
    icon: "🕷️",
    description: "Crawl websites and convert them into LLM-ready markdown.",
    envKey: "COMPOSIO_AUTH_CONFIG_FIRECRAWL",
    capabilities: ["Gather web context", "Extract source material", "Website crawling"],
    suggestedPrompt: "Research this topic and summarize the best sources via Firecrawl.",
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    slug: "coinmarketcap",
    label: "CoinMarketCap",
    category: "Finance",
    icon: "💰",
    description: "Fetch cryptocurrency prices, market caps, and rankings.",
    envKey: "COMPOSIO_AUTH_CONFIG_COINMARKETCAP",
    capabilities: ["Fetch crypto prices", "Market cap rankings", "Key info"],
    suggestedPrompt: "Get the current price of Bitcoin from CoinMarketCap.",
  },
  {
    slug: "stripe",
    label: "Stripe",
    category: "Finance",
    icon: "💳",
    description: "Manage customers, payments, subscriptions, and invoices.",
    envKey: "COMPOSIO_AUTH_CONFIG_STRIPE",
    capabilities: ["Manage customers", "List payments", "Track subscriptions"],
    suggestedPrompt: "List the latest payments in my Stripe account.",
  },
  {
    slug: "brex",
    label: "Brex",
    category: "Finance",
    icon: "🏦",
    description: "Manage company cards, expenses, and budgets.",
    envKey: "COMPOSIO_AUTH_CONFIG_BREX",
    capabilities: ["Manage cards", "Track expenses", "Budget management"],
    suggestedPrompt: "List the latest expenses in Brex.",
  },
  {
    slug: "quickbooks",
    label: "QuickBooks",
    category: "Finance",
    icon: "📉",
    description: "Access accounting data, invoices, and expense reports.",
    envKey: "COMPOSIO_AUTH_CONFIG_QUICKBOOKS",
    capabilities: ["Access accounting data", "Invoices and reports", "Expense tracking"],
    suggestedPrompt: "Summarize my invoices for the last month in QuickBooks.",
  },

  // ── AI & Automation ───────────────────────────────────────────────────────
  {
    slug: "zapier",
    label: "Zapier",
    category: "AI & Automation",
    icon: "⚡",
    description: "Trigger Zaps and automate cross-app workflows.",
    envKey: "COMPOSIO_AUTH_CONFIG_ZAPIER",
    capabilities: ["Trigger Zaps", "Automate workflows", "Cross-app actions"],
    suggestedPrompt: "Trigger my 'New Lead' Zap in Zapier.",
  },
  {
    slug: "prompmate",
    label: "Prompmate",
    category: "AI & Automation",
    icon: "🤖",
    description: "Access and run curated AI prompt templates.",
    envKey: "COMPOSIO_AUTH_CONFIG_PROMPMATE",
    capabilities: ["Run AI templates", "Access curated prompts", "Prompt automation"],
    suggestedPrompt: "Run the 'Social Media Post' template in Prompmate.",
  },
  {
    slug: "make",
    label: "Make (Integromat)",
    category: "AI & Automation",
    icon: "🔗",
    description: "Trigger scenarios and automate Make.com workflows.",
    envKey: "COMPOSIO_AUTH_CONFIG_MAKE",
    capabilities: ["Trigger scenarios", "Automate workflows", "Workflow management"],
    suggestedPrompt: "Trigger my 'Data Sync' scenario in Make.",
  },

  // ── CRM & Sales ───────────────────────────────────────────────────────────
  {
    slug: "hubspot",
    label: "HubSpot",
    category: "CRM & Sales",
    icon: "🧲",
    description: "Manage contacts, deals, companies, and emails.",
    envKey: "COMPOSIO_AUTH_CONFIG_HUBSPOT",
    capabilities: ["Manage contacts", "Track deals", "Company management"],
    suggestedPrompt: "List my open deals in HubSpot.",
  },
  {
    slug: "salesforce",
    label: "Salesforce",
    category: "CRM & Sales",
    icon: "☁️",
    description: "Query and update Salesforce objects, leads, and cases.",
    envKey: "COMPOSIO_AUTH_CONFIG_SALESFORCE",
    capabilities: ["Query objects", "Manage leads", "Case management"],
    suggestedPrompt: "Find all leads created this week in Salesforce.",
  },
  {
    slug: "pipedrive",
    label: "Pipedrive",
    category: "CRM & Sales",
    icon: "📊",
    description: "Manage deals, contacts, and activities in Pipedrive.",
    envKey: "COMPOSIO_AUTH_CONFIG_PIPEDRIVE",
    capabilities: ["Manage deals", "Track activities", "Contact management"],
    suggestedPrompt: "List the active deals in Pipedrive.",
  },
  {
    slug: "calendly",
    label: "Calendly",
    category: "CRM & Sales",
    icon: "🗓️",
    description: "Schedule meetings and manage booking availability.",
    envKey: "COMPOSIO_AUTH_CONFIG_CALENDLY",
    capabilities: ["Schedule meetings", "Manage availability", "List events"],
    suggestedPrompt: "List my scheduled events from Calendly.",
  },

  // ── Cloud & Infra ─────────────────────────────────────────────────────────
  {
    slug: "aws",
    label: "AWS",
    category: "Cloud & Infra",
    icon: "☁️",
    description: "Manage EC2, S3, Lambda, and other AWS services.",
    envKey: "COMPOSIO_AUTH_CONFIG_AWS",
    capabilities: ["Manage EC2 instances", "S3 bucket operations", "Lambda management"],
    suggestedPrompt: "List my running EC2 instances in AWS.",
  },
  {
    slug: "dropbox",
    label: "Dropbox",
    category: "Cloud & Infra",
    icon: "📦",
    description: "Upload, download, and manage Dropbox files.",
    envKey: "COMPOSIO_AUTH_CONFIG_DROPBOX",
    capabilities: ["Upload files", "Download files", "Manage storage"],
    suggestedPrompt: "Search for 'Project Plan' in Dropbox.",
  },
] as const;

// De-duplicate by slug (in case of any accidental duplicates)
export const COMPOSIO_TOOLKITS_DEDUPED = (() => {
  const seenSlugs = new Set<string>();
  return SUPPORTED_COMPOSIO_TOOLKITS.filter((t) => {
    if (seenSlugs.has(t.slug)) return false;
    seenSlugs.add(t.slug);
    return true;
  });
})();

export const COMPOSIO_CATEGORIES: readonly ComposioCategory[] = [
  "Productivity",
  "Code & Dev",
  "Communication",
  "Data & Analytics",
  "Finance",
  "AI & Automation",
  "CRM & Sales",
  "Cloud & Infra",
];

export type ComposioToolkitSlug = (typeof SUPPORTED_COMPOSIO_TOOLKITS)[number]["slug"];

export function isComposioToolkitSlug(value: string): value is ComposioToolkitSlug {
  return COMPOSIO_TOOLKITS_DEDUPED.some((toolkit) => toolkit.slug === value);
}

export function getComposioToolkitMeta(slug: string) {
  return COMPOSIO_TOOLKITS_DEDUPED.find((toolkit) => toolkit.slug === slug) ?? null;
}

function normalizeEnvValue(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^['"]|['"]$/g, "");
  return normalized.length > 0 ? normalized : null;
}

export function getComposioAuthConfigOverride(toolkitSlug: string): string | null {
  const toolkit = getComposioToolkitMeta(toolkitSlug);
  if (!toolkit) return null;
  return normalizeEnvValue(process.env[toolkit.envKey]);
}

export function getComposioSharedEntityOverride(): string | null {
  return normalizeEnvValue(process.env.COMPOSIO_ENTITY_ID);
}
