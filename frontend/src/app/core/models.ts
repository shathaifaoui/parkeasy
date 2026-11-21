export type Role = 'driver' | 'manager' | 'admin';
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type SpaceType = 'standard' | 'pmr' | 'electric' | 'moto';

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: 'active' | 'suspended';
  created_at: string;
}

export interface Zone {
  id: number;
  name: string;
  city: string;
  parkings: number;
}

export interface Amenity {
  id: number;
  label: string;
  icon: string;
}

export interface Slot {
  start: string;
  end: string;
}

export interface ParkingCard {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  hourly_rate: number;
  open_24h: boolean;
  opening_time: string | null;
  closing_time: string | null;
  status: 'pending' | 'active' | 'suspended';
  zone_id: number;
  zone: string;
  city: string;
  total_spaces: number;
  free_spaces: number;
  estimated_total: number;
  open_on_slot: boolean;
  rating: number | null;
  reviews: number;
  photo: string | null;
  amenities: string[];
  distance?: number | null;
  added_at?: string;
}

export interface ParkingDetail extends ParkingCard {
  description: string | null;
  manager_id: number;
  levels: string[];
  slot: Slot;
  photos: { id: number; url: string; position: number }[];
  amenities_list: Amenity[];
  latest_reviews: {
    id: number;
    rating: number;
    comment: string | null;
    created_at: string;
    first_name: string;
    last_initial: string;
  }[];
  is_favorite: boolean;
}

export interface SpaceAvailability {
  id: number;
  code: string;
  level: string;
  type: SpaceType;
  state: 'in_service' | 'out_of_service';
  availability: 'free' | 'reserved' | 'out_of_service';
}

export interface Vehicle {
  id: number;
  owner_id: number;
  plate: string;
  brand: string | null;
  model: string | null;
  reservations?: number;
}

export interface Reservation {
  id: number;
  reference: string;
  start_at: string;
  end_at: string;
  amount: number;
  status: ReservationStatus;
  created_at: string;
  cancelled_at: string | null;
  space_id: number;
  space_code: string;
  level: string;
  space_type: SpaceType;
  parking_id: number;
  parking: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  vehicle_id: number;
  plate: string;
  brand: string | null;
  model: string | null;
  driver_id: number;
  first_name: string;
  last_name: string;
  driver_phone: string | null;
  review_rating: number | null;
  review_comment: string | null;
  photo: string | null;
}

export interface Notification {
  type: string;
  text: string;
  link: string;
  date: string;
}

export interface ManagerDashboard {
  kpi: {
    total_spaces: number;
    free_now: number;
    reservations_today: number;
    revenue_today: number;
    pending: number;
    parkings: number;
  };
  period: 'day' | 'week' | 'month';
  occupancy: { label: string; value: number | null }[];
  parkings: { id: number; name: string; status: string; total: number; occupied: number }[];
  latest: Reservation[];
  alert_threshold: number;
}

export interface ManagedSpace {
  id: number;
  parking_id: number;
  code: string;
  level: string;
  type: SpaceType;
  state: 'in_service' | 'out_of_service';
  live_state: 'free' | 'occupied' | 'reserved' | 'out_of_service';
  upcoming: number;
}

export interface ManagedParking {
  id: number;
  name: string;
  address: string;
  zone_id: number;
  zone: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  hourly_rate: number;
  open_24h: boolean;
  opening_time: string | null;
  closing_time: string | null;
  status: 'pending' | 'active' | 'suspended';
  amenity_ids: number[];
  photos: { id: number; url: string; position: number }[];
  spaces: ManagedSpace[];
  levels: string[];
}

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  counts: Record<string, number>;
  results: T[];
}

export interface AdminStats {
  drivers: number;
  managers: number;
  suspended: number;
  parkings_active: number;
  parkings_pending: number;
  spaces: number;
  reservations_30d: number;
  revenue_30d: number;
  rating: number | null;
  messages_new: number;
}

export type ContactTopic = 'reservation' | 'parking' | 'account' | 'other';
export const TOPIC_LABEL: Record<ContactTopic, string> = {
  reservation: 'Une réservation',
  parking: 'Publier ou gérer un parking',
  account: 'Mon compte',
  other: 'Autre question',
};

export interface ContactRequest {
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
}

export interface ContactMessage extends ContactRequest {
  id: number;
  status: 'new' | 'done';
  created_at: string;
  handled_at: string | null;
  author_role: string | null;
}

export interface AdminParking {
  id: number;
  name: string;
  address: string;
  hourly_rate: number;
  open_24h: boolean;
  opening_time: string | null;
  closing_time: string | null;
  status: string;
  created_at: string;
  description: string | null;
  zone: string;
  city: string;
  manager: string;
  manager_email: string;
  spaces: number;
  amenities: string[];
  photo: string | null;
}

export interface AdminUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: 'active' | 'suspended';
  created_at: string;
  reservations: number;
  parkings: number;
}

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

export const SPACE_TYPE_LABEL: Record<SpaceType, string> = {
  standard: 'Standard',
  pmr: 'PMR',
  electric: 'Borne électrique',
  moto: 'Moto',
};

export const ROLE_LABEL: Record<Role, string> = {
  driver: 'Automobiliste',
  manager: 'Gestionnaire',
  admin: 'Administrateur',
};
