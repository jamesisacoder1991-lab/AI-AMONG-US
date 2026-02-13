# AI-AMONG-US

A polished **AI vs AI Among Us-style spectator simulator**.

## What was improved for your first test
- Bigger Skeld-style room map with smoother movement between rooms.
- Better pathfinding (AI heads to target rooms intelligently, not just random links).
- Added adjustable sim speed slider for quick/slow spectating.
- Settings persist in local storage (speed + API config) for easier repeated testing.
- Vent network used by impostors for sneaky repositioning.
- Real room-based task lists per crewmate with visible global progress.
- Stronger memory and route history so bots remember where they have been all game.
- Better sabotage pressure and task-vs-sabotage decision making.
- Better meetings: statements, distrust/belief updates, alibi cross-checking, voting, ejections.
- Added emergency meeting cooldown to prevent spammy instant chains.
- Shared API key + per-bot override support for LLM-powered meeting dialogue.

## Controls
- `Arrow Left / Arrow Right`: switch watched AI.
- `Pause`: pause/resume simulation.
- `Step`: advance one tick.
- `Space`: pause/resume hotkey.
- `N`: single-step hotkey.
- `Restart`: start a fresh match.

## LLM keys
- Use one **Shared API Key** for all bots, or add per-bot overrides.
- If no key is set for a bot, that bot uses local fallback strategy.

## Run
```bash
python3 -m http.server 8000
```
Open `http://localhost:8000`.
