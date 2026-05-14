<script setup lang="ts">
import { computed } from "vue";
import type { Mask, Model } from "~/data/arena";
import { BRANDS } from "~/data/arena";
import Helmet from "./Helmet.vue";

const props = defineProps<{
  model: Model;
  mask: Mask;
  side: "left" | "right";
  label: string;
}>();

const brand = computed(() => BRANDS[props.model.brand]);
</script>

<template>
  <div class="bust" :class="`bust--${side}`">
    <div class="bust-meta">
      <div class="bust-label">{{ label }}</div>
      <div class="bust-name">{{ model.displayName }}</div>
      <div class="bust-mask">
        <span class="mask-pill" :style="{ borderColor: mask.color }">
          <span class="mask-dot" :style="{ background: mask.color }" />
          {{ mask.name }}
        </span>
      </div>
      <div class="bust-blurb">{{ mask.description }}</div>
    </div>
    <div class="bust-helmet">
      <Helmet :brand="model.brand" :tier="model.tier" :flipped="side === 'right'" />
    </div>
  </div>
</template>

<style scoped>
.bust {
  display: flex;
  align-items: center;
  gap: 18px;
}
.bust--right { flex-direction: row-reverse; text-align: right; }
.bust-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.bust-label {
  font-size: 9px;
  letter-spacing: 0.5em;
  color: #6e747e;
  text-transform: uppercase;
}
.bust-name {
  font-size: 18px;
  font-weight: 500;
  color: #e8ebf0;
  letter-spacing: 0.04em;
}
.bust-mask { margin-top: 4px; }
.mask-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #c8ccd2;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.02);
}
.mask-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.bust-blurb {
  font-size: 11px;
  color: #8b929d;
  letter-spacing: 0.02em;
  margin-top: 6px;
  max-width: 240px;
}
.bust--right .bust-blurb { margin-left: auto; }
.bust-helmet {
  width: 104px;
  flex-shrink: 0;
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.5));
}
</style>
