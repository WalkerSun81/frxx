# Visual QA — reference alignment pass

- Source visual truth:
  - `E:\A\FRXX\参考项目\微信图片_20260721152636_409_144.jpg` (角色)
  - `E:\A\FRXX\参考项目\微信图片_20260721152645_421_144.jpg` (储物袋)
  - `E:\A\FRXX\参考项目\微信图片_20260721152650_427_144.jpg` (战斗)
- Browser-rendered implementation:
  - `E:\A\FRXX\design-qa-role-final.png`
  - `E:\A\FRXX\design-qa-bag.png`
  - `E:\A\FRXX\design-qa-battle-final.png`
- Combined comparison evidence:
  - `E:\A\FRXX\design-qa-role-comparison.png`
  - `E:\A\FRXX\design-qa-bag-comparison.png`
  - `E:\A\FRXX\design-qa-battle-comparison.png`
- Viewport: 390 × 844; responsive overflow checks also completed at 320 × 844 and 450 × 844.
- State: existing role loaded; role overview stable; storage bag empty state; 青云村外第3层 selected; actual challenge victory verified separately.

## Findings

No actionable P0/P1/P2 differences remain for the requested scope. The excluded “更多” entry and its sub-features are intentionally absent.

## Full-view comparison evidence

- Role: both views use a compact identity card, HP/MP bands, gold/jade cultivation hierarchy, formula chips, attribute groups and persistent bottom navigation. The implementation keeps all primary actions above the fold and moves spiritual-root/constellation details below the attributes instead of compressing unreadable data into the first viewport.
- Storage: both views use a titled inventory state, category navigation, item filters, a large empty-state region and persistent navigation. The implementation intentionally groups equipment, bag, life skills and market into four working sub-tabs.
- Battle: both views use a landscape ink-paint arena before the map path, opposing unit states, a gold primary action and battle controls. The implementation preserves the reference's battle-first hierarchy while using the server's actual round result and progression data.

## Focused comparison evidence

- Fonts and typography: display labels use KaiTi/STKaiti fallbacks with gold emphasis; body and numeric UI use compact system sans-serif. Text remained readable at 320 px without truncating the main actions.
- Spacing and layout rhythm: 12 px page margins, 7–12 px card gaps, compact section dividers and fixed bottom navigation match the reference density. No horizontal overflow at 320, 390 or 450 px.
- Colors and tokens: near-black indigo background, muted gold primary actions, jade active states, blue/red health semantics and subdued disabled states are consistent across all four requested tabs.
- Image quality and assets: the celestial shell and battle valley use local raster assets. Navigation and entity symbols use a locally bundled Remix Icon font rather than emoji, handcrafted SVG or CSS drawings. The target's exact character portrait is not reused because there is no combat-entity art mapping in the current data model; this is classified as follow-up polish rather than a broken state.
- Copy and content: all labels are standalone game copy, dynamic values come from live APIs, and locked sect/map states name the required realm.
- Accessibility: primary controls are semantic buttons, active/disabled states are visible, persistent navigation targets are at least 44 px high, and `prefers-reduced-motion` disables non-essential animation.

## Comparison history

1. Earlier battle implementation showed text-only units with weak post-defeat contrast.
   - Fix: added locally bundled icon-library unit markers, stronger opposing colors and a readable defeated state.
   - Post-fix evidence: `design-qa-battle-comparison.png` shows both combatants legibly over the arena.
2. Earlier navigation exposed separate Equipment and Shop tabs and lacked Sect.
   - Fix: unified navigation as Role / Storage / Battle / Sect; moved Market under Storage; added Sect influence map and realm-driven lock states.
   - Post-fix evidence: all four tabs switched successfully; no `tabMore`/`tabShop` route remains.
3. Earlier role page lacked HP/MP summary, cultivation-factor breakdown and constellation overview.
   - Fix: added live vital bars, factor chips, root/destiny grouping, source modal and stronger identity hierarchy.
   - Post-fix evidence: `design-qa-role-comparison.png` at 390 × 844.

## Primary interactions tested

- Role refresh, manual cultivation, automatic tick display and attribute-source modal wiring.
- Storage Equipment / Bag / Life / Market sub-tab switching and category filtering.
- Real map selection, real challenge victory, HP/damage/reward/log updates, 1×/2× controls and reset.
- Sect lock calculation and unlocked node detail switching.
- Browser console errors/warnings: none.
- Automated API suite: all phases passed.

## Follow-up polish

- [P3] Add dedicated cultivator and monster portrait packs when the backend gains stable avatar/monster-art identifiers.
- [P3] Add more item-type and quality filters when the equipment model stores an immutable original slot category.

final result: passed
