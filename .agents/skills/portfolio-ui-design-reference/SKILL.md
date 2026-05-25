---
name: portfolio-ui-design-reference
description: |
  UI design reference and patterns extracted from Ashutosh's portfolio (ui_ideas/portfolio-3.0).
  Use this skill when designing new UI components, pages, or layouts for Bunly or any other project.
  Trigger on tasks involving UI design decisions, component styling, animation patterns,
  section layouts, card designs, navigation patterns, or when the user mentions
  'portfolio style', 'design reference', 'ui ideas', or wants a polished/premium look.
license: MIT
metadata:
  author: ashutosh
  version: "1.0.0"
  source: ui_ideas/portfolio-3.0
---

# Portfolio UI Design Reference

Design patterns and UI component architecture extracted from Ashutosh's personal portfolio (Next.js + Tailwind CSS v4 + Framer Motion). Use this as a reference when building premium, polished UIs.

## Design System Overview

### Color Architecture (CSS Custom Properties)

The portfolio uses a **semantic neutral palette** with light/dark theme support via `data-theme` attribute on `:root`.

```css
/* Dark theme (default) */
:root {
  --background: #000000;
  --foreground: #fafafa;
  --card: #0f0f0f;
  --glow-color: 245, 245, 245;
  --glow-opacity: 0.25;
  /* Neutrals scale from 50 (darkest) to 950 (lightest) in dark mode */
}

/* Light theme */
:root[data-theme="light"] {
  --background: #f6f6f6;
  --foreground: #171717;
  --card: #ffffff;
  --glow-color: 10, 10, 10;
  --glow-opacity: 0.18;
  /* Neutrals scale inverted for light mode */
}
```

**Key insight**: The neutral scale is **inverted** between themes. `neutral-50` is dark in dark mode and light in light mode, enabling theme-agnostic class usage.

### Typography

- **Font**: `Geist Mono` (monospace) used throughout — gives a developer/technical aesthetic
- All headings and body text use `var(--font-mono)`
- Font loaded via `next/font/google`

### Glow Effect Pattern

A signature radial gradient glow is used as a background element:

```tsx
// Background.tsx - Radial glow at top of page
<div style={{
  background: `radial-gradient(ellipse 60% 50% at 50% 0%, rgba(var(--glow-color), var(--glow-opacity)), transparent 70%)`
}} />
```

## Component Patterns

### 1. SpotlightCard — Cursor-following hover glow

A card component with a radial gradient that follows the mouse cursor. Creates a premium interactive feel.

**Pattern**: Track mouse position relative to card → apply radial gradient at cursor position → fade in/out on hover.

```tsx
// Usage
<SpotlightCard
  className="bg-card rounded-2xl p-6"
  spotlightColor="rgba(var(--glow-color), var(--glow-opacity))"
>
  {/* content */}
</SpotlightCard>
```

**Implementation**: `useRef` for card ref, `useState` for `{x, y}` position and opacity. Gradient: `radial-gradient(600px circle at ${x}px ${y}px, ${color}, transparent 40%)`.

### 2. Magnetic — Magnetic hover effect

An element that subtly follows the cursor when hovered, creating a "magnetic" pull effect.

**Pattern**: Calculate offset from center → animate with spring physics.

```tsx
<Magnetic>
  <Link href="..." className="w-12 h-12 rounded-full ...">
    <Icon />
  </Link>
</Magnetic>
```

**Implementation**: Spring animation with `stiffness: 150, damping: 15, mass: 0.1`.

### 3. PixelTransition — Pixelated image transition

Pixel-dissolve transition between two images on hover. Uses a CSS grid of pixel divs.

### 4. RotatingText — Animated text rotation

Cycles through an array of strings with staggered character animations.

```tsx
<RotatingText
  texts={["A Full Stack Developer", "A Backend Specialist", "A Systems Engineer"]}
  rotationInterval={3000}
  staggerDuration={0.015}
  mainClassName="px-3 text-lg bg-gradient-to-tl from-neutral-100 to-neutral-300 ..."
/>
```

### 5. SocialIconWithTooltip — Animated tooltip on hover

Tooltip that follows cursor with spring physics and rotation. Uses `useMotionValue`, `useSpring`, `useTransform`.

**Pattern**: Map cursor X offset → tooltip rotation (-45° to 45°) and translateX (-50 to 50).

### 6. AnimatedThemeToggler — Animated light/dark toggle

Custom theme toggle with smooth animation (400ms duration).

## Section Layout Patterns

### Section Header Pattern (Badge + Title + Description)

Every section uses this consistent header pattern:

```tsx
<div className="flex items-center flex-col justify-center mb-5 md:mb-8">
  {/* Badge */}
  <div className="bg-card text-foreground mb-3 px-4 py-1 rounded-full text-sm font-medium border border-neutral-200 shadow-sm">
    Expertise
  </div>
  {/* Title */}
  <h2 className="text-3xl md:text-5xl font-bold text-foreground text-center mb-2 md:mb-4">
    Skills & Tools
  </h2>
  {/* Description */}
  <div className="max-w-md text-center text-neutral-600">
    Explore the technologies and tools I use...
  </div>
</div>
```

### Section Divider Pattern (Plus icons at corners)

Sections are separated by horizontal rules with `+` icons at the left and right edges:

```tsx
<div className="border-t border-neutral-200 relative">
  <Plus className="absolute -top-3 -left-3 h-6 w-6 text-neutral-400 z-20" />
  <Plus className="absolute -top-3 -right-3 h-6 w-6 text-neutral-400 z-20" />
</div>
```

### Bordered Container Pattern

The main content area uses side borders for a constrained, editorial feel:

```tsx
<div className="w-full border-l border-r border-neutral-200 relative">
  {/* All sections inside */}
</div>
```

## Animation Patterns (Framer Motion)

### Scroll-triggered entrance

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.6, ease: "easeOut" }}
/>
```

### Staggered children

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
/>
```

### Hover lift

```tsx
<motion.div
  whileHover={{ y: -5, transition: { duration: 0.2 } }}
/>
```

### Layout animation with AnimatePresence

```tsx
<AnimatePresence mode="popLayout">
  {items.map((item) => (
    <motion.div
      layout
      key={item.name}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3, type: "spring", damping: 25, stiffness: 300 }}
    />
  ))}
</AnimatePresence>
```

### Tab indicator with layoutId

```tsx
{activeTab === category && (
  <motion.div
    layoutId="activeSkillTab"
    className="absolute inset-0 bg-neutral-800 rounded-lg shadow-sm border border-neutral-200"
    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
    style={{ zIndex: -1 }}
  />
)}
```

## Navigation Pattern (Floating Pill Navbar)

Fixed, centered, floating navbar with:
- Pill-shaped container with glassmorphism: `backdrop-blur-xl`, `bg-linear-to-tl from-neutral-50/80 via-neutral-100/80 to-neutral-50/80`
- Active item: dark background (`bg-neutral-800 text-background`), text expands with `AnimatePresence`
- Spring animations for smooth transitions
- Theme toggle separated by a vertical divider
- Auto-hides on initial load with slide-down animation

```tsx
<motion.nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
  <div className="flex p-2 items-center gap-3 rounded-full border border-neutral-200/60 bg-linear-to-tl ... shadow-[...] backdrop-blur-xl">
    {navItems.map(...)}
    <div className="mx-0.5 h-6 w-px bg-neutral-300/60" /> {/* Divider */}
    <AnimatedThemeToggler />
  </div>
</motion.nav>
```

## Card Design Patterns

### Project Card

- SpotlightCard wrapper with hover glow
- Image/video toggle with chevron buttons
- IntersectionObserver for video autoplay
- Tech stack pills (max 4 shown, "+N" overflow)
- Action buttons: "Details" (primary dark) + "Live" (outline)

### Stats Bento Grid

4-column grid with varying spans:
- `md:col-span-2` for wide cards (repo card, email card, contribution heatmap)
- `md:col-span-1` for square cards (avatar, social icons)
- Fixed height: `h-48`
- Background image cards with overlay text
- Social icon cards with brand colors (e.g., LinkedIn `bg-[#0077b5]`)

### Skill Card

Grid layout: `grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4`
with animated filtering via `AnimatePresence mode="popLayout"`.

## Contact Section — VS Code IDE Contact Form

A standout design: the contact form is styled as a **VS Code IDE** with:
- Window controls (red/yellow/green dots)
- Breadcrumb path
- Activity bar (Files, Search, Git, Extensions, Settings icons)
- Explorer pane with file tree
- Tab bar with file tabs
- Code editor area with line numbers and syntax-highlighted form fields
- "Run Script" submit button styled as a terminal action

Form inputs are embedded inline within the "code" — the name, email, and message fields look like string values in a JavaScript function.

**Toggle between "Developer" (IDE) and "Standard" (traditional form) views** using `AnimatePresence mode="wait"`.

## Footer Pattern

- Large CTA text: "Let's build it." linked to mailto
- Social icons in circular buttons with Magnetic wrapper
- Horizontal divider with gradient: `bg-linear-to-r from-transparent via-neutral-200 to-transparent`
- Copyright at bottom

## Key Design Principles

1. **Monospace everything** — creates cohesive developer brand
2. **Neutral palette with semantic colors** — foreground/background/card tokens
3. **Subtle interactions everywhere** — hover lifts, spotlight glows, magnetic effects
4. **Bordered sections** — editorial feel with side borders and `+` dividers
5. **Consistent section headers** — badge → title → description pattern
6. **Spring physics** — natural, bouncy animations (damping: 25-30, stiffness: 300-400)
7. **Glassmorphism** — backdrop-blur + semi-transparent backgrounds for floating elements
8. **Bento grid** — mixed column spans for visual interest in stat/card layouts

## Source Files Reference

All source files are located in `ui_ideas/portfolio-3.0/src/`:

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout with Geist Mono font, metadata, theme provider |
| `app/globals.css` | CSS custom properties, theme tokens, scrollbar styles |
| `Components/ui/SpotlightCard.tsx` | Cursor-following hover glow card |
| `Components/ui/Magnetic.tsx` | Magnetic hover effect wrapper |
| `Components/ui/PixelTransition.tsx` | Pixel-dissolve image transition |
| `Components/ui/RotatingText.tsx` | Staggered text rotation animation |
| `Components/ui/SkillsMarquee.tsx` | Infinite scrolling skills ticker |
| `Components/ui/Background.tsx` | Radial glow background effect |
| `Components/ui/AnimatedThemeToggler.tsx` | Animated light/dark toggle |
| `Components/ui/ProjectCard.tsx` | Project card with video/image toggle |
| `Components/layout/navbar.tsx` | Floating pill navbar with spring animations |
| `Components/layout/footer.tsx` | Footer with magnetic social icons |
| `Components/sections/heroSection.tsx` | Full hero with all sub-sections |
| `Components/sections/skills.tsx` | Filterable skills grid with tabs |
| `Components/sections/Stats.tsx` | Bento grid stats dashboard |
| `Components/sections/experience.tsx` | Timeline/single experience layout |
| `Components/sections/contact.tsx` | VS Code-themed contact form |
| `Components/sections/projects.tsx` | Project grid layout |
| `data/skills.ts` | Skills data with icons/images |
| `data/projects.ts` | Project metadata |
| `data/experience.ts` | Experience/work history |
| `data/social.tsx` | Social links with icon components |
