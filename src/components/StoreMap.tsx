import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  AttributionControl,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ShoppingCart,
  Store as StoreIcon,
  Apple,
  Layers,
  Crosshair,
  Plus,
  Minus,
} from 'lucide-react';
import type { CategoryId, LayoutMode, Store, UserLocation } from '../types';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../data/stores';

const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const FALLBACK_VECTOR_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-raster-layer',
      type: 'raster',
      source: 'osm-raster',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'google-satellite': {
      type: 'raster',
      tiles: ['https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'google-satellite-layer',
      type: 'raster',
      source: 'google-satellite',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'grocery', label: 'Grocery' },
  { id: 'department', label: 'Department Store' },
  { id: 'fruits', label: 'Fruits' },
];

function hideThirdPartyPoiLayers(map: MapLibreMap) {
  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    const idLower = layer.id.toLowerCase();
    const layout = layer.layout as Record<string, unknown> | undefined;
    const hasIconImage = layer.type === 'symbol' && Boolean(layout?.['icon-image']);
    const isPoiLayerId =
      idLower.includes('poi') ||
      idLower.includes('airport') ||
      idLower.includes('aerodrome') ||
      idLower.includes('transit') ||
      idLower.includes('rail');

    if (hasIconImage || isPoiLayerId) {
      if (map.getLayer(layer.id)) {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
      }
    }
  }
}

function createPinSvg(isSelected: boolean): string {
  const fill = isSelected ? '#1A73E8' : '#EA4335';
  const width = isSelected ? 40 : 34;
  const height = isSelected ? 50 : 42;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 36 45" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.32));">
      <path d="M18 1.5C8.887 1.5 1.5 8.887 1.5 18C1.5 29.8 16.25 42.3 17.15 43.05C17.64 43.46 18.36 43.46 18.85 43.05C19.75 42.3 34.5 29.8 34.5 18C34.5 8.887 27.113 1.5 18 1.5Z" fill="${fill}" stroke="#FFFFFF" stroke-width="2.5"/>
      <g transform="translate(9.5, 9.5) scale(0.71)">
        <circle cx="9" cy="21" r="1.5" fill="#FFFFFF"/>
        <circle cx="20" cy="21" r="1.5" fill="#FFFFFF"/>
        <path d="M1.5 2.5H5L7.68 14.39C7.77 14.85 8.02 15.26 8.39 15.56C8.75 15.85 9.21 16.01 9.68 16H19.4C19.87 16.01 20.33 15.85 20.69 15.56C21.06 15.26 21.31 14.85 21.4 14.39L23 6.5H6" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </svg>
  `;
}

interface StoreMapProps {
  activeCategory: CategoryId;
  onCategoryChange: (category: CategoryId) => void;
  stores: Store[];
  selectedStoreId: string | null;
  onSelectStore: (store: Store) => void;
  layoutMode: LayoutMode;
  flyToTrigger: { store: Store; seq: number } | null;
}

export function StoreMap({
  activeCategory,
  onCategoryChange,
  stores,
  selectedStoreId,
  onSelectStore,
  layoutMode,
  flyToTrigger,
}: StoreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const storeMarkersRef = useRef<Map<string, { marker: Marker; el: HTMLButtonElement }>>(
    new Map()
  );
  const userMarkerRef = useRef<Marker | null>(null);
  const onSelectStoreRef = useRef(onSelectStore);

  useEffect(() => {
    onSelectStoreRef.current = onSelectStore;
  }, [onSelectStore]);

  const [isSatellite, setIsSatellite] = useState(false);
  const isSatelliteRef = useRef(false);
  const styleTierRef = useRef<0 | 1 | 2>(0); // 0 = OpenFreeMap, 1 = Carto Voyager, 2 = OSM Raster
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const hasCenteredOnUserRef = useRef(false);
  const hasSelectedStoreRef = useRef(false);

  useEffect(() => {
    if (selectedStoreId !== null) {
      hasSelectedStoreRef.current = true;
    }
  }, [selectedStoreId]);

  // Initialize MapLibre GL JS
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const storeMarkers = storeMarkersRef.current;
    styleTierRef.current = 0;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: VECTOR_STYLE_URL,
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      attributionControl: false,
    });

    map.addControl(new AttributionControl({ compact: true }), 'bottom-left');

    let tileLoaded = false;
    let fallbackTimer: number | null = null;

    const clearFallbackTimer = () => {
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const advanceFallbackStyle = () => {
      if (isSatelliteRef.current) return;
      if (styleTierRef.current === 0) {
        styleTierRef.current = 1;
        tileLoaded = false;
        map.setStyle(FALLBACK_VECTOR_STYLE_URL);
      } else if (styleTierRef.current === 1) {
        styleTierRef.current = 2;
        tileLoaded = false;
        map.setStyle(OSM_RASTER_STYLE);
      }
    };

    map.on('style.load', () => {
      hideThirdPartyPoiLayers(map);
      clearFallbackTimer();
      if (!isSatelliteRef.current && styleTierRef.current < 2) {
        tileLoaded = false;
        fallbackTimer = window.setTimeout(() => {
          if (!tileLoaded) {
            advanceFallbackStyle();
          }
        }, 6000);
      }
    });

    map.on('sourcedata', (e) => {
      if (
        e.isSourceLoaded &&
        e.sourceId !== 'ne2_shaded' &&
        e.sourceDataType !== 'metadata'
      ) {
        tileLoaded = true;
        clearFallbackTimer();
      }
    });

    map.on('error', (e) => {
      const hasSourceId = 'sourceId' in e && Boolean((e as { sourceId?: string }).sourceId);
      if (!isSatelliteRef.current && !tileLoaded && hasSourceId) {
        clearFallbackTimer();
        advanceFallbackStyle();
      }
    });

    mapRef.current = map;

    return () => {
      clearFallbackTimer();
      storeMarkers.forEach(({ marker }) => marker.remove());
      storeMarkers.clear();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Resize map when layout mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.resize();
    const timer = window.setTimeout(() => {
      map.resize();
    }, 240);

    return () => window.clearTimeout(timer);
  }, [layoutMode]);

  // Toggle vector vs satellite style
  const handleToggleLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    setIsSatellite((prev) => {
      const next = !prev;
      isSatelliteRef.current = next;
      if (!next) {
        styleTierRef.current = 0;
      }
      map.setStyle(next ? SATELLITE_STYLE : VECTOR_STYLE_URL);
      return next;
    });
  }, []);

  // Geolocation: getCurrentPosition + watchPosition with high-accuracy fallback
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    let watchId: number | null = null;
    let fallbackWatchId: number | null = null;
    let cancelled = false;

    const handleSuccess = (pos: GeolocationPosition) => {
      if (cancelled) return;
      const nextLoc: UserLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      setUserLocation(nextLoc);
      setLocationError(null);

      if (!hasCenteredOnUserRef.current && !hasSelectedStoreRef.current && mapRef.current) {
        hasCenteredOnUserRef.current = true;
        mapRef.current.flyTo({
          center: [nextLoc.lng, nextLoc.lat],
          zoom: 14.5,
          speed: 1.4,
          essential: true,
        });
      }
    };

    const startFallbackWatch = () => {
      if (cancelled) return;
      fallbackWatchId = navigator.geolocation.watchPosition(handleSuccess, () => {}, {
        enableHighAccuracy: false,
        maximumAge: 30000,
        timeout: 15000,
      });
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      () => {
        navigator.geolocation.getCurrentPosition(handleSuccess, () => {}, {
          enableHighAccuracy: false,
          maximumAge: 30000,
          timeout: 15000,
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      }
    );

    watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
        startFallbackWatch();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 12000,
      }
    );

    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (fallbackWatchId !== null) navigator.geolocation.clearWatch(fallbackWatchId);
    };
  }, []);

  // Render / update user location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.setAttribute('aria-label', 'Your location');
      el.innerHTML = `
        <span class="user-location-marker__pulse"></span>
        <span class="user-location-marker__dot"></span>
      `;
      userMarkerRef.current = new Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation]);

  // Render / sync Spotlot store markers (only icons, no text labels)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visibleStores = activeCategory === 'grocery' ? stores : [];
    const visibleIds = new Set(visibleStores.map((s) => s.id));

    // Remove markers that are no longer visible
    storeMarkersRef.current.forEach(({ marker }, id) => {
      if (!visibleIds.has(id)) {
        marker.remove();
        storeMarkersRef.current.delete(id);
      }
    });

    // Add or update visible markers
    for (const store of visibleStores) {
      const isSelected = store.id === selectedStoreId;
      const existing = storeMarkersRef.current.get(store.id);

      if (existing) {
        existing.marker.setLngLat([store.lng, store.lat]);
        existing.el.innerHTML = createPinSvg(isSelected);
        existing.el.style.zIndex = isSelected ? '10' : '1';
        existing.el.setAttribute('aria-pressed', String(isSelected));
      } else {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'spotlot-pin-btn';
        el.setAttribute('aria-label', store.name);
        el.setAttribute('aria-pressed', String(isSelected));
        el.style.zIndex = isSelected ? '10' : '1';
        el.innerHTML = createPinSvg(isSelected);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectStoreRef.current(store);
        });

        const marker = new Marker({
          element: el,
          anchor: 'bottom',
        })
          .setLngLat([store.lng, store.lat])
          .addTo(map);

        storeMarkersRef.current.set(store.id, { marker, el });
      }
    }
  }, [stores, selectedStoreId, activeCategory]);

  // Smoothly fly/center when a store is selected from the list or pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToTrigger) return;

    map.flyTo({
      center: [flyToTrigger.store.lng, flyToTrigger.store.lat],
      zoom: Math.max(map.getZoom(), 14.5),
      speed: 1.2,
      curve: 1.35,
      essential: true,
    });
  }, [flyToTrigger]);

  // Center on user location button handler
  const handleCenterOnUser = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userLocation) {
      hasCenteredOnUserRef.current = true;
      setLocationError(null);
      map.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 15,
        speed: 1.3,
        essential: true,
      });
      return;
    }

    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setLocationError(null);

    const flyToPos = (pos: GeolocationPosition) => {
      const nextLoc: UserLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      hasCenteredOnUserRef.current = true;
      setUserLocation(nextLoc);
      setIsLocating(false);
      setLocationError(null);
      map.flyTo({
        center: [nextLoc.lng, nextLoc.lat],
        zoom: 15,
        speed: 1.3,
        essential: true,
      });
    };

    const handleGeoError = (err: GeolocationPositionError) => {
      setIsLocating(false);
      if (err.code === err.PERMISSION_DENIED) {
        setLocationError('Location permission denied. Allow location in browser settings.');
      } else {
        setLocationError('Unable to determine your current location.');
      }
    };

    navigator.geolocation.getCurrentPosition(
      flyToPos,
      () => {
        navigator.geolocation.getCurrentPosition(flyToPos, handleGeoError, {
          enableHighAccuracy: false,
          maximumAge: 30000,
          timeout: 10000,
        });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
    );
  }, [userLocation]);

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: 220 });
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: 220 });
  }, []);

  return (
    <section className="map-panel" aria-label="Interactive store map">
      <div ref={mapContainerRef} className="map-canvas" />

      {/* Top-Left Floating Category Pills */}
      <div className="category-pills" role="tablist" aria-label="Store categories">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`category-pill ${isActive ? 'category-pill--active' : ''}`}
              onClick={() => onCategoryChange(cat.id)}
            >
              <span className="category-pill__icon" aria-hidden="true">
                {cat.id === 'grocery' && <ShoppingCart size={16} strokeWidth={2} />}
                {cat.id === 'department' && <StoreIcon size={16} strokeWidth={2} />}
                {cat.id === 'fruits' && <Apple size={16} strokeWidth={2} />}
              </span>
              <span className="category-pill__label">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Top-Right Floating Layers Button */}
      <div className="map-controls-top-right">
        <button
          type="button"
          className={`map-ctrl-btn map-ctrl-btn--layers ${
            isSatellite ? 'map-ctrl-btn--active' : ''
          }`}
          onClick={handleToggleLayers}
          title={isSatellite ? 'Switch to Map view' : 'Switch to Satellite view'}
          aria-label={isSatellite ? 'Switch to Map view' : 'Switch to Satellite view'}
          aria-pressed={isSatellite}
        >
          <Layers size={18} strokeWidth={2} />
          <span className="map-ctrl-btn__text">{isSatellite ? 'Map' : 'Satellite'}</span>
        </button>
      </div>

      {/* Bottom-Right Floating Current Location & Zoom Controls */}
      <div className="map-controls-bottom-right">
        {locationError && (
          <div className="location-toast" role="status">
            <span>{locationError}</span>
            <button
              type="button"
              className="location-toast__close"
              onClick={() => setLocationError(null)}
              aria-label="Dismiss location message"
            >
              ×
            </button>
          </div>
        )}
        <button
          type="button"
          className={`map-ctrl-btn map-ctrl-btn--icon ${isLocating ? 'is-locating' : ''}`}
          onClick={handleCenterOnUser}
          title="Your location"
          aria-label="Center map on your location"
        >
          <Crosshair size={19} strokeWidth={2} />
        </button>

        <div className="zoom-group" role="group" aria-label="Zoom controls">
          <button
            type="button"
            className="zoom-group__btn"
            onClick={handleZoomIn}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus size={18} strokeWidth={2.2} />
          </button>
          <div className="zoom-group__divider" />
          <button
            type="button"
            className="zoom-group__btn"
            onClick={handleZoomOut}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </section>
  );
}
