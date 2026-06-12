/**
 * Post-build script: Fix ESM imports in dist/ to use .js extensions.
 * Node.js ESM requires explicit file extensions for local imports.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

const distDir = process.argv[2] || 'dist';

function fixImports(filePath: string): void {
  let content = readFileSync(filePath, 'utf-8');
  const original = content;
  
  // Fix: from "./foo" → from "./foo.js" (but not "./foo.js" already, or external packages)
  content = content.replace(
    /from\s+['"](\.[^'"]+)['"]/g,
    (match, importPath: string) => {
      if (importPath.endsWith('.js') || importPath.endsWith('.mjs') || importPath.endsWith('.cjs')) {
        return match;
      }
      // Check if the imported file actually exists as .js
      const resolvedJs = join(distDir, importPath + '.js');
      const resolvedTs = join(distDir, importPath + '.ts');
      try {
        if (statSync(resolvedJs).isFile()) {
          return `from '${importPath}.js'`;
        }
      } catch {}
      try {
        if (statSync(resolvedTs).isFile()) {
          return `from '${importPath}.js'`;
        }
      } catch {}
      return match;
    }
  );
  
  // Also fix: export ... from '"./foo"
  content = content.replace(
    /export\s+(.+)\s+from\s+['"](\.[^'"]+)['"]/g,
    (match, exports: string, importPath: string) => {
      if (importPath.endsWith('.js') || importPath.endsWith('.mjs') || importPath.endsWith('.cjs')) {
        return match;
      }
      const resolvedJs = join(distDir, importPath + '.js');
      const resolvedTs = join(distDir, importPath + '.ts');
      try {
        if (statSync(resolvedJs).isFile()) {
          return `export ${exports} from '${importPath}.js'`;
        }
      } catch {}
      try {
        if (statSync(resolvedTs).isFile()) {
          return `export ${exports} from '${importPath}.js'`;
        }
      } catch {}
      return match;
    }
  );
  
  if (content !== original) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed imports in: ${filePath}`);
  }
}

function walkDir(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      fixImports(fullPath);
    }
  }
}

walkDir(distDir);
console.log('Done fixing ESM imports.');