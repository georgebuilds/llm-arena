<script setup lang="ts">
const props = defineProps<{
  content: string;
  /** "system" → stage direction (centered italic). "interrupt" → tagged organiser note. */
  kind?: "system" | "interrupt";
}>();

const isInterrupt = props.kind === "interrupt";
</script>

<template>
  <!--
    Two flavours of marginal note in the transcript:
      - system: a stage direction, italic + ornaments, set tight in the gutter
      - interrupt: an "Organiser" cut-in from the human watching the bout
  -->
  <div
    class="bubble-block flex justify-center py-2"
    :class="isInterrupt ? '' : 'system-note'"
  >
    <div
      v-if="isInterrupt"
      class="max-w-[min(100%,42rem)] border-y border-hairline bg-surface-2/70 px-4 py-1.5 text-center text-[13px] text-secondary"
    >
      <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-hearth-amber-deep">
        Organiser
      </span>
      <span class="ml-2 font-display italic">{{ content }}</span>
    </div>
    <span
      v-else
      class="inline-flex items-center gap-3 px-3 text-center font-display text-[13px] italic text-tertiary"
    >
      <span aria-hidden="true" class="text-tertiary/60">⁂</span>
      <span>{{ content }}</span>
      <span aria-hidden="true" class="text-tertiary/60">⁂</span>
    </span>
  </div>
</template>
