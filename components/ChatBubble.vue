<script setup lang="ts">
import { computed } from "vue";
import type { ChatMessage } from "~/types";
import { getPersona } from "~/data/personas";

/**
 * Despite the legacy filename, this component now renders a transcript row,
 * not a chat bubble. The metaphor is a printed transcript / play script:
 *
 *   ┃ MODEL · AS THE PERSONA                    [side label]
 *   ┃ Body text, flush, no balloon. Reads like a court
 *   ┃ transcript — and prints like one too.
 *
 * The 3px vertical bar on the left carries the speaker's color (peach for
 * model 2, teal for model 1). No avatar circle, no bubble corners — those
 * primitives implied a chatbot UI, which this app isn't.
 */

const props = defineProps<{ message: ChatMessage; mode?: string }>();

const side = computed<"left" | "right">(() =>
  props.message.speaker === "model1" ? "left" : "right",
);

const shortLabel = computed(() => {
  const id = props.message.modelId ?? "";
  if (!id) return "";
  return id.split("/").slice(-1)[0] ?? id;
});

const personaShort = computed(() => {
  const id = props.message.personaId;
  if (!id || id === "none") return "";
  if (id === "custom") return "custom voice";
  return getPersona(id)?.short ?? "";
});

const isCoWrite = computed(() => props.mode === "cowrite");
const isStory = computed(() => props.mode === "story");

const displayBody = computed(() => {
  if (isCoWrite.value && props.message.bodyText) {
    return props.message.bodyText;
  }
  return props.message.content;
});

const sideLabel = computed(() =>
  side.value === "right" ? "Right" : "Left",
);
</script>

<template>
  <!-- Story mode: anonymous prose. The two models alternate as unlabelled
       paragraphs; a faint dinkus separates them in the parent transcript. -->
  <article
    v-if="isStory"
    class="bubble-block group"
  >
    <p
      class="font-display text-[17px] leading-[1.7] text-primary"
      :class="side === 'right' ? 'text-primary' : 'text-primary/95'"
    >
      <span v-if="message.pending && message.content.length === 0" class="inline-flex gap-1 align-middle">
        <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-tertiary" style="animation-delay: 0ms" />
        <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-tertiary" style="animation-delay: 150ms" />
        <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-tertiary" style="animation-delay: 300ms" />
      </span>
      <template v-else>{{ displayBody }}<span
        v-if="message.pending"
        class="ml-0.5 inline-block h-4 w-1 animate-pulse bg-current align-text-bottom opacity-60"
        aria-hidden="true"
      /></template>
    </p>
  </article>

  <!-- Default: speaker rule + flush body. -->
  <article v-else class="bubble-block group flex gap-4">
    <!-- Vertical accent bar — the speaker's color carries through the turn. -->
    <div
      class="speaker-bar self-stretch"
      :class="side === 'right' ? 'bg-accent' : 'bg-model-two'"
      aria-hidden="true"
    />

    <div class="min-w-0 flex-1 pb-2">
      <!-- Speaker rule: model id · as the persona — — RIGHT -->
      <header
        v-if="shortLabel || personaShort"
        class="speaker-rule mb-2 flex flex-wrap items-baseline gap-x-2 text-tertiary"
      >
        <span
          class="font-mono normal-case tracking-[0.04em]"
          :class="side === 'right' ? 'text-accent-deep' : 'text-model-two-deep'"
        >{{ shortLabel }}</span>
        <span
          v-if="personaShort"
          class="font-display italic text-secondary normal-case tracking-normal text-[13px]"
        >as the {{ personaShort }}</span>
        <span class="ml-auto font-mono text-[10px] tracking-[0.18em] text-tertiary">
          {{ sideLabel }}
        </span>
      </header>

      <!-- Co-write edit summary — small marginalia note. -->
      <p
        v-if="isCoWrite && message.editSummary"
        class="mb-1.5 font-display italic text-secondary text-[14px]"
      >
        Edit · {{ message.editSummary }}
      </p>

      <!-- Body — flush text, no bubble. Generous leading reads like a printed transcript. -->
      <div
        v-if="message.pending && message.content.length === 0"
        class="flex gap-1 py-2"
        aria-label="Generating reply"
      >
        <span
          class="inline-block h-2 w-2 animate-bounce rounded-full bg-tertiary"
          style="animation-delay: 0ms"
        />
        <span
          class="inline-block h-2 w-2 animate-bounce rounded-full bg-tertiary"
          style="animation-delay: 150ms"
        />
        <span
          class="inline-block h-2 w-2 animate-bounce rounded-full bg-tertiary"
          style="animation-delay: 300ms"
        />
      </div>
      <p
        v-else
        class="whitespace-pre-wrap break-words text-[15.5px] leading-[1.7] text-primary"
      >{{ displayBody }}<span
          v-if="message.pending"
          class="ml-0.5 inline-block h-4 w-1 animate-pulse bg-current align-text-bottom opacity-60"
          aria-hidden="true"
        /></p>
    </div>
  </article>
</template>
