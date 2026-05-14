// User-level settings — currently just the OpenRouter API key.
// Stored in localStorage so it survives refreshes.

import { defineStore } from "pinia";

const STORAGE_KEY = "arena:settings";

interface State {
  apiKey: string;
}

function loadInitial(): State {
  if (typeof window === "undefined") return { apiKey: "" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.apiKey === "string") {
        return { apiKey: parsed.apiKey };
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return { apiKey: "" };
}

export const useSettingsStore = defineStore("settings", {
  state: (): State => loadInitial(),

  getters: {
    hasApiKey: (state) => state.apiKey.trim().length > 0,
  },

  actions: {
    setApiKey(value: string) {
      this.apiKey = value.trim();
    },
    persist() {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state));
      } catch {
        // quota / private mode — silently drop
      }
    },
    hydrateFromStorage() {
      Object.assign(this.$state, loadInitial());
    },
  },
});
