import OpenAI from 'openai';
import { env } from '../config/env';

let client: OpenAI | undefined;

// Created on first use so the API key is read after the config has loaded
export const getOpenAI = (): OpenAI => {
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 0 });
  return client;
};
