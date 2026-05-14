<script setup lang="ts">
defineProps<{ error: { statusCode: number; message: string } }>();

function home() {
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}
</script>

<template>
  <div class="err">
    <div class="err-mark" aria-hidden="true">◆</div>
    <p class="err-code">{{ error.statusCode }}</p>
    <p class="err-msg">{{ error.message }}</p>
    <button type="button" class="err-btn" @click="home">← Back to the arena</button>
  </div>
</template>

<style scoped>
.err {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px;
  background:
    radial-gradient(ellipse at 50% 40%, #1a2030 0%, transparent 60%),
    #06080c;
  color: #e8ebf0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  text-align: center;
}
.err-mark {
  color: #6fe1f3;
  font-size: 22px;
  filter: drop-shadow(0 0 12px rgba(111, 225, 243, 0.5));
  margin-bottom: 8px;
}
.err-code {
  font-size: 64px;
  font-weight: 200;
  letter-spacing: 0.08em;
  margin: 0;
  color: #ffffff;
}
.err-msg {
  font-size: 14px;
  color: #8b929d;
  max-width: 460px;
  line-height: 1.55;
  margin: 0 0 12px;
}
.err-btn {
  background: transparent;
  color: #c8ccd2;
  border: 1px solid rgba(111, 225, 243, 0.3);
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 11px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 120ms;
}
.err-btn:hover {
  border-color: #6fe1f3;
  background: rgba(111, 225, 243, 0.06);
}
</style>
