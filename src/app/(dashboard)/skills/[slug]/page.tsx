import fs from "fs/promises";
import path from "path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";
import Link from "next/link";

interface SkillPageProps {
    params: Promise<{ slug: string }>;
}

function formatSkillName(value: string): string {
    return value
        .replace(/[-_]/g, " ")
        .split(" ")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function parseSkillDocument(rawContent: string): { body: string; frontmatter: Record<string, string> } {
    const lines = rawContent.split(/\r?\n/);
    if (lines[0]?.trim() !== "---") {
        return { body: rawContent.trim(), frontmatter: {} };
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

    return {
        body: lines.slice(index).join("\n").trim(),
        frontmatter
    };
}

function extractSummary(markdown: string): string {
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
    return "Detailed documentation for this skill is available below.";
}

export default async function SkillPage({ params }: SkillPageProps) {
    const slug = (await params).slug;
    const projectRoot = process.env.PROJECT_ROOT || process.cwd();
    const skillPath = path.resolve(projectRoot, "skills", slug, "SKILL.md");

    let rawContent = "";
    try {
        rawContent = await fs.readFile(skillPath, "utf-8");
    } catch {
        try {
            const fallbackPath = path.resolve(process.cwd(), "skills", slug, "SKILL.md");
            if (fallbackPath !== skillPath) {
                rawContent = await fs.readFile(fallbackPath, "utf-8");
            } else {
                notFound();
            }
        } catch {
            notFound();
        }
    }

    const { body, frontmatter } = parseSkillDocument(rawContent);
    const title = frontmatter.name ? formatSkillName(frontmatter.name) : formatSkillName(slug);
    const description = frontmatter.description || extractSummary(body);
    const version = frontmatter.version;
    const author = frontmatter.author;

    return (
        <div className="mx-auto max-w-5xl px-6 py-10">
            <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/dashboard" className="transition-colors hover:text-foreground">
                    Dashboard
                </Link>
                <span>/</span>
                <Link href="/skills" className="transition-colors hover:text-foreground">
                    Skills
                </Link>
                <span>/</span>
                <span className="font-semibold text-foreground">{title}</span>
            </nav>

            <header className="glass-card rounded-3xl border border-border/60 p-8 md:p-10">
                <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="mb-4 flex flex-wrap gap-2">
                            <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                                Skill Guide
                            </span>
                            {version && (
                                <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    v{version}
                                </span>
                            )}
                            {author && (
                                <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {author}
                                </span>
                            )}
                        </div>

                        <h1 className="text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                            {description}
                        </p>
                        <p className="mt-4 font-mono text-xs text-muted-foreground">
                            /{slug}
                        </p>
                    </div>

                    <div className="grid w-full gap-3 sm:max-w-xs">
                        <Link
                            href="/skills"
                            className="inline-flex items-center justify-center rounded-xl border border-border bg-background/70 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors hover:border-primary/40 hover:text-primary"
                        >
                            Back to Library
                        </Link>
                        <Link
                            href="/chat"
                            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-primary/90"
                        >
                            Invoke in Chat
                        </Link>
                    </div>
                </div>
            </header>

            <article className="mt-8 rounded-3xl border border-border/60 bg-background/40 p-6 md:p-8">
                <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-black prose-headings:tracking-tight prose-a:text-primary">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {body}
                    </ReactMarkdown>
                </div>
            </article>

            <div className="mt-8 flex items-center justify-between border-t border-border/40 pt-6">
                <Link
                    href="/skills"
                    className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    All Skills
                </Link>
                <Link
                    href="/chat"
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-primary/90"
                >
                    Invoke in Chat
                </Link>
            </div>
        </div>
    );
}
