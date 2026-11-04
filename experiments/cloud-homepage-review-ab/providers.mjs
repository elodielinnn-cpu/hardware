import { MAX_OUTPUT_TOKENS, redactError } from "./lib.mjs";

export function createGroqRequest({ config, schema, systemPrompt, candidate, apiKey }) {
  return {
    url: config.endpoint,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.modelId,
        temperature: 0,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: JSON.stringify(candidate) }],
        response_format: { type: "json_schema", json_schema: { name: "homepage_quality_review", strict: true, schema } }
      })
    }
  };
}

export function parseGroqResponse(payload, configuredModel) {
  return {
    rawContent: payload.choices?.[0]?.message?.content || "",
    actualModelId: payload.model || configuredModel,
    usage: { inputTokens: payload.usage?.prompt_tokens || 0, outputTokens: payload.usage?.completion_tokens || 0 },
    finishReason: payload.choices?.[0]?.finish_reason || null
  };
}

export function createGeminiRequest({ config, schema, systemPrompt, candidate, apiKey }) {
  const url = config.endpointTemplate.replace("{model}", encodeURIComponent(config.modelId));
  return {
    url,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(candidate) }] }],
        generationConfig: { temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS, responseMimeType: "application/json", responseJsonSchema: schema }
      })
    }
  };
}

export function parseGeminiResponse(payload, configuredModel) {
  return {
    rawContent: payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "",
    actualModelId: payload.modelVersion || configuredModel,
    usage: { inputTokens: payload.usageMetadata?.promptTokenCount || 0, outputTokens: payload.usageMetadata?.candidatesTokenCount || 0 },
    finishReason: payload.candidates?.[0]?.finishReason || null
  };
}

export const adapters = {
  groq: { createRequest: createGroqRequest, parseResponse: parseGroqResponse, minimumIntervalMs: 2100 },
  gemini: { createRequest: createGeminiRequest, parseResponse: parseGeminiResponse, minimumIntervalMs: 6100 }
};

export async function requestProvider({ provider, providerConfig, schema, systemPrompt, candidate, apiKey, fetchImpl, timeoutMs, maxRetries, sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const adapter = adapters[provider];
  let retryWaitMs = 0;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    try {
      const request = adapter.createRequest({ config: providerConfig, schema, systemPrompt, candidate, apiKey });
      const response = await fetchImpl(request.url, { ...request.init, signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${redactError(payload.error?.message || response.statusText)}`);
        error.status = response.status;
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          const waitMs = Math.min(30_000, Number(response.headers?.get?.("retry-after")) * 1000 || 1000 * (attempt + 1));
          retryWaitMs += waitMs;
          await sleepImpl(waitMs);
          continue;
        }
        throw error;
      }
      return { ...adapter.parseResponse(payload, providerConfig.modelId), requestLatencyMs: Date.now() - startedAt, retryCount: attempt, retryWaitMs };
    } catch (error) {
      if (error.name === "AbortError") return { error: { type: "timeout", message: "request timed out" }, requestLatencyMs: Date.now() - startedAt, retryCount: attempt, retryWaitMs };
      if (attempt >= maxRetries || ![429, 500, 502, 503, 504].includes(error.status)) return { error: { type: "http", status: error.status || null, message: redactError(error.message) }, requestLatencyMs: Date.now() - startedAt, retryCount: attempt, retryWaitMs };
    } finally {
      clearTimeout(timeout);
    }
  }
}
