---
name: Obsidian Apex
colors:
  surface: '#121414'
  surface-dim: '#121414'
  surface-bright: '#38393a'
  surface-container-lowest: '#0c0f0f'
  surface-container-low: '#1a1c1c'
  surface-container: '#1e2020'
  surface-container-high: '#282a2b'
  surface-container-highest: '#333535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#ebbbb4'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#2f3131'
  outline: '#b18780'
  outline-variant: '#603e39'
  surface-tint: '#ffb4a8'
  primary: '#ffb4a8'
  on-primary: '#690100'
  primary-container: '#ff5540'
  on-primary-container: '#5c0000'
  inverse-primary: '#c00100'
  secondary: '#ffb4a8'
  on-secondary: '#690000'
  secondary-container: '#980000'
  on-secondary-container: '#ff9f90'
  tertiary: '#c8c6c7'
  on-tertiary: '#313031'
  tertiary-container: '#929091'
  on-tertiary-container: '#2a292b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad4'
  primary-fixed-dim: '#ffb4a8'
  on-primary-fixed: '#410000'
  on-primary-fixed-variant: '#930100'
  secondary-fixed: '#ffdad4'
  secondary-fixed-dim: '#ffb4a8'
  on-secondary-fixed: '#410000'
  on-secondary-fixed-variant: '#930000'
  tertiary-fixed: '#e5e2e3'
  tertiary-fixed-dim: '#c8c6c7'
  on-tertiary-fixed: '#1c1b1d'
  on-tertiary-fixed-variant: '#474648'
  background: '#121414'
  on-background: '#e2e2e2'
  surface-variant: '#333535'
typography:
  display-hero:
    fontFamily: Outfit
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Outfit
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  data-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  grid-margin: 2rem
  gutter-md: 1.5rem
  panel-gap: 1rem
  bento-unit: 160px
---

## Brand & Style

The design system is an ultra-premium UI framework designed for elite studio management. It evokes the atmosphere of a hypercar dashboard or a high-end command center—merging the aggressive precision of performance engineering with the quiet confidence of luxury.

### Visual Direction
- **Hyper-Luxury Ceramic Polish:** Surfaces should feel physical, like polished obsidian or dark chrome.
- **Elite Enterprise:** A balance of high-density data visualization (HUD-inspired) and spacious, cinematic layouts.
- **Style Mix:** A fusion of **Minimalism** (clean typography, intentional whitespace) and **Glassmorphism** (depth via translucent layers and blurs), accented with **Neomorphic** soft-extrusion for interactive elements.

## Colors

The palette is anchored in a "Pure Dark Void" to maximize contrast for high-status accents, now shifted toward a high-intensity red spectrum.

- **Primary (Apex Red):** Reserved for high-status indicators, success states, and micro-glows. It represents the "Redline" of performance—vibrant, aggressive, and commanding.
- **Secondary (Deep Crimson):** Used for critical telemetry, urgent alerts, and secondary status indicators, providing a sophisticated tonal depth to the interface.
- **Neutral (Soft White):** Provides high legibility against the dark void without the harshness of pure white.
- **Surfaces:** Utilize the "Obsidian Glass" variable with `backdrop-filter: blur(16px)` to create depth and separation from the base void.

## Typography

The typography strategy separates **Brand/Editorial** content from **System/Data** content.

- **Outfit (Primary):** Used for all headings and body copy to provide a modern, geometric, and welcoming luxury feel.
- **JetBrains Mono (Data):** Used for all metrics, telemetry panels, timestamps, and technical labels. The monospaced nature reinforces the "instrument cluster" aesthetic.
- **Visual Hierarchy:** Use `label-caps` for section headers within panels to maintain a structured, engineering-led appearance.

## Layout & Spacing

This design system utilizes a **Bento Grid** philosophy for dashboarding and a **Fluid Grid** for content-heavy pages.

- **Bento Grids:** Layouts should be composed of modular obsidian tiles. Each tile should have a consistent `panel-gap` and adhere to a 12-column underlying structure on desktop.
- **Telemetry Panels:** Complex data should be grouped into self-contained HUD modules.
- **Adaptation:** On mobile, bento tiles stack vertically. Gutters reduce from `1.5rem` to `1rem` to preserve screen real estate for data.

## Elevation & Depth

Hierarchy is achieved through a combination of translucency and subtle lighting rather than traditional heavy shadows.

- **Tonal Layers:** 
    1. **Level 0 (Base):** Void Black (#070708).
    2. **Level 1 (Panels):** Obsidian Glass with a 1px `carbon-border`.
    3. **Level 2 (Popovers/Modals):** Darker obsidian (rgba(10, 10, 12, 0.9)) with a stronger backdrop blur (32px).
- **Glows:** Use `apex-red` and `deep-crimson` box-shadows (0 0 20px) sparingly to indicate "Active" or "Critical" status.
- **Reflections:** Apply a very subtle top-to-bottom metallic linear gradient (white at 5% opacity to 0%) on the border to simulate a light source from above.

## Shapes

The shape language is inspired by high-end consumer electronics—soft but defined.

- **Panels:** Use `rounded-lg` (1rem) for standard bento tiles.
- **Interactive Elements:** Use `rounded-xl` (1.5rem) for buttons and inputs to make them feel "squishy" and ergonomic.
- **Neomorphic Accents:** For inner-ui elements like toggle switches or small counters, use a subtle "inset" shadow combined with a top-left light highlight to create a molded, physical feel.

## Components

### Buttons
- **Primary (Apex Performance):** Gradient background from Apex Red to Deep Crimson. 1.5rem corner radius. High-intensity red glow on hover.
- **Secondary (Pulse):** Ghost style with an Apex Red border and Apex Red text. On hover, fills with a 10% Apex Red tint.

### Cards (Bento Tiles)
- **Visual Style:** Obsidian glass surfaces. Each card must have a 1px border using `rgba(255,255,255,0.08)`. 
- **Header:** Use `label-caps` in JetBrains Mono for tile titles, positioned in the top-left with a micro Apex Red dot accent.

### Inputs
- **Style:** Frosted glass background (lower opacity than cards). 
- **Focus State:** Border transitions to Apex Red with a 4px soft outer glow. Text remains Pure White for maximum contrast.

### Lists & Tables
- **Rows:** Transparent backgrounds with a 1px bottom border. 
- **Hover State:** Apply a very subtle Apex Red linear gradient across the row (2% opacity) to highlight selection.

### Telemetry Widgets
- Small, high-density components showing line charts or radial progress. 
- **Chart Lines:** Use 2px stroke width. Primary data in Apex Red; secondary in Deep Crimson.