---
name: Neighborhood Preview Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d5e3fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#414844'
  inverse-surface: '#233144'
  inverse-on-surface: '#eaf1ff'
  outline: '#717973'
  outline-variant: '#c1c8c2'
  surface-tint: '#3f6653'
  primary: '#012d1d'
  on-primary: '#ffffff'
  primary-container: '#1b4332'
  on-primary-container: '#86af99'
  inverse-primary: '#a5d0b9'
  secondary: '#006c48'
  on-secondary: '#ffffff'
  secondary-container: '#92f7c3'
  on-secondary-container: '#00734d'
  tertiary: '#401c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#612e00'
  on-tertiary-container: '#ff8611'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c1ecd4'
  primary-fixed-dim: '#a5d0b9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#274e3d'
  secondary-fixed: '#92f7c3'
  secondary-fixed-dim: '#75daa8'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005235'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb784'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#713700'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d5e3fc'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-xs:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 3rem
---

## Brand & Style

### Personality & Tone
The design system embodies the persona of a reliable, knowledgeable local mentor: calm, perceptive, supportive, and thoroughly transparent. It balances institutional trustworthiness (for life-altering housing decisions) with a warm, welcoming energy suitable for first-time renters, university students, and young professionals entering the workforce.

### Emotional Target
- **Relief & Reassurance:** Eliminating the anxiety of unfamiliar neighborhoods through grounded, structured information.
- **Agency & Confidence:** Empowering users to filter criteria quickly without visual fatigue or decision paralysis.
- **Clarity & Delight:** Sparking excitement for a fresh start with crisp accents, intuitive micro-interactions, and breathable layouts.

### Visual Style
A hybrid of **Modern Editorial Pragmatism** and **Warm Tactile Minimalism**. Interfaces rely on crisp 1px neutral borders, soft organic rounded surfaces (`rounded-xl` to `rounded-2xl`), multi-tiered subtle elevation shadows tinted with deep slate, and clear information density. Map surfaces and data cards coexist harmoniously without cognitive overload.

## Colors

### Palette Philosophy
The palette pairs the enduring, grounded presence of forest greens with fresh botanical midtones, balanced by an engaging warm orange accent for interactive discovery and alert-free callouts.

- **Primary (`#1B4332`, Deep Green):** Used for focal action drivers, primary branding, dominant headlines, and key navigational milestones. It grounds the platform in security and stability.
- **Secondary (`#52B788`, Sage Green):** Used for supporting indicators, positive living factors (e.g., green space metrics, walkability tags), active filter selections, and subtle background tints (`#D8F3DC`).
- **Tertiary / Accent (`#F77F00`, Warm Orange):** Applied purposefully to AI recommendations, standout alerts, neighborhood highlight badges, and conversion micro-moments.
- **Neutral (`#475569`, Slate Gray):** Spanning structured foreground ink (`#1E293B`), body copy (`#475569`, `#64748B`), delicate 1px boundary lines (`#E2E8F0`), and soft canvas groundings (`#F8F9FA`, `#F3F4F6`).
- **Functional Semantics:**
  - Positive / Safe: `#10B981` (Emerald)
  - Caution / Advisory: `#F59E0B` (Amber)
  - Critical / Risk: `#EF4444` (Rose)

### Color Role Usage Rules
- Background surfaces utilize stratified off-white tones (`#F8F9FA` for overall canvas, `#FFFFFF` for primary content cards, `#F3F4F6` for input bays and interactive wells).
- Avoid pairing Primary Green with Accent Orange at equal visual weight; Orange serves strictly as an energetic focal trigger (less than 10% total screen surface).

## Typography

### Structural Hierarchy
The typographic scale is tuned for dense, structured urban data analysis and high-clarity mobile scanning.

- **Pretendard & Plus Jakarta Sans Alignment:** Plus Jakarta Sans handles numerical, alphanumeric, and international contexts with geometric warmth, matching Pretendard's clean, modern grotesque rhythm in Korean text environments.
- **Headlines (`28px` to `18px`):** Emphasize neighborhood titles, key metric scores, and summary headings. Tight letter spacing (`-0.01em` to `-0.02em`) preserves visual impact without word sprawling.
- **Body Hierarchy (`16px` down to `13px`):** `body-lg` and `body-md` are reserved for AI summary paragraphs, reviews, and neighborhood insights. `body-sm` (14px) and `body-xs` (13px) form the baseline for metadata lists, amenity distances, and comparative specs.
- **Labels & Micro-Tags (`12px`, `11px`):** Explicitly weighted (`500` to `600`) to guarantee legibility on colored chip surfaces, map callouts, transit pin labels, and status badges.

## Layout & Spacing

### Grid Philosophy
The layout relies on a fluid grid architecture optimized for split-screen navigation (map viewport alongside listing/insight panels):
- **Mobile (< 768px):** Single-column stack with bottom sheets for neighborhood cards. Canvas margin: `1rem` (`16px`), column gutter: `1rem`. Map takes full viewport height with contextual floating controls.
- **Tablet (768px - 1023px):** 8-column layout. Margin: `1.5rem` (`24px`), gutter: `1rem`. Split view activates conditionally (40% list / 60% map).
- **Desktop (≥ 1024px):** 12-column layout with a fixed max-width container (`1440px`). Margin: `2rem` (`32px`), gutter: `1.5rem` (`24px`). Permanent split: left master panel (`480px` or 5 columns) dedicated to AI insights, neighborhood rankings, and filters; remaining space hosts interactive geospatial map layers.

### Spacing Rhythm
- **Internal Component Spacing:** `space-xs` (4px) and `space-sm` (8px) govern tight pairings (icon-to-label, badge insets, filter chip groups).
- **Card Padding & Section Flow:** Card interiors use `space-lg` (16px) on mobile and `space-xl` (24px) on desktop to provide spacious separation between complex metrics (e.g., sound levels, average deposit, safety score).

## Elevation & Depth

### Depth Philosophy
Hierarchy is conveyed through **tonal surface stacking** combined with **subtle, diffused slate shadows** rather than heavy skeuomorphism or stark drop-shadows.

### Elevation Levels
1. **Level 0 (Flat Canvas):** `#F8F9FA` or `#F3F4F6`. Zero shadow, native ground level.
2. **Level 1 (Card & Section Containers):** `#FFFFFF` surface bordered by a crisp `1px solid #E2E8F0` with `shadow-sm` (`0 1px 2px 0 rgba(30, 41, 59, 0.05)`). Used for feed cards, neighborhood overview panels, and static modules.
3. **Level 2 (Interactive & Hovered States):** `#FFFFFF` surface with `shadow-md` (`0 4px 6px -1px rgba(30, 41, 59, 0.08), 0 2px 4px -2px rgba(30, 41, 59, 0.04)`) and border shifting to `#CBD5E1`. Used for hovering cards, floating search inputs, and filter chips.
4. **Level 3 (Floating UI & Overlays):** Bottom sheets, modal dialogues, floating map interaction buttons, and active map marker tooltips. Shadow: `0 12px 24px -4px rgba(30, 41, 59, 0.12), 0 4px 8px -2px rgba(30, 41, 59, 0.04)`.

## Shapes

### Shape Architecture
The system employs comfortable, modern rounded surfaces aligned with `roundedness: 2`:
- **Default Elements (`rounded`, 8px / 0.5rem):** Standard form inputs, segmented control segments, small utility buttons, map tooltips.
- **Medium Structural Containers (`rounded-lg`, 16px / 1rem):** Filter pills, sub-cards within feed views, image thumbnail wrappers.
- **Large Hero Containers (`rounded-xl` to `rounded-2xl`, 20px–24px):** Primary neighborhood summary cards, modal overlays, map popover sheets.
- **Pill Geometry (`rounded-full`):** Category tags, status indicators, and AI prompt quick-chips.
- **Borders:** Consistent `1px` structural outline (`#E2E8F0`) across all elevated surfaces to prevent blurred visual boundaries against off-white grounds.

## Components

### Buttons
- **Primary:** Background `#1B4332`, text `#FFFFFF`, rounded `0.75rem` (`rounded-xl`), font weight `600`. Hover state transitions to `#2D6A4F`. Pressed state scales subtly to `0.98`.
- **Secondary:** Background `#D8F3DC`, text `#1B4332`, hover `#B7E4C7`.
- **Accent (Call-to-Action / AI Action):** Background `#F77F00`, text `#FFFFFF`, hover `#FB8500`.
- **Ghost / Tertiary:** Transparent background, text `#475569`, border `1px solid #E2E8F0`, hover background `#F1F5F9`.

### Chips & Interactive Filters
- **Default State:** Background `#FFFFFF`, border `1px solid #E2E8F0`, text `#475569`, typography `label-md`. Rounded `9999px` (pill).
- **Selected State:** Background `#1B4332`, border `1px solid #1B4332`, text `#FFFFFF`.
- **Sub-Filter (Accent):** Background `#FEF3C7` (for cautionary filters) or `#D8F3DC` (for positive lifestyle filters) with matching darkened text.

### Cards
- **Neighborhood Insight Card:** White ground, `1px solid #E2E8F0`, border-radius `1rem`, internal padding `1.25rem`. Header showcases neighborhood title in `headline-sm`, subtitle/distance in `body-xs` (`#64748B`), and a top-right highlight badge (`#F77F00` or `#52B788`).
- **Metric Metric Card:** Embedded inside neighborhood sheets with background `#F8F9FA`, zero shadow, and 8px roundedness for clean micro-data display (e.g., "Safety Level: High", "Transit Score: 94").

### Form Inputs & Search Fields
- **Container:** Height `48px`, background `#FFFFFF`, border `1px solid #E2E8F0`, corner radius `0.75rem`.
- **Focus State:** Border color `#2D6A4F`, box-shadow `0 0 0 3px rgba(82, 183, 136, 0.25)`.
- **Placeholder:** Text `#94A3B8`, typography `body-sm`. Leading icon colored `#64748B`.

### Checkboxes & Radio Buttons
- **Checkbox:** `18px` by `18px`, border `1.5px solid #CBD5E1`, radius `4px`. Checked: background `#1B4332`, white checkmark icon.
- **Radio:** `18px` outer diameter, border `1.5px solid #CBD5E1`. Selected: `#1B4332` ring with centered 8px solid disc.

### Map Marker Badges
- **Standard Marker:** Teardrop pill with white container, `1px solid #E2E8F0`, typography `label-md`, displaying median monthly rent or neighborhood name.
- **Selected Marker:** `#1B4332` background with `#FFFFFF` text, `shadow-md`, scale `1.1`.
- **AI Recommendation Marker:** `#F77F00` background with glowing ring `0 0 0 4px rgba(247, 127, 0, 0.2)`.

### Neighborhood Radar & Safety Score Ticker
- Specialized component grouping 3 to 5 micro-progress tracks (Noise, Safety, Conveniences, Transit) using colored track fills (`#10B981` Safe, `#F59E0B` Moderate, `#EF4444` Watch).