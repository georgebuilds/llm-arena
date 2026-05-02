<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { PERSONAS } from "~/data/personas";
import { PERSONA_NONE, PERSONA_RANDOM } from "~/types";

const props = defineProps<{
  modelValue: string;
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const customMode = ref(props.modelValue.startsWith("custom:"));
const customText = ref(
  props.modelValue.startsWith("custom:") ? props.modelValue.slice("custom:".length) : "",
);

watch(
  () => props.modelValue,
  (v) => {
    if (v.startsWith("custom:")) {
      customMode.value = true;
      customText.value = v.slice("custom:".length);
    } else {
      customMode.value = false;
    }
  },
);

const selectValue = computed({
  get() {
    if (customMode.value) return "custom";
    return props.modelValue;
  },
  set(v: string) {
    if (v === "custom") {
      customMode.value = true;
      emit("update:modelValue", `custom:${customText.value}`);
    } else {
      customMode.value = false;
      emit("update:modelValue", v);
    }
  },
});

function onCustomInput(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  customText.value = v;
  emit("update:modelValue", `custom:${v}`);
}
</script>

<template>
  <div>
    <select
      v-model="selectValue"
      :aria-label="ariaLabel ?? 'Persona'"
      class="w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
    >
      <option :value="PERSONA_RANDOM">Surprise me — random persona</option>
      <option :value="PERSONA_NONE">No persona — speak as themselves</option>
      <option value="custom">Custom voice…</option>
      <optgroup label="Library">
        <option
          v-for="p in PERSONAS"
          :key="p.id"
          :value="p.id"
        >
          {{ p.name }}
        </option>
      </optgroup>
    </select>

    <input
      v-if="customMode"
      :value="customText"
      type="text"
      placeholder="Describe a voice and worldview…"
      class="mt-2 w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      @input="onCustomInput"
    />
  </div>
</template>
