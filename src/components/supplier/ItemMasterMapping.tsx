import React, { useState, useEffect } from 'react';
import { formatGHS } from '../../lib/formatters';
import { useNotifications } from '../../context/NotificationContext';
import { uploadToCloudinary } from '../../lib/cloudinary';
import {
  Boxes,
  Barcode,
  Tag,
  FileText,
  Upload,
  Search,
  Plus,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Percent,
  Calendar,
  Layers,
  X,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { CediSign } from '../common/CediSign';

interface TierDiscount {
  min_qty: number;
  discount_pct: number;
}

interface ComplianceDoc {
  id: string;
  type: 'SDS' | 'CoA' | 'Spec Sheet';
  title: string;
  url: string;
  file_size?: string;
  uploaded_at: string;
}

interface ItemMasterRecord {
  id: number;
  product_id: number;
  supplier_name: string;
  supplier_sku: string;
  internal_sku: string;
  product_name: string;
  barcode?: string;
  unit_of_measure: string;
  brand?: string;
  unit_cost: number;
  moq: number;
  tiered_discounts?: TierDiscount[];
  documents?: ComplianceDoc[];
  current_stock?: number;
  reorder_point?: number;
  safety_stock?: number;
  lead_time_days?: number;
}

interface ItemMasterMappingProps {
  activeSupplier: string;
  userRole?: string;
}

export default function ItemMasterMapping({ activeSupplier, userRole = 'admin' }: ItemMasterMappingProps) {
  const { addToast } = useNotifications();
  const [activeSubTab, setActiveSubTab] = useState<'cross_ref' | 'pricing' | 'documents'>('cross_ref');
  const [items, setItems] = useState<ItemMasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Upload modal for SDS / CoA / Spec Sheet
  const [selectedItemForDoc, setSelectedItemForDoc] = useState<ItemMasterRecord | null>(null);
  const [docType, setDocType] = useState<'SDS' | 'CoA' | 'Spec Sheet'>('SDS');
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);

  const loadItemMaster = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/supplier/item-master?supplier_name=${encodeURIComponent(activeSupplier)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to load item master:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItemMaster();
  }, [activeSupplier]);

  const filteredItems = items.filter((it) => {
    const q = searchQuery.toLowerCase();
    return (
      it.product_name.toLowerCase().includes(q) ||
      it.internal_sku.toLowerCase().includes(q) ||
      it.supplier_sku.toLowerCase().includes(q) ||
      (it.barcode && it.barcode.toLowerCase().includes(q))
    );
  });

  const handleUploadDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForDoc || !docFile) {
      setDocUploadError('Please select a valid document under 1MB.');
      return;
    }

    setIsUploadingDoc(true);
    setDocUploadError(null);

    try {
      // Upload to Cloudinary (compresses if image, checks <= 1MB)
      const uploadRes = await uploadToCloudinary(docFile, {
        folder: 'ummis_compliance_docs',
        fileName: `${docType}_${selectedItemForDoc.internal_sku}`
      });

      const token = localStorage.getItem('token');
      const res = await fetch('/api/supplier/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          item_id: selectedItemForDoc.id,
          type: docType,
          title: docTitle.trim() || `${selectedItemForDoc.product_name} ${docType}`,
          url: uploadRes.url,
          file_size: `${(uploadRes.bytes / 1024).toFixed(1)} KB`
        })
      });

      if (!res.ok) {
        throw new Error('Failed to record compliance document');
      }

      addToast({
        title: 'Compliance Document Uploaded! 📋',
        message: `${docType} document registered for ${selectedItemForDoc.product_name}.`,
        type: 'success'
      });

      setSelectedItemForDoc(null);
      setDocFile(null);
      setDocTitle('');
      await loadItemMaster();
    } catch (err: any) {
      setDocUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Subtabs Header */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
          <button
            onClick={() => setActiveSubTab('cross_ref')}
            className={`px-3 py-1.5 rounded-md font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'cross_ref' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Barcode size={14} className="text-blue-600" />
            <span>SKU Cross-Reference</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pricing')}
            className={`px-3 py-1.5 rounded-md font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'pricing' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CediSign size={14} className="text-emerald-600" />
            <span>Pricing Rules & Tier Discounts</span>
          </button>

          <button
            onClick={() => setActiveSubTab('documents')}
            className={`px-3 py-1.5 rounded-md font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'documents' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={14} className="text-purple-600" />
            <span>Document Repository (SDS / CoA)</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Search SKU, barcode, title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Subtab 1: Cross-Reference Table */}
      {activeSubTab === 'cross_ref' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Barcode size={15} className="text-blue-600" />
                Item Master Cross-Reference ({activeSupplier})
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Dual-SKU mapping linking internal inventory codes to external vendor catalog and EAN-13 barcodes
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200">
              {filteredItems.length} Products Mapped
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Internal SKU</th>
                  <th className="p-3">Supplier SKU</th>
                  <th className="p-3">UPC / EAN Barcode</th>
                  <th className="p-3">Brand / Maker</th>
                  <th className="p-3">Unit</th>
                  <th className="p-3 text-right">Contract Unit Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">
                      {item.product_name}
                    </td>
                    <td className="p-3 font-mono font-bold text-blue-600 bg-blue-50/50">
                      {item.internal_sku}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-700 bg-slate-50">
                      {item.supplier_sku}
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {item.barcode || 'N/A'}
                    </td>
                    <td className="p-3 text-slate-600 font-medium">
                      {item.brand || activeSupplier}
                    </td>
                    <td className="p-3 text-slate-500">
                      {item.unit_of_measure}
                    </td>
                    <td className="p-3 text-right font-black text-slate-900">
                      {formatGHS(item.unit_cost)}
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">
                      No cross-referenced product mappings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 2: Pricing Rules & Tier Discounts */}
      {activeSubTab === 'pricing' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Percent size={15} className="text-emerald-600" />
                Contract Pricing Matrix, MOQs & Tiered Volume Rebates
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Procurement agreement pricing, minimum order quantities, and pre-negotiated tiered volume discount ladders
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <th className="p-3">Product Name & SKU</th>
                  <th className="p-3">Standard Unit Cost</th>
                  <th className="p-3">Minimum Order Qty (MOQ)</th>
                  <th className="p-3">Tiered Volume Discounts</th>
                  <th className="p-3 text-right">Lead Time SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">
                      <div>{item.product_name}</div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {item.internal_sku} ↔ {item.supplier_sku}
                      </span>
                    </td>
                    <td className="p-3 font-black text-slate-900 text-sm">
                      {formatGHS(item.unit_cost)}
                    </td>
                    <td className="p-3 font-bold text-slate-700">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {item.moq} {item.unit_of_measure}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {item.tiered_discounts && item.tiered_discounts.length > 0 ? (
                          item.tiered_discounts.map((tier, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200"
                            >
                              {tier.min_qty}+ units: -{tier.discount_pct}% (
                              {formatGHS(item.unit_cost * (1 - tier.discount_pct / 100))})
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-[11px]">Flat rate (No tiers)</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right font-bold text-slate-700">
                      {item.lead_time_days || 3} Days Turnaround
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 3: Document Repository */}
      {activeSubTab === 'documents' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <FolderOpen size={15} className="text-purple-600" />
                Technical & Compliance Document Repository (SDS, CoA, Spec Sheets)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Safety Data Sheets (SDS), Certificates of Analysis (CoA), and technical specification sheets stored on Cloudinary (≤ 1MB)
              </p>
            </div>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-black text-slate-900 text-xs truncate">
                      {item.product_name}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedItemForDoc(item);
                        setDocTitle(`${item.product_name} Spec`);
                      }}
                      className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 transition cursor-pointer shrink-0"
                      title="Upload new compliance document"
                    >
                      <Plus size={11} /> Upload Doc
                    </button>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    SKU: {item.internal_sku}
                  </div>

                  {/* Attached Documents List */}
                  <div className="mt-3 space-y-1.5">
                    {item.documents && item.documents.length > 0 ? (
                      item.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase shrink-0 ${
                                doc.type === 'SDS'
                                  ? 'bg-rose-100 text-rose-800'
                                  : doc.type === 'CoA'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {doc.type}
                            </span>
                            <span className="font-bold text-slate-800 truncate" title={doc.title}>
                              {doc.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-slate-400">{doc.file_size || 'PDF'}</span>
                            {doc.url && doc.url !== '#' && (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-blue-600 hover:text-blue-800"
                                title="Open document"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-slate-400 text-[11px]">
                        No compliance documents uploaded yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {selectedItemForDoc && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItemForDoc(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-purple-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Upload Compliance Document
                </h3>
              </div>
              <button
                onClick={() => setSelectedItemForDoc(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadDocumentSubmit} className="p-4 space-y-3 text-xs">
              {docUploadError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                  {docUploadError}
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Product</span>
                <span className="font-bold text-slate-900 text-xs">
                  {selectedItemForDoc.product_name} ({selectedItemForDoc.internal_sku})
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                  Document Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={docType}
                  onChange={(e: any) => setDocType(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white font-bold"
                >
                  <option value="SDS">Safety Data Sheet (SDS)</option>
                  <option value="CoA">Certificate of Analysis (CoA)</option>
                  <option value="Spec Sheet">Technical Spec Sheet</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. 2026 Material Safety Data Sheet"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                  File (Strictly ≤ 1.0MB • Auto-upload to Cloudinary)
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  required
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedItemForDoc(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingDoc}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isUploadingDoc ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                  <span>{isUploadingDoc ? 'Uploading...' : 'Save to Cloudinary'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
