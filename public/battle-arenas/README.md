# Elemental Battle Arenas

Generated using the built-in imagegen tool for NEXORA TCG. The five WebP files
are immersive environment backgrounds, not interface mockups. Assignment uses
the shared room code and deck-start timestamp; it has no effect on card rules.
The current generated assets are 1672 x 941 pixels, encoded without upscaling.
The 4K sizes below are specifications for future replacement artwork.

## Replacement Artwork

- Desktop landscape: 3840 x 2160 pixels (16:9), minimum 2560 x 1440.
- Mobile also uses the landscape artwork; the battle shell rotates in portrait.
- Keep the central 65% clear for cards, health bars and effects.
- Place distinctive terrain and architecture near the outside edges.
- Keep major landmarks in the central 60% horizontally for narrow-screen crops.
- Do not bake text, cards, logos, buttons or HUD into the artwork.
- Prefer WebP, under 1 MB per background, preserving sharp terrain detail.
- Replace fire.webp, water.webp, earth.webp, wood.webp or gold.webp at these paths.

## Prompt Set

All five use a wide 16:9, raised three-quarter overhead view of a huge open
dueling courtyard. The central 65% is level and quiet, with crisp lighting,
premium painterly-realistic fantasy materials, no text/HUD/cards/characters,
no glowing orbs, no bokeh, and balanced space for both teams.

- Fire: basalt courtyard beneath a volcanic caldera, lava perimeter channels,
  obsidian pillars, warm daylight, luminous lava against charcoal stone.
- Water: pale-stone island temple, turquoise ocean, waterfalls, sea arches,
  silver limestone and crisp sunlight.
- Earth: grey-stone mountain courtyard, layered cliffs, crystalline canyon
  spires, carved guardian pillars, emerald minerals and afternoon light.
- Wood: ancient forest courtyard, moss and roots around the edges, towering
  trees, turquoise streams, stone gateways and clear midday light.
- Gold: gilded sky citadel, burnished gates, metal statues, brass and ivory
  architecture, cyan sky and crisp reflections.

Original generation PNG files are retained in artifacts/triad-arena-source
locally. scripts/prepare-triad-arenas.cjs performs WebP encoding without
altering composition or pixel dimensions.
