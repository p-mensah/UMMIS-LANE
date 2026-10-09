import React, { useState, useEffect } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useNotifications } from '../../context/NotificationContext';
import { formatGHS } from '../../lib/formatters';
import { uploadToCloudinary, MAX_FILE_SIZE_BYTES } from '../../lib/cloudinary';
import {
  FileText,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface PurchaseOrderSummary {
  id: number;
  supplier_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  invoice_number?: string;
  invoice_status?: string;
}

interface UploadInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSupplier: string;
  purchases: PurchaseOrderSummary[];
  preselectedPoId?: number;
  onInvoiceUploaded?: () => void;
}

export default function UploadInvoiceModal({
  isOpen,
  onClose,
  activeSupplier,
  purchases,
  preselectedPoId,
  onInvoiceUploaded
}: UploadInvoiceModalProps) {
  const { addToast } = useNotifications();
  useModalDismiss(isOpen, onClose);

  const eligiblePOs = purchases.filter(
    (p) => (!activeSupplier || p.supplier_name.toLowerCase().includes(activeSupplier.toLowerCase())) && p.status !== 'cancelled'
  );

  const [selectedPoId, setSelectedPoId] = useState<number | ''>(
    preselectedPoId || (eligiblePOs.length > 0 ? eligiblePOs[0].id : '')
  );

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceAmount, setInvoiceAmount] = useState<number | ''>('');
  const [paymentTerms, setPaymentTerms] = useState<'Net 30' | 'Net 60' | 'COD'>('Net 30');
  const [notes, setNotes] = useState('');

  // File upload state (<= 1MB constraint)
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Sync selected PO and prefill amount
  const targetPO = purchases.find((p) => p.id === Number(selectedPoId));

  useEffect(() => {
    if (targetPO) {
      setInvoiceAmount(targetPO.total_amount);
      if (!invoiceNumber) {
        setInvoiceNumber(`INV-${targetPO.id}-${Date.now().toString().slice(-4)}`);
      }
    }
  }, [selectedPoId, targetPO]);

  // 3-Way Match Calculation preview
  const variance = targetPO && invoiceAmount !== '' ? Math.abs(Number(invoiceAmount) - targetPO.total_amount) : 0;
  const isMatch = variance <= 0.5;
  const isPoReceived = targetPO?.status === 'received';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setUploadError(null);

    // Initial check: if raw file is wildly oversized (> 10MB), alert immediately
    if (selected.size > 10 * 1024 * 1024) {
      setUploadError('File is too large (> 10MB). Please select a file under 5MB to compress below 1MB.');
      return;
    }

    setFile(selected);
    if (selected.type.startsWith('image/')) {
      const url = URL.createObjectURL(selected);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoId) {
      addToast({ title: 'Select Purchase Order', message: 'Please select an active purchase order to invoice against.', type: 'warning' });
      return;
    }

    if (!invoiceNumber.trim()) {
      addToast({ title: 'Invoice Number Required', message: 'Please provide a valid vendor invoice reference #.', type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);

    try {
      let documentUrl: string | undefined = undefined;

      // Upload document through Cloudinary proxy if file attached
      if (file) {
        setIsCompressing(true);
        try {
          const uploadRes = await uploadToCloudinary(file, {
            folder: 'ummis_invoices',
            fileName: `INV_${selectedPoId}_${invoiceNumber}`
          });
          documentUrl = uploadRes.url;
        } finally {
          setIsCompressing(false);
        }
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/purchases/${selectedPoId}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          invoice_number: invoiceNumber.trim(),
          invoice_date: invoiceDate,
          amount: Number(invoiceAmount),
          payment_terms: paymentTerms,
          document_url: documentUrl,
          notes: notes.trim()
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to submit invoice');
      }

      addToast({
        title: 'Invoice Submitted Successfully! 🧾',
        message: `Invoice #${invoiceNumber} logged against PO #PO-${selectedPoId}. 3-Way Match: ${isMatch && isPoReceived ? 'VERIFIED' : 'PENDING'}.`,
        type: 'success'
      });

      if (onInvoiceUploaded) onInvoiceUploaded();
      onClose();
    } catch (err: any) {
      setUploadError(err.message || 'Invoice submission failed');
    } finally {
      setIsSubmitting(false);
      setIsCompressing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/30 text-emerald-400 border border-emerald-500/30">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Upload Supplier Invoice & 3-Way Match
              </h2>
              <p className="text-[11px] text-slate-300 font-medium">
                Cloudinary Storage (Max 1MB) • Automated PO ↔ GRN ↔ Invoice Reconciliation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {uploadError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              <div>
                <strong className="font-bold">Upload Error:</strong> {uploadError}
              </div>
            </div>
          )}

          {/* 1. Target Purchase Order Selection */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
              Select Purchase Order to Invoice Against <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedPoId}
              onChange={(e) => setSelectedPoId(e.target.value ? Number(e.target.value) : '')}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">-- Choose Purchase Order --</option>
              {eligiblePOs.map((p) => (
                <option key={p.id} value={p.id}>
                  #PO-{p.id} • {p.supplier_name} • {formatGHS(p.total_amount)} ({p.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Invoice Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                Vendor Invoice # <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. INV-904812"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                Invoice Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                Invoiced Amount (GHS) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value ? parseFloat(e.target.value) : '')}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                Payment Terms <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentTerms}
                onChange={(e: any) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="Net 30">Net 30 Days (Standard SLA)</option>
                <option value="Net 60">Net 60 Days (Extended)</option>
                <option value="COD">Cash on Delivery (Immediate)</option>
              </select>
            </div>
          </div>

          {/* 3. Automated 3-Way Matching Status Indicator Preview */}
          {targetPO && (
            <div className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
              isMatch && isPoReceived
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : !isMatch
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className={isMatch && isPoReceived ? 'text-emerald-600' : 'text-amber-600'} />
                <div>
                  <div className="font-black text-xs uppercase tracking-wide">
                    {isMatch && isPoReceived
                      ? '3-Way Match Verified (100%)'
                      : !isMatch
                      ? `Variance Detected: ${formatGHS(variance)}`
                      : 'Pending Warehouse GRN Stock Receipt'}
                  </div>
                  <div className="text-[10px] opacity-80">
                    PO Value: {formatGHS(targetPO.total_amount)} • Invoice Amount: {formatGHS(Number(invoiceAmount) || 0)}
                  </div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                isMatch && isPoReceived
                  ? 'bg-emerald-200 text-emerald-800'
                  : !isMatch
                  ? 'bg-amber-200 text-amber-900'
                  : 'bg-blue-200 text-blue-800'
              }`}>
                {isMatch && isPoReceived ? 'Match Approved' : !isMatch ? 'Review Needed' : 'Pending GRN'}
              </span>
            </div>
          )}

          {/* 4. Document / Invoice File Upload with Cloudinary (<= 1MB Limit) */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
              Invoice Document / Attachment (Strictly ≤ 1.0MB • Auto-compressed to Cloudinary)
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-3 text-center transition-colors bg-slate-50/60">
              <input
                type="file"
                id="invoice-file-input"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="invoice-file-input" className="cursor-pointer block">
                <Upload size={20} className="mx-auto text-slate-400 mb-1" />
                <span className="font-bold text-blue-600 hover:underline block">
                  {file ? file.name : 'Click to select invoice PDF or Image'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  PDF, JPG, PNG supported • Images automatically compressed below 1MB
                </span>
              </label>

              {file && (
                <div className="mt-2 text-[11px] font-bold text-slate-600 flex items-center justify-center gap-2">
                  <span>Selected: {file.name}</span>
                  <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setFilePreview(null); }}
                    className="text-rose-500 hover:text-rose-700 p-0.5"
                    title="Remove file"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 5. Notes */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
              Audit Notes & Remittance Details
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Electronic tax invoice sent with delivery truck. Remit payment to Standard Chartered Bank."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting || isCompressing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>{isCompressing ? 'Compressing & Uploading...' : 'Submitting Invoice...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Confirm & Upload Invoice</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
