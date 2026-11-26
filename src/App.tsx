import { useMemo, useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchBranches } from './data/stores';
import type { CategoryId, LayoutMode, Store } from './types';
import { StoreListPanel } from './components/StoreListPanel';
import { StoreMap } from './components/StoreMap';

export function App() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('grocery');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');
  const [searchQuery, setSearchQuery] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [flyToTrigger, setFlyToTrigger] = useState<{ store: Store; seq: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchBranches(controller.signal)
      .then((loadedStores) => {
        setStores(loadedStores);
        setFetchError(null);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setFetchError(err instanceof Error ? err.message : 'Failed to load stores');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  const filteredStores = useMemo(() => {
    if (activeCategory !== 'grocery') return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stores;

    return stores.filter(
      (store) =>
        store.name.toLowerCase().includes(q) ||
        store.city.toLowerCase().includes(q) ||
        store.company.toLowerCase().includes(q) ||
        store.address.toLowerCase().includes(q)
    );
  }, [activeCategory, searchQuery, stores]);

  const handleSelectStore = useCallback((store: Store) => {
    setSelectedStoreId(store.id);
    if (store.hasValidCoords) {
      setFlyToTrigger((prev) => ({ store, seq: (prev?.seq ?? 0) + 1 }));
    }
  }, []);

  const handleCategoryChange = useCallback((category: CategoryId) => {
    setActiveCategory(category);
    if (category !== 'grocery') {
      setSelectedStoreId(null);
    }
  }, []);

  return (
    <main className={`app-shell app-shell--${layoutMode}`}>
      {layoutMode !== 'map' && (
        <StoreListPanel
          activeCategory={activeCategory}
          stores={filteredStores}
          isLoading={isLoading}
          fetchError={fetchError}
          selectedStoreId={selectedStoreId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectStore={handleSelectStore}
          isFullWidth={layoutMode === 'list'}
        />
      )}

      {/* Divider / Collapse-Expand Toggle */}
      <div className={`panel-divider panel-divider--${layoutMode}`}>
        {layoutMode === 'split' && (
          <div className="divider-toggle" role="group" aria-label="Layout view toggle">
            <button
              type="button"
              className="divider-toggle__btn"
              onClick={() => setLayoutMode('map')}
              title="Map only"
              aria-label="Collapse list to Map Only view"
            >
              <ChevronLeft size={16} strokeWidth={2.2} />
            </button>
            <div className="divider-toggle__sep" />
            <button
              type="button"
              className="divider-toggle__btn"
              onClick={() => setLayoutMode('list')}
              title="List only"
              aria-label="Expand list to List Only view"
            >
              <ChevronRight size={16} strokeWidth={2.2} />
            </button>
          </div>
        )}

        {layoutMode === 'map' && (
          <button
            type="button"
            className="divider-edge-btn divider-edge-btn--left"
            onClick={() => setLayoutMode('split')}
            title="Show store list (Split view)"
            aria-label="Expand store list to Split view"
          >
            <ChevronRight size={18} strokeWidth={2.2} />
          </button>
        )}

        {layoutMode === 'list' && (
          <button
            type="button"
            className="divider-edge-btn divider-edge-btn--right"
            onClick={() => setLayoutMode('split')}
            title="Show map (Split view)"
            aria-label="Restore map to Split view"
          >
            <ChevronLeft size={18} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {layoutMode !== 'list' && (
        <StoreMap
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          stores={filteredStores}
          selectedStoreId={selectedStoreId}
          onSelectStore={handleSelectStore}
          layoutMode={layoutMode}
          flyToTrigger={flyToTrigger}
        />
      )}
    </main>
  );
}

export default App;
