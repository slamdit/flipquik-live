import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Plus, X, Star, Loader2 } from 'lucide-react';
import { storage } from '@/lib/supabase';
import supabase from '@/lib/supabase';
import { toast } from 'sonner';
import { compressImage } from '@/utils/imageCompression';

/**
 * Manages photos for the capture flow.
 * Holds originalFile in memory; only uploads compressed versions for display.
 * On save, parent calls ref.getPhotosToUpload() to get originalFile objects.
 *
 * Props:
 *   initialPhotos: [{ originalFile, compressedUrl, displayUrl }] (from QuikEval)
 *   onPhotosUpdated: (photos) => void — callback when photo list changes
 *
 * Ref exposes:
 *   getPhotosToUpload() → current photos array
 *   getPhotoCount() → number of photos
 */
const CapturePhotoManager = forwardRef(function CapturePhotoManager(
  { initialPhotos = [], onPhotosUpdated },
  ref
) {
  const normalize = (photos) =>
    photos.map((p, i) => ({
      originalFile: p.originalFile || null,
      compressedUrl: p.compressedUrl || p.displayUrl || p,
      displayUrl: p.displayUrl || p.compressedUrl || p,
      isCover: p.isCover !== undefined ? p.isCover : i === 0,
    }));

  const [photos, setPhotos] = useState(() => normalize(initialPhotos));
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (initialPhotos && initialPhotos.length > 0) {
      setPhotos(normalize(initialPhotos));
    }
  }, [initialPhotos]);

  useImperativeHandle(ref, () => ({
    getPhotosToUpload: () => photos,
    getPhotoCount: () => photos.length,
  }));

  const updatePhotos = (updated) => {
    setPhotos(updated);
    onPhotosUpdated?.(updated);
  };

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'anonymous';

      const newPhotos = await Promise.all(
        files.map(async (file) => {
          const compressed = await compressImage(file);
          const { publicUrl: file_url, path: storagePath } = await storage.uploadPhoto(compressed, userId);
          return {
            originalFile: file,
            compressedUrl: file_url,
            displayUrl: file_url,
            storagePath,
            isCover: false,
          };
        })
      );
      const merged = [...photos, ...newPhotos];
      if (!merged.some((p) => p.isCover) && merged.length > 0) {
        merged[0] = { ...merged[0], isCover: true };
      }
      updatePhotos(merged);
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} added`);
    } catch {
      toast.error('Failed to add photos');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemove = (index) => {
    const wasCover = photos[index].isCover;
    const updated = photos.filter((_, i) => i !== index);
    if (wasCover && updated.length > 0) {
      updated[0] = { ...updated[0], isCover: true };
    }
    updatePhotos(updated);
  };

  const handleSetCover = (index) => {
    updatePhotos(photos.map((p, i) => ({ ...p, isCover: i === index })));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <div
            key={index}
            className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0"
          >
            <img src={photo.displayUrl} alt="" className="w-full h-full object-cover" />
            {photo.isCover && (
              <span className="absolute top-0.5 left-0.5 bg-amber-400 rounded-full p-0.5">
                <Star className="w-2.5 h-2.5 text-white" fill="white" />
              </span>
            )}
            <button
              onClick={() => handleRemove(index)}
              className="absolute top-1 right-1 p-1 bg-slate-900/75 text-white rounded-full active:scale-90"
            >
              <X className="w-3 h-3" />
            </button>
            {!photo.isCover && (
              <button
                onClick={() => handleSetCover(index)}
                className="absolute bottom-1 right-1 p-1 bg-amber-400 text-white rounded-full active:scale-90"
                title="Set as cover"
              >
                <Star className="w-3 h-3" fill="white" />
              </button>
            )}
          </div>
        ))}

        <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 bg-slate-50 hover:bg-slate-100 transition-colors shrink-0">
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
            multiple
            className="hidden"
            onChange={handleAddPhotos}
            disabled={uploading}
          />
        </label>
      </div>

      {photos.length === 0 ? (
        <p className="text-xs text-slate-400 mt-1.5">Add at least one photo to continue</p>
      ) : (
        <p className="text-xs text-slate-400 mt-1.5">★ = cover · ✕ = remove</p>
      )}
    </div>
  );
});

export default CapturePhotoManager;
