import React, { useState } from 'react';
import { items } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Tag, DollarSign, Archive } from 'lucide-react';
import SaleModal from './SaleModal';

export default function ItemActions({ item, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);

  const handleMarkListed = async () => {
    setLoading(true);
    try {
      await items.update(item.id, { status: 'listed' });
      toast.success('Marked as listed');
      onUpdate();
    } catch {
      toast.error('Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      await items.update(item.id, { status: 'archived' });
      toast.success('Item archived');
      onUpdate();
    } catch {
      toast.error('Failed to archive');
    } finally {
      setLoading(false);
    }
  };

  if (item.status === 'sold') {
    return <span className="text-xs text-green-600 font-medium">✓ Sold</span>;
  }

  return (
    <>
      <div className="flex gap-1.5 mt-1.5 flex-wrap">
        {item.status !== 'listed' && item.status !== 'archived' && (
          <button
            onClick={handleMarkListed}
            disabled={loading}
            className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2.5 py-1 hover:bg-orange-100 transition-colors"
          >
            <Tag className="w-3 h-3" />
            Listed
          </button>
        )}
        {item.status !== 'archived' && (
          <button
            onClick={() => setShowSaleModal(true)}
            className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1 hover:bg-green-100 transition-colors"
          >
            <DollarSign className="w-3 h-3" />
            Sold
          </button>
        )}
        <button
          onClick={handleArchive}
          disabled={loading}
          className="flex items-center gap-1 text-xs bg-slate-50 text-slate-500 border border-slate-200 rounded-full px-2.5 py-1 hover:bg-slate-100 transition-colors"
        >
          <Archive className="w-3 h-3" />
          Archive
        </button>
      </div>

      {showSaleModal && (
        <SaleModal
          item={item}
          onClose={() => setShowSaleModal(false)}
          onSuccess={() => {
            setShowSaleModal(false);
            onUpdate();
          }}
        />
      )}
    </>
  );
}
