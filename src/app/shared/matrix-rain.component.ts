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
} from '@angular/core';

interface RainColumn {
  x: number;
  y: number;
  speed: number;
  band: 0 | 1 | 2;
  chars: string[];
}

interface BandColorState {
  redMix: number;
  targetRedMix: number;
  glitchUntil: number;
}

@Component({
  selector: 'app-matrix-rain',
  standalone: true,
  template: `
    <canvas
      #rainCanvas
      class="matrix-rain-canvas"
      aria-hidden="true"
    ></canvas>
  `,
  styles: [
    `
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
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrixRainComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() activeBrokerIds: number[] = [1, 2, 3];
  @ViewChild('rainCanvas', { static: true })
  private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  private rafId: number | null = null;
  private resizeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private mediaQuery: MediaQueryList | null = null;
  private reducedMotion = false;

  private columns: RainColumn[] = [];
  private width = 1;
  private height = 1;
  private lastTimestamp = 0;
  private accumulator = 0;

  private readonly fontSize = 16;
  private readonly frameIntervalMs = 1000 / 24; // ~24 FPS delta-time cap
  private readonly transitionDurationMs = 400;
  private readonly glyphs =
    'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>/{}[]#$%*+-=';

  private readonly bandStates: [BandColorState, BandColorState, BandColorState] = [
    { redMix: 0, targetRedMix: 0, glitchUntil: 0 },
    { redMix: 0, targetRedMix: 0, glitchUntil: 0 },
    { redMix: 0, targetRedMix: 0, glitchUntil: 0 },
  ];

  private readonly boundResize = () => this.onWindowResize();
  private readonly boundMotionChange = (e: MediaQueryListEvent) => {
    this.reducedMotion = e.matches;
    if (this.reducedMotion) {
      this.bandStates.forEach((b) => (b.glitchUntil = 0));
    }
  };

  constructor(private readonly ngZone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeBrokerIds']) {
      this.syncBrokerBands();
    }
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.mediaQuery.matches;
    this.mediaQuery.addEventListener('change', this.boundMotionChange);

    this.syncBrokerBands();
    this.rebuildCanvasAndColumns();

    window.addEventListener('resize', this.boundResize, { passive: true });

    // Run animation outside Angular zone so ~24 FPS never triggers ChangeDetection
    this.ngZone.runOutsideAngular(() => {
      this.lastTimestamp = performance.now();
      const loop = (now: number) => {
        const delta = Math.min(now - this.lastTimestamp, 250);
        this.lastTimestamp = now;
        this.accumulator += delta;

        if (this.accumulator >= this.frameIntervalMs) {
          const stepMs = this.accumulator;
          this.accumulator %= this.frameIntervalMs;
          this.renderFrame(stepMs, now);
        }
        this.rafId = window.requestAnimationFrame(loop);
      };
      this.rafId = window.requestAnimationFrame(loop);
    });
  }

  ngOnDestroy(): void {
    if (this.rafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.resizeTimeoutId !== null) {
      clearTimeout(this.resizeTimeoutId);
      this.resizeTimeoutId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.boundResize);
    }
    this.mediaQuery?.removeEventListener('change', this.boundMotionChange);
  }

  private syncBrokerBands(): void {
    const activeSet = new Set(this.activeBrokerIds ?? []);
    const now = typeof performance !== 'undefined' ? performance.now() : 0;

    ([1, 2, 3] as const).forEach((brokerId, idx) => {
      const isOnline = activeSet.has(brokerId);
      const nextTarget = isOnline ? 0 : 1;
      const state = this.bandStates[idx];

      if (state.targetRedMix !== nextTarget) {
        state.targetRedMix = nextTarget;
        state.glitchUntil = !isOnline && !this.reducedMotion ? now + 500 : 0;
      }
    });
  }

  private onWindowResize(): void {
    if (this.resizeTimeoutId !== null) {
      clearTimeout(this.resizeTimeoutId);
    }
    this.resizeTimeoutId = setTimeout(() => {
      this.rebuildCanvasAndColumns();
    }, 150);
  }

  private rebuildCanvasAndColumns(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(window.innerWidth, 1);
    this.height = Math.max(window.innerHeight, 1);

    canvas.width = Math.floor(this.width * dpr);
    canvas.height = Math.floor(this.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.width, this.height);

    const colCount = Math.max(3, Math.floor(this.width / this.fontSize));
    const anchoBanda = this.width / 3;
    const nextCols: RainColumn[] = [];

    for (let i = 0; i < colCount; i++) {
      const x = i * this.fontSize;
      const banda = Math.min(2, Math.max(0, Math.floor(x / anchoBanda))) as 0 | 1 | 2;
      const prev = this.columns[i];
      nextCols.push({
        x,
        y: prev ? prev.y : Math.random() * this.height * -1,
        speed: 0.75 + ((i * 13) % 9) * 0.06,
        band: banda,
        chars: Array.from({ length: 12 }, () => this.randomGlyph()),
      });
    }
    this.columns = nextCols;
  }

  private renderFrame(stepMs: number, now: number): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const transitionStep = stepMs / this.transitionDurationMs;
    for (let b = 0; b < 3; b++) {
      const state = this.bandStates[b];
      if (state.redMix < state.targetRedMix) {
        state.redMix = Math.min(1, state.redMix + transitionStep * 1.4);
      } else if (state.redMix > state.targetRedMix) {
        state.redMix = Math.max(0, state.redMix - transitionStep);
      }
    }

    ctx.fillStyle = this.reducedMotion ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.11)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.font = `${this.fontSize - 1}px "Share Tech Mono", "JetBrains Mono", monospace`;
    ctx.textBaseline = 'top';

    const bandWidth = this.width / 3;
    if (!this.reducedMotion) {
      for (let b = 0; b < 3; b++) {
        if (now < this.bandStates[b].glitchUntil) {
          ctx.fillStyle = 'rgba(255, 23, 68, 0.08)';
          ctx.fillRect(b * bandWidth, Math.random() * this.height, bandWidth, 28);
        }
      }
    }

    const speedFactor = this.reducedMotion ? 0.14 : 1;

    for (let i = 0; i < this.columns.length; i++) {
      const col = this.columns[i];
      const state = this.bandStates[col.band];
      const isGlitching = !this.reducedMotion && now < state.glitchUntil;
      const jitterX = isGlitching ? (Math.random() - 0.5) * 4 : 0;
      const glyph = this.randomGlyph();

      ctx.fillStyle = this.mixColor(215, 255, 224, 255, 212, 220, state.redMix, 0.94);
      ctx.fillText(glyph, col.x + jitterX, col.y);

      // #00FF41 (0,255,65) <-> #FF1744 (255,23,68)
      ctx.fillStyle = this.mixColor(0, 255, 65, 255, 23, 68, state.redMix, 0.88);
      ctx.fillText(col.chars[i % col.chars.length], col.x, col.y - this.fontSize);

      col.y += this.fontSize * col.speed * speedFactor;
      if (col.y > this.height && Math.random() > 0.965) {
        col.y = -this.fontSize * (1 + Math.random() * 6);
      }
    }
  }

  private mixColor(
    r1: number,
    g1: number,
    b1: number,
    r2: number,
    g2: number,
    b2: number,
    t: number,
    alpha: number,
  ): string {
    const k = Math.max(0, Math.min(1, t));
    const r = Math.round(r1 + (r2 - r1) * k);
    const g = Math.round(g1 + (g2 - g1) * k);
    const b = Math.round(b1 + (b2 - b1) * k);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private randomGlyph(): string {
    return this.glyphs[Math.floor(Math.random() * this.glyphs.length)];
  }
}
