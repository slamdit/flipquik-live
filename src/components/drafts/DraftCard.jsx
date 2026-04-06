import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Sparkles, Edit, CheckCircle, Save, StickyNote, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function DraftCard({ item, coverPhoto, draft, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [titleLoading, setTitleLoading] = useState(false);
  const [descLoading, setDescLoading] = useState(false);
  const [localTitle, setLocalTitle] = useState(draft?.title || null);
  const [localDescription, setLocalDescription] = useState(draft?.description || null);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendText, setSendText] = useState(false);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(item.internal_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);

  const displayTitle = localTitle || draft?.title;
  const displayDescription = localDescription || draft?.description;

  const handleCreateDraft = async () => {
    setLoading(true);
    try {
      await base44.entities.ListingDraft.create({
        item_id: item.id,
        listing_status: 'incomplete'
      });
      
      await base44.entities.Item.update(item.id, {
        status: 'draft',
        updated_at: new Date().toISOString()
      });

      toast.success('Draft created');
      onUpdate();
    } catch (error) {
      toast.error('Failed to create draft');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTitle = async () => {
    setTitleLoading(true);
    try {
      const prompt = `Generate a marketplace-optimized listing title for this resale item. 

Item Details:
- Name: ${item.item_name}
- Brand: ${item.brand || 'No brand'}
- Category: ${item.category || 'General'}
- Condition: ${item.condition || 'Used'}
- Size: ${item.size || 'N/A'}
- Color: ${item.color || 'N/A'}
- Notes: ${item.notes || 'None'}

Rules:
- Maximum 80 characters
- Start with brand if available
- Include main product keywords
- Include condition if notable
- Remove filler words (the, a, an, etc.)
- Be concise and scannable

Return ONLY the title, no quotes or extra text.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'gemini_3_flash'
      });

      const generated = typeof result === 'string' ? result.trim() : String(result).trim();
      setLocalTitle(generated);
      await base44.entities.ListingDraft.update(draft.id, { title: generated });
      toast.success('Title generated');
      onUpdate();
    } catch (error) {
      toast.error('Could not generate title');
    } finally {
      setTitleLoading(false);
    }
  };

  const handleGenerateDescription = async () => {
    setDescLoading(true);
    try {
      const prompt = `Generate a concise resale listing description for eBay, Poshmark, or Mercari.

Item Details:
- Name: ${item.item_name}
- Brand: ${item.brand || 'Not specified'}
- Category: ${item.category || 'Not specified'}
- Condition: ${item.condition || 'Not specified'}
- Size: ${item.size || 'Not specified'}
- Color: ${item.color || 'Not specified'}
- Notes: ${item.notes || 'None'}

Rules:
- 2 to 4 short sentences
- Professional and easy to scan
- Include the brand first if known
- Describe the item type clearly
- Mention size, color, and condition only if provided in the data
- Use plain language
- Do NOT invent measurements, flaws, fabric content, authenticity claims, or features not present in the source data
- Avoid filler phrases like "look no further" or "must-have"
- Output description text only, no formatting or quotes`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'gemini_3_flash'
      });

      const generated = typeof result === 'string' ? result.trim() : String(result).trim();
      setLocalDescription(generated);
      await base44.entities.ListingDraft.update(draft.id, { description: generated });
      toast.success('Description generated');
      onUpdate();
    } catch (error) {
      toast.error('Could not generate description');
    } finally {
      setDescLoading(false);
    }
  };

  const handleGeneratePricing = async () => {
    setPricingLoading(true);
    try {
      const prompt = `You are a conservative resale pricing expert. Given the item details below, provide realistic pricing for a secondhand marketplace like eBay, Poshmark, or Mercari.

Item Details:
- Name: ${item.item_name}
- Brand: ${item.brand || 'Unknown'}
- Category: ${item.category || 'General'}
- Condition: ${item.condition || 'Used'}
- Purchase Price: $${item.purchase_price || 0}

Rules:
- Be conservative. Do not inflate value.
- Base pricing on realistic sold comps, not wishful thinking.
- suggested_list_price: what to list it for
- expected_sale_price: what it realistically sells for (usually 10-20% below list)
- pricing_confidence: "low", "medium", or "high" based on how predictable this item's demand is
- pricing_notes: 1-2 sentence explanation of your reasoning

Return JSON only.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            suggested_list_price: { type: 'number' },
            expected_sale_price: { type: 'number' },
            pricing_confidence: { type: 'string' },
            pricing_notes: { type: 'string' }
          }
        }
      });

      const purchasePrice = item.purchase_price || 0;
      const profit = result.expected_sale_price - purchasePrice;
      const roi = purchasePrice > 0 ? Math.round((profit / purchasePrice) * 100) : 0;

      await base44.entities.ListingDraft.update(draft.id, {
        suggested_list_price: result.suggested_list_price,
        expected_sale_price: result.expected_sale_price,
        estimated_profit: Math.round(profit * 100) / 100,
        roi_percent: roi,
        pricing_confidence: result.pricing_confidence,
        pricing_notes: result.pricing_notes
      });

      toast.success('Pricing generated');
      onUpdate();
    } catch (error) {
      toast.error('Could not generate pricing');
    } finally {
      setPricingLoading(false);
    }
  };

  const handleSendEmail = async () => {
    setLoading(true);
    try {
      await base44.functions.invoke('sendListingPackage', {
        item_id: item.id,
        draft_id: draft.id
      });
      toast.success('Listing package sent to ' + (item.email || 'your email'));
    } catch (error) {
      toast.error('Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      await base44.entities.ListingDraft.update(draft.id, {
        listing_status: 'ready'
      });

      if (sendEmail) {
        await handleSendEmail();
      }

      if (!sendEmail) {
        toast.success('Draft saved');
      }

      setShowSaveOptions(false);
      onUpdate();
    } catch (error) {
      toast.error('Failed to save draft');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      captured: 'bg-slate-100 text-slate-700',
      draft: 'bg-blue-100 text-blue-700',
      ready: 'bg-green-100 text-green-700'
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await base44.entities.Item.update(item.id, { internal_notes: notesValue.trim() || null });
      setEditingNotes(false);
      toast.success('Notes saved');
      onUpdate();
    } catch (error) {
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const getDraftStatusColor = (status) => {
    const colors = {
      incomplete: 'bg-orange-100 text-orange-700',
      ready: 'bg-green-100 text-green-700'
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {(coverPhoto || item.primary_photo_url) && (
        <div className="h-40 bg-slate-100 overflow-hidden rounded-t-xl">
          <img 
            src={coverPhoto?.original_photo || item.primary_photo_url} 
            alt={item.item_name}
            className="w-full h-full object-cover object-center"
          />
        </div>
      )}
      
      <div className="p-3 space-y-2.5">
        <div>
          <h3 className="font-semibold text-base text-slate-900 line-clamp-2 mb-1.5">
            {item.item_name}
          </h3>
          
          {displayTitle && (
            <div className="text-sm text-slate-700 mb-2 line-clamp-2 bg-slate-50 p-2 rounded-lg">
              {displayTitle}
            </div>
          )}

          {displayDescription && (
            <div className="text-xs text-slate-500 mb-2 line-clamp-3 bg-blue-50 p-2 rounded-lg">
              {displayDescription}
            </div>
          )}

          {draft && draft.suggested_list_price && (
            <div className="bg-slate-900 text-white rounded-lg p-2.5 mb-2 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm">Pricing Estimate</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  draft.pricing_confidence === 'high' ? 'bg-green-500' :
                  draft.pricing_confidence === 'medium' ? 'bg-yellow-500 text-slate-900' :
                  'bg-slate-500'
                }`}>{draft.pricing_confidence}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <div className="text-slate-400 text-xs">List Price</div>
                  <div className="font-semibold">${draft.suggested_list_price?.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs">Expected Sale</div>
                  <div className="font-semibold">${draft.expected_sale_price?.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs">Est. Profit</div>
                  <div className={`font-semibold ${draft.estimated_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${draft.estimated_profit?.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs">ROI</div>
                  <div className={`font-semibold ${draft.roi_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {draft.roi_percent}%
                  </div>
                </div>
              </div>
              {draft.pricing_notes && (
                <p className="text-slate-400 text-xs mt-1.5 leading-snug">{draft.pricing_notes}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {item.brand && (
              <Badge variant="outline" className="text-xs">
                {item.brand}
              </Badge>
            )}
            {item.category && (
              <Badge variant="outline" className="text-xs">
                {item.category}
              </Badge>
            )}
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <StickyNote className="w-3 h-3" />
              {item.internal_notes ? 'Notes' : 'Add Note'}
              {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-1">
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder="Internal notes (not included in listing)..."
                    className="min-h-16 text-sm bg-white"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)} className="flex-1 h-8 text-xs">Cancel</Button>
                    <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes} className="flex-1 h-8 text-xs bg-amber-600 hover:bg-amber-700">
                      {savingNotes ? 'Saving...' : 'Save Notes'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-amber-900 flex-1">{item.internal_notes || <span className="text-amber-400 italic">No notes yet</span>}</p>
                  <button onClick={() => setEditingNotes(true)} className="text-amber-600 hover:text-amber-800 shrink-0">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {item.purchase_price && (
            <div className="text-lg font-semibold text-slate-900">
              ${item.purchase_price.toFixed(2)}
            </div>
          )}
        </div>

        <div className="space-y-2 pt-1">
          {!draft && (
            <Button
              onClick={handleCreateDraft}
              disabled={loading}
              size="lg"
              className="w-full h-12 bg-slate-900 hover:bg-slate-800"
              data-testid="create-draft"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Create Draft
                </>
              )}
            </Button>
          )}

          {draft && draft.listing_status === 'incomplete' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleGenerateTitle}
                  disabled={titleLoading || descLoading || pricingLoading}
                  size="lg"
                  variant="outline"
                  className="h-12"
                  data-testid="generate-title"
                >
                  {titleLoading ? (
                    <><div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin mr-2" />Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" />{displayTitle ? 'Redo Title' : 'Title'}</>
                  )}
                </Button>
                <Button
                  onClick={handleGenerateDescription}
                  disabled={titleLoading || descLoading || pricingLoading}
                  size="lg"
                  variant="outline"
                  className="h-12"
                  data-testid="generate-description"
                >
                  {descLoading ? (
                    <><div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin mr-2" />Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" />{displayDescription ? 'Redo Desc' : 'Description'}</>
                  )}
                </Button>
              </div>
              <Button
                onClick={handleGeneratePricing}
                disabled={loading || pricingLoading}
                size="lg"
                variant="outline"
                className="w-full h-11 border-slate-300"
                data-testid="generate-pricing"
              >
                {pricingLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {draft.suggested_list_price ? 'Refresh Pricing' : 'Generate Pricing'}
                  </>
                )}
              </Button>
              
              {!showSaveOptions ? (
                <Button
                  onClick={() => setShowSaveOptions(true)}
                  disabled={loading || !displayTitle || !displayDescription}
                  size="lg"
                  className="w-full h-12 bg-green-600 hover:bg-green-700"
                  data-testid="save-draft"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </Button>
              ) : (
                <div className="space-y-3 bg-slate-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id={`email-${item.id}`}
                      checked={sendEmail}
                      onCheckedChange={setSendEmail}
                    />
                    <Label 
                      htmlFor={`email-${item.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      Send listing package via email
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id={`text-${item.id}`}
                      checked={sendText}
                      onCheckedChange={setSendText}
                    />
                    <Label 
                      htmlFor={`text-${item.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      Send listing package via text
                    </Label>
                  </div>
                  
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={() => setShowSaveOptions(false)}
                      disabled={loading}
                      variant="outline"
                      size="lg"
                      className="flex-1 h-11"
                      data-testid="cancel-save"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveDraft}
                      disabled={loading}
                      size="lg"
                      className="flex-1 h-11 bg-green-600 hover:bg-green-700"
                      data-testid="confirm-save-draft"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Confirm
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {draft && draft.listing_status === 'ready' && (
            <div className="space-y-2">
              <div className="text-center py-1">
                <Badge className="bg-green-600 text-white">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Saved
                </Badge>
              </div>
              <Button
                onClick={handleSendEmail}
                disabled={loading}
                size="lg"
                variant="outline"
                className="w-full h-11 border-slate-300"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Listing Package
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}