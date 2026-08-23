/**
 * WarrenPong High-Speed Socket.io Network Engine
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
    this.connectionListeners = [];

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
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 20000
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.emit('server_connected', { socketId: this.socket.id });
        console.log('✅ Connected to backend server! Socket ID:', this.socket.id);
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
        const pList = Object.values(players || {});
        const p1 = pList.find(p => p.slot === 'p1');
        const p2 = pList.find(p => p.slot === 'p2');
        this.emit('lobby_update', {
          roomCode,
          p1: p1 ? p1.name : null,
          p2: p2 ? p2.name : null,
          players: pList
        });
      });

      this.socket.on('game_countdown', ({ count }) => {
        this.emit('game_countdown', { count });
      });

      this.socket.on('game_start', ({ players, bricks }) => {
        this.emit('game_start', { players, bricks });
      });

      this.socket.on('game_tick', (delta) => {
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
        this.emit('server_disconnected', {});
      });
    }
  }

  // --- 1. QUICK MATCH ---
  quickMatch(playerName) {
    this.playerName = playerName || 'Player';
    if (!this.socket || !this.socket.connected) {
      this.initSocket();
    }
    const send = () => {
      this.socket.emit('quick_match', { playerName: this.playerName });
    };
    if (this.socket && this.socket.connected) {
      send();
    } else if (this.socket) {
      this.socket.once('connect', send);
    }
  }

  // --- 2. CREATE ROOM ---
  createRoom(customCode, playerName) {
    this.playerName = playerName || 'Player 1';
    if (!this.socket || !this.socket.connected) {
      this.initSocket();
    }
    const send = () => {
      this.socket.emit('create_room', {
        playerName: this.playerName,
        customCode: customCode || null
      });
    };
    if (this.socket && this.socket.connected) {
      send();
    } else if (this.socket) {
      this.socket.once('connect', send);
    }
  }

  // --- 3. JOIN ROOM ---
  joinRoom(roomCode, playerName) {
    this.playerName = playerName || 'Player 2';
    if (!this.socket || !this.socket.connected) {
      this.initSocket();
    }
    const send = () => {
      this.socket.emit('join_room', {
        roomCode: roomCode.toUpperCase().trim(),
        playerName: this.playerName
      });
    };
    if (this.socket && this.socket.connected) {
      send();
    } else if (this.socket) {
      this.socket.once('connect', send);
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
