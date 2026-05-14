<script setup lang="ts">
import { computed } from "vue";
import type { BrandKey, Tier } from "~/data/arena";
import { BRANDS } from "~/data/arena";
import BrandLogo from "./BrandLogo.vue";

const props = defineProps<{
  brand: BrandKey;
  tier: Tier;
  /** Disable mix-blend-mode (for placement on light surfaces). */
  light?: boolean;
  /** Mirror horizontally so the helmet faces the opposite direction. */
  flipped?: boolean;
}>();

const brandConfig = computed(() => BRANDS[props.brand]);

// Crop windows on the master 2816×1536 trace, expressed for use with
// CSS background-image. Windows are non-overlapping so neighboring
// helmets' content (e.g. Ultra's antenna) can't bleed into Advance's view.
// See public/traces/RECIPE.md for the math.
const TIER_CROP = {
  basic:   { ratio: "900 / 1536",  size: "313% 100%", position: "0% center"   },
  advance: { ratio: "990 / 1536",  size: "284% 100%", position: "49.3% center" },
  ultra:   { ratio: "916 / 1536",  size: "307% 100%", position: "100% center" },
} as const;

// Ear-plate position, expressed as % of the cropped tier window.
const TIER_EAR = {
  basic:   { left: "24.4%", top: "52%", width: "13.4%" },
  advance: { left: "21.4%", top: "51%", width: "12.2%" },
  ultra:   { left: "13%",   top: "52%", width: "14.2%" },
} as const;

const crop = computed(() => TIER_CROP[props.tier]);
const ear = computed(() => TIER_EAR[props.tier]);
</script>

<template>
  <div class="helmet" :style="{ aspectRatio: crop.ratio, transform: flipped ? 'scaleX(-1)' : undefined }">
    <!-- Backdrop layer: same trace, slightly enlarged, blurred & desaturated.
         Fills tiny gaps in the original trace (e.g. between antennas and
         the helmet body) so the silhouette reads as continuous. -->
    <div
      class="helmet-img helmet-img--backdrop"
      :style="{
        backgroundSize: crop.size,
        backgroundPosition: crop.position,
      }"
    />
    <div
      class="helmet-img"
      :class="{ 'helmet-img--light': light }"
      :style="{
        backgroundSize: crop.size,
        backgroundPosition: crop.position,
        filter: brandConfig.filter,
      }"
    />
    <div class="ear-plate" :style="{ left: ear.left, top: ear.top, width: ear.width }">
      <!-- Counter-flip the logo when the helmet is mirrored, so asymmetric
           marks (DeepSeek's whale, Mistral's M, etc.) read correctly. -->
      <div class="logo-counter" :class="{ 'logo-counter--flip': flipped }">
        <BrandLogo :brand="brand" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.helmet {
  position: relative;
  width: 100%;
}
.helmet-img {
  position: absolute;
  inset: 0;
  background-image: url("/traces/helmets-v3.svg");
  background-repeat: no-repeat;
}
.helmet-img--backdrop {
  /* Filter (defined once in pages/index.vue): dilate the source alpha and
     flood with solid dark gunmetal. Produces a clean dilated silhouette
     that bridges trace gaps without leaking any near-white anti-alias
     pixels from the original colored paths. */
  filter: url(#helmet-dilate);
}
.ear-plate {
  position: absolute;
  aspect-ratio: 1;
  transform: translate(-50%, -50%) perspective(100px) rotateY(-34deg);
  transform-origin: center;
  pointer-events: none;
}
.logo-counter {
  width: 100%;
  height: 100%;
}
.logo-counter--flip {
  /* counter-flip so asymmetric brand marks read right when the helmet is mirrored */
  transform: scaleX(-1);
}
</style>
