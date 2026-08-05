import { generateText, type CoreMessage } from "ai";

/**
 * Provider-agnostic AI adapter. The rest of the app only calls askAI(); which
 * provider/model runs is chosen entirely by environment variables, so switching
 * (or turning it off) is a config change in Vercel — no code change.
 *
 *   AI_PROVIDER = anthropic | openai | google
 *   AI_MODEL    = e.g. claude-haiku-4-5 | gpt-4o-mini | gemini-2.0-flash
 *   + the matching key:
 *       ANTHROPIC_API_KEY  /  OPENAI_API_KEY  /  GOOGLE_GENERATIVE_AI_API_KEY
 *   AI_BASE_URL (optional) — point at an OpenAI-compatible endpoint.
 *
 * Pick a vision-capable model so photo attachments work.
 */
export type AiMessage = CoreMessage;

type Provider = "anthropic" | "openai" | "google";

function config() {
  const provider = (process.env.AI_PROVIDER || "").toLowerCase() as Provider;
  const model = process.env.AI_MODEL || "";
  const key =
    provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : provider === "openai"
        ? process.env.OPENAI_API_KEY
        : provider === "google"
          ? process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY
          : undefined;
  return { provider, model, key, baseURL: process.env.AI_BASE_URL || undefined };
}

/** True when a provider, model and matching key are all set. */
export function isAIConfigured(): boolean {
  const { provider, model, key } = config();
  return Boolean(provider && model && key);
}

async function resolveModel() {
  const { provider, model, key, baseURL } = config();
  if (!provider || !model || !key) throw new Error("AI not configured");

  switch (provider) {
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({ apiKey: key, baseURL })(model);
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI({ apiKey: key, baseURL })(model);
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return createGoogleGenerativeAI({ apiKey: key, baseURL })(model);
    }
    default:
      throw new Error(`Unknown AI_PROVIDER: ${provider}`);
  }
}

/** Run a chat completion. Throws if not configured or the provider errors. */
export async function askAI(opts: {
  system: string;
  messages: AiMessage[];
}): Promise<string> {
  const model = await resolveModel();
  const { text } = await generateText({
    model,
    system: opts.system,
    messages: opts.messages,
    maxTokens: 1200,
    temperature: 0.3,
  });
  return text;
}
