#!/usr/bin/env python3
"""AI Among Us simulator in Python.

Modes:
- Headless CLI simulation (default): fast terminal summaries.
- Animated GUI simulation (--gui): tkinter canvas spectator mode.
"""

from __future__ import annotations

import argparse
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

ROOM_LAYOUT: Dict[str, Tuple[int, int, int, int]] = {
    "cafeteria": (450, 40, 300, 160),
    "weapons": (790, 70, 180, 130),
    "o2": (780, 240, 150, 110),
    "navigation": (960, 220, 180, 150),
    "shields": (780, 390, 210, 120),
    "communications": (620, 500, 160, 110),
    "storage": (430, 430, 230, 170),
    "admin": (450, 240, 180, 130),
    "electrical": (240, 430, 170, 130),
    "lower_engine": (70, 430, 160, 130),
    "reactor": (40, 250, 180, 130),
    "security": (230, 260, 150, 120),
    "medbay": (300, 110, 140, 110),
    "upper_engine": (110, 90, 180, 130),
}

ROOM_LINKS: Dict[str, List[str]] = {
    "cafeteria": ["upper_engine", "medbay", "weapons", "admin"],
    "weapons": ["cafeteria", "o2", "navigation"],
    "o2": ["weapons", "navigation", "shields"],
    "navigation": ["weapons", "o2", "shields"],
    "shields": ["o2", "navigation", "communications", "storage"],
    "communications": ["shields", "storage"],
    "storage": ["admin", "electrical", "communications", "shields", "lower_engine"],
    "admin": ["cafeteria", "storage"],
    "electrical": ["storage", "lower_engine", "security"],
    "lower_engine": ["electrical", "reactor", "storage"],
    "reactor": ["security", "lower_engine", "upper_engine"],
    "security": ["reactor", "electrical", "medbay"],
    "medbay": ["cafeteria", "security", "upper_engine"],
    "upper_engine": ["reactor", "medbay", "cafeteria"],
}

ROOM_NAMES = {
    "cafeteria": "Cafeteria", "weapons": "Weapons", "o2": "O2", "navigation": "Navigation",
    "shields": "Shields", "communications": "Comms", "storage": "Storage", "admin": "Admin",
    "electrical": "Electrical", "lower_engine": "Lower Engine", "reactor": "Reactor",
    "security": "Security", "medbay": "MedBay", "upper_engine": "Upper Engine",
}

ROOM_TASKS: Dict[str, List[str]] = {
    "cafeteria": ["Fix Wiring", "Empty Garbage"],
    "weapons": ["Clear Asteroids", "Align Scope"],
    "o2": ["Clean O2 Filter", "Fix Wiring"],
    "navigation": ["Chart Course", "Stabilize Steering"],
    "shields": ["Prime Shields", "Fix Wiring"],
    "communications": ["Download Data", "Upload Data"],
    "storage": ["Fuel Engines", "Empty Garbage"],
    "admin": ["Swipe Card", "Upload Data"],
    "electrical": ["Calibrate Distributor", "Divert Power", "Fix Wiring"],
    "lower_engine": ["Align Engine Output", "Fuel Engines"],
    "reactor": ["Start Reactor", "Unlock Manifolds"],
    "security": ["Monitor Cameras", "Fix Wiring"],
    "medbay": ["Submit Scan", "Inspect Sample"],
    "upper_engine": ["Align Engine Output", "Fuel Engines"],
}

NAMES = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Cyan", "Pink", "Lime", "Brown"]
COLORS = ["#c63c3c", "#3b8eff", "#33cc66", "#ffd43b", "#7d54ff", "#f2933f", "#5df2ff", "#ff8dd8", "#9cff57", "#8f5b3c"]


@dataclass
class Task:
    room: str
    name: str
    done: bool = False


@dataclass
class Player:
    id: int
    name: str
    color: str
    impostor: bool = False
    alive: bool = True
    room: str = "cafeteria"
    kill_cooldown: int = 0
    emergency_left: int = 1
    tasks: List[Task] = field(default_factory=list)
    route: List[str] = field(default_factory=list)


@dataclass
class GameState:
    players: List[Player]
    round_num: int = 1
    bodies: List[Tuple[int, str]] = field(default_factory=list)  # (victim_id, room)
    logs: List[str] = field(default_factory=list)
    winner: Optional[str] = None
    reason: Optional[str] = None


class AmongUsModel:
    def __init__(self, seed: Optional[int] = None):
        self.rng = random.Random(seed)
        self.state = self._setup()

    def _rand_room(self) -> str:
        return self.rng.choice(list(ROOM_LINKS.keys()))

    def _make_tasks(self) -> List[Task]:
        return [Task(room := self._rand_room(), self.rng.choice(ROOM_TASKS[room])) for _ in range(6)]

    def _setup(self) -> GameState:
        players = [Player(id=i, name=n, color=COLORS[i], room=self._rand_room(), tasks=self._make_tasks()) for i, n in enumerate(NAMES)]
        for p in self.rng.sample(players, 2):
            p.impostor = True
        return GameState(players=players, logs=["Game started."])

    def alive_players(self) -> List[Player]:
        return [p for p in self.state.players if p.alive]

    def alive_crew(self) -> List[Player]:
        return [p for p in self.state.players if p.alive and not p.impostor]

    def alive_impostors(self) -> List[Player]:
        return [p for p in self.state.players if p.alive and p.impostor]

    def _move_player(self, p: Player) -> None:
        p.room = self.rng.choice(ROOM_LINKS[p.room])
        p.route.append(p.room)
        p.route = p.route[-30:]

    def _do_crew_action(self, p: Player) -> None:
        same_room_tasks = [t for t in p.tasks if not t.done and t.room == p.room]
        if same_room_tasks and self.rng.random() < 0.68:
            t = self.rng.choice(same_room_tasks)
            t.done = True
            self.state.logs.insert(0, f"R{self.state.round_num}: {p.name} completed {t.name} in {ROOM_NAMES[p.room]}.")

    def _do_impostor_action(self, p: Player) -> None:
        if p.kill_cooldown > 0:
            p.kill_cooldown -= 1
            return
        victims = [x for x in self.alive_crew() if x.room == p.room and x.id != p.id]
        if victims and self.rng.random() < 0.42:
            victim = self.rng.choice(victims)
            victim.alive = False
            p.kill_cooldown = 3
            self.state.bodies.append((victim.id, p.room))
            self.state.logs.insert(0, f"R{self.state.round_num}: {p.name} eliminated {victim.name} in {ROOM_NAMES[p.room]}.")

    def _meeting(self, reason: str) -> None:
        alive = self.alive_players()
        if len(alive) <= 2:
            return
        votes: Dict[str, int] = {"skip": 0}
        for p in alive:
            votes[p.name] = 0

        for voter in alive:
            if self.rng.random() < 0.22:
                votes["skip"] += 1
            else:
                choices = [p for p in alive if p.id != voter.id]
                target = self.rng.choice(choices)
                votes[target.name] += 1

        target_name, count = max(votes.items(), key=lambda kv: kv[1])
        if target_name != "skip" and count >= 2:
            out = next(p for p in alive if p.name == target_name)
            out.alive = False
            self.state.logs.insert(0, f"R{self.state.round_num}: Meeting ({reason}) -> {out.name} ejected ({'Impostor' if out.impostor else 'Crewmate'}).")
        else:
            self.state.logs.insert(0, f"R{self.state.round_num}: Meeting ({reason}) -> no ejection.")

        self.state.bodies.clear()

    def _maybe_report(self) -> None:
        if not self.state.bodies:
            return
        victim_id, room = self.state.bodies[0]
        reporters = [p for p in self.alive_players() if p.room == room]
        if reporters and self.rng.random() < 0.52:
            r = self.rng.choice(reporters)
            victim = self.state.players[victim_id]
            self.state.logs.insert(0, f"R{self.state.round_num}: {r.name} reported {victim.name} in {ROOM_NAMES[room]}.")
            self._meeting("Body reported")

    def task_progress(self) -> Tuple[int, int]:
        all_tasks = [t for p in self.state.players if not p.impostor for t in p.tasks]
        done = sum(1 for t in all_tasks if t.done)
        return done, len(all_tasks)

    def win_state(self) -> Optional[Tuple[str, str]]:
        crew, imps = len(self.alive_crew()), len(self.alive_impostors())
        if imps == 0:
            return "Crewmates", "All impostors removed"
        if imps >= crew:
            return "Impostors", "Parity reached"
        done, total = self.task_progress()
        if done == total:
            return "Crewmates", "All tasks completed"
        return None

    def tick(self) -> None:
        if self.state.winner:
            return
        self.state.round_num += 1
        for p in list(self.alive_players()):
            self._move_player(p)
            if p.impostor:
                self._do_impostor_action(p)
            else:
                self._do_crew_action(p)
        self._maybe_report()

        result = self.win_state()
        if result:
            self.state.winner, self.state.reason = result
            self.state.logs.insert(0, f"R{self.state.round_num}: {self.state.winner} win ({self.state.reason}).")


class AmongUsGui:
    def __init__(self, seed: Optional[int] = None, tick_ms: int = 700):
        import tkinter as tk

        self.tk = tk
        self.model = AmongUsModel(seed=seed)
        self.root = tk.Tk()
        self.root.title("AI Among Us Simulator (Python GUI)")
        self.tick_ms = tick_ms
        self.paused = False
        self.watch_index = 0
        self.last_tick_t = 0.0

        self.canvas = tk.Canvas(self.root, width=1200, height=700, bg="#08132a", highlightthickness=0)
        self.canvas.grid(row=0, column=0, rowspan=8, padx=8, pady=8)

        self.info = tk.StringVar(value="")
        self.watch = tk.StringVar(value="")
        self.progress = tk.StringVar(value="")
        tk.Label(self.root, textvariable=self.info, justify="left", anchor="w").grid(row=0, column=1, sticky="w")
        tk.Label(self.root, textvariable=self.watch, justify="left", anchor="w").grid(row=1, column=1, sticky="w")
        tk.Label(self.root, textvariable=self.progress, justify="left", anchor="w").grid(row=2, column=1, sticky="w")

        btn_frame = tk.Frame(self.root)
        btn_frame.grid(row=3, column=1, sticky="w", pady=6)
        tk.Button(btn_frame, text="Pause/Resume", command=self.toggle_pause).pack(side="left", padx=3)
        tk.Button(btn_frame, text="Step", command=self.step_once).pack(side="left", padx=3)
        tk.Button(btn_frame, text="Restart", command=self.restart).pack(side="left", padx=3)

        self.speed = tk.Scale(self.root, from_=250, to=1400, orient="horizontal", label="Tick ms", command=self._set_speed)
        self.speed.set(tick_ms)
        self.speed.grid(row=4, column=1, sticky="we")

        self.log = tk.Listbox(self.root, width=58, height=18)
        self.log.grid(row=5, column=1, rowspan=3, sticky="nsew", padx=6, pady=6)

        self.root.bind("<Left>", lambda _e: self._watch_delta(-1))
        self.root.bind("<Right>", lambda _e: self._watch_delta(1))
        self.root.bind("<space>", lambda _e: self.toggle_pause())
        self.root.bind("n", lambda _e: self.step_once())

        self.render_positions: Dict[int, Tuple[float, float]] = {}
        self.target_positions: Dict[int, Tuple[float, float]] = {}
        self._sync_targets(initial=True)

    def _set_speed(self, value: str) -> None:
        self.tick_ms = int(float(value))

    def _watch_delta(self, d: int) -> None:
        total = len(self.model.state.players)
        self.watch_index = (self.watch_index + d) % total

    def toggle_pause(self) -> None:
        self.paused = not self.paused

    def step_once(self) -> None:
        if self.model.state.winner:
            return
        self.model.tick()
        self._sync_targets()
        self._refresh_log()

    def restart(self) -> None:
        seed = None
        self.model = AmongUsModel(seed=seed)
        self.watch_index = 0
        self.paused = False
        self._sync_targets(initial=True)
        self._refresh_log()

    def _refresh_log(self) -> None:
        self.log.delete(0, self.tk.END)
        for line in self.model.state.logs[:120]:
            self.log.insert(self.tk.END, line)

    def _room_slots(self) -> Dict[str, List[Player]]:
        slots = {rid: [] for rid in ROOM_LAYOUT}
        for p in sorted(self.model.state.players, key=lambda x: (x.room, not x.alive, x.id)):
            slots[p.room].append(p)
        return slots

    def _sync_targets(self, initial: bool = False) -> None:
        slots = self._room_slots()
        for room, plist in slots.items():
            x, y, _w, _h = ROOM_LAYOUT[room]
            for idx, p in enumerate(plist):
                tx = x + 30 + (idx % 5) * 30
                ty = y + 40 + (idx // 5) * 46
                self.target_positions[p.id] = (tx, ty)
                if initial or p.id not in self.render_positions:
                    self.render_positions[p.id] = (tx, ty)

    def _interpolate(self) -> None:
        factor = min(1.0, 16.0 / max(80.0, float(self.tick_ms)))
        for p in self.model.state.players:
            sx, sy = self.render_positions[p.id]
            tx, ty = self.target_positions[p.id]
            self.render_positions[p.id] = (sx + (tx - sx) * factor, sy + (ty - sy) * factor)

    def _draw_map(self) -> None:
        c = self.canvas
        c.delete("all")

        for room, links in ROOM_LINKS.items():
            x1, y1, w1, h1 = ROOM_LAYOUT[room]
            cx1, cy1 = x1 + w1 / 2, y1 + h1 / 2
            for to in links:
                if room > to:
                    continue
                x2, y2, w2, h2 = ROOM_LAYOUT[to]
                cx2, cy2 = x2 + w2 / 2, y2 + h2 / 2
                c.create_line(cx1, cy1, cx2, cy2, fill="#2d548f", width=3)

        for room, (x, y, w, h) in ROOM_LAYOUT.items():
            c.create_rectangle(x, y, x + w, y + h, fill="#16284d", outline="#5d8ad4", width=2)
            c.create_text(x + 9, y + 14, text=ROOM_NAMES[room], fill="#d2e2ff", anchor="w")

        for victim_id, room in self.model.state.bodies:
            x, y, w, h = ROOM_LAYOUT[room]
            cx, cy = x + w / 2, y + h / 2
            c.create_rectangle(cx - 16, cy + 9, cx + 16, cy + 16, fill="#aa2b2b", outline="")
            c.create_text(cx, cy - 5, text=f"{self.model.state.players[victim_id].name}", fill="#ffaaaa")

    def _draw_players(self) -> None:
        c = self.canvas
        watched = self.model.state.players[self.watch_index]
        for p in self.model.state.players:
            x, y = self.render_positions[p.id]
            dead = not p.alive
            if p.id == watched.id:
                c.create_oval(x - 24, y - 24, x + 24, y + 24, fill="#2e6f95", outline="")
            if dead:
                c.create_rectangle(x - 14, y + 12, x + 14, y + 20, fill="#aa2b2b", outline="")
            else:
                c.create_oval(x - 14, y - 18, x + 14, y + 18, fill=p.color, outline="")
                c.create_oval(x + 0, y - 13, x + 14, y - 3, fill="#dff6ff", outline="")
                c.create_rectangle(x - 11, y + 13, x - 3, y + 20, fill=p.color, outline="")
                c.create_rectangle(x + 3, y + 13, x + 11, y + 20, fill=p.color, outline="")
            c.create_text(x, y + 30, text=p.name, fill="#f2f6ff")

    def _draw_watch_path(self) -> None:
        watched = self.model.state.players[self.watch_index]
        if not watched.alive:
            return
        path = [watched.room]
        if watched.impostor:
            crew = [p for p in self.model.alive_crew()]
            if crew:
                target = min(crew, key=lambda c: len(_shortest_path(watched.room, c.room)))
                path = _shortest_path(watched.room, target.room)
        else:
            nxt = next((t.room for t in watched.tasks if not t.done), None)
            if nxt:
                path = _shortest_path(watched.room, nxt)

        if len(path) <= 1:
            return
        points: List[float] = []
        for room in path:
            x, y, w, h = ROOM_LAYOUT[room]
            points.extend([x + w / 2, y + h / 2])
        self.canvas.create_line(*points, fill="#72dcff" if not watched.impostor else "#ff7e7e", width=3, dash=(7, 7))

    def _update_labels(self) -> None:
        s = self.model.state
        done, total = self.model.task_progress()
        watched = s.players[self.watch_index]
        self.info.set(
            f"Round: {s.round_num} | Alive: {len(self.model.alive_players())}/{len(s.players)}\n"
            f"Crew/Impostor: {len(self.model.alive_crew())}/{len(self.model.alive_impostors())} | "
            f"Tasks: {done}/{total}"
            + (f"\nWinner: {s.winner} ({s.reason})" if s.winner else "")
        )
        goal = "Hunt" if watched.impostor else (next((t.room for t in watched.tasks if not t.done), "all done"))
        self.watch.set(
            f"Watching: {watched.name} ({'alive' if watched.alive else 'dead'})\n"
            f"Role(debug): {'Impostor' if watched.impostor else 'Crewmate'} | Room: {ROOM_NAMES[watched.room]}\n"
            f"Goal: {goal}"
        )
        self.progress.set("Controls: Left/Right switch • Space pause • N step • Slider speed")

    def _frame(self) -> None:
        if not self.paused and not self.model.state.winner:
            # run game tick at configured cadence
            self.last_tick_t += 16.0
            if self.last_tick_t >= self.tick_ms:
                self.last_tick_t = 0.0
                self.model.tick()
                self._sync_targets()
                self._refresh_log()

        self._interpolate()
        self._draw_map()
        self._draw_watch_path()
        self._draw_players()
        self._update_labels()
        self.root.after(16, self._frame)

    def run(self) -> None:
        self._refresh_log()
        self._frame()
        self.root.mainloop()


def _shortest_path(start: str, goal: str) -> List[str]:
    if start == goal:
        return [start]
    q: List[List[str]] = [[start]]
    seen = {start}
    while q:
        path = q.pop(0)
        cur = path[-1]
        for nxt in ROOM_LINKS[cur]:
            if nxt in seen:
                continue
            p2 = path + [nxt]
            if nxt == goal:
                return p2
            seen.add(nxt)
            q.append(p2)
    return [start]


def run_headless(seed: Optional[int], rounds: int, quiet: bool, show_log: bool) -> None:
    sim = AmongUsModel(seed=seed)
    while sim.state.round_num < rounds and not sim.state.winner:
        sim.tick()
        if not quiet:
            done, total = sim.task_progress()
            print(
                f"R{sim.state.round_num:03d} | alive={len(sim.alive_players())} "
                f"crew/impostor={len(sim.alive_crew())}/{len(sim.alive_impostors())} tasks={done}/{total}"
            )

    if sim.state.winner:
        print(f"{sim.state.winner} win ({sim.state.reason})")
    else:
        print("No winner before round limit.")

    if show_log:
        print("\nEvent log:")
        for line in reversed(sim.state.logs[:80]):
            print(f"- {line}")


def main() -> None:
    parser = argparse.ArgumentParser(description="AI Among Us simulator (Python)")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--rounds", type=int, default=220)
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--show-log", action="store_true")
    parser.add_argument("--gui", action="store_true", help="Run animated tkinter spectator mode")
    parser.add_argument("--tick-ms", type=int, default=700, help="GUI sim speed in milliseconds per turn")
    args = parser.parse_args()

    if args.gui:
        try:
            gui = AmongUsGui(seed=args.seed, tick_ms=args.tick_ms)
            gui.run()
        except Exception as exc:  # includes no-display environments
            print(f"GUI mode failed: {exc}")
            print("Tip: run headless mode without --gui if no desktop display is available.")
    else:
        run_headless(seed=args.seed, rounds=args.rounds, quiet=args.quiet, show_log=args.show_log)


if __name__ == "__main__":
    main()
