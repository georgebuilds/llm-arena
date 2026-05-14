const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || "https://llm-arena.app").replace(/\/+$/, "");
// When deploying as a GitHub Pages project page the app is served from
// `/<repo>/`. We let CI set this via NUXT_APP_BASE_URL; locally and on a
// custom domain it stays "/".
const baseURL = process.env.NUXT_APP_BASE_URL || "/";
const title = "LLM Arena — pit two language models against each other";
const description =
  "Pick a fighter, a mask, and a mode. Two language models go at it across multiple rounds — debate, interview, negotiate, co-write, or co-author a story. An AI judge calls a winner. Bring your own OpenRouter key.";
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

  // No global stylesheets — arena components are self-styled via scoped CSS.

  runtimeConfig: {
    public: {
      siteUrl,
    },
  },

  site: {
    url: siteUrl,
    name: "LLM Arena",
  },

  sitemap: {
    autoLastmod: true,
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
        // Arena is a dark-only experience — single theme-color, no light variant.
        { name: "theme-color", content: "#06080c" },
        { name: "color-scheme", content: "dark" },
        { name: "application-name", content: "LLM Arena" },
        { name: "apple-mobile-web-app-title", content: "LLM Arena" },
        { property: "og:type", content: "website" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: siteUrl },
        { property: "og:image", content: ogImage },
        { property: "og:image:alt", content: "LLM Arena — two robot helmets squaring off across a VS marker, the bout interface in the background" },
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
