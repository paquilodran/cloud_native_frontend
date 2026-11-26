import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';

const MATRIX_GLYPHS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789$+-*/=%"\'#&_(),.;:?!\\|{}<>[]^~';

const FONT_SIZE = 16;
const TARGET_FPS = 24;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const REDUCED_FRAME_INTERVAL_MS = 1000 / 5;
const COLOR_TRANSITION_MS = 400;

@Component({
  selector: 'app-matrix-rain',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #rainCanvas class="matrix-rain-canvas" aria-hidden="true"></canvas>`,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        display: block;
        overflow: hidden;
      }
      .matrix-rain-canvas {
        display: block;
        width: 100%;
        height: 100%;
        opacity: 0.36;
      }
    `
  ]
})
export class MatrixRainComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() activeBrokerIds: number[] = [1, 2, 3];
  @ViewChild('rainCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly ngZone = inject(NgZone);

  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private width = 0;
  private height = 0;
  private drops: number[] = [];
  private speeds: number[] = [];

  // Estado visual por banda (0->Broker 1, 1->Broker 2, 2->Broker 3): 0 = verde, 1 = rojo
  private bandTargetRed = [0, 0, 0];
  private bandCurrentRed = [0, 0, 0];
  private bandGlitch = [0, 0, 0];

  private reducedMotion = false;
  private mediaQuery: MediaQueryList | null = null;
  private lastTimestamp = 0;
  private accumulator = 0;

  private readonly onResize = (): void => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.setupCanvas(), 150);
  };

  private readonly onMotionChange = (e: MediaQueryListEvent): void => {
    this.reducedMotion = e.matches;
    if (this.reducedMotion) {
      this.bandGlitch = [0, 0, 0];
    }
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeBrokerIds']) {
      this.syncBandTargets();
    }
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.mediaQuery.matches;
    this.mediaQuery.addEventListener?.('change', this.onMotionChange);

    this.syncBandTargets(true);
    this.ctx = this.canvasRef.nativeElement.getContext('2d');
    this.setupCanvas();

    window.addEventListener('resize', this.onResize, { passive: true });

    this.ngZone.runOutsideAngular(() => {
      this.lastTimestamp = performance.now();
      this.rafId = requestAnimationFrame(this.loop);
    });
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
      this.mediaQuery?.removeEventListener?.('change', this.onMotionChange);
    }
  }

  private syncBandTargets(initial = false): void {
    const active = new Set(this.activeBrokerIds ?? [1, 2, 3]);
    for (let band = 0; band < 3; band++) {
      const brokerId = band + 1;
      const nextTarget = active.has(brokerId) ? 0 : 1;
      if (!initial && nextTarget === 1 && this.bandTargetRed[band] === 0 && !this.reducedMotion) {
        this.bandGlitch[band] = 1;
      }
      this.bandTargetRed[band] = nextTarget;
      if (initial) {
        this.bandCurrentRed[band] = nextTarget;
      }
    }
  }

  private setupCanvas(): void {
    if (typeof window === 'undefined' || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    canvas.width = Math.floor(this.width * dpr);
    canvas.height = Math.floor(this.height * dpr);

    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    const cols = Math.max(1, Math.ceil(this.width / FONT_SIZE));
    const maxRows = Math.max(1, Math.ceil(this.height / FONT_SIZE));
    this.drops = Array.from({ length: cols }, (_, i) =>
      this.drops[i] !== undefined ? Math.min(this.drops[i], maxRows) : Math.random() * maxRows
    );
    this.speeds = Array.from({ length: cols }, (_, i) =>
      this.speeds[i] !== undefined ? this.speeds[i] : 0.65 + Math.random() * 0.7
    );
  }

  private readonly loop = (timestamp: number): void => {
    const delta = Math.min(100, Math.max(0, timestamp - this.lastTimestamp));
    this.lastTimestamp = timestamp;
    this.accumulator += delta;

    // Interpolar colores por banda en ~400ms
    const step = delta / COLOR_TRANSITION_MS;
    for (let b = 0; b < 3; b++) {
      const diff = this.bandTargetRed[b] - this.bandCurrentRed[b];
      if (Math.abs(diff) <= step) {
        this.bandCurrentRed[b] = this.bandTargetRed[b];
      } else {
        this.bandCurrentRed[b] += Math.sign(diff) * step;
      }
      if (this.bandGlitch[b] > 0) {
        this.bandGlitch[b] = Math.max(0, this.bandGlitch[b] - delta / 360);
      }
    }

    const interval = this.reducedMotion ? REDUCED_FRAME_INTERVAL_MS : FRAME_INTERVAL_MS;
    if (this.accumulator >= interval) {
      this.accumulator %= interval;
      this.drawFrame();
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private drawFrame(): void {
    const ctx = this.ctx;
    if (!ctx || this.width === 0 || this.height === 0) return;

    // Estela oscura semi-transparente
    ctx.fillStyle = this.reducedMotion ? 'rgba(0, 0, 0, 0.14)' : 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.font = `${FONT_SIZE}px "Share Tech Mono", "JetBrains Mono", monospace`;
    ctx.textBaseline = 'top';

    const bandWidth = this.width / 3;

    for (let i = 0; i < this.drops.length; i++) {
      const x = i * FONT_SIZE;
      const band = Math.min(2, Math.floor(x / bandWidth));
      const redness = this.bandCurrentRed[band];
      const glitch = this.reducedMotion ? 0 : this.bandGlitch[band];

      const y = this.drops[i] * FONT_SIZE;
      const char = MATRIX_GLYPHS.charAt(Math.floor(Math.random() * MATRIX_GLYPHS.length));

      // Interpolación lineal #00FF41 (0,255,65) -> #FF1744 (255,23,68)
      const r = Math.round(0 + (255 - 0) * redness);
      const g = Math.round(255 + (23 - 255) * redness);
      const b = Math.round(65 + (68 - 65) * redness);

      const xOffset = glitch > 0 && Math.random() < 0.35 ? (Math.random() - 0.5) * 6 * glitch : 0;

      // Carácter líder más brillante
      const isHeadBright = Math.random() > 0.72 || glitch > 0.25;
      if (isHeadBright) {
        const hr = Math.min(255, r + 150);
        const hg = Math.min(255, g + 150);
        const hb = Math.min(255, b + 150);
        ctx.fillStyle = `rgb(${hr}, ${hg}, ${hb})`;
      } else {
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      }

      ctx.fillText(char, x + xOffset, y);

      // Avanzar gota
      const speedFactor = this.reducedMotion ? 0.25 : this.speeds[i];
      this.drops[i] += speedFactor;

      if (y > this.height && Math.random() > 0.975) {
        this.drops[i] = 0;
      }
    }
  }
}
