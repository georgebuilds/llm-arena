import { defineStore } from "pinia";
import type { Mode, ModeConfigs } from "~/types";
import { PERSONA_RANDOM } from "~/types";
import { DEFAULT_MODE_CONFIGS } from "~/data/modes";

interface State {
  apiKey: string;
  model1: string;
  model2: string;
  /** Persona id, "none", or "random" (resolved at conversation start). */
  persona1: string;
  persona2: string;
  mode: Mode;
  /** Per-mode field state — preserved across mode switches. */
  configs: ModeConfigs;
  maxRounds: number;
  /** Optional natural-language stop condition. Empty = max rounds is the only cap. */
  stopCondition: string;
  /** Model used for stop-condition evaluation and judge/summarizer calls. Defaults to model1. */
  judgeModel: string;
}

const STORAGE_KEY = "llm-arena-settings-v2";

const defaultState: State = {
  apiKey: "",
  model1: "",
  model2: "",
  persona1: PERSONA_RANDOM,
  persona2: PERSONA_RANDOM,
  mode: "debate",
  configs: structuredClone(DEFAULT_MODE_CONFIGS),
  maxRounds: 5,
  stopCondition: "",
  judgeModel: "",
};

function loadInitial(): State {
  if (import.meta.server) return structuredClone(defaultState);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw) as Partial<State>;
    // Merge configs deeply so we pick up any new defaults added in updates
    // without clobbering what the user has typed.
    const configs = {
      ...structuredClone(DEFAULT_MODE_CONFIGS),
      ...(parsed.configs ?? {}),
    } as ModeConfigs;
    return {
      ...structuredClone(defaultState),
      ...parsed,
      configs,
    };
  } catch {
    return structuredClone(defaultState);
  }
}

export const useSettingsStore = defineStore("settings", {
  state: (): State => loadInitial(),

  getters: {
    hasApiKey: (state) => state.apiKey.trim().length > 0,
    isReady: (state) =>
      state.apiKey.trim().length > 0 &&
      state.model1.trim().length > 0 &&
      state.model2.trim().length > 0,
    /** The judge/evaluator model; falls back to model1 if not explicitly set. */
    effectiveJudgeModel: (state) => state.judgeModel.trim() || state.model1,
  },

  actions: {
    persist() {
      if (import.meta.server) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state));
      } catch {
        /* ignore quota errors */
      }
    },
    setApiKey(value: string) {
      this.apiKey = value.trim();
      this.persist();
    },
    setModel1(value: string) {
      this.model1 = value.trim();
      this.persist();
    },
    setModel2(value: string) {
      this.model2 = value.trim();
      this.persist();
    },
    setPersona1(value: string) {
      this.persona1 = value;
      this.persist();
    },
    setPersona2(value: string) {
      this.persona2 = value;
      this.persist();
    },
    setMode(value: Mode) {
      this.mode = value;
      this.persist();
    },
    setMaxRounds(value: number) {
      this.maxRounds = Math.max(1, Math.min(50, Math.floor(value)));
      this.persist();
    },
    setStopCondition(value: string) {
      this.stopCondition = value;
      this.persist();
    },
    setJudgeModel(value: string) {
      this.judgeModel = value.trim();
      this.persist();
    },
    setConfig<K extends keyof ModeConfigs>(mode: K, config: ModeConfigs[K]) {
      this.configs[mode] = config;
      this.persist();
    },
    clearApiKey() {
      this.apiKey = "";
      this.persist();
    },
    hydrateFromStorage() {
      if (import.meta.server) return;
      this.$patch(loadInitial());
    },
  },
});
