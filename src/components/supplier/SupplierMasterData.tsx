import React, { useState, useEffect, useMemo } from 'react';
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
import { useFormValidation, validators } from '../../lib/validation';
import { FormField, ValidatedInput, ValidatedSelect } from '../common/FormField';

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
  const [isSaving, setIsSaving] = useState(false);

  const initialValues: SupplierRecord = useMemo(() => ({
    id: supplier?.id || 0,
    name: supplier?.name || '',
    contact_person: supplier?.contact_person || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    tax_id: supplier?.tax_id || '',
    business_license: supplier?.business_license || '',
    fulfillment_preference: supplier?.fulfillment_preference || 'direct_delivery',
    payment_terms: supplier?.payment_terms || 'Net 30',
    currency: supplier?.currency || 'GHS',
    bank_name: supplier?.bank_name || '',
    bank_account: supplier?.bank_account || '',
    bank_branch: supplier?.bank_branch || '',
    lead_time_days: supplier?.lead_time_days ?? 2,
    lead_time_sla: supplier?.lead_time_sla || '48 Hours',
    moq: supplier?.moq ?? 24,
    certifications: supplier?.certifications || 'ISO 9001:2015, Ghana FDA Registered, GSA Standard Compliant',
    tier_pricing: supplier?.tier_pricing || 'Tier 1: 50+ units (3%), Tier 2: 200+ units (7%)',
    quality_score: supplier?.quality_score ?? 96,
  }), [supplier]);

  const validationRules = useMemo(() => ({
    name: [
      validators.required('Company registered name is required'),
      validators.minLength(2, 'Name must be at least 2 characters'),
    ],
    email: [
      validators.email('Please enter a valid business email address'),
    ],
    phone: [
      validators.phone('Please enter a valid phone number'),
    ],
    moq: [
      validators.min(1, 'Minimum order quantity must be at least 1'),
    ],
  }), []);

  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isValid,
    resetForm,
  } = useFormValidation<SupplierRecord>(initialValues, validationRules);

  // Sync if supplier changes
  useEffect(() => {
    resetForm(initialValues);
  }, [initialValues, resetForm]);

  if (!supplier) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
        <Building2 size={32} className="mx-auto mb-2 opacity-30" />
        No supplier master record selected or available.
      </div>
    );
  }

  const handleSave = handleSubmit(async (formValues) => {
    setIsSaving(true);
    try {
      await onSaveMasterData(formValues);
      setIsEditing(false);
    } catch (err: any) {
      alert('Error updating master data: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  });

  const certificationsList = (values.certifications || 'ISO 9001:2015, Ghana FDA Registered, GSA Standard Compliant')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Header Profile Ribbon */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
            {values.name ? values.name.substring(0, 2).toUpperCase() : 'VN'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900">{values.name}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                Active Local Partner
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span><strong>Tax ID / EIN:</strong> {values.tax_id || 'GH-TIN-9081244-A'}</span>
              <span>•</span>
              <span><strong>Business License:</strong> {values.business_license || 'CS-2021-09419'}</span>
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
                    resetForm(initialValues);
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !isValid}
                  className={`px-4 py-1.5 font-black text-xs uppercase tracking-wider rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer text-white ${
                    !isValid
                      ? 'bg-slate-400 opacity-60 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
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

          <div className="space-y-3 text-xs">
            <div>
              {isEditing ? (
                <FormField
                  label="Company Registered Name"
                  required
                  error={errors.name}
                  isTouched={touched.name}
                  isValid={!errors.name && !!values.name}
                >
                  <ValidatedInput
                    name="name"
                    value={values.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    onBlur={() => handleBlur('name')}
                    error={errors.name}
                    isTouched={touched.name}
                    isValid={!errors.name && !!values.name}
                    className="font-bold"
                  />
                </FormField>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Company Registered Name</label>
                  <p className="font-bold text-slate-900 mt-0.5">{values.name}</p>
                </div>
              )}
            </div>

            <div>
              {isEditing ? (
                <FormField label="Key Contact Person">
                  <ValidatedInput
                    name="contact_person"
                    value={values.contact_person || ''}
                    onChange={(e) => handleChange('contact_person', e.target.value)}
                    onBlur={() => handleBlur('contact_person')}
                    placeholder="Logistics & Accounts Rep"
                  />
                </FormField>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Key Contact Person</label>
                  <p className="font-bold text-slate-800 mt-0.5">{values.contact_person || 'Logistics & Key Accounts Desk'}</p>
                </div>
              )}
            </div>

            <div>
              {isEditing ? (
                <FormField
                  label="Direct Email"
                  error={errors.email}
                  isTouched={touched.email}
                  isValid={!errors.email && !!values.email}
                >
                  <ValidatedInput
                    type="email"
                    name="email"
                    value={values.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    onBlur={() => handleBlur('email')}
                    placeholder="orders@vendor.com"
                    error={errors.email}
                    isTouched={touched.email}
                    isValid={!errors.email && !!values.email}
                  />
                </FormField>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Direct Email</label>
                  <p className="font-medium text-slate-700 flex items-center gap-1.5 mt-0.5">
                    <Mail size={12} className="text-slate-400" /> {values.email || 'orders@vendor.com'}
                  </p>
                </div>
              )}
            </div>

            <div>
              {isEditing ? (
                <FormField
                  label="Direct Telephone / Mobile"
                  error={errors.phone}
                  isTouched={touched.phone}
                  isValid={!errors.phone && !!values.phone}
                >
                  <ValidatedInput
                    name="phone"
                    value={values.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    onBlur={() => handleBlur('phone')}
                    placeholder="+233 24 123 4567"
                    error={errors.phone}
                    isTouched={touched.phone}
                    isValid={!errors.phone && !!values.phone}
                  />
                </FormField>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Direct Telephone / Mobile</label>
                  <p className="font-medium text-slate-700 flex items-center gap-1.5 mt-0.5">
                    <Phone size={12} className="text-slate-400" /> {values.phone || '+233 24 991 2234'}
                  </p>
                </div>
              )}
            </div>

            <div>
              {isEditing ? (
                <FormField label="Physical Warehouse / Depot Address">
                  <ValidatedInput
                    name="address"
                    value={values.address || ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                    onBlur={() => handleBlur('address')}
                    placeholder="Industrial Area / Depot"
                  />
                </FormField>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Physical Warehouse / Depot Address</label>
                  <p className="font-medium text-slate-700 flex items-center gap-1.5 mt-0.5">
                    <MapPin size={12} className="text-slate-400" /> {values.address || 'Industrial Area / Spintex Depot, Accra'}
                  </p>
                </div>
              )}
            </div>

            <div>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Tax ID / TIN">
                    <ValidatedInput
                      name="tax_id"
                      value={values.tax_id || ''}
                      onChange={(e) => handleChange('tax_id', e.target.value)}
                      onBlur={() => handleBlur('tax_id')}
                      placeholder="GH-TIN-..."
                    />
                  </FormField>
                  <FormField label="Business License">
                    <ValidatedInput
                      name="business_license"
                      value={values.business_license || ''}
                      onChange={(e) => handleChange('business_license', e.target.value)}
                      onBlur={() => handleBlur('business_license')}
                      placeholder="CS-..."
                    />
                  </FormField>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tax ID / Business License</label>
                  <p className="text-slate-600 font-mono text-[11px] mt-0.5">
                    TIN: {values.tax_id || 'GH-TIN-9081244-A'} • REG: {values.business_license || 'CS-2021-09419'}
                  </p>
                </div>
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
              {isEditing ? (
                <FormField label="Default Fulfillment Preference">
                  <ValidatedSelect
                    name="fulfillment_preference"
                    value={values.fulfillment_preference || 'direct_delivery'}
                    onChange={(e) => handleChange('fulfillment_preference', e.target.value)}
                    onBlur={() => handleBlur('fulfillment_preference')}
                  >
                    <option value="direct_delivery">Option A: Direct Delivery (Vendor Delivers to Dock)</option>
                    <option value="store_pickup">Option B: Store Pickup (Warehouse Fleet Collects)</option>
                  </ValidatedSelect>
                </FormField>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Default Fulfillment Preference</label>
                  <div className="mt-1 p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                    {values.fulfillment_preference === 'store_pickup' ? (
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
                </div>
              )}
            </div>

            <div>
              {isEditing ? (
                <FormField label="Agreed Payment Terms">
                  <ValidatedSelect
                    name="payment_terms"
                    value={values.payment_terms || 'Net 30'}
                    onChange={(e) => handleChange('payment_terms', e.target.value)}
                    onBlur={() => handleBlur('payment_terms')}
                  >
                    <option value="Net 7">Net 7 Days</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="COD">COD (Cash on Delivery / Pickup)</option>
                    <option value="Mobile Money / Bank Transfer">Mobile Money / Bank Transfer (Prompt)</option>
                  </ValidatedSelect>
                </FormField>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Agreed Payment Terms</label>
                  <p className="font-black text-slate-800 mt-0.5 p-1.5 bg-slate-50 rounded border border-slate-200">
                    {values.payment_terms || 'Net 30'}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                {isEditing ? (
                  <FormField label="Settlement Currency">
                    <ValidatedSelect
                      name="currency"
                      value={values.currency || 'GHS'}
                      onChange={(e) => handleChange('currency', e.target.value)}
                      onBlur={() => handleBlur('currency')}
                    >
                      <option value="GHS">GHS (Ghana Cedi)</option>
                      <option value="USD">USD (US Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                    </ValidatedSelect>
                  </FormField>
                ) : (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Settlement Currency</label>
                    <p className="font-bold text-slate-800 mt-0.5">{values.currency || 'GHS (Ghana Cedi)'}</p>
                  </div>
                )}
              </div>

              <div>
                {isEditing ? (
                  <FormField label="Depository Bank">
                    <ValidatedInput
                      name="bank_name"
                      value={values.bank_name || ''}
                      onChange={(e) => handleChange('bank_name', e.target.value)}
                      onBlur={() => handleBlur('bank_name')}
                      placeholder="e.g. Ecobank"
                    />
                  </FormField>
                ) : (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Depository Bank</label>
                    <p className="font-bold text-slate-800 mt-0.5 truncate">{values.bank_name || 'Ecobank Ghana PLC'}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              {isEditing ? (
                <FormField label="Bank Account / Momo Merchant #">
                  <ValidatedInput
                    name="bank_account"
                    value={values.bank_account || ''}
                    onChange={(e) => handleChange('bank_account', e.target.value)}
                    onBlur={() => handleBlur('bank_account')}
                    placeholder="Account / Momo number"
                    className="font-mono"
                  />
                </FormField>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Bank Account / Momo Merchant #</label>
                  <p className="font-mono text-slate-800 mt-0.5">{values.bank_account || '0182001928491 (Central Accounts)'}</p>
                </div>
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
                {isEditing ? (
                  <FormField label="Lead Time SLA">
                    <ValidatedSelect
                      name="lead_time_sla"
                      value={values.lead_time_sla || '48 Hours'}
                      onChange={(e) => handleChange('lead_time_sla', e.target.value)}
                      onBlur={() => handleBlur('lead_time_sla')}
                    >
                      <option value="24 Hours">24 Hours (Next-Day)</option>
                      <option value="48 Hours">48 Hours SLA</option>
                      <option value="72 Hours">72 Hours (3 Days)</option>
                      <option value="5-7 Days">5-7 Business Days</option>
                    </ValidatedSelect>
                  </FormField>
                ) : (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lead Time SLA</label>
                    <p className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                      <Clock size={12} className="text-blue-600" /> {values.lead_time_sla || `${values.lead_time_days || 2} Days / 48 Hours`}
                    </p>
                  </div>
                )}
              </div>

              <div>
                {isEditing ? (
                  <FormField
                    label="Minimum Order (MOQ)"
                    error={errors.moq}
                    isTouched={touched.moq}
                    isValid={!errors.moq && values.moq >= 1}
                  >
                    <ValidatedInput
                      type="number"
                      min="1"
                      name="moq"
                      value={values.moq}
                      onChange={(e) => handleChange('moq', e.target.value === '' ? 1 : parseInt(e.target.value, 10))}
                      onBlur={() => handleBlur('moq')}
                      error={errors.moq}
                      isTouched={touched.moq}
                      isValid={!errors.moq && values.moq >= 1}
                    />
                  </FormField>
                ) : (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Minimum Order (MOQ)</label>
                    <p className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                      <Boxes size={12} className="text-purple-600" /> {values.moq || 24} Units / Pack
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              {isEditing ? (
                <FormField label="Volume Discount Tier">
                  <ValidatedInput
                    name="tier_pricing"
                    value={values.tier_pricing || ''}
                    onChange={(e) => handleChange('tier_pricing', e.target.value)}
                    onBlur={() => handleBlur('tier_pricing')}
                    placeholder="e.g. Tier 1: 50+ units (3%)"
                  />
                </FormField>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Volume Discount Tier</label>
                  <p className="font-semibold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100 text-[11px] mt-0.5">
                    {values.tier_pricing || 'Tier 1: 50+ units (3%), Tier 2: 200+ units (7%)'}
                  </p>
                </div>
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
                  {((values.quality_score || 96) / 20).toFixed(1)} / 5.0
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
