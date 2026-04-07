import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Package, Search, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EditItemModal from '@/components/inventory/EditItemModal';
import EbaySyncButton from '@/components/inventory/EbaySyncButton';
import LocationPicker from '@/components/inventory/LocationPicker';
import { useQuery } from '@tanstack/react-query';
import { auth, items as itemsDb } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';

const DRAFT_STATUSES = ['captured', 'draft', 'ready', 'stored', 'research'];

const STATUS_COLORS = {
  captured:  'bg-slate-100 text-slate-600',
  draft:     'bg-blue-100 text-blue-700',
  ready:     'bg-indigo-100 text-indigo-700',
  stored:    'bg-purple-100 text-purple-700',
  listed:    'bg-orange-100 text-orange-700',
  sold:      'bg-green-100 text-green-700',
  archived:  'bg-slate-100 text-slate-400',
  research:  'bg-yellow-100 text-yellow-700',
};

function daysAgo(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function PerformanceBadge({ item }) {
  const days = daysAgo(item.created_date);
  if (item.status === 'sold') return null;
  if (days !== null && days <= 7) {
    return <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">New</span>;
  }
  if (days !== null && days > 30 && item.status === 'listed') {
    return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Slow Mover</span>;
  }
  if (days !== null && days > 14 && DRAFT_STATUSES.includes(item.status)) {
    return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Clock className="w-3 h-3" />{days}d</span>;
  }
  return null;
}

function ItemCard({ item, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${item.item_name}"?`)) return;
    setDeleting(true);
    try {
      await itemsDb.delete(item.id);
      toast.success('Item deleted');
      onDelete();
    } catch {
      toast.error('Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-3 flex items-start gap-3">
      {/* Delete button on the left */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="mt-0.5 shrink-0 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
      >
        {deleting
          ? <div className="w-4 h-4 border-2 border-slate-300 border-t-red-400 rounded-full animate-spin" />
          : <Trash2 className="w-4 h-4" />
        }
      </button>

      {/* Item content */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(item)}>
        <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{item.item_name}</p>
        {item.brand && <p className="text-xs text-slate-500 mt-0.5">{item.brand}</p>}

        <div onClick={e => e.stopPropagation()}>
          <LocationPicker item={item} currentLocation={item.current_location_label} onUpdate={onDelete} />
        </div>

        {item.purchase_price && (
          <p className="text-xs text-slate-400 mt-1">Cost: ${item.purchase_price.toFixed(2)}</p>
        )}
      </div>
    </div>
  );
}

function ItemGroup({ title, items, onEdit, onRefetch }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
        {title} <span className="font-normal text-slate-400">({items.length})</span>
      </p>
      <div className="space-y-2">
        {items.map(item => (
          <ItemCard key={item.id} item={item} onEdit={onEdit} onDelete={onRefetch} />
        ))}
      </div>
    </div>
  );
}

export default function Inventory() {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [activeTab, setActiveTab] = useState(location.state?.defaultTab || 'all');
  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const user = await auth.me();
      return itemsDb.getAll({ filters: { user_id: user.id }, orderBy: '-created_date', limit: 200 });
    }
  });

  const filtered = items.filter(item => {
    if (item.status === 'archived') return false;
    if (!search) return true;
    return (
      item.item_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.brand?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const clipped = filtered.filter(i => DRAFT_STATUSES.includes(i.status));
  const listed  = filtered.filter(i => i.status === 'listed');
  const flipped = filtered.filter(i => i.status === 'sold');


  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <Package className="w-7 h-7" />
          <h1 className="text-2xl font-bold">My Items</h1>
          <span className="ml-auto text-slate-400 text-sm">{filtered.length} items</span>
        </div>
        <EbaySyncButton onSynced={refetch} />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or brand..."
            className="pl-9 pr-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 h-11"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : (
          <>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="listed">Listed</TabsTrigger>
              <TabsTrigger value="clipped">
                Clipped
                {clipped.length > 0 && (
                  <span className="ml-1 bg-blue-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">{clipped.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="flipped">Flipped</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {filtered.length === 0 ? (
                <div className="bg-white rounded-xl p-10 text-center">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No items found</p>
                </div>
              ) : (
                <Accordion type="multiple" className="space-y-3">
                  {clipped.length > 0 && (
                    <AccordionItem value="clipped" className="bg-white rounded-xl shadow-sm border-0 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:no-underline">
                        Clipped <span className="font-normal text-slate-400 ml-1">({clipped.length})</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        <div className="space-y-2">
                          {clipped.map(item => (
                            <ItemCard key={item.id} item={item} onEdit={setEditingItem} onDelete={refetch} />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {listed.length > 0 && (
                    <AccordionItem value="listed" className="bg-white rounded-xl shadow-sm border-0 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:no-underline">
                        Listed <span className="font-normal text-slate-400 ml-1">({listed.length})</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        <div className="space-y-2">
                          {listed.map(item => (
                            <ItemCard key={item.id} item={item} onEdit={setEditingItem} onDelete={refetch} />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {flipped.length > 0 && (
                    <AccordionItem value="flipped" className="bg-white rounded-xl shadow-sm border-0 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:no-underline">
                        Flipped <span className="font-normal text-slate-400 ml-1">({flipped.length})</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        <div className="space-y-2">
                          {flipped.map(item => (
                            <ItemCard key={item.id} item={item} onEdit={setEditingItem} onDelete={refetch} />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              )}
            </TabsContent>

            <TabsContent value="listed">
              {listed.length === 0 ? (
                <div className="bg-white rounded-xl p-10 text-center">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No listed items</p>
                </div>
              ) : (
                <ItemGroup title="Listed" items={listed} onEdit={setEditingItem} onRefetch={refetch} />
              )}
            </TabsContent>

            <TabsContent value="clipped">
              {clipped.length === 0 ? (
                <div className="bg-white rounded-xl p-10 text-center">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No clipped items</p>
                  <p className="text-xs text-slate-400 mt-1">Items you save from QuikEval appear here</p>
                </div>
              ) : (
                <ItemGroup title="Clipped" items={clipped} onEdit={setEditingItem} onRefetch={refetch} />
              )}
            </TabsContent>

            <TabsContent value="flipped">
              {flipped.length === 0 ? (
                <div className="bg-white rounded-xl p-10 text-center">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Nothing flipped yet</p>
                  <p className="text-xs text-slate-400 mt-1">Sold items will appear here</p>
                </div>
              ) : (
                <ItemGroup title="Flipped" items={flipped} onEdit={setEditingItem} onRefetch={refetch} />
              )}
            </TabsContent>
          </Tabs>
          </>
        )}
      </div>

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => { refetch(); setEditingItem(null); }}
        />
      )}
    </div>
  );
}