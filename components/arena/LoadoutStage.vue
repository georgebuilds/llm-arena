<script setup lang="ts">
import { ref } from "vue";
import { storeToRefs } from "pinia";
import { MASKS, MODELS } from "~/data/arena";
import { useLoadout } from "~/stores/loadout";
import { useFoley } from "~/composables/useFoley";
import WheelStack from "./WheelStack.vue";
import HistoryDrawer from "./HistoryDrawer.vue";

const loadout = useLoadout();
// init() (random model picks + history hydrate) runs in pages/index.vue's
// onMounted — client-only, after hydration — so SSR doesn't see Math.random
// and we don't get a hydration mismatch. WheelStack watches modelIdx/maskIdx
// for external changes and snaps to the new index when init lands.
const { leftModelIdx, leftMaskIdx, rightModelIdx, rightMaskIdx, bouts } = storeToRefs(loadout);
const foley = useFoley();
const historyOpen = ref(false);

const emit = defineEmits<{ advance: [] }>();

function lockIn() {
  foley.clunk();
  emit("advance");
}
</script>

<template>
  <main class="stage">
    <div class="slot slot--left">
      <WheelStack
        side="left"
        :models="MODELS"
        :masks="MASKS"
        v-model:modelIdx="leftModelIdx"
        v-model:maskIdx="leftMaskIdx"
      />
      <div class="fighter-tag fighter-tag--left">HOME</div>
    </div>

    <div class="center-column">
      <div class="vs-mark">VS</div>
      <div class="ready-block">
        <button class="ready-btn" @click="lockIn">
          <span class="ready-label">READY</span>
          <span class="ready-arrow">→</span>
        </button>
        <div class="ready-hint">All set? Lock the loadout.</div>
        <button
          v-if="bouts.length"
          class="history-link"
          @click="historyOpen = true"
        >
          ↻ Past bouts ({{ bouts.length }})
        </button>
      </div>
    </div>

    <div class="slot slot--right">
      <WheelStack
        side="right"
        :models="MODELS"
        :masks="MASKS"
        v-model:modelIdx="rightModelIdx"
        v-model:maskIdx="rightMaskIdx"
      />
      <div class="fighter-tag fighter-tag--right">CHALLENGER</div>
    </div>

    <Transition name="hist">
      <HistoryDrawer v-if="historyOpen" @close="historyOpen = false" />
    </Transition>
  </main>
</template>

<style scoped>
.stage {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
}
.slot {
  position: relative;
  height: 100%;
  overflow: hidden;
}
.fighter-tag {
  position: absolute;
  bottom: 24px;
  font-size: 10px;
  letter-spacing: 0.5em;
  color: #6e747e;
  z-index: 5;
}
.fighter-tag--left { left: 32px; }
.fighter-tag--right { right: 32px; }

.center-column {
  position: relative;
  padding: 0 28px;
  z-index: 15;
  min-width: 120px;
}
.vs-mark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 40px;
  font-weight: 200;
  letter-spacing: 0.2em;
  color: rgba(232, 235, 240, 0.4);
  font-family: 'Inter', sans-serif;
  white-space: nowrap;
}
.ready-block {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}
.ready-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(180deg, #1a2030 0%, #0e1118 100%);
  color: #e8ebf0;
  border: 1px solid rgba(111, 225, 243, 0.35);
  padding: 16px 28px;
  border-radius: 4px;
  font-size: 13px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms;
  box-shadow: 0 0 24px rgba(111, 225, 243, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.ready-btn:hover {
  border-color: #6fe1f3;
  box-shadow: 0 0 36px rgba(111, 225, 243, 0.25);
  transform: translateY(-1px);
}
.ready-arrow { font-size: 16px; }
.ready-hint {
  font-size: 10px;
  color: #6e747e;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.history-link {
  margin-top: 14px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #6e747e;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 120ms;
}
.history-link:hover { color: #c8ccd2; border-color: rgba(255, 255, 255, 0.18); }
</style>
