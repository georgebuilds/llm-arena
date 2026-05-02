import type { Config } from "tailwindcss";

/**
 * LLM Arena uses CSS-variable-backed tokens defined in assets/css/tokens.css,
 * mirroring the "hearth" design language from Persona. Color utilities here
 * pull from those vars so light/dark switches automatically via the `.dark`
 * class on <html>. Do NOT add raw color palettes here.
 */
export default {
  content: [
    "./app.vue",
    "./error.vue",
    "./layouts/**/*.{vue,ts}",
    "./pages/**/*.{vue,ts}",
    "./components/**/*.{vue,ts}",
    "./composables/**/*.{vue,ts}",
    "./plugins/**/*.{vue,ts}",
    "./stores/**/*.{vue,ts}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-base": "var(--surface-base)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        tertiary: "var(--text-tertiary)",
        hairline: "var(--border-hairline)",
        accent: "var(--accent)",
        "accent-deep": "var(--accent-deep)",
        "accent-text": "var(--accent-text)",
        "accent-glow": "var(--accent-glow)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        "hearth-amber": "var(--hearth-amber)",
        "hearth-amber-deep": "var(--hearth-amber-deep)",
        "model-two": "var(--model-two)",
        "model-two-deep": "var(--model-two-deep)",
        "model-two-text": "var(--model-two-text)",
      },
      textColor: {
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        tertiary: "var(--text-tertiary)",
      },
      borderColor: {
        hairline: "var(--border-hairline)",
        DEFAULT: "var(--border-hairline)",
      },
      fontFamily: {
        // Display — editorial serif. Used for the masthead, motion lines,
        // pull-quotes, the artifact, and persona reveals. Replaces Fraunces.
        display: ['"Newsreader"', "Charter", "Georgia", "serif"],
        // Body — neutral modern sans. Replaces Geist (whose presence read as
        // an Anthropic site).
        sans: ['"Inter Tight"', "Inter", "system-ui", "sans-serif"],
        // Mono — for model ids, round counters, timestamps.
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: {
        // Used by masthead small caps and the broadcast strip — looks deliberate
        // at small sizes.
        marquee: "0.18em",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
} satisfies Config;
