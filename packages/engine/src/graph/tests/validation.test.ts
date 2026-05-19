/**
 * Validation Tests for Graph Builder
 *
 * Tests Zod validation schemas and metrics collection.
 */

import { describe, expect, it } from "vitest";
import { validateNode, validateEdge } from '../schemas';
import type { Node, Edge } from '../../types/graph';
import { GraphBuilder } from '../builder';
import type { AliasManager } from '../../entity/aliases';

describe('Graph Builder Validation', () => {
  it('validateNode rejects invalid structure', () => {
    const invalid = { id: 123, type: 'person', label: 'test' };
    expect(() => validateNode(invalid)).toThrow();
  });

  it('validateNode accepts valid node', () => {
    const valid = {
      id: 'person:1',
      type: 'person',
      label: 'Test Person',
      properties: { names: ['Test'] },
    };
    expect(() => validateNode(valid)).not.toThrow();
  });

  it('validateEdge rejects missing fields', () => {
    const missing = { id: 'e1', source: 'a', type: 'related_to' } as Edge;
    expect(() => validateEdge(missing)).toThrow();
  });

  it('validateEdge accepts valid edge', () => {
    const valid = {
      id: 'e1',
      source: 'a',
      target: 'b',
      type: 'related_to',
      weight: 1,
      properties: {},
      sourceRef: 'src',
    };
    expect(() => validateEdge(valid)).not.toThrow();
  });

  it('GraphBuilder increments metrics on node/edge add', () => {
    const aliasManager: AliasManager = {} as AliasManager;
    const builder = new GraphBuilder(aliasManager);
    let m = builder.getMetrics();
    expect(m.nodeCount).toBe(0);
    expect(m.edgeCount).toBe(0);
    builder.addNode({
      id: 'node1',
      type: 'person',
      label: 'Person1',
      properties: {},
    });
    m = builder.getMetrics();
    expect(m.nodeCount).toBe(1);
    expect(m.edgeCount).toBe(0);
    builder.addEdge({
      id: 'edge1',
      source: 'node1',
      target: 'node1',
      type: 'related_to',
      weight: 1,
      properties: {},
      sourceRef: '',
    });
    m = builder.getMetrics();
    expect(m.nodeCount).toBe(1);
    expect(m.edgeCount).toBe(1);
  });
});