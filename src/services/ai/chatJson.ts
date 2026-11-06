import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '../../config/env';
import { getOpenAI } from '../../lib/openai';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';

interface ChatJsonOptions<T extends z.ZodTypeAny> {
  system: string;
  user: string;
  schema: T;
  temperature?: number;
  maxTokens?: number;
}

const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (error: unknown) =>
  error instanceof OpenAI.APIConnectionError ||
  (error instanceof OpenAI.APIError && (error.status === 429 || (error.status ?? 0) >= 500));

/**
 * One chat completion that must answer with a JSON object matching `schema`.
 * Retries rate limits and transient failures with backoff; never exposes the
 * model's raw output to the client.
 */
export const chatJson = async <T extends z.ZodTypeAny>({
  system,
  user,
  schema,
  temperature = 0.2,
  maxTokens = 600,
}: ChatJsonOptions<T>): Promise<z.infer<T>> => {
  let content: string | null | undefined;

  for (let attempt = 1; ; attempt++) {
    try {
      const completion = await getOpenAI().chat.completions.create({
        model: env.OPENAI_MODEL,
        response_format: { type: 'json_object' },
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      content = completion.choices[0]?.message?.content;
      break;
    } catch (error) {
      if (attempt < MAX_ATTEMPTS && isRetryable(error)) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      if (error instanceof OpenAI.APIError && error.status === 429) {
        throw AppError.tooManyRequests('El servicio de IA está saturado. Intenta en unos segundos.');
      }
      logger.error('Error llamando a OpenAI', error instanceof Error ? error.message : error);
      throw AppError.serviceUnavailable('El servicio de IA no está disponible en este momento.');
    }
  }

  let json: unknown;
  try {
    json = JSON.parse(content ?? '');
  } catch {
    json = undefined;
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.warn('Respuesta de IA con formato inesperado', parsed.error.issues.slice(0, 3));
    throw AppError.badGateway('La IA devolvió una respuesta inválida. Intenta de nuevo.', 'AI_BAD_RESPONSE');
  }
  return parsed.data;
};
