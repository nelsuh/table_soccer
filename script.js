// ── Table Soccer ─────────────────────────────────────────
// Turn-based 2-player table soccer for the Usion platform — open-sourced as a
// best-practice reference for the Usion SDK (window.Usion).
//
// Multiplayer model: AUTHORITATIVE SHOOTER. Both clients run the same
// deterministic fixed-timestep physics in fixed logical units, so a shot
// animates to the identical resting state everywhere; the client who took the
// shot is the single authority for its outcome (goal/foul/turn) and broadcasts
// the settled board. Reconnect recovery = durable setState checkpoint +
// live board_state push. A solo launch (Explore/GameTok) drops straight into a
// bot match and can be promoted into a live room mid-session
// (Usion.game.onRoomAssigned). UI is bilingual (mn/en) via the STR table +
// Usion.getLanguage().

// ── i18n ─────────────────────────────────────────────────
// Every user-facing string lives here, chosen via the platform's language
// setting (Usion.getLanguage()) — never hardcode UI text to one locale.
const STR = {
  mn: {
    docTitle: "Ширээний хөл бөмбөг",
    you: "Та",
    opponent: "Өрсөлдөгч",
    playerN: i => "Тоглогч " + i,
    firstTo: n => "Эхний " + n + " гоол",
    yourTurn: "Таны ээлж",
    turnOf: n => n + " — ээлж",
    waitingOpponent: "Өрсөлдөгчийг хүлээж байна…",
    orOffline: "— эсвэл оффлайн тоглох —",
    easy: "Хялбар",
    medium: "Дунд",
    hard: "Хэцүү",
    playVsBot: "БОТТОЙ ТОГЛОХ",
    botName: d => "Бот (" + d + ")",
    selectFormation: "БАЙРЛАЛАА СОНГО",
    attacking: "ДОВТОЛГОО",
    defensive: "ХАМГААЛАЛТ",
    startingInPre: "Тоглоом ",
    startingInPost: " секундын дараа эхэлнэ",
    confirm: "БАТЛАХ",
    waitingOppConfirm: "ӨРСӨЛДӨГЧИЙГ ХҮЛЭЭЖ БАЙНА…",
    goal: "ГООЛ!",
    foul: "ФОЛ!",
    foulSub: "Эхний цохилтын гоол тооцогдохгүй",
    winnerLabel: "Ялагч",
    restart: "Дахин эхлүүлэх",
    rematch: "Дахин тоглох",
    acceptRematch: "Зөвшөөрөх",
    waitingDots: "Хүлээж байна…",
    share: "Хуваалцах",
    connLost: "Холболт тасарлаа — түр зогслоо…",
    oppLeftGame: "Өрсөлдөгч тоглоомоос гарлаа",
    leftGrace: s => "Өрсөлдөгч гарлаа — дахин нэгдэхийг хүлээж байна… (" + s + "с)",
    shareText: (n, a, b) => n + " Ширээний хөл бөмбөгт " + a + "-" + b + " хожлоо! ⚽",
    nWonTitle: "Та хожлоо! 🎉",
    nWonBody: "Та ширээний хөл бөмбөгийн тоглолтод хожлоо",
    nLostTitle: "Тоглолт дууслаа",
    nLostBody: "Таны ширээний хөл бөмбөгийн тоглолт дууслаа",
    nTurnTitle: "Таны ээлж",
    nTurnBody: "Ширээний хөл бөмбөгт таны цохих ээлж",
    nLeftTitle: "Өрсөлдөгч гарлаа",
    nLeftBody: "Таны тоглолтоос өрсөлдөгч гарлаа",
  },
  en: {
    docTitle: "Table Soccer",
    you: "You",
    opponent: "Opponent",
    playerN: i => "Player " + i,
    firstTo: n => "First to " + n,
    yourTurn: "Your Turn",
    turnOf: n => n + "'s Turn",
    waitingOpponent: "Waiting for opponent…",
    orOffline: "— or play offline —",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    playVsBot: "PLAY VS BOT",
    botName: d => "Bot (" + d + ")",
    selectFormation: "SELECT YOUR FORMATION",
    attacking: "ATTACKING",
    defensive: "DEFENSIVE",
    startingInPre: "Starting game in ",
    startingInPost: "",
    confirm: "CONFIRM",
    waitingOppConfirm: "WAITING FOR OPPONENT…",
    goal: "GOAL!",
    foul: "FOUL!",
    foulSub: "First shot goal is not allowed",
    winnerLabel: "Winner",
    restart: "Restart",
    rematch: "Rematch",
    acceptRematch: "Accept Rematch",
    waitingDots: "Waiting…",
    share: "Share",
    connLost: "Connection lost — paused…",
    oppLeftGame: "Opponent left the game",
    leftGrace: s => "Opponent left — waiting to rejoin… (" + s + "s)",
    shareText: (n, a, b) => n + " won at Table Soccer! " + a + "-" + b + " ⚽",
    nWonTitle: "You won! 🎉",
    nWonBody: "You won your Table Soccer match",
    nLostTitle: "Match over",
    nLostBody: "Your Table Soccer match has ended",
    nTurnTitle: "Your turn",
    nTurnBody: "It's your shot in Table Soccer",
    nLeftTitle: "Opponent left",
    nLeftBody: "Your opponent left the Table Soccer match",
  },
};
let LANG = "en";
function t(key) {
  let v = STR[LANG] ? STR[LANG][key] : undefined;
  if (v === undefined) v = STR.mn[key];
  if (typeof v === "function") return v.apply(null, Array.prototype.slice.call(arguments, 1));
  return v !== undefined ? v : key;
}
function detectLang() {
  // This game defaults to English. It reads the platform language when available
  // and only switches to Mongolian if that language is explicitly Mongolian.
  try {
    const pl = (typeof Usion !== "undefined" && Usion.getLanguage && Usion.getLanguage()) ||
               (navigator.language || "");
    if (String(pl).toLowerCase().indexOf("mn") === 0) return "mn";
  } catch (_) {}
  return "en";
}

// ── Constants ────────────────────────────────────────────
const GOALS_TO_WIN = 3;
const DISK_RADIUS = 18;
const BALL_RADIUS = 10;
const GOAL_WIDTH_RATIO = 0.40; // goal-mouth width as a fraction of field width
const SIDE_PAD = 16;  // left/right wall inset (px)
const END_PAD  = 40;  // top/bottom goal-line inset (px). Also the goal-pocket depth:
                      // disks AND the ball can travel through the mouth into this
                      // pocket, so a disk can push the ball through the line.
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
let matchStarted = false;  // true once initMatch ran for the current match — the
                           // re-entry guard for tryStartMatch (decoupled from
                           // gamePhase, which incoming snapshots can mutate).
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
// Highest snapshot version seen PER sender. Versions are stamped from a local
// monotonic counter (snapshotSeq), which is only ordered within one client — so
// we must compare per-sender, never across two devices, or skew silently drops
// valid moves and stalls the match. (Mirrors connect_four.)
let lastSnapshotVersionByPlayer = {};
let pendingSnapshotFrom = null;
let snapshotSeq = 0;
let rematchRequested = false;
let rematchState = "idle";
let pendingShot = false;
let snapshotPhysics = false; // true when physics is running from a received snapshot (not a local shot)
let physicsAccumulator = 0;
let lastPhysicsTime = 0;
let scheduledShotTimer = null;
let pendingSnapshot = null; // snapshot received mid-animation, applied once it settles
let netPaused = false;      // true while disconnected → freeze physics/timers until resync
let forfeitTimer = null;    // grace countdown after an opponent leaves
const FORFEIT_GRACE_MS = 20000;

// Monotonic per-match counter — makes each match's Game Center result report
// idempotent (dedupes ack retries; a rematch is a genuinely new match).
let matchSeq = 0;

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

// ── Language / theme / avatar helpers ────────────────────
function applyLang(lang) {
  LANG = lang === "en" ? "en" : "mn";
  document.documentElement.lang = LANG;
  document.title = t("docTitle");
  var set = function (id, key) { var el = document.getElementById(id); if (el) el.textContent = t(key); };
  var goalsInfo = document.getElementById("goalsInfo");
  if (goalsInfo) goalsInfo.textContent = t("firstTo", GOALS_TO_WIN);
  set("waitingText", "waitingOpponent");
  set("botLabel", "orOffline");
  document.querySelectorAll(".bot-diff-btn").forEach(function (b) { b.textContent = t(b.dataset.diff); });
  set("playBotBtn", "playVsBot");
  set("tacticTitle", "selectFormation");
  set("atkSection", "attacking");
  set("defSection", "defensive");
  set("tacticTimerPre", "startingInPre");
  set("tacticTimerPost", "startingInPost");
  set("tacticConfirm", "confirm");
  set("goalText", "goal");
  set("foulText", "foul");
  set("foulSub", "foulSub");
  set("winnerLabel", "winnerLabel");
  set("resetBtn", "restart");
  set("winnerPlayAgain", "rematch");
  set("winnerShare", "share");
}

// Respect the platform theme. The pitch itself is art-directed (green felt on
// every theme), so the theme only tints the page chrome via CSS.
function applyTheme() {
  var theme = "dark";
  try { if (window.Usion && typeof Usion.getTheme === "function") theme = Usion.getTheme() || "dark"; } catch (_) {}
  document.documentElement.dataset.theme = theme;
}

// Self-contained fallback avatar (initial on a colored circle) — no external
// CDN, so the bundle works offline and inside the platform's network rules.
function fallbackAvatar(name, hue) {
  var initial = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
    '<rect width="64" height="64" rx="32" fill="hsl(' + (hue || 0) + ',55%,45%)"/>' +
    '<text x="32" y="43" font-family="sans-serif" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">' + initial + '</text></svg>';
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
var P1_HUE = 0, P2_HUE = 215; // matches the red/blue disk teams

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

// ── Launch mode ──────────────────────────────────────────
// Did the platform open us solo (GameTok / Explore) rather than from a real
// chat game-invite? Trust the launch MODE — never infer from roomId alone,
// because a solo launch may still be handed an auto-created (standalone_) room
// for SDK plumbing. Only a 'multiplayer' launch goes online.
function launchedSolo(config) {
  try {
    var lp = {};
    if (window.Usion && typeof Usion.getLaunchParams === "function") lp = Usion.getLaunchParams() || {};
    if (lp.mode === "single") return true;
    if (lp.mode === "multiplayer") return false;
    // SDK without the mode field: boolean shortcut, then "only a non-standalone
    // roomId is a real multiplayer room".
    if (window.Usion && Usion.game && typeof Usion.game.isMultiplayer === "function")
      return !Usion.game.isMultiplayer();
    var rid = config && config.roomId ? String(config.roomId) : "";
    return !rid || /^standalone[_-]/i.test(rid);
  } catch (_) { return false; }
}

// ── Usion Init ───────────────────────────────────────────
Usion.init(async function (config) {
  applyLang(detectLang());   // the platform's language setting is known now
  applyTheme();
  myId = config.userId;
  playerNames[myId] = config.userName || t("you");
  if (config.userAvatar) playerAvatars[myId] = config.userAvatar;
  // Canonical platform roster (playerIds[0] = host). Seed seating from it so
  // both clients agree on player 1 vs 2 (orientation + disk ownership) even if
  // the per-client join ack arrives in a different order.
  if (config.playerIds && config.playerIds.length) players = config.playerIds.slice();
  loadStats(); // fire-and-forget; never block init/render

  // Registered up front REGARDLESS of launch mode: a solo launch can be
  // promoted into a live room mid-session via the host's Share button.
  try {
    if (Usion.game && Usion.game.onRoomAssigned) Usion.game.onRoomAssigned(function () { onRoomPromoted(); });
  } catch (_) {}

  if (!launchedSolo(config) && config.roomId) {
    showWaiting();
    await setupMultiplayer(config.roomId);
  } else {
    // Solo launch (GameTok / Explore, mode 'single') → zero-tap bot match, no
    // menu. The chat game-invite path is the only one that goes online.
    botDifficulty = "medium";
    startBotGame();
  }
});

// ── Multiplayer ──────────────────────────────────────────
async function setupMultiplayer(roomId) {
  try {
    await Usion.game.connect();
    registerNetHandlers();
    await Usion.game.join(roomId);
  } catch (err) {
    console.error("Multiplayer failed:", err);
    hideWaiting();
  }
}

var netHandlersRegistered = false;
function registerNetHandlers() {
  if (netHandlersRegistered) return; // promotion can race a normal join — register once
  netHandlersRegistered = true;
  Usion.game.onJoined(onJoined);
  Usion.game.onPlayerJoined(onPlayerJoined);
  Usion.game.onPlayerLeft(onPlayerLeft);
  Usion.game.onAction(onAction);
  Usion.game.onSync(onSync);
  Usion.game.onRealtime(onRealtime);
  Usion.game.onRematchRequest(onRematchRequest);
  Usion.game.onGameRestarted(onGameRestarted);
  Usion.game.onDisconnect(function () {
    if (botMode || gamePhase === "ended") return;
    // Real pause: freeze any in-flight animation + bot/tactic timers so a
    // disconnected client can't drift ahead of the others. Resync restores
    // the authoritative state on return.
    netPaused = true;
    pausePhysics();
    cancelBotMove();
    updateTurnIndicator(t("connLost"));
  });
  Usion.game.onReconnect(function () {
    netPaused = false;
    if (gamePhase !== "ended") {
      updateTurnIndicator();
      // Pull the host checkpoint (game_state) AND ask a peer for the live
      // resting snapshot, so a shot that settled while we were away is caught.
      Usion.game.requestSync(0);
      try { Usion.game.realtime("request_state", {}); } catch (_) {}
    }
  });
}

// Solo → host promotion (SDK ≥ 2.20): the user tapped the host's top-bar Share
// button mid-solo and invited someone. The SDK has ALREADY updated
// getLaunchParams().roomId and is connect()+join()ing us as playerIds[0] — our
// job is to tear down the bot round, register the net handlers, and open the
// waiting overlay; onJoined lands right after and the normal flow takes over.
function onRoomPromoted() {
  if (!botMode && !waitingForOpponent) return; // already in a live online match
  cancelBotMove();
  pausePhysics();
  clearInterval(tacticTimerInterval);
  botMode = false;
  matchStarted = false;
  waitingForOpponent = true;
  connectedCount = 0;
  gamePhase = "waiting";
  score = [0, 0];
  updateScoreDisplay();
  myTacticsConfirmed = false;
  opponentTacticsReceived = false;
  players = [myId];
  myPlayer = 0;
  tacticOverlay.classList.remove("show");
  goalOverlay.classList.remove("show");
  foulOverlay.classList.remove("show");
  winnerOverlay.classList.remove("show");
  // An invite is out — playing a bot instead would fork the room's state.
  var botOptions = document.querySelector(".bot-options");
  if (botOptions) botOptions.style.display = "none";
  updatePlayerDisplay();
  showWaiting();
  registerNetHandlers();
}

function onJoined(data) {
  if (data.player_ids && data.player_ids.length) players = data.player_ids;
  connectedCount = Number(data.connected_count || 0);
  if (data.sequence !== undefined) lastSequence = data.sequence;

  Usion.game.realtime("player_info", {
    name: playerNames[myId],
    avatar: playerAvatars[myId] || null
  });

  // The join ack may carry the host's checkpoint as game_state — rebuild the
  // live match straight away so a rejoin resumes instead of sitting blank.
  if (data.game_state && applyCheckpoint(data.game_state)) {
    try { Usion.game.realtime("request_state", {}); } catch (_) {}
    return;
  }

  if (connectedCount >= 2 && waitingForOpponent) {
    startOnlineGame();
  }
}

function onPlayerJoined(data) {
  if (data.player_ids) players = data.player_ids;
  else if (data.player && data.player.id && !players.includes(data.player.id)) players.push(data.player.id);
  if (typeof data.connected_count === "number") connectedCount = Math.max(connectedCount, data.connected_count);
  if (Array.isArray(data.player_ids) && data.player_ids.length >= 2) connectedCount = Math.max(connectedCount, 2);
  if (data.player && data.player.is_connected) connectedCount = Math.max(connectedCount, 2);
  // A (re)joining peer may have reloaded, restarting its snapshot counter at 0 —
  // re-baseline per-sender versioning so its fresh snapshots aren't dropped as stale.
  lastSnapshotVersionByPlayer = {};

  if (forfeitTimer) resumeFromGrace(); // opponent came back during the grace window

  Usion.game.realtime("player_info", {
    name: playerNames[myId],
    avatar: playerAvatars[myId] || null
  });

  if (connectedCount >= 2 && waitingForOpponent) startOnlineGame();
}

function onPlayerLeft(data) {
  if (data && data.player_ids && data.player_ids.length) players = data.player_ids;
  connectedCount = Math.max(0, connectedCount - 1);
  if (gamePhase === "ended") return;
  if (gamePhase === "tactics" || waitingForOpponent) {
    updateTurnIndicator(t("oppLeftGame"));
    return;
  }
  // Mid-match: give the opponent a grace window to rejoin before forfeit.
  startForfeitGrace();
}

// ── Forfeit grace (opponent left) ────────────────────────
// Mirror the 13/mini_golf model: a player who drops mid-match has FORFEIT_GRACE_MS
// to return before the remaining player wins. Input is frozen while the timer runs.
function clearForfeitGrace() {
  if (forfeitTimer) { clearInterval(forfeitTimer); forfeitTimer = null; }
}

function startForfeitGrace() {
  if (botMode) return;
  clearForfeitGrace();
  pausePhysics();
  cancelBotMove();
  var secs = Math.ceil(FORFEIT_GRACE_MS / 1000);
  updateTurnIndicator(t("leftGrace", secs));
  notifySelf(t("nLeftTitle"), t("nLeftBody"));
  forfeitTimer = setInterval(function () {
    if (gamePhase === "ended" || connectedCount > 1) { clearForfeitGrace(); return; }
    secs -= 1;
    if (secs > 0) {
      updateTurnIndicator(t("leftGrace", secs));
      return;
    }
    clearForfeitGrace();
    if (gamePhase !== "ended" && connectedCount <= 1) forfeitWin();
  }, 1000);
}

// A peer is back → cancel the pending forfeit and reconcile state.
function resumeFromGrace() {
  if (!forfeitTimer) return;
  clearForfeitGrace();
  connectedCount = Math.max(connectedCount, 2);
  updateTurnIndicator();
  try { Usion.game.requestSync(0); } catch (_) {}
}

// Remaining player wins by forfeit, regardless of the running score.
function forfeitWin() {
  clearForfeitGrace();
  if (gamePhase === "ended") return;
  onMatchEnd(myPlayer || 1);
}

function onAction(data) {
  if (data.sequence !== undefined) lastSequence = Math.max(lastSequence, data.sequence);
  if (data.player_id && data.player_id !== myId && forfeitTimer) resumeFromGrace();

  if (data.action_type === "shot" && data.player_id !== myId) {
    applyShot(data.action_data);
  }
  if (data.action_type === "tactics" && data.player_id !== myId) {
    opponentAttackTactic = data.action_data.attack || "1-3-2";
    opponentDefenseTactic = data.action_data.defense || "1-3-2";
    opponentTacticsReceived = true;
    tryStartMatch();
  }
  if (data.action_type === "rematch") {
    // Replay-safe restart. Platform mode has NO server-side restart event
    // (requestRematch is a pure broadcast), so the accept is a STORED action:
    // it applies on the sequenced ECHO for sender and receiver alike —
    // exactly-once, and a rejoiner replaying the log lands in the same state.
    if (gamePhase !== "tactics") resetForRematch(); // duplicate accepts collapse here
  }
  // pendingShot is cleared in onShotComplete after physics settle
}

function onSync(data) {
  pendingShot = false;
  if (data.sequence !== undefined) lastSequence = data.sequence;

  // Checkpoint path: any participant's setState() (actor-written, not host-only)
  // compacts the log, so sync carries game_state (the latest settled resting
  // board). Rebuild from it directly — the authoritative-shooter model needs no
  // shot replay (shots ride the realtime channel, not the durable action log, so
  // there is no tail to replay over the checkpoint); a shot still in flight
  // converges via the live board_state snapshot onReconnect/onJoined also request.
  if (data.game_state && applyCheckpoint(data.game_state)) return;

  // No checkpoint yet (match not started) → replay the tactics actions so a
  // late joiner / reconnect during selection still learns the opponent's pick.
  if (!data.actions || data.actions.length === 0) return;
  data.actions.forEach(function (a) {
    if (a.action_type === "tactics" && a.player_id !== myId) {
      opponentAttackTactic = a.action_data.attack || "1-3-2";
      opponentDefenseTactic = a.action_data.defense || "1-3-2";
      opponentTacticsReceived = true;
      tryStartMatch();
    }
  });
}

function onRealtime(data) {
  // Any packet from a peer proves they're connected → cancel a pending forfeit.
  if (data.player_id && data.player_id !== myId && forfeitTimer) resumeFromGrace();
  if (data.action_type === "request_state" && data.player_id !== myId) {
    // A peer rejoined and wants the live resting board. The host answers (both
    // clients agree on a settled state, so one responder is enough).
    if (isHostPlayer() && gamePhase !== "tactics" && !waitingForOpponent) broadcastBoardSnapshot();
    return;
  }
  if (data.action_type === "player_info" && data.player_id !== myId) {
    if (data.action_data.name) playerNames[data.player_id] = data.action_data.name;
    if (data.action_data.avatar) playerAvatars[data.player_id] = data.action_data.avatar;
    updatePlayerDisplay();
    return;
  }
  if (data.action_type === "board_state" && data.player_id !== myId) {
    applyBoardSnapshot(data.action_data, data.player_id);
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
    // Both pressed "Rematch" at the same time — nobody is left to "accept", so
    // a deterministic party (the host) converts the double-request into the
    // stored restart action; both clients reset on its echo in onAction.
    if (isHostPlayer()) Usion.game.action("rematch", { reset: true }).catch(function () {});
    return;
  }
  rematchState = "requested";
  syncRematchUi();
}

// Platform mode never emits game:restarted (requestRematch is a pure
// broadcast) — kept only for direct-mode hosts that do. The stored "rematch"
// action in onAction is the real restart path.
function onGameRestarted() { if (gamePhase !== "tactics") resetForRematch(); }

function startOnlineGame() {
  waitingForOpponent = false;
  myPlayer = players.indexOf(myId) + 1;
  updatePlayerDisplay();
  hideWaiting();
  showTacticSelection();
  Usion.game.requestSync(0);
  ensureNotifyPermission(); // ask ONCE, at online match start (permission-gated notify)
}

// ── Player Display ───────────────────────────────────────
function updatePlayerDisplay() {
  setPlayerPanel(player1Name, player1Avatar, players[0], 1, P1_HUE);
  setPlayerPanel(player2Name, player2Avatar, players[1], 2, P2_HUE);
}

function setPlayerPanel(nameEl, avatarEl, id, seat, hue) {
  var name = !id ? t("playerN", seat) : (id === myId ? t("you") : (playerNames[id] || t("opponent")));
  nameEl.textContent = name;
  avatarEl.src = (id && playerAvatars[id]) || fallbackAvatar(name, hue);
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
  if (!playerNames[myId]) playerNames[myId] = t("you");
  players = [myId, "BOT"];
  playerNames["BOT"] = t("botName", t(botDifficulty));

  updatePlayerDisplay();
  startBotMatchNow();
}

// GameTok contract: a solo launch must be playable with ZERO taps — skip the
// formation overlay entirely. The human keeps the "1-3-2" defaults and the bot
// randomizes, exactly like confirmTactics does; the countdown never starts.
function startBotMatchNow() {
  clearInterval(tacticTimerInterval);
  matchStarted = false;          // a fresh match/rematch can be started again
  myTacticsConfirmed = true;
  var keys = Object.keys(FORMATIONS);
  opponentAttackTactic = keys[Math.floor(Math.random() * keys.length)];
  opponentDefenseTactic = keys[Math.floor(Math.random() * keys.length)];
  opponentTacticsReceived = true;
  tryStartMatch();
}


// ── Controls ─────────────────────────────────────────────
resetBtn.addEventListener("click", function () {
  requestRematch();
});

// ── Tactic Selection ─────────────────────────────────────
function showTacticSelection() {
  gamePhase = "tactics";
  matchStarted = false;          // a fresh match/rematch can be started again
  myTacticsConfirmed = false;
  opponentTacticsReceived = false;
  tacticConfirm.textContent = t("confirm");
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
  // Re-entry guard: confirmTactics sends BOTH a realtime "tactics_selected" and a
  // durable "tactics" action, and each can land on the opponent and call us — so
  // without this, initMatch() runs twice and re-zeroes a match already in progress.
  // Guard on matchStarted (set in initMatch, cleared in showTacticSelection), NOT
  // gamePhase: an incoming snapshot can mutate gamePhase out of "tactics" while we
  // are still on the formation screen, which used to block CONFIRM entirely.
  if (matchStarted) return;
  if (!opponentTacticsReceived) {
    // Show waiting state on the tactic overlay
    tacticConfirm.textContent = t("waitingOppConfirm");
    tacticConfirm.disabled = true;
    return;
  }
  tacticOverlay.classList.remove("show");
  tacticConfirm.textContent = t("confirm");
  tacticConfirm.disabled = false;
  initMatch();
}

// ── Match Init ───────────────────────────────────────────
function initMatch() {
  matchStarted = true;
  statsRecordedThisGame = false; // each match records my outcome exactly once
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
  writeCheckpoint(); // persist the fresh round so a rejoiner resumes here
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
  var sx = SIDE_PAD, ey = END_PAD;   // x inset (sides) / y inset (ends)
  var w = fieldW, h = fieldH;

  // Green field with stripe pattern
  for (var i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#3a8c28" : "#359025";
    ctx.fillRect(0, i * h / 12, w, h / 12);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;

  // Outer boundary (square corners, matching the sketch)
  ctx.strokeRect(sx, ey, w - sx * 2, h - ey * 2);

  // Center line
  ctx.beginPath();
  ctx.moveTo(sx, h / 2);
  ctx.lineTo(w - sx, h / 2);
  ctx.stroke();

  // Center circle + kick-off dot
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Penalty boxes (large) — top & bottom
  var penW = w * 0.6, penH = h * 0.12;
  ctx.strokeRect((w - penW) / 2, ey, penW, penH);
  ctx.strokeRect((w - penW) / 2, h - ey - penH, penW, penH);

  // Goal boxes (small, 6-yard) — top & bottom
  var gbW = w * 0.45, gbH = h * 0.055;
  ctx.strokeRect((w - gbW) / 2, ey, gbW, gbH);
  ctx.strokeRect((w - gbW) / 2, h - ey - gbH, gbW, gbH);

  // Penalty spots
  ctx.beginPath(); ctx.arc(w / 2, ey + penH * 0.7, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w / 2, h - ey - penH * 0.7, 2, 0, Math.PI * 2); ctx.fill();

  // Penalty arcs (the "D") bulging into the field
  var arcR = w * 0.13;
  ctx.beginPath();
  ctx.arc(w / 2, ey + penH, arcR, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h - ey - penH, arcR, Math.PI, Math.PI * 2);
  ctx.stroke();
}

function drawGoals() {
  var goalW = fieldW * GOAL_WIDTH_RATIO;
  var gx = (fieldW - goalW) / 2;
  var pad = END_PAD;             // end line sits at y = pad / fieldH - pad
  var depth = pad;              // net pocket runs from the line to the canvas edge

  // One goal net. lineY = the goal line (end line); backY = back of the net
  // (toward the edge of the canvas, outside the pitch).
  function net(lineY, backY) {
    // Net backing
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(gx, Math.min(lineY, backY), goalW, depth);

    // Mesh (fine grid)
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (var x = gx + 5; x < gx + goalW; x += 7) {        // verticals
      ctx.moveTo(x, lineY); ctx.lineTo(x, backY);
    }
    for (var s = 0.33; s < 1; s += 0.34) {                // horizontals
      var y = lineY + (backY - lineY) * s;
      ctx.moveTo(gx, y); ctx.lineTo(gx + goalW, y);
    }
    ctx.stroke();

    // Goal frame: posts + back bar (thick white)
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gx, lineY);          ctx.lineTo(gx, backY);            // left post
    ctx.moveTo(gx + goalW, lineY);  ctx.lineTo(gx + goalW, backY);    // right post
    ctx.moveTo(gx, backY);          ctx.lineTo(gx + goalW, backY);    // back bar
    ctx.stroke();
  }

  net(pad, pad - depth);                 // top goal (net above the pitch)
  net(fieldH - pad, fieldH - pad + depth); // bottom goal (net below the pitch)
}

function drawDisks() {
  // Highlight my movable disks on my turn — but NOT while I'm aiming a drag.
  var showHighlight = currentTurn === myPlayer &&
                      gamePhase === "playing" && dragStart === null;

  disks.forEach(function (d, idx) {
    // Selectable-disk highlight (cyan glow, from commit 5de6214) — hidden while
    // aiming a drag (showHighlight already requires dragStart === null).
    if (showHighlight && d.player === myPlayer) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 229, 255, 0.25)";
      ctx.fill();
      if (selectedDisk === idx) {
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
  if (netPaused || forfeitTimer) return false; // frozen while disconnected / awaiting rejoin
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
  // Find the right disk for the opponent's shot
  var diskIdx = data.diskIndex;
  if (diskIdx === undefined || diskIdx < 0 || diskIdx >= disks.length) return;
  if (disks[diskIdx].player !== data.player) return;

  // An incoming shot from the opponent is the authoritative signal that it's
  // their turn. Sync currentTurn to it instead of gating on it — otherwise a
  // lost/late "next turn" snapshot (sent over the unreliable realtime channel)
  // leaves currentTurn stale, the shot gets dropped, and the watcher sees no
  // live move — just the board teleporting when the shot settles.
  currentTurn = data.player;
  pendingShot = true;
  updateTurnIndicator();
  updateActivePanel();

  // `startAt` is an ABSOLUTE wall-clock timestamp from the SHOOTER's device. Two
  // devices' clocks are NOT synced, so `startAt - Date.now()` here can be wildly
  // wrong: if the shooter's clock runs ahead of ours, the raw delay is several
  // seconds — we'd sit idle while the shot's settle snapshot (board_state) arrives
  // first and teleports the board to the final position, so the watcher NEVER sees
  // the disk move (and only in one direction, matching the clock-skew sign). Clamp
  // to [0, SHOT_START_DELAY_MS] so we always start animating promptly regardless of
  // skew — the brief delay just keeps the two animations roughly aligned.
  var startAt = Number(data.startAt || 0);
  var delay = startAt ? (startAt - Date.now()) : 0;
  delay = Math.max(0, Math.min(delay, SHOT_START_DELAY_MS));

  setTimeout(function () {
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
  if (netPaused || forfeitTimer) return; // don't animate while paused / awaiting rejoin
  physicsRunning = true;
  physicsAccumulator = 0;
  lastPhysicsTime = performance.now();
  animFrame = requestAnimationFrame(physicsStep);
}

// Freeze any in-flight animation without losing the board. The authoritative
// settled state is restored from the host checkpoint / live snapshot on resync.
function pausePhysics() {
  physicsRunning = false;
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
}

function physicsStep(now) {
  if (!physicsRunning) return;
  if (netPaused) { physicsRunning = false; return; } // frozen mid-flight; resync restores on return

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

  // Wall + goal-pocket collisions for every body (disks AND ball)
  disks.forEach(function (d) { clampToBounds(d, WALL_BOUNCE); });
  clampToBounds(ball, BALL_BOUNCE);

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

// Keep a body inside the pitch, but let it pass through the goal mouth into the
// goal pocket (depth = END_PAD). The pocket has a back wall (net) and two posts
// so disks/ball that enter can't fly off the field.
function clampToBounds(o, bounce) {
  var r = o.radius;
  var goalW = fieldW * GOAL_WIDTH_RATIO;
  var gx1 = (fieldW - goalW) / 2;
  var gx2 = gx1 + goalW;
  var inMouth = o.x > gx1 && o.x < gx2;

  // Left / right side walls (the pockets sit well inside these, so always safe)
  if (o.x - r < SIDE_PAD) { o.x = SIDE_PAD + r; o.vx = Math.abs(o.vx) * bounce; }
  if (o.x + r > fieldW - SIDE_PAD) { o.x = fieldW - SIDE_PAD - r; o.vx = -Math.abs(o.vx) * bounce; }

  // ── Top end ──
  if (inMouth) {
    if (o.y - r < 0) { o.y = r; o.vy = Math.abs(o.vy) * bounce; }          // net back wall
    if (o.y - r < END_PAD) {                                                // posts (in pocket)
      if (o.x - r < gx1) { o.x = gx1 + r; o.vx = Math.abs(o.vx) * bounce; }
      if (o.x + r > gx2) { o.x = gx2 - r; o.vx = -Math.abs(o.vx) * bounce; }
    }
  } else if (o.y - r < END_PAD) {                                           // solid end line
    o.y = END_PAD + r; o.vy = Math.abs(o.vy) * bounce;
  }

  // ── Bottom end ──
  if (inMouth) {
    if (o.y + r > fieldH) { o.y = fieldH - r; o.vy = -Math.abs(o.vy) * bounce; }
    if (o.y + r > fieldH - END_PAD) {
      if (o.x - r < gx1) { o.x = gx1 + r; o.vx = Math.abs(o.vx) * bounce; }
      if (o.x + r > gx2) { o.x = gx2 - r; o.vx = -Math.abs(o.vx) * bounce; }
    }
  } else if (o.y + r > fieldH - END_PAD) {
    o.y = fieldH - END_PAD - r; o.vy = -Math.abs(o.vy) * bounce;
  }
}

// After a shot settles, push any disk that is >= 80% inside a goal back out onto
// the pitch (a disk shouldn't be able to camp inside the net). The ball is left
// alone — it may legitimately rest in the mouth under the 70% scoring line.
function ejectDisksFromGoal() {
  var goalW = fieldW * GOAL_WIDTH_RATIO;
  var gx1 = (fieldW - goalW) / 2;
  var gx2 = gx1 + goalW;
  disks.forEach(function (d) {
    var r = d.radius;
    if (d.x <= gx1 || d.x >= gx2) return; // not in a goal mouth
    // Fraction of the disk past the goal line (1.0 = fully inside the net).
    var topFrac = (END_PAD - (d.y - r)) / (2 * r);
    var botFrac = ((d.y + r) - (fieldH - END_PAD)) / (2 * r);
    if (topFrac >= 0.8) { d.y = END_PAD + r; d.vx = 0; d.vy = 0; }
    else if (botFrac >= 0.8) { d.y = fieldH - END_PAD - r; d.vx = 0; d.vy = 0; }
  });
  // Ejection snaps several disks onto the SAME goal-line point, so they end up
  // stacked (looking like one "duplicated" disk). De-overlap them: ejected disks
  // shove each other — and any disk already resting outside — apart.
  separateRestingDisks();
}

// Keep a settled disk fully on the pitch (out of the goal pockets / off the
// side walls). Used after de-overlapping so a push can't shove a disk back into
// the net or off the field.
function clampDiskToPitch(d) {
  var r = d.radius;
  if (d.x < SIDE_PAD + r) d.x = SIDE_PAD + r;
  if (d.x > fieldW - SIDE_PAD - r) d.x = fieldW - SIDE_PAD - r;
  if (d.y < END_PAD + r) d.y = END_PAD + r;
  if (d.y > fieldH - END_PAD - r) d.y = fieldH - END_PAD - r;
}

// Positional relaxation: separate any overlapping resting disks so none stack on
// top of another. Velocity-free (disks are at rest); a few passes converge.
function separateRestingDisks() {
  var ITER = 8;
  for (var it = 0; it < ITER; it++) {
    var moved = false;
    for (var i = 0; i < disks.length; i++) {
      for (var j = i + 1; j < disks.length; j++) {
        var a = disks[i], b = disks[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var minDist = a.radius + b.radius;
        if (dist >= minDist) continue;
        var nx, ny, overlap;
        if (dist > 0.001) {
          nx = dx / dist; ny = dy / dist; overlap = minDist - dist;
        } else {
          // Exact overlap (two disks ejected to the same point) — split along x
          // so they don't stay welded together.
          nx = 1; ny = 0; overlap = minDist;
        }
        a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
        clampDiskToPitch(a); clampDiskToPitch(b);
        moved = true;
      }
    }
    if (!moved) break;
  }
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
  var pad = END_PAD;
  var r = ball.radius;
  // A goal counts only when 70%+ of the ball is over the goal line.
  // Fraction of the ball past the line = (line − leadingEdge) / diameter.
  // For >= 70%, the ball's centre must be 0.4 * radius beyond the line.
  // Less than that → no goal, ball stays in play.
  var over = 0.4 * r;
  var inGoalX = ball.x > gx1 && ball.x < gx2;

  var scored = 0;
  // Top goal line is the top end line (y = pad) → Player 2 scores
  if (inGoalX && ball.y <= pad - over) {
    scored = 2;
  }
  // Bottom goal line (y = fieldH − pad) → Player 1 scores
  if (!scored && inGoalX && ball.y >= fieldH - pad + over) {
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

  // Receiver is NOT authoritative for goals/fouls. Local physics is not
  // bit-identical across machines, so the non-shooter must not run its own
  // score/turn/reset logic — otherwise a stale pre-foul snapshot can revert
  // the turn back to the fouling player. Just freeze and wait for the
  // shooter's authoritative snapshot to deliver score / turn / reset.
  if (!botMode && !iAmShooter) {
    gamePhase = "goal";
    render();
    flushPendingSnapshot();
    scheduleStaleWatchdog(); // self-heal if the shooter's score/reset snapshot is lost
    return;
  }

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
    writeCheckpoint(); // receiver: persist the settled board it just animated
    return;
  }

  // Switch turns
  pendingShot = false;
  // The shooter (whose turn it currently is, before switching) is authoritative
  // for the final resting state — only they broadcast, to avoid conflicting snapshots.
  var iWasShooter = currentTurn === myPlayer;
  gamePhase = "playing";

  // Kick any disk that came to rest mostly inside the goal back onto the pitch,
  // BEFORE broadcasting, so the snapshot carries the corrected positions.
  ejectDisksFromGoal();

  // Only the authoritative client advances the turn. The receiver waits for the
  // shooter's snapshot to set currentTurn, so the two clients can never disagree
  // about whose turn it is (which is what let the ball revert to the fouler).
  if (botMode || iWasShooter) {
    currentTurn = currentTurn === 1 ? 2 : 1;
    if (iWasShooter) broadcastBoardSnapshot();
  }
  updateTurnIndicator();
  updateActivePanel();

  flushPendingSnapshot();
  maybeTriggerBot();
  writeCheckpoint(); // shooter: persist the settled board + advanced turn for rejoiners
  if (!iWasShooter) scheduleStaleWatchdog(); // receiver: self-heal a lost settle snapshot
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

  // Player 2 attacks the TOP goal (small y) — aim deep into the net.
  var goal = { x: fieldW / 2, y: END_PAD * 0.3 };
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

// ── Staleness watchdog ───────────────────────────────────
// The settle snapshot (score/turn/reset) rides the fire-and-forget realtime
// channel. On the platform's websocket transport it isn't randomly lost, but a
// reference implementation should self-heal anyway (and survive
// simulateNetwork loss): if we're still frozen on the same opponent turn / the
// same goal overlay a few seconds after settling, pull the durable checkpoint
// (the shooter wrote it at settle, with the advanced turn) and ask the host
// for the live board. Both paths are idempotent, so a false positive (the
// opponent just aiming slowly) costs one harmless resync.
var staleTimer = null;
function scheduleStaleWatchdog() {
  if (botMode) return;
  if (staleTimer) clearTimeout(staleTimer);
  var snapTurn = currentTurn, snapPhase = gamePhase;
  staleTimer = setTimeout(function () {
    staleTimer = null;
    if (physicsRunning || netPaused || forfeitTimer || pendingShot) return;
    var stuckTurn = gamePhase === "playing" && currentTurn === snapTurn && currentTurn !== myPlayer;
    var stuckGoal = gamePhase === "goal" && snapPhase === "goal";
    if (stuckTurn || stuckGoal) {
      try { Usion.game.requestSync(0); } catch (_) {}
      try { Usion.game.realtime("request_state", {}); } catch (_) {}
      scheduleStaleWatchdog(); // re-arm: the heal itself can be lost on a bad link
    }
  }, 3500);
}

// Apply a snapshot that arrived while we were animating, now that we've settled.
function flushPendingSnapshot() {
  if (pendingSnapshot && !physicsRunning) {
    var s = pendingSnapshot;
    var from = pendingSnapshotFrom;
    pendingSnapshot = null;
    pendingSnapshotFrom = null;
    applyBoardSnapshot(s, from);
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
  turnIndicator.textContent = turnPlayerId === myId
    ? t("yourTurn")
    : t("turnOf", playerNames[turnPlayerId] || t("opponent"));
  turnIndicator.className = "turn-indicator " + (isMyTurn ? "my-turn" : "opp-turn");
  maybeNotifyTurn();
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
  var wId = players[winnerIdx];
  var name = wId === myId ? t("you") : (playerNames[wId] || t("opponent"));

  winnerName.textContent = name;
  winnerScoreEl.textContent = score[0] + " - " + score[1];
  goalOverlay.classList.remove("show");
  foulOverlay.classList.remove("show");
  spawnConfetti();
  winnerOverlay.classList.add("show");

  rematchState = "idle";
  syncRematchUi();
  broadcastBoardSnapshot();
  writeCheckpoint(); // persist the ended state so a rejoiner sees the result
  recordOutcome(winner === myPlayer); // stats + leaderboard + saveResult + notify
  reportMatchToGameCenter(winner);    // Game Center drops a result card to both players
}

// Report the final 1-on-1 result so Game Center messages BOTH players a card
// ("You beat Bob — 3 : 1" / "Bob beat you — 1 : 3"). Host-authoritative: only
// player_ids[0] reports, exactly once per match; the backend re-validates the
// roster and dedupes. Skipped vs the local bot (no real opponent).
function reportMatchToGameCenter(winner) {
  matchSeq++;
  if (botMode || players.length !== 2 || myId !== players[0]) return;
  if (!Usion.game || typeof Usion.game.reportResult !== "function") return; // older injected SDK
  var scores = {};
  scores[players[0]] = score[0];
  scores[players[1]] = score[1];
  try {
    Usion.game.reportResult({
      winnerId: players[winner - 1],
      scores: scores,
      metric: "goals",
      matchId: "m" + matchSeq,
    }).catch(function () {}); // fire-and-forget — never block the win screen
  } catch (e) { /* ignore */ }
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
  winnerPlayAgain.textContent = t("waitingDots");
  winnerPlayAgain.disabled = true;
  // The restart itself is a DURABLE stored action (see onAction "rematch") —
  // we reset when our own echo comes back, so both clients restart from the
  // same sequenced point and a reconnect can never lose the restart.
  Usion.game.action("rematch", { reset: true }).catch(function () {
    rematchRequested = false;
    syncRematchUi();
  });
}

function resetForRematch() {
  rematchRequested = false;
  rematchState = "idle";
  pendingShot = false;
  goalScored = false;
  pendingSnapshot = null;
  lastSnapshotVersion = 0;
  lastSnapshotVersionByPlayer = {};
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
  winnerPlayAgain.textContent = t("rematch");
  winnerPlayAgain.disabled = false;
  _rematchAction = requestRematch;

  // Reset tactic selection UI
  document.querySelectorAll("#attackGrid .tactic-option").forEach(function (o, i) {
    o.classList.toggle("selected", i === 0);
  });
  document.querySelectorAll("#defenseGrid .tactic-option").forEach(function (o, i) {
    o.classList.toggle("selected", i === 0);
  });

  if (botMode) { startBotMatchNow(); return; } // solo rematch is also zero-tap
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
      winnerPlayAgain.textContent = t("waitingDots");
      winnerPlayAgain.disabled = true;
      _rematchAction = null;
    } else {
      winnerPlayAgain.textContent = t("acceptRematch");
      winnerPlayAgain.disabled = false;
      _rematchAction = acceptRematch;
    }
    return;
  }
  winnerPlayAgain.textContent = t("rematch");
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
    // Local monotonic counter (NOT Date.now) so versions are reliably increasing
    // and compared per-sender without cross-device clock skew.
    version: ++snapshotSeq
  };
}

function broadcastBoardSnapshot() {
  if (botMode) return; // no remote opponent to sync with
  var snap = getBoardSnapshot();
  lastSnapshotVersion = Math.max(lastSnapshotVersion, snap.version);
  Usion.game.realtime("board_state", snap);
}

function broadcastRematchState() {
  if (botMode) return;
  Usion.game.realtime("rematch_state", { state: rematchState });
}

// ── Usion capabilities: cloud stats · leaderboard · notify · saveResult ──
// All wrappers are defensive: missing modules / standalone preview must never
// throw (a thrown error in init blanks the game). They no-op gracefully.
var myStats = { wins: 0, losses: 0, games: 0 };
var statsRecordedThisGame = false;
var lastTurnNotified = false;
var STATS_KEY = "table_soccer:stats";

// Cross-device stats: prefer Cloud KV, fall back to localStorage cache.
async function loadStats() {
  try {
    if (window.Usion && Usion.cloud) {
      var remote = await Usion.cloud.get(STATS_KEY);
      if (remote && typeof remote === "object") {
        myStats = Object.assign(myStats, remote);
        try { localStorage.setItem(STATS_KEY, JSON.stringify(myStats)); } catch (_) {}
        return;
      }
    }
  } catch (_) {}
  try {
    var raw = localStorage.getItem(STATS_KEY);
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
      // Score = total cumulative wins; ranked highest-first.
      Usion.leaderboard.submit(myStats.wins, { games: myStats.games });
    }
  } catch (_) {}
}

// Notifications are permission-gated (SDK ≥ 2.17): without a grant,
// Usion.notify.send() returns delivered:'blocked'. We ask ONCE when an online
// match starts, remember the answer, and only send while the app is hidden
// (foreground play doesn't need a banner about itself). The host prefixes the
// app's name as the notification title, so `title` here is the actual message.
var notifyAsked = false;
var notifyGranted = false;
async function ensureNotifyPermission() {
  if (notifyAsked) return;
  notifyAsked = true;
  try {
    if (window.Usion && Usion.permissions && Usion.permissions.request) {
      var res = await Usion.permissions.request(["notifications"]);
      notifyGranted = !!(res && (res.granted === true || (res.permissions && res.permissions.notifications)));
    }
  } catch (_) {}
}

function notifySelf(title, body) {
  try {
    if (notifyGranted && window.Usion && Usion.notify && document.hidden) {
      var p = Usion.notify.send({ title: title, body: body });
      if (p && p.catch) p.catch(function () {});
    }
  } catch (_) {}
}

// Record MY outcome exactly once per online match (idempotent across the
// shooter/receiver/forfeit end paths, which can all reach onMatchEnd).
function recordOutcome(iWon) {
  if (statsRecordedThisGame || botMode) return;
  statsRecordedThisGame = true;
  myStats.games += 1;
  if (iWon) {
    myStats.wins += 1;
    notifySelf(t("nWonTitle"), t("nWonBody"));
  } else {
    myStats.losses += 1;
    notifySelf(t("nLostTitle"), t("nLostBody"));
  }
  persistStats();
  submitLeaderboard();
  try { if (window.Usion && Usion.cloud && Usion.cloud.shared) Usion.cloud.shared.incr("games_total", 1); } catch (_) {}
  // Match result is delivered as a card in the two players' DM (see
  // reportMatchToGameCenter -> Usion.game.reportResult); no saveResult channel.
}

// Nudge a hidden player when it becomes their turn (once per turn).
function maybeNotifyTurn() {
  if (botMode || gamePhase !== "playing" || !myPlayer) { lastTurnNotified = false; return; }
  var myTurn = currentTurn === myPlayer;
  if (myTurn && document.hidden && !lastTurnNotified) {
    lastTurnNotified = true;
    notifySelf(t("nTurnTitle"), t("nTurnBody"));
  }
  if (!myTurn) lastTurnNotified = false;
}

// ── Checkpoint (durable reconnect state) ─────────────────
// The board_state snapshot rides the unreliable realtime channel, so it's gone
// the moment a client is offline. Each client ALSO persists the latest SETTLED
// board via setState so a (re)joining client loads it as game_state and resumes
// instead of starting blank.
//
// ACTOR-WRITTEN, NOT HOST-ONLY (per the SDK reference): `Usion.game.setState` is
// NOT host-only — any participant may write the checkpoint, and that is what
// "keeps the snapshot fresh even while the host is backgrounded." The old
// host-only gate stranded the checkpoint whenever the host dropped. The
// authoritative-shooter model makes this safe: every client animates each shot
// to the SAME deterministic resting state, so whichever client writes (shooter
// at its settle, receiver at its settle) persists the identical authoritative
// board — last-write-wins is harmless. So writeCheckpoint() is called at every
// settle point by whoever reaches it, with no host gate.
function isHostPlayer() {
  return !botMode && players.length > 0 && players[0] === myId;
}

function writeCheckpoint() {
  if (botMode) return;                                          // no remote peer to recover
  if (gamePhase === "tactics" || waitingForOpponent) return;   // nothing to resume yet
  try {
    if (window.Usion && Usion.game && Usion.game.setState) {
      var snap = getBoardSnapshot();
      snap.order = players.slice();   // canonical roster (tactics already baked into disk positions)
      Usion.game.setState(snap);      // setState is NOT host-only — actor write keeps it fresh
    }
  } catch (_) {}
}

// Rebuild a live match from a host checkpoint (join ack / sync game_state).
// Returns true if a valid checkpoint was applied.
function applyCheckpoint(state) {
  if (!state || typeof state !== "object" || !Array.isArray(state.order) || !Array.isArray(state.disks)) return false;
  if (physicsRunning && !snapshotPhysics) return false; // don't clobber a real shot we're mid-animating

  players = state.order.slice();
  myPlayer = players.indexOf(myId) + 1;
  if (myPlayer < 1) return false; // not a seated player in this checkpoint

  // Promote into a live online match: drop setup overlays + bot/tactic timers.
  botMode = false;
  waitingForOpponent = false;
  netPaused = false;
  hideWaiting();
  tacticOverlay.classList.remove("show");
  clearInterval(tacticTimerInterval);
  cancelBotMove();
  myTacticsConfirmed = true;
  opponentTacticsReceived = true;
  updatePlayerDisplay();

  // The checkpoint carries the full board (disks/ball/score/turn/phase) in the
  // same shape as a realtime snapshot — reuse the snapshot applier to restore it.
  lastSnapshotVersion = 0;          // accept this checkpoint regardless of stale version
  lastSnapshotVersionByPlayer = {}; // re-baseline per-sender versioning after a rebuild
  applyBoardSnapshot(state);
  return true;
}

function applyBoardSnapshot(snap, senderId) {
  // Ignore a peer's realtime snapshot while we're on the formation screen (rematch
  // or first game). A late in-match snapshot would otherwise overwrite gamePhase
  // and yank us out of "tactics". Checkpoints (no senderId) still apply — they
  // legitimately promote a reconnecting client into the live match.
  if (senderId && (gamePhase === "tactics" || waitingForOpponent)) return;
  var v = Number(snap.version || 0);
  // Per-sender staleness gate: each sender's `version` is monotonic for itself, so
  // this drops only genuinely out-of-order packets from THAT player. The old
  // single cross-device gate dropped valid moves whenever the two clocks skewed.
  // (A checkpoint has no senderId → always accepted, it's authoritative.)
  var prev = senderId ? (lastSnapshotVersionByPlayer[senderId] || 0) : 0;
  if (senderId && v && v < prev) return;

  // If we're mid-animation of a real shot, don't yank objects to the snapshot's
  // resting positions — our deterministic simulation reaches the same end state.
  // Stash it and apply as a smooth correction once the animation settles.
  if (physicsRunning && !snapshotPhysics) {
    pendingSnapshot = snap;
    pendingSnapshotFrom = senderId || null;
    return;
  }

  if (senderId && v) lastSnapshotVersionByPlayer[senderId] = Math.max(prev, v);
  lastSnapshotVersion = Math.max(lastSnapshotVersion, v);
  // A newer authoritative snapshot supersedes any older one we stashed mid-shot.
  pendingSnapshot = null;

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

  // Track the goal-detection guard against the authoritative state. The receiver
  // no longer runs resetRound() locally, so goalScored MUST be cleared here once
  // the shooter says play has resumed — otherwise checkGoal() stays guarded
  // forever and the next ball into the goal is ignored and lost off the field.
  goalScored = (snap.gamePhase === "goal");

  pendingShot = false;
  updateScoreDisplay();
  updateTurnIndicator();
  updateActivePanel();

  // Match over: resolve as soon as ANY snapshot shows a winning score. Don't
  // depend on a dedicated "ended" snapshot arriving (it rides the unreliable
  // realtime channel) or on physics settling — otherwise the loser is left with
  // no win/lose overlay while the winner sees theirs.
  if (score[0] >= GOALS_TO_WIN || score[1] >= GOALS_TO_WIN) {
    onMatchEnd(score[0] >= GOALS_TO_WIN ? 1 : 2);
    render();
    return;
  }

  // If objects are still moving, run physics
  if (!allStopped()) {
    snapshotPhysics = true;
    gamePhase = "animating";
    startPhysicsLoop();
  } else {
    gamePhase = snap.gamePhase || "playing";
    writeCheckpoint(); // receiver: persist the authoritative settled board
  }

  render();
}

// ── Share ────────────────────────────────────────────────
winnerShare.addEventListener("click", function () {
  var text = t("shareText", winnerName.textContent, score[0], score[1]);
  Usion.share({
    contentType: "text",
    text: text,
    title: t("docTitle"),
    message: text
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
// Standalone (no host) still renders localized with fallback avatars;
// Usion.init re-applies both once the platform config is known.
applyLang(detectLang());
applyTheme();
player1Avatar.src = fallbackAvatar(t("playerN", 1), P1_HUE);
player2Avatar.src = fallbackAvatar(t("playerN", 2), P2_HUE);
render();
