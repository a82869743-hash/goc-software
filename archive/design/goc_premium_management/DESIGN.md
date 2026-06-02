---
name: GOC Premium Management
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
  on-surface-variant: '#e8bdb6'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#2f3131'
  outline: '#ae8882'
  outline-variant: '#5e3f3a'
  surface-tint: '#ffb4a8'
  primary: '#ffb4a8'
  on-primary: '#690000'
  primary-container: '#cc0000'
  on-primary-container: '#ffdad4'
  inverse-primary: '#c00000'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#4a4949'
  on-secondary-container: '#bab8b7'
  tertiary: '#ffb4a8'
  on-tertiary: '#690000'
  tertiary-container: '#c12719'
  on-tertiary-container: '#ffdad4'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad4'
  primary-fixed-dim: '#ffb4a8'
  on-primary-fixed: '#410000'
  on-primary-fixed-variant: '#930000'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#ffdad4'
  tertiary-fixed-dim: '#ffb4a8'
  on-tertiary-fixed: '#410000'
  on-tertiary-fixed-variant: '#930000'
  background: '#121414'
  on-background: '#e2e2e2'
  surface-variant: '#333535'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.08em
  mono-data:
    fontFamily: monospace
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-margin: 24px
  gutter: 16px
  stack-sm: 4px
  stack-md: 12px
  stack-lg: 24px
---

## Brand & Style

The design system is engineered to reflect the high-performance precision of the luxury automotive detailing world. It targets business owners and technicians who demand the same level of excellence in their software as they provide to a vehicle’s finish.

The visual style is **Corporate / Modern** with a **Tactile** edge. It leverages high-fidelity components that mimic professional telemetry dashboards. The aesthetic balance is struck between "Laboratory Clean" (Light Mode) and "Night Drive" (Dark Mode). Every interaction should feel intentional and high-end, utilizing clean lines, technical data density, and subtle light-emissive effects that suggest a premium, engine-on state.

## Colors

This design system utilizes a high-contrast palette where **Primary Red** serves as the "ignition" for the interface. 

- **Primary Red (#CC0000):** Reserved for high-priority actions, critical status indicators, and active states.
- **Dark Red Gradient:** Applied to structural elements like the sidebar or header to establish brand authority without overwhelming the content area.
- **Pure Black/Dark Gray (#000000 / #111111):** Forms the chassis of the Dark Mode experience, providing a deep backdrop that allows data and imagery to pop.
- **Pure White (#FFFFFF):** Used for maximum legibility in Light Mode and as high-contrast text on dark surfaces.
- **Light Gray (#F5F5F5):** Acts as the "polished chrome" detail—used for borders, dividers, and subtle backgrounds to maintain a clean, organized structure.

## Typography

The design system employs **Inter** as its primary typeface to achieve a neutral, systematic, and utilitarian feel. 

Headlines utilize tighter tracking and heavier weights to evoke the bold branding found in automotive logos. Body copy remains airy and highly legible to handle the density of a management system. For technical data—such as timestamps, pricing, or VIN numbers—a monospaced font is used to provide a "diagnostic" feel, reinforcing the precision of the studio environment.

## Layout & Spacing

This design system uses a **Fixed Grid** approach for internal content cards within a fluid dashboard container. The layout rhythm is based on an **8px base unit**, ensuring mathematical harmony across all components.

- **Grid:** A 12-column system is used for dashboard layouts, allowing for flexible spans of 3, 4, 6, or 12 units.
- **Margins:** Standard outer container margins are set to 24px to give the interface a "premium" sense of space.
- **Density:** Information-heavy views (like inventory or scheduling) can shift to a compact mode where vertical stack spacing is reduced to 4px.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** rather than traditional heavy shadows. 

In Dark Mode, the base background is Pure Black (#000000). Surface containers (cards) use Pure Black (#111111) with a subtle 1px border of Light Gray at low opacity (10%). 

The signature **Red Glow** (`rgba(204,0,0,0.15)`) is used as an elevation substitute for active elements. Instead of a shadow falling "behind" the card, the glow emanates from "beneath" the element, suggesting it is powered on or currently selected. Light Mode relies on soft, neutral depth markers and crisp 1px dividers to maintain a surgical, clean look.

## Shapes

The design system adopts a **Soft (0.25rem)** roundedness philosophy. This choice reflects the precision-cut edges of high-end machinery and carbon fiber components. 

Large containers and cards use `rounded-lg` (0.5rem) to soften the overall dashboard, while smaller interactive elements like buttons and input fields stay at the base `rounded` (0.25rem) to maintain a sense of technical sharpness. Pill-shapes are used exclusively for status chips (e.g., "In Progress," "Completed") to distinguish them from functional buttons.

## Components

- **Buttons:** Primary buttons use the Dark Red Gradient with white text. On hover, they emit a 12px Primary Red glow. Ghost buttons use a 1px Light Gray border and white text.
- **Cards:** In Dark Mode, cards are #111111 with a subtle "inner glow" top-border (1px, 5% white) to catch the light. In Light Mode, they are Pure White with a 1px #F5F5F5 border.
- **Input Fields:** Designed with a "hidden" look—bottom border only or very subtle 1px outline. When focused, the border turns Primary Red with a tiny corner glow.
- **Status Chips:** Small, pill-shaped elements. The "GOC Signature" chip uses a semi-transparent red background with a solid red dot icon to indicate activity.
- **Sidebar:** A persistent vertical navigation utilizing the Dark Red Gradient. Icons are white, with an "active" state indicated by a high-contrast white bar on the left edge.
- **Data Tables:** High-density, utilizing the `mono-data` typography. Rows alternate with a #111111 and #000000 background (Dark Mode) to maintain alignment without heavy lines.