<script setup lang="ts">
import type { BrandKey } from "~/data/arena";

defineProps<{ brand: BrandKey }>();
</script>

<template>
  <svg viewBox="-20 -20 40 40" overflow="visible" class="brand-logo">
    <!-- Simple geometric stand-in marks for ear-plate identification.
         Not facsimiles of brand artwork. -->
    <g v-if="brand === 'openai'" stroke="#ffffff" stroke-width="2.6" fill="none" stroke-linecap="round">
      <ellipse rx="15" ry="6" />
      <ellipse rx="15" ry="6" transform="rotate(60)" />
      <ellipse rx="15" ry="6" transform="rotate(120)" />
    </g>

    <g v-else-if="brand === 'xai'" stroke="#ffffff" stroke-width="4" stroke-linecap="square">
      <line x1="-11" y1="-12" x2="11" y2="12" />
      <line x1="11" y1="-12" x2="-11" y2="12" />
    </g>

    <g v-else-if="brand === 'anthropic'" fill="#ffffff" stroke="none">
      <path
        d="M -2,-16 L 2,-16 L 4,-3 L 16,-8 L 17,-3 L 5,2 L 13,12 L 9,15 L 1,5 L -2,17 L -7,15 L -4,3 L -16,8 L -17,3 L -5,-2 L -13,-12 L -9,-15 L -2,-5 Z"
      />
    </g>

    <g v-else-if="brand === 'meta'" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M -16,3 C -16,-9 -6,-12 0,-3 C 4,3 8,9 12,9 C 17,9 17,3 14,-3 C 11,-9 5,-9 0,-3 C -5,4 -11,11 -15,8 Z" />
    </g>

    <g v-else-if="brand === 'deepseek'" fill="#ffffff" stroke="none">
      <path d="M -16,-2 C -13,-10 -5,-12 2,-9 C 9,-6 14,-1 17,4 C 14,3 11,2 8,3 C 5,7 1,9 -3,8 C -9,7 -15,4 -16,0 Z" />
      <circle cx="-8" cy="-4" r="1.6" fill="#0e1116" />
    </g>

    <g v-else-if="brand === 'gemini'">
      <defs>
        <linearGradient id="brandLogoGem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stop-color="#4796ff" />
          <stop offset="55%" stop-color="#bd6cd0" />
          <stop offset="100%" stop-color="#ff7a8e" />
        </linearGradient>
      </defs>
      <path
        d="M 0,-17 C 2,-6 6,-2 17,0 C 6,2 2,6 0,17 C -2,6 -6,2 -17,0 C -6,-2 -2,-6 0,-17 Z"
        fill="url(#brandLogoGem)"
      />
    </g>

    <g v-else-if="brand === 'mistral'" stroke="none">
      <rect x="-15" y="-12" width="30" height="6" fill="#ffd400" />
      <rect x="-15" y="-6"  width="30" height="6" fill="#ff8800" />
      <rect x="-15" y="0"   width="30" height="6" fill="#ff5d00" />
      <rect x="-15" y="6"   width="30" height="6" fill="#e02b00" />
      <rect x="-9"  y="-6"  width="6"  height="18" fill="#0e1116" />
      <rect x="3"   y="-6"  width="6"  height="18" fill="#0e1116" />
    </g>
  </svg>
</template>

<style scoped>
.brand-logo {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
