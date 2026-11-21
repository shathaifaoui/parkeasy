import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { shareReplay } from 'rxjs';
import {
  AdminParking,
  AdminStats,
  AdminUser,
  Amenity,
  ContactMessage,
  ContactRequest,
  ManagedParking,
  ManagerDashboard,
  Notification,
  ParkingCard,
  ParkingDetail,
  Paged,
  Reservation,
  Slot,
  SpaceAvailability,
  User,
  Vehicle,
  Zone,
} from './models';

type Params = Record<string, string | number | boolean | null | undefined>;

/** Accès centralisé à l'API REST (/api est redirigé vers le backend par proxy.conf.json) */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  private params(p: Params = {}) {
    let hp = new HttpParams();
    Object.entries(p).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') hp = hp.set(k, String(v));
    });
    return hp;
  }

  // ---- Référentiels (mis en cache) ----
  readonly zones$ = this.http.get<Zone[]>('/api/zones').pipe(shareReplay(1));
  readonly amenities$ = this.http.get<Amenity[]>('/api/amenities').pipe(shareReplay(1));
  stats() {
    return this.http.get<{
      parkings: number;
      spaces: number;
      satisfaction: number | null;
      reservations: number;
    }>('/api/stats');
  }

  // ---- Aide & contact ----
  sendContact(body: ContactRequest) {
    return this.http.post<{ id: number; message: string }>('/api/contact', body);
  }

  // ---- Parkings ----
  search(p: Params) {
    return this.http.get<{ slot: Slot; results: ParkingCard[] }>('/api/parkings', {
      params: this.params(p),
    });
  }
  parking(id: number, slot?: Partial<Slot>) {
    return this.http.get<ParkingDetail>(`/api/parkings/${id}`, { params: this.params(slot) });
  }
  spaces(id: number, slot: Slot) {
    return this.http.get<SpaceAvailability[]>(`/api/parkings/${id}/spaces`, {
      params: this.params({ ...slot }),
    });
  }

  // ---- Automobiliste ----
  vehicles() {
    return this.http.get<Vehicle[]>('/api/vehicles');
  }
  addVehicle(body: { plate: string; brand?: string; model?: string }) {
    return this.http.post<Vehicle>('/api/vehicles', body);
  }
  deleteVehicle(id: number) {
    return this.http.delete<{ message: string }>(`/api/vehicles/${id}`);
  }
  reserve(body: { space_id: number; vehicle_id: number; start: string; end: string }) {
    return this.http.post<Reservation>('/api/reservations', body);
  }
  myReservations(tab: string) {
    return this.http.get<{ counts: Record<string, number>; results: Reservation[] }>(
      '/api/reservations/me',
      { params: { tab } },
    );
  }
  reservation(id: number) {
    return this.http.get<Reservation>(`/api/reservations/${id}`);
  }
  cancel(id: number) {
    return this.http.post<{ message: string }>(`/api/reservations/${id}/cancel`, {});
  }
  review(id: number, body: { rating: number; comment: string }) {
    return this.http.post<{ message: string }>(`/api/reservations/${id}/review`, body);
  }
  favorites() {
    return this.http.get<ParkingCard[]>('/api/favorites');
  }
  setFavorite(parkingId: number, on: boolean) {
    return on
      ? this.http.post<{ is_favorite: boolean }>(`/api/favorites/${parkingId}`, {})
      : this.http.delete<{ is_favorite: boolean }>(`/api/favorites/${parkingId}`);
  }
  notifications() {
    return this.http.get<{ count: number; items: Notification[] }>('/api/notifications');
  }
  updateMe(body: { first_name: string; last_name: string; phone: string }) {
    return this.http.put<User>('/api/auth/me', body);
  }
  changePassword(body: { current: string; password: string }) {
    return this.http.put<{ message: string }>('/api/auth/password', body);
  }

  // ---- Gestionnaire ----
  dashboard(period: string) {
    return this.http.get<ManagerDashboard>('/api/manager/dashboard', { params: { period } });
  }
  myParkings() {
    return this.http.get<
      {
        id: number;
        name: string;
        status: string;
        hourly_rate: number;
        zone: string;
        total_spaces: number;
      }[]
    >('/api/manager/parkings');
  }
  managedParking(id: number) {
    return this.http.get<ManagedParking>(`/api/manager/parkings/${id}`);
  }
  createParking(body: Record<string, unknown>) {
    return this.http.post<{ id: number; message: string }>('/api/manager/parkings', body);
  }
  updateParking(id: number, body: Record<string, unknown>) {
    return this.http.put<{ message: string }>(`/api/manager/parkings/${id}`, body);
  }
  addSpaces(id: number, body: { level: string; count: number; type: string }) {
    return this.http.post<{ message: string }>(`/api/manager/parkings/${id}/spaces`, body);
  }
  setSpaceState(id: number, state: 'in_service' | 'out_of_service') {
    return this.http.patch<{ message: string; upcoming: number }>(`/api/manager/spaces/${id}`, {
      state,
    });
  }
  addPhoto(id: number, url: string) {
    return this.http.post<{ message: string }>(`/api/manager/parkings/${id}/photos`, { url });
  }
  deletePhoto(id: number) {
    return this.http.delete<{ message: string }>(`/api/manager/photos/${id}`);
  }
  managerReservations(p: Params) {
    return this.http.get<Paged<Reservation>>('/api/manager/reservations', {
      params: this.params(p),
    });
  }
  setReservationStatus(id: number, status: 'confirmed' | 'cancelled') {
    return this.http.patch<{ message: string }>(`/api/manager/reservations/${id}`, { status });
  }

  // ---- Administration ----
  adminStats() {
    return this.http.get<AdminStats>('/api/admin/stats');
  }
  adminParkings(status: string) {
    return this.http.get<AdminParking[]>('/api/admin/parkings', { params: { status } });
  }
  setParkingStatus(id: number, status: 'active' | 'suspended') {
    return this.http.patch<{ message: string }>(`/api/admin/parkings/${id}`, { status });
  }
  adminMessages(status: 'new' | 'done' | 'all') {
    return this.http.get<ContactMessage[]>('/api/admin/messages', {
      params: this.params({ status }),
    });
  }
  setMessageStatus(id: number, status: 'new' | 'done') {
    return this.http.patch<{ id: number; status: string }>(`/api/admin/messages/${id}`, { status });
  }
  adminUsers(p: Params) {
    return this.http.get<AdminUser[]>('/api/admin/users', { params: this.params(p) });
  }
  setUserStatus(id: number, status: 'active' | 'suspended') {
    return this.http.patch<{ message: string }>(`/api/admin/users/${id}`, { status });
  }
}
