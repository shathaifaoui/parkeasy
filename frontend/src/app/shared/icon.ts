import { Component, computed, input } from '@angular/core';

// Icônes linéaires (style de la charte graphique), décrites uniquement par des chemins SVG
const c = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const rect = (x: number, y: number, w: number, h: number, r = 2) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

const ICONS: Record<string, string[]> = {
  search: [c(11, 11, 7), 'M21 21l-5-5'],
  home: ['M3 10.5 12 3l9 7.5', 'M5 9v12h14V9', 'M10 21v-6h4v6'],
  calendar: [rect(3, 5, 18, 16), 'M16 3v4M8 3v4M3 10h18'],
  clock: [c(12, 12, 9), 'M12 7v5l3 2'],
  pin: ['M12 21s-7-6.1-7-11.2A7 7 0 0 1 19 9.8C19 14.9 12 21 12 21z', c(12, 10, 2.5)],
  list: [rect(4, 3, 16, 18), 'M8 8h8M8 12h8M8 16h5'],
  heart: ['M19.5 12.6 12 20l-7.5-7.4A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 7.5 6.2z'],
  user: [c(12, 8, 4), 'M4 21a8 8 0 0 1 16 0'],
  users: [c(9, 8, 3.5), 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.5a3.5 3.5 0 0 1 0 7', 'M18 14a6 6 0 0 1 3.5 6'],
  bell: ['M18 9a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8', 'M13.7 21a2 2 0 0 1-3.4 0'],
  car: ['M5 16V11l2-5h10l2 5v5', 'M3 16h18v3H3z', c(7.5, 19, 1.5), c(16.5, 19, 1.5), 'M5 11h14'],
  shield: ['M12 21s8-3.5 8-9.5V5.5L12 3 4 5.5v6C4 17.5 12 21 12 21z', 'M9 12l2 2 4-4'],
  roof: ['M2 11 12 4l10 7', 'M5 9.5V20h14V9.5'],
  camera: [rect(2, 6, 13, 12), 'M15 10l7-3.5v11L15 14'],
  bolt: ['M13 2 4 14h7l-1 8 9-12h-7z'],
  accessible: [c(12, 4.5, 1.5), 'M8 8.5h8', 'M12 8.5V14h4.5l2 5', 'M9.6 12A5 5 0 1 0 15 19'],
  wash: ['M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11z'],
  elevator: [rect(4, 3, 16, 18), 'M9 10l3-3 3 3M9 14l3 3 3-3'],
  star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'chevron-right': ['M9 6l6 6-6 6'],
  'chevron-left': ['M15 6l-6 6 6 6'],
  'arrow-left': ['M19 12H5M11 18l-6-6 6-6'],
  'arrow-right': ['M5 12h14M13 6l6 6-6 6'],
  plus: ['M12 5v14M5 12h14'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  x: ['M6 6l12 12M18 6 6 18'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  grid: [rect(3, 3, 7, 7, 1.5), rect(14, 3, 7, 7, 1.5), rect(3, 14, 7, 7, 1.5), rect(14, 14, 7, 7, 1.5)],
  tag: ['M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z', c(7.5, 7.5, 1.3)],
  chart: ['M3 3v18h18', 'M7 15l4-4 3 3 6-7'],
  settings: [c(12, 12, 3), 'M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1'],
  navigation: ['M3 11l19-9-9 19-2-8z'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  trash: ['M4 7h16', 'M10 11v6M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  filter: ['M4 5h16l-6 7.5V19l-4 2v-8.5z'],
  map: ['M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z', 'M9 4v13.5M15 6.5V20'],
  building: [rect(5, 3, 14, 18, 1.5), 'M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2'],
  layers: ['M12 3 2 8l10 5 10-5z', 'M2 13l10 5 10-5'],
  info: [c(12, 12, 9), 'M12 11v6M12 7.5v.5'],
  alert: ['M12 3 2 20h20z', 'M12 10v4M12 17v.5'],
  ban: [c(12, 12, 9), 'M5.6 5.6l12.8 12.8'],
  refresh: ['M20 11a8 8 0 0 0-14.8-4M4 4v4h4', 'M4 13a8 8 0 0 0 14.8 4M20 20v-4h-4'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', c(12, 12, 3)],
  moto: [c(5.5, 16.5, 3), c(18.5, 16.5, 3), 'M5.5 16.5 9 10h5l4.5 6.5', 'M14 10l-1.5-3H10'],
  image: [rect(3, 4, 18, 16), c(9, 10, 1.8), 'M21 16l-5-5-9 9'],
  wallet: [rect(3, 6, 18, 14), 'M3 10h18', 'M16 15h2'],
  parking: [rect(3, 3, 18, 18, 4), 'M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5'],
  locate: [c(12, 12, 3), c(12, 12, 8), 'M12 2v2M12 20v2M2 12h2M20 12h2'],
};

/** <app-icon name="search" [size]="18" /> */
@Component({
  selector: 'app-icon',
  template: `<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      [attr.stroke-width]="stroke()" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @for (d of paths(); track $index) { <path [attr.d]="d" [attr.fill]="filled() ? 'currentColor' : 'none'" /> }
    </svg>`,
  styles: `:host { display:inline-flex; flex-shrink:0; line-height:0; }`,
})
export class Icon {
  name = input.required<string>();
  size = input(18);
  stroke = input(1.8);
  filled = input(false);
  paths = computed(() => ICONS[this.name()] ?? ICONS['info']);
}

/** Icône d'un équipement à partir de son code (table amenities.icon) ou de son libellé */
export function amenityIcon(key: string): string {
  const k = key.toLowerCase();
  if (k.includes('shield') || k.includes('sécurité')) return 'shield';
  if (k.includes('roof') || k.includes('couvert')) return 'roof';
  if (k.includes('camera') || k.includes('vidéo')) return 'camera';
  if (k.includes('bolt') || k.includes('borne')) return 'bolt';
  if (k.includes('access') || k.includes('pmr')) return 'accessible';
  if (k.includes('wash') || k.includes('lavage')) return 'wash';
  if (k.includes('elevator') || k.includes('ascenseur')) return 'elevator';
  return 'check';
}
