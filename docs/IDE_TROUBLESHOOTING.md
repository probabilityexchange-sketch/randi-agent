# IDE Troubleshooting Guide

This guide helps resolve common IDE issues when working on the Randi Agent Platform.

## Common Issues

### IDE Crashes or Freezes

#### Symptoms
- IDE becomes unresponsive when opening files
- High CPU/memory usage
- Slow typing or navigation

#### Solutions

1. **Exclude Large Directories**
   
   Ensure these directories are excluded from indexing:
   - `node_modules/`
   - `.next/`
   - `out/`
   - `build/`
   - `coverage/`
   
   For VS Code, these are already configured in `.vscode/settings.json`.

2. **Increase Memory Allocation**
   
   For VS Code, add to settings:
   ```json
   "typescript.tsserver.maxTsServerMemory": 4096
   ```
   
   For other IDEs, consult documentation for increasing heap size.

3. **Disable Unnecessary Extensions**
   
   Review installed extensions and disable those not needed for this project.

4. **Clear IDE Cache**
   
   VS Code:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Select "Developer: Reload Window"
   - Or close and reopen VS Code

### TypeScript Language Server Issues

#### Symptoms
- Red underlines everywhere
- "Cannot find module" errors
- Auto-complete not working

#### Solutions

1. **Restart TypeScript Server**
   
   VS Code:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Select "TypeScript: Restart TS Server"

2. **Verify TypeScript Installation**
   ```bash
   npm install
   npx tsc --version
   ```

3. **Check tsconfig.json**
   
   Ensure `tsconfig.json` exists and is valid.

### ESLint/Prettier Not Working

#### Symptoms
- Code not formatting on save
- Linting errors not showing

#### Solutions

1. **Verify Extensions Installed**
   
   Recommended extensions in `.vscode/extensions.json`:
   - ESLint
   - Prettier

2. **Check Configuration Files**
   ```bash
   # Verify config files exist
   ls -la .prettierrc eslint.config.mjs .lintstagedrc
   ```

3. **Manually Run Formatters**
   ```bash
   npm run format
   npm run lint
   ```

### Dev Server Performance

#### Symptoms
- Slow page loads in development
- Hot reload not working
- High memory usage

#### Solutions

1. **Clear Next.js Cache**
   ```bash
   rm -rf .next
   npm run dev
   ```

2. **Disable Source Maps** (if memory is an issue)
   
   In `next.config.ts`:
   ```typescript
   const nextConfig = {
     productionBrowserSourceMaps: false,
   };
   ```

3. **Limit Watched Files**
   
   Ensure large files are in `.gitignore` and excluded from watchers.

## Performance Tips

### General
- Keep only necessary files open in editor
- Close unused projects/workspaces
- Regularly restart IDE (once per day)
- Use lightweight file viewer for large logs

### Git Integration
- Disable auto-fetch if repository is large
- Limit git history depth in IDE settings
- Use command line for complex git operations

### Extensions
- Install only project-relevant extensions
- Disable extensions for file types you don't use
- Keep extensions updated

## Reporting Issues

If problems persist:
1. Note your IDE version and extensions
2. Document steps to reproduce
3. Check system resources (RAM, CPU)
4. Create an issue with details

## Recommended System Requirements

- **RAM**: 8GB minimum, 16GB recommended
- **CPU**: 4 cores minimum
- **Storage**: SSD recommended
- **Node.js**: Version 20+