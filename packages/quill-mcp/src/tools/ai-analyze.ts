// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { chatCompletion } from '../ai/gateway.js';

/**
 * AI Analyze Tool
 *
 * Analyze a document, transcript, or data set using AI.
 * Detects topics, sentiment, entities, and generates a structured summary.
 */

export const definition: ToolDefinition = {
  name: 'ai_analyze',
  description:
    'Analyze a document, transcript, or data set using AI. Detects topics, sentiment, entities, ' +
    'and generates a structured summary with metadata. Supports different analysis modes.',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        maxLength: 500,
        description: 'The text content to analyze (document, transcript, article, or data excerpt)',
      },
      analysis_type: {
        type: 'string',
        enum: ['summary', 'entities', 'sentiment', 'topics', 'full'],
        description: 'Type of analysis to perform (default: "full")',
      },
    },
    required: ['text'],
  },
};

/**
 * Get the appropriate system prompt based on analysis type.
 */
function getPrompt(analysisType: string): { system: string; format: string } {
  const prompts: Record<string, { system: string; format: string }> = {
    summary: {
      system:
        'You are a document analysis expert. Generate a concise, structured summary of the provided text. ' +
        'Focus on key points, main arguments, conclusions, and significant details. ' +
        'Respond ONLY with valid JSON in the format specified.',
      format: `{
  "summary": "2-3 paragraph concise summary of the content",
  "keyPoints": ["key point 1", "key point 2", "..."],
  "documentType": "inferred type (article, transcript, report, dataset, etc.)",
  "language": "primary language detected"
}`,
    },
    entities: {
      system:
        'You are an entity extraction expert. Identify all named entities in the provided text. ' +
        'Categorize them by type (person, organization, location, legislation, date, etc.). ' +
        'Respond ONLY with valid JSON in the format specified.',
      format: `{
  "entities": {
    "persons": [{"name": "...", "role": "..."}],
    "organizations": [{"name": "...", "context": "..."}],
    "locations": ["location 1", "location 2"],
    "legislation": ["act or regulation name"],
    "dates": ["mentioned dates"],
    "other": [{"term": "...", "type": "..."}]
  },
  "entityCount": 0
}`,
    },
    sentiment: {
      system:
        'You are a sentiment analysis expert. Analyze the sentiment, tone, and emotional valence of the provided text. ' +
        'Assess overall sentiment, identify emotional shifts, and note strong language. ' +
        'Respond ONLY with valid JSON in the format specified.',
      format: `{
  "overallSentiment": "positive|negative|neutral|mixed",
  "sentimentScore": 0.0,
  "tone": ["tone descriptor 1", "tone descriptor 2"],
  "emotionalHighlights": [{"passage": "...", "emotion": "..."}],
  "languageIntensity": "low|moderate|high",
  "biasIndicators": ["indicator 1"] | null
}`,
    },
    topics: {
      system:
        'You are a topic analysis expert. Identify the main topics, themes, and subjects discussed in the provided text. ' +
        'Extract key themes, subtopics, and their relative significance. ' +
        'Respond ONLY with valid JSON in the format specified.',
      format: `{
  "primaryTopics": [{"topic": "...", "relevance": "high|medium|low"}],
  "secondaryTopics": [{"topic": "...", "relevance": "..."}],
  "keyThemes": ["theme 1", "theme 2"],
  "domain": "policy domain or subject area",
  "canadianContext": "mention of Canadian-specific context if any"
}`,
    },
    full: {
      system:
        'You are a comprehensive document analysis expert. Perform a full analysis of the provided text: ' +
        'generate a summary, extract entities, analyze sentiment, identify topics, and assess key themes. ' +
        'Respond ONLY with valid JSON in the format specified.',
      format: `{
  "summary": {
    "overview": "2-3 paragraph concise summary",
    "keyPoints": ["key point 1", "key point 2"],
    "documentType": "inferred document type",
    "language": "primary language"
  },
  "entities": {
    "persons": [{"name": "...", "role": "..."}],
    "organizations": [{"name": "...", "context": "..."}],
    "locations": ["location 1"],
    "legislation": ["act or regulation name"],
    "dates": ["mentioned dates"]
  },
  "sentiment": {
    "overallSentiment": "positive|negative|neutral|mixed",
    "sentimentScore": 0.0,
    "tone": ["tone descriptors"],
    "languageIntensity": "low|moderate|high"
  },
  "topics": {
    "primaryTopics": [{"topic": "...", "relevance": "high|medium|low"}],
    "secondaryTopics": [{"topic": "...", "relevance": "..."}],
    "keyThemes": ["theme 1"],
    "domain": "policy domain or subject area"
  },
  "metadata": {
    "estimatedLength": "word count estimate",
    "readabilityLevel": "basic|moderate|advanced|technical",
    "sections": "number of distinct sections if detectable"
  }
}`,
    },
  };

  return prompts[analysisType] || prompts.full;
}

export const handler: ToolHandler = async (args) => {
  const text = (args.text as string) ?? '';
  if (!text.trim()) {
    return {
      content: {
        tool: 'ai_analyze',
        text: '',
        analysis_type: (args.analysis_type as string) ?? 'full',
        error: 'No text provided. Please include text content to analyze.',
      },
      isError: true,
    };
  }

  const analysisType = (args.analysis_type as string) ?? 'full';

  try {
    const prompt = getPrompt(analysisType);

    // Truncate input to prevent token overflow (50K chars should be safe for most models)
    const truncatedText = text.slice(0, 50_000);
    const charCount = truncatedText.length;

    const userMessage = `${prompt.format}\n\nText to analyze:\n\n${truncatedText}`;

    const result = await chatCompletion(
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.3, maxTokens: 4096, jsonMode: true },
    );

    // Try to parse the JSON response
    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(result.content);
    } catch {
      // If JSON parsing fails, return the raw content with a note
      analysis = { rawAnalysis: result.content, note: 'Could not parse structured JSON from response' };
    }

    return {
      content: {
        tool: 'ai_analyze',
        textPreview: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
        analysisType,
        charCount,
        analysis,
        model: result.model,
        usage: result.usage,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'ai_analyze',
        textPreview: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
        analysisType: (args.analysis_type as string) ?? 'full',
        error: `Analysis failed: ${(error as Error).message}`,
      },
      isError: true,
    };
  }
};
