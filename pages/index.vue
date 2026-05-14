<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useLoadout, type ArenaStage } from "~/stores/loadout";
import { useSettingsStore } from "~/stores/settings";
import { useFoley } from "~/composables/useFoley";
import LoadoutStage from "~/components/arena/LoadoutStage.vue";
import BriefingStage from "~/components/arena/BriefingStage.vue";
import FightStage from "~/components/arena/FightStage.vue";

const foley = useFoley();
// Initialize from persisted mute state — useFoley() hydrated it from localStorage.
const audioOn = ref(!foley.isMuted());
function toggleAudio() {
  audioOn.value = !audioOn.value;
  foley.setMuted(!audioOn.value);
  if (audioOn.value) foley.tick();
}

// — API key popover —
const settings = useSettingsStore();
const keyOpen = ref(false);
const keyDraft = ref("");
const keyInputRef = ref<HTMLInputElement | null>(null);
const hasKey = computed(() => settings.apiKey?.trim().length > 0);

function toggleKey() {
  if (!keyOpen.value) {
    keyDraft.value = settings.apiKey ?? "";
    keyOpen.value = true;
    nextTick(() => keyInputRef.value?.focus());
  } else {
    keyOpen.value = false;
  }
}
function saveKey() {
  settings.setApiKey(keyDraft.value);
  settings.persist();
  keyOpen.value = false;
  foley.snap();
}
function clearKey() {
  settings.setApiKey("");
  settings.persist();
  keyDraft.value = "";
  keyOpen.value = false;
}
function onDocClick(e: MouseEvent) {
  if (!keyOpen.value) return;
  const t = e.target as HTMLElement;
  if (!t.closest(".key-popover") && !t.closest(".notch-key")) keyOpen.value = false;
}
function onDocKey(e: KeyboardEvent) {
  if (e.key === "Escape" && keyOpen.value) keyOpen.value = false;
}

useSeoMeta({
  title: "LLM Arena — pit two language models against each other",
  description: "Choose your champion.",
});

definePageMeta({ layout: false });

const loadout = useLoadout();
const { stage } = storeToRefs(loadout);

const STAGES: { id: ArenaStage; label: string; step: string }[] = [
  { id: "loadout",  label: "Loadout",  step: "STEP 01" },
  { id: "briefing", label: "Briefing", step: "STEP 02" },
  { id: "fight",    label: "Bout",     step: "STEP 03" },
];

const stepLabel = computed(() => {
  const s = STAGES.find((x) => x.id === stage.value)!;
  return `${s.step} · ${s.label.toUpperCase()}`;
});

function go(next: ArenaStage) {
  const update = () => { stage.value = next; };
  if (typeof document !== "undefined" && "startViewTransition" in document) {
    (document as unknown as { startViewTransition: (cb: () => void) => void })
      .startViewTransition(update);
  } else {
    update();
  }
}

// — Live viewport readout for the desktop gate —
const viewport = ref("—");
function updateViewport() {
  if (typeof window === "undefined") return;
  viewport.value = `${window.innerWidth} × ${window.innerHeight}`;
}
onMounted(() => {
  // Random model picks + history hydrate run client-only (after SSR
  // hydration) so the server-rendered HTML stays deterministic. WheelStack
  // watches modelIdx/maskIdx and snaps to the new index when init lands.
  loadout.init();
  updateViewport();
  window.addEventListener("resize", updateViewport);
  document.addEventListener("mousedown", onDocClick);
  document.addEventListener("keydown", onDocKey);
});
onBeforeUnmount(() => {
  if (typeof window !== "undefined") window.removeEventListener("resize", updateViewport);
  if (typeof document !== "undefined") {
    document.removeEventListener("mousedown", onDocClick);
    document.removeEventListener("keydown", onDocKey);
  }
});
</script>

<template>
  <div class="arena">
    <!-- SVG filter defs (invisible). Helmet backdrop dilates the alpha
         channel only, then floods with a solid dark gunmetal — produces
         a clean silhouette underlay that bridges trace gaps without
         dragging any near-white anti-alias pixels along with it. -->
    <svg class="arena-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter id="helmet-dilate" x="-15%" y="-15%" width="130%" height="130%">
          <feMorphology operator="dilate" radius="3" in="SourceAlpha" result="dilated" />
          <feFlood flood-color="#54585f" />
          <feComposite in2="dilated" operator="in" />
        </filter>
      </defs>
    </svg>

    <div class="bg-grid" aria-hidden="true" />
    <div class="bg-vignette" aria-hidden="true" />

    <!-- Mobile / narrow-viewport blackout — desktop-only experience -->
    <aside class="desktop-gate" aria-live="polite">
      <div class="dg-card">
        <div class="dg-mark" aria-hidden="true">◆</div>
        <div class="dg-eyebrow">LLM Arena · Restricted Access</div>
        <h1 class="dg-title">Built for the big screen.</h1>
        <p class="dg-body">
          The wheels need room. Bring this back on a wider display —
          a laptop, a desktop, anything past <span class="dg-num">1024px</span> wide.
        </p>
        <div class="dg-meta">
          <span class="dg-stat"><span class="dg-stat-label">your viewport</span><span class="dg-stat-val">{{ viewport }} px</span></span>
          <span class="dg-divider" />
          <span class="dg-stat"><span class="dg-stat-label">required</span><span class="dg-stat-val">≥ 1024 px</span></span>
        </div>
      </div>
    </aside>

    <header class="notch" :title="stepLabel">
      <div class="notch-inner">
        <span class="notch-mark" aria-hidden="true">◆</span>
        <nav class="step-trail" aria-label="Arena progress">
          <span
            v-for="s in STAGES"
            :key="s.id"
            class="step-dot"
            :class="{
              active: stage === s.id,
              past: STAGES.findIndex(x => x.id === stage) > STAGES.findIndex(x => x.id === s.id),
            }"
          >
            {{ s.label }}
          </span>
        </nav>
        <button
          class="notch-key"
          :class="{ set: hasKey }"
          @click="toggleKey"
          :title="hasKey ? 'API key set — click to edit' : 'set API key'"
          :aria-pressed="keyOpen"
          :aria-label="hasKey ? 'API key set' : 'API key not set'"
        >
          <span class="key-glyph" aria-hidden="true">⌘</span>
          <span class="key-dot" :class="{ on: hasKey }" />
        </button>
        <button
          class="notch-audio"
          :class="{ muted: !audioOn }"
          @click="toggleAudio"
          :title="audioOn ? 'mute audio' : 'unmute audio'"
          :aria-pressed="audioOn"
          :aria-label="audioOn ? 'mute audio' : 'unmute audio'"
        >
          <span class="audio-dot" />
        </button>
      </div>
    </header>

    <!-- API key popover -->
    <Transition name="pop">
      <div v-if="keyOpen" class="key-popover" role="dialog" aria-label="OpenRouter API key">
        <div class="popover-eyebrow">OpenRouter API key</div>
        <input
          ref="keyInputRef"
          v-model="keyDraft"
          type="password"
          class="popover-input"
          placeholder="sk-or-v1-…"
          spellcheck="false"
          autocomplete="off"
          @keydown.enter="saveKey"
        />
        <div class="popover-actions">
          <button class="popover-btn" @click="clearKey" :disabled="!hasKey">Clear</button>
          <button class="popover-btn primary" @click="saveKey" :disabled="!keyDraft.trim()">Save</button>
        </div>
        <p class="popover-hint">
          Stored locally. Required for live bouts — without it, the arena runs in Demo mode.
        </p>
      </div>
    </Transition>

    <Transition name="stage" mode="out-in">
      <LoadoutStage
        v-if="stage === 'loadout'"
        key="loadout"
        @advance="go('briefing')"
      />
      <BriefingStage
        v-else-if="stage === 'briefing'"
        key="briefing"
        @back="go('loadout')"
        @ignite="go('fight')"
      />
      <FightStage
        v-else
        key="fight"
        @abort="go('briefing')"
      />
    </Transition>

  </div>
</template>

<style scoped>
.arena {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 40%, #1a2030 0%, transparent 60%),
    radial-gradient(ellipse at 50% 100%, #0e1118 0%, transparent 50%),
    #06080c;
  color: #e8ebf0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  overflow: hidden;
  user-select: none;
}

.arena-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}
.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 80px 80px;
  pointer-events: none;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
}
.bg-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.6) 100%);
  pointer-events: none;
}

/* ── Notch ─────────────────────────────────────────────────
   Centered HUD panel at the top — slight parallelogram skew
   on the shell, contents counter-skewed back to upright. */
.notch {
  position: absolute;
  top: 14px;
  left: 50%;
  z-index: 20;
  transform: translateX(-50%) skewX(-10deg);
  background: linear-gradient(180deg, #15191f 0%, #0a0c11 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  box-shadow:
    0 6px 18px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
}
.notch::before {
  /* thin cyan accent along the top edge — telegraphs that this is a status panel */
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, #6fe1f3 50%, transparent 100%);
  opacity: 0.5;
}
.notch-inner {
  transform: skewX(10deg);
  padding: 9px 22px;
  display: flex;
  align-items: center;
  gap: 18px;
}
.notch-mark {
  color: #6fe1f3;
  font-size: 12px;
  filter: drop-shadow(0 0 6px rgba(111, 225, 243, 0.55));
}

.notch-audio {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  transition: border-color 120ms, background 120ms;
}
.notch-audio:hover { border-color: rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.03); }
.audio-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6fe1f3;
  box-shadow: 0 0 6px #6fe1f3;
  transition: background 120ms, box-shadow 120ms;
}
.notch-audio.muted .audio-dot {
  background: #4a4f58;
  box-shadow: none;
}

.notch-key {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 4px 8px 4px 9px;
  cursor: pointer;
  color: #6e747e;
  transition: border-color 120ms, color 120ms, background 120ms;
}
.notch-key:hover { border-color: rgba(255, 255, 255, 0.2); color: #c8ccd2; }
.notch-key.set { color: #c8ccd2; }
.key-glyph { font-size: 10px; font-weight: 600; letter-spacing: 0; }
.key-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4a4f58;
  transition: background 120ms, box-shadow 120ms;
}
.key-dot.on { background: #6fe1f3; box-shadow: 0 0 6px #6fe1f3; }

/* — API key popover — */
.key-popover {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  width: 320px;
  background: linear-gradient(180deg, #15191f 0%, #0a0c11 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.popover-eyebrow {
  font-size: 9px;
  letter-spacing: 0.4em;
  color: #6e747e;
  text-transform: uppercase;
}
.popover-input {
  background: #0a0d12;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: #e8ebf0;
  padding: 9px 11px;
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  font-size: 12px;
  letter-spacing: 0.02em;
  transition: border-color 120ms;
}
.popover-input:focus {
  outline: none;
  border-color: #6fe1f3;
  box-shadow: 0 0 0 3px rgba(111, 225, 243, 0.1);
}
.popover-input::placeholder { color: #4a4f58; }
.popover-actions { display: flex; gap: 6px; justify-content: flex-end; }
.popover-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #c8ccd2;
  padding: 7px 14px;
  border-radius: 4px;
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 120ms;
}
.popover-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.popover-btn:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
}
.popover-btn.primary {
  border-color: rgba(111, 225, 243, 0.4);
  color: #6fe1f3;
}
.popover-btn.primary:not(:disabled):hover {
  background: rgba(111, 225, 243, 0.08);
  border-color: #6fe1f3;
}
.popover-hint { font-size: 10px; color: #6e747e; line-height: 1.5; margin: 2px 0 0; letter-spacing: 0.02em; }

.pop-enter-active, .pop-leave-active { transition: opacity 180ms, transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1); }
.pop-enter-from { opacity: 0; transform: translate(-50%, -8px); }
.pop-leave-to   { opacity: 0; transform: translate(-50%, -8px); }

/* step trail */
.step-trail {
  display: flex;
  align-items: center;
  gap: 18px;
  justify-content: center;
}
.step-dot {
  position: relative;
  font-size: 9px;
  letter-spacing: 0.4em;
  color: #4a4f58;
  padding-bottom: 4px;
  transition: color 200ms;
}
.step-dot::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  background: transparent;
  transition: background 200ms;
}
.step-dot.past { color: #6e747e; }
.step-dot.active {
  color: #6fe1f3;
}
.step-dot.active::after {
  background: #6fe1f3;
  box-shadow: 0 0 6px #6fe1f3;
}

.hint { display: flex; align-items: center; gap: 10px; color: #6e747e; }
.hint .sep { opacity: 0.4; }
.kbd {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 2px 7px;
  border-radius: 3px;
  color: #c8ccd2;
  letter-spacing: 0.1em;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6fe1f3;
  display: inline-block;
  box-shadow: 0 0 6px #6fe1f3;
}

/* stage transition */
.stage-enter-active,
.stage-leave-active {
  transition: opacity 320ms cubic-bezier(0.4, 0, 0.2, 1),
              transform 320ms cubic-bezier(0.4, 0, 0.2, 1);
}
.stage-enter-from {
  opacity: 0;
  transform: translateY(24px);
}
.stage-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.99);
}

/* ── Desktop gate ───────────────────────────────────────────── */
.desktop-gate {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 1000;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background:
    radial-gradient(ellipse at 50% 30%, #1a2030 0%, transparent 60%),
    radial-gradient(ellipse at 50% 100%, #0e1118 0%, transparent 50%),
    #06080c;
}
.dg-card {
  max-width: 420px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.dg-mark {
  color: #6fe1f3;
  font-size: 28px;
  margin-bottom: 4px;
  filter: drop-shadow(0 0 16px rgba(111, 225, 243, 0.6));
}
.dg-eyebrow {
  font-size: 9px;
  letter-spacing: 0.5em;
  color: #6e747e;
  text-transform: uppercase;
}
.dg-title {
  font-size: 28px;
  font-weight: 200;
  letter-spacing: 0.05em;
  margin: 0;
  color: #e8ebf0;
  line-height: 1.2;
}
.dg-body {
  font-size: 13px;
  color: #8b929d;
  line-height: 1.6;
  margin: 0;
}
.dg-num {
  color: #c8ccd2;
  font-variant-numeric: tabular-nums;
}
.dg-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  width: 100%;
  justify-content: center;
}
.dg-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dg-stat-label {
  font-size: 9px;
  letter-spacing: 0.4em;
  color: #4a4f58;
  text-transform: uppercase;
}
.dg-stat-val {
  font-size: 13px;
  color: #c8ccd2;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.05em;
}
.dg-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.08);
}

/* engage gate, hide the experience */
@media (max-width: 1023px), (max-height: 580px) {
  .desktop-gate { display: flex; }
  .bg-grid, .bg-vignette,
  .chrome,
  :deep(.stage), :deep(.briefing), .fight-placeholder {
    display: none !important;
  }
}
</style>
