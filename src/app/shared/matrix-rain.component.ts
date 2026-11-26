import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';

interface RainColumn {
  x: number;
  y: number;
  speed: number;
  band: 0 | 1 | 2;
}

@Component({
  selector: 'app-matrix-rain',
  standalone: true,
  template: `<canvas #rainCanvas class="matrix-rain-canvas" aria-hidden="true"></canvas>`,
  styles: [`
    .matrix-rain-canvas {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: 0;
      pointer-events: none;
      opacity: 0.35;
      display: block;
    }
  `]
})
export class MatrixRainComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('rainCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  /** IDs de los brokers Kafka actualmente ONLINE (ej. [1, 2, 3]). */
  @Input() activeBrokerIds: number[] = [1, 2, 3];

  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private mediaQuery: MediaQueryList | null = null;
  private reducedMotion = false;

  private width = 0;
  private height = 0;
  private readonly fontSize = 16;
  private columns: RainColumn[] = [];

  // Acumulador de delta-time para limitar a ~24 FPS
  private lastTimestamp = 0;
  private accumulator = 0;
  private readonly frameIntervalMs = 1000 / 24;

  // Interpolación suave (~400ms) por banda: 0 = verde (#00FF41), 1 = rojo (#FF1744)
  private bandRedFactor: [number, number, number] = [0, 0, 0];
  private bandTargetRed: [number, number, number] = [0, 0, 0];

  private readonly glyphs =
    'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>/:;+*=';

  private readonly onResizeBound = () => this.scheduleResize();
  private readonly onMotionChangeBound = (e: MediaQueryListEvent) => {
    this.reducedMotion = e.matches;
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeBrokerIds']) {
      this.syncBandTargets();
    }
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.mediaQuery.matches;
    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener('change', this.onMotionChangeBound);
    }

    this.syncBandTargets();
    this.bandRedFactor = [...this.bandTargetRed] as [number, number, number];

    this.resizeCanvas();
    window.addEventListener('resize', this.onResizeBound, { passive: true });

    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame((ts) => this.loop(ts));
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResizeBound);
    }
    if (this.mediaQuery && this.mediaQuery.removeEventListener) {
      this.mediaQuery.removeEventListener('change', this.onMotionChangeBound);
    }
  }

  private syncBandTargets(): void {
    const active = new Set(this.activeBrokerIds ?? [1, 2, 3]);
    this.bandTargetRed = [
      active.has(1) ? 0 : 1,
      active.has(2) ? 0 : 1,
      active.has(3) ? 0 : 1
    ];
  }

  private scheduleResize(): void {
    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer);
    }
    this.resizeTimer = setTimeout(() => {
      this.resizeCanvas();
    }, 150);
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    canvas.width = this.width;
    canvas.height = this.height;

    const colCount = Math.max(12, Math.floor(this.width / this.fontSize));
    const bandWidth = Math.max(1, this.width / 3);

    this.columns = Array.from({ length: colCount }, (_, idx) => {
      const x = idx * this.fontSize;
      const band = Math.min(2, Math.floor(x / bandWidth)) as 0 | 1 | 2;
      return {
        x,
        y: Math.random() * (this.height / this.fontSize),
        speed: 0.65 + Math.random() * 0.75,
        band
      };
    });

    if (this.ctx) {
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  private loop(timestamp: number): void {
    const delta = Math.min(100, Math.max(0, timestamp - this.lastTimestamp));
    this.lastTimestamp = timestamp;
    this.accumulator += delta;

    // Interpolar suavemente el color de cada banda (~400ms)
    const step = delta / 400;
    for (let i = 0; i < 3; i++) {
      const target = this.bandTargetRed[i];
      const current = this.bandRedFactor[i];
      if (current < target) {
        this.bandRedFactor[i] = Math.min(target, current + step);
      } else if (current > target) {
        this.bandRedFactor[i] = Math.max(target, current - step);
      }
    }

    if (this.accumulator >= this.frameIntervalMs) {
      this.accumulator %= this.frameIntervalMs;
      this.drawFrame();
    }

    this.rafId = requestAnimationFrame((ts) => this.loop(ts));
  }

  private drawFrame(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    // Estela oscura semi-transparente
    ctx.fillStyle = this.reducedMotion ? 'rgba(0, 0, 0, 0.14)' : 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.font = `${this.fontSize}px "Share Tech Mono", "JetBrains Mono", monospace`;

    const speedMultiplier = this.reducedMotion ? 0.15 : 1;

    for (let i = 0; i < this.columns.length; i++) {
      const col = this.columns[i];
      const redT = this.bandRedFactor[col.band];

      // Interpolación lineal RGB: #00FF41 (0,255,65) -> #FF1744 (255,23,68)
      const r = Math.round(0 + (255 - 0) * redT);
      const g = Math.round(255 + (23 - 255) * redT);
      const b = Math.round(65 + (68 - 65) * redT);

      const char = this.glyphs.charAt(Math.floor(Math.random() * this.glyphs.length));
      const py = col.y * this.fontSize;

      // Leve destello/glitch en bandas caídas (desactivado con prefers-reduced-motion)
      const isGlitch = !this.reducedMotion && redT > 0.5 && Math.random() > 0.92;
      if (isGlitch) {
        ctx.fillStyle = '#FF8A9E';
        ctx.fillText(char, col.x + (Math.random() > 0.5 ? 2 : -2), py);
      } else {
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillText(char, col.x, py);
      }

      col.y += col.speed * speedMultiplier;

      if (py > this.height && Math.random() > 0.975) {
        col.y = 0;
      }
    }
  }
}
