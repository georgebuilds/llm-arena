import { useColorMode } from "#imports";

export type ThemePreference = "light" | "dark" | "system";

export function useTheme() {
  const colorMode = useColorMode();

  const preference = computed<ThemePreference>({
    get() {
      const p = colorMode.preference;
      if (p === "light" || p === "dark" || p === "system") return p;
      return "system";
    },
    set(value: ThemePreference) {
      colorMode.preference = value;
    },
  });

  const resolved = computed(() => colorMode.value);

  function cycle() {
    const order: ThemePreference[] = ["system", "light", "dark"];
    const i = order.indexOf(preference.value);
    preference.value = order[(i + 1) % order.length];
  }

  return { preference, resolved, cycle };
}
