import React, { useState } from 'react';
import { auth, inventoryLocations, itemStorageAssignments, items } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Plus, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function LocationPicker({ item, currentLocation, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('bin');
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const { data: locations = [], refetch: refetchLocations } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: async () => {
      const user = await auth.me();
      return inventoryLocations.getAll({ filters: { user_id: user.id }, orderBy: 'location_name' });
    }
  });

  const handleAssign = async (location) => {
    setAssigning(true);
    try {
      const existing = await itemStorageAssignments.getAll({ filters: { item_id: item.id, active: true } });
      await Promise.all(existing.map(a =>
        itemStorageAssignments.update(a.id, { active: false, removed_at: new Date().toISOString().split('T')[0] })
      ));

      await itemStorageAssignments.create({
        item_id: item.id,
        location_id: location.id,
        assigned_at: new Date().toISOString().split('T')[0],
        active: true
      });

      await items.update(item.id, { current_location_label: location.location_name });

      toast.success(`Assigned to ${location.location_name}`);
      setOpen(false);
      onUpdate();
    } catch {
      toast.error('Failed to assign location');
    } finally {
      setAssigning(false);
    }
  };

  const handleCreateAndAssign = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const user = await auth.me();
      const location = await inventoryLocations.create({
        user_id: user.id,
        location_name: newLabel.trim(),
        location_type: newType
      });
      await refetchLocations();
      await handleAssign(location);
      setNewLabel('');
    } catch {
      toast.error('Failed to create location');
    } finally {
      setCreating(false);
    }
  };

  const TYPES = ['bin', 'bag', 'shelf', 'rack', 'tote'];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
      >
        <MapPin className="w-3.5 h-3.5" />
        <span>{currentLocation || 'Assign location'}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-6 z-50 bg-white border border-slate-200 rounded-xl shadow-lg w-64 p-3 space-y-3">
          <p className="text-xs font-semibold text-slate-700">Select or create location</p>

          {locations.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {locations.map(loc => (
                <button
                  key={loc.id}
                  onClick={() => handleAssign(loc)}
                  disabled={assigning}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 text-sm text-left"
                >
                  <span className="text-slate-800">{loc.location_name}</span>
                  <span className="text-xs text-slate-400">{loc.location_type}</span>
                  {currentLocation === loc.location_name && <Check className="w-3.5 h-3.5 text-green-600 ml-1" />}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 pt-2 space-y-2">
            <p className="text-xs text-slate-500">New location</p>
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white"
            >
              {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <div className="flex gap-1.5">
              <Input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="e.g. Bin A3"
                className="h-8 text-xs"
                onKeyDown={e => e.key === 'Enter' && handleCreateAndAssign()}
              />
              <Button size="sm" onClick={handleCreateAndAssign} disabled={creating || !newLabel.trim()} className="h-8 px-2">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
