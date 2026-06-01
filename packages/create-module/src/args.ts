/**
 * CLI Argument Parser
 *
 * Parses command-line arguments for module scaffolding.
 */

export interface ModuleOptions {
  name: string;
  sourceUrl: string;
  updateFrequency: string;
  trustLevel: string;
  category: string;
}

export interface ParsedArgs {
  module: string;
  sourceUrl?: string;
  updateFrequency?: string;
  trustLevel?: string;
  category?: string;
  help?: boolean;
}

/**
 * Parse CLI arguments from process.argv.
 *
 * Supports:
 *   - Positional: module name
 *   - Flags: --source-url, --update-frequency, --trust-level, --category
 */
export function parseArgs(): ModuleOptions {
  const args = process.argv.slice(2);

  // Show help if no arguments or --help
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const parsed: ParsedArgs = {
    module: '',
  };

  // Parse positional and flag arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      // Flag argument
      const flagName = arg.slice(2);
      const flagValue = args[i + 1];

      if (!flagValue || flagValue.startsWith('--')) {
        throw new Error(`Flag --${flagName} requires a value`);
      }

      switch (flagName) {
        case 'source-url':
          parsed.sourceUrl = flagValue;
          i++; // Skip next arg (the value)
          break;
        case 'update-frequency':
          parsed.updateFrequency = flagValue;
          i++;
          break;
        case 'trust-level':
          parsed.trustLevel = flagValue;
          i++;
          break;
        case 'category':
          parsed.category = flagValue;
          i++;
          break;
        case 'help':
          parsed.help = true;
          break;
        default:
          throw new Error(`Unknown flag: --${flagName}`);
      }
    } else if (!parsed.module) {
      // First positional argument is module name
      parsed.module = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  // Validate required arguments
  if (!parsed.module) {
    throw new Error('Module name is required');
  }

  // Validate module name format (kebab-case)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(parsed.module)) {
    throw new Error(
      'Module name must be in kebab-case (lowercase letters, numbers, and hyphens only)'
    );
  }

  // Set defaults
  return {
    name: parsed.module,
    sourceUrl: parsed.sourceUrl || '',
    updateFrequency: parsed.updateFrequency || 'monthly',
    trustLevel: parsed.trustLevel || 'official',
    category: parsed.category || 'government',
  };
}

/**
 * Display help information.
 */
function showHelp() {
  console.log(`
Create MapleSpike Module

Scaffolds a new ingestion module with all required files and registry registration.

USAGE:
  create-maplespike-module <module-name> [OPTIONS]

ARGUMENTS:
  <module-name>    Name of the module (kebab-case, e.g., "canada-post")

OPTIONS:
  --source-url <url>            Primary data source URL
  --update-frequency <freq>     How often data updates (default: monthly)
  --trust-level <level>         Data trust level: official, verified, community (default: official)
  --category <cat>              Module category: government, corporate, health, etc. (default: government)

EXAMPLES:
  # Create a basic module
  create-maplespike-module canada-post

  # Create a module with custom settings
  create-maplespike-module transport-safety \\
    --source-url "https://www.tc.gc.ca/en/services/transportation-safety" \\
    --update-frequency "daily" \\
    --category "infrastructure"

GENERATED FILES:
  packages/pipeline-core/src/ingestion/<module-name>/
    ├── constants.ts      # Source URLs, timeouts, user agents
    ├── types.ts          # TypeScript interfaces for records
    ├── fetcher.ts        # Data fetching functions
    ├── parser.ts         # Record parsing with computeHash
    ├── index.ts          # Barrel exports
    └── __tests__/
        └── <module-name>.test.ts  # Basic export tests

  The module will also be automatically registered in:
    packages/pipeline-core/src/ingestion/registry.ts
`);
}