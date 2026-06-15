<script setup lang="ts">
import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useLoadout, type BoutRecord } from "~/stores/loadout";
import { BRANDS, MODELS } from "~/data/arena";
import { useFoley } from "~/composables/useFoley";

const loadout = useLoadout();
const { bouts } = storeToRefs(loadout);
const foley = useFoley();

const emit = defineEmits<{ close: [] }>();

const expandedId = ref<string | null>(null);

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
  foley.click();
}

function modelById(id: string) {
  return MODELS.find((m) => m.id === id);
}
function brandColor(modelId: string) {
  const m = modelById(modelId);
  return m ? BRANDS[m.brand].color : "#6fe1f3";
}
function ago(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
function totalScore(b: BoutRecord, side: "left" | "right") {
  let n = 0;
  for (const id in b.scores) n += b.scores[id]?.[side] ?? 0;
  return n;
}
function clearAll() {
  if (window.confirm("Clear all bout history? This can't be undone.")) {
    loadout.clearHistory();
    expandedId.value = null;
  }
}
</script>

<template>
  <div class="hist-backdrop" @click.self="emit('close')">
    <aside class="hist-drawer" role="dialog" aria-label="Bout history">
      <header class="hist-head">
        <div class="hist-title">
          <span class="hist-eyebrow">Past Bouts</span>
          <span class="hist-count">{{ bouts.length }}</span>
        </div>
        <div class="hist-actions">
          <button v-if="bouts.length" class="hist-clear" @click="clearAll">Clear</button>
          <button class="hist-close" @click="emit('close')" aria-label="close">✕</button>
        </div>
      </header>

      <div v-if="!bouts.length" class="hist-empty">
        No bouts yet. Run a fight to start collecting history.
      </div>

      <ul v-else class="hist-list">
        <li
          v-for="b in bouts"
          :key="b.id"
          class="hist-item"
          :class="{ open: expandedId === b.id }"
        >
          <button class="hist-row" @click="toggle(b.id)">
            <span class="row-time">{{ ago(b.timestamp) }}</span>
            <span class="row-fighters">
              <span class="row-fighter" :style="{ color: brandColor(b.leftModelId) }">
                {{ modelById(b.leftModelId)?.displayName ?? b.leftModelId }}
              </span>
              <span class="row-vs">vs</span>
              <span class="row-fighter" :style="{ color: brandColor(b.rightModelId) }">
                {{ modelById(b.rightModelId)?.displayName ?? b.rightModelId }}
              </span>
            </span>
            <span
              class="row-winner"
              :class="`won-${b.winner}`"
              :style="{
                '--accent': brandColor(b.winner === 'left' ? b.leftModelId : b.rightModelId),
              }"
            >
              <span class="winner-arrow">{{ b.winner === 'left' ? '◄' : '►' }}</span>
              {{ totalScore(b, b.winner) }}
            </span>
            <span class="row-judged" :class="{ live: b.judged }">
              {{ b.judged ? 'judged' : 'mock' }}
            </span>
          </button>

          <Transition name="row-open">
            <div v-if="expandedId === b.id" class="hist-detail">
              <div v-if="b.topic" class="detail-topic">"{{ b.topic }}"</div>

              <div v-if="b.reason" class="detail-reason">{{ b.reason }}</div>

              <div v-if="Object.keys(b.scores).length" class="detail-scores">
                <div
                  v-for="(s, id) in b.scores"
                  :key="id"
                  class="detail-score-row"
                >
                  <span class="score-label">{{ id }}</span>
                  <span class="score-pair">
                    <span :style="{ color: brandColor(b.leftModelId) }">{{ s.left }}</span>
                    <span class="score-sep">/</span>
                    <span :style="{ color: brandColor(b.rightModelId) }">{{ s.right }}</span>
                  </span>
                </div>
              </div>

              <div class="detail-transcript">
                <div
                  v-for="(t, i) in b.transcript"
                  :key="i"
                  class="t-bubble"
                  :class="`t-bubble--${t.side}`"
                  :style="{
                    '--accent': brandColor(t.side === 'left' ? b.leftModelId : b.rightModelId),
                  }"
                >
                  <div class="t-tag">
                    {{ modelById(t.side === 'left' ? b.leftModelId : b.rightModelId)?.displayName }}
                  </div>
                  <div class="t-text">{{ t.text }}</div>
                </div>
              </div>
            </div>
          </Transition>
        </li>
      </ul>
    </aside>
  </div>
</template>

<style scoped>
.hist-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(6, 8, 12, 0.65);
  backdrop-filter: blur(4px);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px 24px 24px;
  animation: backdropIn 220ms ease;
}
@keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }

.hist-drawer {
  width: min(720px, 100%);
  max-height: 100%;
  background: linear-gradient(180deg, #15191f 0%, #0a0c11 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  box-shadow: 0 30px 80px -10px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: drawerIn 320ms cubic-bezier(0.34, 1.4, 0.64, 1);
}
@keyframes drawerIn {
  from { opacity: 0; transform: translateY(20px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.hist-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.hist-title { display: flex; align-items: baseline; gap: 10px; }
.hist-eyebrow {
  font-size: 11px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #c8ccd2;
}
.hist-count {
  font-size: 11px;
  color: #6e747e;
  font-variant-numeric: tabular-nums;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 999px;
  padding: 2px 8px;
}
.hist-actions { display: flex; gap: 6px; }
.hist-clear, .hist-close {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #8b929d;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 120ms;
}
.hist-clear:hover { color: #ff8b8b; border-color: rgba(239, 68, 68, 0.4); }
.hist-close:hover { color: #c8ccd2; border-color: rgba(255, 255, 255, 0.2); }

.hist-empty {
  padding: 60px 20px;
  text-align: center;
  font-size: 12px;
  color: #6e747e;
  letter-spacing: 0.05em;
}

.hist-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.hist-item { border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
.hist-item:last-child { border-bottom: none; }

.hist-row {
  width: 100%;
  display: grid;
  grid-template-columns: 70px 1fr auto auto;
  gap: 14px;
  align-items: center;
  background: transparent;
  border: none;
  padding: 12px 18px;
  cursor: pointer;
  text-align: left;
  transition: background 100ms;
}
.hist-row:hover { background: rgba(255, 255, 255, 0.02); }
.hist-item.open .hist-row { background: rgba(255, 255, 255, 0.03); }

.row-time {
  font-size: 10px;
  color: #6e747e;
  letter-spacing: 0.05em;
}
.row-fighters {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  color: #c8ccd2;
  min-width: 0;
}
.row-fighter {
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-vs { font-size: 9px; color: #4a4f58; letter-spacing: 0.3em; text-transform: uppercase; }
.row-winner {
  --accent: #6fe1f3;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 8px var(--accent);
}
.winner-arrow { font-size: 9px; opacity: 0.7; }
.row-judged {
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #4a4f58;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 2px 7px;
  border-radius: 999px;
}
.row-judged.live { color: #6fe1f3; border-color: rgba(111, 225, 243, 0.3); }

.hist-detail {
  padding: 12px 18px 18px;
  background: rgba(0, 0, 0, 0.25);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.detail-topic {
  font-size: 12px;
  color: #c8ccd2;
  font-style: italic;
  border-left: 2px solid rgba(255, 255, 255, 0.15);
  padding-left: 10px;
  letter-spacing: 0.02em;
}
.detail-reason {
  font-size: 11px;
  color: #8b929d;
  font-style: italic;
}
.detail-scores {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
}
.detail-score-row {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  letter-spacing: 0.04em;
}
.score-label {
  color: #6e747e;
  text-transform: uppercase;
  letter-spacing: 0.3em;
}
.score-pair { font-variant-numeric: tabular-nums; }
.score-sep { color: rgba(255, 255, 255, 0.2); margin: 0 6px; }

.detail-transcript {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}
.t-bubble {
  --accent: #6fe1f3;
  background: rgba(255, 255, 255, 0.02);
  border-left: 2px solid var(--accent);
  border-radius: 3px;
  padding: 7px 11px;
  max-width: 92%;
}
.t-bubble--right { align-self: flex-end; border-left: none; border-right: 2px solid var(--accent); }
.t-tag {
  font-size: 9px;
  color: var(--accent);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.t-text { font-size: 11px; color: #e8ebf0; line-height: 1.55; }

.row-open-enter-active, .row-open-leave-active {
  transition: max-height 240ms ease, opacity 220ms;
  overflow: hidden;
}
.row-open-enter-from, .row-open-leave-to { max-height: 0; opacity: 0; }
.row-open-enter-to, .row-open-leave-from { max-height: 600px; opacity: 1; }
</style>
