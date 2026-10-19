export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'cerebras' | 'custom-openai';
export type ProviderConfig = { provider: ProviderId; apiKey: string; model: string; baseUrl?: string };
export type ProviderTestResult = { ok: true; provider: ProviderId; model: string } | { ok: false; code: 'invalid-configuration' | 'invalid-credentials' | 'unsupported-model' | 'rate-limited' | 'network-error' | 'provider-error'; message: string };

const defaults: Record<Exclude<ProviderId, 'custom-openai'>, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  cerebras: 'https://api.cerebras.ai/v1',
};
function endpoint(config: ProviderConfig): string {
  const base = config.baseUrl ?? (config.provider === 'custom-openai' ? '' : defaults[config.provider]);
  if (!base || !config.apiKey || !config.model) throw new Error('Provider, API key, model, and endpoint are required');
  return config.provider === 'gemini' ? `${base}/models/${encodeURIComponent(config.model)}?key=${encodeURIComponent(config.apiKey)}` : `${base.replace(/\/$/, '')}/models`;
}

/** Makes a real minimal provider request. API keys are never included in errors. */
export async function testProvider(config: ProviderConfig, fetcher: typeof fetch = fetch): Promise<ProviderTestResult> {
  try {
    const url = endpoint(config);
    const response = await fetcher(url, { headers: config.provider === 'gemini' ? {} : { authorization: `Bearer ${config.apiKey}` } });
    if (response.ok) return { ok: true, provider: config.provider, model: config.model };
    if (response.status === 401 || response.status === 403) return { ok: false, code: 'invalid-credentials', message: 'The provider rejected the API key.' };
    if (response.status === 404) return { ok: false, code: 'unsupported-model', message: 'The configured endpoint or model was not found.' };
    if (response.status === 429) return { ok: false, code: 'rate-limited', message: 'The provider rate limit or quota was reached.' };
    return { ok: false, code: 'provider-error', message: `Provider returned HTTP ${response.status}.` };
  } catch (error) {
    return { ok: false, code: error instanceof Error && error.message.includes('required') ? 'invalid-configuration' : 'network-error', message: error instanceof Error ? error.message : 'Provider connection failed.' };
  }
}
