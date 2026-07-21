# Visual QA — first interface alignment pass

- Source visual truth: `E:\A\FRXX\参考项目\微信图片_20260721152650_427_144.jpg`
- Implementation screenshot: `E:\A\FRXX\design-qa-battle.png`
- Viewport: 390 × 844
- State: 青云村外已选择、战斗入口待挑战；真实挑战链路已另行验证胜利、伤害飘字、血条与战报。

## Full-view comparison evidence

The source and the browser-rendered implementation were opened together in the same review pass. Both use a dark mobile xianxia shell, a compact header/resources band, a landscape battle stage, a gold primary action, and a persistent bottom navigation. The implementation originally placed the map above the battle stage; this was corrected so that, after selecting a map, the stage and action remain above the map path as in the source's battle-first hierarchy.

## Focused comparison

- Battle stage: the original, generated ink-paint valley is correctly cropped into the arena and preserves a readable central play area.
- Interaction state: selecting a map exposes the arena; a real challenge updates reward values and plays hit, floating-damage, health-bar, defeat, and log states. Browser console: no errors or warnings after the fix.
- Typography: the implementation keeps a gold serif-like display hierarchy for realm and section headings, with compact sans-serif detail text matching the reference's density.
- Spacing/layout: the 390 px view has no horizontal overflow; the persistent navigation remains visible without masking the primary action.
- Colors/tokens: indigo/near-black space background, gold emphasis, jade selection state, and quality colors are consistently applied.
- Assets: the arena and celestial background are original generated images, not copied reference assets. Character/enemy portraits are deliberately not invented yet because the current game data model has no avatar or monster-art mapping.

## Findings

No actionable P0/P1/P2 visual defects remain in this first alignment pass.

## Follow-up polish

- [P3] Add a configurable avatar/monster-art mapping when combat entities gain corresponding asset data; this will replace the current readable unit name cards.
- [P3] Add dedicated icon assets for the bottom navigation after the target feature set settles.

## Comparison history

1. Battle stage initially appeared below the complete map path, changing the source's battle-first hierarchy.
2. The battle block was moved before the map list when a map is selected.
3. The revised 390 × 844 capture shows the landscape stage, primary action, and selected map node in order. Console check passed with no errors or warnings.

Primary interactions tested: role creation, element reroll and confirmation, constellation reroll and confirmation, map selection, actual battle victory, resource refresh, and bottom-tab switching.

final result: passed
