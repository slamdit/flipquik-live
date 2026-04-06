import React, { useState } from 'react';
import { Camera, Zap, List } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PhotoCapture from '@/components/capture/PhotoCapture';
import QuickCaptureForm from '@/components/capture/QuickCaptureForm';
import FullCaptureForm from '@/components/capture/FullCaptureForm';
import { useNavigate, useLocation } from 'react-router-dom';


export default function Capture() {
  const location = useLocation();
  const incomingState = location.state || {};
  const prefill = incomingState.prefill || null;
  // photosData: rich objects from QuikEval; photos: legacy plain URLs
  const initialPhotosData = incomingState.photosData || incomingState.photos || [];
  // photos/uploading used by FullCaptureForm tab; pre-populated from QuikEval if available
  const [photos, setPhotos] = useState(initialPhotosData);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  const handleSuccess = () => {
    setPhotos([]);
    navigate('/Inventory');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <Camera className="w-7 h-7" />
          <h1 className="text-2xl font-bold">Capture</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">


        <Tabs defaultValue="quick" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="quick" className="text-base">
              <Zap className="w-4 h-4 mr-1" />
              Quik
            </TabsTrigger>

            <TabsTrigger value="full" className="text-base">
              <List className="w-4 h-4 mr-1" />
              Full
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <QuickCaptureForm onSuccess={handleSuccess} prefill={prefill} initialPhotosData={initialPhotosData} />
            </div>
          </TabsContent>



          <TabsContent value="full" className="mt-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <PhotoCapture photos={photos} setPhotos={setPhotos} uploading={uploading} setUploading={setUploading} />
              <FullCaptureForm photos={photos} onSuccess={handleSuccess} prefill={prefill} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}