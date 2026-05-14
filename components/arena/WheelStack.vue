<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Mask, Model } from "~/data/arena";
import { useFoley } from "~/composables/useFoley";
import { useArenaWheel } from "~/composables/useArenaWheel";
import Helmet from "./Helmet.vue";

const props = defineProps<{
  side: "left" | "right";
  models: Model[];
  masks: Mask[];
}>();

const modelIdx = defineModel<number>("modelIdx", { default: 0 });
const maskIdx = defineModel<number>("maskIdx", { default: 0 });

const foley = useFoley();

// — geometry (SVG units) —
const VIEW_W = 900;
const VIEW_H = 1100;
const INNER_R = 520;   // model ring (helmets)
const OUTER_R = 700;   // mask ring — pushed back outward; some clipping at slot edge is OK
                       // in exchange for breathing room between masks and helmets
const NODE_INNER = 130;
const NODE_OUTER = 108;

const dir = computed<1 | -1>(() => (props.side === "left" ? 1 : -1));
const cx = computed(() => (props.side === "left" ? 0 : VIEW_W));
const cy = VIEW_H / 2;
const selAxis = computed(() => (props.side === "left" ? 0 : Math.PI));

const modelCount = computed(() => props.models.length);
const maskCount = computed(() => props.masks.length);

const modelWheel = useArenaWheel({
  itemCount: modelCount,
  selectionAxis: selAxis.value,
  spinDirection: dir.value,
  initialIdx: modelIdx.value,
  onCross: () => foley.click(),
  onSnap: (i) => { modelIdx.value = i; foley.snap(); },
});

const maskWheel = useArenaWheel({
  itemCount: maskCount,
  selectionAxis: selAxis.value,
  spinDirection: dir.value,
  initialIdx: maskIdx.value,
  onCross: () => foley.click(),
  onSnap: (i) => { maskIdx.value = i; foley.snap(); },
});

// Sync wheel rotation when modelIdx/maskIdx change externally — e.g., when
// loadout.init() runs in onMounted (post-hydration) and randomizes defaults
// after the wheels have already mounted with initialIdx=0.
watch(modelIdx, (n) => {
  if (n !== modelWheel.selectedIdx.value) modelWheel.snapToIdx(n);
});
watch(maskIdx, (n) => {
  if (n !== maskWheel.selectedIdx.value) maskWheel.snapToIdx(n);
});

const svgRef = ref<SVGSVGElement | null>(null);

function getCenterPx() {
  if (!svgRef.value) return { x: 0, y: 0 };
  const rect = svgRef.value.getBoundingClientRect();
  // map SVG (cx, cy) to client px
  // SVG width maps to rect.width, SVG height maps to rect.height
  const sx = rect.width / VIEW_W;
  const sy = rect.height / VIEW_H;
  return { x: rect.left + cx.value * sx, y: rect.top + cy * sy };
}

type WheelHandle = ReturnType<typeof useArenaWheel>;
let active: WheelHandle | null = null;

function onPointerDown(which: "inner" | "outer", e: PointerEvent) {
  const w = which === "inner" ? modelWheel : maskWheel;
  active = w;
  const c = getCenterPx();
  w.startDrag(e.clientX, e.clientY, c.x, c.y);
  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  active?.moveDrag(e.clientX, e.clientY);
}

function onPointerUp() {
  active?.endDrag();
  active = null;
}

function nodePos(i: number, n: number, r: number, rotation: number) {
  const a = selAxis.value + (i / n) * 2 * Math.PI * dir.value + rotation * dir.value;
  return {
    x: cx.value + r * Math.cos(a),
    y: cy + r * Math.sin(a),
    angle: a,
  };
}

const selectedModel = computed(() => props.models[modelWheel.selectedIdx.value]);
const selectedMask = computed(() => props.masks[maskWheel.selectedIdx.value]);
</script>

<template>
  <div class="wheel-stack" :class="`wheel-stack--${side}`">
    <svg
      ref="svgRef"
      class="wheel-svg"
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      :preserveAspectRatio="side === 'left' ? 'xMinYMid slice' : 'xMaxYMid slice'"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <!-- faint ring guides -->
      <circle :cx="cx" :cy="cy" :r="INNER_R" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
      <circle :cx="cx" :cy="cy" :r="OUTER_R" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" />

      <!-- selection axis indicator -->
      <line
        :x1="cx + (INNER_R - 80) * Math.cos(selAxis)" :y1="cy + (INNER_R - 80) * Math.sin(selAxis)"
        :x2="cx + (OUTER_R + 80) * Math.cos(selAxis)" :y2="cy + (OUTER_R + 80) * Math.sin(selAxis)"
        stroke="rgba(111,225,243,0.25)" stroke-width="2" stroke-dasharray="6 8"
      />

      <!-- outer ring drag area (transparent stroke acts as ring hit zone) -->
      <circle
        :cx="cx" :cy="cy" :r="OUTER_R"
        fill="none" stroke="transparent" stroke-width="80"
        pointer-events="all"
        style="cursor: grab; touch-action: none;"
        @pointerdown="onPointerDown('outer', $event)"
      />

      <!-- outer ring nodes (masks) -->
      <!-- Outer g handles position (SVG transform attr); inner g handles
           scale (CSS transform). They live on different elements so the
           CSS transform doesn't clobber the position. -->
      <g
        v-for="(mask, i) in masks" :key="`mask-${mask.id}`"
        pointer-events="none"
        :transform="`translate(${nodePos(i, masks.length, OUTER_R, maskWheel.rotation.value).x}, ${nodePos(i, masks.length, OUTER_R, maskWheel.rotation.value).y})`"
      >
        <g
          :class="['mask-node', { active: i === maskWheel.selectedIdx.value }]"
          :style="{ '--mask-color': mask.color }"
        >
          <circle :r="NODE_OUTER / 2" />
          <text text-anchor="middle" dominant-baseline="central">
            {{ mask.name.toUpperCase() }}
          </text>
        </g>
      </g>

      <!-- inner ring drag area -->
      <circle
        :cx="cx" :cy="cy" :r="INNER_R"
        fill="none" stroke="transparent" stroke-width="120"
        pointer-events="all"
        style="cursor: grab; touch-action: none;"
        @pointerdown="onPointerDown('inner', $event)"
      />

      <!-- inner ring nodes (model helmets) -->
      <foreignObject
        v-for="(model, i) in models" :key="`model-${model.id}`"
        :x="nodePos(i, models.length, INNER_R, modelWheel.rotation.value).x - NODE_INNER / 2"
        :y="nodePos(i, models.length, INNER_R, modelWheel.rotation.value).y - NODE_INNER / 2"
        :width="NODE_INNER" :height="NODE_INNER"
        overflow="visible"
        style="pointer-events: none; overflow: visible;"
      >
        <div class="helmet-node" :class="{ active: i === modelWheel.selectedIdx.value }">
          <Helmet :brand="model.brand" :tier="model.tier" light :flipped="side === 'right'" />
        </div>
      </foreignObject>
    </svg>

    <!-- chevron controls -->
    <div class="controls" :class="`controls--${side}`">
      <div class="ctl-block">
        <div class="ctl-title">Model</div>
        <div class="ctl-name">{{ selectedModel?.displayName ?? "—" }}</div>
        <div class="ctl-row">
          <button class="ctl" @click="modelWheel.step(-1)" aria-label="Previous model">▲</button>
          <button class="ctl" @click="modelWheel.step(1)" aria-label="Next model">▼</button>
        </div>
      </div>
      <div class="ctl-block">
        <div class="ctl-title">Mask</div>
        <div class="ctl-name">{{ selectedMask?.name ?? "—" }}</div>
        <div class="ctl-row">
          <button class="ctl" @click="maskWheel.step(-1)" aria-label="Previous mask">▲</button>
          <button class="ctl" @click="maskWheel.step(1)" aria-label="Next mask">▼</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wheel-stack {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.wheel-svg {
  width: 100%;
  height: 100%;
  display: block;
  user-select: none;
  -webkit-user-select: none;
}

.mask-node {
  transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
  transform-box: fill-box;
  transform-origin: center;
}
.mask-node.active { transform: scale(1.2); }
.mask-node circle {
  fill: #131820;
  stroke: var(--mask-color, #6fe1f3);
  stroke-opacity: 0.4;
  stroke-width: 1.5;
  transition: fill 200ms, stroke-opacity 200ms, stroke-width 200ms;
}
.mask-node text {
  fill: #c8ccd2;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  letter-spacing: 0.16em;
  font-weight: 500;
  transition: fill 200ms;
}
.mask-node.active circle {
  fill: color-mix(in srgb, var(--mask-color, #6fe1f3) 18%, #131820);
  stroke-opacity: 1;
  stroke-width: 2;
}
.mask-node.active text { fill: #ffffff; }

.helmet-node {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 240ms cubic-bezier(0.34, 1.4, 0.64, 1);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
  transform-origin: center;
}
.helmet-node.active { transform: scale(1.2); }

/* Both control blocks group at the slot's outer corner — far from the
   center GO button, close to each other. Model is the outermost block,
   Mask sits between Model and the wheel. Right wheel mirrors the order. */
.controls {
  position: absolute;
  bottom: 32px;
  display: flex;
  align-items: end;
  gap: 14px;
  pointer-events: none;
  z-index: 10;
}
.controls--left  { left: 4%; }
.controls--right { right: 4%; flex-direction: row-reverse; }
.ctl-block { pointer-events: auto; }

.ctl-block {
  background: rgba(13, 17, 24, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 14px;
  min-width: 168px;
}
.ctl-title {
  font-size: 9px;
  letter-spacing: 0.4em;
  color: #6e747e;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.ctl-name {
  font-size: 13px;
  color: #e8ebf0;
  font-weight: 500;
  margin-bottom: 8px;
  font-variant-numeric: tabular-nums;
}
.ctl-row {
  display: flex;
  gap: 6px;
}
.ctl {
  flex: 1;
  background: #1a1f29;
  color: #c8ccd2;
  border: 1px solid rgba(255, 255, 255, 0.1);
  height: 32px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: background 120ms, transform 80ms;
}
.ctl:hover { background: #242b37; }
.ctl:active {
  background: #2e3543;
  transform: translateY(1px);
}
</style>
