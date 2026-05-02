<script setup lang="ts">
import { computed } from "vue";
import type { Artifact } from "~/types";

/**
 * The artifact card is the closing document of a bout — verdict, finished
 * draft, story, or negotiation memo. The redesign treats this as a printed
 * artifact rather than a chat summary: a thin amber masthead rule, a
 * literary display face for the body, and a drop cap on the long-prose modes
 * so the page reads like something you'd save and re-read.
 */

const props = defineProps<{ artifact: Artifact }>();

const verdictTone = computed(() => {
  if (props.artifact.kind !== "verdict") return "";
  const r = props.artifact.ruling.toLowerCase();
  if (r.includes("a wins")) return "side-a";
  if (r.includes("b wins")) return "side-b";
  return "tie";
});
</script>

<template>
  <div
    class="bubble-block mx-4 my-6 border border-hairline bg-surface-2 shadow-sm sm:mx-0 print:mx-0 print:my-0 print:border-0 print:shadow-none"
  >
    <!-- Masthead rule — every artifact opens with this. -->
    <div class="rostrum-rule" aria-hidden="true" />

    <!-- Verdict (debate) -->
    <div v-if="artifact.kind === 'verdict'" class="p-6 sm:p-8">
      <p class="speaker-rule text-tertiary">Ruling</p>
      <p
        class="mt-1 font-display text-[34px] leading-[1.1] tracking-tight"
        :class="
          verdictTone === 'side-a'
            ? 'text-model-two-deep'
            : verdictTone === 'side-b'
              ? 'text-accent-deep'
              : 'text-primary'
        "
      >
        {{ artifact.ruling }}
      </p>
      <p class="mt-2 max-w-prose font-display text-[15px] italic text-secondary">
        on the motion: {{ artifact.motion }}
      </p>

      <div class="mt-7 grid gap-6 sm:grid-cols-2">
        <div>
          <p class="speaker-rule text-tertiary">Reasoning</p>
          <p class="mt-1.5 text-[14.5px] leading-[1.65] text-primary">{{ artifact.reasoning }}</p>
        </div>
        <div>
          <p class="speaker-rule text-tertiary">Strongest argument</p>
          <p class="mt-1.5 text-[14.5px] leading-[1.65] text-primary">{{ artifact.strongest }}</p>
        </div>
        <div class="sm:col-span-2">
          <p class="speaker-rule text-tertiary">Weakest moment</p>
          <p class="mt-1.5 text-[14.5px] leading-[1.65] text-primary">{{ artifact.weakest }}</p>
        </div>
      </div>
    </div>

    <!-- Co-write final draft — manuscript treatment. -->
    <div v-else-if="artifact.kind === 'cowrite-final'" class="p-6 sm:p-12">
      <p class="speaker-rule text-tertiary">The {{ artifact.artifactKind }}</p>
      <div
        class="drop-cap mt-4 whitespace-pre-wrap font-display text-[19px] leading-[1.7] text-primary print:text-[18px]"
      >{{ artifact.text }}</div>
    </div>

    <!-- Story final — single page of prose. -->
    <div v-else-if="artifact.kind === 'story-final'" class="p-6 sm:p-12">
      <p class="speaker-rule text-tertiary">The story</p>
      <p
        class="drop-cap mt-4 whitespace-pre-wrap font-display text-[19px] leading-[1.75] text-primary print:text-[18px]"
      >{{ artifact.text }}</p>
    </div>

    <!-- Negotiation memo — closer to a document than a verdict. -->
    <div v-else-if="artifact.kind === 'negotiate-memo'" class="p-6 sm:p-8">
      <p class="speaker-rule text-tertiary">Outcome</p>
      <p
        class="mt-1 font-display text-[32px] leading-[1.1] tracking-tight"
        :class="artifact.outcome === 'agreement' ? 'text-success' : 'text-warning'"
      >
        {{ artifact.outcome === "agreement" ? "Agreement reached" : "Impasse" }}
      </p>
      <div class="mt-6 whitespace-pre-wrap text-[14.5px] leading-[1.65] text-primary">
        {{ artifact.text }}
      </div>
    </div>
  </div>
</template>
