import fs from "fs/promises";
import path from "path";
import Link from "next/link";

type SkillMode = "Action" | "Knowledge";

interface SkillSummary {
    slug: string;
    name: string;
    description: string;
    category: string;
    mode: SkillMode;
    hasDoc: boolean;
}

const DEFAULT_DESCRIPTION = "Reusable capability that extends how the agent reasons and executes tasks.";

function formatSkillName(slug: string): string {
    return slug
        .replace(/[-_]/g, " ")
        .split(" ")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function clampDescription(description: string, maxLength = 150): string {
    const normalized = description.trim().replace(/\s+/g, " ");
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function parseFrontmatter(rawContent: string): { body: string; frontmatter: Record<string, string> } {
    const lines = rawContent.split(/\r?\n/);
    if (lines[0]?.trim() !== "---") {
        return { body: rawContent, frontmatter: {} };
    }

    const frontmatter: Record<string, string> = {};
    let index = 1;

    while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === "---") {
            index += 1;
            break;
        }

        const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
        if (match) {
            const [, key, value] = match;
            frontmatter[key] = value.trim().replace(/^['"]|['"]$/g, "");
        }
        index += 1;
    }

    return { body: lines.slice(index).join("\n"), frontmatter };
}

function extractDescription(markdown: string): string {
    const lines = markdown.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    for (const line of lines) {
        if (
            line.startsWith("#") ||
            line.startsWith("```") ||
            line.startsWith("|") ||
            line.startsWith("- ") ||
            line.startsWith("* ")
        ) {
            continue;
        }
        return line;
    }

    return DEFAULT_DESCRIPTION;
}

function categorizeSkill(slug: string, description: string): string {
    const searchable = `${slug} ${description}`.toLowerCase();

    if (/(arbitrage|xemm|trading|exchange|liquidity|market)/.test(searchable)) {
        return "Trading";
    }
    if (/(auth|wallet|payment|gateway|api|integration)/.test(searchable)) {
        return "Integrations";
    }
    if (/(deploy|developer|docker|infrastructure|server|dev stack)/.test(searchable)) {
        return "Infrastructure";
    }
    if (/(react|ux|design|frontend|presentation|slides|spreadsheet)/.test(searchable)) {
        return "Product";
    }
    return "General";
}

function inferMode(markdown: string): SkillMode {
    const searchable = markdown.toLowerCase();
    if (/(commands:|## workflow|## step|script|run-|setup-|install-|api)/.test(searchable)) {
        return "Action";
    }
    return "Knowledge";
}

export default async function SkillsIndexPage() {
    const projectRoot = process.env.PROJECT_ROOT || process.cwd();
    const skillsDir = path.join(projectRoot, "skills");

    let skills: SkillSummary[] = [];

    try {
        const entries = await fs.readdir(skillsDir, { withFileTypes: true });

        skills = await Promise.all(
            entries
                .filter(entry => entry.isDirectory())
                .map(async (entry) => {
                    const slug = entry.name;
                    const skillPath = path.join(skillsDir, slug, "SKILL.md");

                    try {
                        const raw = await fs.readFile(skillPath, "utf-8");
                        const { body, frontmatter } = parseFrontmatter(raw);
                        const name = frontmatter.name ? formatSkillName(frontmatter.name) : formatSkillName(slug);
                        const sourceDescription = frontmatter.description || extractDescription(body);

                        return {
                            slug,
                            name,
                            description: clampDescription(sourceDescription),
                            category: categorizeSkill(slug, sourceDescription),
                            mode: inferMode(body),
                            hasDoc: true
                        };
                    } catch {
                        return {
                            slug,
                            name: formatSkillName(slug),
                            description: DEFAULT_DESCRIPTION,
                            category: "General",
                            mode: "Knowledge",
                            hasDoc: false
                        };
                    }
                })
        );
    } catch (error) {
        console.error("Error listing skills:", error);
    }

    const documentedSkills = skills
        .filter(skill => skill.hasDoc)
        .sort((a, b) => a.name.localeCompare(b.name));

    const actionCount = documentedSkills.filter(skill => skill.mode === "Action").length;

    const categoryOrder = ["Trading", "Infrastructure", "Integrations", "Product", "General"];
    const grouped = categoryOrder
        .map(cat => ({
            category: cat,
            skills: documentedSkills.filter(s => s.category === cat),
        }))
        .filter(g => g.skills.length > 0);

    const categoryCount = grouped.length;

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <header className="glass-card rounded-[2rem] border border-border/60 p-8 md:p-10">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">
                    Skills Library
                </p>
                <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
                    Curated capabilities for planning, execution, and domain expertise
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
                    Browse documented skills, understand what each one is best at, and open any guide before invoking it in chat.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Documented Skills
                        </p>
                        <p className="mt-2 text-2xl font-black">{documentedSkills.length}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Action Skills
                        </p>
                        <p className="mt-2 text-2xl font-black">{actionCount}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Categories
                        </p>
                        <p className="mt-2 text-2xl font-black">{categoryCount}</p>
                    </div>
                </div>
            </header>

            {documentedSkills.length > 0 ? (
                <div className="mt-10 space-y-12">
                    {grouped.map((group) => (
                        <section key={group.category}>
                            <div className="mb-5 flex items-end justify-between">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight">{group.category}</h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {group.skills.length} {group.skills.length === 1 ? "skill" : "skills"}
                                    </p>
                                </div>
                                {group.category === grouped[0].category && (
                                    <Link
                                        href="/chat"
                                        className="inline-flex items-center justify-center rounded-xl border border-primary/40 px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:bg-primary/10"
                                    >
                                        Open Chat
                                    </Link>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                                {group.skills.map((skill) => (
                                    <Link
                                        key={skill.slug}
                                        href={`/skills/${skill.slug}`}
                                        className="group flex h-full flex-col justify-between rounded-3xl border border-border/60 bg-background/50 p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
                                    >
                                        <div>
                                            <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                {skill.mode}
                                            </span>

                                            <h3 className="mt-4 text-lg font-extrabold tracking-tight transition-colors group-hover:text-primary">
                                                {skill.name}
                                            </h3>
                                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                                {skill.description}
                                            </p>
                                        </div>

                                        <div className="mt-8 flex items-center justify-between text-xs">
                                            <span className="font-mono text-muted-foreground">/{skill.slug}</span>
                                            <span className="flex items-center gap-1 font-bold uppercase tracking-wide text-primary transition-transform group-hover:translate-x-0.5">
                                                Open Guide
                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                <section className="mt-10">
                    <div className="rounded-3xl border border-dashed border-border/60 bg-background/40 p-12 text-center">
                        <p className="text-lg font-bold text-foreground">No skills documented yet</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Add a <code className="rounded bg-background/70 px-1.5 py-0.5 font-mono text-xs">SKILL.md</code> file to any skill directory to surface it here.
                        </p>
                    </div>
                </section>
            )}
        </div>
    );
}
