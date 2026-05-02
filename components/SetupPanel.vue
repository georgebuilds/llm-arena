<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useSettingsStore } from "~/stores/settings";
import { useOpenRouterModels } from "~/composables/useOpenRouterModels";
import PersonaPicker from "~/components/PersonaPicker.vue";
import { MODES, MODE_BY_ID } from "~/data/modes";
import type { Mode } from "~/types";

const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{
  (e: "start"): void;
  (e: "open-key"): void;
}>();

const settings = useSettingsStore();
const { models, ids, loading, error, load, isValidModelId } = useOpenRouterModels();

onMounted(() => {
  void load();
});

const submitted = ref(false);

const model1Valid = computed(
  () => settings.model1.length === 0 || isValidModelId(settings.model1),
);
const model2Valid = computed(
  () => settings.model2.length === 0 || isValidModelId(settings.model2),
);

const canStart = computed(
  () =>
    !props.disabled &&
    settings.hasApiKey &&
    isValidModelId(settings.model1) &&
    isValidModelId(settings.model2) &&
    settings.maxRounds > 0,
);

const blockReasons = computed<string[]>(() => {
  const reasons: string[] = [];
  if (!settings.hasApiKey) reasons.push("OpenRouter key");
  if (!isValidModelId(settings.model1)) reasons.push("model 1");
  if (!isValidModelId(settings.model2)) reasons.push("model 2");
  if (settings.maxRounds <= 0) reasons.push("max rounds");
  return reasons;
});

// Per-mode CTA on the Begin button. Voice does identity work that fonts and
// colors can't.
const startCta = computed(() => MODE_BY_ID.get(settings.mode)?.cta ?? "Begin");

function shortName(id: string): string {
  return id.split("/").slice(-1)[0] ?? id;
}

function selectMode(m: Mode) {
  settings.setMode(m);
}

function onStart() {
  submitted.value = true;
  if (!canStart.value) return;
  emit("start");
}

// Two-way bindings for mode-specific config — write back to the store.
const debate = computed({
  get: () => settings.configs.debate,
  set: (v) => settings.setConfig("debate", v),
});
const cowrite = computed({
  get: () => settings.configs.cowrite,
  set: (v) => settings.setConfig("cowrite", v),
});
const interview = computed({
  get: () => settings.configs.interview,
  set: (v) => settings.setConfig("interview", v),
});
const negotiate = computed({
  get: () => settings.configs.negotiate,
  set: (v) => settings.setConfig("negotiate", v),
});
const story = computed({
  get: () => settings.configs.story,
  set: (v) => settings.setConfig("story", v),
});
</script>

<template>
  <section
    class="bubble-block rounded-2xl border border-hairline bg-surface-1/80 p-5 backdrop-blur-sm sm:p-7"
    aria-label="Conversation setup"
  >
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="speaker-rule text-hearth-amber-deep">Stage the bout</p>
        <h2 class="mt-1 font-display text-[28px] leading-[1.15] tracking-tight text-primary">
          Set the rules
        </h2>
        <p class="mt-1 font-display text-[15px] italic text-secondary">
          Pick a format. Pick voices. Set a topic. Strike the match.
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-surface-3 hover:text-primary"
        @click="emit('open-key')"
      >
        {{ settings.hasApiKey ? "Update key" : "Add OpenRouter key" }}
      </button>
    </div>

    <!-- Mode picker — five formats, presented like programme entries. -->
    <div class="mt-6">
      <p class="speaker-rule text-tertiary">Programme</p>
      <div class="mt-2 grid gap-2 sm:grid-cols-5">
        <button
          v-for="m in MODES"
          :key="m.id"
          type="button"
          class="rounded-xl border p-3 text-left transition-all duration-150 ease-spring"
          :class="
            settings.mode === m.id
              ? 'border-accent bg-accent/5 shadow-sm'
              : 'border-hairline bg-surface-2 hover:border-accent/40 hover:bg-surface-3'
          "
          @click="selectMode(m.id)"
        >
          <p
            class="font-display text-[18px] leading-tight tracking-tight"
            :class="settings.mode === m.id ? 'text-accent-deep' : 'text-primary'"
          >
            {{ m.name }}
          </p>
          <p class="mt-1 text-[11px] leading-snug text-secondary">{{ m.blurb }}</p>
        </button>
      </div>
    </div>

    <!-- Mode-specific fields -->
    <div class="mt-6 rounded-xl border border-hairline bg-surface-2/40 p-4 sm:p-5">
      <!-- Debate -->
      <div v-if="settings.mode === 'debate'" class="space-y-4">
        <div>
          <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
            Motion
          </label>
          <input
            :value="debate.motion"
            type="text"
            class="mt-1.5 w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            @input="debate = { ...debate, motion: ($event.target as HTMLInputElement).value }"
          />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
              Side A — defends the motion
              <span class="ml-1 inline-block h-2 w-2 rounded-full bg-model-two align-middle" aria-hidden="true" />
            </label>
            <textarea
              :value="debate.sideA"
              rows="3"
              class="mt-1.5 w-full resize-y rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              @input="debate = { ...debate, sideA: ($event.target as HTMLTextAreaElement).value }"
            />
          </div>
          <div>
            <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
              Side B — opposes the motion
              <span class="ml-1 inline-block h-2 w-2 rounded-full bg-accent align-middle" aria-hidden="true" />
            </label>
            <textarea
              :value="debate.sideB"
              rows="3"
              class="mt-1.5 w-full resize-y rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              @input="debate = { ...debate, sideB: ($event.target as HTMLTextAreaElement).value }"
            />
          </div>
        </div>
      </div>

      <!-- Co-write -->
      <div v-else-if="settings.mode === 'cowrite'" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
              Kind of artifact
            </label>
            <input
              :value="cowrite.artifactKind"
              type="text"
              placeholder="short poem · contract clause · recipe · letter"
              class="mt-1.5 w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              @input="cowrite = { ...cowrite, artifactKind: ($event.target as HTMLInputElement).value }"
            />
          </div>
          <div>
            <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
              Brief
            </label>
            <input
              :value="cowrite.brief"
              type="text"
              class="mt-1.5 w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              @input="cowrite = { ...cowrite, brief: ($event.target as HTMLInputElement).value }"
            />
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
            Starting draft (optional)
          </label>
          <textarea
            :value="cowrite.startingDraft"
            rows="4"
            placeholder="Leave blank to start from a blank page."
            class="mt-1.5 w-full resize-y rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            @input="cowrite = { ...cowrite, startingDraft: ($event.target as HTMLTextAreaElement).value }"
          />
        </div>
      </div>

      <!-- Interview -->
      <div v-else-if="settings.mode === 'interview'" class="space-y-4">
        <div>
          <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
            Topic
          </label>
          <input
            :value="interview.topic"
            type="text"
            class="mt-1.5 w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            @input="interview = { ...interview, topic: ($event.target as HTMLInputElement).value }"
          />
        </div>
        <div>
          <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
            Subject's perspective
          </label>
          <textarea
            :value="interview.subjectPerspective"
            rows="3"
            class="mt-1.5 w-full resize-y rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            @input="
              interview = {
                ...interview,
                subjectPerspective: ($event.target as HTMLTextAreaElement).value,
              }
            "
          />
        </div>
        <div>
          <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
            Who interviews?
          </label>
          <div class="mt-1.5 inline-flex rounded-lg border border-hairline bg-surface-2 p-0.5">
            <button
              type="button"
              class="rounded-md px-4 py-1.5 text-sm transition-colors"
              :class="
                interview.interviewerSide === 'model1'
                  ? 'bg-model-two text-model-two-text'
                  : 'text-secondary hover:text-primary'
              "
              @click="interview = { ...interview, interviewerSide: 'model1' }"
            >
              Model 1 asks
            </button>
            <button
              type="button"
              class="rounded-md px-4 py-1.5 text-sm transition-colors"
              :class="
                interview.interviewerSide === 'model2'
                  ? 'bg-accent text-accent-text'
                  : 'text-secondary hover:text-primary'
              "
              @click="interview = { ...interview, interviewerSide: 'model2' }"
            >
              Model 2 asks
            </button>
          </div>
        </div>
      </div>

      <!-- Negotiate -->
      <div v-else-if="settings.mode === 'negotiate'" class="space-y-4">
        <div>
          <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
            Scenario
          </label>
          <textarea
            :value="negotiate.scenario"
            rows="2"
            class="mt-1.5 w-full resize-y rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            @input="negotiate = { ...negotiate, scenario: ($event.target as HTMLTextAreaElement).value }"
          />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2 rounded-lg border border-hairline bg-surface-2/60 p-3">
            <p class="text-[11px] font-medium uppercase tracking-wide text-model-two-deep">
              Party A · Model 1
            </p>
            <input
              :value="negotiate.partyA.name"
              type="text"
              placeholder="party name"
              class="w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              @input="
                negotiate = {
                  ...negotiate,
                  partyA: { ...negotiate.partyA, name: ($event.target as HTMLInputElement).value },
                }
              "
            />
            <textarea
              :value="negotiate.partyA.goals"
              rows="2"
              placeholder="goals (visible to A only)"
              class="w-full resize-y rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              @input="
                negotiate = {
                  ...negotiate,
                  partyA: { ...negotiate.partyA, goals: ($event.target as HTMLTextAreaElement).value },
                }
              "
            />
            <textarea
              :value="negotiate.partyA.walkaway"
              rows="2"
              placeholder="private walk-away — never revealed verbatim"
              class="w-full resize-y rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              @input="
                negotiate = {
                  ...negotiate,
                  partyA: { ...negotiate.partyA, walkaway: ($event.target as HTMLTextAreaElement).value },
                }
              "
            />
          </div>
          <div class="space-y-2 rounded-lg border border-hairline bg-surface-2/60 p-3">
            <p class="text-[11px] font-medium uppercase tracking-wide text-accent-deep">
              Party B · Model 2
            </p>
            <input
              :value="negotiate.partyB.name"
              type="text"
              placeholder="party name"
              class="w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              @input="
                negotiate = {
                  ...negotiate,
                  partyB: { ...negotiate.partyB, name: ($event.target as HTMLInputElement).value },
                }
              "
            />
            <textarea
              :value="negotiate.partyB.goals"
              rows="2"
              placeholder="goals (visible to B only)"
              class="w-full resize-y rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              @input="
                negotiate = {
                  ...negotiate,
                  partyB: { ...negotiate.partyB, goals: ($event.target as HTMLTextAreaElement).value },
                }
              "
            />
            <textarea
              :value="negotiate.partyB.walkaway"
              rows="2"
              placeholder="private walk-away — never revealed verbatim"
              class="w-full resize-y rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              @input="
                negotiate = {
                  ...negotiate,
                  partyB: { ...negotiate.partyB, walkaway: ($event.target as HTMLTextAreaElement).value },
                }
              "
            />
          </div>
        </div>
      </div>

      <!-- Story -->
      <div v-else-if="settings.mode === 'story'" class="space-y-4">
        <div>
          <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
            Opening line
          </label>
          <input
            :value="story.opening"
            type="text"
            class="mt-1.5 w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            @input="story = { ...story, opening: ($event.target as HTMLInputElement).value }"
          />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
              Style
            </label>
            <input
              :value="story.style"
              type="text"
              placeholder="noir · fairytale · dry comic · spare and atmospheric"
              class="mt-1.5 w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              @input="story = { ...story, style: ($event.target as HTMLInputElement).value }"
            />
          </div>
          <div>
            <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
              Length per turn
            </label>
            <div class="mt-1.5 inline-flex rounded-lg border border-hairline bg-surface-2 p-0.5">
              <button
                type="button"
                class="rounded-md px-4 py-1.5 text-sm transition-colors"
                :class="
                  story.turnLength === 'sentence'
                    ? 'bg-accent text-accent-text'
                    : 'text-secondary hover:text-primary'
                "
                @click="story = { ...story, turnLength: 'sentence' }"
              >
                One sentence
              </button>
              <button
                type="button"
                class="rounded-md px-4 py-1.5 text-sm transition-colors"
                :class="
                  story.turnLength === 'paragraph'
                    ? 'bg-accent text-accent-text'
                    : 'text-secondary hover:text-primary'
                "
                @click="story = { ...story, turnLength: 'paragraph' }"
              >
                Short paragraph
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- shared datalist for both model inputs -->
    <datalist id="openrouter-models">
      <option
        v-for="m in models"
        :key="m.id"
        :value="m.id"
      >
        {{ shortName(m.id) }}{{ m.name && m.name !== m.id ? " — " + m.name : "" }}
      </option>
    </datalist>

    <!-- Model + persona pair -->
    <div class="mt-6 grid gap-5 sm:grid-cols-2">
      <div class="space-y-3 rounded-xl border border-hairline bg-surface-2/40 p-4">
        <p class="text-[11px] font-medium uppercase tracking-wide text-tertiary">
          Model 1
          <span class="ml-1 inline-block h-2 w-2 rounded-full bg-model-two align-middle" aria-hidden="true" />
          <span class="ml-1 text-tertiary normal-case tracking-normal">left</span>
        </p>
        <input
          :value="settings.model1"
          list="openrouter-models"
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="anthropic/claude-sonnet-4.5"
          class="w-full rounded-lg border bg-surface-2 px-3 py-2 font-mono text-sm text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
          :class="
            !model1Valid && (submitted || settings.model1.length > 0)
              ? 'border-danger'
              : 'border-hairline'
          "
          @input="settings.setModel1(($event.target as HTMLInputElement).value)"
        />
        <p
          v-if="!model1Valid && settings.model1.length > 0"
          class="text-xs text-danger"
        >
          Not in the OpenRouter text-model list.
        </p>
        <PersonaPicker
          :model-value="settings.persona1"
          aria-label="Persona for model 1"
          @update:model-value="settings.setPersona1($event)"
        />
      </div>

      <div class="space-y-3 rounded-xl border border-hairline bg-surface-2/40 p-4">
        <p class="text-[11px] font-medium uppercase tracking-wide text-tertiary">
          Model 2
          <span class="ml-1 inline-block h-2 w-2 rounded-full bg-accent align-middle" aria-hidden="true" />
          <span class="ml-1 text-tertiary normal-case tracking-normal">right</span>
        </p>
        <input
          :value="settings.model2"
          list="openrouter-models"
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="openai/gpt-5"
          class="w-full rounded-lg border bg-surface-2 px-3 py-2 font-mono text-sm text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
          :class="
            !model2Valid && (submitted || settings.model2.length > 0)
              ? 'border-danger'
              : 'border-hairline'
          "
          @input="settings.setModel2(($event.target as HTMLInputElement).value)"
        />
        <p
          v-if="!model2Valid && settings.model2.length > 0"
          class="text-xs text-danger"
        >
          Not in the OpenRouter text-model list.
        </p>
        <PersonaPicker
          :model-value="settings.persona2"
          aria-label="Persona for model 2"
          @update:model-value="settings.setPersona2($event)"
        />
      </div>
    </div>

    <!-- Caps -->
    <div class="mt-5 grid gap-5 sm:grid-cols-2">
      <div>
        <label
          for="max-rounds"
          class="block text-[11px] font-medium uppercase tracking-wide text-tertiary"
        >
          Max rounds
        </label>
        <input
          id="max-rounds"
          :value="settings.maxRounds"
          type="number"
          min="1"
          max="50"
          class="mt-1.5 w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 font-mono text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          @input="settings.setMaxRounds(Number(($event.target as HTMLInputElement).value))"
        />
        <p class="mt-1 text-[11px] text-tertiary">Hard cap. One round = a turn from each.</p>
      </div>
      <div>
        <label class="block text-[11px] font-medium uppercase tracking-wide text-tertiary">
          Stop condition (optional)
        </label>
        <input
          :value="settings.stopCondition"
          type="text"
          placeholder="end when one concedes · end when they agree on three things"
          class="mt-1.5 w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          @input="settings.setStopCondition(($event.target as HTMLInputElement).value)"
        />
        <p class="mt-1 text-[11px] text-tertiary">
          Checked after each turn. Adds one small API call per turn when set.
        </p>
      </div>
    </div>

    <div class="mt-6 flex flex-wrap items-center justify-between gap-4">
      <div class="min-h-[1.25rem] text-xs text-tertiary">
        <span v-if="loading">Loading model whitelist…</span>
        <span v-else-if="error" class="text-warning"
          >Couldn't load model whitelist ({{ error }}). Type any model id you trust — OpenRouter will validate it on the call.</span
        >
        <span v-else-if="ids.length > 0">{{ ids.length }} text models available</span>
      </div>

      <button
        type="button"
        class="rounded-full bg-accent px-7 py-2.5 font-display text-[15px] tracking-tight text-accent-text shadow-sm transition-all duration-200 ease-spring hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canStart"
        @click="onStart"
      >
        {{ startCta }}
      </button>
    </div>

    <p
      v-if="!canStart && blockReasons.length > 0"
      class="mt-2 text-right text-xs text-tertiary"
    >
      Needs: {{ blockReasons.join(", ") }}.
    </p>
  </section>
</template>
