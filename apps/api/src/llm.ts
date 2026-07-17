import OpenAI from "openai";

import { definitions } from "./tools";

export type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export async function complete(messages: Message[]) {
  const { env } = await import("./env");
  const client = new OpenAI({
    apiKey: env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
    timeout: 30_000,
    maxRetries: 0,
  });
  const result = await client.chat.completions.create({
    model: env.DEEPSEEK_MODEL,
    messages,
    tools: definitions,
    max_tokens: 1000,
    ...{ thinking: { type: "disabled" } },
  });
  const choice = result.choices[0];

  if (!choice || !["stop", "tool_calls"].includes(choice.finish_reason)) {
    throw new Error("Incomplete response");
  }

  return choice.message;
}
