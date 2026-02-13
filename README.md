# AI-AMONG-US

You can now run this project in **pure Python with animation** (no JavaScript runtime needed).

## Best mode for your first test (Python animated GUI)
Run:

```bash
python3 among_us_sim.py --gui
```

Optional:

```bash
python3 among_us_sim.py --gui --seed 42 --tick-ms 600
```

### GUI controls
- `Left / Right`: switch watched AI.
- `Space`: pause/resume.
- `N`: single-step one tick.
- Buttons: Pause/Resume, Step, Restart.
- Slider: simulation speed (tick ms).

## Python terminal mode (no GUI)
If you just want quick simulation output:

```bash
python3 among_us_sim.py --seed 42 --rounds 300 --show-log
```

Options:
- `--seed`: deterministic run.
- `--rounds`: max rounds.
- `--quiet`: hide per-round lines.
- `--show-log`: print event log.

## About the old JavaScript files
`index.html`, `script.js`, and `styles.css` are from the original browser version.
They are now optional legacy files; the new recommended first-test path is `python3 among_us_sim.py --gui`.
