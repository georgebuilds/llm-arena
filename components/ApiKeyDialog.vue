<script setup lang="ts">
import { ref, watch } from "vue";
import { useSettingsStore } from "~/stores/settings";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const settings = useSettingsStore();
const draft = ref(settings.apiKey);
const reveal = ref(false);

watch(
  () => props.open,
  (open) => {
    if (open) {
      draft.value = settings.apiKey;
      reveal.value = false;
    }
  },
);

function save() {
  settings.setApiKey(draft.value);
  emit("close");
}

function clear() {
  draft.value = "";
  settings.clearApiKey();
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="OpenRouter API key"
      @click.self="emit('close')"
    >
      <div
        class="relative w-[min(92vw,32rem)] rounded-2xl border border-hairline bg-surface-1 p-6 shadow-2xl"
      >
        <h2 class="font-display text-xl text-primary">OpenRouter key</h2>
        <p class="mt-1 text-sm text-secondary">
          Stored only in your browser's localStorage. Never sent anywhere except OpenRouter.
        </p>

        <label class="mt-5 block text-xs font-medium uppercase tracking-wide text-tertiary">
          API key
        </label>
        <div class="mt-1.5 flex gap-2">
          <input
            v-model="draft"
            :type="reveal ? 'text' : 'password'"
            autocomplete="off"
            spellcheck="false"
            placeholder="sk-or-..."
            class="flex-1 rounded-lg border border-hairline bg-surface-2 px-3 py-2 font-mono text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            @keyup.enter="save"
          />
          <button
            type="button"
            class="rounded-lg border border-hairline bg-surface-2 px-3 text-xs text-secondary hover:bg-surface-3"
            @click="reveal = !reveal"
          >
            {{ reveal ? "Hide" : "Show" }}
          </button>
        </div>

        <p class="mt-3 text-xs text-tertiary">
          Get one at
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent underline-offset-2 hover:underline"
            >openrouter.ai/keys</a
          >. Charges go to your OpenRouter account.
        </p>

        <div class="mt-6 flex items-center justify-between">
          <button
            v-if="settings.hasApiKey"
            type="button"
            class="text-xs text-danger hover:underline"
            @click="clear"
          >
            Clear stored key
          </button>
          <span v-else />

          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg px-4 py-2 text-sm text-secondary hover:bg-surface-2"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text shadow-sm transition-colors hover:bg-accent-deep"
              @click="save"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
