<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useFoley } from "~/composables/useFoley";

const props = withDefaults(defineProps<{
  label: string;
  holdLabel?: string;
  duration?: number;
  /** Two-color gradient that fills as the user holds. */
  fillFrom?: string;
  fillTo?: string;
  /** When true the button locks in its filled state. */
  committed?: boolean;
}>(), {
  duration: 1200,
  holdLabel: "HOLD…",
  fillFrom: "#6fe1f3",
  fillTo: "#6fe1f3",
  committed: false,
});

const emit = defineEmits<{
  commit: [];
}>();

const foley = useFoley();
const progress = ref(0);          // 0..1
const holding = ref(false);
let raf = 0;
let startTime = 0;
let lastTickAt = 0;

function start() {
  if (props.committed) return;
  holding.value = true;
  startTime = performance.now();
  lastTickAt = startTime;
  loop();
}

function loop() {
  const now = performance.now();
  const t = Math.min(1, (now - startTime) / props.duration);
  progress.value = t;
  // tick every ~120ms for tactile feedback
  if (now - lastTickAt > 110) {
    foley.tick();
    lastTickAt = now;
  }
  if (t >= 1) {
    holding.value = false;
    foley.ignite();
    emit("commit");
    progress.value = 1;
    return;
  }
  raf = requestAnimationFrame(loop);
}

function cancel() {
  if (props.committed) return;
  cancelAnimationFrame(raf);
  if (holding.value) {
    holding.value = false;
    progress.value = 0;
  }
}

onBeforeUnmount(() => cancelAnimationFrame(raf));

const fillStyle = computed(() => ({
  width: `${progress.value * 100}%`,
  background: `linear-gradient(90deg, ${props.fillFrom} 0%, ${props.fillTo} 100%)`,
}));

const labelText = computed(() => {
  if (props.committed) return props.label;
  return holding.value ? props.holdLabel : props.label;
});
</script>

<template>
  <button
    class="hold-btn"
    :class="{ holding, committed }"
    @pointerdown="start"
    @pointerup="cancel"
    @pointerleave="cancel"
    @pointercancel="cancel"
    :aria-pressed="committed"
  >
    <div class="hold-fill" :style="fillStyle" aria-hidden="true" />
    <span class="hold-label">{{ labelText }}</span>
    <span class="hold-arrow">→</span>
  </button>
</template>

<style scoped>
.hold-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 18px 32px;
  background: linear-gradient(180deg, #131820 0%, #0a0d12 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: #e8ebf0;
  font-size: 13px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  transition: border-color 200ms, transform 100ms;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
.hold-btn:hover { border-color: rgba(255, 255, 255, 0.2); }
.hold-btn.holding {
  border-color: rgba(255, 255, 255, 0.35);
  transform: scale(0.985);
}
.hold-btn.committed {
  border-color: transparent;
  cursor: default;
}
.hold-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 0;
  opacity: 0.85;
  pointer-events: none;
  z-index: 0;
  transition: opacity 240ms;
}
.hold-btn.committed .hold-fill { opacity: 1; }
.hold-label, .hold-arrow {
  position: relative;
  z-index: 1;
  mix-blend-mode: difference;
  color: #ffffff;
}
.hold-arrow { font-size: 16px; }
</style>
