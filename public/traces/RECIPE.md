# Robot Helmet Recipe

End-to-end formula for taking an AI-generated helmet illustration and turning it into a brand-themed, parameterized vector asset. Three tiers (Basic / Advance / Ultra), 3/4 view, gunmetal palette, swappable visor color and ear-plate logo.

## Files in this directory

| File | What it is |
|---|---|
| `helmets-original.jpeg` | Raw AI gen, has paint texture |
| `helmets-plain.png` | User-regenerated texture-free version (2816×1536) — **use this as source** |
| `helmets-v3.svg` | Master vector trace of `helmets-plain.png` |
| `brands.html` | Reference renderer with all 7 brand variants |
| `compare.html` | Side-by-side QA page for trace iterations |

Files prefixed `helmets-v1` / `v2` / `lite` / `clean` are earlier iterations kept for reference.

## Pipeline

```
[ AI generator: texture-free output ]   → helmets-plain.png
            │
            ▼
[ vtracer ]                              → helmets-v3.svg
            │
            ▼
[ HTML render with CSS filter + logo overlay ]   → brands.html
```

### Step 1 · Source image

Generate the helmet trio in a flat cel-shaded style with **no paint texture** in the flat regions. Texture in the source becomes hundreds of stray tiny paths in the trace. If your generator insists on texture, run the cleanup pre-pass below.

Optional pre-pass (Pillow):

```python
from PIL import Image, ImageFilter
img = Image.open("source.png").convert("RGB")
img = img.filter(ImageFilter.MedianFilter(size=5))   # kills texture, keeps edges
img = img.filter(ImageFilter.MedianFilter(size=3))
img = img.quantize(colors=10, method=Image.Quantize.MEDIANCUT,
                   dither=Image.Dither.NONE).convert("RGB")
img.save("clean.png")
```

### Step 2 · Vector trace

Install: `cargo install vtracer` (Rust toolchain required).

```bash
vtracer \
  --input  helmets-plain.png \
  --output helmets-v3.svg \
  --colormode color \
  --color_precision 8 \
  --filter_speckle 4 \
  --mode spline \
  --corner_threshold 60 \
  --segment_length 4 \
  --splice_threshold 45 \
  --path_precision 5
```

Param notes:
- `color_precision 8` — preserve subtle shading bands in the gunmetal
- `filter_speckle 4` — drop only true noise; raise to 8–16 if input still has texture
- `mode spline` — smooth curves for the rounded forms; switch to `polygon` for an angular low-poly look
- `corner_threshold 60` — default; lower = sharper corners
- `segment_length 4 / splice_threshold 45 / path_precision 5` — balance detail vs file size

### Step 3 · Brand recolor (CSS filter, no per-brand SVG needed)

The trace's only saturated color is the cyan visor. The body is desaturated greys, so a `hue-rotate` shifts the visor while leaving the body essentially unchanged. One SVG, one CSS filter per brand.

| Brand | Color | CSS filter |
|---|---|---|
| Stock | `#1de2da` | `none` |
| OpenAI | `#10a37f` | `hue-rotate(-15deg) saturate(0.85)` |
| xAI | `#9aa0a6` | `saturate(0) brightness(1.05)` |
| Anthropic | `#d97757` | `hue-rotate(-165deg) saturate(1.4)` |
| Meta | `#0866ff` | `hue-rotate(45deg) saturate(1.6)` |
| DeepSeek | `#4d6bfe` | `hue-rotate(60deg) saturate(1.5)` |
| Gemini | `#9168c0` | `hue-rotate(95deg) saturate(1.2)` |
| Mistral | `#ff5d00` | `hue-rotate(-155deg) saturate(1.8)` |

Apply: `<img src="helmets-v3.svg" style="filter: <recipe>">`.

If you ever need a true recolor (e.g. xAI on a colored background, or to keep filter chains for other effects), the alternative is a Python pass that detects cyan-family fills (`b > 150 && g > 150 && r < 180 && b-r > 20`) and rewrites them via HSL — preserve L, swap H/S to brand color.

### Step 4 · Ear-plate logo overlay

Logos sit on top of the master SVG, absolutely positioned, with a perspective skew so the disc reads as tilted into the helmet.

```css
.logo {
  position: absolute;
  width: 4.28%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%) perspective(100px) rotateY(-34deg);
  z-index: 5;
  pointer-events: none;
}
.l1 { left: 7.8%;  top: 52%; }                  /* Basic   */
.l2 { left: 39.5%; top: 51%; }                  /* Advance */
.l3 { left: 71.7%; top: 52%; width: 4.56%; }    /* Ultra (slightly larger) */
```

All percentages are of the rendered image container width/height. Logo SVG fragments live in `brands.html` under the `LOGOS` object — each is centered on `(0,0)` in a `viewBox="-20 -20 40 40"`.

## Splitting into individual helmet SVGs

For per-helmet usage (carousel nodes, loadout cards, etc.) crop the master via viewBox windows on the source 2816×1536 trace:

| Tier | viewBox |
|---|---|
| Basic | `0 0 900 1536` |
| Advance | `900 0 1100 1536` |
| Ultra | `1900 0 916 1536` |

Wrap the master once per tier:

```html
<svg viewBox="900 0 1100 1536"><use href="helmets-v3.svg#root"/></svg>
```

(or re-trace cropped sub-images for smaller per-helmet files).

## Porting to the Nuxt app

Drop `helmets-v3.svg` into `public/`, then a single Vue component handles every variant:

```vue
<script setup>
const props = defineProps<{ brand: BrandKey, tier: 'basic'|'advance'|'ultra' }>()
const filter = BRAND_FILTERS[props.brand]
const view   = TIER_VIEWBOXES[props.tier]
</script>

<template>
  <div class="helmet" :style="{ filter }">
    <svg :viewBox="view"><use href="/helmets-v3.svg#root"/></svg>
    <Logo :brand class="ear-plate" />
  </div>
</template>
```

Constants live in `composables/useHelmetConfig.ts`.
