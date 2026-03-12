# Usion Developer Guide

> Everything you need to build a game or service for the Usion platform. Copy this entire document into your LLM and describe what you want to build.

---

## How It Works

Your game or service is a **standalone web page** loaded inside an iframe within the Usion app (mobile + web). The platform handles:

- **User authentication** — logged-in user's ID, name, avatar
- **Matchmaking & rooms** — finding opponents for multiplayer games
- **Real-time multiplayer** — socket relay or direct WebSocket connections
- **Wallet & payments** — credit-based economy for paid features
- **Persistent storage** — per-user, per-service key-value data
- **Content sharing** — let users share results to chat/feed

You build an HTML page, include the SDK, deploy it, and register your URL on the platform.

### Example Repo

If you want a minimal starting point, use the standalone examples repo in this workspace:

- `usion-developer-examples/service-basic` for a service / mini app
- `usion-developer-examples/game-platform` for a game that uses the platform relay
- `usion-developer-examples/game-user-hosted` for a game with its own WebSocket server

For games, creators can choose either:

- **Platform-hosted**: your game UI is hosted by you, but realtime uses the Usion platform relay and does not require your own game server
- **Creator-hosted**: your game UI is hosted by you and players connect directly to your own game server over WebSocket

---

## Quick Start

### 1. Project Structure

```
my-app/
├── public/
│   ├── usion-sdk.js           ← Copy from `microservices/shared/usion-sdk.js`
│   └── usion-design-system.css ← Copy from `microservices/shared/usion-design-system.css`
├── index.html                  ← Your app UI
├── style.css
├── app.js
├── server.js                   ← Backend (if needed)
└── package.json
```

Get the shared assets from one of these locations:

- Repo source files: `microservices/shared/usion-sdk.js` and `microservices/shared/usion-design-system.css`
- Local asset server: `http://localhost:3100/usion-sdk.js` and `http://localhost:3100/usion-design-system.css`
- Production web assets: `https://usions.com/usion-sdk.js` and `https://usions.com/usion-design-system.css`

If you need to run the shared asset server locally, see `microservices/shared/README.md`.

### 2. Include the SDK

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="/usion-design-system.css">
</head>
<body>
  <div class="usion-container">
    <!-- Your content -->
  </div>
  <script src="/usion-sdk.js"></script>
</body>
</html>
```

For local development, you can load the shared files directly instead of copying them first:

```html
<link rel="stylesheet" href="http://localhost:3100/usion-design-system.css">
<script src="http://localhost:3100/usion-sdk.js"></script>
```

For production on the Usion domain, use:

```html
<link rel="stylesheet" href="https://usions.com/usion-design-system.css">
<script src="https://usions.com/usion-sdk.js"></script>
```

### 3. Initialize

```javascript
Usion.init(function(config) {
  console.log('User:', config.userId, config.userName);
  console.log('Room:', config.roomId);
  console.log('Balance:', config.balance);

  // Start your app here
  startApp(config);
});
```

---

## Config Object

When `Usion.init()` is called, the platform injects this config:

```javascript
{
  serviceId: "your-service-id",     // Your service's unique ID
  serviceName: "My Game",           // Display name
  cost: 0,                          // Cost per use (0 = free)
  userId: "abc123",                 // Current user's ID
  userName: "Player1",              // Current user's display name
  userAvatar: "https://...",        // Current user's avatar URL
  authToken: "jwt-token-here",      // JWT for API calls
  socketUrl: "https://api.usion.app", // Socket.IO server URL
  apiUrl: "https://api.usion.app",    // REST API URL
  connectionMode: "platform",       // "platform" or "direct"
  directWsUrl: null,                // WebSocket URL (if direct mode)
  roomId: "room-uuid",              // Game room ID (for multiplayer)
  balance: 150,                     // User's credit balance
}
```

---

## SDK API Reference

### User

```javascript
Usion.user.getId()       // → "user-id-string"
Usion.user.getName()     // → "Display Name"
Usion.user.getAvatar()   // → "https://avatar-url.jpg"
Usion.user.getToken()    // → "jwt-token" (for API auth)
```

### Storage (Persistent, per-user, per-service)

```javascript
await Usion.storage.set('highScore', 9500);
const score = await Usion.storage.get('highScore');  // → 9500
await Usion.storage.remove('highScore');
await Usion.storage.clear();
const allKeys = await Usion.storage.keys();  // → ['key1', 'key2']
```

### Wallet & Payments

```javascript
// Check balance
const balance = await Usion.wallet.getBalance();
const canAfford = await Usion.wallet.hasCredits(10);

// Charge credits (shows payment modal to user)
try {
  const result = await Usion.wallet.requestPayment(
    10,                    // amount
    'Unlock premium mode'  // reason (shown to user)
  );
  console.log('Paid! New balance:', result.newBalance);
} catch (err) {
  console.log('Payment failed:', err.message);
}

// Listen for balance changes
Usion.wallet.onBalanceChange(function(newBalance) {
  updateUI(newBalance);
});
```

Alternative event-based payment (used in services):

```javascript
Usion.requestPayment(20, 'Generate content');

Usion.on('PAYMENT_SUCCESS', async () => {
  // Do the paid action
});

Usion.on('PAYMENT_FAILED', () => {
  // User cancelled
});
```

### Session (Ephemeral data, cleared on close)

```javascript
Usion.session.getId();
Usion.session.setData('level', 3);
Usion.session.getData('level');   // → 3
Usion.session.clear();
```

### Lifecycle

```javascript
Usion.submit({ score: 100 });       // Send result to parent app
Usion.exit();                        // Close the service/game
Usion.error('Something went wrong'); // Report error to parent
Usion.log('Debug message');          // Log to native console
```

### Share Content

All services that generate content **must** include a Share button.

```javascript
// Share an image
Usion.share('image', {
  text: 'Check my score!',
  imageUrl: 'https://cdn.example.com/screenshot.png',
  width: 1024,
  height: 768
});

// Share a video
Usion.share('video', {
  text: 'Watch my gameplay!',
  videoUrl: 'https://cdn.example.com/clip.mp4',
  thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
  duration: 30
});

// Share audio (service-style)
Usion.share({
  contentType: 'audio',
  audioUrl: 'data:audio/wav;base64,...',
  text: 'Input text',
  title: 'Service Name',
  message: 'Display message'
});
```

Share data fields:

| Field | Required | Description |
|-------|----------|-------------|
| `contentType` | Yes | `'audio'`, `'image'`, `'text'`, `'video'` |
| `audioUrl` | If audio | Base64 data URI or URL |
| `imageUrl` | If image | Base64 data URI or URL |
| `videoUrl` | If video | URL |
| `text` | Yes | Display text |
| `title` | Yes | Content title |
| `message` | Yes | Feed/chat display message |

### UI Utilities

```javascript
Usion.setLoading('#myBtn', true);   // Show loading state on button
Usion.setLoading('#myBtn', false);

Usion.toggle('#result', true);      // Show/hide elements
Usion.toggle('#result', false);

Usion.charCount('#textInput', '#counter', 500);  // Character counter

const grid = Usion.selectionGrid('.grid', '.item', (value) => {
  console.log('Selected:', value);
});
grid.getSelected();
```

---

## Building a Game

You have **three architecture options** depending on your game type:

| Architecture | Best For | Server Needed? | Latency |
|---|---|---|---|
| **P2P (Host-Guest)** | 2-player action games | No | ~13ms |
| **Server-Authoritative** | Competitive, anti-cheat | Your own server | 30-100ms |
| **Turn-Based (Platform Relay)** | Board games, card games | No | ~50ms |

Concrete examples:

- `usion-developer-examples/game-platform` shows the no-server platform-relay path
- `usion-developer-examples/game-user-hosted` shows the creator-hosted direct WebSocket path

---

### Option 1: P2P (Peer-to-Peer via WebRTC)

One player's browser runs the game simulation (host), the other sends inputs (guest). Communication is direct via WebRTC DataChannel.

**Use when**: 2-player games, low latency needed, you trust the host player.

**Flow**:
1. Both players connect to the platform socket
2. Both join the same room
3. Determine host/guest (first player = host)
4. Establish WebRTC DataChannel for direct P2P
5. Host runs simulation, sends state snapshots to guest
6. Guest sends inputs, displays host's state

```javascript
Usion.init(async function(config) {
  const myId = config.userId;
  const roomId = config.roomId;

  await Usion.game.connect();

  let players = [];

  Usion.game.onJoined(function(data) {
    players = data.player_ids || [];
    if (players.length >= 2) startP2PSignaling(players);
  });

  Usion.game.onPlayerJoined(function(data) {
    if (data.player_ids) {
      players = data.player_ids;
    } else if (data.player && data.player.id) {
      if (!players.includes(data.player.id)) players.push(data.player.id);
    }
    if (players.length >= 2) startP2PSignaling(players);
  });

  await Usion.game.join(roomId);

  // Use realtime channel for WebRTC signaling
  Usion.game.onRealtime(function(data) {
    if (data.action_type === 'webrtc_offer') handleOffer(data.action_data);
    if (data.action_type === 'webrtc_answer') handleAnswer(data.action_data);
    if (data.action_type === 'ice_candidate') handleIceCandidate(data.action_data);
  });

  function startP2PSignaling(playerList) {
    const isHost = playerList[0] === myId;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    if (isHost) {
      const channel = pc.createDataChannel('game');
      channel.onopen = () => startHostLoop(channel);
      channel.onmessage = (e) => handleGuestInput(JSON.parse(e.data));
    } else {
      pc.ondatachannel = (e) => {
        e.channel.onopen = () => startGuestLoop(e.channel);
        e.channel.onmessage = (e2) => handleHostState(JSON.parse(e2.data));
      };
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        Usion.game.realtime('ice_candidate', { candidate: e.candidate.toJSON() });
      }
    };

    if (isHost) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        Usion.game.realtime('webrtc_offer', { sdp: offer });
      });
    }
  }
});
```

---

### Option 2: Server-Authoritative (Direct WebSocket)

Your own game server runs the simulation. Players connect to it via WebSocket. The platform provides room tokens for authentication.

**Use when**: Competitive games, anti-cheat needed, complex game logic.

#### How it works

1. User opens your game from Usion chat iframe
2. Usion frontend requests an access token from Usion backend
3. Client connects directly to your game WebSocket (`wss://.../ws`) using that token
4. Your server validates the token using Usion JWKS
5. Your server runs the authoritative game loop and broadcasts state
6. On match end, your server submits a signed result to Usion backend

#### Your server must provide

- HTTPS frontend URL (iframe app)
- WSS WebSocket endpoint at `/ws`
- Token validation (RS256 + JWKS)
- Realtime protocol v2 messages (`join`, `input`, `ping`, etc.)
- Signed match result webhook to Usion backend

#### Service config (set in your service registration)

```json
{
  "iframe_url": "https://your-game-ui.com",
  "realtime": {
    "connection_mode": "direct",
    "ws_url": "wss://your-game-server.com/ws",
    "protocol_version": "2",
    "signing": {
      "shared_secret": "<must match server SIGNING_SECRET>"
    }
  }
}
```

#### Environment variables

Minimal setup:
- `API_URL=https://mobile.mongolai.mn`
- `SIGNING_SECRET=<your service signing secret>`

Optional:
- `SIGNING_KEY_ID` (default can be static)
- `JWKS_URL` (only if different from `${API_URL}/.well-known/jwks.json`)
- `SERVICE_ID` (optional strict lock)

#### Client-side connection

```javascript
Usion.init(async function(config) {
  // Use connectDirect() when your service is configured for direct mode
  if (typeof Usion.game.connectDirect === 'function' &&
      (config.connectionMode === 'direct' || config.directWsUrl)) {
    await Usion.game.connectDirect();
  } else {
    await Usion.game.connect();
  }

  await Usion.game.join(config.roomId);

  // Send input to your server
  Usion.game.realtime('input', { direction: 'up' });

  // Receive state from your server
  Usion.game.onStateUpdate(function(data) {
    renderGame(data);
  });

  Usion.game.onGameFinished(function(data) {
    showResults(data);
  });
});
```

#### Server protocol

Your server receives:
```json
{
  "type": "input",
  "room_id": "room-uuid",
  "session_id": "session-uuid",
  "payload": { "action_type": "input", "action_data": { "direction": "up" } }
}
```

Your server sends:
```json
{ "type": "state_snapshot", "payload": { "players": [], "tick": 42 } }
{ "type": "match_end", "payload": { "winner": "player-id" } }
```

#### Local development

If your game server validates tokens with JWKS, the `JWKS_URL` must match the backend that minted the token.

Common failure: WebSocket shows `101 Switching Protocols`, then server logs `auth_failed ... signature verification failed`. This means the token was issued by one backend (e.g. `localhost:8089`) but your game server is validating against another JWKS (e.g. production).

Recommended local env:
```bash
PORT=3006
API_URL=http://localhost:8089
JWKS_URL=http://localhost:8089/.well-known/jwks.json
SERVICE_ID=<your-service-id>
npm run dev
```

---

### Option 3: Turn-Based (Platform Socket Relay)

Use the platform's Socket.IO relay for turn-based games. No server needed — actions are relayed between players.

**Use when**: Board games, card games, quiz games — anything not time-critical.

Important platform detail:

- `player_ids` tells you who is authorized / assigned to the room.
- `connected_count`, `connected_player_ids`, and `game:player_joined` tell you who is actually live on the socket right now.
- `onSync` is a recovery path after reconnect / late join. Do not depend on sync replay for normal moment-to-moment UI updates.

```javascript
Usion.init(async function(config) {
  const myId = config.userId;
  let lastSequence = 0;
  let connectedCount = 0;

  await Usion.game.connect();

  // Register ALL event handlers BEFORE joining
  Usion.game.onJoined(function(data) {
    lastSequence = data.sequence || 0;
    connectedCount = Number(data.connected_count || 0);
    // data.player_ids contains the full player list
    initGame(data.player_ids);
    if (connectedCount >= 2) {
      showMatchReady();
    } else {
      showWaitingForOpponent();
    }
  });

  Usion.game.onPlayerJoined(function(data) {
    // IMPORTANT: Use data.player_ids (array) — NOT data.player_id
    if (data.player_ids) updatePlayerList(data.player_ids);
    if (data.player && data.player.is_connected) {
      connectedCount = Math.max(connectedCount, 2);
      showMatchReady();
    }
  });

  // Receive opponent's moves
  Usion.game.onAction(function(data) {
    if (data.sequence !== undefined) lastSequence = Math.max(lastSequence, data.sequence);
    if (data.player_id !== myId) {
      applyMove(data.action_data);
    }
  });

  // Handle sync (replays missed actions after reconnect or late join)
  Usion.game.onSync(function(data) {
    if (data.sequence !== undefined) lastSequence = data.sequence;
    if (data.actions && data.actions.length > 0) {
      replayAllActions(data.actions);
    }
  });

  // Re-sync on reconnect to catch any missed actions
  Usion.game.onReconnect(function() {
    Usion.game.requestSync(lastSequence);
  });

  Usion.game.onRematchRequest(function(data) {
    if (data.player_id !== myId) {
      // Show rematch UI to the user
    }
  });

  await Usion.game.join(config.roomId);

  // Send a move
  function makeMove(row, col) {
    Usion.game.action('move', {
      row: row,
      col: col,
      player: myId
    });
  }
});
```

### Turn-Based Game Best Practices

These patterns prevent the most common multiplayer bugs:

#### 1. Always use `player_ids` array, never `player_id`

The `onPlayerJoined` event does **NOT** have a `player_id` field. Use `data.player_ids` (the full array) or `data.player.id` (single new player):

```javascript
// WRONG — data.player_id is undefined
if (!players.includes(data.player_id)) players.push(data.player_id);

// CORRECT — use the full array from the server
if (data.player_ids) {
  players = data.player_ids;
} else if (data.player && data.player.id && !players.includes(data.player.id)) {
  players.push(data.player.id);
}
```

#### 2. Do not treat `player_ids.length` as "both players are live"

In Usion, `player_ids` can include invited / authorized users before both clients have fully joined the socket room. Use live join signals for "start match", "hide waiting overlay", and "allow the first move":

```javascript
let connectedCount = 0;

Usion.game.onJoined(function(data) {
  connectedCount = Number(data.connected_count || 0);
});

Usion.game.onPlayerJoined(function(data) {
  if (data.player && data.player.is_connected) {
    connectedCount = Math.max(connectedCount, 2);
  }
});

function canStartMatch() {
  return connectedCount >= 2;
}
```

#### 3. Always implement `onSync` alongside `onAction`

Actions can be missed due to brief disconnects or race conditions. The sync handler replays all stored actions:

```javascript
Usion.game.onSync(function(data) {
  if (!data.actions || data.actions.length === 0) return;
  lastSequence = data.sequence;
  // Reset game state and replay all actions from scratch
  resetBoard();
  data.actions.forEach(function(action) {
    applyMoveFromAction(action);
  });
});
```

#### 4. Request sync on reconnect and after join

```javascript
Usion.game.onReconnect(function() {
  Usion.game.requestSync(lastSequence);
});

Usion.game.onJoined(function(data) {
  lastSequence = data.sequence || 0;
  // If there are already actions, request a full sync
  if (lastSequence > 0) {
    Usion.game.requestSync(0);
  }
});
```

#### 5. Use `game.action` for persisted game facts, and `game.realtime` for immediate UI state

Use `Usion.game.action(...)` for stored, replayable facts such as committed moves, submitted turns, or finalized results.

Use `Usion.game.realtime(...)` for fire-and-forget UI state that must feel instant, especially in iframe/proxy environments:

- live board snapshots
- cursor / aiming / drag previews
- ready-state / countdown UI
- WebRTC signaling

Recommended pattern for board games:

```javascript
function makeMove(move) {
  const nextState = applyMoveLocally(move);

  // Immediate remote UI update
  Usion.game.realtime('board_state', {
    board: nextState.board,
    currentTurn: nextState.currentTurn,
    version: Date.now(),
  });

  // Persisted source of truth for reconnect / reload
  Usion.game.action('move', move);
}

Usion.game.onRealtime(function(data) {
  if (data.action_type === 'board_state') {
    renderBoardSnapshot(data.action_data);
  }
});

Usion.game.onSync(function(data) {
  replayAllActions(data.actions || []);
});
```

If your game only updates correctly after reload, that is a design bug: you are relying on sync replay as the live transport.

#### 6. Treat rematch as an explicit game-state transition

Do not assume the platform will always emit a fully-managed `game:restarted` event for you. In platform relay mode, the only guaranteed rematch signal may be `game:rematch_request`.

Your game should define exactly what happens when:

- one player requests a rematch
- the other player accepts
- both clients must reset to the same fresh state

Recommended pattern:

```javascript
let rematchRequested = false;

Usion.game.onRematchRequest(function(data) {
  if (rematchRequested) {
    resetBoardForBothPlayers();
    broadcastBoardSnapshot();
    return;
  }

  showAcceptRematchUi();
});

function requestRematch() {
  rematchRequested = true;
  showWaitingForRematchUi();
  Usion.game.requestRematch();
}

function acceptRematch() {
  rematchRequested = true;
  resetBoardForBothPlayers();
  broadcastBoardSnapshot();
  Usion.game.requestRematch();
}
```

The important rule is not the exact UI, but that the second rematch confirmation must move both clients into the same new game state immediately.

#### 7. Shared status must come from shared state

For multiplayer games, turn banners, winner text, waiting overlays, and rematch status must describe the same underlying game state for every player.

Avoid status text that is only locally true, such as:

- `Your turn`
- `Opponent's turn`
- `You win`

Prefer status derived from shared state, such as:

- `Alice's turn`
- `Red wins!`
- `Rematch requested`

If one client says `Opponent's turn` while another says `You win`, your status model is wrong even if the board itself is correct.

#### 8. Track sequence numbers

Every `onAction` and `onSync` event includes a `sequence` number. Track it to avoid processing duplicate actions and to request the right range on sync:

```javascript
let lastSequence = 0;

Usion.game.onAction(function(data) {
  if (data.sequence !== undefined) lastSequence = Math.max(lastSequence, data.sequence);
  // ... process action
});
```

#### 9. Register handlers BEFORE joining

Always register `onAction`, `onSync`, `onPlayerJoined`, etc. **before** calling `Usion.game.join()`. Events can fire immediately after join:

```javascript
await Usion.game.connect();
Usion.game.onJoined(onJoined);       // Register first
Usion.game.onAction(onAction);       // Register first
Usion.game.onSync(onSync);           // Register first
await Usion.game.join(config.roomId); // Join last
```

---

## Game Event Handlers (Full List)

```javascript
// Connection events
Usion.game.onJoined(function(data) {
  // data: { room_id, player_ids: [...], player_count, connected_player_ids }
});

Usion.game.onPlayerJoined(function(data) {
  // data: { room_id, player: { id, is_connected }, player_ids: [...], status, current_turn, game_state }
  // IMPORTANT: Use data.player_ids (array) or data.player.id — NOT data.player_id (does not exist)
});

Usion.game.onPlayerLeft(function(data) {
  // data: { room_id, player_id }
});

// Game data events
Usion.game.onStateUpdate(function(data) {
  // data: { room_id, state: {...}, sequence }
});

Usion.game.onAction(function(data) {
  // data: { room_id, player_id, action_type, action_data, sequence }
});

Usion.game.onRealtime(function(data) {
  // data: { room_id, player_id, action_type, action_data }
  // Fire-and-forget, not stored, for signaling/high-freq updates
  // Also recommended for immediate UI snapshots in iframe/proxy games
});

Usion.game.onSync(function(data) {
  // data: { room_id, actions: [...], sequence }
  // Sent after reconnection with missed actions
});

// Game lifecycle
Usion.game.onGameFinished(function(data) {
  // data: { room_id, winner, scores, reason }
});

Usion.game.onGameRestarted(function(data) {
  // data: { room_id, state }
});

Usion.game.onRematchRequest(function(data) {
  // data: { room_id, player_id }
});

// Error handling
Usion.game.onError(function(data) {
  // data: { message, code }
});

Usion.game.onDisconnect(function(reason) { /* ... */ });
Usion.game.onReconnect(function(attemptNumber) { /* ... */ });
Usion.game.onConnectionError(function(err) { /* ... */ });
```

---

## Building a Service (Non-Game)

Services are mini-apps that provide tools or content generation (e.g., TTS, photo editor, AI tools). They run in the same iframe but use the payment and share flows instead of multiplayer.

### Payment Flow

```javascript
function onGenerate() {
  Usion.requestPayment(20, 'Text to Speech');
}

Usion.on('PAYMENT_SUCCESS', async () => {
  setLoading(true);
  try {
    const result = await callAPI();
    state.lastResult = result;  // Store for sharing
    displayResult(result);
    showShareButton();
  } catch (e) {
    Usion.error('Generation failed');
  } finally {
    setLoading(false);
  }
});

Usion.on('PAYMENT_FAILED', () => {
  // User cancelled, do nothing
});
```

### Share (Mandatory for content-generating services)

```javascript
const state = { input: '', lastResult: null };

// After generation, store result and show share button
state.lastResult = result;
document.getElementById('shareBtn').classList.remove('usion-hidden');

function shareResult() {
  if (!state.lastResult) return;
  Usion.share({
    contentType: 'audio',
    audioUrl: state.lastResult.audioUrl,
    text: state.input,
    title: 'Service Name',
    message: state.input
  });
}
```

### Communication Protocol (Service Messages)

| Type | Direction | Description |
|------|-----------|-------------|
| `INIT` | App -> Service | Config sent on load |
| `PAYMENT_REQUEST` | Service -> App | Request payment |
| `PAYMENT_SUCCESS` | App -> Service | Payment confirmed |
| `PAYMENT_FAILED` | App -> Service | Payment cancelled |
| `SHARE` | Service -> App | Open share sheet |
| `ERROR` | Service -> App | Show error alert |
| `EXIT` | Service -> App | Close service |

---

## Design System

### CSS Variables

```css
/* Colors */
--usion-bg: #f5f5f5;
--usion-surface: #ffffff;
--usion-text: #000000;
--usion-text-secondary: #666666;
--usion-primary: #000000;
--usion-primary-text: #ffffff;
--usion-border: #e5e5e5;
--usion-success: #34C759;
--usion-error: #FF3B30;

/* Typography */
--usion-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--usion-text-sm: 13px;
--usion-text-base: 15px;
--usion-text-lg: 17px;
--usion-text-xl: 20px;
--usion-text-2xl: 24px;
--usion-text-3xl: 32px;

/* Spacing */
--usion-space-sm: 8px;
--usion-space-md: 16px;
--usion-space-lg: 24px;
--usion-space-xl: 32px;

/* Border Radius */
--usion-radius-sm: 8px;
--usion-radius-md: 12px;
--usion-radius-lg: 16px;
```

### Layout Classes

| Class | Description |
|-------|-------------|
| `.usion-page` | Full-height page container |
| `.usion-content` | Scrollable content area |
| `.usion-footer` | Fixed footer with safe area padding |
| `.usion-container` | Padded container |

### Typography

| Class | Description |
|-------|-------------|
| `.usion-title` | Large bold title (32px) |
| `.usion-subtitle` | Muted subtitle text |
| `.usion-heading` | Section heading (20px) |
| `.usion-label` | Uppercase label |
| `.usion-text` | Body text |
| `.usion-text-muted` | Muted text color |

### Buttons

| Class | Description |
|-------|-------------|
| `.usion-btn` | Primary button (black) |
| `.usion-btn-secondary` | Secondary button (outlined) |
| `.usion-btn-ghost` | Transparent button |
| `.usion-btn-sm` | Small button |
| `.usion-btn-lg` | Large button |
| `.usion-btn-loading` | Loading state |

### Form Elements

| Class | Description |
|-------|-------------|
| `.usion-input` | Text input field |
| `.usion-textarea` | Multiline text input |
| `.usion-select` | Select dropdown |
| `.usion-char-count` | Character counter |

### Selection & Grids

| Class | Description |
|-------|-------------|
| `.usion-selection-grid` | 2-column grid for options |
| `.usion-selection-item` | Selectable item card (add `selected` class for active) |
| `.usion-image-grid` | 2-column image grid |
| `.usion-image-item` | Selectable image |
| `.usion-upload-box` | Upload dropzone |

### Utilities

| Class | Description |
|-------|-------------|
| `.usion-flex` | Display flex |
| `.usion-hidden` | Hide element |
| `.usion-mt-4` | Margin top (16px) |
| `.usion-mb-4` | Margin bottom (16px) |
| `.usion-gap-3` | Gap (12px) |

### Design Principles

- **Vercel-inspired minimalism** — black/white, minimal color accents, flat UI, generous whitespace
- **No custom fonts** — use system font stack
- **No bright colors** — stick to the design system
- **Layout pattern** — fixed header, fixed footer, scrollable middle content area
- **No hover-only interactions** — everything must work on touch

---

## Mobile Considerations

Your game/service runs in an iframe on mobile devices. Keep these in mind:

| Concern | Solution |
|---|---|
| **Touch input** | Use `touchstart`/`touchend` events, not just `click` |
| **Screen size** | Use CSS `height: 100dvh` and responsive layout |
| **Tilt controls** | Use `DeviceOrientationEvent` for gyroscope input |
| **Performance** | Use `requestAnimationFrame`, avoid heavy DOM manipulation |
| **iOS permission** | Motion sensors require `DeviceOrientationEvent.requestPermission()` |
| **No scrolling** | Set `touch-action: manipulation` on interactive elements |

### Tilt Controls (iOS + Android)

```javascript
const isMobile = 'ontouchstart' in window && window.innerWidth < 1024;

if (isMobile) {
  const DOE = DeviceOrientationEvent;
  if (typeof DOE.requestPermission === 'function') {
    // iOS 13+ — must request on user gesture (button tap)
    button.onclick = async () => {
      const result = await DOE.requestPermission();
      if (result === 'granted') enableTilt();
    };
  } else {
    // Android — works immediately
    enableTilt();
  }
}

function enableTilt() {
  window.addEventListener('deviceorientation', (e) => {
    const gamma = e.gamma; // left/right tilt (-90 to 90)
    const beta = e.beta;   // forward/back tilt (-180 to 180)
  });
}
```

### Mobile Game UX Tips

- Make the **player board the priority** (largest area on screen); opponents/stats in a narrow side rail or collapsible panel
- Size the main canvas from the **actual container size**, not fixed percentages
- Keep opponent mini-boards visible but compact (name, score, live/out status)
- For touch controls, resolve **gesture intent before action** — prioritize vertical swipe detection before sending horizontal movement to prevent accidental inputs
- Consider **hybrid-local multiplayer** for action games (score race): local board simulated on client for instant feel, server handles room/timer/results and relays mini-board states

### Example Touch Controls

- `Tap / click`: rotate
- `Swipe left / right`: move
- `Swipe down`: accelerated/hard drop
- `Swipe up`: hold piece
- Desktop fallback: `Shift`/`C` = hold, arrows/`WASD` = move/rotate, `Space` = hard drop

---

## Deployment

### Option A: Static Host (No Server)

For P2P or turn-based games and simple services, deploy to any static host:

```bash
# Vercel
vercel deploy

# Netlify
netlify deploy --prod
```

### Option B: Railway (Server-Authoritative Games)

For games with a backend WebSocket server. Deploy as a single Node process that serves both the UI and the `/ws` endpoint.

```bash
cd /path/to/your-game
railway login        # first time only
railway init         # first time only
railway up           # deploy
```

Your server must:
- `npm run build` builds your game UI
- `npm run start` runs a single process (e.g. `node server.js`)
- Listen on Railway `PORT` and expose WebSocket at `/ws`

After deploy:
1. Railway -> your service -> Settings -> Networking
2. Click **Generate Domain**
3. Wait for provisioning (can take a minute)
4. Open the generated URL and confirm your game page loads

Railway env vars:
- `NODE_ENV=production`
- `API_URL=https://mobile.mongolai.mn` (if using production backend)
- Do **not** set `PORT` manually (Railway injects it)
- Keep **Replicas = 1** if room state is in memory

### Usion Service Registration

Register your deployed service in the Usion Service Creator:

**For games (multiplayer):**
- `Service URL`: `https://your-domain.com`
- `Multiplayer`: ON
- `Max Players`: your supported count (e.g. `8`)
- `Connection Mode`: `Direct v2` (for server-authoritative) or `Platform` (for relay)
- `WebSocket Server URL`: `wss://your-domain.com/ws` (direct mode only)

**For services (non-game):**
- `Service URL`: `https://your-domain.com`
- `Multiplayer`: OFF

Important:
- Service URL uses `https://`
- WebSocket URL uses `wss://` and should include `/ws`

---

## Complete Examples

### Example 1: Multiplayer Game (Platform Relay)

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Game</title>
  <style>
    * { margin: 0; box-sizing: border-box; }
    body { font-family: system-ui; background: #020617; color: #e2e8f0; }
    #app { display: flex; flex-direction: column; height: 100dvh; }
    #header { padding: 8px 12px; background: rgba(2,6,23,0.85);
              border-bottom: 1px solid rgba(56,189,248,0.15); font-size: 13px; }
    #canvas { flex: 1; display: flex; align-items: center; justify-content: center; }
    canvas { max-width: 100%; max-height: 100%; }
    #controls { padding: 8px; background: rgba(2,6,23,0.85);
                border-top: 1px solid rgba(56,189,248,0.15);
                display: flex; gap: 8px; justify-content: center; }
    button { padding: 12px 24px; border: 1px solid rgba(56,189,248,0.3);
             border-radius: 8px; background: rgba(56,189,248,0.08);
             color: #93c5fd; font-size: 14px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="app">
    <div id="header">My Game — <span id="status">Connecting...</span></div>
    <div id="canvas"><canvas id="gameCanvas" width="400" height="400"></canvas></div>
    <div id="controls">
      <button onclick="sendMove('up')">Up</button>
      <button onclick="sendMove('down')">Down</button>
      <button onclick="sendMove('left')">Left</button>
      <button onclick="sendMove('right')">Right</button>
    </div>
  </div>

  <script src="/usion-sdk.js"></script>
  <script>
    let myId, roomId;

    Usion.init(async function(config) {
      myId = config.userId;
      roomId = config.roomId;

      document.getElementById('status').textContent = 'Joining...';

      await Usion.game.connect();

      Usion.game.onJoined(function(data) {
        document.getElementById('status').textContent =
          data.player_ids.length + ' players connected';
      });

      Usion.game.onRealtime(function(data) {
        if (data.action_type === 'move') {
          handleOpponentMove(data.action_data);
        }
      });

      await Usion.game.join(roomId);
    });

    function sendMove(direction) {
      Usion.game.realtime('move', {
        direction: direction,
        x: myPlayer.x,
        y: myPlayer.y
      });
    }
  </script>
</body>
</html>
```

### Example 2: Paid Service (TTS)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voiceify TTS</title>
  <link rel="stylesheet" href="/usion-design-system.css">
</head>
<body>
  <div class="usion-container">
    <h1 class="usion-title">Voiceify TTS</h1>
    <p class="usion-subtitle">Text to Speech</p>

    <label class="usion-label">TEXT</label>
    <textarea
      id="textInput"
      class="usion-input usion-textarea"
      rows="4"
      placeholder="Enter text..."
      oninput="onInput()"
    ></textarea>
    <div class="usion-char-count"><span id="count">0</span>/500</div>

    <button id="genBtn" class="usion-btn usion-btn-primary usion-mt-4" onclick="generate()" disabled>
      Generate (20 credits)
    </button>

    <audio id="player" controls class="usion-hidden usion-mt-4"></audio>

    <button id="shareBtn" class="usion-btn usion-btn-secondary usion-mt-4 usion-hidden" onclick="share()">
      Share
    </button>
  </div>

  <script src="/usion-sdk.js"></script>
  <script>
    const state = { text: '', audioUrl: null };

    Usion.init(c => console.log('Init:', c));

    function onInput() {
      state.text = document.getElementById('textInput').value;
      document.getElementById('count').textContent = state.text.length;
      document.getElementById('genBtn').disabled = !state.text.trim();
    }

    function generate() {
      if (!state.text.trim()) return;
      Usion.requestPayment(20, 'Text to Speech');
    }

    Usion.on('PAYMENT_SUCCESS', async () => {
      const btn = document.getElementById('genBtn');
      btn.disabled = true;
      btn.textContent = 'Generating...';

      try {
        const res = await fetch('/api/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: state.text })
        });
        const data = await res.json();

        state.audioUrl = data.audioUrl;

        const player = document.getElementById('player');
        player.src = data.audioUrl;
        player.classList.remove('usion-hidden');
        player.play();

        document.getElementById('shareBtn').classList.remove('usion-hidden');
      } catch (e) {
        Usion.error('Generation failed');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generate (20 credits)';
      }
    });

    function share() {
      if (!state.audioUrl) return;
      Usion.share({
        contentType: 'audio',
        audioUrl: state.audioUrl,
        text: state.text,
        title: 'Voiceify TTS',
        message: state.text
      });
    }
  </script>
</body>
</html>
```

Service backend (`server.js`):

```javascript
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/synthesize', async (req, res) => {
  try {
    const { text, voice = 'default' } = req.body;
    const response = await fetch('http://your-tts-api/v1/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice })
    });
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    res.json({ audioUrl: `data:audio/wav;base64,${base64}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.listen(process.env.PORT || 3003);
```

---

## Troubleshooting

### Connection Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Connection closes before join | Token verification failing or JWKS unreachable | Check token verification and JWKS reachability; ensure WebSocket path is exactly `/ws` |
| Always waiting `1/2` | Players not in same room | Both users must join the same `room_id` |
| `signature verification failed` | JWKS mismatch | Token was issued by one backend but validated against another; align `API_URL`/`JWKS_URL` |

### Turn-Based / Platform Relay Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Both players see "Opponent's turn" | Match started from `player_ids.length`, but opponent was not fully live yet | Gate match start and first move on `connected_count` / `player.is_connected`, not only `player_ids` |
| `onPlayerJoined` shows undefined player | Using `data.player_id` (doesn't exist) | Use `data.player_ids` array or `data.player.id` |
| Opponent's moves never arrive | Missing `onAction` handler or no sync fallback | Register `onAction` AND `onSync` before `join()` |
| Game state out of sync after reconnect | No sync-on-reconnect | Call `Usion.game.requestSync(lastSequence)` in `onReconnect` |
| Duplicate moves applied | Not tracking sequence numbers | Track `lastSequence` and skip already-processed sequences |
| Move appears only after reload | Live UI depends on sync replay instead of realtime transport | Send immediate UI snapshots via `Usion.game.realtime(...)`; keep `Usion.game.action(...)` for persisted replayable facts |
| Invite says 2 players, but game still waits or desyncs | Using `player_ids.length` as live presence | Use `connected_count` / live join events for readiness; treat `player_ids` as membership only |
| Both clients are stuck on rematch | Waiting for a restart event that never comes | Treat the second rematch confirmation as the reset trigger, and move both clients to a fresh state immediately |
| Board matches but status text differs | Turn / winner / rematch UI is computed locally | Derive turn, winner, and rematch status from shared game state, not `You` / `Opponent` perspective text |

### Deployment Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Railway shows `Not Found` | Domain not provisioned | Generate public domain in Settings -> Networking and wait |
| `WebSocket URL must be a valid URL` | Using `https://` in WebSocket field | Use `wss://` protocol |
| Service loads but realtime never connects | Wrong WebSocket path | Use `wss://your-domain.up.railway.app/ws` |
| Room breaks on redeploy | Multiple replicas with in-memory state | Keep Replicas = 1 |

### Result Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Match result rejected | Signing secret mismatch | Ensure `SIGNING_SECRET` matches service registration |

---

## API Summary

| Method | Description |
|---|---|
| `Usion.init(callback)` | Initialize SDK, receive config |
| `Usion.user.getId()` | Get current user ID |
| `Usion.user.getName()` | Get display name |
| `Usion.user.getAvatar()` | Get avatar URL |
| `Usion.user.getToken()` | Get JWT auth token |
| `Usion.storage.get(key)` | Read persistent data |
| `Usion.storage.set(key, value)` | Write persistent data |
| `Usion.storage.remove(key)` | Delete key |
| `Usion.storage.clear()` | Clear all storage |
| `Usion.storage.keys()` | List all keys |
| `Usion.wallet.getBalance()` | Get credit balance |
| `Usion.wallet.hasCredits(amount)` | Check if user can afford |
| `Usion.wallet.requestPayment(amount, reason)` | Charge credits |
| `Usion.wallet.onBalanceChange(callback)` | Listen for balance changes |
| `Usion.requestPayment(amount, reason)` | Event-based payment request |
| `Usion.on(event, callback)` | Listen for events |
| `Usion.game.connect()` | Connect to platform game socket |
| `Usion.game.connectDirect()` | Connect to direct WebSocket |
| `Usion.game.join(roomId)` | Join a game room |
| `Usion.game.leave()` | Leave current room |
| `Usion.game.action(type, data)` | Send stored game action |
| `Usion.game.realtime(type, data)` | Send fire-and-forget data |
| `Usion.game.requestSync(lastSeq)` | Request missed actions |
| `Usion.game.requestRematch()` | Request/accept rematch |
| `Usion.game.forfeit()` | Forfeit the game |
| `Usion.game.disconnect()` | Disconnect from socket |
| `Usion.share(contentType, data)` | Share content to feed |
| `Usion.submit(data)` | Submit result to parent |
| `Usion.exit()` | Close the service/game |
| `Usion.error(message)` | Report error |
| `Usion.log(message)` | Log to native console |
| `Usion.setLoading(selector, bool)` | Toggle button loading state |
| `Usion.toggle(selector, bool)` | Show/hide element |
| `Usion.charCount(input, counter, max)` | Character counter |
| `Usion.selectionGrid(grid, item, cb)` | Selection grid helper |
| `Usion.session.getId()` | Get session ID |
| `Usion.session.setData(key, value)` | Set ephemeral data |
| `Usion.session.getData(key)` | Get ephemeral data |
| `Usion.session.clear()` | Clear session data |

---

## LLM Prompt Template

Use this prompt to generate a compatible game implementation with any LLM:

> Build a browser multiplayer game for Usion Direct Mode v2. Requirements: expose WebSocket endpoint at `/ws`, accept access token via query `token`, validate RS256 JWT via JWKS (`${API_URL}/.well-known/jwks.json`), support message types `join`, `input`, `ping`, maintain authoritative server loop, broadcast `joined`, `player_joined`, `state_delta`, `state_snapshot`, `match_end`, and submit signed match result to `${API_URL}/games/direct/results` using HMAC SHA256 headers (`X-Usion-Service-Id`, `X-Usion-Key-Id`, `X-Usion-Signature`, `X-Usion-Timestamp`, `X-Idempotency-Key`). Provide Railway-ready deployment files and env usage with minimal variables.

---

## Checklist

Before submitting your game or service:

### All Apps
- [ ] Include `usion-sdk.js`
- [ ] Call `Usion.init()` before anything else
- [ ] Use `100dvh` for full-height layout
- [ ] Handle touch input for mobile
- [ ] Test within Usion app (iframe embedding)
- [ ] Host and register your service URL

### Games (Multiplayer)
- [ ] Test with 2+ players joining and playing
- [ ] Handle player disconnect/reconnect gracefully
- [ ] Use `data.player_ids` array in `onPlayerJoined` (NOT `data.player_id`)
- [ ] Do not use `player_ids.length` as a live joined-player count
- [ ] Gate match start / waiting overlay / first move on `connected_count` or `player.is_connected`
- [ ] Implement `onSync` handler alongside `onAction` for turn-based games
- [ ] Do not rely on `onSync` for normal live updates
- [ ] Use `Usion.game.realtime(...)` for immediate UI snapshots when gameplay must update instantly in iframe/proxy mode
- [ ] Ensure turn / win / rematch status text is derived from shared game state for all players
- [ ] Define rematch acceptance flow explicitly; do not assume the platform will reset the game for you
- [ ] Call `requestSync(lastSequence)` on reconnect
- [ ] Register all event handlers BEFORE calling `Usion.game.join()`
- [ ] Track `sequence` numbers from action/sync events
- [ ] If direct mode: WebSocket at `/ws` accepts token auth
- [ ] If direct mode: JWKS validation works against production
- [ ] If direct mode: match results are signed and submitted

### Services (Paid Content)
- [ ] Call `Usion.requestPayment()` before paid actions
- [ ] Handle `PAYMENT_SUCCESS` and `PAYMENT_FAILED`
- [ ] Store result in state for sharing
- [ ] **Share button visible after generating content**
- [ ] Share includes `contentType`, URL, `text`, `title`, `message`
- [ ] Show loading states during generation
- [ ] Handle errors with `Usion.error()`

### Design
- [ ] Use `usion-design-system.css` classes
- [ ] Follow black/white minimalist design
- [ ] No custom fonts (use system font)
- [ ] No hover-only interactions
- [ ] Don't use `alert()` — use `Usion.error()`
