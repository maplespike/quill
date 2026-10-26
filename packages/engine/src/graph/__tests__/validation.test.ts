import { describe, it, expect } from 'vitest';
import { validateGraphData, validateNode, validateEdge } from '../validation';

describe('Graph validation', () => {
  it('validates a correct graph', () => {
    const result = validateGraphData({
      nodes: [{ id: '1', type: 'person', label: 'John Doe', properties: {} }],
      edges: [{ id: 'e1', source_node: '1', target_node: '1', type: 'employment', weight: 0.5, source_ref: '' }],
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a graph with missing node id', () => {
    const result = validateGraphData({ nodes: [{ type: 'person', label: 'John' }], edges: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('nodes.0.id:'))).toBe(true);
  });

  it('fills output defaults when keys are absent', () => {
    const result = validateNode({ id: '1', type: 'person', label: 'John' });
    expect(result.valid).toBe(true);
    expect(result.data?.properties).toEqual({});
  });

  it('fills edge defaults when keys are absent', () => {
    const result = validateEdge({ id: 'e1', source_node: '1', target_node: '2', type: 'employment' });
    expect(result.valid).toBe(true);
    expect(result.data?.weight).toBe(0.5);
    expect(result.data?.source_ref).toBe('');
  });

  it('validates a single node', () => {
    const result = validateNode({ id: '1', type: 'person', label: 'John', properties: {} });
    expect(result.valid).toBe(true);
    expect(result.data?.label).toBe('John');
  });

  it('rejects a node with invalid type', () => {
    const result = validateNode({ id: '1', type: 'invalid', label: 'John' });
    expect(result.valid).toBe(false);
  });

  it('validates an edge', () => {
    const result = validateEdge({ id: 'e1', source_node: '1', target_node: '2', type: 'employment', weight: 0.8, source_ref: '' });
    expect(result.valid).toBe(true);
  });

  it('rejects an edge with weight > 1', () => {
    const result = validateEdge({ id: 'e1', source_node: '1', target_node: '2', type: 'employment', weight: 2, source_ref: '' });
    expect(result.valid).toBe(false);
  });
});
