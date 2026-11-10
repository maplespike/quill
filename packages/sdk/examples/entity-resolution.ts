// SPDX-License-Identifier: Apache-2.0
/**
 * Entity Resolution Example
 *
 * Demonstrates how to use the entity resolution functionality
 */

import { MapleSpike, type EntityType } from '@maplespike/sdk';

const ms = new MapleSpike({
  apiKey: process.env.QUILL_API_KEY,
  baseUrl: 'http://127.0.0.1:8082',
});

async function entityResolutionExamples() {
  try {
    // Resolve an entity across all datasets
    const resolution = await ms.entityResolution.resolve({
      name: 'Bell Canada',
      type: 'company',
      minConfidence: 'medium',
    });
    console.log('Entity resolution results:', resolution.data);

    // Get entity details
    if (resolution.data.length > 0) {
      const entityId = resolution.data[0].entityId;
      const entity = await ms.entityResolution.getEntity(entityId);
      console.log('Entity details:', entity.data);

      // Get entity graph (relationships)
      const graph = await ms.entityResolution.getGraph(entityId, 2);
      console.log('Entity graph:', graph.data);

      // Find similar entities
      const similar = await ms.entityResolution.findSimilar(entityId, 5);
      console.log('Similar entities:', similar.data);
    }

    // Search for entities
    const entities = await ms.entityResolution.searchEntities('bank', {
      type: 'company',
      limit: 10,
    });
    console.log('Entity search results:', entities.data);

    // Get entity statistics
    const stats = await ms.entityResolution.stats();
    console.log('Entity statistics:', stats.data);

    // Bulk resolve entities
    const bulkResults = await ms.entityResolution.bulkResolve([
      { name: 'Rogers Communications', type: 'company' },
      { name: 'TD Bank', type: 'company' },
      { name: 'University of Toronto', type: 'university' },
    ]);
    console.log('Bulk resolution results:', bulkResults.data);

  } catch (error) {
    console.error('Error:', error);
  }
}

entityResolutionExamples();