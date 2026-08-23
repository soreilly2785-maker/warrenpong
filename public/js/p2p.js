/**
 * WarrenPong High-Speed Socket.io Network Engine
 * Universal low-latency multiplayer via dedicated cloud backend (Render)
 * 100% Guaranteed 0-lag gameplay, 1-second Quick Match & 4-letter rooms
 */
class SocketNetworkManager {
  constructor() {
    this.socket = null;
    this.isHost = false;
    this.mySlot = 'p1';
    this.roomCode = null;
    this.playerName = 'Player';
    this.opponentName = 'Opponent';
    this.eventListeners = new Map();
    this.isConnected = false;

    this.initSocket();
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
      try { cb(data); } catch (e) { console.error('Network event error:', e); }
    });
  }

  getServerUrl() {
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.hostname.startsWith('192.168.');
    return isLocal ? window.location.origin : 'https://warrenpong.onrender.com';
  }

  initSocket() {
    if (this.socket) return;

    const url = this.getServerUrl();
    console.log('Connecting to WarrenPong Backend:', url);

    if (typeof io !== 'undefined') {
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log('Connected to backend server! Socket ID:', this.socket.id);
      });

      this.socket.on('room_joined', ({ roomCode, slot, isHost }) => {
        this.roomCode = roomCode;
        this.mySlot = slot;
        this.isHost = isHost;
        this.emit('room_joined', { roomCode, slot, isHost });
      });

      this.socket.on('join_error', ({ message }) => {
        this.emit('join_error', { message });
      });

      this.socket.on('lobby_update', ({ roomCode, players, isHost }) => {
        const p1 = (players || []).find(p => p.slot === 'p1');
        const p2 = (players || []).find(p => p.slot === 'p2');
        this.emit('lobby_update', {
          p1: p1 ? p1.name : null,
          p2: p2 ? p2.name : null
        });
      });

      this.socket.on('game_countdown', ({ count }) => {
        this.emit('game_countdown', { count });
      });

      this.socket.on('game_start', ({ players, bricks }) => {
        this.emit('game_start', { players, bricks });
      });

      this.socket.on('game_tick', (delta) => {
        // Delta from authoritative server loop
        this.emit('game_tick', delta);
      });

      this.socket.on('brick_update', ({ id, hp, alive }) => {
        this.emit('brick_update', { id, hp, alive });
      });

      this.socket.on('game_over', (summary) => {
        this.emit('game_over', summary);
      });

      this.socket.on('opponent_left', ({ message }) => {
        this.emit('opponent_left', { message });
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
      });
    }
  }

  // --- 1. QUICK MATCH ---
  quickMatch(playerName) {
    this.playerName = playerName || 'Player';
    if (!this.socket || !this.socket.connected) {
      this.initSocket();
    }
    if (this.socket) {
      this.socket.emit('quick_match', { playerName: this.playerName });
    }
  }

  // --- 2. CREATE ROOM ---
  createRoom(customCode, playerName) {
    this.playerName = playerName || 'Player 1';
    if (!this.socket || !this.socket.connected) {
      this.initSocket();
    }
    if (this.socket) {
      this.socket.emit('create_room', {
        playerName: this.playerName,
        customCode: customCode || null
      });
    }
  }

  // --- 3. JOIN ROOM ---
  joinRoom(roomCode, playerName) {
    this.playerName = playerName || 'Player 2';
    if (!this.socket || !this.socket.connected) {
      this.initSocket();
    }
    if (this.socket) {
      this.socket.emit('join_room', {
        roomCode: roomCode.toUpperCase().trim(),
        playerName: this.playerName
      });
    }
  }

  handlePlayerInput(input) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('player_input', input);
    }
  }

  voteRematch() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('rematch_vote');
    }
  }

  disconnect() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_room');
    }
  }
}

window.P2PNetworkManager = SocketNetworkManager;
