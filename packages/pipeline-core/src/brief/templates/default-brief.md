---
last-reviewed: 2026-05-19
status: active

# {{title}}

{{summary}}

## Sections
{{#each sections}}
### {{this.title}}
{{this.content}}
{{/each}}

## Citations
{{#each citations}}
- [{{this.id}}] {{this.source}} (confidence: {{this.confidence}})
{{/each}}

*Generated at {{generatedAt}}*