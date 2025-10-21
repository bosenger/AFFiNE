import {
  createOpenAICompatible,
  type OpenAICompatibleProvider as VercelOpenAICompatibleProvider,
  type OpenAICompatibleProviderOptions,
} from '@ai-sdk/openai-compatible';
import {
  AISDKError,
  embedMany,
  experimental_generateImage as generateImage,
  generateObject,
  generateText,
  stepCountIs,
  streamText,
} from 'ai';

import {
  CopilotPromptInvalid,
  CopilotProviderSideError,
  metrics,
  UserFriendlyError,
} from '../../../base';
import { CopilotProvider } from './provider';
import type {
  CopilotChatOptions,
  CopilotEmbeddingOptions,
  CopilotImageOptions,
  CopilotStructuredOptions,
  ModelConditions,
  PromptMessage,
} from './types';
import { CopilotProviderType, ModelInputType, ModelOutputType } from './types';
import { chatToGPTMessage, TextStreamParser } from './utils';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

const REASONING_BLOCK_PATTERN =
  /<(think|thinking)>[\s\S]*?<\/(think|thinking)>/gi;
const REASONING_OPEN_TAG = /<(think|thinking)>/gi;
const REASONING_CLOSE_TAG = /<\/(think|thinking)>/gi;

export type QwenConfig = {
  apiKey?: string;
  baseURL?: string;
  version?: string;
};

export class QwenProvider extends CopilotProvider<QwenConfig> {
  readonly type = CopilotProviderType.Qwen;

  readonly models = [
    {
      name: 'Qwen Plus',
      id: 'qwen-plus',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Structured],
          defaultForOutputType: true,
        },
      ],
    },
    {
      name: 'Qwen Max',
      id: 'qwen-max',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Structured],
        },
      ],
    },
    {
      name: 'Qwen Coder Plus',
      id: 'qwen-coder-plus',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text],
        },
      ],
    },
    {
      name: 'Qwen VL Plus',
      id: 'qwen-vl-plus',
      capabilities: [
        {
          input: [ModelInputType.Text, ModelInputType.Image],
          output: [ModelOutputType.Text],
        },
      ],
    },
    {
      name: 'QWQ-32B Preview',
      id: 'qwq-32b-preview',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Text, ModelOutputType.Structured],
        },
      ],
    },
    {
      name: 'Text Embedding V4',
      id: 'text-embedding-v4',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Embedding],
          defaultForOutputType: true,
        },
      ],
    },
    {
      name: 'Text Embedding V3',
      id: 'text-embedding-v3',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Embedding],
        },
      ],
    },
    {
      name: 'Wanx V1',
      id: 'wanx-v1',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Image],
          defaultForOutputType: true,
        },
      ],
    },
  ];

  #instance: VercelOpenAICompatibleProvider | null = null;

  override configured(): boolean {
    return !!this.config.apiKey;
  }

  protected override setup() {
    super.setup();

    if (!this.configured()) {
      this.#instance = null;
      return;
    }

    const baseURL = this.config.baseURL?.trim() || DEFAULT_BASE_URL;
    const version = this.config.version?.trim();

    this.#instance = createOpenAICompatible({
      name: this.type,
      apiKey: this.config.apiKey,
      baseURL,
      queryParams: version ? { version } : undefined,
    });
  }

  private get instance(): VercelOpenAICompatibleProvider {
    if (!this.#instance) {
      throw new CopilotProviderSideError({
        provider: this.type,
        kind: 'not_configured',
        message: 'Qwen provider is not configured.',
      });
    }
    return this.#instance;
  }

  private formatReasoning(text: string, include: boolean): string {
    if (!text) {
      return '';
    }

    let result = text;
    if (include) {
      result = result
        .replace(REASONING_OPEN_TAG, '\n---\n')
        .replace(REASONING_CLOSE_TAG, '\n---\n')
        .replace(/(?:\n---\n\s*){2,}/g, '\n---\n');
    } else {
      result = result.replace(REASONING_BLOCK_PATTERN, '');
    }

    result = result.replace(/\n{3,}/g, '\n\n').trim();
    return result;
  }

  private handleError(error: any, model: string) {
    if (error instanceof UserFriendlyError) {
      return error;
    }
    if (error instanceof AISDKError) {
      return new CopilotProviderSideError({
        provider: this.type,
        kind: error.name || 'unexpected_response',
        message: error.message,
      });
    }
    return new CopilotProviderSideError({
      provider: this.type,
      kind: 'unexpected_response',
      message:
        error?.message || `Unexpected response from ${this.type} (${model})`,
    });
  }

  private getProviderOptions(
    options: CopilotChatOptions
  ): OpenAICompatibleProviderOptions {
    const result: OpenAICompatibleProviderOptions = {};
    if (options?.user) {
      result.user = options.user;
    }
    if (options?.reasoning) {
      result.reasoningEffort = 'medium';
    }
    return result;
  }

  async text(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): Promise<string> {
    const fullCond = { ...cond, outputType: ModelOutputType.Text };
    await this.checkParams({ messages, cond: fullCond, options });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai.counter('chat_text_calls').add(1, { model: model.id });

      const [system, msgs] = await chatToGPTMessage(messages);
      const modelInstance = this.instance(model.id);

      const { text } = await generateText({
        model: modelInstance,
        system,
        messages: msgs,
        temperature: options.temperature ?? 0,
        maxOutputTokens: options.maxTokens ?? 4096,
        providerOptions: {
          openaiCompatible: this.getProviderOptions(options),
        },
        tools: await this.getTools(options, model.id),
        stopWhen: stepCountIs(this.MAX_STEPS),
        abortSignal: options.signal,
      });

      return this.formatReasoning(text, !!options.reasoning);
    } catch (error) {
      metrics.ai.counter('chat_text_errors').add(1, { model: model.id });
      throw this.handleError(error, model.id);
    }
  }

  async *streamText(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): AsyncIterable<string> {
    const fullCond = { ...cond, outputType: ModelOutputType.Text };
    await this.checkParams({ messages, cond: fullCond, options });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai.counter('chat_text_stream_calls').add(1, { model: model.id });

      const [system, msgs] = await chatToGPTMessage(messages);
      const modelInstance = this.instance(model.id);
      const { fullStream } = streamText({
        model: modelInstance,
        system,
        messages: msgs,
        temperature: options.temperature ?? 0,
        maxOutputTokens: options.maxTokens ?? 4096,
        providerOptions: {
          openaiCompatible: this.getProviderOptions(options),
        },
        tools: await this.getTools(options, model.id),
        stopWhen: stepCountIs(this.MAX_STEPS),
        abortSignal: options.signal,
      });

      const textParser = new TextStreamParser();
      let aggregated = '';
      let finished = false;

      for await (const chunk of fullStream) {
        if (chunk.type === 'finish') {
          aggregated += textParser.end();
          finished = true;
        } else {
          aggregated += textParser.parse(chunk);
        }

        if (options.signal?.aborted) {
          await fullStream.cancel();
          return;
        }
      }

      if (!finished) {
        aggregated += textParser.end();
      }

      const result = this.formatReasoning(aggregated, !!options.reasoning);
      if (result.length) {
        yield result;
      }
    } catch (error) {
      metrics.ai.counter('chat_text_stream_errors').add(1, { model: model.id });
      throw this.handleError(error, model.id);
    }
  }

  override async structure(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotStructuredOptions = {}
  ): Promise<string> {
    const fullCond = { ...cond, outputType: ModelOutputType.Structured };
    await this.checkParams({ messages, cond: fullCond, options });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai.counter('chat_text_calls').add(1, { model: model.id });

      const [system, msgs, schema] = await chatToGPTMessage(messages);
      if (!schema) {
        throw new CopilotPromptInvalid('Schema is required');
      }

      const modelInstance = this.instance(model.id);
      const { object } = await generateObject({
        model: modelInstance,
        system,
        messages: msgs,
        schema,
        temperature: options.temperature ?? 0,
        maxOutputTokens: options.maxTokens ?? 4096,
        maxRetries: options.maxRetries ?? 3,
        providerOptions: {
          openaiCompatible: this.getProviderOptions(options),
        },
        abortSignal: options.signal,
      });

      return JSON.stringify(object);
    } catch (error) {
      metrics.ai.counter('chat_text_errors').add(1, { model: model.id });
      throw this.handleError(error, model.id);
    }
  }

  override async *streamImages(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotImageOptions = {}
  ) {
    const fullCond = { ...cond, outputType: ModelOutputType.Image };
    await this.checkParams({ messages, cond: fullCond, options });
    const model = this.selectModel(fullCond);

    metrics.ai
      .counter('generate_images_stream_calls')
      .add(1, { model: model.id });

    const { content: prompt, attachments } = [...messages].pop() || {};
    if (!prompt) {
      throw new CopilotPromptInvalid('Prompt is required');
    }

    if (attachments && attachments.length > 0) {
      throw new CopilotPromptInvalid(
        'Image editing with attachments is not supported by the Qwen provider yet.'
      );
    }

    try {
      const modelInstance = this.instance.imageModel(model.id);
      const result = await generateImage({
        model: modelInstance,
        prompt,
        providerOptions: {
          openaiCompatible: {},
        },
      });

      for (const image of result.images) {
        yield `data:image/png;base64,${image.base64}`;
        if (options.signal?.aborted) {
          break;
        }
      }
    } catch (error) {
      metrics.ai.counter('generate_images_errors').add(1, { model: model.id });
      throw this.handleError(error, model.id);
    }
  }

  override async embedding(
    cond: ModelConditions,
    messages: string | string[],
    options: CopilotEmbeddingOptions = {
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
    }
  ): Promise<number[][]> {
    const values = Array.isArray(messages) ? messages : [messages];
    const fullCond = { ...cond, outputType: ModelOutputType.Embedding };
    await this.checkParams({ embeddings: values, cond: fullCond, options });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai
        .counter('generate_embedding_calls')
        .add(1, { model: model.id });

      const modelInstance = this.instance.textEmbeddingModel(model.id);
      const { embeddings } = await embedMany({
        model: modelInstance,
        values,
        providerOptions: {
          openaiCompatible: {
            dimensions: options.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS,
          },
        },
      });

      return embeddings.filter(embedding => Array.isArray(embedding));
    } catch (error) {
      metrics.ai
        .counter('generate_embedding_errors')
        .add(1, { model: model.id });
      throw this.handleError(error, model.id);
    }
  }
}
