import type { BranchApiResponse, Store } from '../types';

export const DEFAULT_MAP_CENTER: [number, number] = [47.897934, 29.26304];
export const DEFAULT_MAP_ZOOM = 12;

const BRANCHES_ENDPOINT = '/api/Branch/get_branches_delivery_fullfillment';

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export async function fetchBranches(signal?: AbortSignal): Promise<Store[]> {
  const response = await fetch(BRANCHES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: { lang: 'en', company: '69' },
      input: {},
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }

  const data = (await response.json()) as BranchApiResponse;

  if (!data?.result?.rstatus || !Array.isArray(data.output)) {
    throw new Error(data?.result?.rdescription || 'Invalid API response');
  }

  return data.output.map((item) => {
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    const hasValidCoords = isValidLatLng(lat, lng);

    return {
      id: String(item.branch_cd ?? item.branch_id),
      name: (item.branch_display_name || item.branch_name || 'Unnamed Store').trim(),
      company: String(item.company_cd ?? ''),
      city: (item.city || '').trim(),
      address: (item.address || '').trim(),
      lat: hasValidCoords ? lat : 0,
      lng: hasValidCoords ? lng : 0,
      hasValidCoords,
      isOpen: Boolean(item.delivery_fulfillment),
      category: 'grocery',
    };
  });
}
