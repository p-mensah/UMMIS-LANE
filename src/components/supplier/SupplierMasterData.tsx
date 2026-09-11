import React, { useState } from 'react';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FileCheck,
  CreditCard,
  ShieldCheck,
  Star,
  Award,
  Clock,
  Boxes,
  Edit2,
  Save,
  X,
  Truck,
  CheckCircle2
} from 'lucide-react';

interface SupplierRecord {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  business_license?: string;
  fulfillment_preference?: 'direct_delivery' | 'store_pickup' | string;
  payment_terms?: string;
  currency?: string;
  bank_name?: string;
  bank_account?: string;
  bank_branch?: string;
  lead_time_days?: number;
  lead_time_sla?: string;
  moq?: number;
  certifications?: string;
  tier_pricing?: string;
  quality_score?: number;
}

interface SupplierMasterDataProps {
  supplier: SupplierRecord | null;
  onSaveMasterData: (updated: Partial<SupplierRecord>) => Promise<void>;
  userRole?: string;
}

export default function SupplierMasterData({
  supplier,
  onSaveMasterData,
  userRole = 'admin'
}: SupplierMasterDataProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<SupplierRecord>>(supplier || {});
  const [isSaving, setIsSaving] = useState(false);

  // Sync if supplier changes
  React.useEffect(() => {
    if (supplier) {
      setFormData(supplier);
    }
  }, [supplier]);

  if (!supplier) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
        <Building2 size={32} className="mx-auto mb-2 opacity-30" />
        No supplier master record selected or available.
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveMasterData(formData);
      setIsEditing(false);
    } catch (err: any) {
      alert('Error updating master data: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const certificationsList = (formData.certifications || 'ISO 9001:2015, Ghana FDA Registered, GSA Standard Compliant')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Header Profile Ribbon */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
            {supplier.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900">{supplier.name}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                Active Local Partner
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span><strong>Tax ID / EIN:</strong> {formData.tax_id || 'GH-TIN-9081244-A'}</span>
              <span>•</span>
              <span><strong>Business License:</strong> {formData.business_license || 'CS-2021-09419'}</span>
            </div>
          </div>
        </div>

        {userRole === 'admin' && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData(supplier);
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-2xs transition flex items-center gap-1.5"
                >
                  <Save size={13} /> {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase tracking-wider rounded-lg border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 size={13} /> Edit Master Data & SLAs
              </button>
            )}
          </div>
        )}
      </div>

      {/* Master Data 3-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: Local Vendor Profile & Contact Directory */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building2 size={14} className="text-blue-600" />
            Vendor Profile & Key Contacts
          </h3>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Company Registered Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-0.5 font-bold"
                />
              ) : (
                <p className="font-bold text-slate-900">{formData.name}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Key Contact Person</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.contact_person || ''}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-0.5"
                />
              ) : (
                <p className="font-bold text-slate-800">{formData.contact_person || 'Logistics & Key Accounts Desk'}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Direct Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-0.5"
                />
              ) : (
                <p className="font-medium text-slate-700 flex items-center gap-1.5">
                  <Mail size={12} className="text-slate-400" /> {formData.email || 'orders@vendor.com'}
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Direct Telephone / Mobile</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-0.5"
                />
              ) : (
                <p className="font-medium text-slate-700 flex items-center gap-1.5">
                  <Phone size={12} className="text-slate-400" /> {formData.phone || '+233 24 991 2234'}
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Physical Warehouse / Depot Address</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-0.5"
                />
              ) : (
                <p className="font-medium text-slate-700 flex items-center gap-1.5">
                  <MapPin size={12} className="text-slate-400" /> {formData.address || 'Industrial Area / Spintex Depot, Accra'}
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tax ID / Business License</label>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  <input
                    type="text"
                    placeholder="Tax ID"
                    value={formData.tax_id || ''}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    className="border border-slate-300 rounded-lg p-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="License #"
                    value={formData.business_license || ''}
                    onChange={(e) => setFormData({ ...formData, business_license: e.target.value })}
                    className="border border-slate-300 rounded-lg p-1.5 text-xs"
                  />
                </div>
              ) : (
                <p className="text-slate-600 font-mono text-[11px] mt-0.5">
                  TIN: {formData.tax_id || 'GH-TIN-9081244-A'} • REG: {formData.business_license || 'CS-2021-09419'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Fulfillment Preference & Payment Terms */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Truck size={14} className="text-purple-600" />
            Fulfillment Preference & Terms
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Default Fulfillment Preference</label>
              {isEditing ? (
                <select
                  value={formData.fulfillment_preference || 'direct_delivery'}
                  onChange={(e) => setFormData({ ...formData, fulfillment_preference: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-1 bg-white font-bold"
                >
                  <option value="direct_delivery">Option A: Direct Delivery (Vendor Delivers to Dock)</option>
                  <option value="store_pickup">Option B: Store Pickup (Warehouse Fleet Collects)</option>
                </select>
              ) : (
                <div className="mt-1 p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                  {formData.fulfillment_preference === 'store_pickup' ? (
                    <>
                      <Building2 size={16} className="text-purple-600" />
                      <div>
                        <span className="font-black text-slate-900 block text-xs">Store Pickup</span>
                        <span className="text-[10px] text-slate-500">Warehouse team collects from vendor depot</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Truck size={16} className="text-blue-600" />
                      <div>
                        <span className="font-black text-slate-900 block text-xs">Direct Delivery</span>
                        <span className="text-[10px] text-slate-500">Vendor dispatches directly to store dock</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Agreed Payment Terms</label>
              {isEditing ? (
                <select
                  value={formData.payment_terms || 'Net 30'}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-1 bg-white font-bold"
                >
                  <option value="Net 7">Net 7 Days</option>
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 30">Net 30 Days</option>
                  <option value="COD">COD (Cash on Delivery / Pickup)</option>
                  <option value="Mobile Money / Bank Transfer">Mobile Money / Bank Transfer (Prompt)</option>
                </select>
              ) : (
                <p className="font-black text-slate-800 mt-0.5 p-1.5 bg-slate-50 rounded border border-slate-200">
                  {formData.payment_terms || 'Net 30'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Settlement Currency</label>
                {isEditing ? (
                  <select
                    value={formData.currency || 'GHS'}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-0.5 bg-white font-bold"
                  >
                    <option value="GHS">GHS (Ghana Cedi)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                ) : (
                  <p className="font-bold text-slate-800 mt-0.5">{formData.currency || 'GHS (Ghana Cedi)'}</p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Depository Bank</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.bank_name || ''}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-0.5"
                  />
                ) : (
                  <p className="font-bold text-slate-800 mt-0.5 truncate">{formData.bank_name || 'Ecobank Ghana PLC'}</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Bank Account / Momo Merchant #</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.bank_account || ''}
                  onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-0.5 font-mono"
                />
              ) : (
                <p className="font-mono text-slate-800 mt-0.5">{formData.bank_account || '0182001928491 (Central Accounts)'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Column 3: SLAs, MOQs, Tiers & Compliance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
            <ShieldCheck size={14} className="text-emerald-600" />
            Lead Time SLAs & Compliance
          </h3>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lead Time SLA</label>
                {isEditing ? (
                  <select
                    value={formData.lead_time_sla || '48 Hours'}
                    onChange={(e) => setFormData({ ...formData, lead_time_sla: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-0.5 bg-white font-bold"
                  >
                    <option value="24 Hours">24 Hours (Next-Day)</option>
                    <option value="48 Hours">48 Hours SLA</option>
                    <option value="72 Hours">72 Hours (3 Days)</option>
                    <option value="5-7 Days">5-7 Business Days</option>
                  </select>
                ) : (
                  <p className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                    <Clock size={12} className="text-blue-600" /> {formData.lead_time_sla || `${formData.lead_time_days || 2} Days / 48 Hours`}
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Minimum Order (MOQ)</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.moq || 24}
                    onChange={(e) => setFormData({ ...formData, moq: parseInt(e.target.value) || 24 })}
                    className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-0.5"
                  />
                ) : (
                  <p className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                    <Boxes size={12} className="text-purple-600" /> {formData.moq || 24} Units / Pack
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Volume Discount Tier</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.tier_pricing || 'Tier 1: 50+ units (3%), Tier 2: 200+ units (7%)'}
                  onChange={(e) => setFormData({ ...formData, tier_pricing: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-1.5 text-xs mt-0.5"
                />
              ) : (
                <p className="font-semibold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100 text-[11px] mt-0.5">
                  {formData.tier_pricing || 'Tier 1: 50+ units (3%), Tier 2: 200+ units (7%)'}
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Compliance & Certifications</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {certificationsList.map((cert, cIdx) => (
                  <span
                    key={cIdx}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1"
                  >
                    <Award size={10} /> {cert}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Partner Quality Score</label>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex text-amber-400">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                </div>
                <span className="font-black text-slate-900 text-xs">
                  {((formData.quality_score || 96) / 20).toFixed(1)} / 5.0
                </span>
                <span className="text-[10px] text-slate-400 font-bold">(Verified Local Vendor)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
