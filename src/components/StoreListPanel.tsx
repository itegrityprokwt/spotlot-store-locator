import { useEffect, useRef } from 'react';
import { Search, X, Store as StoreIcon, Apple, ShoppingCart } from 'lucide-react';
import type { CategoryId, Store } from '../types';

interface StoreListPanelProps {
  activeCategory: CategoryId;
  stores: Store[];
  isLoading: boolean;
  fetchError: string | null;
  selectedStoreId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectStore: (store: Store) => void;
  isFullWidth: boolean;
}

export function StoreListPanel({
  activeCategory,
  stores,
  isLoading,
  fetchError,
  selectedStoreId,
  searchQuery,
  onSearchChange,
  onSelectStore,
  isFullWidth,
}: StoreListPanelProps) {
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (selectedStoreId && itemRefs.current[selectedStoreId]) {
      itemRefs.current[selectedStoreId]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedStoreId]);

  return (
    <aside
      className={`left-panel ${isFullWidth ? 'left-panel--full' : ''}`}
      aria-label="Stores list"
    >
      <div className="left-panel__header">
        <h1 className="left-panel__title">grocery stores near me</h1>
        <div className="search-bar">
          <Search className="search-bar__icon" size={18} strokeWidth={2} aria-hidden="true" />
          <input
            type="text"
            className="search-bar__input"
            placeholder="Search here"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search stores"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              className="search-bar__clear"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              title="Clear search"
            >
              <X size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <div className="left-panel__body">
        {activeCategory !== 'grocery' ? (
          <div className="empty-state">
            <div className="empty-state__icon-wrap">
              {activeCategory === 'department' ? (
                <StoreIcon size={28} strokeWidth={1.75} />
              ) : (
                <Apple size={28} strokeWidth={1.75} />
              )}
            </div>
            <p className="empty-state__title">
              {activeCategory === 'department' ? 'Department Store' : 'Fruits'}
            </p>
            <p className="empty-state__subtitle">
              No locations available yet. This category will be added soon.
            </p>
          </div>
        ) : isLoading ? (
          <div className="empty-state">
            <div className="empty-state__icon-wrap">
              <ShoppingCart size={26} strokeWidth={1.75} />
            </div>
            <p className="empty-state__title">Loading stores…</p>
          </div>
        ) : fetchError ? (
          <div className="empty-state">
            <div className="empty-state__icon-wrap">
              <ShoppingCart size={26} strokeWidth={1.75} />
            </div>
            <p className="empty-state__title">Unable to load stores</p>
            <p className="empty-state__subtitle">{fetchError}</p>
          </div>
        ) : stores.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon-wrap">
              <ShoppingCart size={26} strokeWidth={1.75} />
            </div>
            <p className="empty-state__title">No matching grocery stores</p>
            <p className="empty-state__subtitle">
              Try searching by store name, city, company, or address.
            </p>
          </div>
        ) : (
          <div className="store-list" role="listbox" aria-label="Grocery stores">
            {stores.map((store) => {
              const isSelected = store.id === selectedStoreId;
              return (
                <button
                  key={store.id}
                  ref={(el) => {
                    itemRefs.current[store.id] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`store-row ${isSelected ? 'store-row--selected' : ''}`}
                  onClick={() => onSelectStore(store)}
                >
                  <span className="store-row__name">{store.name}</span>
                  <span
                    className={`store-row__status ${
                      store.isOpen ? 'store-row__status--open' : 'store-row__status--closed'
                    }`}
                  >
                    {store.isOpen ? 'Open now' : 'Closed'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
