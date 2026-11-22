# LittleSteps — UI/UX Design System

LittleSteps combines the warmth of a bright preschool classroom with the clarity of a modern SaaS product.

---

## 1. Color Palette

| Token | Hex | Usage |
| --- | --- | --- |
| **Sky Blue** (`--color-sky`) | `#78C8F5` | Primary brand actions, Alphabet & Language accents, navigation highlights |
| **Soft Yellow** (`--color-sunshine`) | `#FFE58A` | Stars, daily streak pills, reward badges, sunshine highlights |
| **Mint Green** (`--color-mint`) | `#9BE7C4` | Positive feedback, completion states, Science & Discovery |
| **Coral** (`--color-coral`) | `#FF9C8C` | Warm callouts, Kids Mode accents, Arts & Creativity |
| **Lavender** (`--color-lavender`) | `#B8A5F5` | Stories, Social & Emotional Learning, Parent reflections |
| **Warm Cream** (`--color-cream`) | `#FFF9F0` | Primary canvas background (easy on young eyes) |
| **Dark Navy** (`--color-navy`) | `#24334D` | High-contrast accessible headings and body text |

---

## 2. Typography

- **Display / Kids Headings**: `Fredoka` (friendly, rounded geometry ideal for ages 4–6)
- **Body / Adult Portals**: `Nunito` (clean, legible humanist sans-serif for dashboards, tables, and guides)

---

## 3. Interaction & Child-First Rules

1. **Touch Targets**: All child-facing buttons use a minimum height of **56px** (`min-h-14`) with generous spacing and `rounded-3xl` (`24px`) corners.
2. **Audio-First Support**: Kids pages expose a **Hear Instructions** action using the browser Web Speech API (`window.speechSynthesis`).
3. **Zero Punitive Feedback**: Never display words like `"Wrong"` or `"Failed"`. Use encouraging prompts: *"Great effort!"*, *"Let's try another one!"*, *"You're learning something new!"*.
4. **No Distractions**: Kids Mode omits dense sidebars, external URLs, and multi-column data tables.
5. **Responsive Breakpoints**: Designed mobile-first for parents on phones (`<640px`) and tablets (`768px–1024px`) used by kindergarteners.
