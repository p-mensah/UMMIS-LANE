import React, { useState, useEffect } from 'react';
import { formatGHS } from '../../lib/formatters';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { fetchApi } from '../../lib/api';
import { uploadToCloudinary } from '../../lib/cloudinary';
import type { SupplierInvoice, Shipment } from '../../types/supplier';
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Upload,
  ShieldCheck,
  Calendar,
  AlertCircle,
  X,
  Check
} from 'lucide-react';

interface SupplierInvoicesTabProps {
  invoices: SupplierInvoice[];
  shipments: Shipment[];
  purchases?: any[];
  activeSupplier: string;
  onRefresh: () => void;
  userRole?: string;
  preselectedShipment?: Shipment | null;
  onClearPreselectedShipment?: () => void;
  preselectedPO?: any | null;
  onClearPreselectedPO?: () => void;
}

export default function SupplierInvoicesTab({
  invoices,
  shipments,
  purchases = [],
  activeSupplier,
  onRefresh,
  userRole,
  preselectedShipment,
  onClearPreselectedShipment,
  preselectedPO,
  onClearPreselectedPO
}: SupplierInvoicesTabProps) {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const isAdmin = userRole === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'scheduled' | 'paid'>('all');
  const [showAttachModal, setShowAttachModal] = useState(!!preselectedShipment || !!preselectedPO);

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | ''>(preselectedShipment?.id || '');
  const [amount, setAmount] = useState<number | ''>(
    preselectedShipment?.total_value || preselectedPO?.total_amount || ''
  );
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState(
    preselectedPO ? `Invoice for Store Purchase Order #PO-${preselectedPO.id}` : ''
  );

  useEffect(() => {
    if (preselectedPO) {
      setSelectedShipmentId('');
      setAmount(preselectedPO.total_amount || '');
      setInvoiceNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setPaymentTerms('Net 30');
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setDueDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
      setNotes(`Invoice attached for Store Purchase Order #PO-${preselectedPO.id}`);
      setShowAttachModal(true);
    }
  }, [preselectedPO]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedDocUrl, setUploadedDocUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Settlement Status Modal for Admin
  const [settlingInvoice, setSettlingInvoice] = useState<SupplierInvoice | null>(null);
  const [targetStatus, setTargetStatus] = useState<'unpaid' | 'scheduled' | 'paid'>('scheduled');
  const [paymentMethod, setPaymentMethod] = useState('Direct Bank Transfer');

  const eligibleShipments = shipments.filter(s => s.status === 'delivered' || s.status === 'verified');

  const handleOpenAttach = (shipment?: Shipment) => {
    const target = shipment || eligibleShipments[0];
    setSelectedShipmentId(target ? target.id : '');
    setAmount(target ? target.total_value || '' : '');
    setInvoiceNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setPaymentTerms('Net 30');
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setDueDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    setNotes(target ? `Invoice attached for shipment ${target.shipment_number}` : '');
    setSelectedFile(null);
    setUploadedDocUrl('');
    setShowAttachModal(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      addToast('File exceeds 1MB limit. Please compress or select a smaller document.', 'error');
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);
    try {
      const res = await uploadToCloudinary(file, { folder: 'supplier_invoices' });
      setUploadedDocUrl(res.url);
      addToast('Invoice document uploaded to vault', 'success');
    } catch (err: any) {
      addToast('Failed to upload document: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim() || amount === '' || Number(amount) <= 0) {
      addToast('Invoice number and a valid amount are required', 'error');
      return;
    }

    const ship = shipments.find(s => s.id === Number(selectedShipmentId));

    setIsSubmitting(true);
    try {
      await fetchApi('/supplier/invoices-ledger', {
        method: 'POST',
        body: JSON.stringify({
          supplier_name: activeSupplier,
          invoice_number: invoiceNumber.trim(),
          shipment_id: ship?.id || null,
          shipment_number: ship?.shipment_number || (preselectedPO ? `PO #${preselectedPO.id}` : null),
          amount: Number(amount),
          payment_terms: paymentTerms,
          invoice_date: invoiceDate,
          due_date: dueDate,
          document_url: uploadedDocUrl,
          file_name: selectedFile?.name || 'invoice.pdf',
          notes: notes.trim()
        })
      });

      addToast(`Invoice ${invoiceNumber} attached successfully.`, 'success');
      setShowAttachModal(false);
      if (onClearPreselectedShipment) onClearPreselectedShipment();
      if (onClearPreselectedPO) onClearPreselectedPO();
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to submit invoice', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!settlingInvoice) return;
    try {
      await fetchApi(`/supplier/invoices-ledger/${settlingInvoice.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: targetStatus,
          payment_method: paymentMethod,
          notes: `Settlement updated to ${targetStatus} by ${user?.name}`
        })
      });

      addToast(`Invoice ${settlingInvoice.invoice_number} marked as ${targetStatus}.`, 'success');
      setSettlingInvoice(null);
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to update status', 'error');
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      (inv.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.shipment_number || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 size={12} /> Paid
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-300">
            <Calendar size={12} /> Scheduled
          </span>
        );
      case 'unpaid':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
            <Clock size={12} /> Unpaid
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Functional Table Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <CreditCard className="text-blue-600" size={18} />
            Supplier Invoices & Settlement Ledger
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Upload invoices tied directly to delivered/verified shipments, view payment status, and review Net terms.
          </p>
        </div>

        {/* Primary Action Button: "Attach Invoice" ONLY inside this functional page */}
        <button
          type="button"
          onClick={() => handleOpenAttach()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer self-start md:self-auto shrink-0"
        >
          <Plus size={15} /> Attach Invoice
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Search by invoice #, shipment reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase shrink-0">Filter:</span>
          {(['all', 'unpaid', 'scheduled', 'paid'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs font-bold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'all' ? 'All Invoices' : st.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black tracking-wider text-[10px]">
                <th className="py-3 px-4">Invoice # & Dates</th>
                <th className="py-3 px-4">Shipment Reference</th>
                <th className="py-3 px-4">Invoice Amount</th>
                <th className="py-3 px-4">Payment Terms & Due Date</th>
                <th className="py-3 px-4">Settlement Status</th>
                <th className="py-3 px-4">Document Vault</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <CreditCard size={28} className="mx-auto mb-2 opacity-30" />
                    No invoices recorded in this view.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{inv.invoice_number}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Issued: {new Date(inv.invoice_date).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {inv.shipment_number ? (
                        <div className="font-mono text-xs font-bold text-blue-600">
                          {inv.shipment_number}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">General Delivery</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                      {formatGHS(inv.amount)}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{inv.payment_terms || 'Net 30'}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Due: {new Date(inv.due_date).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {getStatusBadge(inv.status)}
                      {inv.paid_by && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Paid by {inv.paid_by}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {inv.document_url ? (
                        <a
                          href={inv.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <FileText size={13} /> View Invoice <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No File</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setSettlingInvoice(inv);
                            setTargetStatus(inv.status === 'unpaid' ? 'scheduled' : 'paid');
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-[11px] transition-colors cursor-pointer"
                        >
                          Update Settlement
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Attach Invoice */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Attach Supplier Invoice</h3>
                  <p className="text-[11px] text-slate-500">Tied directly to delivered & verified restocks</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAttachModal(false);
                  if (onClearPreselectedShipment) onClearPreselectedShipment();
                  if (onClearPreselectedPO) onClearPreselectedPO();
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {preselectedPO ? `Attached Store Order (#PO-${preselectedPO.id})` : 'Select Consignment / Shipment *'}
                </label>
                {preselectedPO ? (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold text-blue-900 flex items-center justify-between">
                    <span>Store PO #PO-{preselectedPO.id} ({formatGHS(preselectedPO.total_amount)})</span>
                    <span className="text-[10px] text-blue-700 font-mono">Status: {preselectedPO.status?.toUpperCase()}</span>
                  </div>
                ) : (
                  <select
                    required
                    value={selectedShipmentId}
                    onChange={(e) => {
                      const sid = e.target.value === '' ? '' : Number(e.target.value);
                      setSelectedShipmentId(sid);
                      const found = shipments.find(s => s.id === sid);
                      if (found?.total_value) setAmount(found.total_value);
                    }}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Choose Consignment --</option>
                    {eligibleShipments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shipment_number} ({s.carrier} - {formatGHS(s.total_value || 0)}) [{s.status.toUpperCase()}]
                      </option>
                    ))}
                    {eligibleShipments.length === 0 && (
                      <option value="" disabled>No delivered shipments yet</option>
                    )}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Invoice Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-NEST-8821"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Invoice Amount (GHS) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-2 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => {
                      setPaymentTerms(e.target.value);
                      const days = e.target.value === 'Net 60' ? 60 : 30;
                      setDueDate(new Date(Date.now() + days * 86400000).toISOString().slice(0, 10));
                    }}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-white focus:outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="Net 30">Net 30 (30 Days)</option>
                    <option value="Net 60">Net 60 (60 Days)</option>
                    <option value="COD">Cash on Delivery (COD)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Cloudinary Document Upload (Strictly <= 1MB) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Upload Invoice Document (PDF/Image &le; 1MB)
                </label>
                <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center bg-slate-50 hover:bg-slate-100 transition relative">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center gap-1">
                    <Upload size={18} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">
                      {isUploading
                        ? 'Uploading to Cloudinary...'
                        : selectedFile
                        ? selectedFile.name
                        : 'Choose File or Drag & Drop'}
                    </span>
                    <span className="text-[10px] text-slate-400">Enforced 1MB limit • Cloudinary Vault</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Banking coordinates, settlement instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachModal(false);
                    if (onClearPreselectedShipment) onClearPreselectedShipment();
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Submitting...' : 'Attach & Submit Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Settlement Status Modal */}
      {settlingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Update Invoice Settlement</h3>
                <p className="text-[11px] text-slate-500">Invoice #{settlingInvoice.invoice_number}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Payment Status</label>
                <select
                  value={targetStatus}
                  onChange={(e: any) => setTargetStatus(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 bg-white focus:outline-none focus:border-blue-500 font-bold"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="scheduled">Scheduled for Payment</option>
                  <option value="paid">Paid & Settled</option>
                </select>
              </div>

              {targetStatus === 'paid' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setSettlingInvoice(null)}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateStatus}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition cursor-pointer"
              >
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
