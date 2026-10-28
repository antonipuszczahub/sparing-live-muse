/**
 * The open-weights provider. Every host that serves the weights speaks the same OpenAI-compatible
 * protocol, so the character runs unchanged on any of them. Which host is used comes from OPEN_HOST,
 * or is detected from whichever key is present.
 */
export interface OpenHost {
  id: string;
  label: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

interface Preset {
  label: string;
  baseURL: string;
  keyEnv: string;
  /** Model id the host serves. Empty when it differs per deployment and OPEN_MODEL must say. */
  model: string;
}

const PRESETS: Record<string, Preset> = {
  // Hackathon model id; it is not the one in Baseten's own docs.
  baseten: { label: 'Baseten', baseURL: 'https://inference.baseten.co/v1', keyEnv: 'BASETEN_API_KEY', model: 'meta-models/muse-spark-open-1026' },
  fireworks: { label: 'Fireworks', baseURL: 'https://api.fireworks.ai/inference/v1', keyEnv: 'FIREWORKS_API_KEY', model: '' },
  ollama: { label: 'Ollama (local)', baseURL: 'http://localhost:11434/v1', keyEnv: '', model: '' },
  // Anything else that is OpenAI-compatible, for example a vLLM endpoint deployed on Modal.
  custom: { label: '', baseURL: '', keyEnv: 'OPEN_API_KEY', model: '' },
};

function labelFor(baseURL: string): string {
  try {
    const host = new URL(baseURL).hostname;
    return host.endsWith('.modal.run') ? 'Modal' : host;
  } catch {
    return 'custom host';
  }
}

/** The configured open-weights host, or null when nothing usable is set. */
export function openHost(env: Record<string, string | undefined> = process.env): OpenHost | null {
  const asked = env.OPEN_HOST?.toLowerCase();
  const id =
    asked && PRESETS[asked]
      ? asked
      : env.BASETEN_API_KEY
        ? 'baseten'
        : env.FIREWORKS_API_KEY
          ? 'fireworks'
          : env.OPEN_BASE_URL
            ? 'custom'
            : '';
  if (!id) return null;

  const p = PRESETS[id]!;
  const baseURL = env.OPEN_BASE_URL || p.baseURL;
  const model = env.OPEN_MODEL || p.model;
  const apiKey = env.OPEN_API_KEY || (p.keyEnv ? env[p.keyEnv] : '') || (id === 'ollama' ? 'ollama' : '');
  if (!baseURL || !model || !apiKey) return null;

  return { id, label: env.OPEN_LABEL || p.label || labelFor(baseURL), baseURL, apiKey, model };
}
