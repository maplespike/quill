/**
 * MapleSpike — Auth Module Barrel Exports
 */

export * from './jwt.js';
export * from './users.js';
export * from './github.js';
export * from './web3.js';
export * from './passkey.js';

// Named re-exports for clarity
export { extractToken } from './jwt.js';
