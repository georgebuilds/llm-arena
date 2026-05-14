// Wheel rotation with drag, inertia, snap-to-node, and per-node-crossing
// callbacks (for revolver-click foley). Geometry is angle-based; the
// component decides how to project (cos/sin) onto pixel positions.

import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";

export interface ArenaWheelOptions {
  itemCount: Ref<number>;
  /** Selection axis in radians. 0 = +x (right), π = -x (left). */
  selectionAxis: number;
  /** Spin direction multiplier (+1 normal, -1 mirrored for the right side). */
  spinDirection?: 1 | -1;
  /** Callback fired each time the wheel crosses a node boundary. */
  onCross?: () => void;
  /** Callback fired once when a snap settles on a new index. */
  onSnap?: (idx: number) => void;
  initialIdx?: number;
}

export function useArenaWheel(opts: ArenaWheelOptions) {
  const dir = opts.spinDirection ?? 1;
  const initialIdx = opts.initialIdx ?? 0;
  const dragging = ref(false);
  const selectedIdx = ref(initialIdx);

  const spacing = computed(() => (2 * Math.PI) / Math.max(1, opts.itemCount.value));

  // initial rotation places `initialIdx` at the selection axis
  const rotation = ref(-initialIdx * spacing.value);

  // — drag bookkeeping —
  let lastAngle = 0;
  let lastTime = 0;
  let velocity = 0;
  let lastCrossedIdx = initialIdx;
  let centerX = 0;
  let centerY = 0;
  let raf = 0;

  function angleFromCenter(clientX: number, clientY: number) {
    return Math.atan2(clientY - centerY, clientX - centerX);
  }

  function onCrossCheck() {
    const newIdx = Math.round(-rotation.value / spacing.value);
    if (newIdx !== lastCrossedIdx) {
      lastCrossedIdx = newIdx;
      opts.onCross?.();
    }
  }

  function startDrag(clientX: number, clientY: number, cx: number, cy: number) {
    cancelAnimationFrame(raf);
    dragging.value = true;
    centerX = cx;
    centerY = cy;
    lastAngle = angleFromCenter(clientX, clientY);
    lastTime = performance.now();
    velocity = 0;
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragging.value) return;
    const a = angleFromCenter(clientX, clientY);
    let delta = a - lastAngle;
    // wrap to [-π, π]
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    rotation.value += delta * dir;
    onCrossCheck();
    const now = performance.now();
    const dt = Math.max(1, now - lastTime) / 1000;
    velocity = (delta * dir) / dt;
    lastAngle = a;
    lastTime = now;
  }

  function endDrag() {
    if (!dragging.value) return;
    dragging.value = false;
    // inertia decay then snap
    let v = velocity;
    let last = performance.now();
    const decay = 4.5; // higher = stops sooner
    function tick() {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      rotation.value += v * dt;
      onCrossCheck();
      v *= Math.exp(-decay * dt);
      if (Math.abs(v) > 0.4) {
        raf = requestAnimationFrame(tick);
      } else {
        snapToNearest();
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function snapToNearest() {
    const idx = Math.round(-rotation.value / spacing.value);
    snapToIdx(idx);
  }

  function snapToIdx(rawIdx: number) {
    cancelAnimationFrame(raf);
    const target = -rawIdx * spacing.value;
    const start = rotation.value;
    const startTime = performance.now();
    const dur = 320;
    function tick() {
      const t = Math.min(1, (performance.now() - startTime) / dur);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      rotation.value = start + (target - start) * eased;
      onCrossCheck();
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        rotation.value = target;
        const wrapped = ((rawIdx % opts.itemCount.value) + opts.itemCount.value) % opts.itemCount.value;
        if (wrapped !== selectedIdx.value) {
          selectedIdx.value = wrapped;
          opts.onSnap?.(wrapped);
        }
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function step(direction: 1 | -1) {
    const cur = Math.round(-rotation.value / spacing.value);
    snapToIdx(cur + direction);
  }

  // keep selectedIdx in sync if rotation changes via drag (after snap settles)
  watch(rotation, () => {
    const idx = Math.round(-rotation.value / spacing.value);
    const wrapped = ((idx % opts.itemCount.value) + opts.itemCount.value) % opts.itemCount.value;
    selectedIdx.value = wrapped;
  });

  onBeforeUnmount(() => cancelAnimationFrame(raf));

  return {
    rotation,
    dragging,
    selectedIdx,
    spacing,
    startDrag,
    moveDrag,
    endDrag,
    step,
    snapToIdx,
  };
}
