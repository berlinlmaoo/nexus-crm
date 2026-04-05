# Design System Strategy: Resto Nusantara

## 1. Overview & Creative North Star
**Creative North Star: "The Culinary Alchemist"**
This design system moves beyond the utility of a "stock manager" and into the realm of a "curated kitchen ledger." It rejects the sterile, clinical aesthetic of traditional ERPs in favor of a warm, professional, editorial experience. 

To achieve a "High-End Editorial" feel on mobile, we leverage **Intentional Asymmetry** and **Tonal Depth**. Instead of centering everything, we use staggered layouts and varied type scales to guide the eye. We break the "template" look by treating digital space like a high-end food magazine: plenty of breathing room, sophisticated layering, and a focus on tactile quality.

## 2. Colors: Tonal Architecture
The palette is rooted in the warmth of raw ingredients and the precision of professional stainless steel.

*   **Primary (`#855300` / `#F59E0B`):** Use for high-intent actions. This represents the "Flame"—the energy of the kitchen.
*   **Secondary (`#006c49` / `#10B981`):** Reserved for growth, freshness, and "In Stock" indicators.
*   **Tertiary (`#545F73`):** Used for administrative metadata, providing a neutral, slate-like balance to the warmth of the primary hues.

### The "No-Line" Rule
**Borders are forbidden for sectioning.** To define a section, you must use a background color shift. For example, a `surface-container-low` list sitting on a `surface` background. This creates a seamless, modern interface that feels carved rather than assembled.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of materials:
*   **Base Layer:** `surface` (#F9F9F8) – The canvas.
*   **Mid Layer:** `surface-container` (#EEEEED) – For grouping secondary content.
*   **Top Layer:** `surface-container-lowest` (#FFFFFF) – Reserved for primary interactive cards to make them "pop" against the warmer background.

### The "Glass & Gradient" Rule
To elevate the "Shadcn/ui" inspiration into a premium space, use **Glassmorphism** for floating navigation bars or sticky headers. Apply `surface` at 80% opacity with a `20px` backdrop-blur. 
**Signature Textures:** Use a subtle linear gradient from `primary` (#855300) to `primary-container` (#F59E0B) at a 135-degree angle for main Action Buttons to give them a metallic, professional sheen.

## 3. Typography: The Editorial Voice
We use **Inter** not as a standard system font, but as a Swiss-style typographic tool.

*   **Display (Large/Med):** Used sparingly for "Hero" numbers (e.g., total stock value). High tracking (-0.02em) makes it feel "expensive."
*   **Headline (Small/Med):** The primary driver of the editorial look. Use `headline-sm` (1.5rem) for category titles, ensuring generous top-padding to create a "chapter start" feel.
*   **Title (Medium):** Used for item names in list views. It is the "Anchor" of the card.
*   **Label (Small):** Used for technical data (SKUs, Weights). These should often be in all-caps with +0.05em letter spacing to distinguish them from narrative text.

## 4. Elevation & Depth
In this system, depth is a result of light and shadow, not lines.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. The slight delta in hex value creates a "Soft Lift" that feels natural to the human eye.
*   **Ambient Shadows:** For floating elements (Modals/FABs), use `on-surface` (#1A1C1C) at 4% opacity with a `32px` blur and `8px` Y-offset. It should look like a soft glow, not a dark smudge.
*   **The "Ghost Border" Fallback:** If a divider is strictly necessary for accessibility, use `outline-variant` at 15% opacity. It should be barely perceptible.
*   **Roundedness:** Stick to the `md` (0.75rem / 12px) for cards to maintain a friendly but professional "pill-like" softness. Use `full` (9999px) only for status chips and search bars.

## 5. Components

### Cards & Lists (The Core)
*   **Design Rule:** Forbid divider lines between stock items. Use 16px of vertical white space to separate items. 
*   **Interaction:** On tap, the card should scale down slightly (98%) to provide tactile feedback.

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary-container`), `md` corner radius, white text.
*   **Secondary:** `surface-container-highest` background with `on-surface` text. No border.
*   **Touch Targets:** Minimum 44px height. For mobile-first efficiency, buttons should span the full width of their container.

### Input Fields
*   **Style:** Minimalist. No bottom line or full box. Use a `surface-container` background with a `md` radius. 
*   **Focus State:** Shift background to `surface-container-lowest` and add a 2px "Ghost Border" using the `primary` color at 30% opacity.

### Stock Status Chips
*   **Low Stock:** `error-container` background with `on-error-container` text.
*   **Healthy Stock:** `secondary-container` background with `on-secondary-container` text.
*   **Style:** Small, `label-md` type, `full` radius.

### Relevant App-Specific Components
*   **The "Quick-Scan" Drawer:** A bottom-anchored sheet using Glassmorphism for rapid stock adjustments.
*   **Inventory Heatmap:** Using tonal shifts from `surface-container` to `primary-container` to show high-turnover items.

## 6. Do's and Don'ts

### Do
*   **DO** use whitespace as a functional tool. If the screen feels crowded, increase the padding, don't add a border.
*   **DO** use `surface-container` tiers to nest information. An ingredient list should be on a slightly different "depth" than the recipe card header.
*   **DO** ensure all touch targets are generous. A chef's hands are often busy; the UI must be easy to hit.

### Don't
*   **DON'T** use pure black (#000000) for text. Use `on-surface` (#1A1C1C) to maintain the warm, professional tone.
*   **DON'T** use standard 1px borders. If you feel the need for a line, use a 4px gap of the background color instead.
*   **DON'T** use harsh "Drop Shadows." If an element needs to feel elevated, use the Ambient Shadow spec or a lighter surface token.