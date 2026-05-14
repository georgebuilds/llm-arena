<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { MODES } from "~/data/modes";
import { JUDGING_CRITERIA, MODELS } from "~/data/arena";
import { useLoadout } from "~/stores/loadout";
import { useFoley } from "~/composables/useFoley";
import CombatantBust from "./CombatantBust.vue";
import HoldButton from "./HoldButton.vue";

const loadout = useLoadout();
const {
  leftModel, leftMask, rightModel, rightMask,
  leftBrand, rightBrand,
  rounds, mode, topic, judging, judgeModelId,
} = storeToRefs(loadout);

const foley = useFoley();
const emit = defineEmits<{ back: []; ignite: [] }>();

onMounted(() => {
  // pneumatic hiss + interface boot beep on terminal arrival
  foley.hiss(0.5);
  setTimeout(() => foley.boot(), 220);
});

// Brief, evocative seed prompts. Picked to span register: philosophical,
// policy, aesthetic, scientific. Click to drop into the topic field.
const TOPIC_SUGGESTIONS = [
  "Is consciousness substrate-independent?",
  "Should AI development be paused for one year?",
  "Does art require an audience to exist?",
  "Is privacy compatible with modern social media?",
  "Should we colonize Mars before fixing Earth?",
];

function useTopic(s: string) {
  topic.value = s;
  foley.click();
}

function bumpRounds(delta: number) {
  const next = Math.max(1, Math.min(12, rounds.value + delta));
  if (next !== rounds.value) {
    rounds.value = next;
    foley.click();
  }
}

function selectMode(id: string) {
  if (mode.value === id) return;
  mode.value = id;
  foley.boot();
}

function toggleCriterion(id: string) {
  const list = judging.value;
  const i = list.indexOf(id);
  if (i === -1) list.push(id);
  else list.splice(i, 1);
  foley.tick();
}

function goBack() {
  foley.hiss(0.35);
  emit("back");
}

function commit() {
  emit("ignite");
}
</script>

<template>
  <main class="briefing">
    <div class="briefing-scroll">
    <!-- Combatants header -->
    <header class="combatants">
      <CombatantBust :model="leftModel" :mask="leftMask" side="left" label="HOME" />
      <div class="vs-line">
        <span class="vs-bar" />
        <span class="vs-text">VS</span>
        <span class="vs-bar" />
      </div>
      <CombatantBust :model="rightModel" :mask="rightMask" side="right" label="CHALLENGER" />
    </header>

    <!-- Configuration grid -->
    <div class="config-grid">
      <!-- Rounds -->
      <section class="card card--rounds">
        <div class="card-label">Rounds</div>
        <div class="rounds-row">
          <button class="round-btn" @click="bumpRounds(-1)" aria-label="Decrease rounds">−</button>
          <div class="round-value">
            <span class="round-num">{{ rounds.toString().padStart(2, '0') }}</span>
            <span class="round-suffix">turns</span>
          </div>
          <button class="round-btn" @click="bumpRounds(1)" aria-label="Increase rounds">+</button>
        </div>
        <div class="card-hint">Each combatant takes {{ rounds }} turn{{ rounds === 1 ? '' : 's' }}.</div>
      </section>

      <!-- Mode -->
      <section class="card card--mode">
        <div class="card-label">Bout Type</div>
        <div class="chip-grid">
          <button
            v-for="m in MODES"
            :key="m.id"
            class="chip"
            :class="{ active: mode === m.id }"
            @click="selectMode(m.id)"
          >
            {{ m.name }}
          </button>
        </div>
        <div class="card-hint">{{ MODES.find(m => m.id === mode)?.blurb }}</div>
      </section>

      <!-- Topic -->
      <section class="card card--topic">
        <div class="card-label">Seed</div>
        <textarea
          v-model="topic"
          class="topic-input"
          placeholder="Drop the topic, prompt, or motion both fighters will work from…"
          rows="3"
        />
        <div class="topic-suggestions">
          <span class="suggest-label">try:</span>
          <button
            v-for="s in TOPIC_SUGGESTIONS"
            :key="s"
            class="suggest-chip"
            @click="useTopic(s)"
          >
            {{ s }}
          </button>
        </div>
        <div class="card-hint">{{ topic.length }} chars · use freely</div>
      </section>

      <!-- Judging -->
      <section class="card card--judging">
        <div class="judge-row">
          <div class="card-label card-label--inline">Judging Lens</div>
          <div class="judge-pick">
            <span class="judge-pick-label">Judge:</span>
            <select v-model="judgeModelId" class="judge-select">
              <option v-for="m in MODELS" :key="m.id" :value="m.id">
                {{ m.displayName }}
              </option>
            </select>
          </div>
        </div>
        <div class="chip-grid chip-grid--small">
          <button
            v-for="c in JUDGING_CRITERIA"
            :key="c.id"
            class="chip chip--small"
            :class="{ active: judging.includes(c.id) }"
            @click="toggleCriterion(c.id)"
          >
            {{ c.label }}
          </button>
        </div>
        <div class="card-hint">Pick the qualities the verdict should weigh.</div>
      </section>
    </div>
    </div>

    <!-- Action row — sticks to the bottom outside the scroll area -->
    <footer class="action-row">
      <button class="back-btn" @click="goBack">
        <span>←</span> Back
      </button>
      <HoldButton
        label="IGNITE"
        hold-label="HOLDING…"
        :duration="1200"
        :fill-from="leftBrand.color"
        :fill-to="rightBrand.color"
        @commit="commit"
      />
      <div class="action-hint">Hold to ignite the bout.</div>
    </footer>
  </main>
</template>

<style scoped>
.briefing {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 0 7vw;
  overflow: hidden;
}
.briefing-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* extra top padding clears the floating notch */
  padding: 64px 0 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* combatants header */
.combatants {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 28px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.vs-line {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(232, 235, 240, 0.4);
}
.vs-bar {
  width: 36px;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
}
.vs-text {
  font-size: 16px;
  letter-spacing: 0.3em;
  font-weight: 200;
}

/* config grid */
.config-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  grid-template-rows: auto auto;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
.card--rounds  { grid-column: 1; grid-row: 1; }
.card--mode    { grid-column: 2; grid-row: 1; }
.card--topic   { grid-column: 1 / -1; grid-row: 2; }
.card--judging { grid-column: 1 / -1; grid-row: 3; }

.card {
  background: linear-gradient(180deg, rgba(20, 25, 33, 0.7) 0%, rgba(11, 14, 19, 0.7) 100%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 12px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card-label {
  font-size: 9px;
  letter-spacing: 0.5em;
  color: #6e747e;
  text-transform: uppercase;
}
.card-hint {
  font-size: 11px;
  color: #6b7079;
  margin-top: auto;
  font-style: italic;
}

/* rounds */
.rounds-row {
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: center;
}
.round-btn {
  background: #131820;
  color: #c8ccd2;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 38px;
  height: 38px;
  border-radius: 4px;
  font-size: 18px;
  cursor: pointer;
  transition: background 100ms;
}
.round-btn:hover { background: #1f2530; }
.round-btn:active { background: #2a3140; }
.round-value {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 90px;
}
.round-num {
  font-size: 30px;
  font-weight: 300;
  color: #e8ebf0;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  line-height: 1;
}
.round-suffix {
  font-size: 9px;
  letter-spacing: 0.4em;
  color: #6e747e;
  text-transform: uppercase;
  margin-top: 4px;
}

/* chips */
.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #c8ccd2;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 120ms;
}
.chip:hover {
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.04);
}
.chip.active {
  background: rgba(111, 225, 243, 0.12);
  border-color: #6fe1f3;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(111, 225, 243, 0.2);
}
.chip--small { padding: 5px 11px; font-size: 10px; }

.judge-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.card-label--inline { margin: 0; }
.judge-pick {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.judge-pick-label {
  font-size: 9px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #6e747e;
}
.judge-select {
  background: #0a0d12;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #c8ccd2;
  padding: 4px 24px 4px 9px;
  border-radius: 4px;
  font-size: 11px;
  letter-spacing: 0.02em;
  cursor: pointer;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, #6e747e 50%),
                    linear-gradient(135deg, #6e747e 50%, transparent 50%);
  background-position: calc(100% - 12px) 50%, calc(100% - 7px) 50%;
  background-size: 5px 5px;
  background-repeat: no-repeat;
  transition: border-color 120ms;
}
.judge-select:hover, .judge-select:focus {
  border-color: rgba(111, 225, 243, 0.4);
  outline: none;
}

/* topic textarea */
.topic-input {
  background: #0a0d12;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: #e8ebf0;
  padding: 10px 14px;
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
  min-height: 60px;
  transition: border-color 120ms;
}
.topic-input:focus {
  outline: none;
  border-color: #6fe1f3;
  box-shadow: 0 0 0 3px rgba(111, 225, 243, 0.1);
}
.topic-input::placeholder { color: #4a4f58; }

.topic-suggestions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}
.suggest-label {
  font-size: 9px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #4a4f58;
  margin-right: 4px;
}
.suggest-chip {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.07);
  color: #8b929d;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 100ms;
}
.suggest-chip:hover {
  background: rgba(111, 225, 243, 0.08);
  border-color: rgba(111, 225, 243, 0.35);
  color: #c8ccd2;
}

/* action row — pinned to bottom, outside the scrollable form */
.action-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 12px 0 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  background: linear-gradient(180deg, rgba(6, 8, 12, 0.4), rgba(6, 8, 12, 0.95));
  backdrop-filter: blur(8px);
}
.back-btn {
  background: transparent;
  color: #8b929d;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 14px 20px;
  border-radius: 4px;
  font-size: 11px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 120ms;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.back-btn:hover { background: rgba(255, 255, 255, 0.04); color: #c8ccd2; }
.action-hint {
  font-size: 10px;
  color: #6e747e;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
</style>
