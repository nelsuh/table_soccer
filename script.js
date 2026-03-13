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
  const w = Math.min(container.clientWidth, 400);
  // Calculate available height: viewport minus topbar, turn indicator, controls, and padding
  var topbar = document.querySelector(".topbar");
  var turnInd = document.getElementById("turnIndicator");
  var controls = document.querySelector(".controls");
  var usedHeight = (topbar ? topbar.offsetHeight : 0) +
                   (turnInd ? turnInd.offsetHeight : 0) +
                   (controls ? controls.offsetHeight : 0) + 40; // 40px for margins/padding
  var availH = window.innerHeight - usedHeight;
  var h = Math.min(w * 1.5, availH); // 2:3 aspect ratio but cap to available height
  h = Math.max(h, w); // minimum 1:1 ratio
  canvas.width = w * window.devicePixelRatio;
  canvas.height = h * window.devicePixelRatio;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  fieldW = w;
  fieldH = h;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ── Usion Init ───────────────────────────────────────────
Usion.init(async function (config) {
  myId = config.userId;
  playerNames[myId] = config.userName || "You";
  if (config.userAvatar) playerAvatars[myId] = config.userAvatar;

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
  if (gamePhase !== "ended") updateTurnIndicator("Opponent left the game");
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
  if (!data.actions || data.actions.length === 0) return;
  // Replay from snapshot is handled via realtime board_state, not full action replay
  // because physics replays are non-deterministic
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
  winnerOverlay.classList.remove("show");
  goalOverlay.classList.remove("show");
  updateScoreDisplay();
  resetRound();
}

function resetRound() {
  setupDisksAndBall();
  selectedDisk = null;
  dragStart = null;
  dragCurrent = null;
  roundShotCount = 0;
  goalScored = false;
  foulActive = false;
  pendingShot = false;
  snapshotPhysics = false;
  gamePhase = "playing";
  updateTurnIndicator();
  updateActivePanel();
  render();
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
  drawField();
  drawGoals();
  drawDisks();
  drawBall();
  drawAimIndicator();
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
  return {
    x: (touch.clientX - rect.left) * (fieldW / rect.width),
    y: (touch.clientY - rect.top) * (fieldH / rect.height)
  };
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

  var shotData = {
    diskIndex: selectedDisk,
    vx: vx,
    vy: vy,
    player: currentTurn
  };

  executeShot(shotData);

  // Send normalized velocities to opponent so different screen sizes work
  var netShotData = {
    diskIndex: selectedDisk,
    vx: vx / fieldW,
    vy: vy / fieldH,
    player: currentTurn
  };

  pendingShot = true;
  Usion.game.action("shot", netShotData).catch(function () {
    pendingShot = false;
    Usion.game.requestSync(0);
  });
  broadcastBoardSnapshot();

  selectedDisk = null;
  dragStart = null;
  dragCurrent = null;
}

function applyShot(data) {
  if (data.player !== currentTurn) return;
  // Find the right disk for the opponent's shot
  var diskIdx = data.diskIndex;
  if (diskIdx === undefined || diskIdx < 0 || diskIdx >= disks.length) return;
  if (disks[diskIdx].player !== data.player) return;

  // Velocities arrive normalized (fraction of field size), convert to local pixels
  disks[diskIdx].vx = data.vx * fieldW;
  disks[diskIdx].vy = data.vy * fieldH;
  roundShotCount++;

  snapshotPhysics = false;
  gamePhase = "animating";
  startPhysicsLoop();
}

function executeShot(data) {
  var d = disks[data.diskIndex];
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
  physicsStep();
}

function physicsStep() {
  if (!physicsRunning) return;

  updatePhysics();
  render();

  if (checkGoal()) return;

  if (allStopped()) {
    physicsRunning = false;
    onShotComplete();
    return;
  }

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
  // First shot of the round scoring a goal is a foul
  // roundShotCount is 1 when the very first shot of the round scores
  if (roundShotCount === 1) {
    gamePhase = "goal";
    foulActive = true;
    foulOverlay.classList.add("show");
    broadcastBoardSnapshot();

    setTimeout(function () {
      foulOverlay.classList.remove("show");
      foulActive = false;
      // Give the turn to the other player, restart the round
      var foulPlayer = roundStarter;
      roundStarter = foulPlayer === 1 ? 2 : 1;
      currentTurn = roundStarter;
      resetRound();
      broadcastBoardSnapshot();
    }, 1500);
    return;
  }

  score[scoringPlayer - 1]++;
  updateScoreDisplay();
  gamePhase = "goal";

  goalOverlay.classList.add("show");
  broadcastBoardSnapshot();

  setTimeout(function () {
    goalOverlay.classList.remove("show");

    if (score[scoringPlayer - 1] >= GOALS_TO_WIN) {
      onMatchEnd(scoringPlayer);
      return;
    }

    // Next round: opponent of scorer starts
    roundStarter = scoringPlayer === 1 ? 2 : 1;
    currentTurn = roundStarter;
    resetRound();

    broadcastBoardSnapshot();
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
    return;
  }

  // Switch turns
  pendingShot = false;
  currentTurn = currentTurn === 1 ? 2 : 1;
  gamePhase = "playing";
  updateTurnIndicator();
  updateActivePanel();

  broadcastBoardSnapshot();
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
  gamePhase = "ended";

  var winnerIdx = winner - 1;
  var name;
  var wId = players[winnerIdx];
  name = wId === myId ? "You" : (playerNames[wId] || "Opponent");

  winnerName.textContent = name;
  winnerScoreEl.textContent = score[0] + " - " + score[1];
  spawnConfetti();
  winnerOverlay.classList.add("show");

  rematchState = "idle";
  syncRematchUi();
  broadcastBoardSnapshot();
}

// ── Rematch ──────────────────────────────────────────────
function requestRematch() {
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
  lastSnapshotVersion = 0;
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
    version: Date.now()
  };
}

function broadcastBoardSnapshot() {
  var snap = getBoardSnapshot();
  lastSnapshotVersion = Math.max(lastSnapshotVersion, snap.version);
  Usion.game.realtime("board_state", snap);
}

function broadcastRematchState() {
  Usion.game.realtime("rematch_state", { state: rematchState });
}

function applyBoardSnapshot(snap) {
  var v = Number(snap.version || 0);
  if (v && v < lastSnapshotVersion) return;
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
