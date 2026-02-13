const roomDefs = [
  { id: 'cafeteria', name: 'Cafeteria', x: 450, y: 40, w: 300, h: 160, links: ['upper_engine', 'medbay', 'weapons', 'admin'] },
  { id: 'weapons', name: 'Weapons', x: 790, y: 70, w: 180, h: 130, links: ['cafeteria', 'o2', 'navigation'] },
  { id: 'o2', name: 'O2', x: 780, y: 240, w: 150, h: 110, links: ['weapons', 'navigation', 'shields'] },
  { id: 'navigation', name: 'Navigation', x: 960, y: 220, w: 180, h: 150, links: ['weapons', 'o2', 'shields'] },
  { id: 'shields', name: 'Shields', x: 780, y: 390, w: 210, h: 120, links: ['o2', 'navigation', 'communications', 'storage'] },
  { id: 'communications', name: 'Communications', x: 620, y: 500, w: 160, h: 110, links: ['shields', 'storage'] },
  { id: 'storage', name: 'Storage', x: 430, y: 430, w: 230, h: 170, links: ['admin', 'electrical', 'communications', 'shields', 'lower_engine'] },
  { id: 'admin', name: 'Admin', x: 450, y: 240, w: 180, h: 130, links: ['cafeteria', 'storage'] },
  { id: 'electrical', name: 'Electrical', x: 240, y: 430, w: 170, h: 130, links: ['storage', 'lower_engine', 'security'] },
  { id: 'lower_engine', name: 'Lower Engine', x: 70, y: 430, w: 160, h: 130, links: ['electrical', 'reactor', 'storage'] },
  { id: 'reactor', name: 'Reactor', x: 40, y: 250, w: 180, h: 130, links: ['security', 'lower_engine', 'upper_engine'] },
  { id: 'security', name: 'Security', x: 230, y: 260, w: 150, h: 120, links: ['reactor', 'electrical', 'medbay'] },
  { id: 'medbay', name: 'MedBay', x: 300, y: 110, w: 140, h: 110, links: ['cafeteria', 'security', 'upper_engine'] },
  { id: 'upper_engine', name: 'Upper Engine', x: 110, y: 90, w: 180, h: 130, links: ['reactor', 'medbay', 'cafeteria'] }
];

const ventLinks = {
  electrical: ['medbay', 'security'],
  medbay: ['electrical', 'security'],
  security: ['electrical', 'medbay'],
  cafeteria: ['admin'],
  admin: ['cafeteria']
};

const roomTasks = {
  cafeteria: ['Fix Wiring', 'Empty Garbage'], weapons: ['Clear Asteroids', 'Download Data'],
  o2: ['Clean O2 Filter'], navigation: ['Chart Course', 'Stabilize Steering'],
  shields: ['Prime Shields'], communications: ['Download Data'], storage: ['Fuel Engines', 'Empty Chute'],
  admin: ['Swipe Card', 'Upload Data'], electrical: ['Calibrate Distributor', 'Divert Power'],
  lower_engine: ['Align Engine Output'], reactor: ['Start Reactor', 'Unlock Manifolds'],
  security: ['Review Logs'], medbay: ['Submit Scan'], upper_engine: ['Engine Check']
};

const names = ['Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Orange', 'Purple', 'White', 'Black', 'Cyan'];
const colors = ['#c63c3c','#3b8eff','#33cc66','#ffd43b','#ff8dd8','#f2933f','#7d54ff','#f7f7f7','#1f1f1f','#5df2ff'];
const personalities = ['aggressive', 'careful', 'social', 'logical'];

const roomById = Object.fromEntries(roomDefs.map((r) => [r.id, r]));
const roomIds = roomDefs.map((r) => r.id);

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const els = {
  phaseLine: document.getElementById('phaseLine'), roundLine: document.getElementById('roundLine'), aliveLine: document.getElementById('aliveLine'),
  taskLine: document.getElementById('taskLine'), sabotageLine: document.getElementById('sabotageLine'), watchLine: document.getElementById('watchLine'),
  watchFacts: document.getElementById('watchFacts'), watchRoute: document.getElementById('watchRoute'), playerList: document.getElementById('playerList'),
  logList: document.getElementById('logList'), pauseBtn: document.getElementById('pauseBtn'), stepBtn: document.getElementById('stepBtn'), restartBtn: document.getElementById('restartBtn'), speedInput: document.getElementById('speedInput'), speedLabel: document.getElementById('speedLabel'),
  meetingPanel: document.getElementById('meetingPanel'), meetingReason: document.getElementById('meetingReason'), meetingTimer: document.getElementById('meetingTimer'),
  meetingVotes: document.getElementById('meetingVotes'), meetingTalk: document.getElementById('meetingTalk'),
  endPanel: document.getElementById('endPanel'), endTitle: document.getElementById('endTitle'), endReason: document.getElementById('endReason'),
  sharedApiKeyInput: document.getElementById('sharedApiKeyInput'), apiBaseInput: document.getElementById('apiBaseInput'), apiModelInput: document.getElementById('apiModelInput'),
  botKeyGrid: document.getElementById('botKeyGrid'), saveApiBtn: document.getElementById('saveApiBtn'), apiStatusLine: document.getElementById('apiStatusLine')
};

let state;
let paused = false;
let tickMs = 800;
let tickTimer;
let animationFrame;

const llmConfig = { baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4.1-mini', sharedKey: '', keysByBot: {} };

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (n) => Math.random() < n;
const parseSafe = (txt, fallback) => { try { return JSON.parse(txt); } catch { return fallback; } };

function restartTickLoop() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(tick, tickMs);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function buildRoomSlots() {
  const slots = {};
  roomIds.forEach((id) => { slots[id] = []; });

  state.players
    .slice()
    .sort((a, b) => Number(b.alive) - Number(a.alive) || a.id - b.id)
    .forEach((p) => slots[p.room].push(p));

  return slots;
}

function computePlayerTargets() {
  const slots = buildRoomSlots();
  const targets = new Map();

  roomIds.forEach((roomId) => {
    const room = roomById[roomId];
    const players = slots[roomId];
    players.forEach((p, idx) => {
      targets.set(p.id, {
        x: room.x + 30 + (idx % 5) * 30,
        y: room.y + 40 + Math.floor(idx / 5) * 48
      });
    });
  });

  return targets;
}

function syncPlayerAnimationTargets(initial = false) {
  const targets = computePlayerTargets();
  const now = performance.now();
  const duration = Math.max(220, tickMs * 0.86);

  state.players.forEach((p) => {
    const target = targets.get(p.id);
    if (!target) return;

    if (!p.renderPos || initial) {
      p.renderPos = {
        x: target.x,
        y: target.y,
        fromX: target.x,
        fromY: target.y,
        toX: target.x,
        toY: target.y,
        start: now,
        duration
      };
      return;
    }

    p.renderPos = {
      x: p.renderPos.x,
      y: p.renderPos.y,
      fromX: p.renderPos.x,
      fromY: p.renderPos.y,
      toX: target.x,
      toY: target.y,
      start: now,
      duration
    };
  });
}

function updateAnimatedPositions(now) {
  if (!state) return;
  state.players.forEach((p) => {
    if (!p.renderPos) return;
    const progress = Math.min(1, (now - p.renderPos.start) / p.renderPos.duration);
    const eased = easeInOut(progress);
    p.renderPos.x = p.renderPos.fromX + (p.renderPos.toX - p.renderPos.fromX) * eased;
    p.renderPos.y = p.renderPos.fromY + (p.renderPos.toY - p.renderPos.fromY) * eased;
  });
}

function animationLoop(now) {
  if (!state) return;
  updateAnimatedPositions(now);
  drawBoard(now);
  animationFrame = requestAnimationFrame(animationLoop);
}

function restartAnimationLoop() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(animationLoop);
}

function getRoundRoom(player, round) {
  if (!player.positionLog || !player.positionLog.length) return player.room;
  let last = player.positionLog[0];
  for (const visit of player.positionLog) {
    if (visit.round <= round) last = visit;
    else break;
  }
  return last ? last.room : player.room;
}

function nextTaskRoom(player) {
  const next = player.tasks.find((t) => !t.done);
  return next ? next.room : null;
}

function shortestPath(start, goal) {
  if (start === goal) return [start];
  const queue = [[start]];
  const seen = new Set([start]);

  while (queue.length) {
    const path = queue.shift();
    const last = path[path.length - 1];
    for (const next of roomById[last].links) {
      if (seen.has(next)) continue;
      const nextPath = [...path, next];
      if (next === goal) return nextPath;
      seen.add(next);
      queue.push(nextPath);
    }
  }
  return [start];
}

function buildApiInputs() {
  els.botKeyGrid.innerHTML = '';
  names.forEach((name) => {
    const label = document.createElement('label');
    label.className = 'field';
    label.innerHTML = `${name} API Key <input type="password" data-bot-name="${name}" placeholder="optional override" />`;
    els.botKeyGrid.appendChild(label);
  });
}

function saveApiConfigFromUI() {
  llmConfig.baseUrl = els.apiBaseInput.value.trim() || llmConfig.baseUrl;
  llmConfig.model = els.apiModelInput.value.trim() || llmConfig.model;
  llmConfig.sharedKey = els.sharedApiKeyInput.value.trim();
  llmConfig.keysByBot = {};

  els.botKeyGrid.querySelectorAll('input[data-bot-name]').forEach((input) => {
    const name = input.getAttribute('data-bot-name');
    if (input.value.trim()) llmConfig.keysByBot[name] = input.value.trim();
  });

  if (llmConfig.sharedKey) {
    names.forEach((n) => { if (!llmConfig.keysByBot[n]) llmConfig.keysByBot[n] = llmConfig.sharedKey; });
  }

  els.apiStatusLine.textContent = `Saved keys for ${Object.keys(llmConfig.keysByBot).length} bots.${llmConfig.sharedKey ? ' Shared key active.' : ''}`;
  persistUiSettings();
}

function loadUiSettings() {
  try {
    const raw = localStorage.getItem('ai_among_us_settings');
    if (!raw) return;
    const cfg = JSON.parse(raw);
    if (cfg.baseUrl) els.apiBaseInput.value = cfg.baseUrl;
    if (cfg.model) els.apiModelInput.value = cfg.model;
    if (cfg.sharedKey) els.sharedApiKeyInput.value = cfg.sharedKey;
    if (cfg.tickMs) {
      tickMs = Number(cfg.tickMs) || tickMs;
      els.speedInput.value = String(tickMs);
    }
    if (cfg.perBot) {
      els.botKeyGrid.querySelectorAll('input[data-bot-name]').forEach((input) => {
        const n = input.getAttribute('data-bot-name');
        if (cfg.perBot[n]) input.value = cfg.perBot[n];
      });
    }
  } catch {}
}

function persistUiSettings() {
  try {
    const perBot = {};
    els.botKeyGrid.querySelectorAll('input[data-bot-name]').forEach((input) => {
      const n = input.getAttribute('data-bot-name');
      if (input.value.trim()) perBot[n] = input.value.trim();
    });
    localStorage.setItem('ai_among_us_settings', JSON.stringify({
      baseUrl: els.apiBaseInput.value.trim(),
      model: els.apiModelInput.value.trim(),
      sharedKey: els.sharedApiKeyInput.value.trim(),
      tickMs,
      perBot
    }));
  } catch {}
}

async function callBotLLM(player, payload) {
  const key = llmConfig.keysByBot[player.name];
  if (!key) return null;

  try {
    const res = await fetch(llmConfig.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: llmConfig.model,
        temperature: 0.9,
        messages: [
          { role: 'system', content: 'You are an Among Us AI. Return strict JSON only. Players can lie and doubt others.' },
          { role: 'user', content: JSON.stringify(payload) }
        ]
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

function addLog(text) {
  state.logs.unshift(`[R${state.round}] ${text}`);
  state.logs = state.logs.slice(0, 140);
}

function addMemory(player, text) {
  player.memory.push(`[R${state.round}] ${text}`);
  player.memory = player.memory.slice(-100);
}

function recordRoomVisit(player) {
  player.routeHistory.push(roomById[player.room].name);
  player.routeHistory = player.routeHistory.slice(-160);
  player.visitCounts[player.room] = (player.visitCounts[player.room] || 0) + 1;
  if (!player.positionLog.length || player.positionLog[player.positionLog.length - 1].room !== player.room) {
    player.positionLog.push({ round: state.round, room: player.room });
  }
}

function makeTasks() {
  const tasks = [];
  while (tasks.length < 6) {
    const room = rand(roomIds);
    const tname = rand(roomTasks[room] || ['General Task']);
    tasks.push({ room, name: tname, done: false });
  }
  return tasks;
}

function alivePlayers() { return state.players.filter((p) => p.alive); }
function aliveCrew() { return state.players.filter((p) => p.alive && !p.impostor); }
function aliveImpostors() { return state.players.filter((p) => p.alive && p.impostor); }

function setup() {
  const players = names.map((name, i) => ({
    id: i,
    name,
    color: colors[i],
    alive: true,
    impostor: false,
    room: rand(roomIds),
    killCooldown: 0,
    emergencyLeft: 1,
    tasks: makeTasks(),
    suspicion: {},
    memory: [],
    routeHistory: [],
    positionLog: [],
    visitCounts: {},
    seenKillBy: null,
    personality: rand(personalities)
  }));

  const impA = rand(players);
  let impB = rand(players);
  if (impA.id === impB.id) impB = players[(impA.id + 4) % players.length];
  impA.impostor = true;
  impB.impostor = true;

  state = {
    round: 1,
    phase: 'freeplay',
    players,
    bodies: [],
    logs: ['Game started. Welcome to AI Among Us.'],
    watchIndex: 0,
    meeting: null,
    meetingResolving: false,
    meetingCooldown: 0,
    sabotage: null,
    sabotageCooldown: 5,
    gameOver: false,
    winner: null,
    reason: null
  };

  players.forEach((p) => {
    addMemory(p, 'Round start.');
    recordRoomVisit(p);
  });

  syncPlayerAnimationTargets(true);

  paused = false;
  els.endPanel.classList.add('hidden');
  render();
}

function moveToward(player, targetRoom) {
  const path = shortestPath(player.room, targetRoom);
  player.room = path[1] || player.room;
  recordRoomVisit(player);
}

function randomWalk(player) {
  player.room = rand(roomById[player.room].links);
  recordRoomVisit(player);
}

function markSuspicion(observer, targetId, amount) {
  observer.suspicion[targetId] = (observer.suspicion[targetId] || 0) + amount;
}

function triggerSabotage() {
  if (state.sabotage || state.sabotageCooldown > 0 || !chance(0.22)) return;
  const type = rand(['lights', 'reactor', 'o2']);
  state.sabotage = {
    type,
    timer: type === 'lights' ? 7 : 8,
    fixRooms: type === 'lights' ? ['electrical'] : type === 'reactor' ? ['reactor', 'security'] : ['o2', 'admin'],
    fixesNeeded: type === 'lights' ? 1 : 2,
    fixes: 0
  };
  state.sabotageCooldown = 8;
  addLog(`Sabotage: ${type.toUpperCase()} activated!`);
  alivePlayers().forEach((p) => addMemory(p, `Sabotage ${type} active.`));
}

function reportBody(reporter, body) {
  body.reported = true;
  state.phase = 'meeting-discussion';
  state.meeting = {
    reason: 'Body Reported',
    timer: 3,
    reporterId: reporter.id,
    bodyId: body.victimId,
    statements: [],
    votes: null
  };

  addLog(`${reporter.name} reported ${state.players[body.victimId].name} in ${roomById[reporter.room].name}.`);
  alivePlayers().forEach((p) => addMemory(p, `${reporter.name} reported in ${roomById[reporter.room].name}.`));
  state.sabotage = null;
}

function maybeCallEmergency(player) {
  if (player.emergencyLeft <= 0 || state.sabotage || state.meetingCooldown > 0 || !chance(player.personality === 'aggressive' ? 0.025 : 0.01)) return;
  player.emergencyLeft -= 1;
  state.phase = 'meeting-discussion';
  state.meeting = {
    reason: 'Emergency Meeting',
    timer: 3,
    reporterId: player.id,
    bodyId: null,
    statements: [],
    votes: null
  };
  addLog(`${player.name} called an emergency meeting.`);
  state.meetingCooldown = 8;
}

function doCrewTask(player) {
  const task = player.tasks.find((t) => !t.done && t.room === player.room);
  if (!task) return false;
  const completeChance = player.personality === 'logical' ? 0.85 : 0.7;
  if (!chance(completeChance)) return false;

  task.done = true;
  addLog(`${player.name} completed ${task.name} in ${roomById[player.room].name}.`);
  addMemory(player, `Completed task ${task.name} in ${roomById[player.room].name}.`);
  return true;
}

function crewTurn(player) {
  const body = state.bodies.find((b) => !b.reported && b.room === player.room);
  if (body && chance(player.personality === 'careful' ? 0.98 : 0.9)) {
    reportBody(player, body);
    return;
  }

  if (state.sabotage) {
    if (state.sabotage.fixRooms.includes(player.room) && chance(0.75)) {
      state.sabotage.fixes += 1;
      addLog(`${player.name} worked on ${state.sabotage.type}.`);
      addMemory(player, `Fixed ${state.sabotage.type} in ${roomById[player.room].name}.`);
    } else {
      moveToward(player, rand(state.sabotage.fixRooms));
    }
    return;
  }

  if (doCrewTask(player)) return;

  const nextTask = player.tasks.find((t) => !t.done);
  if (nextTask) moveToward(player, nextTask.room);
  else randomWalk(player);

  maybeCallEmergency(player);
}

function impostorTurn(player) {
  player.killCooldown = Math.max(0, player.killCooldown - 1);
  triggerSabotage();

  const crewInRoom = state.players.filter((p) => p.alive && !p.impostor && p.room === player.room);
  if (crewInRoom.length && player.killCooldown === 0 && chance(player.personality === 'aggressive' ? 0.65 : 0.48)) {
    const victim = rand(crewInRoom);
    victim.alive = false;
    state.bodies.push({ victimId: victim.id, room: player.room, reported: false });
    player.killCooldown = 3;
    addLog(`${victim.name} was eliminated in ${roomById[player.room].name}.`);
    addMemory(player, `Eliminated ${victim.name} in ${roomById[player.room].name}.`);

    state.players
      .filter((p) => p.alive && p.room === player.room && p.id !== player.id)
      .forEach((w) => {
        w.seenKillBy = player.id;
        markSuspicion(w, player.id, 12);
        addMemory(w, `Saw ${player.name} eliminate ${victim.name}.`);
      });
    return;
  }

  const ventTargets = ventLinks[player.room];
  if (ventTargets && chance(0.24)) {
    player.room = rand(ventTargets);
    recordRoomVisit(player);
    addLog(`${player.name} vanished into a vent...`);
    return;
  }

  const crewRooms = state.players.filter((p) => p.alive && !p.impostor).map((p) => p.room);
  if (crewRooms.length && chance(0.58)) moveToward(player, rand(crewRooms));
  else randomWalk(player);

  maybeCallEmergency(player);
}

function processSabotage() {
  if (!state.sabotage) return;
  if (state.sabotage.fixes >= state.sabotage.fixesNeeded) {
    addLog(`${state.sabotage.type.toUpperCase()} sabotage resolved.`);
    state.sabotage = null;
    return;
  }

  state.sabotage.timer -= 1;
  if (state.sabotage.timer <= 0) {
    endGame('Impostors', `${state.sabotage.type.toUpperCase()} sabotage timer reached zero.`);
  }
}

function heuristicStatement(voter) {
  if (voter.seenKillBy !== null) return `I SAW ${state.players[voter.seenKillBy].name} eliminate someone.`;
  const top = Object.entries(voter.suspicion).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] > 2) return `I think ${state.players[Number(top[0])].name} is sus.`;
  return `I was in ${roomById[voter.room].name} doing tasks.`;
}

function heuristicVote(voter, alive) {
  if (voter.seenKillBy !== null && alive.some((p) => p.id === voter.seenKillBy)) return voter.seenKillBy;
  const candidates = alive.filter((p) => p.id !== voter.id);
  if (!candidates.length) return null;

  const best = candidates
    .map((c) => ({ id: c.id, score: voter.suspicion[c.id] || 0 }))
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score < 1 || chance(0.24)) return null;
  return best.id;
}

async function resolveMeeting() {
  if (!state.meeting || state.meetingResolving) return;
  state.meetingResolving = true;
  state.phase = 'meeting-resolving';

  const alive = alivePlayers();
  const statements = [];

  for (const p of alive) {
    const payload = {
      task: 'speak',
      you: {
        name: p.name,
        role: p.impostor ? 'impostor' : 'crewmate',
        personality: p.personality,
        memory: p.memory.slice(-12),
        route: p.routeHistory.slice(-12)
      },
      meeting: {
        reason: state.meeting.reason,
        body: state.meeting.bodyId !== null ? state.players[state.meeting.bodyId].name : null,
        alive: alive.map((a) => a.name)
      },
      out: { statement: 'string' }
    };

    let text = heuristicStatement(p);
    const llm = await callBotLLM(p, payload);
    if (llm) {
      const parsed = parseSafe(llm, {});
      if (typeof parsed.statement === 'string' && parsed.statement.trim()) text = parsed.statement.trim();
    }

    statements.push({ speakerId: p.id, text });
    addLog(`${p.name}: ${text}`);
  }

  state.meeting.statements = statements;

  const claimedRoomBySpeaker = {};
  for (const s of statements) {
    const lower = s.text.toLowerCase();
    const matched = roomDefs.find((r) => lower.includes(r.name.toLowerCase()));
    if (matched) claimedRoomBySpeaker[s.speakerId] = matched.id;
  }

  for (const listener of alive) {
    for (const s of statements) {
      if (s.speakerId === listener.id) continue;
      addMemory(listener, `${state.players[s.speakerId].name} said: ${s.text}`);
      if (/saw .* eliminate|saw .* kill/i.test(s.text)) {
        markSuspicion(listener, s.speakerId, chance(0.56) ? 0.8 : -0.25);
      }
      if (claimedRoomBySpeaker[s.speakerId]) {
        const claimed = claimedRoomBySpeaker[s.speakerId];
        const claimedRoundRoom = getRoundRoom(state.players[s.speakerId], Math.max(1, state.round - 1));
        if (claimedRoundRoom !== claimed) markSuspicion(listener, s.speakerId, 1.25);
      }
    }
  }

  const votes = {};
  for (const p of alive) {
    const payload = {
      task: 'vote',
      you: { name: p.name, role: p.impostor ? 'impostor' : 'crewmate', memory: p.memory.slice(-14), suspicion: p.suspicion },
      statements: statements.map((s) => ({ speaker: state.players[s.speakerId].name, text: s.text })),
      out: { vote: 'name_or_skip', believed: ['names'] }
    };

    let voteId = heuristicVote(p, alive);
    const llm = await callBotLLM(p, payload);

    if (llm) {
      const parsed = parseSafe(llm, {});
      if (Array.isArray(parsed.believed)) {
        parsed.believed.forEach((n) => {
          const speaker = state.players.find((x) => x.name.toLowerCase() === String(n).toLowerCase());
          if (speaker) markSuspicion(p, speaker.id, 0.6);
        });
      }

      if (typeof parsed.vote === 'string') {
        const value = parsed.vote.trim().toLowerCase();
        if (value === 'skip') voteId = null;
        else {
          const target = alive.find((a) => a.name.toLowerCase() === value);
          if (target && target.id !== p.id) voteId = target.id;
        }
      }
    }

    const key = voteId === null ? 'skip' : String(voteId);
    votes[key] = (votes[key] || 0) + 1;
  }

  state.meeting.votes = votes;
  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const tie = sorted.length > 1 && sorted[0][1] === sorted[1][1];

  if (!sorted.length || tie || sorted[0][0] === 'skip') {
    addLog('No one was ejected.');
  } else {
    const outId = Number(sorted[0][0]);
    const out = state.players.find((p) => p.id === outId);
    if (out && out.alive) {
      out.alive = false;
      addLog(`${out.name} was ejected (${out.impostor ? 'Impostor' : 'Crewmate'}).`);
    }
  }

  state.players.forEach((p) => {
    p.seenKillBy = null;
    p.killCooldown = Math.max(0, p.killCooldown - 1);
  });

  state.phase = 'meeting-vote';
  state.meeting.timer = 2;
  state.meetingResolving = false;
}

function updateMeeting() {
  if (!state.meeting) return;
  state.meeting.timer -= 1;

  if (state.phase === 'meeting-discussion' && state.meeting.timer <= 0) {
    resolveMeeting();
  } else if (state.phase === 'meeting-vote' && state.meeting.timer <= 0) {
    state.phase = 'freeplay';
    state.meeting = null;
    state.bodies = state.bodies.filter((b) => !b.reported);
  }
}

function crewTasksLeft() {
  return state.players
    .filter((p) => !p.impostor && p.alive)
    .reduce((sum, p) => sum + p.tasks.filter((t) => !t.done).length, 0);
}

function crewTotalTasks() {
  return state.players
    .filter((p) => !p.impostor)
    .reduce((sum, p) => sum + p.tasks.length, 0);
}

function checkWin() {
  if (!aliveImpostors().length) return endGame('Crewmates', 'All impostors were eliminated.');
  if (aliveImpostors().length >= aliveCrew().length) return endGame('Impostors', 'Impostors reached parity.');
  if (crewTasksLeft() === 0) return endGame('Crewmates', 'Crew completed all tasks.');
}

function endGame(winner, reason) {
  state.gameOver = true;
  state.winner = winner;
  state.reason = reason;
  state.phase = 'game-over';
  addLog(`${winner} win! ${reason}`);
}

function tick() {
  if (paused || state.gameOver || state.meetingResolving) return render();

  state.round += 1;
  state.sabotageCooldown = Math.max(0, state.sabotageCooldown - 1);
  state.meetingCooldown = Math.max(0, state.meetingCooldown - 1);
  state.players.forEach((p) => {
    Object.keys(p.suspicion).forEach((k) => {
      p.suspicion[k] *= 0.96;
      if (Math.abs(p.suspicion[k]) < 0.15) delete p.suspicion[k];
    });
  });

  if (state.phase === 'freeplay') {
    for (const p of state.players) {
      if (!p.alive) continue;
      if (p.impostor) impostorTurn(p);
      else crewTurn(p);
      if (state.phase !== 'freeplay') break;
    }
    processSabotage();
  } else if (state.phase.startsWith('meeting')) {
    updateMeeting();
  }

  checkWin();
  syncPlayerAnimationTargets();
  render();
}

function drawBean(x, y, color, dead = false, highlight = false) {
  ctx.save();

  if (highlight) {
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(114,220,255,0.25)';
    ctx.fill();
  }

  if (dead) {
    ctx.fillStyle = '#aa2b2b';
    ctx.fillRect(x - 16, y + 10, 32, 8);
    ctx.restore();
    return;
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - 14, y - 18, 28, 38, 10);
  else ctx.rect(x - 14, y - 18, 28, 38);
  ctx.fill();

  ctx.fillStyle = '#dff6ff';
  ctx.beginPath();
  ctx.ellipse(x + 7, y - 8, 10, 7, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillRect(x - 12, y + 16, 8, 8);
  ctx.fillRect(x + 4, y + 16, 8, 8);
  ctx.restore();
}

function drawBoard(now = performance.now()) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Corridor lines for stronger map readability.
  roomDefs.forEach((r) => {
    r.links.forEach((toId) => {
      if (r.id > toId) return;
      const to = roomById[toId];
      ctx.strokeStyle = 'rgba(114, 220, 255, 0.15)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(r.x + r.w / 2, r.y + r.h / 2);
      ctx.lineTo(to.x + to.w / 2, to.y + to.h / 2);
      ctx.stroke();
    });
  });

  // Spectator guidance: show the watched bot's likely path.
  const watched = state.players[state.watchIndex];
  if (watched && watched.alive) {
    let path = null;
    if (!watched.impostor) {
      const room = nextTaskRoom(watched);
      if (room) path = shortestPath(watched.room, room);
    } else {
      const nearbyCrew = aliveCrew().slice().sort((a, b) => {
        return shortestPath(watched.room, a.room).length - shortestPath(watched.room, b.room).length;
      })[0];
      if (nearbyCrew) path = shortestPath(watched.room, nearbyCrew.room);
    }

    if (path && path.length > 1) {
      ctx.save();
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = watched.impostor ? 'rgba(255, 126, 126, 0.6)' : 'rgba(114, 220, 255, 0.6)';
      ctx.beginPath();
      const firstRoom = roomById[path[0]];
      ctx.moveTo(firstRoom.x + firstRoom.w / 2, firstRoom.y + firstRoom.h / 2);
      path.slice(1).forEach((rid) => {
        const r = roomById[rid];
        ctx.lineTo(r.x + r.w / 2, r.y + r.h / 2);
      });
      ctx.stroke();
      ctx.restore();
    }
  }

  roomDefs.forEach((r) => {
    ctx.fillStyle = '#17264a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#4769b3';
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.fillStyle = '#b9cfff';
    ctx.font = '13px sans-serif';
    ctx.fillText(r.name, r.x + 8, r.y + 16);

    if (ventLinks[r.id]) {
      ctx.fillStyle = '#ff9f43';
      ctx.fillRect(r.x + r.w - 20, r.y + r.h - 16, 10, 8);
    }

    if (state.sabotage && state.sabotage.fixRooms.includes(r.id)) {
      const pulse = (Math.sin(now / 160) + 1) / 2;
      ctx.fillStyle = `rgba(255, 126, 126, ${0.14 + pulse * 0.2})`;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  });

  state.bodies.forEach((b) => {
    if (b.reported) return;
    const room = roomById[b.room];
    drawBean(room.x + room.w / 2, room.y + room.h / 2, '#ff6961', true, false);
  });

  state.players.forEach((p) => {
    const x = p.renderPos?.x ?? (roomById[p.room].x + 30);
    const y = p.renderPos?.y ?? (roomById[p.room].y + 40);
    const bob = p.alive ? Math.sin((now / 160) + p.id) * 1.5 : 0;
    drawBean(x, y + bob, p.color, !p.alive, p.id === state.watchIndex);

    ctx.fillStyle = '#f7fbff';
    ctx.font = '11px sans-serif';
    ctx.fillText(p.name, x - 16, y + 34 + bob);
  });
}

function render() {
  const watch = state.players[state.watchIndex];

  const totalTasks = crewTotalTasks();
  const doneTasks = totalTasks - crewTasksLeft();
  const percent = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  els.phaseLine.textContent = `Phase: ${state.phase} | Meeting CD: ${state.meetingCooldown}`;
  els.roundLine.textContent = `Round: ${state.round}`;
  els.aliveLine.textContent = `Alive: ${alivePlayers().length}/${state.players.length}`;
  els.taskLine.textContent = `Crew tasks: ${doneTasks}/${totalTasks} (${percent}%)`;
  els.sabotageLine.textContent = state.sabotage ? `Sabotage: ${state.sabotage.type.toUpperCase()} (${state.sabotage.timer})` : 'Sabotage: none';

  els.watchLine.textContent = `Watching: ${watch.name} (${watch.alive ? 'alive' : 'dead'})`;
  els.watchFacts.innerHTML = '';
  const topPair = Object.entries(watch.suspicion).sort((a, b) => b[1] - a[1])[0];
  const topSuspect = topPair ? state.players[Number(topPair[0])]?.name || 'none' : 'none';
  [
    `Role: ${watch.impostor ? 'Impostor' : 'Crewmate'} (spectator debug)`,
    `Current room: ${roomById[watch.room].name}`,
    `Personality: ${watch.personality}`,
    `Goal: ${watch.impostor ? 'Hunt / fake pathing' : (nextTaskRoom(watch) ? roomById[nextTaskRoom(watch)].name : 'All tasks done')}`,
    `Tasks done: ${watch.tasks.filter((t) => t.done).length}/${watch.tasks.length}`,
    `Kill cooldown: ${watch.killCooldown}`,
    `Top suspect: ${topSuspect}`
  ].forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    els.watchFacts.appendChild(li);
  });

  els.watchRoute.innerHTML = '';
  watch.routeHistory.slice(-14).reverse().forEach((room) => {
    const li = document.createElement('li');
    li.textContent = room;
    els.watchRoute.appendChild(li);
  });

  els.playerList.innerHTML = '';
  state.players.forEach((p) => {
    const li = document.createElement('li');
    li.className = `${p.alive ? 'alive' : 'dead'} ${p.id === state.watchIndex ? 'watching' : ''}`;
    li.textContent = `${p.name} — ${p.alive ? roomById[p.room].name : 'dead'}`;
    els.playerList.appendChild(li);
  });

  els.logList.innerHTML = '';
  state.logs.slice(0, 30).forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    els.logList.appendChild(li);
  });

  if (state.phase.startsWith('meeting')) {
    els.meetingPanel.classList.remove('hidden');
    els.meetingReason.textContent = `Reason: ${state.meeting.reason}`;
    els.meetingTimer.textContent = `Timer: ${state.meeting.timer}`;
    els.meetingVotes.textContent = state.meeting.votes ? `Votes: ${JSON.stringify(state.meeting.votes)}` : 'Votes: pending';
    els.meetingTalk.innerHTML = '';
    (state.meeting.statements || []).forEach((s) => {
      const li = document.createElement('li');
      li.textContent = `${state.players[s.speakerId].name}: ${s.text}`;
      els.meetingTalk.appendChild(li);
    });
  } else {
    els.meetingPanel.classList.add('hidden');
  }

  if (state.gameOver) {
    els.endPanel.classList.remove('hidden');
    els.endTitle.textContent = `${state.winner} Win`;
    els.endReason.textContent = state.reason;
  }

  els.pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  els.speedLabel.textContent = `${tickMs}ms`;
}

window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea') return;
  if (e.key === 'ArrowRight') {
    state.watchIndex = (state.watchIndex + 1) % state.players.length;
    render();
  }
  if (e.key === 'ArrowLeft') {
    state.watchIndex = (state.watchIndex - 1 + state.players.length) % state.players.length;
    render();
  }
  if (e.key === ' ') {
    e.preventDefault();
    paused = !paused;
    render();
  }
  if (e.key.toLowerCase() === 'n' && !state.gameOver) {
    const wasPaused = paused;
    paused = false;
    tick();
    paused = wasPaused;
    render();
  }
});

els.pauseBtn.addEventListener('click', () => { paused = !paused; render(); });
els.stepBtn.addEventListener('click', () => {
  if (!state.gameOver) {
    const wasPaused = paused;
    paused = false;
    tick();
    paused = wasPaused;
    render();
  }
});
els.restartBtn.addEventListener('click', setup);
els.saveApiBtn.addEventListener('click', saveApiConfigFromUI);
els.speedInput.addEventListener('input', (e) => {
  tickMs = Number(e.target.value) || 800;
  restartTickLoop();
  persistUiSettings();
  render();
});

buildApiInputs();
loadUiSettings();
saveApiConfigFromUI();
setup();
restartTickLoop();
restartAnimationLoop();
