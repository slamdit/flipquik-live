import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Package, Search, X, Trash2, ChevronDown, ChevronRight, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EditItemModal from '@/components/inventory/EditItemModal';
import SaleModal from '@/components/inventory/SaleModal';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ── Helpers ─────────────────────────────────────────────────────
const itemName  = (i) => i.name || i.item_name || 'Untitled';
const itemCost  = (i) => i.cost  ?? i.purchase_price ?? null;
const itemPrice = (i) => i.price ?? i.suggested_price ?? null;

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLES = {
  clipped:  'bg-blue-100 text-blue-700',
  listed:   'bg-orange-100 text-orange-700',
  flipped:  'bg-green-100 text-green-700',
  sold:     'bg-green-100 text-green-700',
  captured: 'bg-slate-100 text-slate-600',
  draft:    'bg-blue-100 text-blue-700',
  research: 'bg-yellow-100 text-yellow-700',
};

function statusLabel(s) {
  if (s === 'sold') return 'Flipped';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// ── Fetch helpers ────────────────────────────────────────────────
async function fetchItems(status) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not signed in');
  const userId = session.user.id;

  let q = supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(300);

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ── Sort & filter ────────────────────────────────────────────────
function applyFilters(items, { search, category, sortBy }) {
  let out = items;

  if (search) {
    const q = search.toLowerCase();
    out = out.filter(i =>
      itemName(i).toLowerCase().includes(q) ||
      i.brand?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q)
    );
  }

  if (category && category !== '__all__') {
    out = out.filter(i => i.category === category);
  }

  return [...out].sort((a, b) => {
    switch (sortBy) {
      case 'name':     return itemName(a).localeCompare(itemName(b));
      case 'price':    return (itemPrice(b) ?? 0) - (itemPrice(a) ?? 0);
      case 'category': return (a.category || '').localeCompare(b.category || '');
      case 'date':
      default:         return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }
  });
}

// ── Item Card ────────────────────────────────────────────────────
function ItemCard({ item, onEdit, onDelete, onMarkFlipped }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${itemName(item)}"?`)) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('items').delete().eq('id', item.id);
      if (error) throw error;
      toast.success('Item deleted');
      onDelete();
    } catch {
      toast.error('Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  const cost  = itemCost(item);
  const price = itemPrice(item);

  return (
    <div
      className="bg-white rounded-xl shadow-sm p-3 flex gap-3 cursor-pointer active:bg-slate-50"
      onClick={() => onEdit(item)}
    >
      {/* Thumbnail */}
      <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100">
        {item.primary_photo_url
          ? <img src={item.primary_photo_url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-slate-300" /></div>
        }
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{itemName(item)}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[item.status] || 'bg-slate-100 text-slate-500'}`}>
            {statusLabel(item.status)}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
          {item.brand    && <span className="text-xs text-slate-500">{item.brand}</span>}
          {item.category && <span className="text-xs text-slate-400">{item.category}</span>}
          {item.condition && <span className="text-xs text-slate-400">{item.condition}</span>}
        </div>

        <div className="flex items-center gap-3 mt-1">
          {price != null && <span className="text-xs font-medium text-slate-700">${price.toFixed(2)}</span>}
          {cost  != null && <span className="text-xs text-slate-400">Cost ${cost.toFixed(2)}</span>}
          <span className="text-xs text-slate-300 ml-auto">{formatDate(item.created_at)}</span>
        </div>

        {/* Mark as Flipped — only on listed items */}
        {item.status === 'listed' && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkFlipped(item); }}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg py-1.5 transition-colors"
          >
            <PartyPopper className="w-3.5 h-3.5" />
            Mark as Flipped
          </button>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors self-start mt-0.5"
      >
        {deleting
          ? <div className="w-4 h-4 border-2 border-slate-300 border-t-red-400 rounded-full animate-spin" />
          : <Trash2 className="w-4 h-4" />
        }
      </button>
    </div>
  );
}

// ── Collapsible group for All tab ────────────────────────────────
function ItemGroup({ title, count, items, defaultOpen, onEdit, onRefetch, onMarkFlipped }) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {title} <span className="font-normal text-slate-400">({count})</span>
        </span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {items.map(item => (
            <ItemCard key={item.id} item={item} onEdit={onEdit} onDelete={onRefetch} onMarkFlipped={onMarkFlipped} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Flat list for individual tabs ────────────────────────────────
function ItemList({ items, loading, emptyText, emptySubtext, onEdit, onRefetch, onMarkFlipped }) {
  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );
  if (items.length === 0) return (
    <div className="bg-white rounded-xl p-10 text-center">
      <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-500">{emptyText}</p>
      {emptySubtext && <p className="text-xs text-slate-400 mt-1">{emptySubtext}</p>}
    </div>
  );
  return (
    <div className="space-y-2">
      {items.map(item => (
        <ItemCard key={item.id} item={item} onEdit={onEdit} onDelete={onRefetch} onMarkFlipped={onMarkFlipped} />
      ))}
    </div>
  );
}

// ── Sort / Filter bar ────────────────────────────────────────────
function SortFilterBar({ search, setSearch, sortBy, setSortBy, category, setCategory, categories, showStatusFilter, statusFilter, setStatusFilter }) {
  return (
    <div className="space-y-2 mb-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items..."
          className="pl-9 pr-9 h-10 text-sm"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sort + Category row */}
      <div className="flex gap-2">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 text-xs flex-1">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date Added</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="price">Price (High–Low)</SelectItem>
            <SelectItem value="category">Category</SelectItem>
          </SelectContent>
        </Select>

        {categories.length > 0 && (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 text-xs flex-1">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {showStatusFilter && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs flex-1">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Statuses</SelectItem>
              <SelectItem value="clipped">Clipped</SelectItem>
              <SelectItem value="listed">Listed</SelectItem>
              <SelectItem value="flipped">Flipped</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function Inventory() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.defaultTab || 'all');
  const [listedEnabled, setListedEnabled]   = useState(activeTab === 'listed');
  const [flippedEnabled, setFlippedEnabled] = useState(activeTab === 'flipped');

  const [search,       setSearch]       = useState('');
  const [sortBy,       setSortBy]       = useState('date');
  const [category,     setCategory]     = useState('__all__');
  const [statusFilter, setStatusFilter] = useState('__all__');
  const [editingItem,  setEditingItem]  = useState(null);
  const [saleItem,     setSaleItem]     = useState(null);

  // ── Queries ──
  const allQuery = useQuery({
    queryKey: ['items-all'],
    queryFn: () => fetchItems(null),
  });

  const listedQuery = useQuery({
    queryKey: ['items-listed'],
    queryFn: () => fetchItems('listed'),
    enabled: listedEnabled,
  });

  const flippedQuery = useQuery({
    queryKey: ['items-flipped'],
    queryFn: () => fetchItems('flipped'),
    enabled: flippedEnabled,
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'listed')  setListedEnabled(true);
    if (tab === 'flipped') setFlippedEnabled(true);
  };

  const refetchAll = () => {
    allQuery.refetch();
    if (listedEnabled)  listedQuery.refetch();
    if (flippedEnabled) flippedQuery.refetch();
  };

  // ── Derive categories for filter ──
  const allItems = allQuery.data || [];
  const categories = useMemo(() =>
    [...new Set(allItems.map(i => i.category).filter(Boolean))].sort(),
    [allItems]
  );

  // ── Filtered views ──
  const filterOpts = { search, category, sortBy };

  const allFiltered = useMemo(() => {
    let items = allItems.filter(i => i.status !== 'archived');
    if (statusFilter !== '__all__') {
      items = items.filter(i =>
        statusFilter === 'flipped' ? (i.status === 'flipped' || i.status === 'sold') : i.status === statusFilter
      );
    }
    return applyFilters(items, filterOpts);
  }, [allItems, statusFilter, search, category, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  const clippedItems  = useMemo(() => applyFilters(allItems.filter(i => i.status === 'clipped'), filterOpts), [allItems, search, category, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps
  const listedItems   = useMemo(() => applyFilters((listedQuery.data  || []), filterOpts), [listedQuery.data,  search, category, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps
  const flippedItems  = useMemo(() => applyFilters((flippedQuery.data || []).filter(i => i.status === 'flipped' || i.status === 'sold'), filterOpts), [flippedQuery.data, search, category, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  // For All tab grouped view — use allQuery data split by status
  const allClipped = useMemo(() => applyFilters(allItems.filter(i => i.status === 'clipped'), filterOpts), [allItems, search, category, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps
  const allListed  = useMemo(() => applyFilters(allItems.filter(i => i.status === 'listed'), filterOpts), [allItems, search, category, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps
  const allFlipped = useMemo(() => applyFilters(allItems.filter(i => i.status === 'flipped' || i.status === 'sold'), filterOpts), [allItems, search, category, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalCount = allFiltered.length;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7" />
          <h1 className="text-2xl font-bold">My Items</h1>
          <span className="ml-auto text-slate-400 text-sm">{totalCount} items</span>
        </div>
      </div>

      <div className="px-4 py-4">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="clipped">
              Clipped
              {clippedItems.length > 0 && (
                <span className="ml-1 bg-blue-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {clippedItems.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="listed">Listed</TabsTrigger>
            <TabsTrigger value="flipped">Flipped</TabsTrigger>
          </TabsList>

          {/* ── All tab ── */}
          <TabsContent value="all">
            <SortFilterBar
              search={search} setSearch={setSearch}
              sortBy={sortBy} setSortBy={setSortBy}
              category={category} setCategory={setCategory}
              categories={categories}
              showStatusFilter
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            />

            {allQuery.isLoading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
              </div>
            ) : statusFilter !== '__all__' ? (
              // Flat list when status filter is active
              <ItemList
                items={allFiltered}
                loading={false}
                emptyText="No items found"
                onEdit={setEditingItem}
                onRefetch={refetchAll}
                onMarkFlipped={setSaleItem}
              />
            ) : (
              // Grouped accordion
              <div className="space-y-3">
                {allFiltered.length === 0 ? (
                  <div className="bg-white rounded-xl p-10 text-center">
                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No items found</p>
                  </div>
                ) : (
                  <>
                    <ItemGroup title="Clipped" count={allClipped.length} items={allClipped} defaultOpen={true}  onEdit={setEditingItem} onRefetch={refetchAll} onMarkFlipped={setSaleItem} />
                    <ItemGroup title="Listed"  count={allListed.length}  items={allListed}  defaultOpen={false} onEdit={setEditingItem} onRefetch={refetchAll} onMarkFlipped={setSaleItem} />
                    <ItemGroup title="Flipped" count={allFlipped.length} items={allFlipped} defaultOpen={false} onEdit={setEditingItem} onRefetch={refetchAll} onMarkFlipped={setSaleItem} />
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Clipped tab ── */}
          <TabsContent value="clipped">
            <SortFilterBar
              search={search} setSearch={setSearch}
              sortBy={sortBy} setSortBy={setSortBy}
              category={category} setCategory={setCategory}
              categories={categories}
              showStatusFilter={false}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            />
            <ItemList
              items={clippedItems}
              loading={allQuery.isLoading}
              emptyText="No clipped items"
              emptySubtext="Items you save from QuikEval appear here"
              onEdit={setEditingItem}
              onRefetch={refetchAll}
              onMarkFlipped={setSaleItem}
            />
          </TabsContent>

          {/* ── Listed tab ── */}
          <TabsContent value="listed">
            <SortFilterBar
              search={search} setSearch={setSearch}
              sortBy={sortBy} setSortBy={setSortBy}
              category={category} setCategory={setCategory}
              categories={categories}
              showStatusFilter={false}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            />
            <ItemList
              items={listedItems}
              loading={listedQuery.isLoading && listedEnabled}
              emptyText="No listed items"
              onEdit={setEditingItem}
              onRefetch={refetchAll}
              onMarkFlipped={setSaleItem}
            />
          </TabsContent>

          {/* ── Flipped tab ── */}
          <TabsContent value="flipped">
            <SortFilterBar
              search={search} setSearch={setSearch}
              sortBy={sortBy} setSortBy={setSortBy}
              category={category} setCategory={setCategory}
              categories={categories}
              showStatusFilter={false}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            />
            <ItemList
              items={flippedItems}
              loading={flippedQuery.isLoading && flippedEnabled}
              emptyText="Nothing flipped yet"
              emptySubtext="Sold items will appear here"
              onEdit={setEditingItem}
              onRefetch={refetchAll}
              onMarkFlipped={setSaleItem}
            />
          </TabsContent>
        </Tabs>
      </div>

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => { refetchAll(); setEditingItem(null); }}
        />
      )}

      {saleItem && (
        <SaleModal
          item={saleItem}
          onClose={() => setSaleItem(null)}
          onSuccess={() => { refetchAll(); setSaleItem(null); }}
        />
      )}
    </div>
  );
}
