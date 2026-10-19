<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Game Display Standard

- Every game screen is landscape-only on desktop, mobile and tablet. Do not introduce portrait-specific game layouts or stacked mobile-only navigation.
- Reuse desktop scene composition with a fitted landscape canvas. If a browser refuses orientation locking, require rotation before allowing game interaction.
- Keep My Collection controls minimal: search, primary filters, and pagination; put secondary options in one filter panel. Preserve live inventory and deck behavior.
- Battlefield and deck-selection card/skill details in TRIAD and PENTAD must reuse `BattleCardInspector` and its shared stylesheet. Position below the actual player-profile frames and window controls, within the landscape viewport. Use black backgrounds at 80% opacity (20% transparent), never faded text; scroll long descriptions internally. Do not fork per-mode inspector layouts.

## Blaze AI single-brain rule

Blaze AI in the NEXORA TCG app, the floating chat, `/blaze-embed`, and the main website iframe must always use the same brain, data, prompts, and API route. Do not create or maintain a separate AI path that can drift ahead or fall behind. Any upgrade to Blaze AI knowledge, prompt behavior, card data, search behavior, or response logic must apply to every Blaze AI surface together.

## Game Resource Installation Standard

- `public/game-resource-policy.json` is the single resource registry policy. `public/game-release.json` is generated, never hand-maintained.
- Put ALL new game-owned static resources under `public/game-assets/` (nested directories allowed). This covers images/PNG/UI, fonts, audio, video, animation data, models, shaders, WASM, and future binary formats, not just cards. Legacy roots in the policy are scanned recursively too.
- Use URL-safe ASCII filenames. Keep master/source art outside shipped resource roots (or use the registry's design-source exclusions). Do not hotlink static game UI to third-party hosts.
- Every resource must enter the same manifest, SHA-256 verification, differential patcher, installed desktop pack, and service-worker local-first path. Never create a separate CDN-only or image-optimization-only asset path for installed games. Use prebuilt derivatives for thumbnails.
- The release builder audits static resource references and imported game modules. Missing files must fail the build; do not silence the audit or add per-component download systems. Dynamic filenames must remain within registered resource roots.
- API responses, credentials, wallets, inventory ownership, match state, chat, and player uploads are LIVE data, not immutable installer resources. Never put them in resource packs or use static asset caching for them.
- Check offline resource tests and native pack tests after resource-pipeline changes. Do not promise zero latency or predecode every full-resolution asset: use bounded-memory preparation and scene-specific warmup.
- New/changed resources ship through initial installation or verified versioned patches before their scene is marked ready. Reuse unchanged verified files. Hosting and native installer publication are separate from deploying web code.

