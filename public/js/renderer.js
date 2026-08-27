class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.virtualWidth = 1200;
    this.virtualHeight = 700;
    this.dpr = window.devicePixelRatio || 1;
    this.viewMode = 'bottom';

    this.particles = [];
    this.floatingTexts = [];
    this.ballTrails = new Map();
    this.screenShake = 0;

    this.initResize();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.resize();
  }

  initResize() {
    this.resize = () => {
      const parent = this.canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const parentWidth = rect.width;
      const parentHeight = rect.height;

      if (parentWidth <= 0 || parentHeight <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      this.dpr = dpr;

      this.canvas.width = Math.floor(parentWidth * dpr);
      this.canvas.height = Math.floor(parentHeight * dpr);
      this.canvas.style.width = `${Math.floor(parentWidth)}px`;
      this.canvas.style.height = `${Math.floor(parentHeight)}px`;
      this.canvas.style.transform = 'none';

      this.screenWidth = parentWidth;
      this.screenHeight = parentHeight;
    };

    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', () => setTimeout(this.resize, 100));

    if (window.ResizeObserver && this.canvas.parentElement) {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this.canvas.parentElement);
    }

    setTimeout(this.resize, 50);
  }

  addScreenShake(amount = 6) {
    this.screenShake = Math.max(this.screenShake, amount);
  }

  addSparkles(x, y, color = '#00f0ff', count = 8, speed = 3.5) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const vel = (Math.random() * 0.7 + 0.3) * speed;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        size: Math.random() * 2.5 + 2,
        color: color,
        alpha: 1,
        decay: Math.random() * 0.04 + 0.025,
        shape: 'spark'
      });
    }
  }

  addBrickShards(x, y, w, h, color = '#00f0ff', count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      this.particles.push({
        x: x + Math.random() * w,
        y: y + Math.random() * h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 3,
        color: color,
        alpha: 1,
        decay: Math.random() * 0.035 + 0.02,
        shape: 'shard',
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.2
      });
    }
  }

  addExplosion(x, y, radius = 50, color = '#00f0ff') {
    this.addScreenShake(8);
    this.particles.push({
      x, y, radius: 10, maxRadius: radius * 1.3,
      color, alpha: 1, decay: 0.05, shape: 'ring'
    });
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: color,
        alpha: 1,
        decay: Math.random() * 0.04 + 0.02,
        shape: 'spark'
      });
    }
  }

  addFloatingText(text, x, y, color = '#ffd700', size = 18) {
    this.floatingTexts.push({
      text, x, y, color, size,
      alpha: 1, vy: -1.3
    });
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.shape === 'ring') {
        p.radius += (p.maxRadius - p.radius) * 0.15;
        p.alpha -= p.decay;
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.alpha -= p.decay;
        if (p.shape === 'shard' && p.rotation !== undefined) {
          p.rotation += p.vRot;
        }
      }

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.025;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    if (this.screenShake > 0) {
      this.screenShake *= 0.85;
      if (this.screenShake < 0.3) this.screenShake = 0;
    }
  }

  render(gameState, playerSlot = 'p1', playerNames = {}) {
    this.updateParticles();
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    const W = this.screenWidth || 1200;
    const H = this.screenHeight || 700;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#040711';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    if (this.viewMode === 'bottom') {
      const scale = Math.min(W / this.virtualHeight, H / this.virtualWidth);
      const drawW = this.virtualHeight * scale;
      const drawH = this.virtualWidth * scale;
      const offX = (W - drawW) / 2;
      const offY = (H - drawH) / 2;

      if (playerSlot === 'p2') {
        ctx.translate(offX + drawW, offY);
        ctx.rotate(Math.PI / 2);
      } else {
        ctx.translate(offX, offY + drawH);
        ctx.rotate(-Math.PI / 2);
      }
      ctx.scale(scale, scale);
    } else if (this.viewMode === 'top') {
      const scale = Math.min(W / this.virtualHeight, H / this.virtualWidth);
      const drawW = this.virtualHeight * scale;
      const drawH = this.virtualWidth * scale;
      const offX = (W - drawW) / 2;
      const offY = (H - drawH) / 2;

      if (playerSlot === 'p2') {
        ctx.translate(offX, offY + drawH);
        ctx.rotate(-Math.PI / 2);
      } else {
        ctx.translate(offX + drawW, offY);
        ctx.rotate(Math.PI / 2);
      }
      ctx.scale(scale, scale);
    } else {
      const scale = Math.min(W / this.virtualWidth, H / this.virtualHeight);
      const drawW = this.virtualWidth * scale;
      const drawH = this.virtualHeight * scale;
      const offX = (W - drawW) / 2;
      const offY = (H - drawH) / 2;

      ctx.translate(offX, offY);
      ctx.scale(scale, scale);
    }

    ctx.fillStyle = '#060a17';
    ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

    const isSuddenDeath = gameState && (gameState.isSuddenDeath || gameState.sd);
    this.drawCourt(ctx, isSuddenDeath);

    if (gameState) {
      this.drawCenterBarriers(ctx, gameState.paddles);
      this.drawBricks(ctx, gameState.bricks);
      this.drawPowerupItems(ctx, gameState.powerupItems);
      this.drawPaddles(ctx, gameState.paddles, playerNames, playerSlot);
      this.drawBalls(ctx, gameState.balls, gameState.paddles);
      this.drawParticles(ctx);
      this.drawFloatingTexts(ctx);
    }

    ctx.restore();
  }

  drawCourt(ctx, isSuddenDeath = false) {
    ctx.save();
    const time = Date.now() * 0.003;

    // Court Grid
    ctx.strokeStyle = isSuddenDeath ? 'rgba(255, 0, 85, 0.08)' : 'rgba(0, 240, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.virtualWidth; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.virtualHeight);
      ctx.stroke();
    }

    // Sudden Death Danger Border
    if (isSuddenDeath) {
      const pulse = (Math.sin(time * 4) + 1) * 0.5;
      ctx.strokeStyle = `rgba(255, 0, 85, ${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 16;
      ctx.strokeRect(4, 4, this.virtualWidth - 8, this.virtualHeight - 8);

      ctx.fillStyle = `rgba(255, 0, 85, ${0.35 + pulse * 0.35})`;
      ctx.font = '900 16px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ SUDDEN DEATH ACCELERATION ⚡', this.virtualWidth / 2, 40);
    }

    // Center Net Line
    ctx.strokeStyle = isSuddenDeath ? 'rgba(255, 0, 85, 0.4)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(this.virtualWidth / 2, 0);
    ctx.lineTo(this.virtualWidth / 2, this.virtualHeight);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = isSuddenDeath ? 'rgba(255, 0, 85, 0.25)' : 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(this.virtualWidth / 2, this.virtualHeight / 2, 70, 0, Math.PI * 2);
    ctx.stroke();

    // Goal Zone Tints
    const g1 = ctx.createLinearGradient(0, 0, 120, 0);
    g1.addColorStop(0, 'rgba(0, 240, 255, 0.12)');
    g1.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, 120, this.virtualHeight);

    const g2 = ctx.createLinearGradient(this.virtualWidth, 0, this.virtualWidth - 120, 0);
    g2.addColorStop(0, 'rgba(255, 0, 119, 0.12)');
    g2.addColorStop(1, 'rgba(255, 0, 119, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(this.virtualWidth - 120, 0, 120, this.virtualHeight);

    ctx.restore();
  }

  drawCenterBarriers(ctx, paddles) {
    if (!paddles) return;
    const p1Barrier = !!(paddles.p1 && paddles.p1.activeEffects && paddles.p1.activeEffects.barrier > 0);
    const p2Barrier = !!(paddles.p2 && paddles.p2.activeEffects && paddles.p2.activeEffects.barrier > 0);
    if (!p1Barrier && !p2Barrier) return;

    ctx.save();
    const time = Date.now() * 0.006;
    const sectors = [
      { y: 0, h: 140 },
      { y: 560, h: 140 }
    ];

    sectors.forEach(sec => {
      if (p1Barrier) {
        const pulse = (Math.sin(time * 3 + sec.y) + 1) * 0.5;
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.7 + pulse * 0.3})`;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 18 + pulse * 8;
        ctx.lineWidth = 5;

        ctx.beginPath();
        ctx.moveTo(600, sec.y);
        ctx.lineTo(600, sec.y + sec.h);
        ctx.stroke();

        ctx.fillStyle = `rgba(0, 240, 255, ${0.6 + pulse * 0.4})`;
        ctx.font = 'bold 15px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let py = sec.y + 25; py < sec.y + sec.h; py += 35) {
          ctx.fillText('►', 614, py);
        }
      }

      if (p2Barrier) {
        const pulse = (Math.sin(time * 3 + sec.y + 1) + 1) * 0.5;
        ctx.strokeStyle = `rgba(255, 0, 119, ${0.7 + pulse * 0.3})`;
        ctx.shadowColor = '#ff0077';
        ctx.shadowBlur = 18 + pulse * 8;
        ctx.lineWidth = 5;

        ctx.beginPath();
        ctx.moveTo(600, sec.y);
        ctx.lineTo(600, sec.y + sec.h);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 0, 119, ${0.6 + pulse * 0.4})`;
        ctx.font = 'bold 15px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let py = sec.y + 25; py < sec.y + sec.h; py += 35) {
          ctx.fillText('◄', 586, py);
        }
      }
    });

    ctx.restore();
  }

  drawBricks(ctx, bricks) {
    if (!bricks) return;
    const time = Date.now() * 0.003;

    bricks.forEach(b => {
      if (!b.alive) return;

      ctx.save();
      const isP1 = b.owner === 'p1';
      let strokeColor = isP1 ? '#00f0ff' : '#ff0077';
      let fillColor = isP1 ? 'rgba(0, 240, 255, 0.3)' : 'rgba(255, 0, 119, 0.3)';

      if (b.type === 'core') {
        const pulse = (Math.sin(time + b.y * 0.04) + 1) * 0.5;
        strokeColor = '#ffd700';
        fillColor = `rgba(255, 215, 0, ${0.4 + pulse * 0.3})`;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 8 + pulse * 6;
      } else if (b.type === 'power') {
        strokeColor = '#00f0ff';
        fillColor = 'rgba(0, 240, 255, 0.35)';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
      }

      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = b.type === 'core' ? 2.5 : 1.5;

      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);

      if (b.type === 'core') {
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', b.x + b.w / 2, b.y + b.h / 2);
      } else if (b.type === 'power') {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let icon = '★';
        if (b.powerup === 'guided') icon = '🎯';
        else if (b.powerup === 'giant') icon = '📏';
        else if (b.powerup === 'multiball') icon = '🌀';
        else if (b.powerup === 'fireball') icon = '🔥';
        else if (b.powerup === 'barrier') icon = '🛡️';
        else if (b.powerup === 'emp') icon = '⚡';
        else if (b.powerup === 'repair') icon = '🧱';
        ctx.fillText(icon, b.x + b.w / 2, b.y + b.h / 2);
      }

      if (b.hp === 1 && b.maxHp > 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x + 4, b.y + b.h / 2);
        ctx.lineTo(b.x + b.w / 2, b.y + b.h / 3);
        ctx.lineTo(b.x + b.w - 4, b.y + b.h - 6);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  drawPaddles(ctx, paddles, playerNames, playerSlot) {
    if (!paddles) return;
    const time = Date.now() * 0.005;

    ['p1', 'p2'].forEach(slot => {
      const p = paddles[slot];
      if (!p) return;

      const isP1 = slot === 'p1';
      const isCurrentPlayer = slot === playerSlot;
      const themeColor = isP1 ? '#00f0ff' : '#ff0077';
      const glowColor = isP1 ? 'rgba(0, 240, 255, 0.9)' : 'rgba(255, 0, 119, 0.9)';

      const pX = typeof p.x === 'number' ? p.x : (isP1 ? 180 : 1004);
      const pY = typeof p.y === 'number' ? p.y : 320;
      const pW = p.width || p.w || 16;
      const pH = p.height || p.h || 58;
      const isTurboActive = (p.turboTimer && p.turboTimer > 0);
      const isCharged = (p.charge && p.charge >= 100);

      ctx.save();

      const effects = p.activeEffects || {};
      if (effects.fireball > 0) {
        ctx.shadowColor = '#ff4500';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#ff4500';
        ctx.fillStyle = '#ff6600';
      } else if (effects.emp > 0) {
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 22;
        ctx.strokeStyle = '#c084fc';
        ctx.fillStyle = '#9333ea';
      } else if (effects.shrink > 0) {
        const pulse = Math.sin(time * 6) * 4;
        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 16 + pulse;
        ctx.strokeStyle = '#f43f5e';
        ctx.fillStyle = '#881337';
      } else if (effects.guided > 0) {
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#00f0ff';
        ctx.fillStyle = '#0077ff';
      } else if (effects.giant > 0) {
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#00ff88';
        ctx.fillStyle = '#00cc66';
      } else if (isTurboActive) {
        const pulse = Math.sin(time * 5) * 6;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 24 + pulse;
        ctx.strokeStyle = '#ffd700';
        ctx.fillStyle = '#ffaa00';
      } else if (isCharged) {
        const pulse = (Math.sin(time * 3) + 1) * 4;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 14 + pulse;
        ctx.strokeStyle = '#ffd700';
        ctx.fillStyle = themeColor;
      } else {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = themeColor;
      }

      ctx.lineWidth = 2.5;

      // Draw Gentle Baguette-Shaped Curved Paddle
      const bulge = 5; // convex arc bulging outward toward arena center
      const r = Math.min(pW / 2, 7); // smoothly rounded tips

      ctx.beginPath();
      if (isP1) {
        // P1: Left paddle, front convex face on the right (facing arena center)
        ctx.moveTo(pX, pY + r);
        ctx.arcTo(pX, pY, pX + pW, pY, r);
        // Front curved arc bowing outwards to the right
        ctx.quadraticCurveTo(pX + pW + bulge, pY + pH / 2, pX + pW, pY + pH);
        ctx.arcTo(pX, pY + pH, pX, pY + pH - r, r);
        ctx.lineTo(pX, pY + r);
      } else {
        // P2: Right paddle, front convex face on the left (facing arena center)
        ctx.moveTo(pX + pW, pY + r);
        ctx.arcTo(pX + pW, pY, pX, pY, r);
        // Front curved arc bowing outwards to the left
        ctx.quadraticCurveTo(pX - bulge, pY + pH / 2, pX, pY + pH);
        ctx.arcTo(pX + pW, pY + pH, pX + pW, pY + pH - r, r);
        ctx.lineTo(pX + pW, pY + r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing curved spine
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const spineX = isP1 ? pX + pW / 2 - 1 : pX + pW / 2 + 1;
      ctx.moveTo(spineX, pY + 8);
      ctx.quadraticCurveTo(spineX + (isP1 ? 2.5 : -2.5), pY + pH / 2, spineX, pY + pH - 8);
      ctx.stroke();

      if (isTurboActive) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 11px Orbitron';
        ctx.textAlign = 'center';
        const labelX = isP1 ? pX + pW + 35 : pX - 35;
        ctx.fillText(`⚡ TURBO ${Math.ceil(p.turboTimer)}s`, labelX, pY + pH / 2);
      } else if (effects.fireball > 0) {
        ctx.fillStyle = '#ff7700';
        ctx.font = 'bold 10px Orbitron';
        ctx.textAlign = 'center';
        const labelX = isP1 ? pX + pW + 35 : pX - 35;
        ctx.fillText(`🔥 FIRE ${Math.ceil(effects.fireball)}s`, labelX, pY + pH / 2);
      } else if (effects.emp > 0) {
        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 10px Orbitron';
        ctx.textAlign = 'center';
        const labelX = isP1 ? pX + pW + 35 : pX - 35;
        ctx.fillText(`⚡ EMP ${Math.ceil(effects.emp)}s`, labelX, pY + pH / 2);
      } else if (effects.shrink > 0) {
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 10px Orbitron';
        ctx.textAlign = 'center';
        const labelX = isP1 ? pX + pW + 35 : pX - 35;
        ctx.fillText(`🔻 -15% ${Math.ceil(effects.shrink)}s`, labelX, pY + pH / 2);
      } else if (effects.guided > 0) {
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 10px Orbitron';
        ctx.textAlign = 'center';
        const labelX = isP1 ? pX + pW + 35 : pX - 35;
        ctx.fillText(`🎯 GUIDED`, labelX, pY + pH / 2);
      } else if (effects.barrier > 0) {
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 10px Orbitron';
        ctx.textAlign = 'center';
        const labelX = isP1 ? pX + pW + 35 : pX - 35;
        ctx.fillText(`🛡️ DEFENSE ${Math.ceil(effects.barrier)}s`, labelX, pY + pH / 2);
      } else if (effects.giant > 0) {
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 10px Orbitron';
        ctx.textAlign = 'center';
        const labelX = isP1 ? pX + pW + 35 : pX - 35;
        ctx.fillText(`📏 EXTEND`, labelX, pY + pH / 2);
      }

      const pName = playerNames[slot] || (isP1 ? 'Player 1' : 'Player 2');
      ctx.fillStyle = isCurrentPlayer ? '#ffffff' : 'rgba(255, 255, 255, 0.75)';
      ctx.font = isCurrentPlayer ? 'bold 12px Orbitron' : '11px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText(pName, pX + pW / 2, Math.max(16, pY - 10));

      ctx.restore();
    });
  }

  drawBalls(ctx, balls, paddles) {
    if (!balls) return;

    balls.forEach(ball => {
      if (!this.ballTrails.has(ball.id)) {
        this.ballTrails.set(ball.id, []);
      }
      const trail = this.ballTrails.get(ball.id);
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 8) trail.shift();

      // Motion Trail
      ctx.save();
      for (let i = 0; i < trail.length - 1; i++) {
        const pt = trail[i];
        const alpha = (i + 1) / trail.length * 0.45;
        let trailColor = `rgba(255, 255, 255, ${alpha})`;
        if (ball.type === 'fireball') {
          trailColor = `rgba(255, 69, 0, ${alpha})`;
        } else if (ball.type === 'emp') {
          trailColor = `rgba(192, 132, 252, ${alpha})`;
        } else if (ball.type === 'guided') {
          trailColor = `rgba(0, 240, 255, ${alpha})`;
        } else if (ball.isTurbo) {
          trailColor = `rgba(255, 215, 0, ${alpha})`;
        } else if (ball.lastHitter === 'p1') {
          trailColor = `rgba(0, 240, 255, ${alpha})`;
        } else if (ball.lastHitter === 'p2') {
          trailColor = `rgba(255, 0, 119, ${alpha})`;
        }

        ctx.fillStyle = trailColor;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, ball.radius * ((i + 1) / trail.length), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Guided Ball Laser-Control Beam from paddle to ball
      if (ball.type === 'guided' && ball.lastHitter && paddles && paddles[ball.lastHitter]) {
        const p = paddles[ball.lastHitter];
        const px = typeof p.x === 'number' ? p.x : (ball.lastHitter === 'p1' ? 180 : 1004);
        const py = typeof p.y === 'number' ? p.y : 320;
        const pw = typeof p.width === 'number' ? p.width : (typeof p.w === 'number' ? p.w : 16);
        const ph = typeof p.height === 'number' ? p.height : (typeof p.h === 'number' ? p.h : 58);
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(px + pw / 2, py + ph / 2);
        ctx.lineTo(ball.x, ball.y);
        ctx.stroke();

        // Target reticle on guided ball
        ctx.setLineDash([]);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, (ball.radius || 10) + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Ball Body
      ctx.save();
      let ballColor = '#ffffff';
      let glowColor = '#00f0ff';

      if (ball.type === 'fireball') {
        ballColor = '#ffea00';
        glowColor = '#ff3300';
        ctx.shadowBlur = 25;
        if (Math.random() < 0.4) {
          this.particles.push({
            x: ball.x + (Math.random() * 8 - 4),
            y: ball.y + (Math.random() * 8 - 4),
            vx: -ball.vx * 0.15 + (Math.random() * 2 - 1),
            vy: -ball.vy * 0.15 + (Math.random() * 2 - 1),
            size: Math.random() * 3 + 2,
            color: Math.random() > 0.5 ? '#ff4500' : '#ffd700',
            alpha: 0.9,
            decay: 0.05,
            shape: 'spark'
          });
        }
      } else if (ball.type === 'emp') {
        ballColor = '#f3e8ff';
        glowColor = '#a855f7';
        ctx.shadowBlur = 25;
        if (Math.random() < 0.45) {
          this.particles.push({
            x: ball.x + (Math.random() * 10 - 5),
            y: ball.y + (Math.random() * 10 - 5),
            vx: (Math.random() * 3 - 1.5),
            vy: (Math.random() * 3 - 1.5),
            size: Math.random() * 3 + 1.5,
            color: Math.random() > 0.5 ? '#c084fc' : '#e9d5ff',
            alpha: 0.95,
            decay: 0.06,
            shape: 'spark'
          });
        }
      } else if (ball.type === 'guided') {
        ballColor = '#00f0ff';
        glowColor = '#0077ff';
        ctx.shadowBlur = 22;
      } else if (ball.isTurbo) {
        ballColor = '#ffd700';
        glowColor = '#ff8800';
        ctx.shadowBlur = 20;
      } else if (ball.lastHitter === 'p1') {
        glowColor = '#00f0ff';
        ctx.shadowBlur = 12;
      } else if (ball.lastHitter === 'p2') {
        glowColor = '#ff0077';
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowBlur = 8;
      }

      ctx.shadowColor = glowColor;
      ctx.fillStyle = ballColor;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Spin Rotation Ticks / Aerodynamic Vortex Aura
      if (ball.spin && Math.abs(ball.spin) > 0.15) {
        ctx.save();
        const spinAngle = (ball.spinAngle = ((ball.spinAngle || 0) + ball.spin * 0.35) % (Math.PI * 2));
        ctx.translate(ball.x, ball.y);
        ctx.rotate(spinAngle);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, ball.radius * 0.65, 0, Math.PI * 1.2);
        ctx.stroke();
        ctx.restore();

        if (Math.random() < 0.25) {
          this.particles.push({
            x: ball.x + (Math.random() * 6 - 3),
            y: ball.y + (Math.random() * 6 - 3),
            vx: -ball.vx * 0.1 + (Math.random() * 1.5 - 0.75),
            vy: (ball.spin > 0 ? 1 : -1) * (Math.random() * 2 + 1),
            size: 2,
            color: glowColor,
            alpha: 0.75,
            decay: 0.08,
            shape: 'spark'
          });
        }
      }

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3, ball.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  drawPowerupItems(ctx, items) {
    if (!items) return;
    const time = Date.now() * 0.005;

    items.forEach(item => {
      ctx.save();
      const pulse = Math.sin(time + item.x) * 2;
      const r = item.radius + pulse;

      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(16, 22, 40, 0.92)';
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(item.x, item.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '14px Orbitron';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let icon = '⭐';
      if (item.type === 'guided') icon = '🎯';
      else if (item.type === 'multiball') icon = '🌀';
      else if (item.type === 'fireball') icon = '🔥';
      else if (item.type === 'giant') icon = '📏';
      else if (item.type === 'barrier') icon = '🛡️';
      else if (item.type === 'emp') icon = '⚡';
      else if (item.type === 'repair') icon = '🧱';

      ctx.fillText(icon, item.x, item.y);
      ctx.restore();
    });
  }

  drawParticles(ctx) {
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.shape === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'shard') {
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  drawFloatingTexts(ctx) {
    this.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${ft.size}px Orbitron`;
      ctx.textAlign = 'center';
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
  }
}

window.GameRenderer = GameRenderer;
