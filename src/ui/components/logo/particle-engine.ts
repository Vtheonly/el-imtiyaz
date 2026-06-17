/**
 * Particle Engine — pure TypeScript particle system for the dynamic logo.
 *
 * Scans an image (uploaded or programmatic), extracts dark regions, and
 * creates a field of particles with spring physics. Supports three modes:
 *   - 'logo'      → particles form the original logo
 *   - 'circular'  → particles morph into a spinning loader
 *   - 'linear'    → particles morph into a flowing progress bar
 *
 * Particles react to mouse proximity — pushed away with inverse force,
 * colour-pulsed to white, then spring back to their original positions.
 *
 * The engine is framework-agnostic. React wrapper lives in DynamicLogo.tsx.
 */

export type LogoMode = 'logo' | 'circular' | 'linear';

export interface ParticleEngineOptions {
  canvas: HTMLCanvasElement;
  imageUrl?: string;
  imageElement?: HTMLImageElement;
  mode?: LogoMode;
  density?: number;          // particle density (lower = denser)
  interactionRadius?: number;
  pushForce?: number;
  palette?: {
    primary: [number, number, number];
    deep: [number, number, number];
    accent: [number, number, number];
  };
  background?: string;
  onReady?: () => void;
  onProgress?: (p: number) => void;
}

const DEFAULT_PALETTE = {
  primary: [52, 155, 212] as [number, number, number],   // #349bd4
  deep: [43, 127, 176] as [number, number, number],      // #2b7fb0
  accent: [200, 169, 140] as [number, number, number]    // #c8a98c
};

class Particle {
  // Position
  x: number;
  y: number;

  // Velocity
  vx = 0;
  vy = 0;

  // Target (where the particle wants to be)
  targetX: number;
  targetY: number;

  // Original logo position — used to reset to 'logo' mode
  readonly logoX: number;
  readonly logoY: number;

  // Physics
  damping = 0.88;
  stiffness = 0.08;

  // Visual
  baseSize: number;
  size: number;
  readonly baseColor: [number, number, number];
  color: [number, number, number];

  constructor(x: number, y: number, palette: typeof DEFAULT_PALETTE) {
    // Spawn scattered around center for entry animation
    this.x = x + (Math.random() - 0.5) * 200;
    this.y = y + (Math.random() - 0.5) * 200;
    this.logoX = x;
    this.logoY = y;
    this.targetX = x;
    this.targetY = y;

    this.stiffness = 0.06 + Math.random() * 0.04;
    this.baseSize = 1.6 + Math.random() * 1.4;
    this.size = this.baseSize;

    const roll = Math.random();
    if (roll < 0.65) this.baseColor = palette.primary;
    else if (roll < 0.85) this.baseColor = palette.deep;
    else this.baseColor = palette.accent;

    this.color = [...this.baseColor] as [number, number, number];
  }

  update(mouse: { x: number | null; y: number | null; active: boolean; radius: number; force: number }) {
    // Mouse interaction
    if (mouse.active && mouse.x !== null && mouse.y !== null) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < mouse.radius) {
        const force = (mouse.radius - dist) / mouse.radius;
        const angle = Math.atan2(dy, dx);
        this.vx -= Math.cos(angle) * force * mouse.force;
        this.vy -= Math.sin(angle) * force * mouse.force;

        // Pulse white on contact
        this.color[0] += (239 - this.color[0]) * 0.4;
        this.color[1] += (242 - this.color[1]) * 0.4;
        this.color[2] += (243 - this.color[2]) * 0.4;
        this.size = this.baseSize * 1.5;
      } else {
        this.easeColorAndSize();
      }
    } else {
      this.easeColorAndSize();
    }

    // Spring force toward target
    const springX = (this.targetX - this.x) * this.stiffness;
    const springY = (this.targetY - this.y) * this.stiffness;

    this.vx += springX;
    this.vy += springY;

    this.vx *= this.damping;
    this.vy *= this.damping;

    this.x += this.vx;
    this.y += this.vy;
  }

  private easeColorAndSize() {
    for (let i = 0; i < 3; i++) {
      this.color[i] += (this.baseColor[i] - this.color[i]) * 0.08;
    }
    this.size += (this.baseSize - this.size) * 0.1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = `rgb(${Math.round(this.color[0])}, ${Math.round(this.color[1])}, ${Math.round(this.color[2])})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class ParticleEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private animationFrameId: number | null = null;
  private mode: LogoMode = 'logo';
  private progressValue = 0;

  private mouse = {
    x: null as number | null,
    y: null as number | null,
    active: false,
    radius: 100,
    force: 6
  };

  private palette = DEFAULT_PALETTE;
  private density = 2;
  private background: string;

  constructor(private options: ParticleEngineOptions) {
    this.canvas = options.canvas;
    this.ctx = this.canvas.getContext('2d')!;
    this.mode = options.mode ?? 'logo';
    this.density = options.density ?? 2;
    this.mouse.radius = options.interactionRadius ?? 100;
    this.mouse.force = options.pushForce ?? 6;
    this.palette = options.palette ?? DEFAULT_PALETTE;
    this.background = options.background ?? 'rgba(36, 37, 38, 0.25)';

    this.setupCanvas();
    this.attachListeners();
  }

  /** Starts the engine. If an image is supplied, processes it. Otherwise shows demo. */
  async start(): Promise<void> {
    if (this.options.imageElement) {
      this.processImage(this.options.imageElement);
    } else if (this.options.imageUrl) {
      await this.loadImage(this.options.imageUrl);
    } else {
      this.loadDemoPattern();
    }
  }

  destroy(): void {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.detachListeners();
    this.particles = [];
  }

  setMode(mode: LogoMode): void {
    this.mode = mode;
    this.updateTargets();
  }

  setInteractionRadius(radius: number): void {
    this.mouse.radius = radius;
  }

  setPushForce(force: number): void {
    this.mouse.force = force;
  }

  async loadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.processImage(img);
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /** Generates the programmatic demo pattern — abstract El-Imtiyaz silhouette. */
  private loadDemoPattern(): void {
    const offscreen = document.createElement('canvas');
    offscreen.width = 300;
    offscreen.height = 300;
    const oCtx = offscreen.getContext('2d')!;

    oCtx.fillStyle = '#ffffff';
    oCtx.fillRect(0, 0, 300, 300);

    oCtx.fillStyle = '#000000';

    // Two heads (the "students" silhouette)
    oCtx.beginPath();
    oCtx.arc(120, 90, 24, 0, Math.PI * 2);
    oCtx.fill();
    oCtx.beginPath();
    oCtx.arc(180, 110, 20, 0, Math.PI * 2);
    oCtx.fill();

    // Sweeping wing shapes (graduation-cape silhouette)
    oCtx.beginPath();
    oCtx.moveTo(150, 150);
    oCtx.quadraticCurveTo(80, 120, 20, 220);
    oCtx.quadraticCurveTo(80, 170, 150, 150);
    oCtx.fill();

    oCtx.beginPath();
    oCtx.moveTo(150, 150);
    oCtx.quadraticCurveTo(220, 130, 280, 240);
    oCtx.quadraticCurveTo(210, 180, 150, 150);
    oCtx.fill();

    // Center arches
    oCtx.beginPath();
    oCtx.moveTo(150, 150);
    oCtx.quadraticCurveTo(110, 160, 70, 240);
    oCtx.quadraticCurveTo(110, 190, 150, 150);
    oCtx.fill();

    oCtx.beginPath();
    oCtx.moveTo(150, 150);
    oCtx.quadraticCurveTo(190, 160, 230, 260);
    oCtx.quadraticCurveTo(190, 200, 150, 150);
    oCtx.fill();

    // "E" letter overlay (for El-Imtiyaz)
    oCtx.font = 'bold 60px Arial';
    oCtx.textAlign = 'center';
    oCtx.fillText('E', 150, 70);

    const img = new Image();
    img.onload = () => this.processImage(img);
    img.src = offscreen.toDataURL();
  }

  private processImage(img: HTMLImageElement): void {
    const offscreen = document.createElement('canvas');
    const oCtx = offscreen.getContext('2d')!;

    // Constrain to keep particle count reasonable
    const maxDim = 180;
    let w = img.width;
    let h = img.height;
    if (w > h) {
      if (w > maxDim) { h = Math.round(h * (maxDim / w)); w = maxDim; }
    } else {
      if (h > maxDim) { w = Math.round(w * (maxDim / h)); h = maxDim; }
    }

    offscreen.width = w;
    offscreen.height = h;
    oCtx.fillStyle = '#ffffff';
    oCtx.fillRect(0, 0, w, h);
    oCtx.drawImage(img, 0, 0, w, h);

    const imgData = oCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    this.particles = [];

    const scale = Math.min((this.canvas.width * 0.7) / w, (this.canvas.height * 0.7) / h);
    const offsetX = (this.canvas.width - w * scale) / 2;
    const offsetY = (this.canvas.height - h * scale) / 2;

    for (let y = 0; y < h; y += this.density) {
      for (let x = 0; x < w; x += this.density) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const brightness = (r + g + b) / 3;
        if (brightness < 128) {
          const tx = x * scale + offsetX;
          const ty = y * scale + offsetY;
          this.particles.push(new Particle(tx, ty, this.palette));
        }
      }
    }

    this.options.onProgress?.(1);
    this.options.onReady?.();
    this.animate();
  }

  private setupCanvas(): void {
    const resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
      this.ctx.scale(dpr, dpr);
      // Reset the scaled coordinates so subsequent draws use CSS pixels
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
    };
    resize();
    window.addEventListener('resize', resize);
  }

  private attachListeners(): void {
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    this.canvas.addEventListener('touchend', this.handleMouseLeave);
  }

  private detachListeners(): void {
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleMouseLeave);
  }

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
    this.mouse.active = true;
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 0) return;
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.touches[0].clientX - rect.left;
    this.mouse.y = e.touches[0].clientY - rect.top;
    this.mouse.active = true;
  };

  private handleMouseLeave = () => {
    this.mouse.x = null;
    this.mouse.y = null;
    this.mouse.active = false;
  };

  private updateTargets(): void {
    const n = this.particles.length;
    if (n === 0) return;

    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    if (this.mode === 'logo') {
      for (const p of this.particles) {
        p.targetX = p.logoX;
        p.targetY = p.logoY;
        p.stiffness = 0.08 + Math.random() * 0.04;
      }
    } else if (this.mode === 'circular') {
      this.particles.forEach((p, idx) => {
        const ringIndex = idx % 3;
        const angle = (idx / n) * Math.PI * 2 * 3;
        const radius = 90 + ringIndex * 12 + Math.sin(idx * 0.05) * 4;
        p.targetX = cx + Math.cos(angle) * radius;
        p.targetY = cy + Math.sin(angle) * radius;
        p.stiffness = 0.03 + Math.random() * 0.02;
      });
    } else if (this.mode === 'linear') {
      const barWidth = Math.min(this.canvas.width * 0.75, 500);
      const barHeight = 24;
      const startX = cx - barWidth / 2;
      const startY = cy - barHeight / 2;
      const cols = Math.floor(Math.sqrt(n * (barWidth / barHeight)));
      const rows = Math.ceil(n / cols);

      this.particles.forEach((p, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        p.targetX = startX + (col / cols) * barWidth;
        p.targetY = startY + (row / rows) * barHeight;
        p.stiffness = 0.05 + Math.random() * 0.03;
      });
    }
  }

  private animate = (): void => {
    // Translucent clear for motion blur trail
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    // Continuous motion for loader modes
    if (this.mode === 'circular') {
      const time = Date.now() * 0.002;
      this.particles.forEach((p, idx) => {
        const ringIndex = idx % 3;
        const baseAngle = (idx / this.particles.length) * Math.PI * 2 * 3;
        const rotationSpeed = ringIndex % 2 === 0 ? time : -time * 0.8;
        const angle = baseAngle + rotationSpeed;
        const radius = 90 + ringIndex * 10 + Math.sin(idx * 0.05 + time) * 3;
        p.targetX = cx + Math.cos(angle) * radius;
        p.targetY = cy + Math.sin(angle) * radius;
      });
    } else if (this.mode === 'linear') {
      this.progressValue += 0.5;
      if (this.progressValue > 100) this.progressValue = -20;

      const barWidth = Math.min(this.canvas.width * 0.75, 500);
      const startX = cx - barWidth / 2;
      const progressX = startX + (this.progressValue / 100) * barWidth;

      this.particles.forEach((p) => {
        const distance = Math.abs(p.targetX - progressX);
        if (distance < 45) {
          const wave = (45 - distance) / 45;
          p.targetY = cy - 12 - Math.sin(p.targetX * 0.05 + Date.now() * 0.01) * 12 * wave;
          p.color[0] += (110 - p.color[0]) * 0.3;
          p.color[1] += (193 - p.color[1]) * 0.3;
          p.color[2] += (228 - p.color[2]) * 0.3;
        } else {
          p.targetY += (cy - p.targetY) * 0.05;
          for (let i = 0; i < 3; i++) {
            p.color[i] += (p.baseColor[i] - p.color[i]) * 0.05;
          }
        }
      });
    }

    // Update + draw
    for (const p of this.particles) {
      p.update(this.mouse);
      p.draw(this.ctx);
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };
}
