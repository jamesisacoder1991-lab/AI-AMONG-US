# AI-AMONG-US

A polished **AI vs AI Among Us-style spectator simulator**.

This project now has **two ways to run**:
- **Browser spectator mode** (original): visual map + animations + controls.
- **Python CLI mode** (new): terminal simulation for quick reproducible runs.

## Why JavaScript files still exist
The files `index.html`, `styles.css`, and `script.js` are the **web spectator game**.

So yes, JavaScript is still here on purpose:
- `script.js` runs the full browser simulation loop and animations.
- `index.html` is the UI shell.
- `styles.css` is the visual styling.

The Python file (`among_us_sim.py`) is an **additional** mode, not a replacement for the browser experience.

## First test (recommended)
If you want the best first experience, use the browser mode:

```bash
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000`

### Controls while watching
- `Arrow Left / Arrow Right`: switch watched AI.
- `Space`: pause/resume.
- `N`: single-step one tick.
- `Pause` button: pause/resume.
- `Step` button: one tick.
- `Restart` button: fresh match.
- `Speed` slider: simulation tick speed.

## Python CLI mode (optional)
Run the terminal simulation:

```bash
python3 among_us_sim.py
```

Example deterministic run:

```bash
python3 among_us_sim.py --seed 42 --rounds 300 --show-log
```

Options:
- `--seed`: deterministic run for reproducible matches.
- `--rounds`: max simulation rounds.
- `--quiet`: hide per-round summary lines.
- `--show-log`: print event log after match end.
