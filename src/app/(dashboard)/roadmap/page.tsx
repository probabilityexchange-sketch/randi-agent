import fs from 'fs';
import path from 'path';
import React from 'react';

/** Render inline markdown: **bold**, `code`, and plain text. */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    if (match[1]) {
      nodes.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[1]}
        </strong>
      );
    } else if (match[2]) {
      nodes.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
          {match[2]}
        </code>
      );
    }
    last = re.lastIndex;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes;
}

/** Strip emoji prefix from a section header. */
function stripEmoji(text: string): string {
  return text.replace(/^[\p{Emoji}\p{Emoji_Presentation}\u200d\uFE0F]+\s*/u, '').trim();
}

export default async function RoadmapPage() {
  const rawContent = fs.readFileSync(path.join(process.cwd(), 'ROADMAP.md'), 'utf-8');

  let roadmapContent = rawContent.trim();

  const allLines = roadmapContent.split('\n');
  const title = stripEmoji(allLines[0].replace(/^#\s+/, ''));

  // Extract intro (lines between title and first ## section)
  const firstSectionIdx = allLines.findIndex((l, i) => i > 0 && l.startsWith('## '));
  const intro = allLines
    .slice(1, firstSectionIdx > 0 ? firstSectionIdx : undefined)
    .join(' ')
    .trim();

  // Split into ## sections
  const sections = roadmapContent
    .split(/^## /m)
    .slice(1)
    .filter(s => s.trim() !== '');

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
          {title}
        </h1>
        {intro && (
          <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {renderInline(intro)}
          </p>
        )}
      </div>

      <div className="space-y-8">
        {sections.map((section, idx) => {
          const lines = section.split('\n');
          const rawHeader = lines[0].trim();
          const header = stripEmoji(rawHeader);
          const bodyLines = lines.slice(1);

          const objectiveMatch = bodyLines.join('\n').match(/\*\*Objective\*\*:\s*(.*)/);
          const objective = objectiveMatch ? objectiveMatch[1] : null;

          const contentLines = bodyLines.filter(
            l => l.trim() !== '' && !l.includes('**Objective**:') && !l.startsWith('---')
          );

          return (
            <div
              key={idx}
              className="relative pl-8 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border group"
            >
              <div className="absolute left-[-4px] top-2 w-2 h-2 rounded-full bg-primary border border-background shadow-[0_0_8px_rgba(109,40,217,0.5)]" />

              <div className="bg-card/50 border border-border rounded-xl p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="text-primary/70 font-mono text-sm">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {header}
                </h2>

                {objective && (
                  <div className="mb-4 inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                    {renderInline(objective)}
                  </div>
                )}

                <div className="space-y-3">
                  {contentLines.map((line, lIdx) => {
                    const trimmed = line.trim();
                    const isTask = trimmed.startsWith('- [');
                    const isChecked = trimmed.includes('- [x]');

                    if (isTask) {
                      const label = trimmed.replace(/^- \[[x ]\]\s*/, '').trim();
                      return (
                        <div key={lIdx} className="flex items-start gap-3 text-sm">
                          <div
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              isChecked
                                ? 'bg-success border-success text-white'
                                : 'border-border bg-muted/30'
                            }`}
                          >
                            {isChecked && (
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <span
                            className={
                              isChecked
                                ? 'text-muted-foreground line-through decoration-muted-foreground/50'
                                : 'text-foreground'
                            }
                          >
                            {renderInline(label)}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <p key={lIdx} className="text-sm text-muted-foreground">
                        {renderInline(trimmed)}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-16 text-center text-xs text-muted-foreground border-t border-border pt-8">
        This roadmap is a living document and will be updated as the Randi ecosystem evolves.
      </div>
    </div>
  );
}
