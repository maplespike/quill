# Committee Report: {{committeeName}}

**Meeting**: {{meetingNumber}} on {{date}}
**Subject**: {{subject}}

## Summary
{{summary}}

## Key Points
{{#each keyPoints}}
- {{this}}
{{/each}}

## Recommendations
{{#each recommendations}}
- {{this}}
{{/each}}

## Participants
{{#each participants}}
- {{this.name}} ({{this.party}}): "{{this.quote}}"
{{/each}}

**Source**: {{sourceUrl}}
*Generated at {{generatedAt}}*