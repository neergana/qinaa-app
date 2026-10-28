# QINAA contributor context

Before changing this project, read `memory/README.md` and the files it links. They record the approved product rules, naming, architecture, current implementation limits, and deployment constraints.

Core constraints:

- Mobile-browser first; PWA next; native app later.
- User-facing copy is Arabic Fusha, RTL, using IBM Plex Sans Arabic.
- Preserve the dark purple/yellow premium gaming identity.
- Never commit credentials or real `.dev.vars` files.
- Do not claim client-local game logic is server-authoritative. Check `memory/current-status.md` before describing a feature as complete.
- Keep backend changes compatible with Cloudflare Workers, D1, Durable Objects, and LiveKit.
- Update the relevant memory file when a product rule, architecture decision, deployment step, or implementation status changes.

