// SPDX-License-Identifier: Apache-2.0
/**
 * Ingestion Example
 *
 * Demonstrates how to use the data ingestion functionality
 */

import { MapleSpike } from '@maplespike/sdk';
import { readFileSync } from 'fs';

const ms = new MapleSpike({
  apiKey: process.env.QUILL_API_KEY,
  baseUrl: 'http://127.0.0.1:8082',
});

async function ingestionExamples() {
  try {
    // Validate data before ingestion
    const validationResult = await ms.ingestion.validate({
      sourceType: 'url',
      sourceUrl: 'https://example.com/data.csv',
      domain: 'immigration',
      validate: true,
      deduplicate: true,
    });
    console.log('Validation result:', validationResult.data);

    // Submit an ingestion job
    const job = await ms.ingestion.ingest({
      sourceType: 'url',
      sourceUrl: 'https://example.com/data.csv',
      domain: 'immigration',
      validate: true,
      deduplicate: true,
      metadata: {
        source: 'custom-import',
        uploadedBy: 'user@example.com',
      },
    });
    console.log('Ingestion job submitted:', job.data);

    // Get job status
    const jobId = job.data.jobId;
    const status = await ms.ingestion.getJob(jobId);
    console.log('Job status:', status.data);

    // List recent jobs
    const jobs = await ms.ingestion.listJobs({
      limit: 10,
      status: 'completed',
    });
    console.log('Recent jobs:', jobs.data);

    // Get ingestion statistics
    const stats = await ms.ingestion.stats();
    console.log('Ingestion statistics:', stats.data);

    // Note: Cancel and delete are available but commented out for safety
    // await ms.ingestion.cancelJob(jobId);
    // await ms.ingestion.deleteJob(jobId);

  } catch (error) {
    console.error('Error:', error);
  }
}

ingestionExamples();