import React, { useRef } from 'react';
import { Camera, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Compress image before upload (keeps file sizes small)
// Returns { file, base64 } — base64 is the raw data (no data: prefix) for Claude vision
async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX) { height = (height * MAX) / width; width = MAX; }
        if (height > MAX) { width = (width * MAX) / height; height = MAX; }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        // Grab base64 while canvas is still in scope (sync, same quality settings)
        const base64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
        canvas.toBlob(
          (blob) => resolve({ file: new File([blob], file.name, { type: 'image/jpeg' }), base64 }),
          'image/jpeg',
          0.82
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Upload to Supabase Storage
async function uploadToSupabase(file) {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || 'anonymous';
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from('item-photos')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('item-photos')
    .getPublicUrl(fileName);

  return publicUrl;
}

export default function PhotoCapture({ photos, setPhotos, uploading, setUploading }) {
  const fileInputRef = useRef(null);

  const handlePhotoCapture = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const newPhotos = await Promise.all(
        files.map(async (file) => {
          // Show preview immediately using local URL
          const localUrl = URL.createObjectURL(file);

          // Compress first (always needed for base64)
          const compressed = await compressImage(file);
          try {
            // Upload compressed file to Supabase
            const uploadedUrl = await uploadToSupabase(compressed.file);
            return { originalFile: file, compressedUrl: uploadedUrl, displayUrl: uploadedUrl, base64: compressed.base64 };
          } catch (uploadErr) {
            // If upload fails, still show the photo locally so user doesn't lose it
            console.warn('Upload failed, using local preview:', uploadErr);
            return { originalFile: file, compressedUrl: localUrl, displayUrl: localUrl, base64: compressed.base64 };
          }
        })
      );

      setPhotos([...photos, ...newPhotos]);
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} added`);
    } catch (error) {
      console.error('Photo capture error:', error);
      toast.error('Failed to add photos. Please try again.');
    } finally {
      setUploading(false);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const getDisplayUrl = (photo) => {
    if (typeof photo === 'string') return photo;
    return photo.displayUrl || photo.compressedUrl || '';
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={handlePhotoCapture}
        className="hidden"
      />

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo, index) => (
            <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-slate-200">
              <img
                src={getDisplayUrl(photo)}
                alt={`Capture ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removePhoto(index)}
                className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-full active:scale-95 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>
              {index === 0 && (
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-slate-900/80 text-white text-xs rounded-full">
                  Cover
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        size="lg"
        className="w-full h-14 text-base bg-slate-900 hover:bg-slate-800 active:scale-98"
        data-testid="take-photos"
      >
        {uploading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Uploading...
          </div>
        ) : (
          <>
            {photos.length === 0 ? (
              <><Camera className="w-5 h-5 mr-2" />Take Photos</>
            ) : (
              <><ImageIcon className="w-5 h-5 mr-2" />Add More Photos</>
            )}
          </>
        )}
      </Button>
    </div>
  );
}
