#!/usr/bin/env node
// Quill MCP zero-config entry point.
// Run: npx @maplespike/quill-mcp  or  uvx quill-mcp
//
// This module re-exports the main server (index.ts handles startup).
// The bin entry in package.json points here.
// The index.ts server is started automatically when this module loads.

// Re-export everything from the main server
export * from './index.js';

// The index.ts side-effect starts the HTTP server when imported.
// That's the zero-config behavior: just `import '@maplespike/quill-mcp'` starts it.
