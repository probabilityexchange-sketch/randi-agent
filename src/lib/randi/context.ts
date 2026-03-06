import fs from 'fs';
import path from 'path';

export async function getRandiContext() {
  const baseDir = path.join(process.cwd(), 'src/lib/randi');
  const sections = ['personality', 'rules', 'skills'];
  let combinedContext = "";

  for (const section of sections) {
    const dirPath = path.join(baseDir, section);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md')).sort();
    if (files.length === 0) continue;

    combinedContext += `\n\n# ${section.toUpperCase()}\n`;
    for (const file of files) {
      const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
      combinedContext += `\n## ${file.replace('.md', '')}\n${content}\n`;
    }
  }

  return combinedContext;
}
