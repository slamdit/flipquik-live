import React, { useRef } from 'react';
import { Camera, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { compressImage } from '@/utils/imageCompression';
import { toast } from 'sonner';

export default function PhotoCapture({ photos, setPhotos, uploading, setUploading }) {
  const fileInputRef = useRef(null);

  const handlePhotoCapture = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const newPhotos = await Promise.all(
        files.map(async (file) => {
          const compressed = await compressImage(file);
          const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
          return { originalFile: file, compressedUrl: file_url, displayUrl: file_url };
        })
      );
      setPhotos([...photos, ...newPhotos]);
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`);
    } catch (error) {
      toast.error('Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const getDisplayUrl = (photo) => (typeof photo === 'string' ? photo : photo.displayUrl);

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
              <>
                <Camera className="w-5 h-5 mr-2" />
                Take Photos
              </>
            ) : (
              <>
                <ImageIcon className="w-5 h-5 mr-2" />
                Add More Photos
              </>
            )}
          </>
        )}
      </Button>
    </div>
  );
}