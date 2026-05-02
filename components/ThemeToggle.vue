<script setup lang="ts">
import { useTheme } from "~/composables/useTheme";

const { preference, cycle } = useTheme();

const label = computed(() => {
  if (preference.value === "system") return "System";
  if (preference.value === "dark") return "Dark";
  return "Light";
});

const icon = computed(() => {
  if (preference.value === "system") return "system";
  if (preference.value === "dark") return "moon";
  return "sun";
});
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-2/70 px-3 py-1.5 text-xs text-secondary transition-colors duration-200 ease-spring hover:bg-surface-2 hover:text-primary"
    :title="`Theme: ${label}`"
    :aria-label="`Theme: ${label}. Click to cycle`"
    @click="cycle"
  >
    <svg
      v-if="icon === 'sun'"
      class="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
    <svg
      v-else-if="icon === 'moon'"
      class="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
    <svg
      v-else
      class="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M8 20h8M12 18v2" />
    </svg>
    <span>{{ label }}</span>
  </button>
</template>
