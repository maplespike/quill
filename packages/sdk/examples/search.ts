// SPDX-License-Identifier: Apache-2.0
/**
 * Search Example
 *
 * Demonstrates how to use the cross-domain search functionality
 */

import { MapleSpike } from '@maplespike/sdk';

const ms = new MapleSpike({
  apiKey: process.env.QUILL_API_KEY,
  baseUrl: 'http://127.0.0.1:8082',
});

async function searchExamples() {
  try {
    // Global search across all domains
    const globalResults = await ms.search.search({
      query: 'healthcare lobbying',
      limit: 10,
      sort: 'relevance',
    });
    console.log('Global search results:', globalResults.data);

    // Domain-specific search
    const domainResults = await ms.search.searchDomain('corporate', {
      query: 'pharmaceutical',
      limit: 5,
    });
    console.log('Corporate domain results:', domainResults.data);

    // Get search suggestions
    const suggestions = await ms.search.suggestions('lobb', 5);
    console.log('Search suggestions:', suggestions.data);

    // Get search statistics
    const stats = await ms.search.stats();
    console.log('Search stats:', stats.data);

  } catch (error) {
    console.error('Error:', error);
  }
}

searchExamples();