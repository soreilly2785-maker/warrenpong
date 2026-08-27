class ControlsManager {
  constructor(canvas, onInput) {
    this.canvas = canvas;
    this.onInput = onInput;
    this.virtualHeight = 700;
    this.targetY = 350;
    this.viewMode = 'bottom'; // Default: player at bottom
    this.playerSlot = 'p1';
    this.isTurboRequested = false;

    this.touchActive = false;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.lastTapTime = 0;

    this.keys = { up: false, down: false };
    this.lastEmitTime = 0;
    this.lastEmittedY = -999;

    this.thumbIndicator = document.getElementById('touchpad-thumb-glow');

    this.initKeyboard();
    this.initMouse();
    this.initTouch();
    this.initTouchpadZone();
    this.startInputLoop();
  }

  setViewMode(mode) {
    this.viewMode = mode;
  }

  setPlayerSlot(slot) {
    this.playerSlot = slot || 'p1';
  }

  triggerTurbo() {
    this.isTurboRequested = true;
  }

  updateThumbGlow(relVal) {
    if (this.thumbIndicator) {
      const pct = Math.max(5, Math.min(95, relVal * 100));
      this.thumbIndicator.style.left = `${pct}%`;
    }
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      // In bottom view: Left moves paddle Left, Right moves paddle Right
      if (['ArrowLeft', 'KeyA', 'a', 'A'].includes(e.code) || ['ArrowLeft', 'KeyA'].includes(e.key)) {
        if (this.viewMode === 'bottom') {
          if (this.playerSlot === 'p2') this.keys.down = true;
          else this.keys.up = true; // P1: Left is Y=0 (up)
        } else {
          this.keys.up = true;
        }
      }
      if (['ArrowRight', 'KeyD', 'd', 'D'].includes(e.code) || ['ArrowRight', 'KeyD'].includes(e.key)) {
        if (this.viewMode === 'bottom') {
          if (this.playerSlot === 'p2') this.keys.up = true;
          else this.keys.down = true; // P1: Right is Y=700 (down)
        } else {
          this.keys.down = true;
        }
      }
      if (['ArrowUp', 'KeyW', 'w', 'W'].includes(e.code) || ['ArrowUp', 'KeyW'].includes(e.key)) {
        this.keys.up = true;
      }
      if (['ArrowDown', 'KeyS', 's', 'S'].includes(e.code) || ['ArrowDown', 'KeyS'].includes(e.key)) {
        this.keys.down = true;
      }
      if (e.code === 'Space' || e.key === ' ') {
        this.isTurboRequested = true;
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowLeft', 'KeyA', 'a', 'A', 'ArrowRight', 'KeyD', 'd', 'D', 'ArrowUp', 'KeyW', 'w', 'W', 'ArrowDown', 'KeyS', 's', 'S'].includes(e.code) || ['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'ArrowUp', 'KeyW', 'ArrowDown', 'KeyS'].includes(e.key)) {
        this.keys.up = false;
        this.keys.down = false;
      }
    });
  }

  initMouse() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.height <= 0 || rect.width <= 0) return;

      if (this.viewMode === 'bottom') {
        const relX = (e.clientX - rect.left) / rect.width;
        const clampedRel = Math.max(0, Math.min(1, relX));
        if (this.playerSlot === 'p2') {
          // P2: Left = 700, Right = 0
          this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, (1 - clampedRel) * this.virtualHeight - 29));
          this.updateThumbGlow(clampedRel);
        } else {
          // P1: Left = 0, Right = 700
          this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, clampedRel * this.virtualHeight - 29));
          this.updateThumbGlow(clampedRel);
        }
      } else if (this.viewMode === 'top') {
        const relX = (e.clientX - rect.left) / rect.width;
        const clampedRel = Math.max(0, Math.min(1, relX));
        if (this.playerSlot === 'p2') {
          this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, clampedRel * this.virtualHeight - 29));
          this.updateThumbGlow(clampedRel);
        } else {
          this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, (1 - clampedRel) * this.virtualHeight - 29));
          this.updateThumbGlow(clampedRel);
        }
      } else {
        const relY = (e.clientY - rect.top) / rect.height;
        this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, relY * this.virtualHeight - 29));
        this.updateThumbGlow(relY);
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isTurboRequested = true;
      }
    });
  }

  initTouch() {
    let canvasTouchStart = 0;
    const handleTouch = (e) => {
      const now = Date.now();
      if (now - this.lastTapTime < 320) {
        this.triggerTurbo();
      }
      this.lastTapTime = now;
      canvasTouchStart = now;

      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.touchActive = true;
        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;

        if (rect.width > 0 && rect.height > 0) {
          if (this.viewMode === 'bottom') {
            const relX = (touch.clientX - rect.left) / rect.width;
            const clampedRel = Math.max(0, Math.min(1, relX));
            if (this.playerSlot === 'p2') {
              this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, (1 - clampedRel) * this.virtualHeight - 29));
              this.updateThumbGlow(clampedRel);
            } else {
              this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, clampedRel * this.virtualHeight - 29));
              this.updateThumbGlow(clampedRel);
            }
          } else if (this.viewMode === 'top') {
            const relX = (touch.clientX - rect.left) / rect.width;
            const clampedRel = Math.max(0, Math.min(1, relX));
            if (this.playerSlot === 'p2') {
              this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, clampedRel * this.virtualHeight - 29));
              this.updateThumbGlow(clampedRel);
            } else {
              this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, (1 - clampedRel) * this.virtualHeight - 29));
              this.updateThumbGlow(clampedRel);
            }
          } else {
            const relY = (touch.clientY - rect.top) / rect.height;
            this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, relY * this.virtualHeight - 29));
            this.updateThumbGlow(relY);
          }
        }
      }
      e.preventDefault();
    };

    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();

        if (this.viewMode === 'bottom') {
          const deltaX = (touch.clientX - this.lastTouchX) * (this.virtualHeight / rect.width);
          if (this.playerSlot === 'p2') {
            this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, this.targetY - deltaX * 1.35));
            this.updateThumbGlow(1 - (this.targetY / this.virtualHeight));
          } else {
            this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, this.targetY + deltaX * 1.35));
            this.updateThumbGlow(this.targetY / this.virtualHeight);
          }
        } else if (this.viewMode === 'top') {
          const deltaX = (touch.clientX - this.lastTouchX) * (this.virtualHeight / rect.width);
          if (this.playerSlot === 'p2') {
            this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, this.targetY + deltaX * 1.35));
            this.updateThumbGlow(this.targetY / this.virtualHeight);
          } else {
            this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, this.targetY - deltaX * 1.35));
            this.updateThumbGlow(1 - (this.targetY / this.virtualHeight));
          }
        } else {
          const deltaY = (touch.clientY - this.lastTouchY) * (this.virtualHeight / rect.height);
          this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, this.targetY + deltaY * 1.35));
          this.updateThumbGlow(this.targetY / this.virtualHeight);
        }

        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;
      }
      e.preventDefault();
    };

    const handleTouchEnd = (e) => {
      this.touchActive = false;
      if (Date.now() - canvasTouchStart < 260) {
        this.triggerTurbo();
      }
    };

    this.canvas.addEventListener('touchstart', handleTouch, { passive: false });
    this.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  }

  // Dedicated Full-Width Bottom Control Touchpad Track (Tap Anywhere for Turbo)
  initTouchpadZone() {
    const touchpadSlider = document.querySelector('.touchpad-slider');
    if (!touchpadSlider) return;

    let padActive = false;
    let padTouchStart = 0;

    const setPositionFromTouchpad = (clientX) => {
      const rect = touchpadSlider.getBoundingClientRect();
      if (rect.width <= 0) return;
      const relX = (clientX - rect.left) / rect.width;
      const clampedRel = Math.max(0, Math.min(1, relX));

      if (this.viewMode === 'bottom') {
        if (this.playerSlot === 'p2') {
          this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, (1 - clampedRel) * this.virtualHeight - 29));
          this.updateThumbGlow(clampedRel);
        } else {
          this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, clampedRel * this.virtualHeight - 29));
          this.updateThumbGlow(clampedRel);
        }
      } else {
        this.targetY = Math.max(10, Math.min(this.virtualHeight - 58, clampedRel * this.virtualHeight - 29));
        this.updateThumbGlow(clampedRel);
      }
    };

    const handlePadStart = (e) => {
      if (e.touches && e.touches.length > 0) {
        padActive = true;
        padTouchStart = Date.now();
        setPositionFromTouchpad(e.touches[0].clientX);
      }
      e.preventDefault();
    };

    const handlePadMove = (e) => {
      if (padActive && e.touches && e.touches.length > 0) {
        setPositionFromTouchpad(e.touches[0].clientX);
      }
      e.preventDefault();
    };

    const handlePadEnd = (e) => {
      padActive = false;
      // Tap anywhere on track triggers Turbo!
      if (Date.now() - padTouchStart < 260) {
        this.triggerTurbo();
      }
    };

    touchpadSlider.addEventListener('touchstart', handlePadStart, { passive: false });
    touchpadSlider.addEventListener('touchmove', handlePadMove, { passive: false });
    touchpadSlider.addEventListener('touchend', handlePadEnd, { passive: false });

    touchpadSlider.addEventListener('mousedown', (e) => {
      padActive = true;
      padTouchStart = Date.now();
      setPositionFromTouchpad(e.clientX);
    });

    window.addEventListener('mousemove', (e) => {
      if (padActive) {
        setPositionFromTouchpad(e.clientX);
      }
    });

    window.addEventListener('mouseup', () => {
      if (padActive && (Date.now() - padTouchStart < 260)) {
        this.triggerTurbo();
      }
      padActive = false;
    });
  }

  startInputLoop() {
    const tick = (now) => {
      const keySpeed = 16;
      if (this.keys.up) {
        this.targetY = Math.max(10, this.targetY - keySpeed);
        if (this.viewMode === 'bottom' && this.playerSlot === 'p2') {
          this.updateThumbGlow(1 - (this.targetY / this.virtualHeight));
        } else {
          this.updateThumbGlow(this.targetY / this.virtualHeight);
        }
      }
      if (this.keys.down) {
        this.targetY = Math.min(this.virtualHeight - 58, this.targetY + keySpeed);
        if (this.viewMode === 'bottom' && this.playerSlot === 'p2') {
          this.updateThumbGlow(1 - (this.targetY / this.virtualHeight));
        } else {
          this.updateThumbGlow(this.targetY / this.virtualHeight);
        }
      }

      if (now - this.lastEmitTime >= 33 || this.isTurboRequested) {
        const roundedY = Math.round(this.targetY);
        if (roundedY !== this.lastEmittedY || this.isTurboRequested) {
          if (this.onInput) {
            this.onInput({
              targetY: roundedY,
              turbo: this.isTurboRequested
            });
          }
          this.lastEmittedY = roundedY;
          this.lastEmitTime = now;
        }
      }

      this.isTurboRequested = false;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

window.ControlsManager = ControlsManager;
