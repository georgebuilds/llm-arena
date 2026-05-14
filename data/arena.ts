// Curated combatants and personality masks for LLM Arena.
// Tier maps to helmet silhouette (basic/advance/ultra).
// Brand maps to visor color + ear-plate logo.

export type BrandKey =
  | "openai"
  | "xai"
  | "anthropic"
  | "meta"
  | "deepseek"
  | "gemini"
  | "mistral";

export type Tier = "basic" | "advance" | "ultra";

export interface Brand {
  key: BrandKey;
  name: string;
  color: string;
  /** CSS filter applied to the master helmet SVG to recolor the cyan visor. */
  filter: string;
}

export interface Model {
  id: string;
  brand: BrandKey;
  tier: Tier;
  displayName: string;
  /** OpenRouter model identifier — used when streaming a real bout. */
  openrouterId: string;
}

export interface Mask {
  id: string;
  name: string;
  description: string;
  color: string;
}

export const BRANDS: Record<BrandKey, Brand> = {
  openai:    { key: "openai",    name: "OpenAI",    color: "#10a37f", filter: "hue-rotate(-15deg) saturate(0.85)" },
  xai:       { key: "xai",       name: "xAI",       color: "#9aa0a6", filter: "saturate(0) brightness(1.05)" },
  anthropic: { key: "anthropic", name: "Anthropic", color: "#d97757", filter: "hue-rotate(-165deg) saturate(1.4)" },
  meta:      { key: "meta",      name: "Meta",      color: "#0866ff", filter: "hue-rotate(45deg) saturate(1.6)" },
  deepseek:  { key: "deepseek",  name: "DeepSeek",  color: "#4d6bfe", filter: "hue-rotate(60deg) saturate(1.5)" },
  gemini:    { key: "gemini",    name: "Gemini",    color: "#9168c0", filter: "hue-rotate(95deg) saturate(1.2)" },
  mistral:   { key: "mistral",   name: "Mistral",   color: "#ff5d00", filter: "hue-rotate(-155deg) saturate(1.8)" },
};

export const MODELS: Model[] = [
  { id: "gpt-4o-mini",    brand: "openai",    tier: "basic",   displayName: "GPT-4o Mini",     openrouterId: "openai/gpt-4o-mini" },
  { id: "gpt-4o",         brand: "openai",    tier: "advance", displayName: "GPT-4o",          openrouterId: "openai/gpt-4o" },
  { id: "o1",             brand: "openai",    tier: "ultra",   displayName: "o1",              openrouterId: "openai/o1" },
  { id: "claude-haiku",   brand: "anthropic", tier: "basic",   displayName: "Claude Haiku",    openrouterId: "anthropic/claude-3.5-haiku" },
  { id: "claude-sonnet",  brand: "anthropic", tier: "advance", displayName: "Claude Sonnet",   openrouterId: "anthropic/claude-sonnet-4" },
  { id: "claude-opus",    brand: "anthropic", tier: "ultra",   displayName: "Claude Opus",     openrouterId: "anthropic/claude-opus-4" },
  { id: "llama-scout",    brand: "meta",      tier: "basic",   displayName: "Llama Scout",     openrouterId: "meta-llama/llama-4-scout" },
  { id: "llama-maverick", brand: "meta",      tier: "advance", displayName: "Llama Maverick",  openrouterId: "meta-llama/llama-4-maverick" },
  { id: "llama-behemoth", brand: "meta",      tier: "ultra",   displayName: "Llama Behemoth",  openrouterId: "meta-llama/llama-4-behemoth" },
  { id: "deepseek-v3",    brand: "deepseek",  tier: "advance", displayName: "DeepSeek V3",     openrouterId: "deepseek/deepseek-chat" },
  { id: "deepseek-r1",    brand: "deepseek",  tier: "ultra",   displayName: "DeepSeek R1",     openrouterId: "deepseek/deepseek-r1" },
  { id: "gemini-flash",   brand: "gemini",    tier: "basic",   displayName: "Gemini Flash",    openrouterId: "google/gemini-2.0-flash-001" },
  { id: "gemini-pro",     brand: "gemini",    tier: "advance", displayName: "Gemini Pro",      openrouterId: "google/gemini-2.5-pro" },
  { id: "gemini-ultra",   brand: "gemini",    tier: "ultra",   displayName: "Gemini Ultra",    openrouterId: "google/gemini-2.5-pro" },
];

/** Brief system-prompt flavor injected per mask. Keep terse — bullets compose
 *  into the model's overall system prompt, so each line should set tone in
 *  one sentence. Add new mask entries here when you add new MASKS. */
export const MASK_PROMPTS: Record<string, string> = {
  unmasked:    "",
  adversary:   "Take a sharp adversarial stance: challenge every premise, demand justification, concede only what is rigorously shown.",
  scholar:     "Reason carefully and cite where you can. Treat every claim like it needs to survive peer review.",
  coach:       "Speak warmly and directly. Acknowledge effort, then push toward sharper clarity.",
  skeptic:     "Demand evidence for every assertion. Distinguish what is claimed from what is shown.",
  storyteller: "Wrap each idea in a brief vivid image. Lead with scene, end with point.",
  strategist:  "Think three moves ahead. Map second-order effects and who actually bears the cost.",
  trickster:   "Be playful and lateral. Find the off-axis angle nobody else saw.",
};

export interface JudgingCriterion {
  id: string;
  label: string;
}

export const JUDGING_CRITERIA: JudgingCriterion[] = [
  { id: "clarity",     label: "Clarity" },
  { id: "originality", label: "Originality" },
  { id: "persuasion",  label: "Persuasion" },
  { id: "rigor",       label: "Rigor" },
  { id: "empathy",     label: "Empathy" },
  { id: "wit",         label: "Wit" },
];

export const MASKS: Mask[] = [
  { id: "unmasked",    name: "Unmasked",    description: "No persona — the model speaks as itself", color: "#8b929d" }, // grey, default
  { id: "adversary",   name: "Adversary",   description: "Challenges every premise",    color: "#ef4444" }, // red
  { id: "scholar",     name: "Scholar",     description: "Cites and reasons carefully", color: "#3b82f6" }, // blue
  { id: "coach",       name: "Coach",       description: "Encouraging and direct",      color: "#f59e0b" }, // amber
  { id: "skeptic",     name: "Skeptic",     description: "Demands evidence",            color: "#06b6d4" }, // cyan
  { id: "storyteller", name: "Storyteller", description: "Wraps ideas in narrative",    color: "#a855f7" }, // purple
  { id: "strategist",  name: "Strategist",  description: "Plans three moves ahead",     color: "#10b981" }, // emerald
  { id: "trickster",   name: "Trickster",   description: "Lateral, playful, unbound",   color: "#ec4899" }, // pink
];
