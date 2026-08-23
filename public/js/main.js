document.addEventListener('DOMContentLoaded', () => {
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
  let currentRoomCode = null;
  let mySlot = 'p1';
  let isSoloMode = false;
  let soloSimulator = null;
  let isGameLoopRunning = false;
  let clientBricks = [];
  let playerNames = { p1: 'Player 1', p2: 'Player 2' };
  let localPredictedY = 320;
  let lastHudUpdateTime = 0; // Throttle DOM updates to 4Hz

  // Reusable lightweight game state object for 0-GC rendering
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

  // Responsive Setup
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isPortrait = window.innerHeight > window.innerWidth;
  let currentViewMode = isTouchDevice && isPortrait ? 'bottom' : 'landscape';

  const renderer = new window.GameRenderer(canvas);
  const sound = window.soundManager;
  const p2p = new window.P2PNetworkManager();

  const controls = new window.ControlsManager(canvas, (input) => {
    localPredictedY = input.targetY;
    if (isSoloMode && soloSimulator) {
      soloSimulator.handlePlayerInput(input);
    } else if (currentRoomCode) {
      p2p.handlePlayerInput(input);
    }
  });

  if (btnTurbo) {
    const trigger = (e) => {
      controls.triggerTurbo();
      e.preventDefault();
    };
    btnTurbo.addEventListener('click', trigger);
    btnTurbo.addEventListener('touchstart', trigger, { passive: false });
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

  btnRandomName.addEventListener('click', () => {
    const newName = getRandomName();
    inputPlayerName.value = newName;
    localStorage.setItem('brick_clash_name', newName);
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
    sound.init();
    sound.resume();
  }
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });

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

  // Single Unified 60-120 FPS Central Animation Loop
  function startCentralRenderLoop() {
    if (isGameLoopRunning) return;
    isGameLoopRunning = true;

    let lastFrameTime = performance.now();
    let lastBroadcastTime = 0;

    const loop = (now) => {
      if (!isGameLoopRunning) return;
      const dt = Math.min((now - lastFrameTime) / 1000, 0.033);
      lastFrameTime = now;

      // 1. Host Mode: Step physics & broadcast flat telemetry
      if (p2p.isHost && p2p.isGameRunning && p2p.simulator) {
        p2p.simulator.tick();
        const hostState = p2p.simulator.state;

        // Broadcast at 45Hz
        if (now - lastBroadcastTime >= 22) {
          lastBroadcastTime = now;
          p2p.broadcastFlatTick(hostState);
        }

        // Throttle DOM HUD to 4Hz (every 250ms)
        if (now - lastHudUpdateTime >= 250) {
          lastHudUpdateTime = now;
          updateHUD(hostState);
        }

        renderer.render(hostState, mySlot, playerNames);
      }
      // 2. Client Mode: Extrapolate ball & render predicted paddle
      else if (!p2p.isHost && !isSoloMode) {
        const b = activeGameState.balls[0];
        if (b) {
          b.x += (b.vx || 0) * (dt * 60);
          b.y += (b.vy || 0) * (dt * 60);
        }

        // 0ms instant paddle prediction for Player 2
        activeGameState.paddles.p2.y += (localPredictedY - activeGameState.paddles.p2.y) * 0.55;

        // Throttle DOM HUD to 4Hz (every 250ms)
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
      new QRCode(lanQrCanvas, {
        text: shareUrl,
        width: 180,
        height: 180,
        colorDark: '#00f0ff',
        colorLight: '#0a0d1a',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  // Setup P2P Network Handlers
  function initP2P() {
    p2p.on('room_joined', ({ roomCode, slot, isHost }) => {
      currentRoomCode = roomCode;
      mySlot = slot;
      controls.setPlayerSlot(slot);
      isSoloMode = false;

      displayRoomCode.textContent = roomCode;
      showScreen(screenRoom);
      showToast(`Room: ${roomCode}`);
      renderLiveQR(roomCode);
    });

    p2p.on('room_creating', ({ message }) => {
      showToast(message || 'Creating room...');
    });

    p2p.on('room_connecting', ({ message }) => {
      showToast(message || 'Connecting to room...');
    });

    p2p.on('quick_match_searching', ({ message }) => {
      showToast(message || 'Searching for online opponent...');
    });

    p2p.on('join_error', ({ message }) => {
      joinErrorMsg.textContent = message;
      joinErrorMsg.classList.remove('hidden');
      showToast(message);
    });

    p2p.on('lobby_update', ({ p1, p2 }) => {
      if (p1) {
        playerNames.p1 = p1;
        p1SlotName.textContent = p1;
        p1SlotStatus.textContent = 'READY (HOST)';
        p1SlotStatus.className = 'slot-status ready';
      }
      if (p2) {
        playerNames.p2 = p2;
        p2SlotName.textContent = p2;
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

    p2p.on('game_countdown', ({ count }) => {
      showScreen(screenGame);
      countdownOverlay.classList.remove('hidden');
      countdownNumber.textContent = count > 0 ? count : 'CLASH!';
      sound.playCountdown(count);
    });

    p2p.on('game_start', ({ players, bricks }) => {
      countdownOverlay.classList.add('hidden');
      if (players) {
        if (players.p1) playerNames.p1 = players.p1.name;
        if (players.p2) playerNames.p2 = players.p2.name;
      }
      if (bricks) {
        clientBricks = bricks;
        activeGameState.bricks = bricks;
      }
      startCentralRenderLoop();
    });

    p2p.on('brick_update', ({ id, hp, alive }) => {
      const b = clientBricks.find(brick => brick.id === id);
      if (b) {
        b.hp = hp;
        b.alive = alive;
      }
    });

    // Unpack Flat Numeric Telemetry (< 50 Bytes, 0 GC)
    p2p.on('flat_tick', (f) => {
      // f = [timeRemaining, p1Y, p1H, p1Score, p1Combo, p1Mask, p1TurboSec, p2Y, p2H, p2Score, p2Combo, p2Mask, p2TurboSec, bx, by, bvx, bvy, bTypeCode, bHitterCode, bIsTurbo]
      activeGameState.timeRemaining = f[0];

      // Paddle 1 (Host)
      activeGameState.paddles.p1.y = f[1];
      activeGameState.paddles.p1.height = f[2];
      activeGameState.paddles.p1.score = f[3];
      activeGameState.paddles.p1.combo = f[4];
      activeGameState.paddles.p1.turboTimer = f[6];
      activeGameState.paddles.p1.activeEffects = {
        giant: (f[5] & 1) ? 8 : 0,
        fireball: (f[5] & 2) ? 8 : 0,
        guided: (f[5] & 4) ? 8 : 0
      };

      // Paddle 2 (Client - Keep local predicted Y)
      activeGameState.paddles.p2.height = f[8];
      activeGameState.paddles.p2.score = f[9];
      activeGameState.paddles.p2.combo = f[10];
      activeGameState.paddles.p2.turboTimer = f[12];
      activeGameState.paddles.p2.activeEffects = {
        giant: (f[11] & 1) ? 8 : 0,
        fireball: (f[11] & 2) ? 8 : 0,
        guided: (f[11] & 4) ? 8 : 0
      };

      // Ball
      const ball = activeGameState.balls[0];
      if (ball) {
        ball.x = f[13];
        ball.y = f[14];
        ball.vx = f[15];
        ball.vy = f[16];
        ball.type = f[17] === 1 ? 'fireball' : (f[17] === 2 ? 'guided' : 'normal');
        ball.lastHitter = f[18] === 1 ? 'p1' : (f[18] === 2 ? 'p2' : null);
        ball.isTurbo = f[19] === 1;
      }
    });

    p2p.on('game_over', (summary) => {
      stopCentralRenderLoop();
      showGameOverModal(summary);
    });

    p2p.on('opponent_left', ({ message }) => {
      showToast(message || 'Opponent returned to lobby');
      rematchBtnText.textContent = 'Opponent Left Room';
    });
  }

  initP2P();

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Throttled 4Hz DOM updater
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

    // Turbo Button Badges
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

  // --- LOBBY BUTTONS & FLOW ---

  btnQuickPlay.addEventListener('click', () => {
    unlockAudio();
    showToast('Finding match...');
    p2p.quickMatch(getPlayerName());
  });

  btnCreateRoom.addEventListener('click', () => {
    unlockAudio();
    p2p.createRoom(null, getPlayerName());
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
    showToast(`Connecting to Room ${code}...`);
    p2p.joinRoom(code, getPlayerName());
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
    p2p.disconnect();
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
    } else {
      p2p.disconnect();
    }
    showScreen(screenLobby);
  });

  btnRematch.addEventListener('click', () => {
    if (isSoloMode) {
      modalGameOver.classList.add('hidden');
      btnSoloAI.click();
    } else {
      p2p.voteRematch();
      rematchBtnText.textContent = 'Rematch Requested!';
    }
  });

  btnReturnLobby.addEventListener('click', () => {
    modalGameOver.classList.add('hidden');
    stopCentralRenderLoop();
    if (isSoloMode && soloSimulator) {
      soloSimulator.stop();
    } else {
      p2p.disconnect();
    }
    showScreen(screenLobby);
  });

  // URL Hash Auto-Join Detection (e.g. #room=LQB2 or ?room=LQB2)
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
