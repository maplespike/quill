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