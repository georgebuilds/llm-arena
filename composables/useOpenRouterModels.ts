import type { OpenRouterModel } from "~/types";

const CACHE_KEY = "llm-arena-models-cache-v2";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

interface CacheShape {
  fetchedAt: number;
  models: OpenRouterModel[];
}

function readCache(): CacheShape | null {
  if (import.meta.server) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (!Array.isArray(parsed.models) || typeof parsed.fetchedAt !== "number") {
      return null;
    }
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(models: OpenRouterModel[]) {
  if (import.meta.server) return;
  try {
    const payload: CacheShape = { fetchedAt: Date.now(), models };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

/**
 * Keep any model that can hold a text chat — i.e. accepts text input and
 * produces text output. Multimodal models (text+image inputs, etc.) qualify
 * because we only ever send text; the extra capabilities are simply unused.
 *
 * Excluded: pure image generators (output != text), audio-only or vision-only
 * input models (input doesn't include text), embedding models.
 */
function isTextChatCapable(m: OpenRouterModel): boolean {
  const inputs = m.architecture?.input_modalities ?? [];
  const outputs = m.architecture?.output_modalities ?? [];
  const modality = (m.architecture?.modality ?? "").toLowerCase();

  if (modality.includes("embedding")) return false;

  // Output must include text.
  if (outputs.length > 0) {
    if (!outputs.includes("text")) return false;
  } else if (modality && !modality.includes("->text") && !modality.includes("text->text")) {
    return false;
  }

  // Input must include text. (Models with no listed inputs are treated as
  // legacy text chat models.)
  if (inputs.length > 0 && !inputs.includes("text")) return false;

  return true;
}

export function useOpenRouterModels() {
  const models = useState<OpenRouterModel[]>("openrouter-models", () => []);
  const loading = useState<boolean>("openrouter-models-loading", () => false);
  const error = useState<string | null>("openrouter-models-error", () => null);

  async function load(force = false) {
    if (import.meta.server) return;
    if (loading.value) return;
    if (!force) {
      const cached = readCache();
      if (cached) {
        models.value = cached.models;
        return;
      }
      if (models.value.length > 0) return;
    }
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`OpenRouter responded ${res.status}`);
      }
      const json = (await res.json()) as { data: OpenRouterModel[] };
      const filtered = json.data.filter(isTextChatCapable);
      filtered.sort((a, b) => a.id.localeCompare(b.id));
      models.value = filtered;
      writeCache(filtered);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load models";
    } finally {
      loading.value = false;
    }
  }

  const ids = computed(() => models.value.map((m) => m.id));

  /**
   * Accept any non-empty model id when the whitelist hasn't loaded yet — we
   * shouldn't gate the user on a fetch that may have failed (CORS, offline,
   * adblock). OpenRouter rejects invalid ids on the actual call anyway.
   */
  function isValidModelId(id: string): boolean {
    const trimmed = id.trim();
    if (!trimmed) return false;
    if (ids.value.length === 0) return true;
    return ids.value.includes(trimmed);
  }

  return { models, ids, loading, error, load, isValidModelId };
}
