import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, FileText } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Accept both plain URL strings and rich { originalFile, compressedUrl, displayUrl } objects
const getPhotoUrl = (photo) => (typeof photo === 'string' ? photo : (photo.displayUrl || photo.compressedUrl));

export default function FullCaptureForm({ photos, onSuccess, prefill }) {
  const p = prefill || {};
  const [formData, setFormData] = useState({
    item_name: p.item_name || '',
    brand: p.brand || '',
    category: p.category || '',
    condition: p.condition || '',
    purchase_price: p.purchase_price || '',
    purchase_location: '',
    size: '',
    color: '',
    notes: p.notes || ''
  });
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const reqClass = (val) => attempted && !val?.trim() ? 'text-red-500' : '';

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const createItem = async (status) => {
    const user = await base44.auth.me();
    
    // Build search_text for fast filtering
    const searchKeywords = [
      formData.item_name.trim(),
      formData.brand.trim(),
      formData.category.trim(),
      formData.color.trim(),
      formData.size.trim(),
      formData.condition.trim()
    ].filter(Boolean).join(' ').toLowerCase();
    
    // Upload original files if present, otherwise use existing URL
    const uploadedPhotos = await Promise.all(
      photos.map(async (photo) => {
        if (photo?.originalFile) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: photo.originalFile });
          return file_url;
        }
        return getPhotoUrl(photo);
      })
    );

    const item = await base44.entities.Item.create({
      user_id: user.id,
      item_name: formData.item_name.trim(),
      brand: formData.brand.trim() || undefined,
      category: formData.category.trim() || undefined,
      condition: formData.condition.trim() || undefined,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : undefined,
      purchase_location: formData.purchase_location.trim() || undefined,
      size: formData.size.trim() || undefined,
      color: formData.color.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      status,
      primary_photo_url: uploadedPhotos[0],
      search_text: searchKeywords,
      updated_at: new Date().toISOString()
    });

    const photoPromises = uploadedPhotos.map((url, index) => 
      base44.entities.ItemPhoto.create({
        item_id: item.id,
        original_photo: url,
        sort_order: index,
        is_cover: index === 0
      })
    );
    
    await Promise.all(photoPromises);
    return item;
  };

  const handleSaveItem = async () => {
    setAttempted(true);
    if (photos.length === 0) {
      toast.error('Please add at least one photo');
      return;
    }

    if (!formData.item_name.trim()) {
      toast.error('Please enter an item name');
      return;
    }

    setSaving(true);
    try {
      await createItem('captured');
      toast.success('Item saved successfully!');
      onSuccess();
    } catch (error) {
      toast.error('Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndCreateDraft = async () => {
    setAttempted(true);
    if (photos.length === 0) {
      toast.error('Please add at least one photo');
      return;
    }

    if (!formData.item_name.trim()) {
      toast.error('Please enter an item name');
      return;
    }

    setSaving(true);
    try {
      const item = await createItem('draft');
      
      await base44.entities.ListingDraft.create({
        item_id: item.id,
        listing_status: 'incomplete'
      });

      toast.success('Item saved and draft created!');
      onSuccess();
    } catch (error) {
      toast.error('Failed to save item and create draft');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="fullItemName" className={`text-base font-medium ${reqClass(formData.item_name)}`}>Item Name *</Label>
        <Input
          id="fullItemName"
          value={formData.item_name}
          onChange={(e) => handleChange('item_name', e.target.value)}
          placeholder="e.g., Blue Nike Hoodie"
          className="h-12 text-base mt-1.5"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="brand" className={`text-base font-medium ${reqClass(formData.brand)}`}>Brand *</Label>
          <Input
            id="brand"
            value={formData.brand}
            onChange={(e) => handleChange('brand', e.target.value)}
            placeholder="Nike"
            className="h-12 text-base mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="category" className={`text-base font-medium ${reqClass(formData.category)}`}>Category *</Label>
          <Input
            id="category"
            value={formData.category}
            onChange={(e) => handleChange('category', e.target.value)}
            placeholder="Clothing"
            className="h-12 text-base mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="condition" className={`text-base font-medium ${reqClass(formData.condition)}`}>Condition *</Label>
        <Input
          id="condition"
          value={formData.condition}
          onChange={(e) => handleChange('condition', e.target.value)}
          placeholder="e.g., Excellent, Good, Fair"
          className="h-12 text-base mt-1.5"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="purchasePrice" className={`text-base font-medium ${reqClass(String(formData.purchase_price))}`}>Purchase Price *</Label>
          <Input
            id="purchasePrice"
            type="number"
            step="0.01"
            value={formData.purchase_price}
            onChange={(e) => handleChange('purchase_price', e.target.value)}
            placeholder="0.00"
            className="h-12 text-base mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="purchaseLocation" className={`text-base font-medium ${reqClass(formData.purchase_location)}`}>Purchase Location *</Label>
          <Input
            id="purchaseLocation"
            value={formData.purchase_location}
            onChange={(e) => handleChange('purchase_location', e.target.value)}
            placeholder="Goodwill"
            className="h-12 text-base mt-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="size" className="text-base font-medium">Size (Optional)</Label>
          <Input
            id="size"
            value={formData.size}
            onChange={(e) => handleChange('size', e.target.value)}
            placeholder="L"
            className="h-12 text-base mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="color" className="text-base font-medium">Color (Optional)</Label>
          <Input
            id="color"
            value={formData.color}
            onChange={(e) => handleChange('color', e.target.value)}
            placeholder="Blue"
            className="h-12 text-base mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes" className="text-base font-medium">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Any flaws, special features, etc."
          className="min-h-24 text-base mt-1.5"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button
          onClick={handleSaveItem}
          disabled={saving}
          size="lg"
          variant="outline"
          className="h-14 text-base"
          data-testid="save-item"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              Save Item
            </>
          )}
        </Button>
        <Button
          onClick={handleSaveAndCreateDraft}
          disabled={saving}
          size="lg"
          className="h-14 text-base bg-slate-900 hover:bg-slate-800"
          data-testid="save-and-draft"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <FileText className="w-5 h-5 mr-2" />
              Save & Draft
            </>
          )}
        </Button>
      </div>


    </div>
  );
}