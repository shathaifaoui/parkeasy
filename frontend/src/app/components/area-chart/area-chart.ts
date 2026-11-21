import { Component, computed, input, signal } from '@angular/core';

/** Courbe d'occupation (SVG, sans dépendance) : % par heure ou par jour */
@Component({
  selector: 'app-area-chart',
  template: ` <svg
    [attr.viewBox]="'0 0 ' + W + ' ' + H"
    class="chart"
    role="img"
    [attr.aria-label]="ariaLabel()"
    (mouseleave)="hover.set(null)"
  >
    @for (t of [0, 25, 50, 75, 100]; track t) {
      <line [attr.x1]="P" [attr.x2]="W - 8" [attr.y1]="y(t)" [attr.y2]="y(t)" class="grid" />
      <text [attr.x]="P - 8" [attr.y]="y(t) + 4" class="axis" text-anchor="end">{{ t }}%</text>
    }
    <path [attr.d]="area()" class="area" />
    <path [attr.d]="line()" class="line" />
    @for (p of points(); track $index) {
      @if (showLabel($index)) {
        <text [attr.x]="p.x" [attr.y]="H - 6" class="axis" text-anchor="middle">{{ p.label }}</text>
      }
      <rect
        [attr.x]="p.x - step() / 2"
        y="0"
        [attr.width]="step()"
        [attr.height]="H - 24"
        fill="transparent"
        (mouseenter)="hover.set($index)"
      />
    }
    @if (peak(); as k) {
      @if (hover() === null) {
        <circle [attr.cx]="k.x" [attr.cy]="k.y" r="5" class="dot" />
        <g [attr.transform]="'translate(' + k.x + ',' + (k.y - 18) + ')'">
          <rect x="-20" y="-11" width="40" height="20" rx="6" class="tip" />
          <text y="3" text-anchor="middle" class="tip-t">{{ k.value }}%</text>
        </g>
      }
    }
    @if (hover() !== null) {
      @let h = points()[hover()!];
      <line [attr.x1]="h.x" [attr.x2]="h.x" y1="8" [attr.y2]="H - 24" class="cursor" />
      <circle [attr.cx]="h.x" [attr.cy]="h.y" r="5" class="dot" />
      <g [attr.transform]="'translate(' + h.x + ',' + (h.y - 18) + ')'">
        <rect x="-34" y="-11" width="68" height="20" rx="6" class="tip" />
        <text y="3" text-anchor="middle" class="tip-t">{{ h.label }} · {{ h.value }}%</text>
      </g>
    }
  </svg>`,
  styles: `
    .chart {
      width: 100%;
      height: auto;
      display: block;
      font-family: var(--font);
    }
    .grid {
      stroke: #e8edf5;
    }
    .axis {
      fill: #8a97ab;
      font-size: 11px;
    }
    .area {
      fill: rgb(26 111 214 / 12%);
    }
    .line {
      fill: none;
      stroke: var(--blue);
      stroke-width: 2.5;
      stroke-linejoin: round;
    }
    .dot {
      fill: #fff;
      stroke: var(--blue);
      stroke-width: 3;
    }
    .cursor {
      stroke: #b9c7da;
      stroke-dasharray: 3 3;
    }
    .tip {
      fill: var(--blue);
    }
    .tip-t {
      fill: #fff;
      font-size: 11px;
      font-weight: 700;
    }
  `,
})
export class AreaChart {
  readonly data = input.required<{ label: string; value: number | null }[]>();
  readonly ariaLabel = input("Taux d'occupation");
  protected W = 640;
  protected H = 240;
  protected P = 42;
  protected readonly hover = signal<number | null>(null);

  protected y = (v: number) => 12 + (1 - v / 100) * (this.H - 24 - 12);
  protected readonly step = computed(
    () => (this.W - 8 - this.P) / Math.max(1, this.data().length - 1),
  );
  protected readonly points = computed(() =>
    this.data().map((d, i) => ({
      x: this.P + i * this.step(),
      y: this.y(d.value ?? 0),
      value: d.value ?? 0,
      label: d.label,
    })),
  );
  protected readonly line = computed(() =>
    this.points()
      .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' '),
  );
  protected readonly area = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    const base = this.y(0);
    return `${this.line()} L${pts[pts.length - 1].x} ${base} L${pts[0].x} ${base} Z`;
  });
  protected readonly peak = computed(() =>
    this.points().reduce<null | { x: number; y: number; value: number }>(
      (m, p) => (!m || p.value > m.value ? p : m),
      null,
    ),
  );
  protected showLabel = (i: number) =>
    this.data().length <= 16 || i % Math.ceil(this.data().length / 10) === 0;
}
