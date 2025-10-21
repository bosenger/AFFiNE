import {
  defineModuleConfig,
  StorageJSONSchema,
  StorageProviderConfig,
} from '../../base';
import { CopilotPromptScenario } from './prompt/prompts';
import {
  AnthropicOfficialConfig,
  AnthropicVertexConfig,
} from './providers/anthropic';
import type { FalConfig } from './providers/fal';
import { GeminiGenerativeConfig, GeminiVertexConfig } from './providers/gemini';
import { MorphConfig } from './providers/morph';
import { OpenAIConfig } from './providers/openai';
import { PerplexityConfig } from './providers/perplexity';
import { QwenConfig } from './providers/qwen';
import { VertexSchema } from './providers/types';
declare global {
  interface AppConfigSchema {
    copilot: {
      enabled: boolean;
      unsplash: ConfigItem<{
        key: string;
      }>;
      exa: ConfigItem<{
        key: string;
      }>;
      storage: ConfigItem<StorageProviderConfig>;
      scenarios: ConfigItem<CopilotPromptScenario>;
      providers: {
        openai: ConfigItem<OpenAIConfig>;
        qwen: ConfigItem<QwenConfig>;
        fal: ConfigItem<FalConfig>;
        gemini: ConfigItem<GeminiGenerativeConfig>;
        geminiVertex: ConfigItem<GeminiVertexConfig>;
        perplexity: ConfigItem<PerplexityConfig>;
        anthropic: ConfigItem<AnthropicOfficialConfig>;
        anthropicVertex: ConfigItem<AnthropicVertexConfig>;
        morph: ConfigItem<MorphConfig>;
      };
    };
  }
}

defineModuleConfig('copilot', {
  enabled: {
    desc: 'Whether to enable the copilot plugin. <br> Document: <a href="https://docs.affine.pro/self-host-affine/administer/ai" target="_blank">https://docs.affine.pro/self-host-affine/administer/ai</a>',
    default: false,
  },
  scenarios: {
    desc: 'Use custom models in scenarios and override default settings.',
    default: {
      override_enabled: false,
      scenarios: {
        audio_transcribing: 'qwen-plus',
        chat: 'qwen-plus',
        embedding: 'text-embedding-v4',
        image: 'wanx-v1',
        rerank: 'qwen-plus',
        coding: 'qwen-coder-plus',
        complex_text_generation: 'qwen-max',
        quick_decision_making: 'qwq-32b-preview',
        quick_text_generation: 'qwen-plus',
        polish_and_summarize: 'qwen-plus',
      },
    },
  },
  'providers.openai': {
    desc: 'The config for the openai provider.',
    default: {
      apiKey: '',
      baseURL: 'https://api.openai.com/v1',
    },
    link: 'https://github.com/openai/openai-node',
  },
  'providers.qwen': {
    desc: 'The config for the qwen provider.',
    default: {
      apiKey: '',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      version: '',
    },
  },
  'providers.fal': {
    desc: 'The config for the fal provider.',
    default: {
      apiKey: '',
    },
  },
  'providers.gemini': {
    desc: 'The config for the gemini provider.',
    default: {
      apiKey: '',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    },
  },
  'providers.geminiVertex': {
    desc: 'The config for the gemini provider in Google Vertex AI.',
    default: {},
    schema: VertexSchema,
  },
  'providers.perplexity': {
    desc: 'The config for the perplexity provider.',
    default: {
      apiKey: '',
    },
  },
  'providers.anthropic': {
    desc: 'The config for the anthropic provider.',
    default: {
      apiKey: '',
      baseURL: 'https://api.anthropic.com/v1',
    },
  },
  'providers.anthropicVertex': {
    desc: 'The config for the anthropic provider in Google Vertex AI.',
    default: {},
    schema: VertexSchema,
  },
  'providers.morph': {
    desc: 'The config for the morph provider.',
    default: {},
  },
  unsplash: {
    desc: 'The config for the unsplash key.',
    default: {
      key: '',
    },
  },
  exa: {
    desc: 'The config for the exa web search key.',
    default: {
      key: '',
    },
  },
  storage: {
    desc: 'The config for the storage provider.',
    default: {
      provider: 'fs',
      bucket: 'copilot',
      config: {
        path: '~/.affine/storage',
      },
    },
    schema: StorageJSONSchema,
  },
});
