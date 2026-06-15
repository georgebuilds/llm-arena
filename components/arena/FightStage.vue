<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useLoadout } from "~/stores/loadout";
import { useSettingsStore } from "~/stores/settings";
import { useFoley } from "~/composables/useFoley";
import { streamBout, buildBoutSystemPrompt, judgeBout, type TurnUsage } from "~/composables/useBoutStream";
import { BRANDS, JUDGING_CRITERIA, MASK_PROMPTS, MODELS } from "~/data/arena";
import Helmet from "./Helmet.vue";

const settings = useSettingsStore();

type Phase = "enter" | "announce" | "counting" | "bell" | "fighting" | "verdict";
type Side = "left" | "right";

const loadout = useLoadout();
const { leftModel, leftMask, rightModel, rightMask, rounds } = storeToRefs(loadout);
const foley = useFoley();

const phase = ref<Phase>("enter");
const countdown = ref(3);
const shake = ref(false);

// — Bout streaming state —
interface BoutMsg { side: Side; text: string }
const messages = ref<BoutMsg[]>([]);
const draft = ref<BoutMsg | null>(null);
const leftPulse = ref(false);
const rightPulse = ref(false);
const streamError = ref<string | null>(null);
const tokenTotals = ref<{ left: number; right: number }>({ left: 0, right: 0 });
let abortMock = false;
let abortCtrl: AbortController | null = null;

function addUsage(side: Side, usage?: TurnUsage) {
  if (!usage) return;
  tokenTotals.value = {
    ...tokenTotals.value,
    [side]: tokenTotals.value[side] + usage.totalTokens,
  };
}

// — Verdict state (populated when entering verdict phase) —
interface ScorePair { left: number; right: number }
const winner = ref<Side | null>(null);
const verdictScores = ref<Record<string, ScorePair>>({});
const verdictReason = ref<string>("");
const verdictDismissed = ref(false);
const deliberating = ref(false);
/** OpenRouter id of the judge model — picked in the briefing UI. Falls back
 *  to Anthropic Sonnet (clean JSON) if the configured one isn't found. */
const judgeOpenrouterId = computed(() => {
  const m = MODELS.find((x) => x.id === loadout.judgeModelId);
  return m?.openrouterId ?? "anthropic/claude-sonnet-4";
});
const verdictTotals = computed(() => {
  let l = 0, r = 0;
  for (const id in verdictScores.value) {
    l += verdictScores.value[id].left;
    r += verdictScores.value[id].right;
  }
  return { left: l, right: r };
});
const winnerModel = computed(() => winner.value === "left" ? leftModel.value : rightModel.value);
const winnerMask  = computed(() => winner.value === "left" ? leftMask.value  : rightMask.value);
const activeCriteria = computed(() =>
  JUDGING_CRITERIA.filter((c) => loadout.judging.includes(c.id))
);
// Criteria actually used for scoring — falls back to a sane default if the
// user deselected everything. Shared by the judge call and mock scoring.
const FALLBACK_CRITERIA: { id: string; label: string }[] = [
  { id: "clarity", label: "Clarity" },
  { id: "persuasion", label: "Persuasion" },
];
const effectiveCriteria = computed(() =>
  activeCriteria.value.length ? activeCriteria.value : FALLBACK_CRITERIA
);

// — Live round/turn state for the bout header —
const turnNumber = computed(() => messages.value.length + (draft.value ? 1 : 0));
const roundNumber = computed(() => Math.max(1, Math.ceil(turnNumber.value / 2) || 1));
const activeSide = computed<Side | null>(() => draft.value?.side ?? null);
const activeSpeakerName = computed(() => {
  if (!activeSide.value) return null;
  return activeSide.value === "left" ? leftModel.value.displayName : rightModel.value.displayName;
});
const activeSpeakerColor = computed<string | undefined>(() => {
  if (!activeSide.value) return undefined;
  return activeSide.value === "left" ? leftBrandColor.value : rightBrandColor.value;
});

// — Round-change announcement: brief overlay + foley pip when round advances —
const announcedRound = ref(1);
const roundFlash = ref<number | null>(null);
let roundFlashTimer = 0;
watch(roundNumber, (n) => {
  if (phase.value !== "fighting") return;
  if (n <= announcedRound.value) return;
  if (n > rounds.value) return;
  announcedRound.value = n;
  roundFlash.value = n;
  foley.drum();
  window.clearTimeout(roundFlashTimer);
  roundFlashTimer = window.setTimeout(() => { roundFlash.value = null; }, 1400);
});

const leftBrandColor  = computed(() => BRANDS[leftModel.value.brand].color);
const rightBrandColor = computed(() => BRANDS[rightModel.value.brand].color);

const emit = defineEmits<{ abort: [] }>();

// — choreography —
const timers: number[] = [];
function schedule(ms: number, fn: () => void) {
  timers.push(window.setTimeout(fn, ms));
}
function shakeBeat() {
  shake.value = true;
  schedule(180, () => { shake.value = false; });
}

onMounted(() => {
  // 0     enter (helmets slide in)
  // 1400  announce: ROUND 01 appears + horn
  // 2700  count: 3 (drum + shake)
  // 3700  count: 2 (drum + shake)
  // 4700  count: 1 (drum + shake)
  // 5700  bell + flash + transition to fighting
  // 6400  fighting

  schedule(1400, () => {
    phase.value = "announce";
    foley.horn();
  });

  schedule(2700, () => {
    phase.value = "counting";
    countdown.value = 3;
    foley.drum();
    shakeBeat();
  });

  schedule(3700, () => {
    countdown.value = 2;
    foley.drum();
    shakeBeat();
  });

  schedule(4700, () => {
    countdown.value = 1;
    foley.drum();
    shakeBeat();
  });

  schedule(5700, () => {
    phase.value = "bell";
    foley.bell();
    shakeBeat();
  });

  schedule(6400, () => {
    phase.value = "fighting";
    void startBout();
  });

  // Esc aborts back to briefing
  window.addEventListener("keydown", onKey);
});

// — Mock bout streaming —
// Placeholder for real model output (no API key). Drops in token-by-token
// to demo the visor-pulse effect. Lines are cycled to fill the configured
// round count so the demo honors the user's `rounds` selection.
const MOCK_LINES: string[] = [
  "I'll open. The strongest reading favors my position.",
  "Bold claim. Let me show why the framing is wrong.",
  "Concede the framing — the conclusion still holds.",
  "Then defend the leap from premise to conclusion.",
  "The leap is earned: each step follows from the one before it.",
  "Not quite — that step smuggles in an unproven assumption.",
  "Name it, then, and I'll either defend it or drop it.",
  "Gladly: you assume the cost lands where the benefit does.",
  "A fair hit. Grant it and the rest of the case still stands.",
  "Stands, perhaps — but weaker than you first advertised.",
];

function sleep(ms: number) {
  return new Promise<void>((res) => {
    const t = window.setTimeout(res, ms);
    timers.push(t);
  });
}

// Per-side flash timeout — reused (cleared + reset) on every chunk so a long
// stream doesn't accumulate thousands of stale ids in `timers`.
const flashTimers: Record<Side, number> = { left: 0, right: 0 };
function flash(side: Side) {
  const target = side === "left" ? leftPulse : rightPulse;
  target.value = true;
  window.clearTimeout(flashTimers[side]);
  flashTimers[side] = window.setTimeout(() => { target.value = false; }, 90);
}

async function streamMockBout() {
  abortMock = false;
  const totalTurns = Math.max(2, rounds.value * 2);
  for (let i = 0; i < totalTurns; i++) {
    if (abortMock) return;
    const side: Side = i % 2 === 0 ? "left" : "right";
    const text = MOCK_LINES[i % MOCK_LINES.length];
    draft.value = { side, text: "" };
    for (const ch of text) {
      if (abortMock) return;
      await sleep(38);
      if (!draft.value) return;
      draft.value.text += ch;
      flash(side);
    }
    if (!draft.value) return;
    messages.value.push(draft.value);
    draft.value = null;
    await sleep(550);
  }
  // bout complete — short pause then verdict
  if (abortMock) return;
  await sleep(900);
  if (!abortMock) toVerdict();
}

function rollScores(): { winner: Side; scores: Record<string, ScorePair> } {
  const ids = effectiveCriteria.value.map((c) => c.id);
  const w: Side = Math.random() < 0.5 ? "left" : "right";
  const scores: Record<string, ScorePair> = {};
  for (const id of ids) {
    const high = 70 + Math.floor(Math.random() * 25); // 70..94
    const low  = 50 + Math.floor(Math.random() * 22); // 50..71
    scores[id] = w === "left" ? { left: high, right: low } : { left: low, right: high };
  }
  return { winner: w, scores };
}

async function toVerdict() {
  // Try a real AI-judged verdict if we have an API key + actual transcript.
  // Otherwise fall back to mock random scoring.
  const apiKey = settings.apiKey?.trim();
  const haveTranscript = messages.value.length > 0;

  if (apiKey && haveTranscript) {
    deliberating.value = true;
    const ctrl = new AbortController();
    abortCtrl?.abort();
    abortCtrl = ctrl;
    try {
      const result = await judgeBout({
        apiKey,
        judgeModelId: judgeOpenrouterId.value,
        leftLabel: leftModel.value.displayName,
        rightLabel: rightModel.value.displayName,
        topic: loadout.topic,
        criteria: effectiveCriteria.value,
        transcript: messages.value.map((m) => ({ side: m.side, content: m.text })),
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      winner.value = result.winner;
      verdictScores.value = result.scores;
      verdictReason.value = result.reason;
      deliberating.value = false;
      verdictDismissed.value = false;
      phase.value = "verdict";
      foley.bell();
      recordCurrentBout(true);
      return;
    } catch (e) {
      // Judge failed — log and fall through to mock so the bout still resolves
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") { deliberating.value = false; return; }
      console.error("[judge]", err.message ?? e);
      streamError.value = `Judge failed (${err.message ?? "unknown"}). Falling back to mock scoring.`;
      deliberating.value = false;
    }
  }

  // Mock fallback (no API key, no transcript, or judge errored)
  const { winner: w, scores } = rollScores();
  winner.value = w;
  verdictScores.value = scores;
  verdictReason.value = "";
  verdictDismissed.value = false;
  phase.value = "verdict";
  foley.bell();
  recordCurrentBout(false);
}

/** Persist the current bout to history. Called once per verdict. */
function recordCurrentBout(wasJudged: boolean) {
  if (!winner.value || messages.value.length === 0) return;
  loadout.recordBout({
    leftModelId: leftModel.value.id,
    leftMaskId: leftMask.value.id,
    rightModelId: rightModel.value.id,
    rightMaskId: rightMask.value.id,
    mode: loadout.mode,
    topic: loadout.topic,
    rounds: loadout.rounds,
    transcript: messages.value.map((m) => ({ side: m.side, text: m.text })),
    winner: winner.value,
    reason: verdictReason.value,
    scores: verdictScores.value,
    judged: wasJudged,
  });
}

// — Regenerate the last turn: pop the last message, re-stream that side, re-judge —
async function redoLastTurn() {
  if (!messages.value.length) return;
  const apiKey = settings.apiKey?.trim();
  if (!apiKey) {
    streamError.value = "Regenerate needs an API key.";
    return;
  }
  // Reset verdict state and pop the last message
  abortCtrl?.abort();
  abortMock = true;
  await new Promise((r) => setTimeout(r, 0));
  abortMock = false;
  messages.value.pop();
  draft.value = null;
  winner.value = null;
  verdictScores.value = {};
  verdictReason.value = "";
  verdictDismissed.value = false;
  deliberating.value = false;
  streamError.value = null;
  // Re-sync the round-advance announcer to the popped transcript so the
  // re-streamed turn re-fires the round flash if it crosses a boundary.
  announcedRound.value = Math.max(1, Math.ceil(messages.value.length / 2) || 1);
  phase.value = "fighting";
  await nextTick();

  // Stream just one additional turn from the current transcript
  abortCtrl = new AbortController();
  try {
    await runStream(apiKey, abortCtrl.signal, {
      initialTranscript: messages.value.map((m) => ({ side: m.side, content: m.text })),
      maxAdditionalTurns: 1,
    });
  } finally {
    if (!abortCtrl?.signal.aborted && !streamError.value) {
      await sleep(500);
      if (!abortCtrl?.signal.aborted) toVerdict();
    }
  }
}

// — Copy verdict + transcript to clipboard —
const copied = ref(false);
async function copyTranscript() {
  const lines: string[] = [];
  lines.push(`${leftModel.value.displayName} (${leftMask.value.name}) vs ${rightModel.value.displayName} (${rightMask.value.name})`);
  lines.push(`Mode: ${loadout.mode} · ${loadout.rounds} round${loadout.rounds === 1 ? '' : 's'}`);
  if (loadout.topic) lines.push(`Topic: ${loadout.topic}`);
  if (winner.value) {
    const w = winner.value === "left" ? leftModel.value.displayName : rightModel.value.displayName;
    lines.push(`Champion: ${w}`);
  }
  if (verdictReason.value) lines.push(`"${verdictReason.value}"`);
  lines.push("");
  lines.push("— transcript —");
  lines.push("");
  for (const m of messages.value) {
    const name = m.side === "left" ? leftModel.value.displayName : rightModel.value.displayName;
    lines.push(`[${name}]`);
    lines.push(m.text);
    lines.push("");
  }
  if (Object.keys(verdictScores.value).length) {
    lines.push("— scores —");
    for (const id in verdictScores.value) {
      const s = verdictScores.value[id];
      lines.push(`${id.padEnd(14)} ${String(s.left).padStart(3)} / ${String(s.right).padStart(3)}`);
    }
  }
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    copied.value = true;
    foley.snap();
    window.setTimeout(() => { copied.value = false; }, 1600);
  } catch {
    streamError.value = "Couldn't copy — clipboard access denied.";
  }
}

function rematch() {
  // reset bout state and restart sequence
  abortMock = true;
  abortCtrl?.abort();
  messages.value = [];
  draft.value = null;
  winner.value = null;
  verdictScores.value = {};
  verdictReason.value = "";
  verdictDismissed.value = false;
  announcedRound.value = 1;
  roundFlash.value = null;
  window.clearTimeout(roundFlashTimer);
  tokenTotals.value = { left: 0, right: 0 };
  phase.value = "enter";
  // run intro again
  schedule(700, () => {
    phase.value = "announce";
    foley.horn();
  });
  schedule(2000, () => { phase.value = "counting"; countdown.value = 3; foley.drum(); shakeBeat(); });
  schedule(3000, () => { countdown.value = 2; foley.drum(); shakeBeat(); });
  schedule(4000, () => { countdown.value = 1; foley.drum(); shakeBeat(); });
  schedule(5000, () => { phase.value = "bell"; foley.bell(); shakeBeat(); });
  schedule(5700, () => {
    phase.value = "fighting";
    void startBout();
  });
}

// Mode-aware seed openers — the first user message both sides see.
function modeSeed(mode: string, topic: string): string {
  const t = topic.trim();
  switch (mode) {
    case "interview": return t ? `Interview topic: ${t}` : "Begin the interview.";
    case "negotiate": return t ? `Negotiation: ${t}` : "Open the negotiation.";
    case "cowrite":   return t ? `Co-write the artifact about: ${t}` : "Write the first draft.";
    case "story":     return t ? `Co-author a story about: ${t}` : "Begin the story.";
    case "debate":
    default:          return t ? `Motion before the house: ${t}` : "Begin the debate.";
  }
}

/** Shared streamBout invocation for both the opening bout and regenerate.
 *  `extra` carries the regenerate-only options (resume transcript + turn cap). */
function runStream(
  apiKey: string,
  signal: AbortSignal,
  extra?: {
    initialTranscript?: { side: Side; content: string }[];
    maxAdditionalTurns?: number;
  },
) {
  return streamBout({
    apiKey,
    left: {
      modelId: leftModel.value.openrouterId,
      systemPrompt: buildBoutSystemPrompt({
        side: "left",
        mode: loadout.mode,
        maskFlavor: MASK_PROMPTS[leftMask.value.id] ?? "",
      }),
    },
    right: {
      modelId: rightModel.value.openrouterId,
      systemPrompt: buildBoutSystemPrompt({
        side: "right",
        mode: loadout.mode,
        maskFlavor: MASK_PROMPTS[rightMask.value.id] ?? "",
      }),
    },
    topic: modeSeed(loadout.mode, loadout.topic),
    rounds: loadout.rounds,
    signal,
    initialTranscript: extra?.initialTranscript,
    maxAdditionalTurns: extra?.maxAdditionalTurns,
    onTurnStart: (side) => { draft.value = { side, text: "" }; },
    onChunk: (side, chunk) => {
      if (!draft.value) return;
      draft.value.text += chunk; // mutate in place — avoids reallocating per token
      flash(side);
    },
    onTurnEnd: (side, fullText, usage) => {
      if (draft.value) {
        messages.value.push({ side, text: fullText });
        draft.value = null;
      }
      addUsage(side, usage);
    },
    onError: (msg) => {
      streamError.value = msg;
      console.error("[bout]", msg);
    },
  });
}

/** Dispatch: real streaming if there's an API key, otherwise the mock script. */
async function startBout() {
  abortMock = true; // cancel any prior mock loop
  abortCtrl?.abort();
  await new Promise((r) => setTimeout(r, 0)); // let prior loop see abort
  abortMock = false;
  streamError.value = null;

  const apiKey = settings.apiKey?.trim();
  if (!apiKey) {
    void streamMockBout();
    return;
  }

  abortCtrl = new AbortController();

  try {
    await runStream(apiKey, abortCtrl.signal);
  } finally {
    if (!abortCtrl?.signal.aborted && !streamError.value) {
      await sleep(900);
      if (!abortCtrl?.signal.aborted) toVerdict();
    }
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") emit("abort");
}

onBeforeUnmount(() => {
  abortMock = true;
  abortCtrl?.abort();
  timers.forEach((t) => clearTimeout(t));
  window.clearTimeout(flashTimers.left);
  window.clearTimeout(flashTimers.right);
  window.clearTimeout(roundFlashTimer);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <main class="fight" :class="[`phase-${phase}`, { shake }]">
    <!-- Floor + ambient stage lighting -->
    <div class="stage-floor" aria-hidden="true" />
    <div class="spot spot--left" aria-hidden="true" />
    <div class="spot spot--right" aria-hidden="true" />
    <div class="spot spot--center" aria-hidden="true" />

    <!-- Combatants — slide in from the sides on mount -->
    <div
      class="combatant combatant--left"
      :class="{
        winner: phase === 'verdict' && winner === 'left',
        loser:  phase === 'verdict' && winner === 'right',
      }"
    >
      <div class="combatant-tag">HOME</div>
      <div
        class="combatant-helmet"
        :class="{ pulse: leftPulse }"
        :style="{ '--pulse-color': leftBrandColor }"
      >
        <Helmet :brand="leftModel.brand" :tier="leftModel.tier" />
      </div>
      <div class="combatant-name">{{ leftModel.displayName }}</div>
      <div class="combatant-mask" :style="{ color: leftMask.color }">{{ leftMask.name }}</div>
    </div>

    <div
      class="combatant combatant--right"
      :class="{
        winner: phase === 'verdict' && winner === 'right',
        loser:  phase === 'verdict' && winner === 'left',
      }"
    >
      <div class="combatant-tag">CHALLENGER</div>
      <div
        class="combatant-helmet"
        :class="{ pulse: rightPulse }"
        :style="{ '--pulse-color': rightBrandColor }"
      >
        <Helmet :brand="rightModel.brand" :tier="rightModel.tier" flipped />
      </div>
      <div class="combatant-name">{{ rightModel.displayName }}</div>
      <div class="combatant-mask" :style="{ color: rightMask.color }">{{ rightMask.name }}</div>
    </div>

    <!-- ROUND 01 announce -->
    <Transition name="announce">
      <div v-if="phase === 'announce'" class="announce" key="announce">
        <div class="announce-eyebrow">— Round 01 of {{ rounds }} —</div>
        <div class="announce-vs">
          <span>VS</span>
        </div>
      </div>
    </Transition>

    <!-- Countdown number — keyed so each digit is its own element -->
    <Transition name="count">
      <div v-if="phase === 'counting'" class="countdown" :key="countdown">
        <span class="count-num">{{ countdown }}</span>
      </div>
    </Transition>

    <!-- Bell flash -->
    <Transition name="flash">
      <div v-if="phase === 'bell'" class="bell-flash" key="flash" />
    </Transition>

    <!-- Round advance flash — quick pip near the top when a new round starts -->
    <Transition name="round-flash">
      <div v-if="roundFlash" class="round-flash" :key="roundFlash">
        <span class="rf-eyebrow">Round</span>
        <span class="rf-num">{{ String(roundFlash).padStart(2, '0') }}</span>
      </div>
    </Transition>

    <!-- Verdict overlay -->
    <Transition name="verdict">
      <section v-if="phase === 'verdict' && !verdictDismissed" class="verdict" key="verdict">
        <header class="verdict-head">
          <div class="verdict-eyebrow">— Verdict —</div>
          <div class="verdict-decision">By unanimous decision</div>
        </header>

        <div class="verdict-winner" :style="{ '--accent': BRANDS[winnerModel.brand].color }">
          <div class="winner-tag">CHAMPION</div>
          <div class="winner-name">{{ winnerModel.displayName }}</div>
          <div class="winner-mask" :style="{ color: winnerMask.color }">
            wearing the {{ winnerMask.name }} mask
          </div>
          <div v-if="verdictReason" class="winner-reason">
            &ldquo;{{ verdictReason }}&rdquo;
          </div>
        </div>

        <div class="verdict-stats">
          <div
            v-for="c in activeCriteria"
            :key="c.id"
            class="stat-row"
          >
            <div class="stat-label">{{ c.label }}</div>
            <div class="stat-bars">
              <div class="stat-side stat-side--left">
                <div
                  class="stat-bar"
                  :style="{
                    width: (verdictScores[c.id]?.left ?? 0) + '%',
                    background: leftBrandColor,
                  }"
                />
                <span class="stat-num">{{ verdictScores[c.id]?.left ?? 0 }}</span>
              </div>
              <div class="stat-side stat-side--right">
                <span class="stat-num">{{ verdictScores[c.id]?.right ?? 0 }}</span>
                <div
                  class="stat-bar"
                  :style="{
                    width: (verdictScores[c.id]?.right ?? 0) + '%',
                    background: rightBrandColor,
                  }"
                />
              </div>
            </div>
          </div>
          <div class="stat-totals">
            <span :style="{ color: leftBrandColor }">
              {{ verdictTotals.left }}
            </span>
            <span class="totals-sep">·</span>
            <span :style="{ color: rightBrandColor }">
              {{ verdictTotals.right }}
            </span>
          </div>
        </div>

        <footer class="verdict-actions">
          <button class="action-btn" @click="emit('abort')">← New loadout</button>
          <button class="action-btn" @click="copyTranscript">
            {{ copied ? '✓ Copied' : '⧉ Copy' }}
          </button>
          <button class="action-btn" @click="verdictDismissed = true">View transcript</button>
          <button
            v-if="settings.apiKey?.trim() && messages.length > 0"
            class="action-btn"
            @click="redoLastTurn"
            title="Regenerate the last turn and re-judge"
          >
            ⤺ Redo last
          </button>
          <button class="action-btn primary" @click="rematch">↻ Rematch</button>
        </footer>
      </section>
    </Transition>

    <!-- Floating "show verdict" pill — only when verdict has been dismissed -->
    <Transition name="recall">
      <button
        v-if="phase === 'verdict' && verdictDismissed"
        class="verdict-recall"
        @click="verdictDismissed = false"
      >
        <span class="recall-mark">◆</span>
        Show verdict
      </button>
    </Transition>

    <!-- Bout streaming surface — stays visible through verdict so the
         transcript can be reviewed once the result is dismissed. -->
    <Transition name="bout">
      <section v-if="phase === 'fighting' || phase === 'verdict'" class="bout" key="bout">
        <header class="bout-header">
          <span class="bout-pip" />
          <span class="bout-label">
            Round {{ String(roundNumber).padStart(2, '0') }}
            <span class="bout-label-sep">/</span>
            {{ String(rounds).padStart(2, '0') }}
            <span class="bout-label-sep">·</span>
            {{ settings.apiKey?.trim() ? 'Live' : 'Demo' }}
          </span>
          <Transition name="active-fade">
            <span
              v-if="activeSpeakerName"
              class="bout-active"
              :style="{ '--accent': activeSpeakerColor }"
              :key="activeSpeakerName + turnNumber"
            >
              <span class="active-dot" />
              {{ activeSpeakerName }}
              <span class="active-verb">replying</span>
            </span>
          </Transition>
          <button class="bout-abort" @click="emit('abort')" title="abort bout (esc)">esc</button>
        </header>
        <div v-if="loadout.topic" class="bout-topic" :title="loadout.topic">
          &ldquo;{{ loadout.topic }}&rdquo;
        </div>
        <div v-if="streamError" class="bout-error">
          {{ streamError }}
        </div>
        <div v-if="deliberating" class="bout-judging">
          <span class="judging-mark">◆</span>
          <span>Judge deliberating…</span>
        </div>

        <div class="bout-feed">
          <div
            v-for="(m, i) in messages"
            :key="i"
            class="bubble"
            :class="`bubble--${m.side}`"
            :style="{ '--accent': m.side === 'left' ? leftBrandColor : rightBrandColor }"
          >
            <div class="bubble-tag">
              {{ (m.side === 'left' ? leftModel.displayName : rightModel.displayName) }}
            </div>
            <div class="bubble-text">{{ m.text }}</div>
          </div>

          <div
            v-if="tokenTotals.left + tokenTotals.right > 0"
            class="bout-tokens"
          >
            <span class="tok-label">tokens</span>
            <span class="tok-side" :style="{ color: leftBrandColor }">
              {{ tokenTotals.left.toLocaleString() }}
            </span>
            <span class="tok-sep">/</span>
            <span class="tok-side" :style="{ color: rightBrandColor }">
              {{ tokenTotals.right.toLocaleString() }}
            </span>
          </div>

          <div
            v-if="draft"
            class="bubble"
            :class="`bubble--${draft.side}`"
            :style="{ '--accent': draft.side === 'left' ? leftBrandColor : rightBrandColor }"
          >
            <div class="bubble-tag">
              {{ (draft.side === 'left' ? leftModel.displayName : rightModel.displayName) }}
              <span class="streaming-dot" />
            </div>
            <div class="bubble-text">
              <template v-if="draft.text">{{ draft.text }}<span class="caret" /></template>
              <span v-else class="bubble-thinking">
                thinking<span class="thinking-dots"><span /><span /><span /></span>
              </span>
            </div>
          </div>
        </div>
      </section>
    </Transition>
  </main>
</template>

<style scoped>
.fight {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 110%, #1a2030 0%, transparent 60%),
    radial-gradient(ellipse at 50% -20%, #11151c 0%, transparent 70%),
    #03050a;
  overflow: hidden;
  color: #e8ebf0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* — stage floor: grid with perspective fading toward horizon — */
.stage-floor {
  position: absolute;
  left: -10%;
  right: -10%;
  bottom: 0;
  height: 38%;
  background:
    linear-gradient(to top, rgba(111, 225, 243, 0.08) 0%, transparent 80%),
    repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 64px),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 64px);
  transform: perspective(800px) rotateX(62deg);
  transform-origin: bottom;
  mask-image: linear-gradient(to top, black 30%, transparent 100%);
}

/* — spotlights — */
.spot {
  position: absolute;
  pointer-events: none;
  mix-blend-mode: screen;
}
.spot--left {
  top: -10%; left: 5%;
  width: 50%; height: 90%;
  background: radial-gradient(ellipse at 50% 0%, rgba(180, 200, 230, 0.18) 0%, transparent 60%);
}
.spot--right {
  top: -10%; right: 5%;
  width: 50%; height: 90%;
  background: radial-gradient(ellipse at 50% 0%, rgba(180, 200, 230, 0.18) 0%, transparent 60%);
}
.spot--center {
  top: -10%; left: 25%;
  width: 50%; height: 60%;
  background: radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.10) 0%, transparent 70%);
}

/* — combatants — */
.combatant {
  position: absolute;
  top: 18%;
  width: 28%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  z-index: 5;
  opacity: 0;
  transition: opacity 700ms cubic-bezier(0.4, 0, 0.2, 1),
              transform 900ms cubic-bezier(0.34, 1.4, 0.64, 1);
}
.combatant--left  { left: 4%;  transform: translateX(-160px); }
.combatant--right { right: 4%; transform: translateX(160px); }
/* slide in once mounted — phase-enter is the initial state */
.fight.phase-announce .combatant,
.fight.phase-counting .combatant,
.fight.phase-bell .combatant,
.fight.phase-fighting .combatant {
  opacity: 1;
  transform: translateX(0);
}
/* keep them visible during enter too — animate in immediately */
.fight.phase-enter .combatant {
  opacity: 1;
  transform: translateX(0);
}

.combatant-helmet {
  width: 280px;
  filter: drop-shadow(0 18px 40px rgba(0, 0, 0, 0.7));
  transition: filter 80ms cubic-bezier(0.4, 0, 0.2, 1);
}
/* Visor pulse — token-time brightness flash tinted by brand color glow */
.combatant-helmet.pulse {
  filter:
    drop-shadow(0 18px 40px rgba(0, 0, 0, 0.7))
    drop-shadow(0 0 28px var(--pulse-color, #6fe1f3))
    brightness(1.18);
}
.combatant-tag {
  font-size: 10px;
  letter-spacing: 0.5em;
  color: #6e747e;
  text-transform: uppercase;
}
.combatant-name {
  font-size: 18px;
  font-weight: 500;
  color: #e8ebf0;
  letter-spacing: 0.04em;
}
.combatant-mask {
  font-size: 11px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  font-weight: 500;
  text-shadow: 0 0 12px currentColor;
}

/* — announce: ROUND 01 banner — */
.announce {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 10;
}
.announce-eyebrow {
  font-size: 11px;
  letter-spacing: 0.6em;
  color: #6fe1f3;
  text-transform: uppercase;
  margin-bottom: 16px;
  text-shadow: 0 0 16px rgba(111, 225, 243, 0.5);
}
.announce-vs {
  font-size: 64px;
  font-weight: 100;
  letter-spacing: 0.3em;
  color: #ffffff;
  text-shadow: 0 0 32px rgba(255, 255, 255, 0.3);
}
.announce-enter-active { transition: all 600ms cubic-bezier(0.34, 1.4, 0.64, 1); }
.announce-leave-active { transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1); }
.announce-enter-from { opacity: 0; transform: translate(-50%, -30%); letter-spacing: 0.5em; }
.announce-leave-to   { opacity: 0; transform: translate(-50%, -70%); }

/* — countdown digit — */
.countdown {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 12;
  pointer-events: none;
}
.count-num {
  font-size: 280px;
  font-weight: 100;
  color: #ffffff;
  line-height: 1;
  letter-spacing: -0.04em;
  text-shadow:
    0 0 60px rgba(111, 225, 243, 0.5),
    0 0 120px rgba(111, 225, 243, 0.25);
  display: block;
}
.count-enter-active {
  animation: countIn 900ms cubic-bezier(0.34, 1.6, 0.64, 1);
}
.count-leave-active {
  animation: countOut 400ms cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes countIn {
  0%   { opacity: 0; transform: scale(2.4); }
  20%  { opacity: 1; }
  100% { opacity: 0.85; transform: scale(1); }
}
@keyframes countOut {
  to { opacity: 0; transform: scale(0.7); filter: blur(6px); }
}

/* — bell white flash — */
.bell-flash {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(255,255,255,0.4) 0%, transparent 70%);
  z-index: 15;
  pointer-events: none;
  animation: flashOut 700ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
@keyframes flashOut {
  0%   { opacity: 0.95; }
  30%  { opacity: 0.7; }
  100% { opacity: 0; }
}
.flash-leave-active { transition: opacity 400ms; }
.flash-leave-to { opacity: 0; }

/* Quick round-advance pip near the top — no obstruction */
.round-flash {
  position: absolute;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 11;
  display: inline-flex;
  align-items: baseline;
  gap: 12px;
  padding: 10px 20px;
  background: linear-gradient(180deg, rgba(15, 18, 24, 0.92), rgba(8, 10, 14, 0.95));
  border: 1px solid rgba(111, 225, 243, 0.35);
  border-radius: 6px;
  backdrop-filter: blur(6px);
  pointer-events: none;
}
.rf-eyebrow {
  font-size: 9px;
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: #6fe1f3;
  text-shadow: 0 0 12px rgba(111, 225, 243, 0.5);
}
.rf-num {
  font-size: 22px;
  font-weight: 200;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
.round-flash-enter-active { transition: all 320ms cubic-bezier(0.34, 1.4, 0.64, 1); }
.round-flash-leave-active { transition: all 280ms cubic-bezier(0.4, 0, 0.2, 1); }
.round-flash-enter-from { opacity: 0; transform: translate(-50%, -10px) scale(0.94); }
.round-flash-leave-to   { opacity: 0; transform: translate(-50%, -6px); }

/* — screen shake on drum hits — */
.fight.shake { animation: shake 180ms cubic-bezier(0.36, 0.07, 0.19, 0.97); }
@keyframes shake {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-6px, 2px); }
  50% { transform: translate(5px, -3px); }
  75% { transform: translate(-3px, 4px); }
}

/* — bout streaming surface — */
.bout {
  position: absolute;
  left: 32%;
  right: 32%;
  bottom: 6%;
  top: 56%;
  display: flex;
  flex-direction: column;
  z-index: 8;
}
.bout-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 12px;
}
.bout-pip {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
  animation: pip 1.4s ease-in-out infinite;
}
@keyframes pip {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.bout-label {
  font-size: 10px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #c8ccd2;
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.bout-label-sep { opacity: 0.35; font-weight: 200; }

.bout-active {
  --accent: #6fe1f3;
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--accent);
  text-shadow: 0 0 8px var(--accent);
  margin-left: 4px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.active-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
  flex-shrink: 0;
  animation: pip 1s ease-in-out infinite;
}
.active-verb {
  color: #6e747e;
  text-shadow: none;
  letter-spacing: 0.3em;
}
.active-fade-enter-active, .active-fade-leave-active {
  transition: opacity 220ms, transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1);
}
.active-fade-enter-from { opacity: 0; transform: translateX(-6px); }
.active-fade-leave-to   { opacity: 0; transform: translateX(6px); }
.bout-abort {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #6e747e;
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 3px;
  cursor: pointer;
  transition: color 120ms, border-color 120ms;
}
.bout-abort:hover { color: #c8ccd2; border-color: rgba(255, 255, 255, 0.25); }

.bout-tokens {
  display: inline-flex;
  align-items: center;
  align-self: flex-end;
  gap: 6px;
  font-size: 9px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #6e747e;
  font-variant-numeric: tabular-nums;
  margin-bottom: 6px;
  padding: 3px 9px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 999px;
}
.tok-label { color: #4a4f58; }
.tok-side { font-weight: 500; letter-spacing: 0.04em; }
.tok-sep { color: rgba(255, 255, 255, 0.2); }

.bout-topic {
  font-size: 11px;
  color: #8b929d;
  font-style: italic;
  letter-spacing: 0.02em;
  line-height: 1.45;
  padding: 2px 4px 8px;
  margin-bottom: 6px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.bout-error {
  font-size: 11px;
  color: #ff8b8b;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 4px;
  padding: 7px 10px;
  margin-bottom: 10px;
  letter-spacing: 0.02em;
  line-height: 1.45;
}

.bout-judging {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #ffe8a8;
  background: rgba(255, 232, 168, 0.06);
  border: 1px solid rgba(255, 232, 168, 0.22);
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 10px;
}
.judging-mark {
  font-size: 11px;
  animation: pulseGlyph 1.4s ease-in-out infinite;
  text-shadow: 0 0 10px rgba(255, 232, 168, 0.6);
}
@keyframes pulseGlyph {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}

.bout-feed {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}
.bout-feed::-webkit-scrollbar { width: 6px; }
.bout-feed::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

.bubble {
  --accent: #6fe1f3;
  position: relative;
  background: linear-gradient(180deg, rgba(15, 18, 24, 0.85), rgba(8, 10, 14, 0.95));
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-left: 2px solid var(--accent);
  border-radius: 4px;
  padding: 10px 14px;
  backdrop-filter: blur(6px);
  max-width: min(88%, 520px);
  min-width: 0;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  animation: bubbleIn 260ms cubic-bezier(0.34, 1.4, 0.64, 1) both;
  overflow-wrap: anywhere;
  word-break: break-word;
}
@keyframes bubbleIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.bubble--left  { align-self: flex-start; border-left-width: 2px; border-right: 1px solid rgba(255, 255, 255, 0.06); }
.bubble--right { align-self: flex-end;   border-left: 1px solid rgba(255, 255, 255, 0.06); border-right: 2px solid var(--accent); }
.bubble-tag {
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.streaming-dot {
  display: inline-block;
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--accent);
  animation: pip 0.8s ease-in-out infinite;
}
.bubble-text {
  font-size: 12px;
  color: #e8ebf0;
  line-height: 1.55;
  letter-spacing: 0.01em;
}
.caret {
  display: inline-block;
  width: 7px;
  height: 13px;
  background: var(--accent);
  margin-left: 2px;
  vertical-align: -2px;
  animation: caret 0.7s steps(1, end) infinite;
}
@keyframes caret {
  0%, 50% { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}

.bubble-thinking {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-style: italic;
  color: #6e747e;
  letter-spacing: 0.05em;
}
.thinking-dots {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
}
.thinking-dots > span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.3;
  animation: thinkPulse 1.2s ease-in-out infinite;
}
.thinking-dots > span:nth-child(2) { animation-delay: 0.15s; }
.thinking-dots > span:nth-child(3) { animation-delay: 0.30s; }
@keyframes thinkPulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
  40%           { opacity: 1;   transform: scale(1.1);  }
}

.bout-enter-active { transition: all 600ms cubic-bezier(0.34, 1.4, 0.64, 1) 100ms; }
.bout-enter-from { opacity: 0; transform: translateY(40px); }

/* — verdict — */
.combatant.winner {
  transform: translateX(0) translateY(-12px) scale(1.05);
  filter: drop-shadow(0 0 24px rgba(255, 240, 200, 0.25));
  z-index: 6;
}
.combatant.loser {
  filter: saturate(0.4) brightness(0.7);
  opacity: 0.55;
}
.combatant.winner .combatant-name { color: #ffe8a8; text-shadow: 0 0 18px rgba(255, 232, 168, 0.4); }

.verdict {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(640px, 86vw);
  z-index: 9;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 28px 36px;
  background: linear-gradient(180deg, rgba(15, 18, 24, 0.92), rgba(8, 10, 14, 0.96));
  border: 1px solid rgba(255, 232, 168, 0.18);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  box-shadow:
    0 30px 80px -20px rgba(0, 0, 0, 0.7),
    0 0 60px -10px rgba(255, 232, 168, 0.15);
}

.verdict-head { display: flex; flex-direction: column; gap: 6px; }
.verdict-eyebrow {
  font-size: 10px;
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: #ffe8a8;
  text-shadow: 0 0 16px rgba(255, 232, 168, 0.35);
}
.verdict-decision {
  font-size: 14px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #c8ccd2;
  font-weight: 300;
}

.verdict-winner {
  --accent: #6fe1f3;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.winner-tag {
  font-size: 9px;
  letter-spacing: 0.6em;
  color: #6e747e;
  text-transform: uppercase;
}
.winner-name {
  font-size: 30px;
  font-weight: 200;
  letter-spacing: 0.06em;
  color: #ffffff;
  text-shadow: 0 0 24px var(--accent);
}
.winner-mask {
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 500;
  text-shadow: 0 0 10px currentColor;
}
.winner-reason {
  font-size: 12px;
  color: #c8ccd2;
  font-style: italic;
  line-height: 1.5;
  margin: 6px auto 0;
  max-width: 460px;
  letter-spacing: 0.01em;
}

.verdict-stats { display: flex; flex-direction: column; gap: 10px; }
.stat-row { display: flex; align-items: center; gap: 14px; }
.stat-label {
  font-size: 9px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: #8b929d;
  width: 90px;
  text-align: right;
}
.stat-bars { flex: 1; display: flex; align-items: center; gap: 6px; }
.stat-side {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}
.stat-side--left { flex-direction: row-reverse; justify-content: flex-start; }
.stat-side--right { justify-content: flex-start; }
.stat-bar {
  height: 5px;
  border-radius: 2px;
  transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 8px currentColor;
  opacity: 0.85;
}
.stat-num {
  font-size: 11px;
  color: #c8ccd2;
  font-variant-numeric: tabular-nums;
  width: 24px;
  text-align: center;
}

.stat-totals {
  margin-top: 6px;
  display: flex;
  justify-content: center;
  gap: 16px;
  font-size: 22px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
}
.totals-sep { color: rgba(255, 255, 255, 0.2); }

.verdict-actions { display: flex; gap: 10px; justify-content: center; }
.action-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #c8ccd2;
  padding: 11px 22px;
  border-radius: 4px;
  font-size: 11px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 120ms;
}
.action-btn:hover { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.2); }
.action-btn.primary {
  border-color: rgba(255, 232, 168, 0.4);
  color: #ffe8a8;
}
.action-btn.primary:hover { background: rgba(255, 232, 168, 0.08); border-color: #ffe8a8; }

.verdict-enter-active { transition: all 700ms cubic-bezier(0.34, 1.4, 0.64, 1); }
.verdict-leave-active { transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1); }
.verdict-enter-from { opacity: 0; transform: translate(-50%, -42%) scale(0.96); }
.verdict-leave-to   { opacity: 0; transform: translate(-50%, -50%) scale(0.98); }

/* Floating pill to recall the dismissed verdict overlay */
.verdict-recall {
  position: absolute;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  background: linear-gradient(180deg, rgba(15, 18, 24, 0.92), rgba(8, 10, 14, 0.96));
  border: 1px solid rgba(255, 232, 168, 0.3);
  border-radius: 999px;
  color: #ffe8a8;
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  cursor: pointer;
  z-index: 10;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  transition: background 120ms, border-color 120ms;
}
.verdict-recall:hover {
  background: linear-gradient(180deg, rgba(20, 24, 32, 0.95), rgba(12, 14, 20, 0.98));
  border-color: #ffe8a8;
}
.recall-mark { font-size: 10px; }
.recall-enter-active, .recall-leave-active {
  transition: opacity 220ms, transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1);
}
.recall-enter-from { opacity: 0; transform: translate(-50%, -8px); }
.recall-leave-to   { opacity: 0; transform: translate(-50%, -8px); }
</style>
