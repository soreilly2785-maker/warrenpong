const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
const ARENA_WIDTH = 1200;
const ARENA_HEIGHT = 700;
const PADDLE_DEFAULT_HEIGHT = 58;
const PADDLE_WIDTH = 16;
const P1_X = 180;
const P2_X = 1004;
const BALL_RADIUS = 10;
const TICK_RATE = 45;
const TICK_INTERVAL = 1000 / TICK_RATE;

// --- PERSISTENT CALLSIGN LEADERBOARD & H2H STORAGE ---
const DATA_DIR = path.join(__dirname, 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

let leaderboardData = {
  players: {}, // [name]: { wins: 0, losses: 0, totalGames: 0, streak: 0, bestStreak: 0, lastPlayed: 0 }
  h2h: {}      // ["PlayerA:::PlayerB"]: { [PlayerA]: wins, [PlayerB]: wins, totalGames: 0 }
};

function loadLeaderboard() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
      leaderboardData = JSON.parse(raw);
      if (!leaderboardData.players) leaderboardData.players = {};
      if (!leaderboardData.h2h) leaderboardData.h2h = {};
    }
  } catch (err) {
    console.error('Error loading leaderboard:', err);
  }
}
loadLeaderboard();

let saveTimeout = null;
function saveLeaderboard() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboardData, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving leaderboard:', err);
    }
  }, 300);
}

function getTop5Leaderboard() {
  const list = Object.entries(leaderboardData.players).map(([name, data]) => {
    const wins = data.wins || 0;
    const losses = data.losses || 0;
    const total = data.totalGames || (wins + losses);
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return {
      name,
      wins,
      losses,
      totalGames: total,
      winRate,
      streak: data.streak || 0,
      bestStreak: data.bestStreak || 0
    };
  });

  list.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.totalGames - a.totalGames;
  });

  return list.slice(0, 5);
}

function getH2H(p1Name, p2Name) {
  if (!p1Name || !p2Name || p1Name === p2Name) return { p1Wins: 0, p2Wins: 0, totalGames: 0 };
  const n1 = p1Name.trim();
  const n2 = p2Name.trim();
  const pairKey = [n1, n2].sort().join(':::');
  const h2h = leaderboardData.h2h[pairKey];
  if (!h2h) {
    return { p1Wins: 0, p2Wins: 0, totalGames: 0 };
  }
  return {
    p1Wins: h2h[n1] || 0,
    p2Wins: h2h[n2] || 0,
    totalGames: h2h.totalGames || 0
  };
}

function recordMatchResult(winnerName, loserName) {
  if (!winnerName || !loserName || winnerName === 'Draw') return;
  const wName = winnerName.trim();
  const lName = loserName.trim();
  if (!wName || !lName || wName === lName) return;

  const now = Date.now();

  // Winner stats
  if (!leaderboardData.players[wName]) {
    leaderboardData.players[wName] = { wins: 0, losses: 0, totalGames: 0, streak: 0, bestStreak: 0, lastPlayed: now };
  }
  const wPlayer = leaderboardData.players[wName];
  wPlayer.wins = (wPlayer.wins || 0) + 1;
  wPlayer.totalGames = (wPlayer.totalGames || 0) + 1;
  wPlayer.streak = (wPlayer.streak || 0) + 1;
  wPlayer.bestStreak = Math.max(wPlayer.bestStreak || 0, wPlayer.streak);
  wPlayer.lastPlayed = now;

  // Loser stats
  if (!leaderboardData.players[lName]) {
    leaderboardData.players[lName] = { wins: 0, losses: 0, totalGames: 0, streak: 0, bestStreak: 0, lastPlayed: now };
  }
  const lPlayer = leaderboardData.players[lName];
  lPlayer.losses = (lPlayer.losses || 0) + 1;
  lPlayer.totalGames = (lPlayer.totalGames || 0) + 1;
  lPlayer.streak = 0;
  lPlayer.lastPlayed = now;

  // H2H Record
  const pairKey = [wName, lName].sort().join(':::');
  if (!leaderboardData.h2h[pairKey]) {
    leaderboardData.h2h[pairKey] = {
      [wName]: 0,
      [lName]: 0,
      totalGames: 0
    };
  }
  const h2hRecord = leaderboardData.h2h[pairKey];
  h2hRecord[wName] = (h2hRecord[wName] || 0) + 1;
  if (h2hRecord[lName] === undefined) h2hRecord[lName] = 0;
  h2hRecord.totalGames = (h2hRecord.totalGames || 0) + 1;

  saveLeaderboard();
  broadcastLeaderboard();
}

function broadcastLeaderboard() {
  const top5 = getTop5Leaderboard();
  io.emit('leaderboard_update', { top5 });
}

function broadcastMatchmakingRadar() {
  let waitingCount = 0;
  for (const room of rooms.values()) {
    if (room.game.state === 'waiting' && Object.keys(room.players).length === 1) {
      waitingCount++;
    }
  }
  io.emit('matchmaking_status', {
    hasWaitingPlayer: waitingCount > 0,
    waitingCount: waitingCount
  });
}

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/leaderboard', (req, res) => res.json({ top5: getTop5Leaderboard() }));
app.get('/api/h2h', (req, res) => res.json({ h2h: getH2H(req.query.p1, req.query.p2) }));

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const addr = iface.address;
        if (addr.startsWith('192.168.') || addr.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(addr)) {
          candidates.unshift(addr);
        } else if (!addr.startsWith('169.254.')) {
          candidates.push(addr);
        }
      }
    }
  }
  return candidates.length > 0 ? candidates[0] : 'localhost';
}

app.get('/api/lan-info', async (req, res) => {
  const ip = getLocalIp();
  const url = `http://${ip}:${PORT}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(url, {
      margin: 1,
      color: { dark: '#00f0ff', light: '#0a0d1a' }
    });
    res.json({ ip, port: PORT, url, qrCode: qrDataUrl });
  } catch (err) {
    res.json({ ip, port: PORT, url, qrCode: null });
  }
});

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 100% PERFECT MIRRORED 3-ROW LAYOUT (36 Bricks Total)
// Front shields NEVER drop power-ups, avoiding instant start bonuses!
function createBrickLayout() {
  const bricks = [];
  const rows = 6;
  const brickWidth = 24;
  const brickHeight = 85;
  const gapY = 12;
  const startY = 60;

  // Left Player (P1)
  // Col 1 (Rear Cores): X = 40
  // Col 2 (Mid Def): X = 80
  // Col 3 (Front Shields): X = 120
  for (let r = 0; r < rows; r++) {
    const y = startY + r * (brickHeight + gapY);

    // Col 1: Rear Core Crystals (2 HP, 300 pts)
    bricks.push({
      id: `p1_core_${r}`,
      owner: 'p1',
      x: 40,
      y: y,
      w: brickWidth,
      h: brickHeight,
      type: 'core',
      hp: 2,
      maxHp: 2,
      powerup: null,
      alive: true
    });

    // Col 2: Mid Defense (Balanced powerup distribution across all rows)
    let midPowerup = null;
    if (r === 0) midPowerup = 'giant';
    else if (r === 1) midPowerup = 'guided';
    else if (r === 2) midPowerup = 'barrier';
    else if (r === 3) midPowerup = 'barrier';
    else if (r === 4) midPowerup = 'fireball';
    else if (r === 5) midPowerup = 'multiball';

    bricks.push({
      id: `p1_mid_${r}`,
      owner: 'p1',
      x: 80,
      y: y,
      w: brickWidth,
      h: brickHeight,
      type: midPowerup ? 'power' : 'normal',
      hp: 1,
      maxHp: 1,
      powerup: midPowerup,
      alive: true
    });

    // Col 3: Front Shields (Pure 1-HP barrier, NO power-ups)
    bricks.push({
      id: `p1_front_${r}`,
      owner: 'p1',
      x: 120,
      y: y,
      w: brickWidth,
      h: brickHeight,
      type: 'normal',
      hp: 1,
      maxHp: 1,
      powerup: null,
      alive: true
    });
  }

  // Right Player (P2) - EXACT MIRROR
  // Col 1 (Front Shields): X = 1200 - 120 - 24 = 1056
  // Col 2 (Mid Def): X = 1200 - 80 - 24 = 1096
  // Col 3 (Rear Cores): X = 1200 - 40 - 24 = 1136
  for (let r = 0; r < rows; r++) {
    const y = startY + r * (brickHeight + gapY);

    // Col 1: Front Shields (Pure 1-HP barrier, NO power-ups)
    bricks.push({
      id: `p2_front_${r}`,
      owner: 'p2',
      x: 1056,
      y: y,
      w: brickWidth,
      h: brickHeight,
      type: 'normal',
      hp: 1,
      maxHp: 1,
      powerup: null,
      alive: true
    });

    // Col 2: Mid Defense
    let midPowerup = null;
    if (r === 0) midPowerup = 'giant';
    else if (r === 1) midPowerup = 'guided';
    else if (r === 2) midPowerup = 'barrier';
    else if (r === 3) midPowerup = 'barrier';
    else if (r === 4) midPowerup = 'fireball';
    else if (r === 5) midPowerup = 'multiball';

    bricks.push({
      id: `p2_mid_${r}`,
      owner: 'p2',
      x: 1096,
      y: y,
      w: brickWidth,
      h: brickHeight,
      type: midPowerup ? 'power' : 'normal',
      hp: 1,
      maxHp: 1,
      powerup: midPowerup,
      alive: true
    });

    // Col 3: Rear Core Crystals
    bricks.push({
      id: `p2_core_${r}`,
      owner: 'p2',
      x: 1136,
      y: y,
      w: brickWidth,
      h: brickHeight,
      type: 'core',
      hp: 2,
      maxHp: 2,
      powerup: null,
      alive: true
    });
  }

  return bricks;
}

function createInitialGameState() {
  return {
    state: 'waiting',
    countdown: 3,
    timeRemaining: 180,
    airdropTimer: 30,
    isSuddenDeath: false,
    balls: [
      {
        id: 'ball_0',
        x: ARENA_WIDTH / 2,
        y: ARENA_HEIGHT / 2,
        prevX: ARENA_WIDTH / 2,
        prevY: ARENA_HEIGHT / 2,
        vx: (Math.random() > 0.5 ? 1 : -1) * 8.5,
        vy: (Math.random() * 3 - 1.5),
        speed: 8.5,
        radius: BALL_RADIUS,
        lastHitter: null,
        type: 'normal',
        isTurbo: false,
        typeTimer: 0,
        curveDir: 0,
        curvePhase: 0
      }
    ],
    paddles: {
      p1: {
        y: ARENA_HEIGHT / 2 - PADDLE_DEFAULT_HEIGHT / 2,
        targetY: ARENA_HEIGHT / 2 - PADDLE_DEFAULT_HEIGHT / 2,
        height: PADDLE_DEFAULT_HEIGHT,
        width: PADDLE_WIDTH,
        x: P1_X,
        score: 0,
        combo: 0,
        maxCombo: 0,
        bricksDestroyed: 0,
        powerupsCollected: 0,
        charge: 0,
        turboTimer: 0,
        activeEffects: {}
      },
      p2: {
        y: ARENA_HEIGHT / 2 - PADDLE_DEFAULT_HEIGHT / 2,
        targetY: ARENA_HEIGHT / 2 - PADDLE_DEFAULT_HEIGHT / 2,
        height: PADDLE_DEFAULT_HEIGHT,
        width: PADDLE_WIDTH,
        x: P2_X,
        score: 0,
        combo: 0,
        maxCombo: 0,
        bricksDestroyed: 0,
        powerupsCollected: 0,
        charge: 0,
        turboTimer: 0,
        activeEffects: {}
      }
    },
    bricks: createBrickLayout(),
    powerupItems: [],
    events: [],
    winner: null,
    winReason: null
  };
}

class Room {
  constructor(code) {
    this.code = code;
    this.players = {};
    this.spectators = new Set();
    this.rematchVotes = new Set();
    this.game = createInitialGameState();
    this.timer = null;
    this.nextEntityId = 1;
  }

  addPlayer(socket, name) {
    const currentSlots = Object.values(this.players).map(p => p.slot);
    let assignedSlot = null;

    if (!currentSlots.includes('p1')) {
      assignedSlot = 'p1';
    } else if (!currentSlots.includes('p2')) {
      assignedSlot = 'p2';
    }

    if (assignedSlot) {
      this.players[socket.id] = {
        id: socket.id,
        name: name || (assignedSlot === 'p1' ? 'Player 1' : 'Player 2'),
        slot: assignedSlot,
        ready: false
      };
      socket.join(this.code);

      if (Object.keys(this.players).length === 2 && this.game.state === 'waiting') {
        const pList = Object.values(this.players);
        const p1Name = pList[0].name;
        const p2Name = pList[1].name;
        const h2h = getH2H(p1Name, p2Name);

        io.to(this.code).emit('h2h_data', {
          p1Name,
          p2Name,
          h2h
        });

        this.startCountdown();
      }

      this.broadcastLobbyUpdate();
      broadcastMatchmakingRadar();
      return { slot: assignedSlot, success: true };
    } else {
      this.spectators.add(socket.id);
      socket.join(this.code);
      this.broadcastLobbyUpdate();
      return { slot: 'spectator', success: true };
    }
  }

  removePlayer(socketId) {
    let wasPlayer = false;
    if (this.players[socketId]) {
      const leavingPlayer = this.players[socketId];
      delete this.players[socketId];
      this.rematchVotes.delete(socketId);
      wasPlayer = true;

      io.to(this.code).emit('rematch_update', { votes: 0, totalNeeded: 2, cancelled: true });

      if (this.game.state === 'playing' || this.game.state === 'countdown') {
        const remainingPlayer = Object.values(this.players)[0];
        if (remainingPlayer) {
          this.endGame(remainingPlayer.slot, `${leavingPlayer.name} left the match`);
        } else {
          this.stopLoop();
          this.game = createInitialGameState();
        }
      } else if (this.game.state === 'ended') {
        this.stopLoop();
        this.game = createInitialGameState();
        io.to(this.code).emit('opponent_left', { message: `${leavingPlayer.name} returned to lobby.` });
      }
    }
    this.spectators.delete(socketId);
    this.broadcastLobbyUpdate();
    broadcastMatchmakingRadar();
    return wasPlayer;
  }

  broadcastLobbyUpdate() {
    const playerList = Object.values(this.players).map(p => ({
      id: p.id,
      name: p.name,
      slot: p.slot,
      ready: p.ready
    }));
    io.to(this.code).emit('lobby_update', {
      roomCode: this.code,
      players: playerList,
      spectatorsCount: this.spectators.size,
      state: this.game.state
    });
  }

  startCountdown() {
    this.game = createInitialGameState();
    this.game.state = 'countdown';
    this.game.countdown = 3;
    this.rematchVotes.clear();
    this.startLoop();
    broadcastMatchmakingRadar();

    let count = 3;
    io.to(this.code).emit('game_countdown', { count });
    
    const interval = setInterval(() => {
      if (Object.keys(this.players).length < 2) {
        clearInterval(interval);
        this.stopLoop();
        this.game.state = 'waiting';
        return;
      }

      count--;
      if (count > 0) {
        io.to(this.code).emit('game_countdown', { count });
      } else {
        clearInterval(interval);
        this.game.state = 'playing';
        io.to(this.code).emit('game_start', {
          players: this.players,
          bricks: this.game.bricks
        });
      }
    }, 1000);
  }

  startLoop() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL);
  }

  stopLoop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  handlePlayerInput(socketId, input) {
    const player = this.players[socketId];
    if (!player || !this.game.paddles[player.slot]) return;

    const paddle = this.game.paddles[player.slot];
    if (typeof input.targetY === 'number') {
      paddle.targetY = Math.max(10, Math.min(ARENA_HEIGHT - paddle.height - 10, input.targetY));
    }

    if (input.turbo && paddle.charge >= 100 && paddle.turboTimer <= 0) {
      paddle.turboTimer = 8.0;
      paddle.charge = 0;
      this.game.events.push({
        type: 'turbo_activate',
        slot: player.slot,
        x: paddle.x + paddle.width / 2,
        y: paddle.y + paddle.height / 2
      });
    }
  }

  spawnRandomAirdrop() {
    const types = ['giant', 'guided', 'multiball', 'fireball', 'barrier', 'emp', 'repair'];
    const p1Type = types[Math.floor(Math.random() * types.length)];
    const p2Type = types[Math.floor(Math.random() * types.length)];
    const spawnY1 = 120 + Math.random() * (ARENA_HEIGHT - 240);
    const spawnY2 = 120 + Math.random() * (ARENA_HEIGHT - 240);

    // Dual Fair Balanced Airdrops: Capsule 1 floats to P1 (Left), Capsule 2 floats to P2 (Right)
    this.game.powerupItems.push({
      id: `airdrop_${this.nextEntityId++}`,
      type: p1Type,
      x: ARENA_WIDTH / 2 - 30,
      y: spawnY1,
      vx: -2.2,
      vy: (Math.random() * 2 - 1) * 0.7,
      radius: 16
    });

    this.game.powerupItems.push({
      id: `airdrop_${this.nextEntityId++}`,
      type: p2Type,
      x: ARENA_WIDTH / 2 + 30,
      y: spawnY2,
      vx: 2.2,
      vy: (Math.random() * 2 - 1) * 0.7,
      radius: 16
    });

    this.game.events.push({
      type: 'airdrop_spawn',
      x: ARENA_WIDTH / 2,
      y: 350,
      powerup: 'dual'
    });
  }

  tick() {
    if (this.game.state !== 'playing') {
      if (this.game.state === 'ended') {
        this.stopLoop();
      }
      return;
    }

    this.game.events = [];

    // Match Timer
    this.game.timeRemaining -= 1 / TICK_RATE;
    if (this.game.timeRemaining <= 0) {
      this.game.timeRemaining = 0;
      const p1Score = this.game.paddles.p1.score;
      const p2Score = this.game.paddles.p2.score;
      if (p1Score > p2Score) {
        this.endGame('p1', 'Time Expired - Highest Score');
      } else if (p2Score > p1Score) {
        this.endGame('p2', 'Time Expired - Highest Score');
      } else {
        this.endGame('draw', 'Time Expired - It\'s a Draw!');
      }
      return;
    }

    // Mid/Late Game Random Airdrops (Every 20-26s)
    this.game.airdropTimer -= 1 / TICK_RATE;
    if (this.game.airdropTimer <= 0) {
      this.spawnRandomAirdrop();
      this.game.airdropTimer = 20 + Math.random() * 6;
    }

    // End-Game Acceleration Check (< 12 total bricks remaining)
    const aliveBricksCount = this.game.bricks.filter(b => b.alive).length;
    const isSuddenDeath = aliveBricksCount < 12;
    if (isSuddenDeath && !this.game.isSuddenDeath) {
      this.game.isSuddenDeath = true;
      this.game.events.push({ type: 'sudden_death_start' });
    }

    // Update Paddles
    ['p1', 'p2'].forEach(slot => {
      const paddle = this.game.paddles[slot];
      const prevY = paddle.y;
      paddle.y += (paddle.targetY - paddle.y) * 0.45;
      paddle.vy = (paddle.y - prevY) * TICK_RATE; // Vertical velocity in px/sec
      paddle.prevY = prevY;

      if (paddle.turboTimer > 0) {
        paddle.turboTimer -= 1 / TICK_RATE;
        if (paddle.turboTimer <= 0) paddle.turboTimer = 0;
      }

      for (const [effect, timer] of Object.entries(paddle.activeEffects)) {
        if (timer > 0) {
          paddle.activeEffects[effect] -= 1 / TICK_RATE;
          if (paddle.activeEffects[effect] <= 0) {
            delete paddle.activeEffects[effect];
            if (effect === 'giant' || effect === 'shrink') {
              if (paddle.activeEffects.giant > 0) {
                paddle.height = 92;
              } else if (paddle.activeEffects.shrink > 0) {
                paddle.height = Math.round(PADDLE_DEFAULT_HEIGHT * 0.85);
              } else {
                paddle.height = PADDLE_DEFAULT_HEIGHT;
              }
            }
          }
        }
      }
    });

    // Update Powerup Floating Items
    for (let i = this.game.powerupItems.length - 1; i >= 0; i--) {
      const item = this.game.powerupItems[i];
      item.x += item.vx;
      item.y += item.vy;

      if (item.y < 30 || item.y > ARENA_HEIGHT - 30) {
        item.vy = -item.vy;
      }

      ['p1', 'p2'].forEach(slot => {
        const paddle = this.game.paddles[slot];
        if (
          item.x + item.radius >= paddle.x &&
          item.x - item.radius <= paddle.x + paddle.width &&
          item.y + item.radius >= paddle.y &&
          item.y - item.radius <= paddle.y + paddle.height
        ) {
          this.applyPowerup(slot, item.type);
          this.game.events.push({ type: 'powerup_collect', slot, powerup: item.type, x: item.x, y: item.y });
          this.game.powerupItems.splice(i, 1);
        }
      });

      if (item.x < 0 || item.x > ARENA_WIDTH) {
        this.game.powerupItems.splice(i, 1);
      }
    }

    // Update Balls with Swept Continuous Collision Detection (CCD)
    for (let i = this.game.balls.length - 1; i >= 0; i--) {
      const ball = this.game.balls[i];
      ball.prevX = ball.x;
      ball.prevY = ball.y;

      // 1. Magnus Effect: Ball Curvature from Paddle Spin Transfer
      if (ball.spin) {
        ball.vy += ball.spin * 0.28;
        ball.spin *= 0.982;
        if (Math.abs(ball.spin) < 0.01) ball.spin = 0;
      }

      // 2. Real-Time Direction-Aware Remote Steering for Guided Ball
      if (ball.type === 'guided' && ball.lastHitter) {
        const ownerPaddle = this.game.paddles[ball.lastHitter];
        if (ownerPaddle) {
          const steerTargetY = ownerPaddle.y + ownerPaddle.height / 2;
          const diffY = steerTargetY - ball.y;
          const isMovingTowardOpponent = (ball.lastHitter === 'p1' && ball.vx > 0) || (ball.lastHitter === 'p2' && ball.vx < 0);
          
          if (isMovingTowardOpponent) {
            // Highly responsive agile steering when attacking opponent
            ball.vy += Math.sign(diffY) * Math.min(0.95, Math.abs(diffY) * 0.075);
          } else {
            // Predictable, gentle return lines on the way back
            ball.vy += Math.sign(diffY) * Math.min(0.25, Math.abs(diffY) * 0.015);
          }
          if (Math.abs(ball.vy) > Math.abs(ball.vx) * 0.88) {
            ball.vy = Math.sign(ball.vy) * Math.abs(ball.vx) * 0.88;
          }
        }
      }

      ball.x += ball.vx;
      ball.y += ball.vy;

      if (ball.typeTimer > 0) {
        ball.typeTimer -= 1 / TICK_RATE;
        if (ball.typeTimer <= 0) {
          ball.type = 'normal';
        }
      }

      // Walls
      if (ball.y - ball.radius <= 10) {
        ball.y = 10 + ball.radius;
        ball.vy = Math.abs(ball.vy);
        if (ball.spin) ball.spin *= -0.5;
        this.game.events.push({ type: 'wall_bounce', x: ball.x, y: ball.y });
      } else if (ball.y + ball.radius >= ARENA_HEIGHT - 10) {
        ball.y = ARENA_HEIGHT - 10 - ball.radius;
        ball.vy = -Math.abs(ball.vy);
        if (ball.spin) ball.spin *= -0.5;
        this.game.events.push({ type: 'wall_bounce', x: ball.x, y: ball.y });
      }

      // Center Line 1-Way Defense Barrier Collision (X = 600, Top 1/5th [0, 140] & Bottom 1/5th [560, 700])
      const isBarrierSector = (ball.y >= 0 && ball.y <= 140) || (ball.y >= 560 && ball.y <= 700);
      if (isBarrierSector) {
        // P1 Barrier: Blocks incoming opponent shots (vx < 0) from crossing into P1's side
        if (this.game.paddles.p1.activeEffects.barrier > 0 && ball.vx < 0) {
          if (ball.prevX >= 600 && ball.x <= 600 + ball.radius) {
            ball.x = 600 + ball.radius;
            ball.vx = Math.abs(ball.vx) * 1.05;
            this.game.events.push({
              type: 'barrier_hit',
              slot: 'p1',
              x: 600,
              y: ball.y
            });
          }
        }
        // P2 Barrier: Blocks incoming opponent shots (vx > 0) from crossing into P2's side
        if (this.game.paddles.p2.activeEffects.barrier > 0 && ball.vx > 0) {
          if (ball.prevX <= 600 && ball.x >= 600 - ball.radius) {
            ball.x = 600 - ball.radius;
            ball.vx = -Math.abs(ball.vx) * 1.05;
            this.game.events.push({
              type: 'barrier_hit',
              slot: 'p2',
              x: 600,
              y: ball.y
            });
          }
        }
      }

      // Continuous Collision Detection for P1 Paddle (X = 180, plane at 196)
      const p1 = this.game.paddles.p1;
      let p1Hit = false;

      if (ball.vx < 0) {
        const p1PlaneX = p1.x + p1.width; // 196
        if (ball.prevX >= p1.x && ball.x <= p1PlaneX + ball.radius) {
          const t = (p1PlaneX - ball.prevX) / (ball.x - ball.prevX || -0.001);
          const clampedT = Math.max(0, Math.min(1, t));
          const hitY = ball.prevY + (ball.y - ball.prevY) * clampedT;

          if (hitY + ball.radius >= p1.y && hitY - ball.radius <= p1.y + p1.height) {
            p1Hit = true;
            ball.x = p1PlaneX + ball.radius;
            ball.y = hitY;
            this.handlePaddleHit(ball, p1, 'p1', isSuddenDeath);
          }
        }
      }

      // Continuous Collision Detection for P2 Paddle (X = 1004, plane at 1004)
      const p2 = this.game.paddles.p2;
      let p2Hit = false;

      if (ball.vx > 0 && !p1Hit) {
        const p2PlaneX = p2.x; // 1004
        if (ball.prevX <= p2.x + p2.width && ball.x >= p2PlaneX - ball.radius) {
          const t = (p2PlaneX - ball.prevX) / (ball.x - ball.prevX || 0.001);
          const clampedT = Math.max(0, Math.min(1, t));
          const hitY = ball.prevY + (ball.y - ball.prevY) * clampedT;

          if (hitY + ball.radius >= p2.y && hitY - ball.radius <= p2.y + p2.height) {
            p2Hit = true;
            ball.x = p2PlaneX - ball.radius;
            ball.y = hitY;
            this.handlePaddleHit(ball, p2, 'p2', isSuddenDeath);
          }
        }
      }

      // Brick Collision
      for (const brick of this.game.bricks) {
        if (!brick.alive) continue;

        const nearestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
        const nearestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
        const deltaX = ball.x - nearestX;
        const deltaY = ball.y - nearestY;

        if ((deltaX * deltaX + deltaY * deltaY) < (ball.radius * ball.radius)) {
          const hitterSlot = ball.lastHitter || (brick.owner === 'p1' ? 'p2' : 'p1');

          brick.hp -= (ball.type === 'fireball' ? 2 : 1);
          if (brick.hp <= 0) {
            brick.alive = false;
            this.handleBrickDestroyed(brick, hitterSlot);
          }
          this.broadcastBrickUpdate(brick);

          this.game.events.push({
            type: 'brick_hit',
            brickId: brick.id,
            x: nearestX,
            y: nearestY,
            destroyed: !brick.alive,
            isFireball: ball.type === 'fireball',
            isGuided: ball.type === 'guided'
          });

          // Fireball breaks 1 brick with 2 damage, then consumes flame & reverts to normal ball
          if (ball.type === 'fireball') {
            ball.type = 'normal';
          }

          const overlapX = (brick.w / 2 + ball.radius) - Math.abs(ball.x - (brick.x + brick.w / 2));
          const overlapY = (brick.h / 2 + ball.radius) - Math.abs(ball.y - (brick.y + brick.h / 2));
          if (overlapX < overlapY) {
            ball.vx = -ball.vx;
          } else {
            ball.vy = -ball.vy;
          }
          if (ball.spin) ball.spin *= -0.5;

          this.checkWinCondition();
          break;
        }
      }

      // Goals
      if (ball.x < 10) {
        this.game.paddles.p2.score += 250;
        this.game.events.push({ type: 'goal_score', scorer: 'p2', x: ball.x, y: ball.y });

        if (this.game.balls.length > 1) {
          this.game.balls.splice(i, 1);
          continue;
        } else {
          this.resetBall(ball, 'p1');
        }
      } else if (ball.x > ARENA_WIDTH - 10) {
        this.game.paddles.p1.score += 250;
        this.game.events.push({ type: 'goal_score', scorer: 'p1', x: ball.x, y: ball.y });

        if (this.game.balls.length > 1) {
          this.game.balls.splice(i, 1);
          continue;
        } else {
          this.resetBall(ball, 'p2');
        }
      }
    }

    io.to(this.code).emit('game_tick', this.getCompactDeltaTick());
  }

  broadcastBrickUpdate(brick) {
    io.to(this.code).emit('brick_update', {
      id: brick.id,
      hp: brick.hp,
      alive: brick.alive
    });
  }

  handlePaddleHit(ball, paddle, slot, isSuddenDeath = false) {
    // 1. EMP Shock: If incoming ball was electrified by opponent, reliably shrink this paddle by 15% (10s duration)
    if (ball.type === 'emp' && ball.lastHitter && ball.lastHitter !== slot) {
      paddle.activeEffects.shrink = 10;
      if (paddle.activeEffects.giant <= 0) {
        paddle.height = Math.round(PADDLE_DEFAULT_HEIGHT * 0.85); // 49px
      }
      this.game.events.push({
        type: 'emp_hit',
        slot,
        x: ball.x,
        y: ball.y
      });
      ball.type = 'normal'; // Consumed on impact
    }

    ball.lastHitter = slot;

    if (paddle.turboTimer <= 0) {
      paddle.charge = Math.min(100, paddle.charge + 25);
    }

    // 2. Baguette Curved Surface Normal & Incident Reflection Angle
    const relativeHitY = (ball.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2);
    const clampedHit = Math.max(-0.9, Math.min(0.9, relativeHitY));
    const surfaceNormalAngle = clampedHit * (Math.PI / 4.5); // ~40 deg at baguette tips
    const incidentAngle = Math.atan2(ball.vy, Math.abs(ball.vx));
    const bounceAngle = Math.max(-1.22, Math.min(1.22, 0.70 * surfaceNormalAngle + 0.30 * incidentAngle));

    // 3. Paddle Motion -> Ball Spin Transfer (Magnus Effect)
    // When Fireball is active, spin is amplified 3x for dramatic, controllable bending curveballs!
    const hasGuided = (paddle.activeEffects.guided > 0);
    const hasFireball = (paddle.activeEffects.fireball > 0);
    const hasEmp = (paddle.activeEffects.emp > 0);
    const isTurboActive = (paddle.turboTimer > 0);

    const paddleVy = paddle.vy || 0;
    const spinMultiplier = hasFireball ? 3.0 : 1.0;
    const maxSpinLimit = hasFireball ? 7.5 : 2.5;
    const spinTransfer = Math.max(-maxSpinLimit, Math.min(maxSpinLimit, paddleVy * 0.045 * spinMultiplier));
    ball.spin = (ball.spin || 0) * 0.2 + spinTransfer;

    let speed = ball.speed || 8.5;
    if (isTurboActive) {
      speed = 20.0;
    } else if (isSuddenDeath) {
      speed = Math.min(speed * 1.08 + 0.4, 22.0);
    } else {
      speed = Math.min(speed * 1.03, 15.0);
    }

    if (hasFireball) {
      ball.type = 'fireball';
      ball.typeTimer = 8;
      speed = Math.min(speed, 15.0); // Balanced speed cap for Fireball
    } else if (hasGuided) {
      ball.type = 'guided';
      ball.typeTimer = 8;
    } else if (hasEmp) {
      ball.type = 'emp';
      ball.typeTimer = 8;
    } else {
      ball.type = 'normal';
      ball.typeTimer = 0;
    }

    ball.isTurbo = isTurboActive;

    const direction = slot === 'p1' ? 1 : -1;
    ball.vx = direction * speed * Math.cos(bounceAngle);
    ball.vy = speed * Math.sin(bounceAngle);
    ball.speed = speed;

    paddle.combo++;
    if (paddle.combo > paddle.maxCombo) paddle.maxCombo = paddle.combo;
    paddle.score += 10 * paddle.combo;

    this.game.events.push({
      type: 'paddle_hit',
      slot,
      isTurbo: isTurboActive,
      isGuided: ball.type === 'guided',
      isFireball: ball.type === 'fireball',
      x: ball.x,
      y: ball.y,
      combo: paddle.combo
    });
  }

  handleBrickDestroyed(brick, hitterSlot) {
    const paddle = this.game.paddles[hitterSlot];
    if (paddle) {
      paddle.bricksDestroyed++;
      let pts = brick.type === 'core' ? 300 : 100;
      paddle.score += pts * (1 + paddle.combo * 0.1);
    }

    if (brick.powerup) {
      const targetDir = brick.owner === 'p1' ? 1 : -1;
      this.game.powerupItems.push({
        id: `powerup_${this.nextEntityId++}`,
        type: brick.powerup,
        x: brick.x + brick.w / 2,
        y: brick.y + brick.h / 2,
        vx: targetDir * 2.2,
        vy: (Math.random() * 2 - 1) * 0.8,
        radius: 16
      });
    }
  }

  applyPowerup(slot, type) {
    const paddle = this.game.paddles[slot];
    paddle.powerupsCollected++;
    paddle.score += 100;

    switch (type) {
      case 'multiball':
        const dir = slot === 'p1' ? 1 : -1;
        this.game.balls.push({
          id: `ball_${this.nextEntityId++}`,
          x: ARENA_WIDTH / 2,
          y: ARENA_HEIGHT / 2,
          prevX: ARENA_WIDTH / 2,
          prevY: ARENA_HEIGHT / 2,
          vx: dir * 8.5,
          vy: (Math.random() * 3 - 1.5),
          speed: 8.5,
          radius: BALL_RADIUS,
          lastHitter: slot,
          type: 'normal',
          isTurbo: false,
          typeTimer: 0,
          curveDir: 0,
          curvePhase: 0
        });
        break;
      case 'emp':
        paddle.activeEffects.emp = 12;
        break;
      case 'repair': {
        const deadBricks = this.game.bricks.filter(b => b.owner === slot && !b.alive && b.type !== 'core');
        const toRevive = deadBricks.slice(0, 2);
        toRevive.forEach(b => {
          b.alive = true;
          b.hp = b.maxHp;
          this.broadcastBrickUpdate(b);
          this.game.events.push({
            type: 'brick_repaired',
            id: b.id,
            slot,
            x: b.x + b.w / 2,
            y: b.y + b.h / 2
          });
        });
        break;
      }
      case 'barrier':
        paddle.activeEffects.barrier = 12;
        break;
      case 'giant':
        paddle.activeEffects.giant = 12;
        paddle.height = 92;
        break;
      case 'fireball':
        paddle.activeEffects.fireball = 12;
        break;
      case 'guided':
        paddle.activeEffects.guided = 12;
        break;
    }
  }

  resetBall(ball, scoredOnSlot) {
    ball.x = ARENA_WIDTH / 2;
    ball.y = ARENA_HEIGHT / 2;
    ball.prevX = ARENA_WIDTH / 2;
    ball.prevY = ARENA_HEIGHT / 2;
    const dir = scoredOnSlot === 'p1' ? -1 : 1;
    ball.vx = dir * 8.5;
    ball.vy = (Math.random() * 3 - 1.5);
    ball.speed = 8.5;
    ball.lastHitter = null;
    ball.type = 'normal';
    ball.isTurbo = false;
    ball.typeTimer = 0;
    ball.curveDir = 0;
    ball.curvePhase = 0;

    this.game.paddles[scoredOnSlot].combo = 0;
  }

  checkWinCondition() {
    const p1Cores = this.game.bricks.filter(b => b.owner === 'p1' && b.type === 'core' && b.alive);
    const p2Cores = this.game.bricks.filter(b => b.owner === 'p2' && b.type === 'core' && b.alive);

    if (p1Cores.length === 0) {
      this.endGame('p2', 'Player 2 Shattered all Core Crystals!');
    } else if (p2Cores.length === 0) {
      this.endGame('p1', 'Player 1 Shattered all Core Crystals!');
    }
  }

  endGame(winnerSlot, reason) {
    this.game.state = 'ended';
    this.game.winner = winnerSlot;
    this.game.winReason = reason;

    const p1Obj = Object.values(this.players).find(p => p.slot === 'p1');
    const p2Obj = Object.values(this.players).find(p => p.slot === 'p2');
    const p1Name = p1Obj ? p1Obj.name : 'Player 1';
    const p2Name = p2Obj ? p2Obj.name : 'Player 2';

    let winnerName = 'Draw';
    if (winnerSlot === 'p1') {
      winnerName = p1Name;
      recordMatchResult(p1Name, p2Name);
    } else if (winnerSlot === 'p2') {
      winnerName = p2Name;
      recordMatchResult(p2Name, p1Name);
    }

    const updatedH2H = getH2H(p1Name, p2Name);

    const endSummary = {
      winner: winnerSlot,
      winnerName: winnerName,
      reason: reason,
      h2h: updatedH2H,
      leaderboard: getTop5Leaderboard(),
      p1: {
        name: p1Name,
        score: this.game.paddles.p1.score,
        bricksDestroyed: this.game.paddles.p1.bricksDestroyed,
        maxCombo: this.game.paddles.p1.maxCombo,
        powerupsCollected: this.game.paddles.p1.powerupsCollected
      },
      p2: {
        name: p2Name,
        score: this.game.paddles.p2.score,
        bricksDestroyed: this.game.paddles.p2.bricksDestroyed,
        maxCombo: this.game.paddles.p2.maxCombo,
        powerupsCollected: this.game.paddles.p2.powerupsCollected
      }
    };

    io.to(this.code).emit('game_over', endSummary);
    broadcastMatchmakingRadar();
  }

  voteRematch(socketId) {
    if (Object.keys(this.players).length < 2) return;

    this.rematchVotes.add(socketId);
    io.to(this.code).emit('rematch_update', {
      votes: this.rematchVotes.size,
      totalNeeded: 2
    });

    if (this.rematchVotes.size >= 2) {
      this.startCountdown();
    }
  }

  getCompactDeltaTick() {
    const aliveBricks = this.game.bricks.filter(b => b.alive).length;
    return {
      t: Math.ceil(this.game.timeRemaining),
      sd: aliveBricks < 12,
      b: this.game.balls.map(b => [
        b.id,
        Math.round(b.x),
        Math.round(b.y),
        parseFloat(b.vx.toFixed(2)),
        parseFloat(b.vy.toFixed(2)),
        b.type,
        b.lastHitter || '',
        b.isTurbo ? 1 : 0
      ]),
      p1: [
        Math.round(this.game.paddles.p1.y),
        Math.round(this.game.paddles.p1.height),
        this.game.paddles.p1.score,
        this.game.paddles.p1.combo,
        this.game.paddles.p1.activeEffects,
        Math.round(this.game.paddles.p1.charge),
        Math.ceil(this.game.paddles.p1.turboTimer)
      ],
      p2: [
        Math.round(this.game.paddles.p2.y),
        Math.round(this.game.paddles.p2.height),
        this.game.paddles.p2.score,
        this.game.paddles.p2.combo,
        this.game.paddles.p2.activeEffects,
        Math.round(this.game.paddles.p2.charge),
        Math.ceil(this.game.paddles.p2.turboTimer)
      ],
      pw: this.game.powerupItems.map(p => [
        p.id,
        p.type,
        Math.round(p.x),
        Math.round(p.y),
        parseFloat(p.vx.toFixed(1)),
        parseFloat(p.vy.toFixed(1))
      ]),
      ev: this.game.events
    };
  }
}

io.on('connection', (socket) => {
  let currentRoom = null;

  // Send initial lobby data (radar status and top 5 leaderboard)
  let waitingCount = 0;
  for (const r of rooms.values()) {
    if (r.game.state === 'waiting' && Object.keys(r.players).length === 1) waitingCount++;
  }
  socket.emit('matchmaking_status', {
    hasWaitingPlayer: waitingCount > 0,
    waitingCount: waitingCount
  });
  socket.emit('leaderboard_data', { top5: getTop5Leaderboard() });

  socket.on('get_leaderboard', () => {
    socket.emit('leaderboard_data', { top5: getTop5Leaderboard() });
  });

  socket.on('get_h2h', ({ p1, p2 }) => {
    socket.emit('h2h_data', { p1Name: p1, p2Name: p2, h2h: getH2H(p1, p2) });
  });

  socket.on('create_room', ({ playerName }) => {
    let code = generateRoomCode();
    while (rooms.has(code)) {
      code = generateRoomCode();
    }
    const room = new Room(code);
    rooms.set(code, room);
    currentRoom = room;

    const result = room.addPlayer(socket, playerName);
    socket.emit('room_joined', {
      roomCode: code,
      slot: result.slot,
      isHost: true
    });
    broadcastMatchmakingRadar();
  });

  socket.on('join_room', ({ roomCode, playerName }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('join_error', { message: 'Room not found. Check the code!' });
      return;
    }

    currentRoom = room;
    const result = room.addPlayer(socket, playerName);
    socket.emit('room_joined', {
      roomCode: code,
      slot: result.slot,
      isHost: false
    });
    broadcastMatchmakingRadar();
  });

  socket.on('quick_match', ({ playerName }) => {
    let targetRoom = null;
    for (const room of rooms.values()) {
      if (room.game.state === 'waiting' && Object.keys(room.players).length === 1) {
        targetRoom = room;
        break;
      }
    }

    if (targetRoom) {
      currentRoom = targetRoom;
      const result = targetRoom.addPlayer(socket, playerName);
      socket.emit('room_joined', {
        roomCode: targetRoom.code,
        slot: result.slot,
        isHost: false
      });
    } else {
      let code = generateRoomCode();
      const room = new Room(code);
      rooms.set(code, room);
      currentRoom = room;
      const result = room.addPlayer(socket, playerName);
      socket.emit('room_joined', {
        roomCode: code,
        slot: result.slot,
        isHost: true
      });
    }
    broadcastMatchmakingRadar();
  });

  socket.on('player_input', (input) => {
    if (currentRoom) {
      currentRoom.handlePlayerInput(socket.id, input);
    }
  });

  socket.on('rematch_vote', () => {
    if (currentRoom) {
      currentRoom.voteRematch(socket.id);
    }
  });

  socket.on('leave_room', () => {
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      if (Object.keys(currentRoom.players).length === 0 && currentRoom.spectators.size === 0) {
        currentRoom.stopLoop();
        rooms.delete(currentRoom.code);
      }
      currentRoom = null;
      broadcastMatchmakingRadar();
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      if (Object.keys(currentRoom.players).length === 0 && currentRoom.spectators.size === 0) {
        currentRoom.stopLoop();
        rooms.delete(currentRoom.code);
      }
      broadcastMatchmakingRadar();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log(`=========================================`);
  console.log(`🎮 WarrenPong Server Running!`);
  console.log(`👉 Local:   http://localhost:${PORT}`);
  console.log(`🌐 Network: http://${ip}:${PORT}`);
  console.log(`=========================================`);
});
