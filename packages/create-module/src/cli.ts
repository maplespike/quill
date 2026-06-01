#!/usr/bin/env node

import { createModule } from './generator.js';
import { parseArgs } from './args.js';

async function main() {
  try {
    const options = parseArgs();
    await createModule(options);
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();