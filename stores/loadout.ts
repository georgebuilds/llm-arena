// Loadout + match configuration shared across arena stages.

import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { BRANDS, MASKS, MODELS } from "~/data/arena";

export type ArenaStage = "loadout" | "briefing" | "fight";

export interface BoutRecord {
  id: string;
  timestamp: number;
  leftModelId: string;
  leftMaskId: string;
  rightModelId: string;
  rightMaskId: string;
  mode: string;
  topic: string;
  rounds: number;
  transcript: { side: "left" | "right"; text: string }[];
  winner: "left" | "right";
  reason: string;
  scores: Record<string, { left: number; right: number }>;
  judged: boolean; // true if AI-judged, false if mock
}

const HISTORY_KEY = "arena:bouts";
const MAX_HISTORY = 30;

export const useLoadout = defineStore("loadout", () => {
  // — Loadout (Act I) —
  // Models start at 0; init() randomizes them on first client mount.
  // Masks default to "unmasked" (idx 0).
  const leftModelIdx = ref(0);
  const leftMaskIdx = ref(0);
  const rightModelIdx = ref(0);
  const rightMaskIdx = ref(0);
  const initialized = ref(false);

  function init() {
    if (initialized.value) return;
    initialized.value = true;
    // load any persisted bout history first
    loadHistory();
    // pick two distinct random model indices for left + right
    leftModelIdx.value = Math.floor(Math.random() * MODELS.length);
    let r = Math.floor(Math.random() * MODELS.length);
    if (MODELS.length > 1 && r === leftModelIdx.value) {
      r = (r + 1) % MODELS.length;
    }
    rightModelIdx.value = r;
  }

  // — Match config (Act II) —
  const rounds = ref(5);
  const mode = ref("debate");
  const topic = ref("");
  const judging = ref<string[]>(["clarity", "persuasion"]);
  /** Model id (arena id, not OpenRouter) used to judge the bout. */
  const judgeModelId = ref<string>("claude-sonnet");

  // — Stage —
  const stage = ref<ArenaStage>("loadout");

  // — Bout history —
  const bouts = ref<BoutRecord[]>([]);

  function loadHistory() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) bouts.value = parsed.slice(0, MAX_HISTORY);
    } catch {
      // ignore corrupted storage
    }
  }

  function saveHistory() {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(bouts.value));
    } catch {
      // quota exceeded — drop oldest until it fits
      while (bouts.value.length > 1) {
        bouts.value.pop();
        try {
          window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(bouts.value));
          return;
        } catch { /* keep dropping */ }
      }
    }
  }

  function recordBout(b: Omit<BoutRecord, "id" | "timestamp">) {
    const record: BoutRecord = {
      ...b,
      id: `bout_${Date.now()}_${Math.floor(Math.random() * 1e6).toString(36)}`,
      timestamp: Date.now(),
    };
    bouts.value.unshift(record);
    if (bouts.value.length > MAX_HISTORY) {
      bouts.value = bouts.value.slice(0, MAX_HISTORY);
    }
    saveHistory();
    return record;
  }

  function clearHistory() {
    bouts.value = [];
    saveHistory();
  }

  // — Derived —
  const leftModel = computed(() => MODELS[leftModelIdx.value]);
  const leftMask = computed(() => MASKS[leftMaskIdx.value]);
  const rightModel = computed(() => MODELS[rightModelIdx.value]);
  const rightMask = computed(() => MASKS[rightMaskIdx.value]);

  const leftBrand = computed(() => BRANDS[leftModel.value.brand]);
  const rightBrand = computed(() => BRANDS[rightModel.value.brand]);

  return {
    // state
    leftModelIdx, leftMaskIdx, rightModelIdx, rightMaskIdx,
    rounds, mode, topic, judging, judgeModelId,
    stage,
    bouts,
    // derived
    leftModel, leftMask, rightModel, rightMask,
    leftBrand, rightBrand,
    // actions
    init,
    recordBout,
    clearHistory,
    loadHistory,
  };
});
