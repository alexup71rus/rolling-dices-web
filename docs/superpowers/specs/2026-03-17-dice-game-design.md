# Dice Game — Design Spec
**Date:** 2026-03-17
**Stack:** Qwik + Three.js + Cannon-es + TypeScript + Vite

---

## 1. Overview

A single-player browser dice game (Farkle / KCD-style). The player rolls up to 6 dice, selects scoring combinations, and decides whether to bank points or re-roll the remaining dice. The goal is to reach a chosen target score (2000 / 3000 / 4000) without losing a turn to a Farkle (no scoring dice).

The visual centrepiece is a 3D dice roll animation. Animations are **pre-baked** (physics simulation recorded as JSON keyframes) and **texture-remapped** at runtime so the correct faces land face-up — giving a wide variety of natural-looking rolls without procedural generation.

---

## 2. Scoring Rules

**Only the combinations listed below score. Any other combination is non-scoring.**

| Combination | Points | Dice consumed |
|---|---|---|
| Single 1 | 100 | 1 die |
| Single 5 | 50 | 1 die |
| Three 1s | 1 000 | 3 dice |
| Three 2s | 200 | 3 dice |
| Three 3s | 300 | 3 dice |
| Three 4s | 400 | 3 dice |
| Three 5s | 500 | 3 dice |
| Three 6s | 600 | 3 dice |
| Straight 1-2-3-4-5 | 1 500 | 5 dice |

**Combination rules:**
- A die may only participate in one combination per roll.
- The straight 1-2-3-4-5 consumes exactly 5 dice. If a 6th die was also rolled, it may score independently.
- Four/five/six-of-a-kind are **not** implemented; they are counted as three-of-a-kind + leftover singles.
- No minimum score is required to bank points.

**Farkle:** if no scoring combination exists among the rolled dice, the turn score is lost (not total game score). The turn ends immediately.

**Hot Dice:** triggered when **all currently-rolled dice** (not set-aside dice) score in a single roll. All 6 dice return to play and the accumulated turn score is preserved. The set-aside display clears to signal a fresh slate while the turn score panel continues to show the preserved total.

---

## 3. Game Flow

```
SetupScreen
  → choose target: 2 000 / 3 000 / 4 000
  → configure dice (total must equal 6)
  → Start

GameScreen (loop per turn)
  → roll N dice (animation plays)
  → detect scoring combinations
  → player selects ≥1 scoring die/combination
  → player chooses:
      [Roll again (remaining dice)] — requires ≥1 die selected this roll
      [End turn]                    — banks turn score; requires turn score > 0
  → if Farkle: show warning 2s, then show [Next Turn] button only; turn score = 0
  → if Hot Dice: strip clears, all 6 dice return, roll again prompt

WinScreen
  → shown immediately when End Turn causes total score ≥ target
```

**Selection rules:**
- Only dice that participate in a valid scoring combination are clickable. Non-scoring dice are visually inert.
- A selected die can be deselected by clicking again (toggle), as long as the roll animation is not in progress.
- Partial combinations (e.g. selecting only 2 dice from a three-of-a-kind) are not valid — the UI must validate combinations on selection and refuse invalid partial states.
- The scoring engine greedily maximises total points: e.g. `[1,1,2,3,4,5]` is presented as straight (1500) + single 1 (100), not as three singles.

**Selection state:** when the player clicks "Roll Again," selected dice become set-aside and their glow is removed. The new roll begins with the remaining dice in a neutral (unselected) state.

**Hot Dice:** fires **automatically** as soon as the game detects (after the animation finishes) that every die in the current roll belongs to at least one scoring combination — the player does not need to select or click anything. A 🔥 banner appears and a "Roll All 6" button is shown. Clicking it plays a fresh 6-dice animation. The set-aside strip clears. All 6 `DiceRollState` entries reset to `setAside: false, selected: false, value: 0`. `turnScore` is preserved. `turnScore` is always > 0 when Hot Dice triggers because ≥1 scoring die was set aside in a prior re-roll.

---

## 4. Dice Types & Modifier System

### TypeScript Interfaces

```ts
interface Die {
  baseWeights: number[];  // immutable, length 6, one per face (index 0 = face 1)
  weights: number[];      // working copy, reset to baseWeights before each roll
  type: DieType;
}

type DieType = 'normal' | 'biased-1' | 'biased-5' | 'lucky' | 'unlucky';

type Modifier =
  | { power: number; targetDiceIndices: number[]; effectType: 'boost'; params: { face: number; amount: number } }
  | { power: number; targetDiceIndices: number[]; effectType: 'block'; params: { face: number } };
// power: 1–10, higher runs first
// boost amount: raw weight units; formula applies amount * (power / 5), so power=5 → 1× multiplier
```

### Dice Types

| Type | Icon | Base Weights | Description |
|---|---|---|---|
| Normal | ⚀ | `[1,1,1,1,1,1]` | Equal probability |
| Biased-1 | 🎯 | `[3,1,1,1,1,1]` | Face 1 is 3× more likely |
| Biased-5 | 🎯 | `[1,1,1,1,3,1]` | Face 5 is 3× more likely |
| Lucky | 🍀 | `[1,1,1,1,1,1]` | +1 weight to the highest-EV face (see below) |
| Unlucky | 💀 | `[1,1,1,1,1,1]` | −1 weight to the same face (clamped to 0) |

### Roll Procedure (per roll)

```
1. Reset each die's weights to baseWeights
2. applyModifiers(dice, staticModifiers)   // biased dice effects
3. resolveLuckyDice(dice)                  // lucky/unlucky post-processing
4. clampWeights(dice)                      // ensure no weight < 0
5. rollDice(dice)                          // weighted random sample
```

### applyModifiers

```ts
function applyModifiers(dice: Die[], modifiers: Modifier[]): void {
  const sorted = [...modifiers].sort((a, b) => b.power - a.power);
  for (const mod of sorted) {
    for (const idx of mod.targetDiceIndices) {
      const w = dice[idx].weights;
      if (mod.effectType === 'boost') {
        w[mod.params.face - 1] += mod.params.amount * (mod.power / 5);
      } else if (mod.effectType === 'block') {
        w[mod.params.face - 1] = 0;
      }
    }
  }
}
```

### resolveLuckyDice

Lucky/Unlucky dice look at the **other non-lucky dice's current weights**, determine the single face value that maximises expected score (using the scoring table), then apply `+1` (Lucky) or `−1` (Unlucky) weight to that face on themselves. This runs **after** `applyModifiers` so biased weights are already reflected.

```ts
function resolveLuckyDice(dice: Die[]): void {
  const targetFace = getBestExpectedFace(dice.filter(d =>
    d.type !== 'lucky' && d.type !== 'unlucky'
  ));
  for (const die of dice) {
    if (die.type === 'lucky')   die.weights[targetFace - 1] += 1;
    if (die.type === 'unlucky') die.weights[targetFace - 1] -= 1;
  }
}
```

`getBestExpectedFace` uses a **flat single-die EV** approach — no combinatorial look-ahead:

```
EV(face) = P(face lands) × singleDieScore(face)
singleDieScore: face 1 → 100, face 5 → 50, all others → 0
P(face) = weight[face-1] / sum(weights)  — averaged across non-lucky dice
```

The face with the highest `EV` is returned. Three-of-a-kind potential is intentionally ignored to keep the logic simple.

### Setup Screen Constraints

- Total dice always equals 6.
- "Normal" count = `6 − sum(all other types)` — auto-calculated, not manually editable.
- Player picks quantities per type using `−` / `+` buttons.
- Visual summary shows all 6 dice icons at the bottom.

---

## 5. Animation System

### Storage Format

Animations live in `public/animations/{N}d/anim_{N}d_{XXX}.json`:

```json
{
  "diceCount": 3,
  "duration": 2.8,
  "finalFaces": [3, 5, 1],
  "frames": [
    {
      "t": 0.0,
      "dice": [
        { "px": 0.1, "py": 5.0, "pz": -0.3, "qx": 0, "qy": 0, "qz": 0, "qw": 1 }
      ]
    }
  ]
}
```

Target: **3–5 animations per dice count** (1–6 dice) = ~18–30 JSON files.

A `public/animations/manifest.json` lists available files so `animationLibrary.ts` can discover them without directory listing:

```json
{
  "1d": ["anim_1d_001.json", "anim_1d_002.json"],
  "2d": ["anim_2d_001.json"]
}
```

**Fallback:** if no animation exists for a given dice count, search for the nearest smaller count that has animations (e.g., 6d → 5d → … → 1d). If no animation exists at count 1 or none at all, play a simple procedural vertical drop (dev-only fallback, one die falls per position).

### Face-Slot Mapping

The existing `diceLogic/dice.ts` defines `faceOrder = [2, 5, 1, 6, 3, 4]` — this is the authoritative mapping from Three.js material slot index (0–5) to face value. The texture remap in `textureRemap.ts` must use this same mapping.

### Playback Pipeline (per roll)

1. **Determine outcome** — `rollDice()` samples weighted distributions → `desiredFaces: number[]`.
2. **Select animation** — pick random JSON for the correct `diceCount` from the manifest.
3. **Texture remap** — for each die `i`: find which material slot shows `animFinalFaces[i]`, then build a permuted `materials[]` array so that slot now shows `desiredFaces[i]`. All 6 materials are reordered consistently.
4. **Play** — `AnimationPlayer` interpolates position/quaternion per frame (physics disabled). On completion, dice are clickable.

**Texture remap scope:** only the **top face** material matters for game correctness. The other 5 material slots may end up showing arbitrary faces after remapping — this is acceptable because the camera angle and typical die landing positions make side/bottom faces secondary. Die textures must be designed as **rotation-invariant** (pip dots, or centred/symmetric numbers) so the correct face looks right regardless of the die's yaw around the up-axis. The remap does not adjust quaternions.

### Texture Remap Example

```
faceOrder (slot→face): [2, 5, 1, 6, 3, 4]
animFinalFaces:  [3, ...]   // die 0 lands with face 3 up (slot 4)
desiredFaces:    [1, ...]   // we need face 1 up

// slot 4 shows face 3 → must instead show face 1
// slot 2 shows face 1 → must instead show face 3
// swap materials[4] ↔ materials[2]
```

### Animation Studio (`/studio` route — dev only)

- **Left panel:** Three.js canvas + controls (Run / Record / Reset) + dice count selector (1–6)
- **Right panel:** library for the selected count — saved animations with ▶ preview and ✕ delete; empty slots show `+ Record`
- **Progress bars** show completion across all 6 groups
- **Save mechanism:** on clicking "Save," the studio POSTs the JSON to a Vite dev-server plugin endpoint `POST /api/save-animation`. The plugin writes the file to `public/animations/` and updates `manifest.json`. This endpoint is only registered in `vite.config.ts` in dev mode.

---

## 6. State Architecture

Game state is held in a Qwik `useStore` at the app root level and passed to child components via Qwik context (`createContextId`). The store shape:

```ts
interface DiceRollState {
  value: number;       // 1–6, result of last roll; 0 if not yet rolled
  selected: boolean;   // player has clicked to include in scoring this roll
  setAside: boolean;   // committed in a previous re-roll this turn
  scoreContribution: number; // points attributed to this die in its combination
  dieType: DieType;
  meshIndex: number;   // index into the Three.js dice mesh array (0–5); stable for the game session
  // meshIndex also maps to the animation frame's dice[] array when this die is in the active roll
}

interface GameStore {
  screen: 'setup' | 'game' | 'win';
  target: 2000 | 3000 | 4000;
  diceConfig: DieType[];           // length 6, set at setup
  totalScore: number;
  turnScore: number;
  diceState: DiceRollState[];      // length 6
}

// Note: diceLogic/ (dice.ts, diceLogic.ts, settings.ts) is kept for reference only.
// All dice creation, rolling, and modifier logic is reimplemented in src/game/ and src/animation/.
// The /studio route is guarded by `import.meta.env.DEV` — invisible in production builds.
```

Transitions: `SetupScreen` sets `target` and `diceConfig` then sets `screen = 'game'`. `GameScreen` manages turn flow. On win, sets `screen = 'win'`.

---

## 7. File Structure

```
src/
  main.tsx                  ← router (/, /studio) + store provider
  game/
    GameScreen.tsx          ← main game UI (3D left, panel right)
    SetupScreen.tsx         ← goal + dice config
    WinScreen.tsx           ← victory screen
    gameState.ts            ← GameStore, context, transitions
    scoring.ts              ← combination detection + getBestExpectedFace
  animation/
    AnimationPlayer.ts      ← frame interpolation, material restore
    AnimationRecorder.ts    ← captures Cannon-es sim → JSON frames
    textureRemap.ts         ← builds material permutation per die
    animationLibrary.ts     ← fetch + cache via manifest.json
  studio/
    StudioScreen.tsx        ← /studio route
    StudioScene.ts          ← Three.js scene for recording
  scene/
    DiceRenderer.ts         ← create/update dice meshes + materials
    sceneSetup.ts           ← camera, lights, floor, walls
  diceLogic/                ← existing code (keep as-is)

public/
  animations/
    manifest.json
    1d/  anim_1d_001.json … (up to 5)
    2d/  …
    3d/  …
    4d/  …
    5d/  …
    6d/  …
```

---

## 8. UI Layout

### SetupScreen
- Goal selector: 3 cards (2000 / 3000 / 4000), one selected at a time.
- Dice configurator: list of types with `−` / `+` counters; Normal row is read-only showing remainder; total indicator always shows `6 / 6`.
- Summary row of 6 dice icons reflecting current config.
- "Start" button.

### GameScreen
- **Left (flex:1):** Three.js canvas full-height.
  - Top strip inside canvas: set-aside dice (greyed, with point labels). Clears on Hot Dice.
  - Main area: current-roll dice. Selected ones glow. Labels removed after selection.
- **Right (~180px):** Turn score / total score / progress bar → selected combinations list → Roll Again (N dice) button → End Turn (+N) button.
- **On Farkle:** buttons replaced by red warning; after 2s a single "Next Turn →" button appears.
- **On Hot Dice:** set-aside strip clears, 🔥 banner shows briefly, all 6 dice rendered fresh.

### WinScreen
- Displays total score, target reached, and a "Play Again" button that resets to SetupScreen.

---

## 9. Out of Scope

- Multiplayer (any form)
- Procedural animation generation
- Four/five/six-of-a-kind combinations
- Straights 2-3-4-5-6 or 1-2-3-4-5-6
- Leaderboard / save state persistence
- Network error UI (animations fail silently to procedural fallback)
