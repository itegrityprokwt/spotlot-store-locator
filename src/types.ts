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
  hasValidCoords: boolean;
  isOpen: boolean;
  category: CategoryId;
}

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface BranchApiItem {
  branch_cd: number;
  company_cd: number;
  branch_id: string;
  branch_name: string;
  branch_display_name: string;
  branch_type_cd: number;
  country_cd: number;
  state_cd: number;
  city: string;
  address: string;
  phone_no: string;
  email: string;
  latitude: string | number | null;
  longitude: string | number | null;
  delivery_fulfillment: boolean;
}

export interface BranchApiResponse {
  result: {
    rstatus: boolean;
    rdescription: string;
  };
  output: BranchApiItem[];
}
