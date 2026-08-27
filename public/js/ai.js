class LocalGameSimulator {
  constructor(renderer, soundManager, onGameOver, onStateUpdate) {
    this.renderer = renderer;
    this.sound = soundManager;
    this.onGameOver = onGameOver;
    this.onStateUpdate = onStateUpdate;
    this.isRunning = false;
    this.isMultiplayer = false; // When true: P2 is human, disable AI override
    this.nextEntityId = 1;
    this.p1Name = 'Player 1';
    this.p2Name = 'Cyber Bot (AI)';

    this.aiErrorOffset = 0;
    this.lastErrorUpdate = 0;

    this.initGame();
  }

  initGame() {
    const ARENA_WIDTH = 1200;
    const ARENA_HEIGHT = 700;
    const PADDLE_DEFAULT_HEIGHT = 58;
    const PADDLE_WIDTH = 16;
    const P1_X = 180;
    const P2_X = 1004;

    this.state = {
      state: 'playing',
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
          radius: 10,
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
          x: P1_X,
          y: ARENA_HEIGHT / 2 - PADDLE_DEFAULT_HEIGHT / 2,
          targetY: ARENA_HEIGHT / 2 - PADDLE_DEFAULT_HEIGHT / 2,
          height: PADDLE_DEFAULT_HEIGHT,
          width: PADDLE_WIDTH,
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
          x: P2_X,
          y: ARENA_HEIGHT / 2 - PADDLE_DEFAULT_HEIGHT / 2,
          targetY: ARENA_HEIGHT / 2 - PADDLE_DEFAULT_HEIGHT / 2,
          height: PADDLE_DEFAULT_HEIGHT,
          width: PADDLE_WIDTH,
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
      bricks: this.createBrickLayout(),
      powerupItems: []
    };
  }

  // 100% PERFECT MIRRORED 3-ROW LAYOUT
  createBrickLayout() {
    const bricks = [];
    const rows = 6;
    const brickWidth = 24;
    const brickHeight = 85;
    const gapY = 12;
    const startY = 60;

    // Left (P1): Cores X=40, Mid X=80, Front X=120
    for (let r = 0; r < rows; r++) {
      const y = startY + r * (brickHeight + gapY);

      bricks.push({ id: `p1_core_${r}`, owner: 'p1', x: 40, y, w: brickWidth, h: brickHeight, type: 'core', hp: 2, maxHp: 2, powerup: null, alive: true });

      let midPw = null;
      if (r === 0) midPw = 'giant';
      else if (r === 1) midPw = 'guided';
      else if (r === 2) midPw = 'barrier';
      else if (r === 3) midPw = 'barrier';
      else if (r === 4) midPw = 'fireball';
      else if (r === 5) midPw = 'multiball';

      bricks.push({ id: `p1_mid_${r}`, owner: 'p1', x: 80, y, w: brickWidth, h: brickHeight, type: midPw ? 'power' : 'normal', hp: 1, maxHp: 1, powerup: midPw, alive: true });

      bricks.push({ id: `p1_front_${r}`, owner: 'p1', x: 120, y, w: brickWidth, h: brickHeight, type: 'normal', hp: 1, maxHp: 1, powerup: null, alive: true });
    }

    // Right (P2): Front X=1056, Mid X=1096, Cores X=1136
    for (let r = 0; r < rows; r++) {
      const y = startY + r * (brickHeight + gapY);

      bricks.push({ id: `p2_front_${r}`, owner: 'p2', x: 1056, y, w: brickWidth, h: brickHeight, type: 'normal', hp: 1, maxHp: 1, powerup: null, alive: true });

      let midPw = null;
      if (r === 0) midPw = 'giant';
      else if (r === 1) midPw = 'guided';
      else if (r === 2) midPw = 'barrier';
      else if (r === 3) midPw = 'barrier';
      else if (r === 4) midPw = 'fireball';
      else if (r === 5) midPw = 'multiball';

      bricks.push({ id: `p2_mid_${r}`, owner: 'p2', x: 1096, y, w: brickWidth, h: brickHeight, type: midPw ? 'power' : 'normal', hp: 1, maxHp: 1, powerup: midPw, alive: true });

      bricks.push({ id: `p2_core_${r}`, owner: 'p2', x: 1136, y, w: brickWidth, h: brickHeight, type: 'core', hp: 2, maxHp: 2, powerup: null, alive: true });
    }

    return bricks;
  }

  start(p1Name = 'Player 1') {
    this.p1Name = p1Name;
    this.p2Name = 'Cyber Bot (AI)';
    this.isMultiplayer = false;
    this.initGame();
    this.isRunning = true;

    let lastTime = performance.now();
    let accumulator = 0;
    const FIXED_STEP = 1000 / 60; // Exact 60 ticks/second regardless of 60Hz/90Hz/120Hz display refresh rate

    const loop = (currentTime) => {
      if (!this.isRunning) return;
      const frameDelta = Math.min(100, currentTime - lastTime);
      lastTime = currentTime;
      accumulator += frameDelta;

      while (accumulator >= FIXED_STEP) {
        this.tick();
        accumulator -= FIXED_STEP;
      }

      if (this.onStateUpdate) {
        this.onStateUpdate(this.state);
      }
      this.renderer.render(this.state, 'p1', { p1: this.p1Name, p2: this.p2Name });
      requestAnimationFrame(loop);
    };

    requestAnimationFrame((t) => {
      lastTime = t;
      loop(t);
    });
  }

  stop() {
    this.isRunning = false;
  }

  handlePlayerInput(input) {
    if (!this.state || !this.isRunning) return;
    const p1 = this.state.paddles.p1;
    if (typeof input.targetY === 'number') {
      p1.targetY = Math.max(10, Math.min(700 - p1.height - 10, input.targetY));
    }

    if (input.turbo && p1.charge >= 100 && p1.turboTimer <= 0) {
      p1.turboTimer = 8.0;
      p1.charge = 0;
      this.sound.playPowerupCollect();
      this.renderer.addExplosion(p1.x + p1.width / 2, p1.y + p1.height / 2, 40, '#ffd700');
      this.renderer.addFloatingText('🔥 8s TURBO ACTIVE!', p1.x + 80, p1.y + p1.height / 2, '#ffd700', 20);
    }
  }

  updateAI() {
    const p2 = this.state.paddles.p2;
    const now = Date.now();

    // Human tracking estimation cycle
    if (now - this.lastErrorUpdate > 900) {
      this.aiErrorOffset = (Math.random() - 0.5) * 35;
      this.lastErrorUpdate = now;
    }

    let targetBall = null;
    let closestDist = Infinity;

    this.state.balls.forEach(b => {
      if (b.vx > 0 && b.x > 320) {
        const dist = 1004 - b.x;
        if (dist < closestDist) {
          closestDist = dist;
          targetBall = b;
        }
      }
    });

    if (targetBall) {
      let estimatedY = targetBall.y;

      // 1. Curving Fireballs: Human reaction cannot predict the sinusoidal arc phase accurately!
      // Add significant dynamic curve perturbation so curving fireballs fool the bot
      if (targetBall.type === 'fireball') {
        const curveNoise = Math.sin((targetBall.curvePhase || 0) * 2.2) * 55;
        estimatedY += curveNoise + (Math.random() - 0.5) * 30;
      } else if (targetBall.type === 'guided') {
        // 2. Guided Ball: Delayed reaction to human thumb remote steering
        estimatedY = (this.lastEstimatedY || targetBall.y) * 0.72 + targetBall.y * 0.28;
      }

      // 3. Wall Bounces: When ball rebounds off top/bottom walls, add realistic angle misjudgment
      if (targetBall.y < 100 || targetBall.y > 600) {
        estimatedY += (targetBall.vy > 0 ? -28 : 28);
      }

      this.lastEstimatedY = estimatedY;
      const targetCenter = estimatedY + this.aiErrorOffset;
      p2.targetY = Math.max(10, Math.min(700 - p2.height - 10, targetCenter - p2.height / 2));
    } else {
      // Idle rhythm breathing when ball is on opponent's half
      p2.targetY = 350 - p2.height / 2 + Math.sin(now * 0.0015) * 45;
    }
  }

  spawnRandomAirdrop() {
    const types = ['giant', 'guided', 'multiball', 'fireball', 'barrier', 'emp', 'repair'];
    const p1Type = types[Math.floor(Math.random() * types.length)];
    const p2Type = types[Math.floor(Math.random() * types.length)];
    const spawnY1 = 120 + Math.random() * 460;
    const spawnY2 = 120 + Math.random() * 460;

    // Dual Fair Balanced Airdrops
    this.state.powerupItems.push({
      id: `pw_${this.nextEntityId++}`,
      type: p1Type,
      x: 600 - 30,
      y: spawnY1,
      vx: -2.2,
      vy: (Math.random() * 2 - 1) * 0.7,
      radius: 16
    });

    this.state.powerupItems.push({
      id: `pw_${this.nextEntityId++}`,
      type: p2Type,
      x: 600 + 30,
      y: spawnY2,
      vx: 2.2,
      vy: (Math.random() * 2 - 1) * 0.7,
      radius: 16
    });

    this.renderer.addFloatingText('🎁 DUAL AIRDROP!', 600, 350, '#ffd700', 18);
  }

  tick() {
    const ARENA_WIDTH = 1200;
    const ARENA_HEIGHT = 700;

    // Only run Bot AI if single player!
    if (!this.isMultiplayer) {
      this.updateAI();
    }

    this.state.timeRemaining -= 1 / 60;
    if (this.state.timeRemaining <= 0) {
      this.state.timeRemaining = 0;
      const p1Score = this.state.paddles.p1.score;
      const p2Score = this.state.paddles.p2.score;
      this.endGame(p1Score >= p2Score ? 'p1' : 'p2', 'Time Expired!');
      return;
    }

    // Mid/Late Game Random Airdrops
    this.state.airdropTimer -= 1 / 60;
    if (this.state.airdropTimer <= 0) {
      this.spawnRandomAirdrop();
      this.state.airdropTimer = 20 + Math.random() * 6;
    }

    // End-Game Acceleration (< 12 bricks)
    const aliveBricksCount = this.state.bricks.filter(b => b.alive).length;
    const isSuddenDeath = aliveBricksCount < 12;
    if (isSuddenDeath && !this.state.isSuddenDeath) {
      this.state.isSuddenDeath = true;
      this.renderer.addFloatingText('⚠️ SUDDEN DEATH ACCELERATION!', 600, 350, '#ff0055', 22);
    }

    // Player 1 Paddle
    const p1 = this.state.paddles.p1;
    const p1PrevY = p1.y;
    p1.y += (p1.targetY - p1.y) * 0.45;
    p1.vy = (p1.y - p1PrevY) * 60;

    // Player 2 Paddle (Snappier, faster speed + realistic human tracking)
    const p2 = this.state.paddles.p2;
    const p2PrevY = p2.y;
    if (this.isMultiplayer) {
      p2.y += (p2.targetY - p2.y) * 0.45;
    } else {
      const diff = p2.targetY - p2.y;
      const isFastPhase = this.state.isSuddenDeath || p2.turboTimer > 0;
      const aiMaxSpeed = isFastPhase ? 6.8 : 5.6; // Agility
      if (Math.abs(diff) < aiMaxSpeed) {
        p2.y = p2.targetY;
      } else {
        p2.y += Math.sign(diff) * aiMaxSpeed;
      }
    }
    p2.vy = (p2.y - p2PrevY) * 60;

    ['p1', 'p2'].forEach(slot => {
      const p = this.state.paddles[slot];

      if (p.turboTimer > 0) {
        p.turboTimer -= 1 / 60;
        if (p.turboTimer <= 0) p.turboTimer = 0;
      }

      for (const [eff, timer] of Object.entries(p.activeEffects)) {
        if (timer > 0) {
          p.activeEffects[eff] -= 1 / 60;
          if (p.activeEffects[eff] <= 0) {
            delete p.activeEffects[eff];
            if (eff === 'giant' || eff === 'shrink') {
              if (p.activeEffects.giant > 0) {
                p.height = 92;
              } else if (p.activeEffects.shrink > 0) {
                p.height = Math.round(58 * 0.85);
              } else {
                p.height = 58;
              }
            }
          }
        }
      }
    });

    // Powerups
    for (let i = this.state.powerupItems.length - 1; i >= 0; i--) {
      const item = this.state.powerupItems[i];
      item.x += item.vx;
      item.y += item.vy;
      if (item.y < 30 || item.y > ARENA_HEIGHT - 30) item.vy = -item.vy;

      ['p1', 'p2'].forEach(slot => {
        const p = this.state.paddles[slot];
        if (
          item.x + item.radius >= p.x &&
          item.x - item.radius <= p.x + p.width &&
          item.y + item.radius >= p.y &&
          item.y - item.radius <= p.y + p.height
        ) {
          this.applyPowerup(slot, item.type);
          this.sound.playPowerupCollect();
          let name = item.type.toUpperCase();
          if (item.type === 'giant') name = 'PADDLE EXTEND';
          if (item.type === 'guided') name = 'GUIDED STEERING';
          this.renderer.addFloatingText(`+${name}!`, item.x, item.y, '#ffd700', 18);
          this.state.powerupItems.splice(i, 1);
        }
      });
      if (item.x < 0 || item.x > ARENA_WIDTH) this.state.powerupItems.splice(i, 1);
    }

    // Balls with Swept Continuous Collision Detection (CCD)
    for (let i = this.state.balls.length - 1; i >= 0; i--) {
      const ball = this.state.balls[i];
      ball.prevX = ball.x;
      ball.prevY = ball.y;

      // 1. Magnus Effect: Ball Curvature from Paddle Spin Transfer
      if (ball.spin) {
        ball.vy += ball.spin * 0.28;
        ball.spin *= 0.982;
        if (Math.abs(ball.spin) < 0.01) ball.spin = 0;
      }

      // 2. Real-time Direction-Aware Remote Steering on Guided Ball
      if (ball.type === 'guided' && ball.lastHitter) {
        const ownerPaddle = this.state.paddles[ball.lastHitter];
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
        ball.typeTimer -= 1 / 60;
        if (ball.typeTimer <= 0) ball.type = 'normal';
      }

      // Walls
      if (ball.y - ball.radius <= 10) {
        ball.y = 10 + ball.radius;
        ball.vy = Math.abs(ball.vy);
        if (ball.spin) ball.spin *= -0.5;
        this.sound.playWallBounce();
        this.renderer.addSparkles(ball.x, ball.y, '#00f0ff', 5);
      } else if (ball.y + ball.radius >= ARENA_HEIGHT - 10) {
        ball.y = ARENA_HEIGHT - 10 - ball.radius;
        ball.vy = -Math.abs(ball.vy);
        if (ball.spin) ball.spin *= -0.5;
        this.sound.playWallBounce();
        this.renderer.addSparkles(ball.x, ball.y, '#00f0ff', 5);
      }

      // Center Line 1-Way Defense Barrier Collision (X = 600, Top 1/5th [0, 140] & Bottom 1/5th [560, 700])
      const isBarrierSector = (ball.y >= 0 && ball.y <= 140) || (ball.y >= 560 && ball.y <= 700);
      if (isBarrierSector) {
        // P1 Barrier: Blocks opponent balls (vx < 0) from crossing into P1's zone
        if (this.state.paddles.p1.activeEffects.barrier > 0 && ball.vx < 0) {
          if (ball.prevX >= 600 && ball.x <= 600 + ball.radius) {
            ball.x = 600 + ball.radius;
            ball.vx = Math.abs(ball.vx) * 1.05;
            if (this.sound.playBarrierBounce) this.sound.playBarrierBounce();
            else this.sound.playWallBounce();
            this.renderer.addExplosion(600, ball.y, 35, '#00f0ff');
            this.renderer.addFloatingText('🛡️ DEFLECTION!', 600, ball.y, '#00f0ff', 16);
          }
        }
        // P2 Barrier: Blocks opponent balls (vx > 0) from crossing into P2's zone
        if (this.state.paddles.p2.activeEffects.barrier > 0 && ball.vx > 0) {
          if (ball.prevX <= 600 && ball.x >= 600 - ball.radius) {
            ball.x = 600 - ball.radius;
            ball.vx = -Math.abs(ball.vx) * 1.05;
            if (this.sound.playBarrierBounce) this.sound.playBarrierBounce();
            else this.sound.playWallBounce();
            this.renderer.addExplosion(600, ball.y, 35, '#ff0077');
            this.renderer.addFloatingText('🛡️ DEFLECTION!', 600, ball.y, '#ff0077', 16);
          }
        }
      }

      // Swept Collision for P1 Paddle (X = 180, plane at 196)
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

      // Swept Collision for P2 Paddle (X = 1004, plane at 1004)
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

      // Bricks
      for (const brick of this.state.bricks) {
        if (!brick.alive) continue;
        const nearestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
        const nearestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
        const dx = ball.x - nearestX;
        const dy = ball.y - nearestY;

        if (dx * dx + dy * dy < ball.radius * ball.radius) {
          const hitter = ball.lastHitter || (brick.owner === 'p1' ? 'p2' : 'p1');

          brick.hp -= (ball.type === 'fireball' ? 2 : 1);
          if (brick.hp <= 0) {
            brick.alive = false;
            this.handleBrickDestroyed(brick, hitter);
          }

          this.sound.playBrickHit(!brick.alive, brick.type === 'core', this.state.paddles[hitter].combo);
          this.renderer.addSparkles(nearestX, nearestY, brick.owner === 'p1' ? '#00f0ff' : '#ff0077', 8);

          // Fireball breaks 1 brick with 2 damage, then consumes flame & reverts to normal ball
          if (ball.type === 'fireball') {
            ball.type = 'normal';
          }

          const overlapX = (brick.w / 2 + ball.radius) - Math.abs(ball.x - (brick.x + brick.w / 2));
          const overlapY = (brick.h / 2 + ball.radius) - Math.abs(ball.y - (brick.y + brick.h / 2));
          if (overlapX < overlapY) ball.vx = -ball.vx;
          else ball.vy = -ball.vy;
          if (ball.spin) ball.spin *= -0.5;

          this.checkWinCondition();
          break;
        }
      }

      // Goals
      if (ball.x < 10) {
        this.state.paddles.p2.score += 250;
        this.sound.playGoalScore();
        this.renderer.addExplosion(ball.x, ball.y, 60, '#ff0077');
        this.renderer.addFloatingText('GOAL! +250', ARENA_WIDTH / 2, ARENA_HEIGHT / 2, '#ff0077', 26);
        if (this.state.balls.length > 1) {
          this.state.balls.splice(i, 1);
          continue;
        } else {
          this.resetBall(ball, 'p1');
        }
      } else if (ball.x > ARENA_WIDTH - 10) {
        this.state.paddles.p1.score += 250;
        this.sound.playGoalScore();
        this.renderer.addExplosion(ball.x, ball.y, 60, '#00f0ff');
        this.renderer.addFloatingText('GOAL! +250', ARENA_WIDTH / 2, ARENA_HEIGHT / 2, '#00f0ff', 26);
        if (this.state.balls.length > 1) {
          this.state.balls.splice(i, 1);
          continue;
        } else {
          this.resetBall(ball, 'p2');
        }
      }
    }
  }

  handlePaddleHit(ball, paddle, slot, isSuddenDeath = false) {
    // 1. EMP Shock: If incoming ball was electrified by opponent, reliably shrink this paddle by 15% (10s duration)
    if (ball.type === 'emp' && ball.lastHitter && ball.lastHitter !== slot) {
      paddle.activeEffects.shrink = 10;
      if (paddle.activeEffects.giant <= 0) {
        paddle.height = Math.round(58 * 0.85); // 49px
      }
      if (this.sound.playEMPShock) this.sound.playEMPShock();
      this.renderer.addExplosion(ball.x, ball.y, 40, '#a855f7');
      this.renderer.addFloatingText('⚡ 15% PADDLE SHRINK!', ball.x, ball.y, '#c084fc', 18);
      ball.type = 'normal'; // Consumed on impact
    }

    ball.lastHitter = slot;

    if (paddle.turboTimer <= 0) {
      paddle.charge = Math.min(100, paddle.charge + 25);
    }

    // 2. Classic Balanced Paddle Deflection Angle
    const relativeHit = (ball.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2);
    const clampedHit = Math.max(-0.88, Math.min(0.88, relativeHit));
    const bounceAngle = clampedHit * (Math.PI / 3.2);

    // 3. Paddle Motion -> Ball Spin Transfer (Magnus Effect)
    // Inverted spin: moving paddle up curves ball down, moving paddle down curves ball up (realistic counter-friction)
    // When Fireball is active, spin is amplified 3x for dramatic, controllable bending curveballs!
    const hasGuided = (paddle.activeEffects.guided > 0);
    const hasFireball = (paddle.activeEffects.fireball > 0);
    const hasEmp = (paddle.activeEffects.emp > 0);
    const isTurboActive = (paddle.turboTimer > 0);

    const paddleVy = paddle.vy || 0;
    const spinMultiplier = hasFireball ? 3.0 : 1.0;
    const maxSpinLimit = hasFireball ? 7.5 : 2.5;
    const spinTransfer = -Math.max(-maxSpinLimit, Math.min(maxSpinLimit, paddleVy * 0.045 * spinMultiplier));
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
      this.sound.playPaddleHit(true, paddle.combo);
      this.renderer.addExplosion(ball.x, ball.y, 40, '#ff4500');
    } else if (hasGuided) {
      ball.type = 'guided';
      ball.typeTimer = 8;
      this.sound.playPaddleHit(false, paddle.combo);
      this.renderer.addSparkles(ball.x, ball.y, '#00f0ff', 12);
      this.renderer.addFloatingText('🎯 STEER WITH THUMB!', ball.x, ball.y, '#00f0ff', 16);
    } else if (hasEmp) {
      ball.type = 'emp';
      ball.typeTimer = 8;
      this.sound.playPaddleHit(false, paddle.combo);
      this.renderer.addExplosion(ball.x, ball.y, 35, '#c084fc');
      this.renderer.addFloatingText('⚡ EMP ELECTRIFIED!', ball.x, ball.y, '#c084fc', 16);
    } else {
      ball.type = 'normal';
      ball.typeTimer = 0;
      this.sound.playPaddleHit(isTurboActive, paddle.combo);
      this.renderer.addSparkles(ball.x, ball.y, slot === 'p1' ? '#00f0ff' : '#ff0077', 8);
    }

    ball.isTurbo = isTurboActive;

    const dir = slot === 'p1' ? 1 : -1;
    ball.vx = dir * speed * Math.cos(bounceAngle);
    ball.vy = speed * Math.sin(bounceAngle);
    ball.speed = speed;

    paddle.combo++;
    if (paddle.combo > paddle.maxCombo) paddle.maxCombo = paddle.combo;
    paddle.score += 10 * paddle.combo;
  }

  handleBrickDestroyed(brick, hitterSlot) {
    const paddle = this.state.paddles[hitterSlot];
    if (paddle) {
      paddle.bricksDestroyed++;
      const pts = brick.type === 'core' ? 300 : 100;
      paddle.score += pts;
      this.renderer.addBrickShards(brick.x, brick.y, brick.w, brick.h, brick.type === 'core' ? '#ffd700' : (brick.owner === 'p1' ? '#00f0ff' : '#ff0077'), 14);
      this.renderer.addFloatingText(`+${pts}`, brick.x + brick.w / 2, brick.y, '#ffffff', 14);
    }

    if (brick.powerup) {
      const dir = brick.owner === 'p1' ? 1 : -1;
      this.state.powerupItems.push({
        id: `pw_${this.nextEntityId++}`,
        type: brick.powerup,
        x: brick.x + brick.w / 2,
        y: brick.y + brick.h / 2,
        vx: dir * 2.2,
        vy: (Math.random() * 2 - 1) * 0.8,
        radius: 16
      });
    }
  }

  applyPowerup(slot, type) {
    const p = this.state.paddles[slot];
    p.powerupsCollected++;
    p.score += 100;

    switch (type) {
      case 'multiball':
        this.state.balls.push({
          id: `ball_${this.nextEntityId++}`,
          x: 600,
          y: 350,
          prevX: 600,
          prevY: 350,
          vx: (slot === 'p1' ? 1 : -1) * 8.5,
          vy: (Math.random() * 3 - 1.5),
          speed: 8.5,
          radius: 10,
          lastHitter: slot,
          type: 'normal',
          isTurbo: false,
          typeTimer: 0,
          curveDir: 0,
          curvePhase: 0
        });
        break;
      case 'emp':
        p.activeEffects.emp = 12;
        break;
      case 'repair': {
        const deadBricks = this.state.bricks.filter(b => b.owner === slot && !b.alive && b.type !== 'core');
        const toRevive = deadBricks.slice(0, 2);
        toRevive.forEach(b => {
          b.alive = true;
          b.hp = b.maxHp;
          if (this.sound.playRepairChime) this.sound.playRepairChime();
          this.renderer.addSparkles(b.x + b.w / 2, b.y + b.h / 2, '#00ff88', 16);
          this.renderer.addFloatingText('🛠️ REPAIRED!', b.x + b.w / 2, b.y, '#00ff88', 16);
        });
        break;
      }
      case 'barrier':
        p.activeEffects.barrier = 12;
        break;
      case 'giant':
        p.activeEffects.giant = 12;
        p.height = 92;
        break;
      case 'fireball':
        p.activeEffects.fireball = 12;
        break;
      case 'guided':
        p.activeEffects.guided = 12;
        break;
    }
  }

  resetBall(ball, scoredOnSlot) {
    ball.x = 600;
    ball.y = 350;
    ball.prevX = 600;
    ball.prevY = 350;
    ball.vx = (scoredOnSlot === 'p1' ? -1 : 1) * 8.5;
    ball.vy = Math.random() * 3 - 1.5;
    ball.speed = 8.5;
    ball.lastHitter = null;
    ball.type = 'normal';
    ball.isTurbo = false;
    ball.typeTimer = 0;
    ball.curveDir = 0;
    ball.curvePhase = 0;

    this.state.paddles[scoredOnSlot].combo = 0;
  }

  checkWinCondition() {
    const p1Cores = this.state.bricks.filter(b => b.owner === 'p1' && b.type === 'core' && b.alive);
    const p2Cores = this.state.bricks.filter(b => b.owner === 'p2' && b.type === 'core' && b.alive);

    if (p1Cores.length === 0) {
      this.endGame('p2', 'Player 2 Shattered all Core Crystals!');
    } else if (p2Cores.length === 0) {
      this.endGame('p1', `${this.p1Name} Shattered all Core Crystals!`);
    }
  }

  endGame(winnerSlot, reason) {
    this.stop();
    const winnerName = winnerSlot === 'p1' ? this.p1Name : this.p2Name;
    if (winnerSlot === 'p1') {
      this.sound.playVictory();
    } else {
      this.sound.playDefeat();
    }

    if (this.onGameOver) {
      this.onGameOver({
        winner: winnerSlot,
        winnerName: winnerName,
        reason: reason,
        p1: {
          name: this.p1Name,
          score: this.state.paddles.p1.score,
          bricksDestroyed: this.state.paddles.p1.bricksDestroyed,
          maxCombo: this.state.paddles.p1.maxCombo,
          powerupsCollected: this.state.paddles.p1.powerupsCollected
        },
        p2: {
          name: this.p2Name,
          score: this.state.paddles.p2.score,
          bricksDestroyed: this.state.paddles.p2.bricksDestroyed,
          maxCombo: this.state.paddles.p2.maxCombo,
          powerupsCollected: this.state.paddles.p2.powerupsCollected
        }
      });
    }
  }
}

window.LocalGameSimulator = LocalGameSimulator;
