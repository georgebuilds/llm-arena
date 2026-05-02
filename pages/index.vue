<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useSettingsStore } from "~/stores/settings";
import { useConversation } from "~/composables/useConversation";
import { MODE_BY_ID } from "~/data/modes";
import SetupPanel from "~/components/SetupPanel.vue";
import ChatTranscript from "~/components/ChatTranscript.vue";
import ApiKeyDialog from "~/components/ApiKeyDialog.vue";
import ThemeToggle from "~/components/ThemeToggle.vue";
import InterruptComposer from "~/components/InterruptComposer.vue";
import ArtifactCard from "~/components/ArtifactCard.vue";

useSeoMeta({
  title: "LLM Arena — watch two language models talk to each other",
  description:
    "Pit two language models against each other in a debate, an interview, a negotiation, a co-write, or a story. Bring your own OpenRouter key, set the rules, and read what unfolds.",
  ogTitle: "LLM Arena",
  ogDescription:
    "Two language models, one structured exchange. Five modes, hidden personas, a real artifact at the end.",
});

const settings = useSettingsStore();
const conversation = useConversation();

const apiKeyOpen = ref(false);

onMounted(() => {
  settings.hydrateFromStorage();
});

const hasTranscript = computed(() => conversation.messages.value.length > 0);

const currentModeMeta = computed(() => MODE_BY_ID.get(settings.mode));
const printShowsTranscript = computed(() => currentModeMeta.value?.printShowsTranscript ?? true);

const printHeader = computed(() => {
  const parts: string[] = [];
  parts.push(currentModeMeta.value?.name ?? settings.mode);
  if (settings.model1) parts.push(`Model 1: ${settings.model1}`);
  if (settings.model2) parts.push(`Model 2: ${settings.model2}`);
  parts.push(`${settings.maxRounds} round${settings.maxRounds === 1 ? "" : "s"}`);
  return parts.join(" · ");
});

const printedAt = computed(() =>
  new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }),
);

// ── Broadcast strip ──────────────────────────────────────────────────────
// When a bout is running we show a thin "ROUND n / N" indicator under the
// masthead — turns the chrome into a stage broadcast rather than a chatbot
// header. Round count is derived from speaker turns; one round = one turn
// from each model. We round up so the in-flight turn shows as the current
// round, not the previous one.

const totalSpeakerTurns = computed(
  () =>
    conversation.messages.value.filter(
      (m) => m.speaker === "model1" || m.speaker === "model2",
    ).length,
);
const currentRound = computed(() => Math.max(1, Math.ceil(totalSpeakerTurns.value / 2)));

function handleStart() {
  void conversation.start({
    apiKey: settings.apiKey,
    model1: settings.model1,
    model2: settings.model2,
    persona1Id: settings.persona1,
    persona2Id: settings.persona2,
    judgeModel: settings.effectiveJudgeModel,
    mode: settings.mode,
    configs: settings.configs,
    maxRounds: settings.maxRounds,
    stopCondition: settings.stopCondition,
  });
}

function handleInterrupt(text: string) {
  conversation.interrupt(text);
}

function handlePrint() {
  if (typeof window !== "undefined") {
    window.print();
  }
}

function handleReset() {
  if (conversation.running.value) conversation.stop();
  conversation.reset();
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <!-- Masthead — hidden on print. Treats the chrome as a playbill rather
         than an app shell: tightly-tracked small caps wordmark + amber
         "rostrum" rule + a broadcast strip showing round count when a bout
         is in flight. -->
    <header
      class="no-print sticky top-0 z-30 border-b border-hairline bg-surface-base/85 backdrop-blur"
    >
      <div class="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div class="flex items-baseline gap-3">
          <span
            class="font-display text-[20px] font-semibold uppercase leading-none tracking-marquee text-primary"
            aria-label="LLM Arena"
          >
            LLM<span class="px-1 text-accent-deep">·</span>Arena
          </span>
          <span
            class="hidden font-display text-[12px] italic text-tertiary sm:inline"
          >
            two models, one structured exchange
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-if="hasTranscript"
            type="button"
            class="rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-surface-3 hover:text-primary"
            @click="handlePrint"
          >
            Print / save PDF
          </button>
          <button
            v-if="hasTranscript && !conversation.running.value"
            type="button"
            class="rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-surface-3 hover:text-primary"
            @click="handleReset"
          >
            New bout
          </button>
          <button
            v-if="conversation.running.value"
            type="button"
            class="rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-xs text-warning transition-colors hover:bg-surface-3"
            @click="conversation.stop"
          >
            Stop
          </button>
          <ThemeToggle />
          <button
            type="button"
            class="rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-surface-3 hover:text-primary"
            @click="apiKeyOpen = true"
          >
            {{ settings.hasApiKey ? "Key set" : "Add key" }}
          </button>
        </div>
      </div>

      <!-- Rostrum rule — runs full-bleed under the wordmark. -->
      <div class="rostrum-rule" aria-hidden="true" />

      <!-- Broadcast strip — only when a bout is running. The thin progress
           bar fills as we approach max-rounds, like a stage timer. -->
      <div
        v-if="conversation.running.value"
        class="flex items-center gap-3 px-4 py-1.5 text-[10px] sm:px-8"
      >
        <span
          class="inline-flex items-center gap-1.5 font-mono uppercase tracking-marquee text-hearth-amber-deep"
        >
          <span
            class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
            aria-hidden="true"
          />
          Live
        </span>
        <span class="font-mono uppercase tracking-marquee text-tertiary">
          Round {{ String(currentRound).padStart(2, "0") }} / {{ String(settings.maxRounds).padStart(2, "0") }}
        </span>
        <span
          v-if="currentModeMeta?.marquee"
          class="hidden font-display italic text-tertiary sm:inline"
        >· {{ currentModeMeta.marquee }}</span>

        <!-- Progress bar — pushes flush right. -->
        <span class="ml-auto block h-px w-32 bg-hairline sm:w-64">
          <span
            class="block h-full bg-accent transition-all duration-500 ease-spring"
            :style="{ width: `${Math.min(100, (currentRound / settings.maxRounds) * 100)}%` }"
          />
        </span>
      </div>
    </header>

    <!-- Print-only masthead — styled like a broadsheet header. -->
    <header class="print-only mb-6">
      <p
        class="font-display text-[10px] uppercase tracking-marquee text-tertiary"
      >
        Transcript of a bout
      </p>
      <h1 class="mt-1 font-display text-3xl font-semibold tracking-tight">
        LLM <span class="text-accent-deep">·</span> Arena
      </h1>
      <p class="mt-1 font-display text-[14px] italic text-secondary">{{ printHeader }}</p>
      <p class="mt-1 font-mono text-[11px] uppercase tracking-marquee text-tertiary">
        Printed {{ printedAt }}
      </p>
      <hr class="mt-3" />
    </header>

    <!-- Main column -->
    <main class="print-surface mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <div
        v-if="!hasTranscript"
        class="no-print flex flex-1 flex-col justify-center px-4 py-10 sm:px-8"
      >
        <div class="mb-6">
          <p class="speaker-rule text-hearth-amber-deep">Tonight's bill</p>
          <p class="mt-1 font-display text-[44px] leading-[1.05] tracking-tight text-primary sm:text-[52px]">
            Two language models, <span class="italic text-accent-deep">one structured exchange.</span>
          </p>
          <p class="mt-3 max-w-prose font-display text-[18px] italic leading-[1.45] text-secondary">
            Pick a format with real shape. Hide a voice behind each one. Watch what comes out.
          </p>
        </div>
        <SetupPanel
          :disabled="conversation.running.value"
          @start="handleStart"
          @open-key="apiKeyOpen = true"
        />
      </div>

      <template v-else>
        <!-- Artifact lands above the transcript when present.
             For co-write and story, the transcript is hidden on print so the
             printed PDF is just the finished artifact. -->
        <ArtifactCard
          v-if="conversation.artifact.value"
          :artifact="conversation.artifact.value"
        />

        <ChatTranscript
          :messages="conversation.messages.value"
          :running="conversation.running.value"
          :mode="settings.mode"
          :resolved-personas="conversation.resolvedPersonas.value"
          class="min-h-0"
          :class="!printShowsTranscript ? 'print:hidden' : ''"
        />
      </template>

      <p
        v-if="conversation.error.value && !conversation.running.value"
        class="no-print mx-4 mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger sm:mx-8"
      >
        {{ conversation.error.value }}
      </p>
    </main>

    <InterruptComposer
      v-if="hasTranscript && conversation.running.value"
      :disabled="false"
      @interrupt="handleInterrupt"
    />

    <ApiKeyDialog
      :open="apiKeyOpen"
      @close="apiKeyOpen = false"
    />
  </div>
</template>
