import * as fs from 'fs/promises';
import * as path from 'path';
import type { ModuleOptions } from './args.js';

export async function createModule(options: ModuleOptions) {
  const moduleName = options.name;
  const moduleDir = path.join(process.cwd(), 'packages', 'pipeline-core', 'src', 'ingestion', moduleName);
  const pascalName = toPascalCase(moduleName);

  console.log(`Creating module: ${moduleName}`);

  const moduleDirExists = await checkDirExists(moduleDir);
  if (moduleDirExists) {
    throw new Error(`Module directory already exists: ${moduleDir}`);
  }

  await fs.mkdir(moduleDir, { recursive: true });
  console.log(`  Created directory: ${moduleDir}`);

  const moduleFiles = generateModuleFiles(moduleDir, options, pascalName);

  for (const file of moduleFiles) {
    await fs.writeFile(file.path, file.content, 'utf-8');
    console.log(`  Created: ${path.relative(process.cwd(), file.path)}`);
  }

  await createTestFiles(moduleDir, options);

  await registerInRegistry(options, pascalName);

  console.log(`\n✅ Module "${moduleName}" created successfully!`);
  console.log(`\nNext steps:`);
  console.log(`  1. Edit ${path.join(moduleDir, 'constants.ts')} to configure your data source`);
  console.log(`  2. Implement fetcher logic in ${path.join(moduleDir, 'fetcher.ts')}`);
  console.log(`  3. Implement parser logic in ${path.join(moduleDir, 'parser.ts')}`);
  console.log(`  4. Run tests: cd ${moduleDir} && node --test __tests__/${moduleName}.test.ts`);
}

async function checkDirExists(dirPath: string): Promise<boolean> {
  try {
    await fs.access(dirPath);
    return true;
  } catch {
    return false;
  }
}

async function createTestFiles(moduleDir: string, options: ModuleOptions) {
  const testDir = path.join(moduleDir, '__tests__');
  await fs.mkdir(testDir, { recursive: true });

  const testContent = generateTestTemplate(options);
  const testPath = path.join(testDir, `${options.name}.test.ts`);
  await fs.writeFile(testPath, testContent, 'utf-8');
  console.log(`  Created: ${path.relative(process.cwd(), testPath)}`);
}

function generateModuleFiles(moduleDir: string, options: ModuleOptions, pascalName: string) {
  return [
    {
      path: path.join(moduleDir, 'constants.ts'),
      content: generateConstantsTemplate(options, pascalName),
    },
    {
      path: path.join(moduleDir, 'types.ts'),
      content: generateTypesTemplate(options, pascalName),
    },
    {
      path: path.join(moduleDir, 'fetcher.ts'),
      content: generateFetcherTemplate(options, pascalName),
    },
    {
      path: path.join(moduleDir, 'parser.ts'),
      content: generateParserTemplate(options, pascalName),
    },
    {
      path: path.join(moduleDir, 'index.ts'),
      content: generateIndexTemplate(options, pascalName),
    },
  ];
}

async function registerInRegistry(options: ModuleOptions, pascalName: string) {
  const registryPath = path.join(process.cwd(), 'packages', 'pipeline-core', 'src', 'ingestion', 'registry.ts');

  const registryContent = await fs.readFile(registryPath, 'utf-8');

  const modulePattern = new RegExp(`name:\\s*['"]${options.name}['"]`);
  if (modulePattern.test(registryContent)) {
    throw new Error(`Module "${options.name}" already exists in registry.ts`);
  }

  const registryEntry = generateRegistryEntry(options, pascalName);
  const updatedContent = insertRegistryEntry(registryContent, registryEntry, options);

  await fs.writeFile(registryPath, updatedContent, 'utf-8');
  console.log(`  Registered in: ${path.relative(process.cwd(), registryPath)}`);
}

function insertRegistryEntry(registryContent: string, registryEntry: string, options: ModuleOptions): string {
  const lines = registryContent.split('\n');
  let moduleRegistryEndIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '];') {
      const nextLines = lines.slice(i + 1, i + 5);

      const found = nextLines.some(line => {
        const trimmed = line.trim();
        return trimmed.includes('moduleMap') || trimmed.includes('categoryMap') || trimmed.includes('Build lookup');
      });

      if (found) {
        moduleRegistryEndIndex = i;
        break;
      }
    }
  }

  if (moduleRegistryEndIndex === -1) {
    throw new Error('Could not find MODULE_REGISTRY array closing bracket in registry.ts');
  }

  const insertPosition = registryContent.split('\n').slice(0, moduleRegistryEndIndex).join('\n').length;

  return (
    registryContent.slice(0, insertPosition) +
    '  // ' + generateRegistryComment(options) + '\n' +
    registryEntry + ',\n' +
    registryContent.slice(insertPosition)
  );
}

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function generateRegistryComment(options: ModuleOptions): string {
  const categoryMapping: Record<string, string> = {
    'government': 'Government',
    'corporate': 'Corporate',
    'health': 'Health',
    'energy': 'Energy',
    'environment': 'Environment',
    'influence': 'Influence',
    'legal': 'Legal',
    'education': 'Education',
    'science': 'Science',
    'defence': 'Defence',
    'infrastructure': 'Infrastructure',
    'financial': 'Financial',
    'media': 'Media',
    'labour': 'Labour',
    'indigenous': 'Indigenous',
    'provincial': 'Provincial',
    'social': 'Social',
    'culture': 'Culture',
  };

  const category = categoryMapping[options.category] || 'General';
  const moduleName = options.name.replace(/-/g, ' ');
  return `${category} — ${moduleName}`;
}

function generateRegistryEntry(options: ModuleOptions, pascalName: string): string {
  const ingestFunctions = [`ingest${pascalName}`, `ingestAll${pascalName}`];

  return `  {
    name: '${options.name}',
    description: '${options.name.replace(/-/g, ' ')} data ingestion',
    category: '${options.category}',
    modulePath: './${options.name}/index.js',
    ingestFunctions: [${ingestFunctions.map(f => `'${f}'`).join(', ')}],
    sources: [{ name: '${options.sourceUrl || 'Data source'}', format: 'JSON/CSV' }],
    updateFrequency: '${options.updateFrequency}',
    testCallPattern: 'runModule',
    ${options.sourceUrl ? `healthCheckUrl: '${options.sourceUrl}',` : ''}
  }`;
}

function generateConstantsTemplate(options: ModuleOptions, pascalName: string): string {
  return `// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ${pascalName} Constants
 *
 * Data source URLs, timeouts, and configuration for ${options.name.replace(/-/g, ' ')} ingestion.
 */

${options.sourceUrl ? `export const ${pascalName.toUpperCase()}_SOURCE_URL = '${options.sourceUrl}';` : ''}
export const ${pascalName.toUpperCase()}_TIMEOUT_MS = 15_000;
export const ${pascalName.toUpperCase()}_UA = 'MapleSpike-${pascalName}/1.0';

export const ${pascalName.toUpperCase()}_TOPICS = [
  '${options.name.replace(/-/g, ' ')}',
  // Add more search topics as needed
];

export const ${pascalName.toUpperCase()}_LICENSE = 'https://open.canada.ca/en/open-government-licence-canada';
`;
}

function generateTypesTemplate(options: ModuleOptions, pascalName: string): string {
  return `// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ${pascalName} Types
 *
 * TypeScript interfaces for ${options.name.replace(/-/g, ' ')} records.
 */

export interface Base${pascalName}Record {
  id: string;
  title: string;
  description: string;
  url: string;
  date: string;
}

export interface ${pascalName}Record extends Base${pascalName}Record {
  // Add module-specific fields here
  category?: string;
}

export interface ${pascalName}IngestionResult {
  source: string;
  recordsFound: number;
  records: ${pascalName}Record[];
  errors: string[];
  durationMs: number;
}
`;
}

function generateFetcherTemplate(options: ModuleOptions, pascalName: string): string {
  return `// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ${pascalName} Fetcher
 *
 * Data fetching functions for ${options.name.replace(/-/g, ' ')}.
 */

import { httpGet } from '../../utils/http.js';
${options.sourceUrl ? `import { ${pascalName.toUpperCase()}_SOURCE_URL, ${pascalName.toUpperCase()}_TIMEOUT_MS, ${pascalName.toUpperCase()}_UA } from './constants.js';` : ''}
import type { ${pascalName}Record, ${pascalName}IngestionResult } from './types.js';

export async function ingest${pascalName}(): Promise<${pascalName}IngestionResult> {
  const start = Date.now();
  const records: ${pascalName}Record[] = [];
  const errors: string[] = [];

  try {
${options.sourceUrl ? `    const resp = await httpGet(\`${pascalName.toUpperCase()}_SOURCE_URL\`, {
      timeoutMs: ${pascalName.toUpperCase()}_TIMEOUT_MS,
      headers: { 'User-Agent': ${pascalName.toUpperCase()}_UA },
    });` : `    throw new Error('Fetcher not implemented');`}

    // TODO: Parse response and create records
    // const data = JSON.parse(resp.body);
    // for (const item of data) {
    //   records.push({
    //     id: generateId(item),
    //     title: item.title || '',
    //     description: item.description || '',
    //     url: item.url || '',
    //     date: item.date || '',
    //     category: '${options.category}',
    //   });
    // }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    source: '${options.name}',
    recordsFound: records.length,
    records,
    errors,
    durationMs: Date.now() - start,
  };
}

export async function ingestAll${pascalName}(): Promise<Record<string, ${pascalName}IngestionResult>> {
  const result = await ingest${pascalName}();
  return { '${options.name}': result };
}
`;
}

function generateParserTemplate(options: ModuleOptions, pascalName: string): string {
  return `// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ${pascalName} Parser
 *
 * Record parsing with field extraction and deduplication for ${options.name.replace(/-/g, ' ')}.
 */

import { computeHash } from '../../verification/hashing.js';
import type { ${pascalName}Record } from './types.js';

export async function parse${pascalName}Records(
  rawData: any[],
  options: {
    sourceUrl?: string;
  } = {},
): Promise<${pascalName}Record[]> {
  const now = new Date().toISOString();
  const records: ${pascalName}Record[] = [];
  const seenHashes = new Set<string>();

  for (const item of rawData) {
    try {
      const hashContent = '${options.name}|' + JSON.stringify(item);
      const id = await computeHash(hashContent, 'sha256');
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      records.push({
        id,
        title: item.title || '',
        description: item.description || '',
        url: item.url || options.sourceUrl || '',
        date: item.date || '',
        category: '${options.category}',
      });
    } catch (err) {
      console.warn(\`[${pascalName} Parser] Skipping record: \${err instanceof Error ? err.message : String(err)}\`);
    }
  }

  return records;
}
`;
}

function generateIndexTemplate(options: ModuleOptions, pascalName: string): string {
  return `// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ${pascalName} Module
 *
 * Barrel exports for ${options.name.replace(/-/g, ' ')} ingestion.
 */

export { ingest${pascalName}, ingestAll${pascalName} } from './fetcher.js';
export type { ${pascalName}Record, ${pascalName}IngestionResult } from './types.js';
export { parse${pascalName}Records } from './parser.js';
`;
}

function generateTestTemplate(options: ModuleOptions): string {
  return `import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('${options.name} Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.ingest${toPascalCase(options.name)}, 'function');
    assert.equal(typeof mod.ingestAll${toPascalCase(options.name)}, 'function');
  });

  it('ingest${toPascalCase(options.name)} returns expected structure', async () => {
    const r = await (await import('../index.js')).ingest${toPascalCase(options.name)}();
    assert.equal(r.source, '${options.name}');
    assert.ok(Array.isArray(r.records));
  });
});
`;
}