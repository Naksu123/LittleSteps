# LittleSteps — Content JSON Schemas (Games & Interactive Lessons)

Interactive games and lesson practice activities are data-driven and stored in PostgreSQL (`games.config_json`, `lessons.content_json`, `activities.payload_json`). The frontend provides four reusable game engines so teachers and admins can author new content without writing frontend code.

---

## 1. Lesson `content_json` Schema

```json
{
  "skill": "Color Recognition",
  "encouragement": "Wonderful effort!",
  "slides": [
    {
      "title": "Meet Red, Yellow, and Blue",
      "text": "Primary colors are everywhere around us!",
      "emoji": "🎨",
      "narration": "Primary colors are red, yellow, and blue. Look around your room to spot them!"
    }
  ]
}
```

Each lesson also includes a practice `Activity` (`activities[0]`) with `activity_type: "choice"` whose `payload_json` follows the **`choice`** engine schema below.

---

## 2. Reusable Game Engine Schemas (`games.config_json`)

All configurations include an optional `feedback: string[]` list of positive phrases.

### A. `choice` Engine
Used by: `letter-matching`, `number-counting`, `animal-sounds`, `picture-vocabulary`, `color-recognition`, `pattern-completion`, and lesson practice activities.

```json
{
  "engine": "choice",
  "skill": "Alphabet & Phonics",
  "feedback": ["Great job!", "You did it!", "Wonderful effort!"],
  "rounds": [
    {
      "prompt": "Find the letter B!",
      "speak": "Can you tap the letter B?",
      "visual": { "kind": "emoji", "value": "🐻" },
      "choices": [
        { "key": "B", "text": "B" },
        { "key": "D", "text": "D" },
        { "key": "P", "text": "P" }
      ],
      "answer": "B"
    }
  ]
}
```

Supported `visual` variants:
- `null` (prompt + choices only, e.g., color balloons using `choice.hex`)
- `{ "kind": "emoji", "value": "🐻" }`
- `{ "kind": "count", "emoji": "🍎", "count": 4 }`
- `{ "kind": "sequence", "items": ["🔴", "🔵", "🔴", "🔵"] }`
- `{ "kind": "sound", "text": "Moo moo!" }`

### B. `sort` Engine
Used by: `shape-sorting`, `object-sorting`. Accessible tap-to-select, tap-to-place bins.

```json
{
  "engine": "sort",
  "skill": "Shape Recognition",
  "bins": [
    { "key": "circle", "label": "Circle", "shape": "circle" },
    { "key": "square", "label": "Square", "shape": "square" }
  ],
  "items": [
    { "id": "i1", "label": "Sunny Ball", "shape": "circle", "color": "#FF9C8C", "bin": "circle" }
  ]
}
```

### C. `memory` Engine
Used by: `memory-matching`. Renders a 4-pair (8-card) memory flip grid.

```json
{
  "engine": "memory",
  "skill": "Visual Memory",
  "pairs": [
    { "key": "apple", "emoji": "🍎", "label": "Red Apple" }
  ]
}
```

### D. `puzzle` Engine
Used by: `puzzle-assembly`. Renders a 2×2 puzzle grid with shuffled picture tiles.

```json
{
  "engine": "puzzle",
  "skill": "Spatial Puzzle Assembly",
  "grid": 2,
  "pictures": [
    { "emoji": "🦁", "label": "Friendly Lion", "bg": "#FFE58A" }
  ]
}
```
