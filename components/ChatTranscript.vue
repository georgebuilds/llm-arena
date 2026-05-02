<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { ChatMessage } from "~/types";
import ChatBubble from "~/components/ChatBubble.vue";
import SystemNote from "~/components/SystemNote.vue";
import { useSettingsStore } from "~/stores/settings";
import type { Mode, Persona } from "~/types";
import { MODE_BY_ID } from "~/data/modes";

/**
 * Transcript view. The redesign treats this as a printed record of a bout:
 *   - A "playbill" header naming the cast (model · as the persona)
 *   - A mode-specific frame above the turns (motion / topic / dossier)
 *   - For most modes: speaker-rule transcript rows (see ChatBubble.vue)
 *   - For story mode: anonymous prose separated by a centered dinkus
 *
 * The cast and the mode frame are drawn from the settings store + the
 * resolved personas from useConversation, so the transcript is self-
 * documenting both on screen and in the printed PDF.
 */

const props = defineProps<{
  messages: ChatMessage[];
  running: boolean;
  mode?: string;
  /** Resolved personas from the active bout — owned by the parent so the
   * transcript stays a pure view. */
  resolvedPersonas?: { p1: Persona | null; p2: Persona | null };
}>();

const settings = useSettingsStore();

const scrollEl = ref<HTMLElement | null>(null);
const userScrolled = ref(false);

function onScroll() {
  const el = scrollEl.value;
  if (!el) return;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  userScrolled.value = distanceFromBottom > 80;
}

async function scrollToBottom() {
  await nextTick();
  const el = scrollEl.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

watch(
  () => props.messages.length,
  () => {
    if (!userScrolled.value) void scrollToBottom();
  },
);

watch(
  () => props.messages.map((m) => m.content.length).join(","),
  () => {
    if (!userScrolled.value) void scrollToBottom();
  },
);

// ── Cast list ─────────────────────────────────────────────────────────────

function shortName(id: string): string {
  if (!id) return "—";
  return id.split("/").slice(-1)[0] ?? id;
}

const cast = computed(() => {
  const r = props.resolvedPersonas;
  return {
    left: {
      model: shortName(settings.model1),
      persona: r?.p1?.short ?? "",
    },
    right: {
      model: shortName(settings.model2),
      persona: r?.p2?.short ?? "",
    },
  };
});

// ── Mode frame ────────────────────────────────────────────────────────────

const modeMeta = computed(() =>
  props.mode ? MODE_BY_ID.get(props.mode as Mode) : undefined,
);
const isStory = computed(() => props.mode === "story");

const debate = computed(() => settings.configs.debate);
const interview = computed(() => settings.configs.interview);
const negotiate = computed(() => settings.configs.negotiate);
const story = computed(() => settings.configs.story);
const cowrite = computed(() => settings.configs.cowrite);

// Story turns alternate left/right; we drop the speaker labels and instead
// insert a dinkus between turns so the prose flows continuously.
const storyTurns = computed(() =>
  props.messages.filter((m) => m.speaker === "model1" || m.speaker === "model2"),
);
const storySystem = computed(() =>
  props.messages.filter((m) => m.speaker === "system" || m.speaker === "interrupt"),
);
</script>

<template>
  <div
    ref="scrollEl"
    class="flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8 print:overflow-visible print:p-0"
    @scroll="onScroll"
  >
    <!-- ── Playbill header ──────────────────────────────────────────────── -->
    <header class="bubble-block mb-6 print:mb-4">
      <div class="rostrum-rule mb-3" aria-hidden="true" />

      <p class="speaker-rule text-hearth-amber-deep">
        {{ modeMeta?.marquee ?? "Transcript" }}
      </p>

      <!-- Mode-specific lead — motion, topic, scenario, brief, or opening line. -->
      <p
        v-if="props.mode === 'debate'"
        class="mt-2 max-w-prose font-display text-[26px] leading-[1.2] text-primary print:text-[24px]"
      >
        “{{ debate.motion }}”
      </p>
      <p
        v-else-if="props.mode === 'interview'"
        class="mt-2 max-w-prose font-display text-[24px] leading-[1.25] text-primary"
      >
        On {{ interview.topic }}.
      </p>
      <p
        v-else-if="props.mode === 'negotiate'"
        class="mt-2 max-w-prose font-display text-[22px] leading-[1.3] italic text-primary"
      >
        {{ negotiate.scenario }}
      </p>
      <p
        v-else-if="props.mode === 'cowrite'"
        class="mt-2 max-w-prose font-display text-[22px] leading-[1.3] text-primary"
      >
        Drafting <span class="italic">{{ cowrite.artifactKind || "an artifact" }}</span
        ><span v-if="cowrite.brief"> — {{ cowrite.brief }}</span>
      </p>
      <p
        v-else-if="props.mode === 'story'"
        class="mt-2 max-w-prose font-display text-[22px] italic leading-[1.3] text-primary"
      >
        {{ story.style }}
      </p>

      <!-- Cast list — playbill-style. Two columns of "model · as the persona". -->
      <div
        class="mt-4 grid gap-3 border-t border-hairline pt-3 text-[13px] sm:grid-cols-2"
      >
        <div class="flex items-baseline gap-2.5">
          <span class="speaker-bar h-3 self-center bg-model-two" aria-hidden="true" />
          <span class="font-mono text-secondary">{{ cast.left.model }}</span>
          <span
            v-if="cast.left.persona"
            class="font-display italic text-secondary"
          >· as the {{ cast.left.persona }}</span>
          <span class="ml-auto speaker-rule text-tertiary">Left</span>
        </div>
        <div class="flex items-baseline gap-2.5">
          <span class="speaker-bar h-3 self-center bg-accent" aria-hidden="true" />
          <span class="font-mono text-secondary">{{ cast.right.model }}</span>
          <span
            v-if="cast.right.persona"
            class="font-display italic text-secondary"
          >· as the {{ cast.right.persona }}</span>
          <span class="ml-auto speaker-rule text-tertiary">Right</span>
        </div>
      </div>

      <!-- Negotiate dossier — private goals + walk-aways, marked PRIVATE so
           the user knows the models can't see each other's cards. -->
      <div
        v-if="props.mode === 'negotiate'"
        class="mt-4 grid gap-3 sm:grid-cols-2"
      >
        <details
          class="group rounded-md border border-hairline bg-surface-2/60 p-3 open:bg-surface-2"
        >
          <summary
            class="cursor-pointer list-none flex items-baseline gap-2 text-[13px]"
          >
            <span class="speaker-rule text-model-two-deep">Dossier · Left</span>
            <span class="font-display italic text-secondary">{{ negotiate.partyA.name }}</span>
            <span class="ml-auto font-mono text-[10px] tracking-[0.18em] text-hearth-amber-deep">PRIVATE</span>
          </summary>
          <div class="mt-2 space-y-2 text-[13px] leading-[1.55] text-secondary">
            <p><span class="speaker-rule text-tertiary">Goals · </span>{{ negotiate.partyA.goals }}</p>
            <p><span class="speaker-rule text-tertiary">Walk-away · </span>{{ negotiate.partyA.walkaway }}</p>
          </div>
        </details>
        <details
          class="group rounded-md border border-hairline bg-surface-2/60 p-3 open:bg-surface-2"
        >
          <summary
            class="cursor-pointer list-none flex items-baseline gap-2 text-[13px]"
          >
            <span class="speaker-rule text-accent-deep">Dossier · Right</span>
            <span class="font-display italic text-secondary">{{ negotiate.partyB.name }}</span>
            <span class="ml-auto font-mono text-[10px] tracking-[0.18em] text-hearth-amber-deep">PRIVATE</span>
          </summary>
          <div class="mt-2 space-y-2 text-[13px] leading-[1.55] text-secondary">
            <p><span class="speaker-rule text-tertiary">Goals · </span>{{ negotiate.partyB.goals }}</p>
            <p><span class="speaker-rule text-tertiary">Walk-away · </span>{{ negotiate.partyB.walkaway }}</p>
          </div>
        </details>
      </div>
    </header>

    <!-- ── Transcript body ──────────────────────────────────────────────── -->

    <!-- Story: continuous prose. Speaker labels are dropped; a dinkus marks
         the boundary between turns. The opening line lives in the playbill
         header so the prose can begin with the first model's response. -->
    <template v-if="isStory">
      <p
        v-if="story.opening"
        class="mb-4 font-display text-[17px] italic leading-[1.7] text-secondary"
      >
        {{ story.opening }}
      </p>
      <template v-for="(m, i) in storyTurns" :key="m.id">
        <ChatBubble :message="m" :mode="mode" />
        <div
          v-if="i < storyTurns.length - 1"
          class="dinkus"
          aria-hidden="true"
        >· · ·</div>
      </template>
      <!-- System / interrupt notes still appear at the end as stage directions -->
      <template v-for="m in storySystem" :key="m.id">
        <SystemNote
          :content="m.content"
          :kind="m.speaker === 'interrupt' ? 'interrupt' : 'system'"
        />
      </template>
    </template>

    <!-- All other modes: speaker-rule transcript rows. -->
    <div v-else class="flex flex-col gap-5">
      <template
        v-for="m in messages"
        :key="m.id"
      >
        <SystemNote
          v-if="m.speaker === 'system'"
          :content="m.content"
          kind="system"
        />
        <SystemNote
          v-else-if="m.speaker === 'interrupt'"
          :content="m.content"
          kind="interrupt"
        />
        <ChatBubble
          v-else
          :message="m"
          :mode="mode"
        />
      </template>
    </div>
  </div>
</template>
