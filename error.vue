<script setup lang="ts">
defineProps<{ error: { statusCode: number; message: string } }>();

function home() {
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}
</script>

<template>
  <div class="hearth-shell flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
    <p class="font-display text-5xl text-primary">{{ error.statusCode }}</p>
    <p class="max-w-prose text-secondary">{{ error.message }}</p>
    <button
      type="button"
      class="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-text"
      @click="home"
    >
      Back to the arena
    </button>
  </div>
</template>
