const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || "https://llm-arena.app").replace(/\/+$/, "");
// When deploying as a GitHub Pages project page the app is served from
// `/<repo>/`. We let CI set this via NUXT_APP_BASE_URL; locally and on a
// custom domain it stays "/".
const baseURL = process.env.NUXT_APP_BASE_URL || "/";
const title = "LLM Arena — watch two language models talk to each other";
const description =
  "Pit two language models against each other in a debate or open-ended chat. Bring your own OpenRouter key, set the rules, and read the conversation that unfolds.";
const ogImage = `${siteUrl}/og-image.svg`;
// Public asset paths must include the baseURL so they resolve under gh-pages.
const faviconHref = `${baseURL.replace(/\/$/, "")}/favicon.svg`;

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "LLM Arena",
  applicationCategory: "DeveloperApplication",
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description,
  url: siteUrl,
  image: ogImage,
};

export default defineNuxtConfig({
  compatibilityDate: "2025-04-01",

  modules: [
    "@nuxtjs/tailwindcss",
    "@nuxtjs/color-mode",
    "@nuxtjs/google-fonts",
    "@nuxtjs/sitemap",
    "@pinia/nuxt",
    "@vueuse/nuxt",
  ],

  ssr: true,

  // Static generation for GitHub Pages — `pnpm generate` writes a fully
  // prerendered site to .output/public.
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ["/"],
    },
  },

  css: ["~/assets/css/tokens.css", "~/assets/css/print.css"],

  runtimeConfig: {
    public: {
      siteUrl,
    },
  },

  colorMode: {
    preference: "system",
    fallback: "light",
    classSuffix: "",
    storageKey: "llm-arena-color-mode",
  },

  site: {
    url: siteUrl,
    name: "LLM Arena",
  },

  sitemap: {
    autoLastmod: true,
  },

  googleFonts: {
    families: {
      // Editorial/broadsheet display — gives the masthead, motion lines, and
      // pull-quotes a literary record feel without reading as a tech blog.
      Newsreader: { wght: [400, 500, 600, 700], ital: [400, 500, 600] },
      // Body sans — neutral, modern, distinctly NOT Geist.
      "Inter Tight": [400, 500, 600, 700],
      // Mono — for model ids, round counters, timestamps.
      "JetBrains Mono": [400, 500],
    },
    display: "swap",
    preconnect: true,
  },

  app: {
    baseURL,
    head: {
      htmlAttrs: { lang: "en" },
      title,
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { name: "theme-color", content: "#FAF6EF", media: "(prefers-color-scheme: light)" },
        { name: "theme-color", content: "#131110", media: "(prefers-color-scheme: dark)" },
        { name: "application-name", content: "LLM Arena" },
        { name: "apple-mobile-web-app-title", content: "LLM Arena" },
        { property: "og:type", content: "website" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: siteUrl },
        { property: "og:image", content: ogImage },
        { property: "og:image:alt", content: "LLM Arena — two language models in conversation" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
      ],
      link: [
        { rel: "canonical", href: siteUrl },
        { rel: "icon", type: "image/svg+xml", href: faviconHref },
      ],
      script: [
        {
          key: "webapplication-jsonld",
          type: "application/ld+json",
          innerHTML: JSON.stringify(softwareApplicationJsonLd),
        },
      ],
    },
  },
});
