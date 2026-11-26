export type CategoryId = 'grocery' | 'department' | 'fruits';

export type LayoutMode = 'split' | 'list' | 'map';

export interface Store {
  id: string;
  name: string;
  company: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  isOpen: boolean;
  category: CategoryId;
}

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}
