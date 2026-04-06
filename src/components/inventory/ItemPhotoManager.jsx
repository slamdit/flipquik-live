import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trash2, Plus, Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ItemPhotoManager({ itemId }) {
  const [uploading, setUploading] = useState(false);

  const { data: photos = [], refetch } = useQuery({
    queryKey: ['item-photos', itemId],
    queryFn: () => base44.entities.ItemPhoto.filter({ item_id: itemId }, 'sort_order', 50),
  });

  const handleAddPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const maxOrder = photos.length > 0 ? Math.max(...photos.map(p => p.sort_order || 0)) + 1 : 0;
      await base44.entities.ItemPhoto.create({
        item_id: itemId,
        original_photo: file_url,
        sort_order: maxOrder,
        is_cover: photos.length === 0,
      });
      // Update item primary_photo_url if this is the first photo
      if (photos.length === 0) {
        await base44.entities.Item.update(itemId, { primary_photo_url: file_url });
      }
      toast.success('Photo added');
      refetch();
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (photo) => {
    try {
      await base44.entities.ItemPhoto.delete(photo.id);
      // If deleted photo was cover, set next one as cover
      if (photo.is_cover) {
        const remaining = photos.filter(p => p.id !== photo.id);
        if (remaining.length > 0) {
          await base44.entities.ItemPhoto.update(remaining[0].id, { is_cover: true });
          await base44.entities.Item.update(itemId, { primary_photo_url: remaining[0].original_photo });
        } else {
          await base44.entities.Item.update(itemId, { primary_photo_url: null });
        }
      }
      toast.success('Photo deleted');
      refetch();
    } catch {
      toast.error('Failed to delete photo');
    }
  };

  const handleSetCover = async (photo) => {
    try {
      // Clear current cover
      const currentCover = photos.find(p => p.is_cover);
      if (currentCover) await base44.entities.ItemPhoto.update(currentCover.id, { is_cover: false });
      // Set new cover
      await base44.entities.ItemPhoto.update(photo.id, { is_cover: true });
      await base44.entities.Item.update(itemId, { primary_photo_url: photo.original_photo });
      toast.success('Cover photo updated');
      refetch();
    } catch {
      toast.error('Failed to update cover');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {photos.map(photo => (
          <div key={photo.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
            <img src={photo.original_photo} alt="" className="w-full h-full object-cover" />
            {photo.is_cover && (
              <span className="absolute top-0.5 left-0.5 bg-amber-400 rounded-full p-0.5">
                <Star className="w-2.5 h-2.5 text-white" fill="white" />
              </span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
              {!photo.is_cover && (
                <button
                  onClick={() => handleSetCover(photo)}
                  className="bg-amber-400 rounded-full p-1 hover:bg-amber-500"
                  title="Set as cover"
                >
                  <Star className="w-3 h-3 text-white" />
                </button>
              )}
              <button
                onClick={() => handleDelete(photo)}
                className="bg-red-500 rounded-full p-1 hover:bg-red-600"
                title="Delete photo"
              >
                <Trash2 className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        ))}

        {/* Add photo button */}
        <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 bg-slate-50 hover:bg-slate-100 transition-colors">
          {uploading ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          ) : (
            <>
              <Plus className="w-5 h-5 text-slate-400" />
              <span className="text-xs text-slate-400 mt-0.5">Add</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleAddPhoto}
            disabled={uploading}
          />
        </label>
      </div>
      {photos.length > 0 && (
        <p className="text-xs text-slate-400 mt-1.5">Tap ★ to set cover · Hover to delete</p>
      )}
    </div>
  );
}