<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Blaze AI single-brain rule

Blaze AI in the NEXORA TCG app, the floating chat, `/blaze-embed`, and the main website iframe must always use the same brain, data, prompts, and API route. Do not create or maintain a separate AI path that can drift ahead or fall behind. Any upgrade to Blaze AI knowledge, prompt behavior, card data, search behavior, or response logic must apply to every Blaze AI surface together.
