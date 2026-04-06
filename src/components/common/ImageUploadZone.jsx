import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, X, Download, Copy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ImageUploadZone({ item_id, onPhotosAdded }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    base44.entities.ItemPhoto.filter({ item_id }, 'sort_order', 20).then(setPhotos);
  }, [item_id]);

  useEffect(() => {
    const handlePaste = (e) => {
      const files = Array.from(e.clipboardData?.items || [])
        .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
        .map(i => i.getAsFile())
        .filter(Boolean);
      if (files.length > 0) uploadFiles(files);
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [item_id, photos]);

  const uploadFiles = useCallback(async (files) => {
    setUploading(true);
    try {
      const nextOrder = photos.length;
      const results = await Promise.all(
        files.map(async (file, i) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return base44.entities.ItemPhoto.create({
            item_id,
            original_photo: file_url,
            processed_photo: file_url,
            sort_order: nextOrder + i,
            is_cover: photos.length === 0 && i === 0,
          });
        })
      );
      const updated = await base44.entities.ItemPhoto.filter({ item_id }, 'sort_order', 20);
      setPhotos(updated);
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded!`);
      onPhotosAdded?.(updated);
    } catch {
      toast.error('Failed to upload image(s)');
    } finally {
      setUploading(false);
    }
  }, [item_id, photos]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) uploadFiles(files);
  };

  const handleDelete = async (photoId) => {
    await base44.entities.ItemPhoto.delete(photoId);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    toast.success('Photo removed');
  };

  return (
    <div className="space-y-2">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) uploadFiles(files);
            e.target.value = '';
          }}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs text-blue-600 font-medium">Uploading...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-1">
            <Upload className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500">
              Drop images here, paste, or <span className="text-blue-600 font-medium">click to browse</span>
            </span>
          </div>
        )}
      </div>

      {/* Photo Grid */}
      {photos.length > 0 ? (
        <>
          <p className="text-xs text-slate-400 text-center">Use ⬇ to download, then upload to Poshmark</p>
          <div className="grid grid-cols-4 gap-1.5">
            {photos.map(photo => {
              const url = photo.processed_photo || photo.original_photo;
              const handleDownload = () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = `photo-${photo.id}.jpg`;
                a.target = '_blank';
                a.click();
              };
              const handleCopy = async () => {
                try {
                  const res = await fetch(url);
                  const blob = await res.blob();
                  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                  toast.success('Image copied — paste into Poshmark!');
                } catch {
                  toast.error('Copy failed — use the download button instead');
                }
              };
              return (
                <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <button onClick={handleCopy} title="Copy image" className="bg-white/90 rounded p-1">
                      <Copy className="w-3 h-3 text-slate-700" />
                    </button>
                    <button onClick={handleDownload} title="Download" className="bg-white/90 rounded p-1">
                      <Download className="w-3 h-3 text-slate-700" />
                    </button>
                    <button onClick={() => handleDelete(photo.id)} title="Delete" className="bg-white/90 rounded p-1">
                      <X className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                  {photo.is_cover && (
                    <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] px-1 rounded">Cover</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        !uploading && <p className="text-xs text-slate-400 text-center">No photos yet</p>
      )}
    </div>
  );
}