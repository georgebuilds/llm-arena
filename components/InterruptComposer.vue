<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ (e: "interrupt", text: string): void }>();

const text = ref("");

function send() {
  const v = text.value.trim();
  if (!v) return;
  emit("interrupt", v);
  text.value = "";
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    send();
  }
}
</script>

<template>
  <div
    class="no-print sticky bottom-0 border-t border-hairline bg-surface-base/95 px-4 py-3 backdrop-blur sm:px-8"
  >
    <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
      Interject as the organiser
    </label>
    <div class="mt-1.5 flex items-end gap-2">
      <textarea
        v-model="text"
        rows="1"
        :disabled="props.disabled"
        placeholder="Throw them a curveball, redirect, push back. Both will see it on their next turn."
        class="min-h-[40px] flex-1 resize-none rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
        @keydown="onKeydown"
      />
      <button
        type="button"
        class="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text shadow-sm transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="props.disabled || !text.trim()"
        @click="send"
      >
        Send
      </button>
    </div>
    <p class="mt-1 text-[11px] text-tertiary">
      ⌘/Ctrl-Enter to send. The note appears in the transcript and is delivered to both.
    </p>
  </div>
</template>
