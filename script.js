// ── Table Soccer ─────────────────────────────────────────
// Turn-based 2-player table soccer with Usion SDK

// ── Constants ────────────────────────────────────────────
const GOALS_TO_WIN = 3;
const DISK_RADIUS = 18;
const BALL_RADIUS = 10;
const GOAL_WIDTH_RATIO = 0.35;
const MAX_SHOT_POWER = 18;
const FRICTION = 0.97;
const STOP_THRESHOLD = 0.15;
const WALL_BOUNCE = 0.7;
const DISK_BOUNCE = 0.85;
const BALL_BOUNCE = 0.9;
const FIXED_TIMESTEP_MS = 1000 / 60;
const SHOT_START_DELAY_MS = 120;

// Fixed logical field size. ALL physics, positions and collisions use these
// units on every device, so the two clients simulate identically regardless
// of screen size. Rendering and input scale between logical and display space.
const LOGIC_W = 400;
const LOGIC_H = 600;

// ── Bot config ───────────────────────────────────────────
// angleErr: max aim error in radians. powerMin/Max: fraction of MAX_SHOT_POWER.
// thinkMs: pause before the bot shoots. gkPenalty: discourages moving the keeper.
const BOT_CFG = {
  easy:   { angleErr: 0.38, powerMin: 0.45, powerMax: 0.70, thinkMs: 1000, gkPenalty: 0.6 },
  medium: { angleErr: 0.15, powerMin: 0.60, powerMax: 0.90, thinkMs: 800,  gkPenalty: 1.2 },
  hard:   { angleErr: 0.04, powerMin: 0.82, powerMax: 1.00, thinkMs: 600,  gkPenalty: 2.0 }
};

// ── Formation definitions ────────────────────────────────
// Positions as fractions of field [x: 0-1, y: 0-1] for bottom player (player 2)
// Player 1 (top) gets these mirrored vertically
const FORMATIONS = {
  "1-3-2": {
    atk: [
      { x: 0.5, y: 0.92 },   // GK
      { x: 0.2, y: 0.72 },   // DEF row
      { x: 0.5, y: 0.72 },
      { x: 0.8, y: 0.72 },
      { x: 0.35, y: 0.57 },  // FWD row
      { x: 0.65, y: 0.57 },
    ],
    def: [
      { x: 0.5, y: 0.92 },
      { x: 0.2, y: 0.78 },
      { x: 0.5, y: 0.78 },
      { x: 0.8, y: 0.78 },
      { x: 0.35, y: 0.65 },
      { x: 0.65, y: 0.65 },
    ]
  },
  "1-2-3": {
    atk: [
      { x: 0.5, y: 0.92 },
      { x: 0.35, y: 0.75 },
      { x: 0.65, y: 0.75 },
      { x: 0.2, y: 0.57 },
      { x: 0.5, y: 0.57 },
      { x: 0.8, y: 0.57 },
    ],
    def: [
      { x: 0.5, y: 0.92 },
      { x: 0.35, y: 0.8 },
      { x: 0.65, y: 0.8 },
      { x: 0.2, y: 0.65 },
      { x: 0.5, y: 0.65 },
      { x: 0.8, y: 0.65 },
    ]
  },
  "1-4-1": {
    atk: [
      { x: 0.5, y: 0.92 },
      { x: 0.15, y: 0.72 },
      { x: 0.38, y: 0.72 },
      { x: 0.62, y: 0.72 },
      { x: 0.85, y: 0.72 },
      { x: 0.5, y: 0.55 },
    ],
    def: [
      { x: 0.5, y: 0.92 },
      { x: 0.15, y: 0.78 },
      { x: 0.38, y: 0.78 },
      { x: 0.62, y: 0.78 },
      { x: 0.85, y: 0.78 },
      { x: 0.5, y: 0.65 },
    ]
  },
  "1-2-1-2": {
    atk: [
      { x: 0.5, y: 0.92 },
      { x: 0.3, y: 0.78 },
      { x: 0.7, y: 0.78 },
      { x: 0.5, y: 0.65 },
      { x: 0.35, y: 0.53 },
      { x: 0.65, y: 0.53 },
    ],
    def: [
      { x: 0.5, y: 0.92 },
      { x: 0.3, y: 0.82 },
      { x: 0.7, y: 0.82 },
      { x: 0.5, y: 0.72 },
      { x: 0.35, y: 0.62 },
      { x: 0.65, y: 0.62 },
    ]
  }
};

// ── Game State ───────────────────────────────────────────
let canvas, ctx;
let fieldW, fieldH;
let fieldLeft = 0, fieldTop = 0; // padding for field lines within canvas

let disks = [];     // all 12 disks: [{x,y,vx,vy,player,radius}]
let ball = null;    // {x,y,vx,vy,radius}

let score = [0, 0]; // [player1, player2]
let currentTurn = 1; // 1 or 2
let gamePhase = "waiting"; // waiting | tactics | playing | animating | goal | ended
let roundStarter = 1; // who starts after a goal

let selectedDisk = null;
let dragStart = null;
let dragCurrent = null;
let animFrame = null;
let roundShotCount = 0; // shots taken this round (first-shot goal = foul)
let goalScored = false; // guard to prevent multiple goal detections
let foulActive = false; // true when a foul is being displayed

// Tactic state
let myAttackTactic = "1-3-2";
let myDefenseTactic = "1-3-2";
let opponentAttackTactic = "1-3-2";
let opponentDefenseTactic = "1-3-2";
let tacticTimerInterval = null;
let tacticTimeLeft = 10;
let myTacticsConfirmed = false;
let opponentTacticsReceived = false;

// ── Multiplayer State ────────────────────────────────────
let myId = null;
let myPlayer = 0;
let players = [];
let playerNames = {};
let playerAvatars = {};
let waitingForOpponent = false;
let connectedCount = 0;
let lastSequence = 0;
let lastSnapshotVersion = 0;
let rematchRequested = false;
let rematchState = "idle";
let pendingShot = false;
let snapshotPhysics = false; // true when physics is running from a received snapshot (not a local shot)
let physicsAccumulator = 0;
let lastPhysicsTime = 0;
let scheduledShotTimer = null;
let pendingSnapshot = null; // snapshot received mid-animation, applied once it settles

// ── Bot State ────────────────────────────────────────────
let botMode = false;          // true = single-player vs local bot (bot is always player 2)
let botDifficulty = "easy";   // easy | medium | hard
let botThinking = false;
let botTimer = null;

// ── DOM Refs ─────────────────────────────────────────────
const turnIndicator = document.getElementById("turnIndicator");
const score1El = document.getElementById("score1");
const score2El = document.getElementById("score2");
const resetBtn = document.getElementById("resetBtn");
const waitingOverlay = document.getElementById("waitingOverlay");
const tacticOverlay = document.getElementById("tacticOverlay");
const tacticConfirm = document.getElementById("tacticConfirm");
const tacticTimerEl = document.getElementById("tacticTimer");
const goalOverlay = document.getElementById("goalOverlay");
const foulOverlay = document.getElementById("foulOverlay");
const winnerOverlay = document.getElementById("winnerOverlay");
const winnerName = document.getElementById("winnerName");
const winnerScoreEl = document.getElementById("winnerScore");
const winnerPlayAgain = document.getElementById("winnerPlayAgain");
const winnerShare = document.getElementById("winnerShare");
const winnerCard = document.getElementById("winnerCard");
const player1Avatar = document.getElementById("player1Avatar");
const player2Avatar = document.getElementById("player2Avatar");
const player1Name = document.getElementById("player1Name");
const player2Name = document.getElementById("player2Name");
const player1Panel = document.getElementById("player1Panel");
const player2Panel = document.getElementById("player2Panel");

// ── Canvas Setup ─────────────────────────────────────────
canvas = document.getElementById("field");
ctx = canvas.getContext("2d");

function resizeCanvas() {
  const container = canvas.parentElement;
  const maxW = Math.min(container.clientWidth, 400);
  // Calculate available height: viewport minus topbar, turn indicator, controls, and padding
  var topbar = document.querySelector(".topbar");
  var turnInd = document.getElementById("turnIndicator");
  var controls = document.querySelector(".controls");
  var usedHeight = (topbar ? topbar.offsetHeight : 0) +
                   (turnInd ? turnInd.offsetHeight : 0) +
                   (controls ? controls.offsetHeight : 0) + 40; // 40px for margins/padding
  var availH = window.innerHeight - usedHeight;

  // Keep a fixed 2:3 aspect (matching the logical field) so circles never
  // distort and both clients share the same geometry. Fit within width and
  // available height.
  var displayW = maxW;
  var displayH = displayW * (LOGIC_H / LOGIC_W);
  if (displayH > availH && availH > 0) {
    displayH = availH;
    displayW = displayH * (LOGIC_W / LOGIC_H);
  }

  var dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(displayW * dpr);
  canvas.height = Math.round(displayH * dpr);
  canvas.style.width = displayW + "px";
  canvas.style.height = displayH + "px";

  // Scale the logical field (LOGIC_W x LOGIC_H) onto the display canvas.
  ctx.setTransform((displayW * dpr) / LOGIC_W, 0, 0, (displayH * dpr) / LOGIC_H, 0, 0);

  // Physics always runs in fixed logical units — independent of screen size.
  fieldW = LOGIC_W;
  fieldH = LOGIC_H;

  render();
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ── Usion capabilities: cloud stats · leaderboard · notify · checkpoint ──
// All wrappers are defensive: missing modules / standalone preview must never
// throw (a thrown error in init blanks the game). They no-op gracefully.
// This is a real-time win/loss game (no draws). botMode === single-player.

let myStats = { wins: 0, losses: 0, games: 0 };
let statsRecordedThisGame = false;
const STATS_KEY = "tablesoccer:stats";

function isMultiplayerGame() {
  return !botMode && Array.isArray(players) && players.length >= 2;
}

function isHostPlayer() {
  return !botMode && Array.isArray(players) && players.length > 0 && players[0] === myId;
}

// Cross-device stats: prefer Cloud KV, fall back to localStorage cache.
async function loadStats() {
  try {
    if (window.Usion && Usion.cloud) {
      const remote = await Usion.cloud.get(STATS_KEY);
      if (remote && typeof remote === "object") {
        myStats = Object.assign(myStats, remote);
        try { localStorage.setItem(STATS_KEY, JSON.stringify(myStats)); } catch (_) {}
        return;
      }
    }
  } catch (_) {}
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) myStats = Object.assign(myStats, JSON.parse(raw));
  } catch (_) {}
}

function persistStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(myStats)); } catch (_) {}
  try { if (window.Usion && Usion.cloud) Usion.cloud.set(STATS_KEY, myStats); } catch (_) {}
}

function submitLeaderboard() {
  try {
    if (window.Usion && Usion.leaderboard) {
      // Score = cumulative wins; ranked highest-first. (Needs leaderboard.enabled on the service.)
      Usion.leaderboard.submit(myStats.wins, { games: myStats.games });
    }
  } catch (_) {}
}

function notifySelf(title, body) {
  // Only fires when the app is backgrounded.
  try { if (window.Usion && Usion.notify && document.hidden) Usion.notify.send({ title, body }); } catch (_) {}
}

// Record MY outcome exactly once per multiplayer match (idempotent across snapshot replay).
function recordOutcome(winnerPlayer) {
  if (statsRecordedThisGame || !isMultiplayerGame()) return;
  statsRecordedThisGame = true;
  myStats.games += 1;
  if (winnerPlayer === myPlayer) {
    myStats.wins += 1;
    notifySelf("You won! 🎉", "You won your Table Soccer match");
  } else {
    myStats.losses += 1;
    notifySelf("Match over", "Your Table Soccer match ended");
  }
  persistStats();
  submitLeaderboard();
  try { if (window.Usion && Usion.cloud && Usion.cloud.shared) Usion.cloud.shared.incr("games_total", 1); } catch (_) {}
}

// Host (playerIds[0]) checkpoints a compact authoritative summary so reconnecting
// clients load it as game_state instead of replaying physics from zero.
function hostCheckpoint() {
  if (!isHostPlayer()) return;
  try {
    if (window.Usion && Usion.game && Usion.game.setState) Usion.game.setState(getBoardSnapshot());
  } catch (_) {}
}

// ── Usion Init ───────────────────────────────────────────
Usion.init(async function (config) {
  myId = config.userId;
  playerNames[myId] = config.userName || "You";
  if (config.userAvatar) playerAvatars[myId] = config.userAvatar;
  loadStats(); // fire-and-forget; never block init/render

  showWaiting();
  if (config.roomId) {
    await setupMultiplayer(config.roomId);
  }
});

// ── Multiplayer ──────────────────────────────────────────
async function setupMultiplayer(roomId) {
  try {
    await Usion.game.connect();
    Usion.game.onJoined(onJoined);
    Usion.game.onPlayerJoined(onPlayerJoined);
    Usion.game.onPlayerLeft(onPlayerLeft);
    Usion.game.onAction(onAction);
    Usion.game.onSync(onSync);
    Usion.game.onRealtime(onRealtime);
    Usion.game.onRematchRequest(onRematchRequest);
    Usion.game.onGameRestarted(onGameRestarted);
    Usion.game.onDisconnect(function () {
      if (gamePhase !== "ended") updateTurnIndicator("Connection lost...");
    });
    Usion.game.onReconnect(function () {
      if (gamePhase !== "ended") {
        updateTurnIndicator();
        Usion.game.requestSync(lastSequence);
      }
    });
    await Usion.game.join(roomId);
  } catch (err) {
    console.error("Multiplayer failed:", err);
    hideWaiting();
  }
}

function onJoined(data) {
  players = data.player_ids || [];
  connectedCount = Number(data.connected_count || 0);
  if (data.sequence !== undefined) lastSequence = data.sequence;

  Usion.game.realtime("player_info", {
    name: playerNames[myId],
    avatar: playerAvatars[myId] || null
  });

  if (connectedCount >= 2 && waitingForOpponent) {
    startOnlineGame();
  }
}

function onPlayerJoined(data) {
  if (data.player_ids) players = data.player_ids;
  else if (data.player && data.player.id && !players.includes(data.player.id)) players.push(data.player.id);
  if (data.player && data.player.is_connected) connectedCount = Math.max(connectedCount, 2);

  Usion.game.realtime("player_info", {
    name: playerNames[myId],
    avatar: playerAvatars[myId] || null
  });

  if (connectedCount >= 2 && waitingForOpponent) startOnlineGame();
}

function onPlayerLeft() {
  connectedCount = Math.max(0, connectedCount - 1);
  if (gamePhase !== "ended") {
    updateTurnIndicator("Opponent left the game");
    notifySelf("Opponent left", "Your opponent left the Table Soccer match");
  }
}

function onAction(data) {
  if (data.sequence !== undefined) lastSequence = Math.max(lastSequence, data.sequence);

  if (data.action_type === "shot" && data.player_id !== myId) {
    applyShot(data.action_data);
  }
  if (data.action_type === "tactics" && data.player_id !== myId) {
    opponentAttackTactic = data.action_data.attack || "1-3-2";
    opponentDefenseTactic = data.action_data.defense || "1-3-2";
    opponentTacticsReceived = true;
    tryStartMatch();
  }
  // pendingShot is cleared in onShotComplete after physics settle
}

function onSync(data) {
  pendingShot = false;
  if (data.sequence !== undefined) {
    lastSnapshotVersion = Math.max(lastSnapshotVersion, Number(data.sequence) || 0);
    lastSequence = data.sequence;
  }
  // Resume from the host's checkpoint. Physics replays are non-deterministic, so
  // we never replay the action log; instead the host setState()'s a board
  // snapshot as game_state. Realtime board_state messages are ephemeral — a
  // rejoining client never receives the past ones — so without consuming the
  // checkpoint here the rejoin lands on a freshly-begun match. (This is why both
  // host and guest previously failed to recover their in-progress game.)
  var gs = data.game_state;
  if (gs && Array.isArray(gs.disks) && gs.disks.length) {
    resumeFromCheckpoint(gs);
  }
}

// Rejoin an in-progress match straight from the host's board checkpoint: drop
// any tactics-selection UI/timer, restore the chosen formations, and apply the
// authoritative board state.
function resumeFromCheckpoint(snap) {
  clearInterval(tacticTimerInterval);
  tacticOverlay.classList.remove("show");
  waitingForOpponent = false;
  myTacticsConfirmed = true;
  opponentTacticsReceived = true;
  if (snap.tactics) {
    var mine = snap.tactics[myPlayer];
    var opp = snap.tactics[myPlayer === 1 ? 2 : 1];
    if (mine) { myAttackTactic = mine.atk || myAttackTactic; myDefenseTactic = mine.def || myDefenseTactic; }
    if (opp) { opponentAttackTactic = opp.atk || opponentAttackTactic; opponentDefenseTactic = opp.def || opponentDefenseTactic; }
  }
  // A fresh page load starts lastSnapshotVersion at 0; the checkpoint's
  // Date.now() version comfortably clears applyBoardSnapshot's staleness guard.
  applyBoardSnapshot(snap);
}

function onRealtime(data) {
  if (data.action_type === "player_info" && data.player_id !== myId) {
    if (data.action_data.name) playerNames[data.player_id] = data.action_data.name;
    if (data.action_data.avatar) playerAvatars[data.player_id] = data.action_data.avatar;
    updatePlayerDisplay();
    return;
  }
  if (data.action_type === "board_state" && data.player_id !== myId) {
    applyBoardSnapshot(data.action_data);
    // Host persists every authoritative snapshot (including the opponent's
    // shots) so the checkpoint a reconnecting client loads is always current,
    // not just the host's own last shot.
    if (isHostPlayer()) {
      try { if (window.Usion && Usion.game && Usion.game.setState) Usion.game.setState(data.action_data); } catch (_) {}
    }
    return;
  }
  if (data.action_type === "tactics_selected" && data.player_id !== myId) {
    opponentAttackTactic = data.action_data.attack || "1-3-2";
    opponentDefenseTactic = data.action_data.defense || "1-3-2";
    opponentTacticsReceived = true;
    tryStartMatch();
    return;
  }
  if (data.action_type === "rematch_state" && data.action_data) {
    applyRematchState(data.action_data);
  }
}

function onRematchRequest(data) {
  if (data.player_id === myId) return;
  if (rematchRequested) {
    resetForRematch();
    broadcastBoardSnapshot();
    return;
  }
  rematchState = "requested";
  syncRematchUi();
}

function onGameRestarted() { resetForRematch(); }

function startOnlineGame() {
  waitingForOpponent = false;
  myPlayer = players.indexOf(myId) + 1;
  updatePlayerDisplay();
  hideWaiting();
  showTacticSelection();
  Usion.game.requestSync(0);
}

// ── Player Display ───────────────────────────────────────
function updatePlayerDisplay() {
  var p1id = players[0], p2id = players[1];
  if (p1id) {
    player1Name.textContent = p1id === myId ? "You" : (playerNames[p1id] || "Opponent");
    if (playerAvatars[p1id]) player1Avatar.src = playerAvatars[p1id];
  }
  if (p2id) {
    player2Name.textContent = p2id === myId ? "You" : (playerNames[p2id] || "Opponent");
    if (playerAvatars[p2id]) player2Avatar.src = playerAvatars[p2id];
  }
}


// ── Waiting Overlay ──────────────────────────────────────
function showWaiting() { waitingForOpponent = true; waitingOverlay.classList.add("show"); }
function hideWaiting() { waitingOverlay.classList.remove("show"); }

// ── Play vs Bot ──────────────────────────────────────────
var botDiffEl = document.getElementById("botDiff");
var playBotBtn = document.getElementById("playBotBtn");

if (botDiffEl) {
  botDiffEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".bot-diff-btn");
    if (!btn) return;
    botDiffEl.querySelectorAll(".bot-diff-btn").forEach(function (b) { b.classList.remove("selected"); });
    btn.classList.add("selected");
    botDifficulty = btn.dataset.diff;
  });
}
if (playBotBtn) {
  playBotBtn.addEventListener("click", function () { startBotGame(); });
}

function startBotGame() {
  botMode = true;
  waitingForOpponent = false;
  hideWaiting();

  // Human is always player 1, bot is player 2.
  myPlayer = 1;
  if (!myId) myId = "me";
  if (!playerNames[myId]) playerNames[myId] = "You";
  players = [myId, "BOT"];
  playerNames["BOT"] = "Bot (" + botDifficulty.charAt(0).toUpperCase() + botDifficulty.slice(1) + ")";
  playerAvatars["BOT"] = "https://api.dicebear.com/7.x/bottts/svg?seed=" + botDifficulty;

  updatePlayerDisplay();
  showTacticSelection();
}


// ── Controls ─────────────────────────────────────────────
resetBtn.addEventListener("click", function () {
  requestRematch();
});

// ── Tactic Selection ─────────────────────────────────────
function showTacticSelection() {
  gamePhase = "tactics";
  myTacticsConfirmed = false;
  opponentTacticsReceived = false;
  tacticConfirm.textContent = "CONFIRM";
  tacticConfirm.disabled = false;
  tacticOverlay.classList.add("show");
  goalOverlay.classList.remove("show");
  winnerOverlay.classList.remove("show");
  tacticTimeLeft = 10;
  tacticTimerEl.textContent = tacticTimeLeft;

  drawTacticPreviews();

  clearInterval(tacticTimerInterval);
  tacticTimerInterval = setInterval(function () {
    tacticTimeLeft--;
    tacticTimerEl.textContent = tacticTimeLeft;
    if (tacticTimeLeft <= 0) {
      clearInterval(tacticTimerInterval);
      confirmTactics();
    }
  }, 1000);
}

function drawTacticPreviews() {
  document.querySelectorAll(".tactic-preview").forEach(function (c) {
    var form = c.dataset.formation;
    var parts = form.split("-");
    var type = parts.shift(); // atk or def
    var name = parts.join("-");
    var positions = FORMATIONS[name] ? FORMATIONS[name][type === "atk" ? "atk" : "def"] : FORMATIONS["1-3-2"].atk;

    c.width = 70 * window.devicePixelRatio;
    c.height = 90 * window.devicePixelRatio;
    var pc = c.getContext("2d");
    pc.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

    // Field bg
    pc.fillStyle = "#3a8c28";
    pc.fillRect(0, 0, 70, 90);
    // Lines
    pc.strokeStyle = "rgba(255,255,255,0.3)";
    pc.lineWidth = 0.5;
    pc.strokeRect(2, 2, 66, 86);
    pc.beginPath(); pc.moveTo(2, 45); pc.lineTo(68, 45); pc.stroke();
    pc.beginPath(); pc.arc(35, 45, 12, 0, Math.PI * 2); pc.stroke();

    // Dots for positions
    pc.fillStyle = "#00bfff";
    positions.forEach(function (p) {
      pc.beginPath();
      pc.arc(p.x * 70, (1 - p.y) * 90, 4, 0, Math.PI * 2);
      pc.fill();
    });
  });
}

// Tactic grid click handlers
document.getElementById("attackGrid").addEventListener("click", function (e) {
  var opt = e.target.closest(".tactic-option");
  if (!opt) return;
  this.querySelectorAll(".tactic-option").forEach(function (o) { o.classList.remove("selected"); });
  opt.classList.add("selected");
  myAttackTactic = opt.dataset.tactic;
});

document.getElementById("defenseGrid").addEventListener("click", function (e) {
  var opt = e.target.closest(".tactic-option");
  if (!opt) return;
  this.querySelectorAll(".tactic-option").forEach(function (o) { o.classList.remove("selected"); });
  opt.classList.add("selected");
  myDefenseTactic = opt.dataset.tactic;
});

tacticConfirm.addEventListener("click", function () {
  clearInterval(tacticTimerInterval);
  confirmTactics();
});

function confirmTactics() {
  clearInterval(tacticTimerInterval);
  myTacticsConfirmed = true;

  if (botMode) {
    // Bot picks random formations and is instantly "ready".
    var keys = Object.keys(FORMATIONS);
    opponentAttackTactic = keys[Math.floor(Math.random() * keys.length)];
    opponentDefenseTactic = keys[Math.floor(Math.random() * keys.length)];
    opponentTacticsReceived = true;
    tryStartMatch();
    return;
  }

  Usion.game.realtime("tactics_selected", { attack: myAttackTactic, defense: myDefenseTactic });
  Usion.game.action("tactics", { attack: myAttackTactic, defense: myDefenseTactic });

  tryStartMatch();
}

function tryStartMatch() {
  if (!myTacticsConfirmed) return;
  if (!opponentTacticsReceived) {
    // Show waiting state on the tactic overlay
    tacticConfirm.textContent = "WAITING FOR OPPONENT...";
    tacticConfirm.disabled = true;
    return;
  }
  tacticOverlay.classList.remove("show");
  tacticConfirm.textContent = "CONFIRM";
  tacticConfirm.disabled = false;
  initMatch();
}

// ── Match Init ───────────────────────────────────────────
function initMatch() {
  score = [0, 0];
  currentTurn = 1;
  roundStarter = 1;
  gamePhase = "playing";
  pendingShot = false;
  rematchState = "idle";
  statsRecordedThisGame = false;
  winnerOverlay.classList.remove("show");
  goalOverlay.classList.remove("show");
  updateScoreDisplay();
  resetRound();
}

function resetRound() {
  cancelBotMove();
  setupDisksAndBall();
  selectedDisk = null;
  dragStart = null;
  dragCurrent = null;
  roundShotCount = 0;
  goalScored = false;
  foulActive = false;
  pendingShot = false;
  snapshotPhysics = false;
  pendingSnapshot = null;
  gamePhase = "playing";
  updateTurnIndicator();
  updateActivePanel();
  render();
  maybeTriggerBot();
}

function setupDisksAndBall() {
  disks = [];
  var p1AtkForm, p1DefForm, p2AtkForm, p2DefForm;

  if (myPlayer === 1) {
    p1AtkForm = myAttackTactic;
    p1DefForm = myDefenseTactic;
    p2AtkForm = opponentAttackTactic;
    p2DefForm = opponentDefenseTactic;
  } else {
    p1AtkForm = opponentAttackTactic;
    p1DefForm = opponentDefenseTactic;
    p2AtkForm = myAttackTactic;
    p2DefForm = myDefenseTactic;
  }

  // Use attacking formation for the attacker, defending for the defender
  var p1Form = (currentTurn === 1) ?
    FORMATIONS[p1AtkForm].atk : FORMATIONS[p1DefForm].def;
  var p2Form = (currentTurn === 2) ?
    FORMATIONS[p2AtkForm].atk : FORMATIONS[p2DefForm].def;

  // Player 1 disks (top side) - mirror the positions
  p1Form.forEach(function (pos) {
    disks.push({
      x: pos.x * fieldW,
      y: (1 - pos.y) * fieldH,  // flip vertically for top player
      vx: 0, vy: 0,
      player: 1,
      radius: DISK_RADIUS
    });
  });

  // Player 2 disks (bottom side)
  p2Form.forEach(function (pos) {
    disks.push({
      x: pos.x * fieldW,
      y: pos.y * fieldH,
      vx: 0, vy: 0,
      player: 2,
      radius: DISK_RADIUS
    });
  });

  // Ball at center
  ball = {
    x: fieldW / 2,
    y: fieldH / 2,
    vx: 0, vy: 0,
    radius: BALL_RADIUS
  };
}

// ── Rendering ────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, fieldW, fieldH);
  ctx.save();
  // Player 1's own team is logically at the top. Flip the view vertically so
  // each player always sees their own team at the bottom of their screen.
  if (myPlayer === 1) {
    ctx.translate(0, fieldH);
    ctx.scale(1, -1);
  }
  drawField();
  drawGoals();
  drawDisks();
  drawBall();
  drawAimIndicator();
  ctx.restore();
}

function drawField() {
  // Green field with stripe pattern
  for (var i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#3a8c28" : "#359025";
    ctx.fillRect(0, i * fieldH / 12, fieldW, fieldH / 12);
  }

  // Field border
  var pad = 10;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, fieldW - pad * 2, fieldH - pad * 2);

  // Center line
  ctx.beginPath();
  ctx.moveTo(pad, fieldH / 2);
  ctx.lineTo(fieldW - pad, fieldH / 2);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(fieldW / 2, fieldH / 2, fieldW * 0.15, 0, Math.PI * 2);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(fieldW / 2, fieldH / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Penalty areas
  var penW = fieldW * 0.5;
  var penH = fieldH * 0.12;
  ctx.strokeRect((fieldW - penW) / 2, pad, penW, penH);
  ctx.strokeRect((fieldW - penW) / 2, fieldH - pad - penH, penW, penH);

  // Goal areas (smaller boxes)
  var goalBoxW = fieldW * 0.3;
  var goalBoxH = fieldH * 0.05;
  ctx.strokeRect((fieldW - goalBoxW) / 2, pad, goalBoxW, goalBoxH);
  ctx.strokeRect((fieldW - goalBoxW) / 2, fieldH - pad - goalBoxH, goalBoxW, goalBoxH);

  // Penalty arcs
  ctx.beginPath();
  ctx.arc(fieldW / 2, pad + penH, fieldW * 0.1, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(fieldW / 2, fieldH - pad - penH, fieldW * 0.1, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Corner arcs
  var cornerR = 8;
  ctx.beginPath(); ctx.arc(pad, pad, cornerR, 0, Math.PI / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(fieldW - pad, pad, cornerR, Math.PI / 2, Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(fieldW - pad, fieldH - pad, cornerR, Math.PI, Math.PI * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(pad, fieldH - pad, cornerR, Math.PI * 1.5, Math.PI * 2); ctx.stroke();
}

function drawGoals() {
  var goalW = fieldW * GOAL_WIDTH_RATIO;
  var goalH = 14;
  var gx = (fieldW - goalW) / 2;

  // Top goal (player 1's goal - opponent scores here if attacking upward)
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(gx, 0, goalW, goalH);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(gx, goalH);
  ctx.lineTo(gx, 2);
  ctx.lineTo(gx + goalW, 2);
  ctx.lineTo(gx + goalW, goalH);
  ctx.stroke();

  // Goal net lines (top)
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 0.5;
  for (var i = 0; i < goalW; i += 6) {
    ctx.beginPath(); ctx.moveTo(gx + i, 2); ctx.lineTo(gx + i, goalH); ctx.stroke();
  }

  // Bottom goal
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(gx, fieldH - goalH, goalW, goalH);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(gx, fieldH - goalH);
  ctx.lineTo(gx, fieldH - 2);
  ctx.lineTo(gx + goalW, fieldH - 2);
  ctx.lineTo(gx + goalW, fieldH - goalH);
  ctx.stroke();

  // Goal net lines (bottom)
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 0.5;
  for (var j = 0; j < goalW; j += 6) {
    ctx.beginPath(); ctx.moveTo(gx + j, fieldH - goalH); ctx.lineTo(gx + j, fieldH - 2); ctx.stroke();
  }
}

function drawDisks() {
  disks.forEach(function (d, idx) {
    var isMyDisk = d.player === myPlayer;

    var isCurrentTurn = d.player === currentTurn;
    var isSelected = selectedDisk === idx;

    // Glow for selectable disks
    if (isMyDisk && isCurrentTurn && gamePhase === "playing") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 229, 255, 0.25)";
      ctx.fill();
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 229, 255, 0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Disk body
    ctx.save();
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);

    if (d.player === 1) {
      // Player 1 (top) - red/warm team
      var g1 = ctx.createRadialGradient(d.x - 4, d.y - 4, 2, d.x, d.y, d.radius);
      g1.addColorStop(0, "#ff6b6b");
      g1.addColorStop(1, "#cc2222");
      ctx.fillStyle = g1;
    } else {
      // Player 2 (bottom) - blue/cool team
      var g2 = ctx.createRadialGradient(d.x - 4, d.y - 4, 2, d.x, d.y, d.radius);
      g2.addColorStop(0, "#6bb5ff");
      g2.addColorStop(1, "#2255cc");
      ctx.fillStyle = g2;
    }
    ctx.fill();

    // Disk border
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.radius * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  });
}

function drawBall() {
  if (!ball) return;

  ctx.save();
  // Shadow
  ctx.beginPath();
  ctx.arc(ball.x + 2, ball.y + 2, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  // Ball body
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  var bg = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, ball.radius);
  bg.addColorStop(0, "#ffffff");
  bg.addColorStop(1, "#cccccc");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Pentagon pattern on ball
  ctx.fillStyle = "#333";
  var pentR = ball.radius * 0.35;
  ctx.beginPath();
  for (var i = 0; i < 5; i++) {
    var a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    var px = ball.x + Math.cos(a) * pentR;
    var py = ball.y + Math.sin(a) * pentR;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawAimIndicator() {
  if (!dragStart || !dragCurrent || selectedDisk === null) return;
  if (gamePhase !== "playing") return;

  var d = disks[selectedDisk];
  var dx = dragStart.x - dragCurrent.x;
  var dy = dragStart.y - dragCurrent.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 5) return;

  var maxDrag = 100;
  var power = Math.min(dist / maxDrag, 1);

  // Direction line from disk
  var lineLen = 40 + power * 60;
  var nx = dx / dist;
  var ny = dy / dist;

  // Power range circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(d.x, d.y, lineLen, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fill();
  ctx.restore();

  // Direction arrow
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d.x, d.y);
  ctx.lineTo(d.x + nx * lineLen, d.y + ny * lineLen);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Arrowhead
  var ax = d.x + nx * lineLen;
  var ay = d.y + ny * lineLen;
  var aSize = 8;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - nx * aSize - ny * aSize * 0.5, ay - ny * aSize + nx * aSize * 0.5);
  ctx.lineTo(ax - nx * aSize + ny * aSize * 0.5, ay - ny * aSize - nx * aSize * 0.5);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();

  // Power bar
  var barW = 40;
  var barH = 6;
  var barX = d.x - barW / 2;
  var barY = d.y + d.radius + 12;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(barX, barY, barW, barH);
  var r = Math.round(255 * power);
  var g = Math.round(255 * (1 - power));
  ctx.fillStyle = "rgb(" + r + "," + g + ",0)";
  ctx.fillRect(barX, barY, barW * power, barH);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.restore();
}

// ── Input Handling ───────────────────────────────────────
function getCanvasPos(e) {
  var rect = canvas.getBoundingClientRect();
  var touch = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
  var x = (touch.clientX - rect.left) * (fieldW / rect.width);
  var y = (touch.clientY - rect.top) * (fieldH / rect.height);
  // Mirror input to match the flipped view for Player 1 (see render()).
  if (myPlayer === 1) y = fieldH - y;
  return { x: x, y: y };
}

function canIAct() {
  if (gamePhase !== "playing") return false;
  return currentTurn === myPlayer && !pendingShot;
}

function findDiskAt(pos) {
  for (var i = 0; i < disks.length; i++) {
    var d = disks[i];
    if (d.player !== currentTurn) continue;
    var dx = pos.x - d.x;
    var dy = pos.y - d.y;
    if (dx * dx + dy * dy <= (d.radius + 10) * (d.radius + 10)) return i;
  }
  return null;
}

canvas.addEventListener("mousedown", onPointerDown);
document.addEventListener("mousemove", onPointerMove);
document.addEventListener("mouseup", onPointerUp);
canvas.addEventListener("touchstart", onPointerDown, { passive: false });
document.addEventListener("touchmove", onPointerMove, { passive: false });
document.addEventListener("touchend", onPointerUp, { passive: false });

function onPointerDown(e) {
  e.preventDefault();
  if (!canIAct()) return;
  var pos = getCanvasPos(e);
  var idx = findDiskAt(pos);
  if (idx !== null) {
    selectedDisk = idx;
    dragStart = pos;
    dragCurrent = pos;
    render();
  }
}

function onPointerMove(e) {
  if (selectedDisk === null || !dragStart) return;
  e.preventDefault();
  dragCurrent = getCanvasPos(e);
  render();
}

function onPointerUp(e) {
  if (selectedDisk === null || !dragStart || !dragCurrent) {
    selectedDisk = null;
    dragStart = null;
    dragCurrent = null;
    return;
  }

  var dx = dragStart.x - dragCurrent.x;
  var dy = dragStart.y - dragCurrent.y;
  var dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 10) {
    // Too small, just deselect
    selectedDisk = null;
    dragStart = null;
    dragCurrent = null;
    render();
    return;
  }

  // Calculate shot
  var maxDrag = 100;
  var power = Math.min(dist / maxDrag, 1) * MAX_SHOT_POWER;
  var nx = dx / dist;
  var ny = dy / dist;

  var vx = nx * power;
  var vy = ny * power;

  var startAt = Date.now() + SHOT_START_DELAY_MS;

  var shotData = {
    diskIndex: selectedDisk,
    vx: vx,
    vy: vy,
    player: currentTurn,
    startAt: startAt
  };

  scheduleLocalShot(shotData);
  pendingShot = true;

  if (!botMode) {
    // Send normalized velocities to opponent so different screen sizes work
    var netShotData = {
      diskIndex: selectedDisk,
      vx: vx / fieldW,
      vy: vy / fieldH,
      player: currentTurn,
      startAt: startAt
    };

    Usion.game.action("shot", netShotData).catch(function () {
      pendingShot = false;
      if (scheduledShotTimer) {
        clearTimeout(scheduledShotTimer);
        scheduledShotTimer = null;
      }
      Usion.game.requestSync(0);
    });
  }

  selectedDisk = null;
  dragStart = null;
  dragCurrent = null;
}

function scheduleLocalShot(data) {
  if (scheduledShotTimer) clearTimeout(scheduledShotTimer);
  var delay = Math.max(0, Number(data.startAt || 0) - Date.now());
  scheduledShotTimer = setTimeout(function () {
    scheduledShotTimer = null;
    executeShot(data);
  }, delay);
}

function applyShot(data) {
  if (data.player !== currentTurn) return;
  // Find the right disk for the opponent's shot
  var diskIdx = data.diskIndex;
  if (diskIdx === undefined || diskIdx < 0 || diskIdx >= disks.length) return;
  if (disks[diskIdx].player !== data.player) return;

  var startAt = Number(data.startAt || 0);
  var delay = Math.max(0, startAt - Date.now());

  setTimeout(function () {
    if (data.player !== currentTurn) return;
    if (diskIdx < 0 || diskIdx >= disks.length) return;
    if (disks[diskIdx].player !== data.player) return;

    // Velocities arrive normalized (fraction of field size), convert to local pixels
    executeShot({
      diskIndex: diskIdx,
      vx: data.vx * fieldW,
      vy: data.vy * fieldH,
      player: data.player
    });
  }, delay);
}

function executeShot(data) {
  var d = disks[data.diskIndex];
  if (!d) return;
  d.vx = data.vx;
  d.vy = data.vy;
  roundShotCount++;

  snapshotPhysics = false;
  gamePhase = "animating";
  startPhysicsLoop();
}

// ── Physics ──────────────────────────────────────────────
var physicsRunning = false;

function startPhysicsLoop() {
  if (physicsRunning) return;
  physicsRunning = true;
  physicsAccumulator = 0;
  lastPhysicsTime = performance.now();
  animFrame = requestAnimationFrame(physicsStep);
}

function physicsStep(now) {
  if (!physicsRunning) return;

  var dt = now - lastPhysicsTime;
  lastPhysicsTime = now;
  if (dt > 50) dt = 50;
  physicsAccumulator += dt;

  while (physicsAccumulator >= FIXED_TIMESTEP_MS) {
    updatePhysics();

    if (checkGoal()) {
      render();
      return;
    }

    if (allStopped()) {
      physicsRunning = false;
      onShotComplete();
      render();
      return;
    }

    physicsAccumulator -= FIXED_TIMESTEP_MS;
  }

  render();
  animFrame = requestAnimationFrame(physicsStep);
}

function updatePhysics() {
  // Move all objects
  var allObjects = disks.concat([ball]);
  allObjects.forEach(function (obj) {
    obj.x += obj.vx;
    obj.y += obj.vy;
    obj.vx *= FRICTION;
    obj.vy *= FRICTION;
    if (Math.abs(obj.vx) < STOP_THRESHOLD) obj.vx = 0;
    if (Math.abs(obj.vy) < STOP_THRESHOLD) obj.vy = 0;
  });

  // Wall collisions for disks
  var pad = 10;
  disks.forEach(function (d) {
    if (d.x - d.radius < pad) { d.x = pad + d.radius; d.vx = Math.abs(d.vx) * WALL_BOUNCE; }
    if (d.x + d.radius > fieldW - pad) { d.x = fieldW - pad - d.radius; d.vx = -Math.abs(d.vx) * WALL_BOUNCE; }
    if (d.y - d.radius < pad) { d.y = pad + d.radius; d.vy = Math.abs(d.vy) * WALL_BOUNCE; }
    if (d.y + d.radius > fieldH - pad) { d.y = fieldH - pad - d.radius; d.vy = -Math.abs(d.vy) * WALL_BOUNCE; }
  });

  // Wall collisions for ball (except goal areas)
  var goalW = fieldW * GOAL_WIDTH_RATIO;
  var gx1 = (fieldW - goalW) / 2;
  var gx2 = gx1 + goalW;

  if (ball.x - ball.radius < pad) { ball.x = pad + ball.radius; ball.vx = Math.abs(ball.vx) * BALL_BOUNCE; }
  if (ball.x + ball.radius > fieldW - pad) { ball.x = fieldW - pad - ball.radius; ball.vx = -Math.abs(ball.vx) * BALL_BOUNCE; }

  // Top wall - leave gap for goal
  if (ball.y - ball.radius < pad) {
    if (ball.x < gx1 || ball.x > gx2) {
      ball.y = pad + ball.radius;
      ball.vy = Math.abs(ball.vy) * BALL_BOUNCE;
    }
  }
  // Bottom wall - leave gap for goal
  if (ball.y + ball.radius > fieldH - pad) {
    if (ball.x < gx1 || ball.x > gx2) {
      ball.y = fieldH - pad - ball.radius;
      ball.vy = -Math.abs(ball.vy) * BALL_BOUNCE;
    }
  }

  // Disk-Disk collisions
  for (var i = 0; i < disks.length; i++) {
    for (var j = i + 1; j < disks.length; j++) {
      resolveCollision(disks[i], disks[j], DISK_BOUNCE);
    }
  }

  // Disk-Ball collisions
  disks.forEach(function (d) {
    resolveCollision(d, ball, BALL_BOUNCE);
  });
}

function resolveCollision(a, b, bounce) {
  var dx = b.x - a.x;
  var dy = b.y - a.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  var minDist = a.radius + b.radius;

  if (dist < minDist && dist > 0) {
    // Separate
    var overlap = minDist - dist;
    var nx = dx / dist;
    var ny = dy / dist;
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;

    // Velocity exchange along collision normal
    var dvx = a.vx - b.vx;
    var dvy = a.vy - b.vy;
    var dot = dvx * nx + dvy * ny;

    if (dot > 0) {
      a.vx -= dot * nx * bounce;
      a.vy -= dot * ny * bounce;
      b.vx += dot * nx * bounce;
      b.vy += dot * ny * bounce;
    }
  }
}

function allStopped() {
  var all = disks.concat([ball]);
  return all.every(function (obj) {
    return Math.abs(obj.vx) < STOP_THRESHOLD && Math.abs(obj.vy) < STOP_THRESHOLD;
  });
}

function checkGoal() {
  if (goalScored) return false; // already processing a goal

  var goalW = fieldW * GOAL_WIDTH_RATIO;
  var gx1 = (fieldW - goalW) / 2;
  var gx2 = gx1 + goalW;
  var goalDepth = 14;

  var scored = 0;
  // Ball in top goal → Player 2 scores
  if (ball.y - ball.radius < goalDepth && ball.x > gx1 && ball.x < gx2) {
    scored = 2;
  }
  // Ball in bottom goal → Player 1 scores
  if (!scored && ball.y + ball.radius > fieldH - goalDepth && ball.x > gx1 && ball.x < gx2) {
    scored = 1;
  }

  if (!scored) return false;

  goalScored = true;
  physicsRunning = false;
  cancelAnimationFrame(animFrame);

  // Snapshot receiver: stop physics but don't process the goal —
  // the authoritative snapshot from the shooter will handle score/turn/reset.
  if (snapshotPhysics) {
    snapshotPhysics = false;
    gamePhase = "goal";
    render();
    return true;
  }

  onGoalScored(scored);
  return true;
}

function onGoalScored(scoringPlayer) {
  // The player whose turn it is right now is the one who took this shot.
  var shooter = currentTurn;
  // The shooter is authoritative — only they broadcast, so the two clients
  // don't fight over snapshot versions.
  var iAmShooter = shooter === myPlayer;

  // First shot of the round scoring a goal is a foul
  // roundShotCount is 1 when the very first shot of the round scores
  if (roundShotCount === 1) {
    gamePhase = "goal";
    foulActive = true;
    foulOverlay.classList.add("show");
    if (iAmShooter) broadcastBoardSnapshot();

    setTimeout(function () {
      foulOverlay.classList.remove("show");
      foulActive = false;
      // Rule: if a player fouls, the OTHER player starts the next round.
      roundStarter = shooter === 1 ? 2 : 1;
      currentTurn = roundStarter;
      resetRound();
      if (iAmShooter) broadcastBoardSnapshot();
    }, 1500);
    return;
  }

  score[scoringPlayer - 1]++;
  updateScoreDisplay();
  gamePhase = "goal";

  goalOverlay.classList.add("show");
  if (iAmShooter) broadcastBoardSnapshot();

  setTimeout(function () {
    goalOverlay.classList.remove("show");

    if (score[scoringPlayer - 1] >= GOALS_TO_WIN) {
      onMatchEnd(scoringPlayer);
      return;
    }

    // Rule: if a player scores, the OTHER player starts the next round.
    roundStarter = scoringPlayer === 1 ? 2 : 1;
    currentTurn = roundStarter;
    resetRound();

    if (iAmShooter) broadcastBoardSnapshot();
  }, 1500);
}

function onShotComplete() {
  // If physics was triggered by a received snapshot, don't switch turns —
  // the snapshot already carries the correct currentTurn value.
  if (snapshotPhysics) {
    snapshotPhysics = false;
    gamePhase = "playing";
    updateTurnIndicator();
    updateActivePanel();
    render();
    flushPendingSnapshot();
    return;
  }

  // Switch turns
  pendingShot = false;
  // The shooter (whose turn it currently is, before switching) is authoritative
  // for the final resting state — only they broadcast, to avoid conflicting snapshots.
  var iWasShooter = currentTurn === myPlayer;
  currentTurn = currentTurn === 1 ? 2 : 1;
  gamePhase = "playing";
  updateTurnIndicator();
  updateActivePanel();

  if (iWasShooter) broadcastBoardSnapshot();
  flushPendingSnapshot();
  maybeTriggerBot();
}

// ── Bot ──────────────────────────────────────────────────
function cancelBotMove() {
  botThinking = false;
  if (botTimer) { clearTimeout(botTimer); botTimer = null; }
}

// If it's the bot's turn, schedule its shot after a short "thinking" pause.
function maybeTriggerBot() {
  if (!botMode || botThinking) return;
  if (gamePhase !== "playing") return;
  if (currentTurn !== 2) return; // bot is always player 2
  botThinking = true;
  var cfg = BOT_CFG[botDifficulty] || BOT_CFG.medium;
  botTimer = setTimeout(function () {
    botTimer = null;
    botThinking = false;
    botShoot();
  }, cfg.thinkMs);
}

function botShoot() {
  if (!botMode || gamePhase !== "playing" || currentTurn !== 2) return;
  var move = computeBotMove();
  if (!move) return;
  pendingShot = true; // block stray human input during the bot's animation
  executeShot({ diskIndex: move.diskIndex, vx: move.vx, vy: move.vy, player: 2 });
}

// Pick a bot disk and an aim that pushes the ball toward the opponent's (top) goal.
function computeBotMove() {
  if (!ball) return null;
  var cfg = BOT_CFG[botDifficulty] || BOT_CFG.medium;
  var pad = 10;

  // Player 2 attacks the TOP goal (small y).
  var goal = { x: fieldW / 2, y: pad + 4 };
  var bgx = goal.x - ball.x, bgy = goal.y - ball.y;
  var bgLen = Math.sqrt(bgx * bgx + bgy * bgy) || 1;
  var bgnx = bgx / bgLen, bgny = bgy / bgLen; // ball -> goal direction

  // Identify the keeper (player-2 disk nearest its own/bottom goal).
  var gkIndex = -1, gkY = -Infinity;
  for (var k = 0; k < disks.length; k++) {
    if (disks[k].player === 2 && disks[k].y > gkY) { gkY = disks[k].y; gkIndex = k; }
  }

  var best = null, bestScore = -Infinity;
  for (var i = 0; i < disks.length; i++) {
    var d = disks[i];
    if (d.player !== 2) continue;
    var tbx = ball.x - d.x, tby = ball.y - d.y;
    var tbLen = Math.sqrt(tbx * tbx + tby * tby) || 1;
    var align = (tbx / tbLen) * bgnx + (tby / tbLen) * bgny; // 1 = disk is behind ball toward goal
    var score = align * 2 - (tbLen / fieldH); // prefer good alignment & closeness
    if (i === gkIndex) score -= cfg.gkPenalty;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  if (best === null) return null;

  var bd = disks[best];
  // Aim the disk center at the contact spot that drives the ball goalward.
  var contact = bd.radius + ball.radius;
  var aimx = ball.x - bgnx * contact, aimy = ball.y - bgny * contact;
  var dx = aimx - bd.x, dy = aimy - bd.y;
  var dLen = Math.sqrt(dx * dx + dy * dy) || 1;
  var nx = dx / dLen, ny = dy / dLen;

  // Apply difficulty-based aim error.
  var err = (Math.random() * 2 - 1) * cfg.angleErr;
  var c = Math.cos(err), s = Math.sin(err);
  var rx = nx * c - ny * s, ry = nx * s + ny * c;

  var pf = cfg.powerMin + Math.random() * (cfg.powerMax - cfg.powerMin);
  var power = pf * MAX_SHOT_POWER;

  return { diskIndex: best, vx: rx * power, vy: ry * power };
}

// Apply a snapshot that arrived while we were animating, now that we've settled.
function flushPendingSnapshot() {
  if (pendingSnapshot && !physicsRunning) {
    var s = pendingSnapshot;
    pendingSnapshot = null;
    applyBoardSnapshot(s);
  }
}

// ── Score & UI ───────────────────────────────────────────
function updateScoreDisplay() {
  score1El.textContent = score[0];
  score2El.textContent = score[1];
}

function updateTurnIndicator(text) {
  if (text) {
    turnIndicator.textContent = text;
    turnIndicator.className = "turn-indicator";
    return;
  }

  if (gamePhase === "animating") {
    turnIndicator.textContent = "...";
    turnIndicator.className = "turn-indicator";
    return;
  }

  var isMyTurn = currentTurn === myPlayer;
  var turnPlayerId = players[currentTurn - 1];
  var name = turnPlayerId === myId ? "Your" : ((playerNames[turnPlayerId] || "Opponent") + "'s");
  turnIndicator.textContent = name + " Turn";
  turnIndicator.className = "turn-indicator " + (isMyTurn ? "my-turn" : "opp-turn");
}

function updateActivePanel() {
  player1Panel.classList.toggle("active", currentTurn === 1);
  player2Panel.classList.toggle("active", currentTurn === 2);
}

// ── Match End ────────────────────────────────────────────
function onMatchEnd(winner) {
  if (gamePhase === "ended") return; // already ended — avoid snapshot ping-pong / double confetti
  cancelBotMove();
  gamePhase = "ended";

  var winnerIdx = winner - 1;
  var name;
  var wId = players[winnerIdx];
  name = wId === myId ? "You" : (playerNames[wId] || "Opponent");

  winnerName.textContent = name;
  winnerScoreEl.textContent = score[0] + " - " + score[1];
  spawnConfetti();
  winnerOverlay.classList.add("show");

  recordOutcome(winner);
  hostCheckpoint();

  rematchState = "idle";
  syncRematchUi();
  broadcastBoardSnapshot();
}

// ── Rematch ──────────────────────────────────────────────
function requestRematch() {
  if (botMode) {
    // No opponent to ask — just restart immediately.
    resetForRematch();
    return;
  }
  rematchRequested = true;
  rematchState = "requested";
  syncRematchUi();
  broadcastRematchState();
  Usion.game.requestRematch();
}

function acceptRematch() {
  rematchRequested = true;
  resetForRematch();
  broadcastBoardSnapshot();
  Usion.game.requestRematch();
}

function resetForRematch() {
  rematchRequested = false;
  rematchState = "idle";
  pendingShot = false;
  goalScored = false;
  pendingSnapshot = null;
  lastSnapshotVersion = 0;
  statsRecordedThisGame = false;
  score = [0, 0];
  currentTurn = 1;
  roundStarter = 1;
  roundShotCount = 0;
  gamePhase = "tactics";
  opponentAttackTactic = "1-3-2";
  opponentDefenseTactic = "1-3-2";
  myAttackTactic = "1-3-2";
  myDefenseTactic = "1-3-2";
  updateScoreDisplay();
  winnerOverlay.classList.remove("show");
  goalOverlay.classList.remove("show");
  foulOverlay.classList.remove("show");
  winnerPlayAgain.textContent = "Rematch";
  winnerPlayAgain.disabled = false;
  _rematchAction = requestRematch;

  // Reset tactic selection UI
  document.querySelectorAll("#attackGrid .tactic-option").forEach(function (o, i) {
    o.classList.toggle("selected", i === 0);
  });
  document.querySelectorAll("#defenseGrid .tactic-option").forEach(function (o, i) {
    o.classList.toggle("selected", i === 0);
  });

  showTacticSelection();
}

var _rematchAction = null;
winnerPlayAgain.addEventListener("click", function () {
  if (_rematchAction) _rematchAction();
});

function syncRematchUi() {
  if (gamePhase !== "ended") return;
  if (rematchState === "requested") {
    if (rematchRequested) {
      winnerPlayAgain.textContent = "Waiting...";
      winnerPlayAgain.disabled = true;
      _rematchAction = null;
    } else {
      winnerPlayAgain.textContent = "Accept Rematch";
      winnerPlayAgain.disabled = false;
      _rematchAction = acceptRematch;
    }
    return;
  }
  winnerPlayAgain.textContent = "Rematch";
  winnerPlayAgain.disabled = false;
  _rematchAction = requestRematch;
}

function applyRematchState(payload) {
  var s = String(payload.state || "idle");
  if (!["idle", "requested"].includes(s)) return;
  rematchState = s;
  syncRematchUi();
}

// ── Snapshots ────────────────────────────────────────────
// Snapshots use normalized coordinates (0-1) so different screen sizes stay in sync
function getBoardSnapshot() {
  return {
    disks: disks.map(function (d) {
      return { x: d.x / fieldW, y: d.y / fieldH, vx: d.vx / fieldW, vy: d.vy / fieldH, player: d.player };
    }),
    ball: { x: ball.x / fieldW, y: ball.y / fieldH, vx: ball.vx / fieldW, vy: ball.vy / fieldH },
    score: score.slice(),
    currentTurn: currentTurn,
    gamePhase: gamePhase,
    roundStarter: roundStarter,
    roundShotCount: roundShotCount,
    foulActive: foulActive,
    rematchState: rematchState,
    // Player-relative formations so a reconnecting client can rebuild the board
    // correctly after future goals (resetRound → setupDisksAndBall needs these).
    tactics: {
      1: (myPlayer === 1
        ? { atk: myAttackTactic, def: myDefenseTactic }
        : { atk: opponentAttackTactic, def: opponentDefenseTactic }),
      2: (myPlayer === 2
        ? { atk: myAttackTactic, def: myDefenseTactic }
        : { atk: opponentAttackTactic, def: opponentDefenseTactic })
    },
    version: Date.now()
  };
}

function broadcastBoardSnapshot() {
  if (botMode) return; // no remote opponent to sync with
  var snap = getBoardSnapshot();
  lastSnapshotVersion = Math.max(lastSnapshotVersion, snap.version);
  Usion.game.realtime("board_state", snap);
  // Host-only: persist a compact authoritative checkpoint for reconnecting clients.
  if (isHostPlayer()) {
    try {
      if (window.Usion && Usion.game && Usion.game.setState) Usion.game.setState(snap);
    } catch (_) {}
  }
}

function broadcastRematchState() {
  if (botMode) return;
  Usion.game.realtime("rematch_state", { state: rematchState });
}

function applyBoardSnapshot(snap) {
  var v = Number(snap.version || 0);
  if (v && v < lastSnapshotVersion) return;

  // If we're mid-animation of a real shot, don't yank objects to the snapshot's
  // resting positions — our deterministic simulation reaches the same end state.
  // Stash it and apply as a smooth correction once the animation settles.
  if (physicsRunning && !snapshotPhysics) {
    pendingSnapshot = snap;
    return;
  }

  lastSnapshotVersion = Math.max(lastSnapshotVersion, v);

  if (Array.isArray(snap.disks)) {
    disks = snap.disks.map(function (d) {
      return {
        x: d.x * fieldW, y: d.y * fieldH,
        vx: (d.vx || 0) * fieldW, vy: (d.vy || 0) * fieldH,
        player: d.player, radius: DISK_RADIUS
      };
    });
  }
  if (snap.ball) {
    ball = {
      x: snap.ball.x * fieldW, y: snap.ball.y * fieldH,
      vx: (snap.ball.vx || 0) * fieldW, vy: (snap.ball.vy || 0) * fieldH,
      radius: BALL_RADIUS
    };
  }
  if (snap.score) score = snap.score.slice();
  if (snap.currentTurn) currentTurn = snap.currentTurn;
  if (snap.roundStarter) roundStarter = snap.roundStarter;
  if (snap.roundShotCount !== undefined) roundShotCount = snap.roundShotCount;
  if (snap.rematchState) rematchState = snap.rematchState;

  // Show/hide foul overlay to match sender's state
  if (snap.foulActive && !foulActive) {
    foulActive = true;
    foulOverlay.classList.add("show");
    goalScored = true;
    setTimeout(function () {
      foulOverlay.classList.remove("show");
      foulActive = false;
    }, 1500);
  } else if (!snap.foulActive && foulActive) {
    foulOverlay.classList.remove("show");
    foulActive = false;
  }

  // Show/hide goal overlay to match sender's state
  if (snap.gamePhase === "goal" && !snap.foulActive) {
    goalOverlay.classList.add("show");
    goalScored = true;
  } else if (snap.gamePhase !== "goal") {
    goalOverlay.classList.remove("show");
  }

  pendingShot = false;
  updateScoreDisplay();
  updateTurnIndicator();
  updateActivePanel();

  // If objects are still moving, run physics
  if (!allStopped()) {
    snapshotPhysics = true;
    gamePhase = "animating";
    startPhysicsLoop();
  } else {
    gamePhase = snap.gamePhase || "playing";
    if (gamePhase === "ended" && (score[0] >= GOALS_TO_WIN || score[1] >= GOALS_TO_WIN)) {
      var winner = score[0] >= GOALS_TO_WIN ? 1 : 2;
      onMatchEnd(winner);
    }
  }

  render();
}

// ── Share ────────────────────────────────────────────────
winnerShare.addEventListener("click", function () {
  var name = winnerName.textContent;
  Usion.share({
    contentType: "text",
    text: name + " won at Table Soccer! " + score[0] + "-" + score[1] + " ⚽",
    title: "Table Soccer",
    message: name + " won at Table Soccer! ⚽"
  });
});

// ── Confetti ─────────────────────────────────────────────
function spawnConfetti() {
  var colors = ["#ff2e2e", "#ffc400", "#3d42ff", "#ff2f6e", "#00e5ff", "#76ff03", "#ff6b2e"];
  for (var i = 0; i < 40; i++) {
    var el = document.createElement("div");
    el.className = "confetti-piece";
    el.style.left = Math.random() * 100 + "%";
    el.style.top = "0px";
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDelay = Math.random() * 0.8 + "s";
    el.style.animationDuration = (0.9 + Math.random() * 0.8) + "s";
    el.style.transform = "rotate(" + Math.random() * 360 + "deg)";
    winnerCard.appendChild(el);
    el.addEventListener("animationend", function () { el.remove(); });
  }
}

// ── Boot ─────────────────────────────────────────────────
render();
