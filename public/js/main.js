document.addEventListener('DOMContentLoaded', () => {
  // Global Error Trap
  window.addEventListener('error', (e) => {
    console.error('Runtime error:', e.message);
  });

  // DOM Elements
  const screenLobby = document.getElementById('screen-lobby');
  const screenRoom = document.getElementById('screen-room');
  const screenGame = document.getElementById('screen-game');

  // Modals
  const modalJoin = document.getElementById('modal-join');
  const modalLan = document.getElementById('modal-lan');
  const modalExit = document.getElementById('modal-exit');
  const modalGameOver = document.getElementById('modal-gameover');

  // Inputs & Buttons
  const inputPlayerName = document.getElementById('input-player-name');
  const btnRandomName = document.getElementById('btn-random-name');
  const btnQuickPlay = document.getElementById('btn-quick-play');
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnJoinModal = document.getElementById('btn-join-modal');
  const btnSoloAI = document.getElementById('btn-solo-ai');
  const btnConfirmJoin = document.getElementById('btn-confirm-join');
  const inputJoinCode = document.getElementById('input-join-code');
  const joinErrorMsg = document.getElementById('join-error-msg');
  const btnCloseJoin = document.getElementById('btn-close-join');

  // Header & Controls
  const btnFlipView = document.getElementById('btn-flip-view');
  const flipLabel = document.getElementById('flip-label');
  const btnLanInfo = document.getElementById('btn-lan-info');
  const btnCloseLan = document.getElementById('btn-close-lan');
  const btnDoneLan = document.getElementById('btn-done-lan');
  const lanQrCanvas = document.getElementById('lan-qr-canvas');
  const lanUrlText = document.getElementById('lan-url-text');
  const btnCopyLanUrl = document.getElementById('btn-copy-lan-url');
  const btnSound = document.getElementById('btn-sound');
  const soundIcon = document.getElementById('sound-icon');
  const btnFullscreen = document.getElementById('btn-fullscreen');

  // In-Game Exit & Turbo
  const btnTurbo = document.getElementById('btn-turbo');
  const btnTouchpadTurbo = document.getElementById('btn-touchpad-turbo');
  const btnInGameExit = document.getElementById('btn-in-game-exit');
  const btnConfirmExit = document.getElementById('btn-confirm-exit');
  const btnCancelExit = document.getElementById('btn-cancel-exit');
  const btnCloseExit = document.getElementById('btn-close-exit');

  // Room UI
  const displayRoomCode = document.getElementById('display-room-code');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const p1SlotName = document.getElementById('p1-slot-name');
  const p1SlotStatus = document.getElementById('p1-slot-status');
  const p2SlotName = document.getElementById('p2-slot-name');
  const p2SlotStatus = document.getElementById('p2-slot-status');
  const roomStatusText = document.getElementById('room-status-text');
  const btnShowRoomQr = document.getElementById('btn-show-room-qr');
  const btnLeaveRoom = document.getElementById('btn-leave-room');

  // Game HUD
  const hudP1Name = document.getElementById('hud-p1-name');
  const hudP1Cores = document.getElementById('hud-p1-cores');
  const hudP1Score = document.getElementById('hud-p1-score');
  const hudP1Combo = document.getElementById('hud-p1-combo');
  const hudP2Name = document.getElementById('hud-p2-name');
  const hudP2Cores = document.getElementById('hud-p2-cores');
  const hudP2Score = document.getElementById('hud-p2-score');
  const hudP2Combo = document.getElementById('hud-p2-combo');
  const hudTimer = document.getElementById('hud-timer');
  const countdownOverlay = document.getElementById('countdown-overlay');
  const countdownNumber = document.getElementById('countdown-number');
  const canvas = document.getElementById('game-canvas');

  // Game Over UI
  const winnerTitle = document.getElementById('winner-title');
  const winnerSubtitle = document.getElementById('winner-subtitle');
  const endgameP1Name = document.getElementById('endgame-p1-name');
  const endgameP1Score = document.getElementById('endgame-p1-score');
  const endgameP1Cores = document.getElementById('endgame-p1-cores');
  const endgameP1Combo = document.getElementById('endgame-p1-combo');
  const endgameP2Name = document.getElementById('endgame-p2-name');
  const endgameP2Score = document.getElementById('endgame-p2-score');
  const endgameP2Cores = document.getElementById('endgame-p2-cores');
  const endgameP2Combo = document.getElementById('endgame-p2-combo');
  const btnRematch = document.getElementById('btn-rematch');
  const rematchBtnText = document.getElementById('rematch-btn-text');
  const btnReturnLobby = document.getElementById('btn-return-lobby');

  // App State
  let socket = null;
  let currentRoomCode = null;
  let mySlot = 'p1';
  let isSoloMode = false;
  let soloSimulator = null;
  let isGameLoopRunning = false;
  let clientBricks = [];
  let playerNames = { p1: 'Player 1', p2: 'Player 2' };
  let localPredictedY = 320;
  let lastHudUpdateTime = 0;

  // Active state container for rendering
  const activeGameState = {
    state: 'playing',
    timeRemaining: 180,
    isSuddenDeath: false,
    balls: [{ id: 'b0', x: 600, y: 350, vx: 8.5, vy: 0, radius: 10, type: 'normal', lastHitter: null, isTurbo: false }],
    paddles: {
      p1: { x: 180, y: 320, width: 16, height: 58, score: 0, combo: 0, activeEffects: {}, charge: 0, turboTimer: 0 },
      p2: { x: 1004, y: 320, width: 16, height: 58, score: 0, combo: 0, activeEffects: {}, charge: 0, turboTimer: 0 }
    },
    bricks: [],
    powerupItems: []
  };

  // Responsive & Controls Setup
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isPortrait = window.innerHeight > window.innerWidth;
  let currentViewMode = isTouchDevice && isPortrait ? 'bottom' : 'landscape';

  const renderer = new window.GameRenderer(canvas);
  const sound = window.soundManager;

  const controls = new window.ControlsManager(canvas, (input) => {
    localPredictedY = input.targetY;
    if (isSoloMode && soloSimulator) {
      soloSimulator.handlePlayerInput(input);
    } else if (socket && socket.connected && currentRoomCode) {
      socket.emit('player_input', input);
    }
  });

  if (btnTurbo) {
    btnTurbo.addEventListener('click', (e) => {
      controls.triggerTurbo();
      e.preventDefault();
    });
  }

  function applyViewMode(mode) {
    currentViewMode = mode;
    renderer.setViewMode(mode);
    controls.setViewMode(mode);

    if (flipLabel) {
      if (mode === 'bottom') flipLabel.textContent = 'Bottom View';
      else if (mode === 'top') flipLabel.textContent = 'Top View';
      else flipLabel.textContent = 'Landscape';
    }
    if (btnFlipView) {
      if (mode !== 'landscape') btnFlipView.classList.add('active-toggle');
      else btnFlipView.classList.remove('active-toggle');
    }
  }

  applyViewMode(currentViewMode);

  window.addEventListener('resize', () => {
    if (isTouchDevice) {
      const nowPortrait = window.innerHeight > window.innerWidth;
      if (nowPortrait && currentViewMode === 'landscape') {
        applyViewMode('bottom');
      } else if (!nowPortrait && currentViewMode !== 'landscape') {
        applyViewMode('landscape');
      }
    }
  });

  // Cyber Names Generator
  const CYBER_NAMES = [
    'NeonStriker', 'CyberAce', 'VoltRunner', 'NovaFlash', 'ApexPulse',
    'QuantumRider', 'Viper-9', 'LaserByte', 'ShadowCore', 'AeroDrift',
    'HyperClash', 'TitanShield', 'EchoBlaster', 'ZeroGravity', 'PulseWave'
  ];

  function getRandomName() {
    return CYBER_NAMES[Math.floor(Math.random() * CYBER_NAMES.length)];
  }

  const savedName = localStorage.getItem('brick_clash_name');
  if (savedName) {
    inputPlayerName.value = savedName;
  } else {
    inputPlayerName.value = getRandomName();
  }

  inputPlayerName.addEventListener('change', () => {
    localStorage.setItem('brick_clash_name', inputPlayerName.value.trim());
  });

  function getPlayerName() {
    return inputPlayerName.value.trim() || 'Player';
  }

  function showScreen(screen) {
    [screenLobby, screenRoom, screenGame].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
    modalGameOver.classList.add('hidden');
    modalJoin.classList.add('hidden');
    modalExit.classList.add('hidden');

    if (screen === screenGame) {
      renderer.resize();
      setTimeout(() => renderer.resize(), 50);
      setTimeout(() => renderer.resize(), 200);
    }
  }

  function showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function unlockAudio() {
    if (sound) {
      sound.init();
      sound.resume();
    }
  }
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });

  // --- CONNECT TO DEDICATED BACKEND (RENDER / LOCAL) ---
  function getServerUrl() {
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.hostname.startsWith('192.168.');
    return isLocal ? window.location.origin : 'https://warrenpong.onrender.com';
  }

  function initSocket() {
    if (socket) return;
    if (typeof io === 'undefined') {
      setTimeout(initSocket, 300);
      return;
    }

    const serverUrl = getServerUrl();
    console.log('Connecting to WarrenPong Backend:', serverUrl);

    try {
      socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 20000
      });

      socket.on('connect', () => {
        console.log('✅ Connected to backend! Socket ID:', socket.id);
      });

      socket.on('room_joined', ({ roomCode, slot, isHost }) => {
        currentRoomCode = roomCode;
        mySlot = slot;
        controls.setPlayerSlot(slot);
        isSoloMode = false;

        displayRoomCode.textContent = roomCode;
        showScreen(screenRoom);
        showToast(`Connected to Room ${roomCode}`);
        renderLiveQR(roomCode);
      });

      socket.on('join_error', ({ message }) => {
        joinErrorMsg.textContent = message;
        joinErrorMsg.classList.remove('hidden');
        showToast(message);
      });

      socket.on('lobby_update', ({ roomCode, players, isHost }) => {
        const pList = Object.values(players || {});
        const p1 = pList.find(p => p.slot === 'p1');
        const p2 = pList.find(p => p.slot === 'p2');

        if (p1) {
          playerNames.p1 = p1.name;
          p1SlotName.textContent = p1.name;
          p1SlotStatus.textContent = 'READY (HOST)';
          p1SlotStatus.className = 'slot-status ready';
        } else {
          p1SlotName.textContent = 'Waiting...';
          p1SlotStatus.textContent = 'WAITING';
          p1SlotStatus.className = 'slot-status waiting';
        }

        if (p2) {
          playerNames.p2 = p2.name;
          p2SlotName.textContent = p2.name;
          p2SlotStatus.textContent = 'READY';
          p2SlotStatus.className = 'slot-status ready';
          roomStatusText.textContent = 'Challenger connected! Match starting...';
        } else {
          p2SlotName.textContent = 'Searching for challenger...';
          p2SlotStatus.textContent = 'WAITING';
          p2SlotStatus.className = 'slot-status waiting';
          roomStatusText.textContent = 'Share room code or scan QR code to invite a friend!';
        }
      });

      socket.on('game_countdown', ({ count }) => {
        showScreen(screenGame);
        countdownOverlay.classList.remove('hidden');
        countdownNumber.textContent = count > 0 ? count : 'CLASH!';
        sound.playCountdown(count);
      });

      socket.on('game_start', ({ players, bricks }) => {
        countdownOverlay.classList.add('hidden');
        if (players) {
          const pList = Object.values(players);
          const p1 = pList.find(p => p.slot === 'p1');
          const p2 = pList.find(p => p.slot === 'p2');
          if (p1) playerNames.p1 = p1.name;
          if (p2) playerNames.p2 = p2.name;
        }
        if (bricks) {
          clientBricks = bricks;
          activeGameState.bricks = bricks;
        }
        startCentralRenderLoop();
      });

      socket.on('brick_update', ({ id, hp, alive }) => {
        const b = clientBricks.find(brick => brick.id === id);
        if (b) {
          b.hp = hp;
          b.alive = alive;
        }
      });

      socket.on('game_tick', (delta) => {
        if (!isGameLoopRunning && !isSoloMode) {
          startCentralRenderLoop();
        }

        activeGameState.timeRemaining = delta.t;
        activeGameState.isSuddenDeath = delta.sd;

        // Paddle 1
        if (delta.p1) {
          activeGameState.paddles.p1.y = (mySlot === 'p1') ? localPredictedY : delta.p1[0];
          activeGameState.paddles.p1.height = delta.p1[1];
          activeGameState.paddles.p1.score = delta.p1[2];
          activeGameState.paddles.p1.combo = delta.p1[3];
          activeGameState.paddles.p1.activeEffects = delta.p1[4] || {};
          activeGameState.paddles.p1.charge = delta.p1[5] !== undefined ? delta.p1[5] : 0;
          activeGameState.paddles.p1.turboTimer = delta.p1[6] !== undefined ? delta.p1[6] : 0;
        }

        // Paddle 2
        if (delta.p2) {
          activeGameState.paddles.p2.y = (mySlot === 'p2') ? localPredictedY : delta.p2[0];
          activeGameState.paddles.p2.height = delta.p2[1];
          activeGameState.paddles.p2.score = delta.p2[2];
          activeGameState.paddles.p2.combo = delta.p2[3];
          activeGameState.paddles.p2.activeEffects = delta.p2[4] || {};
          activeGameState.paddles.p2.charge = delta.p2[5] !== undefined ? delta.p2[5] : 0;
          activeGameState.paddles.p2.turboTimer = delta.p2[6] !== undefined ? delta.p2[6] : 0;
        }

        // Balls
        activeGameState.balls = (delta.b || []).map(b => ({
          id: b[0],
          x: b[1],
          y: b[2],
          vx: b[3],
          vy: b[4],
          radius: 10,
          type: b[5],
          lastHitter: b[6],
          isTurbo: b[7] === 1
        }));

        // Powerups
        activeGameState.powerupItems = (delta.pw || []).map(pw => ({
          id: pw[0],
          type: pw[1],
          x: pw[2],
          y: pw[3],
          vx: pw[4],
          vy: pw[5],
          radius: 16
        }));

        processGameEvents(delta.ev || []);
      });

      socket.on('game_over', (summary) => {
        stopCentralRenderLoop();
        showGameOverModal(summary);
      });

      socket.on('opponent_left', ({ message }) => {
        showToast(message || 'Opponent left the match.');
        rematchBtnText.textContent = 'Opponent Left Room';
      });
    } catch (e) {
      console.error('Socket init error:', e);
    }
  }

  initSocket();

  // Central 60-120 FPS Render Loop
  function startCentralRenderLoop() {
    if (isGameLoopRunning) return;
    isGameLoopRunning = true;

    let lastFrameTime = performance.now();

    const loop = (now) => {
      if (!isGameLoopRunning) return;
      const dt = Math.min((now - lastFrameTime) / 1000, 0.033);
      lastFrameTime = now;

      if (!isSoloMode && activeGameState) {
        if (activeGameState.balls) {
          activeGameState.balls.forEach(b => {
            b.x += (b.vx || 0) * (dt * 45);
            b.y += (b.vy || 0) * (dt * 45);
          });
        }

        if (activeGameState.paddles && activeGameState.paddles[mySlot]) {
          activeGameState.paddles[mySlot].y = localPredictedY;
        }

        if (now - lastHudUpdateTime >= 250) {
          lastHudUpdateTime = now;
          updateHUD(activeGameState);
        }

        renderer.render(activeGameState, mySlot, playerNames);
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  function stopCentralRenderLoop() {
    isGameLoopRunning = false;
  }

  // Generate Live QR Code
  function renderLiveQR(roomCode) {
    if (!lanQrCanvas) return;
    lanQrCanvas.innerHTML = '';

    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = roomCode ? `${baseUrl}#room=${roomCode}` : baseUrl;

    if (lanUrlText) {
      lanUrlText.textContent = shareUrl;
    }

    if (window.QRCode) {
      try {
        new QRCode(lanQrCanvas, {
          text: shareUrl,
          width: 180,
          height: 180,
          colorDark: '#00f0ff',
          colorLight: '#0a0d1a',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (e) {}
    }
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function updateHUD(state) {
    if (!state || !state.paddles) return;

    hudP1Name.textContent = playerNames.p1 || 'Player 1';
    hudP2Name.textContent = playerNames.p2 || 'Player 2';

    if (state.bricks) {
      const p1Cores = state.bricks.filter(b => b.owner === 'p1' && b.type === 'core' && b.alive).length;
      const p2Cores = state.bricks.filter(b => b.owner === 'p2' && b.type === 'core' && b.alive).length;
      hudP1Cores.textContent = `⚡ ${p1Cores}/6`;
      hudP2Cores.textContent = `⚡ ${p2Cores}/6`;
    }

    if (state.paddles.p1) {
      hudP1Score.textContent = `${state.paddles.p1.score || 0} pts`;
      hudP1Combo.textContent = (state.paddles.p1.combo > 1) ? `x${state.paddles.p1.combo} COMBO` : '';
    }
    if (state.paddles.p2) {
      hudP2Score.textContent = `${state.paddles.p2.score || 0} pts`;
      hudP2Combo.textContent = (state.paddles.p2.combo > 1) ? `x${state.paddles.p2.combo} COMBO` : '';
    }

    hudTimer.textContent = formatTime(state.timeRemaining);

    const myPaddle = state.paddles[mySlot] || state.paddles.p1;
    const turboSec = (myPaddle && myPaddle.turboTimer) || 0;
    const charge = (myPaddle && myPaddle.charge) || 0;

    const turboText = turboSec > 0 ? `🔥 TURBO: ${Math.ceil(turboSec)}s` :
                      (charge >= 100 ? '⚡ TURBO READY! (TAP)' : `⚡ TURBO ${Math.round(charge)}%`);
    const turboClass = turboSec > 0 ? 'turbo-badge active' : (charge >= 100 ? 'turbo-badge ready' : 'turbo-badge');

    if (btnTurbo) {
      btnTurbo.textContent = turboText;
      btnTurbo.className = turboClass;
    }
    if (btnTouchpadTurbo) {
      btnTouchpadTurbo.textContent = turboSec > 0 ? `🔥 ${Math.ceil(turboSec)}s` : (charge >= 100 ? '⚡ TURBO' : `${Math.round(charge)}%`);
      if (turboSec > 0) btnTouchpadTurbo.classList.add('active');
      else btnTouchpadTurbo.classList.remove('active');
    }
  }

  function processGameEvents(events) {
    if (!events || !events.length) return;
    events.forEach(ev => {
      if (ev.type === 'turbo_activate') {
        sound.playPowerupCollect();
        renderer.addExplosion(ev.x, ev.y, 40, '#ffd700');
        renderer.addFloatingText('🔥 8s TURBO ACTIVE!', ev.x + (ev.slot === 'p1' ? 80 : -80), ev.y, '#ffd700', 20);
      } else if (ev.type === 'airdrop_spawn') {
        renderer.addFloatingText('🎁 AIRDROP!', ev.x, ev.y, '#ffd700', 16);
      } else if (ev.type === 'paddle_hit') {
        sound.playPaddleHit(ev.isTurbo, ev.combo);
        if (ev.isTurbo) {
          renderer.addExplosion(ev.x, ev.y, 40, '#ffd700');
        } else {
          renderer.addSparkles(ev.x, ev.y, ev.slot === 'p1' ? '#00f0ff' : '#ff0077', 8);
        }
      } else if (ev.type === 'wall_bounce') {
        sound.playWallBounce();
        renderer.addSparkles(ev.x, ev.y, '#00f0ff', 5);
      } else if (ev.type === 'brick_hit') {
        sound.playBrickHit(ev.destroyed, false);
        renderer.addSparkles(ev.x, ev.y, '#00f0ff', ev.destroyed ? 10 : 5);
      } else if (ev.type === 'powerup_collect') {
        sound.playPowerupCollect();
        let name = (ev.powerup || '').toUpperCase();
        if (ev.powerup === 'giant') name = 'PADDLE EXTEND';
        else if (ev.powerup === 'guided') name = 'GUIDED STEERING';
        renderer.addFloatingText(`+${name}!`, ev.x, ev.y, '#ffd700', 18);
      } else if (ev.type === 'goal_score') {
        sound.playGoalScore();
        const color = ev.scorer === 'p1' ? '#00f0ff' : '#ff0077';
        renderer.addExplosion(ev.x, ev.y, 60, color);
        renderer.addFloatingText('GOAL! +250', 600, 350, color, 26);
      }
    });
  }

  function showGameOverModal(summary) {
    modalGameOver.classList.remove('hidden');

    const isWinner = (mySlot && summary.winner === mySlot) || (isSoloMode && summary.winner === 'p1');
    const isDraw = summary.winner === 'draw';

    if (isDraw) {
      winnerTitle.textContent = 'DRAW!';
      winnerSubtitle.textContent = summary.reason || 'Time expired with equal points!';
    } else if (isWinner) {
      winnerTitle.textContent = '🏆 VICTORY! 🏆';
      winnerSubtitle.textContent = `${summary.winnerName} WINS! (${summary.reason})`;
      sound.playVictory();
    } else {
      winnerTitle.textContent = 'DEFEAT';
      winnerSubtitle.textContent = `${summary.winnerName} WINS! (${summary.reason})`;
      sound.playDefeat();
    }

    if (summary.p1) {
      endgameP1Name.textContent = summary.p1.name;
      endgameP1Score.textContent = `${summary.p1.score} pts`;
      endgameP1Cores.textContent = `Bricks: ${summary.p1.bricksDestroyed}`;
      endgameP1Combo.textContent = `x${summary.p1.maxCombo}`;
    }
    if (summary.p2) {
      endgameP2Name.textContent = summary.p2.name;
      endgameP2Score.textContent = `${summary.p2.score} pts`;
      endgameP2Cores.textContent = `Bricks: ${summary.p2.bricksDestroyed}`;
      endgameP2Combo.textContent = `x${summary.p2.maxCombo}`;
    }

    rematchBtnText.textContent = 'VOTE REMATCH';
  }

  // --- BUTTON CLICKS (COMPATIBLE ACROSS ALL BROWSERS) ---

  btnRandomName.addEventListener('click', () => {
    const newName = getRandomName();
    inputPlayerName.value = newName;
    localStorage.setItem('brick_clash_name', newName);
  });

  btnQuickPlay.addEventListener('click', () => {
    unlockAudio();
    showToast('Searching for online challenger...');
    p1SlotName.textContent = getPlayerName();
    p1SlotStatus.textContent = 'READY';
    p1SlotStatus.className = 'slot-status ready';
    p2SlotName.textContent = 'Searching for challenger...';
    p2SlotStatus.textContent = 'WAITING';
    p2SlotStatus.className = 'slot-status waiting';
    displayRoomCode.textContent = '----';
    roomStatusText.textContent = '⚡ Searching for online match...';
    showScreen(screenRoom);

    const send = () => {
      if (socket && socket.connected) {
        socket.emit('quick_match', { playerName: getPlayerName() });
      } else if (socket) {
        socket.once('connect', () => {
          socket.emit('quick_match', { playerName: getPlayerName() });
        });
      }
    };
    send();
  });

  btnCreateRoom.addEventListener('click', () => {
    unlockAudio();
    showToast('Creating private room...');
    p1SlotName.textContent = getPlayerName();
    p1SlotStatus.textContent = 'READY (HOST)';
    p1SlotStatus.className = 'slot-status ready';
    p2SlotName.textContent = 'Waiting for friend...';
    p2SlotStatus.textContent = 'WAITING';
    p2SlotStatus.className = 'slot-status waiting';
    displayRoomCode.textContent = '----';
    roomStatusText.textContent = 'Creating private room...';
    showScreen(screenRoom);

    const send = () => {
      if (socket && socket.connected) {
        socket.emit('create_room', { playerName: getPlayerName(), customCode: null });
      } else if (socket) {
        socket.once('connect', () => {
          socket.emit('create_room', { playerName: getPlayerName(), customCode: null });
        });
      }
    };
    send();
  });

  btnJoinModal.addEventListener('click', () => {
    modalJoin.classList.remove('hidden');
    inputJoinCode.value = '';
    joinErrorMsg.classList.add('hidden');
    inputJoinCode.focus();
  });

  btnCloseJoin.addEventListener('click', () => {
    modalJoin.classList.add('hidden');
  });

  btnConfirmJoin.addEventListener('click', () => {
    const code = inputJoinCode.value.toUpperCase().trim();
    if (code.length < 3) {
      joinErrorMsg.textContent = 'Please enter a valid room code';
      joinErrorMsg.classList.remove('hidden');
      return;
    }
    unlockAudio();
    modalJoin.classList.add('hidden');
    p1SlotName.textContent = 'Room Host';
    p1SlotStatus.textContent = 'READY';
    p1SlotStatus.className = 'slot-status ready';
    p2SlotName.textContent = getPlayerName();
    p2SlotStatus.textContent = 'JOINING';
    p2SlotStatus.className = 'slot-status waiting';
    displayRoomCode.textContent = code;
    roomStatusText.textContent = `Connecting to room ${code}...`;
    showScreen(screenRoom);

    const send = () => {
      if (socket && socket.connected) {
        socket.emit('join_room', { roomCode: code, playerName: getPlayerName() });
      } else if (socket) {
        socket.once('connect', () => {
          socket.emit('join_room', { roomCode: code, playerName: getPlayerName() });
        });
      }
    };
    send();
  });

  inputJoinCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnConfirmJoin.click();
    }
  });

  // Solo AI Game
  btnSoloAI.addEventListener('click', () => {
    unlockAudio();
    isSoloMode = true;
    mySlot = 'p1';
    controls.setPlayerSlot('p1');
    playerNames.p1 = getPlayerName();
    playerNames.p2 = 'Cyber Bot (AI)';

    if (!soloSimulator) {
      soloSimulator = new window.LocalGameSimulator(
        renderer,
        sound,
        (summary) => {
          showGameOverModal(summary);
        },
        (state) => {
          updateHUD(state);
        }
      );
    }

    showScreen(screenGame);
    countdownOverlay.classList.remove('hidden');
    countdownNumber.textContent = '3';
    sound.playCountdown(3);

    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNumber.textContent = count;
        sound.playCountdown(count);
      } else {
        clearInterval(interval);
        countdownOverlay.classList.add('hidden');
        soloSimulator.start(getPlayerName());
      }
    }, 1000);
  });

  // Header buttons
  if (btnFlipView) {
    btnFlipView.addEventListener('click', () => {
      if (currentViewMode === 'bottom') applyViewMode('landscape');
      else if (currentViewMode === 'landscape') applyViewMode('top');
      else applyViewMode('bottom');

      const desc = currentViewMode === 'bottom' ? 'Bottom View (Player at Bottom - Control Zone Below)' :
                   (currentViewMode === 'top' ? 'Top View' : 'Landscape Mode');
      showToast(desc);
    });
  }

  btnSound.addEventListener('click', () => {
    const isMuted = sound.toggleMute();
    soundIcon.textContent = isMuted ? '🔇' : '🔊';
    showToast(isMuted ? 'Sound Muted' : 'Sound Enabled');
  });

  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    setTimeout(() => renderer.resize(), 100);
  });

  // Share & QR Modal
  btnLanInfo.addEventListener('click', () => {
    renderLiveQR(currentRoomCode);
    modalLan.classList.remove('hidden');
  });

  btnShowRoomQr.addEventListener('click', () => {
    renderLiveQR(currentRoomCode);
    modalLan.classList.remove('hidden');
  });

  btnCloseLan.addEventListener('click', () => {
    modalLan.classList.add('hidden');
  });

  btnDoneLan.addEventListener('click', () => {
    modalLan.classList.add('hidden');
  });

  btnCopyLanUrl.addEventListener('click', () => {
    const url = lanUrlText.textContent;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard!');
    }).catch(() => {
      showToast('Copy failed');
    });
  });

  btnCopyCode.addEventListener('click', () => {
    if (currentRoomCode) {
      navigator.clipboard.writeText(currentRoomCode).then(() => {
        showToast(`Room code ${currentRoomCode} copied!`);
      });
    }
  });

  btnLeaveRoom.addEventListener('click', () => {
    if (socket) socket.emit('leave_room');
    currentRoomCode = null;
    showScreen(screenLobby);
  });

  btnInGameExit.addEventListener('click', () => {
    modalExit.classList.remove('hidden');
  });

  btnCloseExit.addEventListener('click', () => {
    modalExit.classList.add('hidden');
  });

  btnCancelExit.addEventListener('click', () => {
    modalExit.classList.add('hidden');
  });

  btnConfirmExit.addEventListener('click', () => {
    modalExit.classList.add('hidden');
    stopCentralRenderLoop();
    if (isSoloMode && soloSimulator) {
      soloSimulator.stop();
    } else if (socket) {
      socket.emit('leave_room');
    }
    showScreen(screenLobby);
  });

  btnRematch.addEventListener('click', () => {
    if (isSoloMode) {
      modalGameOver.classList.add('hidden');
      btnSoloAI.click();
    } else if (socket) {
      socket.emit('rematch_vote');
      rematchBtnText.textContent = 'Rematch Requested!';
    }
  });

  btnReturnLobby.addEventListener('click', () => {
    modalGameOver.classList.add('hidden');
    stopCentralRenderLoop();
    if (isSoloMode && soloSimulator) {
      soloSimulator.stop();
    } else if (socket) {
      socket.emit('leave_room');
    }
    showScreen(screenLobby);
  });

  // URL Hash Auto-Join Detection
  const hashMatch = window.location.hash.match(/room=([A-Za-z0-9_-]+)/i);
  const searchParams = new URLSearchParams(window.location.search);
  const urlRoomCode = (hashMatch ? hashMatch[1] : searchParams.get('room'));

  if (urlRoomCode) {
    const code = urlRoomCode.toUpperCase().trim();
    inputJoinCode.value = code;
    setTimeout(() => {
      showToast(`Ready to join Room ${code}!`);
      modalJoin.classList.remove('hidden');
    }, 600);
  }
});
