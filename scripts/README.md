# Scripts

This directory contains utility scripts for the Randi Agent Platform.

## validate-skills.ts

Validates that all skills in the repository follow the standard format.

```bash
npm run tsx scripts/validate-skills.ts
```

### What it checks:
- Each skill directory contains a SKILL.md file
- SKILL.md has required frontmatter (name, description)
- Skill names follow naming conventions (lowercase with hyphens)
- Skill content has minimum length

## Other Scripts

- `cleanup-containers.ts` - Cleanup Docker containers
- Various skill execution scripts in skill directories
