import type { ToolDefinition, ToolHandler } from './types.js';

export const definition: ToolDefinition = {
  name: 'getting_started',
  description:
    'New to Quill? Start here. Returns a quick-start guide with example queries, ' +
    'recommended first tools, and tips for getting the most out of Canadian government data. ' +
    'Call this when you are unsure where to begin.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const handler: ToolHandler = async () => {
  return {
    content: {
      tool: 'getting_started',
      welcome: 'Welcome to Quill — Canada\'s sovereign government data pipeline.',
      quickStart: [
        { step: 1, action: 'latest_releases', example: { limit: 5 }, description: 'See the most recent government data releases.' },
        { step: 2, action: 'discover_tools', example: { query: 'lobbying' }, description: 'Find tools by topic.' },
        { step: 3, action: 'fact_check', example: { claim: 'Canada has 10 provinces' }, description: 'Verify a claim against official data.' },
        { step: 4, action: 'search_committees', example: { query: 'health' }, description: 'Search parliamentary committee evidence.' },
        { step: 5, action: 'get_citation', example: { sha256: '<hash from any response>' }, description: 'Look up a citation by its SHA-256 hash.' },
      ],
      tips: [
        'All tools support bilingual responses (en/fr).',
        'Discovery, citation, and verification are free on every tier.',
        'Cross-reference tools link entities across lobbying, committees, GIC, corporate, and elections.',
        'Every response can carry a SHA-256 claim bundle — reproduce it locally with echo -n.',
        'Use discover_tools first when unsure which tool fits your question.',
      ],
      resources: {
        docs: 'https://quill.maplespike.ca/docs',
        apiReference: 'https://quill.maplespike.ca/api-reference',
        llmsTxt: 'https://quill.maplespike.ca/v1/llms.txt',
        github: 'https://github.com/maplespike/quill',
      },
    },
  };
};