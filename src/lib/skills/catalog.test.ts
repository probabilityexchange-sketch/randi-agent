import { describe, it, expect } from "vitest";
import { loadSkillBySlug, loadSkillCatalog } from "./catalog";

it("loadSkillCatalog merges all repo skill roots and dedupes repeated slugs", async () => {
    const catalog = await loadSkillCatalog();
    const slugs = catalog.map(skill => skill.slug);

    expect(slugs.includes("privy-auth")).toBeTruthy();
    expect(slugs.includes("agentic-gateway")).toBeTruthy();
    expect(slugs.includes("mcp-builder")).toBeTruthy();
    expect(slugs.filter(slug => slug === "hummingbot").length).toBe(1);
});

it("loadSkillBySlug resolves non-primary sources and parses frontmatter safely", async () => {
    const agentSkill = await loadSkillBySlug("agentic-gateway");
    const importedSkill = await loadSkillBySlug("mcp-builder");

    expect(agentSkill).toBeTruthy();
    expect(agentSkill?.source).toBe("Agent");
    expect(agentSkill?.description ?? "").toMatch(/Alchemy APIs/i);

    expect(importedSkill).toBeTruthy();
    expect(importedSkill?.source).toBe("Imported");
    expect(importedSkill?.description ?? "").toMatch(/MCP/i);
});
