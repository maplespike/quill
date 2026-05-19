// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Brief generator for creating structured briefs and signals from graph data
 */
import type { Brief, BriefSection, BriefCitation, Signal, BriefTemplate, BriefGeneratorOptions } from "./types.js";
import { GraphBuilder } from "../graph/GraphBuilder.js";

export class BriefGenerator {
  private templates: Map<string, BriefTemplate> = new Map();
  private options: Required<BriefGeneratorOptions>;

  constructor(options: BriefGeneratorOptions = {}) {
    this.options = {
      templateDir: options.templateDir ?? "./src/brief/templates",
      defaultTemplate: options.defaultTemplate ?? "default-brief",
    };

    // Load default templates
    this.loadDefaultTemplates();
  }

  /**
   * Load default templates
   */
  private loadDefaultTemplates(): void {
    // Default brief template
    this.templates.set("default-brief", {
      name: "default-brief",
      template: `# {{title}}

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
`,
      render: (data: Record<string, unknown>) => {
        // Simple template replacement for MVP
        let result = data.template as string;

        // Replace title
        result = result.replace(/{{title}}/g, String(data.title || ''));

        // Replace summary
        result = result.replace(/{{summary}}/g, String(data.summary || ''));

        // Replace sections
        if (Array.isArray(data.sections)) {
          let sectionsContent = '';
          for (const section of data.sections) {
            sectionsContent += `### ${section.title}\n\n${section.content}\n\n`;
          }
          result = result.replace(/{{#each sections}}[\s\S]*?{{\/each}}/g, sectionsContent.trim());
        }

        // Replace citations
        if (Array.isArray(data.citations)) {
          let citationsContent = '';
          for (const citation of data.citations) {
            citationsContent += `- [${citation.id}] ${citation.source} (confidence: ${citation.confidence})\n`;
          }
          result = result.replace(/{{#each citations}}[\s\S]*?{{\/each}}/g, citationsContent.trim());
        }

        // Replace generatedAt
        result = result.replace(/{{generatedAt}}/g, String(data.generatedAt || new Date().toISOString()));

        return result;
      }
    });

    // Signal alert template
    this.templates.set("signal-alert", {
      name: "signal-alert",
      template: `🚨 **SIGNAL ALERT** 🚨

**Type**: {{type}}
**Severity**: {{severity}}
**Entity**: {{entityName}}
**Confidence**: {{confidence}}

{{description}}

**Related Entities**: {{#each relatedEntities}}{{this}}, {{/each}}
**Sources**: {{#each citedSources}}{{this}}, {{/each}}

*Detected at {{detectedAt}}*
`,
      render: (data: Record<string, unknown>) => {
        let result = data.template as string;

        result = result.replace(/{{type}}/g, String(data.type || ''));
        result = result.replace(/{{severity}}/g, String(data.severity || ''));
        result = result.replace(/{{entityName}}/g, String(data.entityName || ''));
        result = result.replace(/{{confidence}}/g, String(data.confidence || ''));
        result = result.replace(/{{description}}/g, String(data.description || ''));

        if (Array.isArray(data.relatedEntities)) {
          const related = data.relatedEntities.join(', ');
          result = result.replace(/{{#each relatedEntities}}[\s\S]*?{{\/each}}/g, related);
        }

        if (Array.isArray(data.citedSources)) {
          const sources = data.citedSources.join(', ');
          result = result.replace(/{{#each citedSources}}[\s\S]*?{{\/each}}/g, sources);
        }

        result = result.replace(/{{detectedAt}}/g, String(data.detectedAt || new Date().toISOString()));

        return result;
      }
    });

    // Committee report template
    this.templates.set("committee-report", {
      name: "committee-report",
      template: `# Committee Report: {{committeeName}}

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
`,
      render: (data: Record<string, unknown>) => {
        let result = data.template as string;

        result = result.replace(/{{committeeName}}/g, String(data.committeeName || ''));
        result = result.replace(/{{meetingNumber}}/g, String(data.meetingNumber || ''));
        result = result.replace(/{{date}}/g, String(data.date || ''));
        result = result.replace(/{{subject}}/g, String(data.subject || ''));
        result = result.replace(/{{summary}}/g, String(data.summary || ''));

        if (Array.isArray(data.keyPoints)) {
          const points = data.keyPoints.map(p => `- ${p}`).join('\n');
          result = result.replace(/{{#each keyPoints}}[\s\S]*?{{\/each}}/g, points);
        }

        if (Array.isArray(data.recommendations)) {
          const recs = data.recommendations.map(r => `- ${r}`).join('\n');
          result = result.replace(/{{#each recommendations}}[\s\S]*?{{\/each}}/g, recs);
        }

        if (Array.isArray(data.participants)) {
          const participants = data.participants.map(p =>
            `- ${p.name} (${p.party || 'Unknown'}): "${p.quote || ''}"`
          ).join('\n');
          result = result.replace(/{{#each participants}}[\s\S]*?{{\/each}}/g, participants);
        }

        result = result.replace(/{{sourceUrl}}/g, String(data.sourceUrl || ''));
        result = result.replace(/{{generatedAt}}/g, String(data.generatedAt || new Date().toISOString()));

        return result;
      }
    });
  }

  /**
   * Generate a brief from graph data and context
   */
  generateBrief(
    title: string,
    summary: string,
    sections: BriefSection[],
    citations: BriefCitation[],
    metadata: Record<string, unknown> = {}
  ): Brief {
    const id = `brief-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    return {
      id,
      title,
      summary,
      sections,
      citations,
      metadata,
      generatedAt: now,
      expiresAt: undefined, // No expiration by default
    };
  }

  /**
   * Generate a signal alert from detected anomalies
   */
  generateSignal(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    entityName: string,
    description: string,
    relatedEntities: string[] = [],
    citedSources: string[] = [],
    confidence: number = 0.8
  ): Signal {
    const id = `signal-${crypto.randomUUID()}`;

    return {
      id,
      type,
      severity,
      entityName,
      description,
      relatedEntities,
      citedSources,
      confidence,
      detectedAt: new Date().toISOString(),
    };
  }

  /**
   * Render a brief using a template
   */
  renderBrief(templateName: string, brief: Brief): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    return template.render({
      ...brief,
      template: template.template,
    });
  }

  /**
   * Render a signal using a template
   */
  renderSignal(templateName: string, signal: Signal): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    return template.render({
      ...signal,
      template: template.template,
    });
  }

  /**
   * Get available templates
   */
  getTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Add a custom template
   */
  addTemplate(name: string, template: BriefTemplate): void {
    this.templates.set(name, template);
  }

  /**
   * Remove a template
   */
  removeTemplate(name: string): boolean {
    return this.templates.delete(name);
  }
}