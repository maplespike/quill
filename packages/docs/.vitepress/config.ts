import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'MapleSpike',
  description: 'Canadian Government Data Pipeline — API, MCP, SDK & Ingestion',
  lang: 'en-CA',
  base: '/docs/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/docs/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#C23030' }],
  ],

  themeConfig: {
    logo: { src: '/docs/maplespike_logo.svg', width: 24, height: 24 },
    siteTitle: 'MapleSpike',

    nav: [
      { text: 'Guide', link: '/guide/what-is-maplespike' },
      { text: 'API', link: '/api/endpoints' },
      { text: 'MCP Tools', link: '/mcp/tools' },
      { text: 'Modules', link: '/modules/overview' },
      { text: 'Portal', link: 'https://maplespike.lan' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'What is MapleSpike?', link: '/guide/what-is-maplespike' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Quickstart', link: '/guide/quickstart' },
            { text: 'Authentication', link: '/guide/authentication' },
            { text: 'SDK Usage', link: '/guide/sdk' },
            { text: 'Billing & Limits', link: '/guide/billing' },
            { text: 'Architecture', link: '/guide/architecture' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'All Endpoints', link: '/api/endpoints' },
            { text: 'Health', link: '/api/health' },
            { text: 'Gov Search', link: '/api/gov-search' },
            { text: 'AI Ask', link: '/api/ai-ask' },
            { text: 'Usage & Limits', link: '/api/usage' },
            { text: 'Mock Mode', link: '/api/mock' },
          ],
        },
      ],
      '/mcp/': [
        {
          text: 'MCP Server',
          items: [
            { text: 'All Tools', link: '/mcp/tools' },
            { text: 'Setup Guide', link: '/mcp/setup' },
            { text: 'SSE Transport', link: '/mcp/sse' },
          ],
        },
      ],
      '/modules/': [
        {
          text: 'Ingestion Modules',
          items: [
            { text: 'Modules Overview', link: '/modules/overview' },
            { text: 'Committee Evidence', link: '/modules/committees' },
            { text: 'Immigration & Borders', link: '/modules/immigration' },
            { text: 'Health Data', link: '/modules/health' },
            { text: 'LODE Geospatial', link: '/modules/lode' },
            { text: 'Corporate & Lobbying', link: '/modules/corporate' },
            { text: 'Transport & Infrastructure', link: '/modules/transport' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/reverb256/maplespike' },
    ],

    footer: {
      message: 'Sovereign Canadian public data infrastructure.',
      copyright: 'MapleSpike — Open Government Licence – Canada',
    },
  },
})
