// SPDX-License-Identifier: AGPL-3.0-only
export interface CuratedModel {
  id: string;
  name: string;
  provider: string;
  priority: number;
  tasks: Array<'chat' | 'analysis' | 'semantic'>;
}

export const CURATED_MODELS: CuratedModel[] = [
  {
    id: 'qwen3.5-27b',
    name: 'Qwen 3.5 27B',
    provider: 'openai-compatible',
    priority: 1,
    tasks: ['chat', 'analysis'],
  },
  {
    id: 'llama3.1-8b',
    name: 'Llama 3.1 8B',
    provider: 'openai-compatible',
    priority: 2,
    tasks: ['chat'],
  },
  {
    id: 'mixtral-8x7b',
    name: 'Mixtral 8x7B',
    provider: 'openai-compatible',
    priority: 2,
    tasks: ['analysis'],
  },
  {
    id: 'gte-large-en-v1.5',
    name: 'GTE Large EN v1.5',
    provider: 'openai-compatible',
    priority: 1,
    tasks: ['semantic'],
  },
  {
    id: 'Carnice-Qwen3.6-MoE-35B-A3B.IQ4_XS.gguf',
    name: 'Carnice Qwen3.6 MoE 35B (GGUF)',
    provider: 'llama.cpp',
    priority: 3,
    tasks: ['chat', 'analysis', 'semantic'],
  },
];

export function selectModel(task: 'chat' | 'analysis' | 'semantic'): string {
  const sorted = [...CURATED_MODELS]
    .filter(m => m.tasks.includes(task))
    .sort((a, b) => a.priority - b.priority);
  return sorted[0]?.id ?? 'Carnice-Qwen3.6-MoE-35B-A3B.IQ4_XS.gguf';
}
