/**
 * Skills Loader
 *
 * Implements the hybrid Option C skills system:
 *
 * - KNOWLEDGE skills: Markdown files read at runtime and injected into the
 *   agent's system prompt context window. The agent "knows" the skill.
 *
 * - ACTION skills: Registered as callable MCP/tool integrations in the chat
 *   route. The agent can actively invoke them (e.g., deploy a token, post a tweet).
 *
 * Skills are stored in /skills/<name>/SKILL.md relative to the project root.
 * Each AgentConfig can declare which skills it uses via its `tools` JSON config:
 *
 *   { "skills": ["clawnch", "react-expert", "supabase-expert"] }
 *
 * Action skills (those with MCP tool integrations) are listed in ACTION_SKILLS below.
 * All other skills are treated as knowledge skills and injected as system prompt context.
 */

import * as fs from "fs";
import * as path from "path";

// Skills that have callable MCP/tool integrations (action skills).
// These are NOT injected as text — they are registered as tools in the chat route.
export const ACTION_SKILLS = new Set(["clawnch"]);

// Skills that are purely knowledge-based (injected as system prompt context).
// All skills NOT in ACTION_SKILLS are treated as knowledge skills.
export const KNOWLEDGE_SKILLS = [
  "ai-agent-generation",
  "composio-dev",
  "vercel-expert",
  "supabase-expert",
  "react-expert",
  "openrouter-llm",
  "privy-auth",
  "ux-design",
  "connectors-available",
  "find-arbitrage-opps",
  "find-xemm-opps",
  "hummingbot",
  "hummingbot-deploy",
  "hummingbot-developer",
  "hummingbot-heartbeat",
  "lp-agent",
  "slides-generator",
  "polymarket",
];

const SKILLS_DIR = path.join(process.cwd(), "skills");

/**
 * Read a skill's SKILL.md file and return its content.
 * Returns null if the file doesn't exist or can't be read.
 */
export function readSkillFile(skillName: string): string | null {
  try {
    const skillPath = path.join(SKILLS_DIR, skillName, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      console.warn(`[skills] Skill file not found: ${skillPath}`);
      return null;
    }
    return fs.readFileSync(skillPath, "utf-8");
  } catch (err) {
    console.error(`[skills] Failed to read skill '${skillName}':`, err);
    return null;
  }
}

/**
 * Parse the skills list from an agent's tools JSON config.
 * Returns an empty array if no skills are configured.
 *
 * Agent tools config format:
 * {
 *   "toolkits": ["GITHUB", "SLACK"],
 *   "tools": ["delegate_to_specialist"],
 *   "skills": ["clawnch", "react-expert", "supabase-expert"]
 * }
 */
export function parseAgentSkills(toolsJson: string | null): string[] {
  if (!toolsJson) return [];
  try {
    const config = JSON.parse(toolsJson);
    if (!Array.isArray(config.skills)) return [];
    return config.skills.filter((s: unknown) => typeof s === "string");
  } catch {
    return [];
  }
}

/**
 * Build the knowledge skill injection block for an agent's system prompt.
 * Only includes skills that are NOT action skills (those are handled as tools).
 *
 * Returns a formatted string to append to the system prompt, or an empty
 * string if no knowledge skills are configured.
 */
export function buildSkillsContext(skillNames: string[]): string {
  const knowledgeSkills = skillNames.filter((s) => !ACTION_SKILLS.has(s));
  if (knowledgeSkills.length === 0) return "";

  const sections: string[] = [];

  for (const skillName of knowledgeSkills) {
    const content = readSkillFile(skillName);
    if (!content) continue;
    sections.push(
      `\n\n---\n## Skill: ${skillName}\n\n${content.trim()}`
    );
  }

  if (sections.length === 0) return "";

  return (
    `\n\n---\n# Available Skills\n\nYou have been equipped with the following expert skills. ` +
    `Use this knowledge to provide accurate, expert-level guidance in these domains:\n` +
    sections.join("")
  );
}

/**
 * Returns the list of action skill names configured for an agent.
 * These should be registered as MCP tools in the chat route.
 */
export function getActionSkills(skillNames: string[]): string[] {
  return skillNames.filter((s) => ACTION_SKILLS.has(s));
}
