#!/usr/bin/env python3
"""AI Among Us simulator (Python edition).

A terminal-based spectator simulation inspired by the browser version in this repo.
"""

from __future__ import annotations

import argparse
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional

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

NAMES = [
    "Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Cyan", "Pink", "Lime", "Brown"
]


@dataclass
class Task:
    room: str
    name: str
    done: bool = False


@dataclass
class Player:
    name: str
    impostor: bool = False
    alive: bool = True
    room: str = "cafeteria"
    kill_cooldown: int = 0
    emergency_left: int = 1
    tasks: List[Task] = field(default_factory=list)
    suspicion: Dict[str, int] = field(default_factory=dict)


@dataclass
class GameState:
    players: List[Player]
    round_num: int = 1
    bodies: List[tuple[str, str]] = field(default_factory=list)  # (player, room)
    logs: List[str] = field(default_factory=list)


class AmongUsSim:
    def __init__(self, seed: Optional[int] = None):
        self.rng = random.Random(seed)
        self.state = self._setup()

    def _rand_room(self) -> str:
        return self.rng.choice(list(ROOM_LINKS.keys()))

    def _make_tasks(self) -> List[Task]:
        tasks: List[Task] = []
        for _ in range(6):
            room = self._rand_room()
            tasks.append(Task(room=room, name=self.rng.choice(ROOM_TASKS[room])))
        return tasks

    def _setup(self) -> GameState:
        players = [
            Player(name=n, room=self._rand_room(), tasks=self._make_tasks())
            for n in NAMES
        ]
        imps = self.rng.sample(players, 2)
        for p in imps:
            p.impostor = True
        return GameState(players=players, logs=["Game started."])

    def alive_players(self) -> List[Player]:
        return [p for p in self.state.players if p.alive]

    def alive_crew(self) -> List[Player]:
        return [p for p in self.state.players if p.alive and not p.impostor]

    def alive_impostors(self) -> List[Player]:
        return [p for p in self.state.players if p.alive and p.impostor]

    def move_player(self, p: Player) -> None:
        p.room = self.rng.choice(ROOM_LINKS[p.room])

    def do_crew_action(self, p: Player) -> None:
        unfinished = [t for t in p.tasks if not t.done and t.room == p.room]
        if unfinished and self.rng.random() < 0.7:
            task = self.rng.choice(unfinished)
            task.done = True
            self.state.logs.append(f"{p.name} completed {task.name} in {p.room}.")

    def do_impostor_action(self, p: Player) -> None:
        if p.kill_cooldown > 0:
            p.kill_cooldown -= 1
            return

        victims = [x for x in self.alive_players() if x.name != p.name and x.room == p.room and not x.impostor]
        if victims and self.rng.random() < 0.45:
            victim = self.rng.choice(victims)
            victim.alive = False
            p.kill_cooldown = 3
            self.state.bodies.append((victim.name, p.room))
            self.state.logs.append(f"{p.name} eliminated {victim.name} in {p.room}.")

    def maybe_report(self) -> None:
        if not self.state.bodies:
            return
        name, room = self.state.bodies[0]
        reporter_pool = [p for p in self.alive_players() if p.room == room]
        if reporter_pool and self.rng.random() < 0.5:
            reporter = self.rng.choice(reporter_pool)
            self.state.logs.append(f"{reporter.name} reported {name}'s body in {room}.")
            self.meeting()

    def meeting(self) -> None:
        alive = self.alive_players()
        if len(alive) <= 2:
            return

        votes: Dict[str, int] = {p.name: 0 for p in alive}
        votes["skip"] = 0
        for voter in alive:
            # Simple AI voting behavior:
            if self.rng.random() < 0.25:
                votes["skip"] += 1
                continue
            candidates = [p.name for p in alive if p.name != voter.name]
            votes[self.rng.choice(candidates)] += 1

        target, count = max(votes.items(), key=lambda kv: kv[1])
        if target != "skip" and count >= 2:
            ejected = next(p for p in alive if p.name == target)
            ejected.alive = False
            self.state.logs.append(
                f"Meeting result: {target} ejected ({'Impostor' if ejected.impostor else 'Crewmate'})."
            )
        else:
            self.state.logs.append("Meeting result: no one was ejected.")

        self.state.bodies.clear()

    def task_progress(self) -> tuple[int, int]:
        all_tasks = [t for p in self.state.players if not p.impostor for t in p.tasks]
        done = sum(1 for t in all_tasks if t.done)
        return done, len(all_tasks)

    def win_state(self) -> Optional[str]:
        crew = len(self.alive_crew())
        imps = len(self.alive_impostors())
        if imps == 0:
            return "Crewmates win (all impostors removed)."
        if imps >= crew:
            return "Impostors win (parity reached)."
        done, total = self.task_progress()
        if done == total:
            return "Crewmates win (all tasks completed)."
        return None

    def tick(self) -> None:
        self.state.round_num += 1
        for p in list(self.alive_players()):
            self.move_player(p)
            if p.impostor:
                self.do_impostor_action(p)
            else:
                self.do_crew_action(p)
        self.maybe_report()

    def run(self, max_rounds: int = 200, quiet: bool = False) -> str:
        while self.state.round_num < max_rounds:
            self.tick()
            winner = self.win_state()
            if not quiet:
                done, total = self.task_progress()
                print(
                    f"R{self.state.round_num:03d} | alive: {len(self.alive_players())} | "
                    f"crew/impostor: {len(self.alive_crew())}/{len(self.alive_impostors())} | "
                    f"tasks: {done}/{total}"
                )
            if winner:
                self.state.logs.append(winner)
                return winner
        return "No winner before round limit."


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the AI Among Us Python simulator")
    parser.add_argument("--seed", type=int, default=None, help="Random seed")
    parser.add_argument("--rounds", type=int, default=200, help="Maximum rounds")
    parser.add_argument("--quiet", action="store_true", help="Disable per-round summary output")
    parser.add_argument("--show-log", action="store_true", help="Print event log at the end")
    args = parser.parse_args()

    sim = AmongUsSim(seed=args.seed)
    result = sim.run(max_rounds=args.rounds, quiet=args.quiet)
    print(result)

    if args.show_log:
        print("\nEvent log:")
        for line in sim.state.logs[-80:]:
            print(f"- {line}")


if __name__ == "__main__":
    main()
