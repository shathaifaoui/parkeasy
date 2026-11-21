import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, output, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { ParkingCard } from '../core/models';

/** Carte interactive (Leaflet + OpenStreetMap) : un repère par parking, avec son tarif */
@Component({
  selector: 'app-parking-map',
  template: `<div #map class="map" role="region" aria-label="Carte des parkings"></div>`,
  styles: `:host { display:block; height:100%; } .map { height:100%; min-height:240px; border-radius:14px; z-index:0; }`,
})
export class ParkingMap implements OnDestroy {
  parkings = input<ParkingCard[]>([]);
  highlighted = input<number | null>(null);
  /** Position de l'utilisateur (« autour de moi ») */
  position = input<[number, number] | null>(null);
  select = output<number>();

  private el = viewChild.required<ElementRef<HTMLDivElement>>('map');
  private map?: L.Map;
  private layer = L.layerGroup();
  private markers = new Map<number, L.Marker>();
  private me?: L.CircleMarker;

  constructor() {
    afterNextRender(() => {
      this.map = L.map(this.el().nativeElement, { zoomControl: true, scrollWheelZoom: false }).setView([36.81, 10.18], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.map);
      this.layer.addTo(this.map);
      this.draw();
      setTimeout(() => this.map?.invalidateSize(), 200);
    });
    effect(() => {
      this.parkings();
      this.position();
      this.draw();
    });
    effect(() => {
      const h = this.highlighted();
      this.markers.forEach((m, id) => m.getElement()?.querySelector('.price-marker')?.classList.toggle('on', id === h));
      if (h !== null) this.markers.get(h)?.setZIndexOffset(1000);
    });
  }

  private draw() {
    if (!this.map) return;
    this.layer.clearLayers();
    this.markers.clear();
    const pts: L.LatLngExpression[] = [];
    for (const p of this.parkings()) {
      if (p.latitude === null || p.longitude === null) continue;
      const full = p.free_spaces === 0 || !p.open_on_slot;
      const icon = L.divIcon({
        className: '',
        iconSize: [0, 0],
        html: `<div class="price-marker${full ? ' full' : ''}" title="${p.name}">${String(p.hourly_rate).replace('.', ',')}</div>`,
      });
      const m = L.marker([p.latitude, p.longitude], { icon, title: p.name, keyboard: true })
        .on('click', () => this.select.emit(p.id))
        .bindTooltip(`${p.name} — ${p.free_spaces} place(s) libre(s)`, { direction: 'top', offset: [0, -14] });
      m.addTo(this.layer);
      this.markers.set(p.id, m);
      pts.push([p.latitude, p.longitude]);
    }
    const pos = this.position();
    if (pos) {
      this.me = L.circleMarker(pos, { radius: 8, color: '#fff', weight: 3, fillColor: '#14A3A0', fillOpacity: 1 }).bindTooltip('Vous êtes ici');
      this.me.addTo(this.layer);
      pts.push(pos);
    }
    if (pts.length === 1) this.map.setView(pts[0], 14);
    else if (pts.length > 1) this.map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 14 });
  }

  ngOnDestroy() {
    this.map?.remove();
  }
}
