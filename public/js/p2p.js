/**
 * WarrenPong Native Cloudflare Edge WebSocket Engine
 * 100% Reliable, 0 External Dependencies, 0 NAT/Firewall Issues
 * Runs directly on Cloudflare Edge (wss://warrenpong.pages.dev/api/ws)
 */
class CloudflareNetworkManager {
  constructor() {
    this.ws = null;
    this.isHost = false;
    this.mySlot = 'p1';
    this.roomCode = null;
    this.myPeerId = 'p_' + Math.random().toString(36).substring(2, 9);
    this.opponentPeerId = null;
    this.playerName = 'Player';
    this.opponentName = 'Opponent';
    this.eventListeners = new Map();
    this.simulator = null;
    this.isGameRunning = false;
    this.isConnected = false;
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  emit(event, data) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(cb => {
      try { cb(data); } catch (e) { console.error('P2P event error:', e); }
    });
  }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  getWsUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:3000';
    return `${protocol}//${host}/api/ws`;
  }

  connectWs(onOpen) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (onOpen) onOpen();
      return;
    }

    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }

    try {
      this.ws = new WebSocket(this.getWsUrl());

      this.ws.onopen = () => {
        this.isConnected = true;
        if (onOpen) onOpen();
      };

      this.ws.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
      };

      this.ws.onerror = (err) => {
        console.warn('Cloudflare WS error:', err);
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      } catch (e) {}
    }
  }

  // --- 1. QUICK MATCH ---
  quickMatch(playerName) {
    this.disconnect();
    this.playerName = playerName || 'Player';
    this.isHost = true;
    this.mySlot = 'p1';

    this.connectWs(() => {
      this.send({
        type: 'quickmatch',
        peerId: this.myPeerId,
        playerName: this.playerName
      });
    });
  }

  // --- 2. CREATE ROOM ---
  createRoom(customCode, playerName) {
    this.disconnect();
    this.isHost = true;
    this.mySlot = 'p1';
    this.playerName = playerName || 'Player 1';
    this.roomCode = (customCode || this.generateCode()).toUpperCase().trim();

    this.emit('room_joined', {
      roomCode: this.roomCode,
      slot: 'p1',
      isHost: true
    });
    this.broadcastLobby();

    this.connectWs(() => {
      this.send({
        type: 'create_room',
        roomCode: this.roomCode,
        peerId: this.myPeerId,
        playerName: this.playerName
      });
    });
  }

  // --- 3. JOIN ROOM ---
  joinRoom(roomCode, playerName) {
    this.disconnect();
    this.isHost = false;
    this.mySlot = 'p2';
    this.playerName = playerName || 'Player 2';
    this.roomCode = (roomCode || '').toUpperCase().trim();

    this.emit('room_joined', {
      roomCode: this.roomCode,
      slot: 'p2',
      isHost: false
    });
    this.emit('lobby_update', {
      p1: 'Room Host',
      p2: this.playerName,
      status: `Connecting to room ${this.roomCode}...`
    });

    this.connectWs(() => {
      this.send({
        type: 'join_room',
        roomCode: this.roomCode,
        peerId: this.myPeerId,
        playerName: this.playerName
      });
    });
  }

  handleIncomingMessage(rawData) {
    try {
      const msg = JSON.parse(rawData);

      // Fast Numeric Flat Telemetry Array: [time, p1Y, p1H, p1Score, p1Combo, p1Mask, p1Turbo, p2Y, p2H, p2Score, p2Combo, p2Mask, p2Turbo, bx, by, bvx, bvy, bType, bHitter, isTurbo]
      if (Array.isArray(msg)) {
        if (this.isHost) {
          if (this.simulator && this.simulator.state) {
            const p2 = this.simulator.state.paddles.p2;
            p2.targetY = msg[0];
            if (msg[1] && p2.charge >= 100 && p2.turboTimer <= 0) {
              p2.turboTimer = 8.0;
              p2.charge = 0;
              this.simulator.renderer.addExplosion(p2.x + p2.width / 2, p2.y + p2.height / 2, 40, '#ffd700');
              this.simulator.renderer.addFloatingText('🔥 8s TURBO ACTIVE!', p2.x - 80, p2.y + p2.height / 2, '#ffd700', 20);
            }
          }
        } else {
          this.emit('flat_tick', msg);
        }
        return;
      }

      // Quickmatch waiting
      if (msg.type === 'waiting') {
        this.roomCode = msg.roomCode;
        this.emit('room_joined', {
          roomCode: this.roomCode,
          slot: 'p1',
          isHost: true
        });
        this.emit('lobby_update', {
          p1: this.playerName,
          p2: null,
          status: 'Searching for challenger...'
        });
        return;
      }

      // Quickmatch matched
      if (msg.type === 'matched') {
        this.roomCode = msg.roomCode;
        this.opponentName = msg.opponent;
        this.opponentPeerId = msg.opponentPeerId;

        if (msg.role === 'host') {
          this.isHost = true;
          this.mySlot = 'p1';
          this.emit('room_joined', { roomCode: this.roomCode, slot: 'p1', isHost: true });
          this.emit('lobby_update', { p1: this.playerName, p2: this.opponentName });
          this.startCountdown();
        } else {
          this.isHost = false;
          this.mySlot = 'p2';
          this.emit('room_joined', { roomCode: this.roomCode, slot: 'p2', isHost: false });
          this.emit('lobby_update', { p1: this.opponentName, p2: this.playerName });
        }
        return;
      }

      // Join room player arrived
      if (msg.type === 'player_joined') {
        if (this.isHost) {
          this.opponentName = msg.playerName;
          this.opponentPeerId = msg.peerId;
          this.broadcastLobby();
          this.send({
            type: 'host_ack',
            hostName: this.playerName
          });
          this.startCountdown();
        }
        return;
      }

      // Joiner received host ack
      if (msg.type === 'host_ack') {
        if (!this.isHost) {
          this.opponentName = msg.hostName;
          this.emit('lobby_update', { p1: this.opponentName, p2: this.playerName });
        }
        return;
      }

      // Game state messages
      if (msg.t === 'count') {
        this.emit('game_countdown', { count: msg.c });
      } else if (msg.t === 'start') {
        this.emit('game_start', msg);
      } else if (msg.t === 'over') {
        this.emit('game_over', msg.s);
      } else if (msg.t === 'rematch') {
        if (this.isHost) this.startCountdown();
      } else if (msg.type === 'opponent_left') {
        this.handleOpponentDisconnect();
      }
    } catch (e) {}
  }

  startCountdown() {
    let count = 3;
    this.emit('game_countdown', { count });
    this.send({ t: 'count', c: count });

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        this.emit('game_countdown', { count });
        this.send({ t: 'count', c: count });
      } else {
        clearInterval(timer);
        this.startMatch();
      }
    }, 1000);
  }

  startMatch() {
    if (!this.simulator) {
      this.simulator = new window.LocalGameSimulator(
        null,
        window.soundManager,
        (summary) => {
          this.isGameRunning = false;
          this.emit('game_over', summary);
          this.send({ t: 'over', s: summary });
        },
        null
      );
    }

    this.simulator.p1Name = this.playerName;
    this.simulator.p2Name = this.opponentName;
    this.simulator.isMultiplayer = true;
    this.simulator.initGame();
    this.isGameRunning = true;

    const startPayload = {
      players: { p1: { name: this.playerName }, p2: { name: this.opponentName } },
      bricks: this.simulator.state.bricks
    };

    this.emit('game_start', startPayload);
    this.send({ t: 'start', players: startPayload.players, bricks: startPayload.bricks });
  }

  broadcastFlatTick(state) {
    if (!this.isHost || !state) return;

    const b = state.balls[0] || {};
    const p1 = state.paddles.p1;
    const p2 = state.paddles.p2;

    let p1Mask = 0;
    if (p1.activeEffects.giant > 0) p1Mask |= 1;
    if (p1.activeEffects.fireball > 0) p1Mask |= 2;
    if (p1.activeEffects.guided > 0) p1Mask |= 4;

    let p2Mask = 0;
    if (p2.activeEffects.giant > 0) p2Mask |= 1;
    if (p2.activeEffects.fireball > 0) p2Mask |= 2;
    if (p2.activeEffects.guided > 0) p2Mask |= 4;

    const bTypeCode = b.type === 'fireball' ? 1 : (b.type === 'guided' ? 2 : 0);
    const bHitterCode = b.lastHitter === 'p1' ? 1 : (b.lastHitter === 'p2' ? 2 : 0);

    const flat = [
      Math.ceil(state.timeRemaining),
      Math.round(p1.y),
      Math.round(p1.height),
      p1.score,
      p1.combo,
      p1Mask,
      Math.ceil(p1.turboTimer || 0),
      Math.round(p2.y),
      Math.round(p2.height),
      p2.score,
      p2.combo,
      p2Mask,
      Math.ceil(p2.turboTimer || 0),
      Math.round(b.x || 600),
      Math.round(b.y || 350),
      parseFloat((b.vx || 8.5).toFixed(2)),
      parseFloat((b.vy || 0).toFixed(2)),
      bTypeCode,
      bHitterCode,
      b.isTurbo ? 1 : 0
    ];

    this.send(flat);
  }

  handlePlayerInput(input) {
    if (this.isHost) {
      if (this.simulator) {
        this.simulator.handlePlayerInput(input);
      }
    } else {
      this.send([Math.round(input.targetY || 320), input.turbo ? 1 : 0]);
    }
  }

  voteRematch() {
    if (this.isHost) {
      this.startCountdown();
    } else {
      this.send({ t: 'rematch' });
    }
  }

  broadcastLobby() {
    const payload = {
      t: 'lobby',
      p1: this.playerName,
      p2: this.isConnected ? this.opponentName : null
    };
    this.emit('lobby_update', payload);
    this.send(payload);
  }

  handleOpponentDisconnect() {
    this.isGameRunning = false;
    if (this.simulator) {
      this.simulator.stop();
      this.simulator = null;
    }
    this.emit('opponent_left', { message: `${this.opponentName || 'Opponent'} left the room.` });
    this.broadcastLobby();
  }

  disconnect() {
    this.isGameRunning = false;
    if (this.simulator) {
      this.simulator.stop();
      this.simulator = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
  }
}

window.P2PNetworkManager = CloudflareNetworkManager;
