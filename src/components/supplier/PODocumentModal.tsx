import React from 'react';
import { formatGHS } from '../../lib/formatters';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useNotifications } from '../../context/NotificationContext';
import {
  Printer,
  Download,
  X,
  Building2,
  Calendar,
  Truck,
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  User
} from 'lucide-react';

interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

interface PurchaseOrder {
  id: number;
  user_id: number;
  user_name?: string;
  supplier_name: string;
  supplier_contact?: string;
  total_amount: number;
  status: string;
  notes?: string;
  expected_date?: string;
  received_at?: string;
  confirmed_by?: string;
  created_at: string;
  item_count?: number;
  total_units?: number;
  items?: PurchaseItem[];
  carrier?: string;
  tracking_number?: string;
  dispatched_at?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  acknowledgment_notes?: string;
  invoice_number?: string;
  invoice_status?: string;
  fulfillment_mode?: string;
  driver_name?: string;
  driver_phone?: string;
  vehicle_number?: string;
  dock_slot?: string;
  pickup_address?: string;
  pickup_code?: string;
  eta_window?: string;
}

interface PODocumentModalProps {
  po: PurchaseOrder | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PODocumentModal({ po, isOpen, onClose }: PODocumentModalProps) {
  const { addToast } = useNotifications();
  useModalDismiss(isOpen, onClose);

  if (!isOpen || !po) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!po.items || po.items.length === 0) {
      addToast('No items in this purchase order to export.', 'warning');
      return;
    }

    const headers = ['Line #', 'Product SKU', 'Item Description', 'Quantity', 'Unit Cost (GHS)', 'Line Total (GHS)'];
    const rows = po.items.map((item, idx) => [
      idx + 1,
      `"${item.sku || 'N/A'}"`,
      `"${item.product_name.replace(/"/g, '""')}"`,
      item.quantity,
      item.unit_price.toFixed(2),
      (item.quantity * item.unit_price).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PO_${po.id}_${po.supplier_name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalItemsCount = po.items ? po.items.reduce((sum, item) => sum + item.quantity, 0) : (po.total_units || 0);

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto animate-in zoom-in-95 duration-150 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none">
        {/* Action Header - Hidden during print */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-400" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">Purchase Order #{po.id}</h3>
              <p className="text-[11px] text-slate-400">Formal Procurement Document & Logistics Voucher</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Download CSV"
            >
              <Download size={13} />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer size={13} />
              <span>Print PO</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable PO Sheet Container */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-800 print:p-6" id="printable-po-document">
          {/* Header & Logo */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-900 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-black text-sm">
                  UL
                </div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  Ummis Lane Enterprise
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Central Retail Store, Inventory & Procurement Operations
              </p>
              <p className="text-xs text-slate-500">
                Industrial Area / Spintex, Accra, Ghana • Tel: +233 30 257 0191
              </p>
            </div>

            <div className="text-left sm:text-right">
              <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded text-xs font-black uppercase tracking-widest mb-1.5">
                Purchase Order
              </div>
              <p className="text-base font-black text-slate-900 font-mono">PO #{po.id}</p>
              <p className="text-xs text-slate-500">
                Date Issued: <strong className="text-slate-700">{new Date(po.created_at).toLocaleDateString()}</strong>
              </p>
              <p className="text-xs text-slate-500">
                Expected Delivery: <strong className="text-blue-700">{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : 'Immediate SLA'}</strong>
              </p>
            </div>
          </div>

          {/* Supplier & Destination Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
                <Building2 size={13} className="text-blue-600" /> Vendor / Supplier
              </div>
              <p className="text-sm font-black text-slate-900">{po.supplier_name}</p>
              {po.supplier_contact && (
                <p className="text-xs text-slate-600 mt-0.5 font-medium">Contact: {po.supplier_contact}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Payment Terms: <span className="font-bold text-slate-700">Net 30 Invoiced</span>
              </p>
              {po.acknowledged_by && (
                <p className="text-[11px] text-emerald-700 font-bold mt-1.5 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Acknowledged by vendor
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
                <Truck size={13} className="text-blue-600" /> Inbound Receiving Destination
              </div>
              <p className="text-sm font-black text-slate-900">Ummis Lane Central Depot</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Dock Bay: <strong className="text-slate-800">{po.dock_slot || 'Bay 1 (Central Inbound)'}</strong>
              </p>
              <p className="text-xs text-slate-600">
                Fulfillment Mode: <strong className="text-slate-800">{po.fulfillment_mode === 'store_pickup' ? 'Warehouse Store Pickup' : 'Direct Vendor Delivery'}</strong>
              </p>
              {po.driver_name && (
                <p className="text-xs text-slate-600 mt-0.5">
                  Assigned Driver: <strong className="text-slate-800">{po.driver_name}</strong> {po.driver_phone ? `(${po.driver_phone})` : ''}
                </p>
              )}
              {po.vehicle_number && (
                <p className="text-xs text-slate-600 font-mono">
                  Vehicle Reg: <strong>{po.vehicle_number}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
              Procurement Order Line Items
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5">Item Description</th>
                    <th className="p-2.5">SKU</th>
                    <th className="p-2.5 text-right">Qty</th>
                    <th className="p-2.5 text-right">Unit Price</th>
                    <th className="p-2.5 text-right">Total (GHS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {po.items && po.items.length > 0 ? (
                    po.items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900">{item.product_name}</td>
                        <td className="p-2.5 font-mono text-slate-600 text-[11px]">{item.sku || '—'}</td>
                        <td className="p-2.5 text-right font-black text-slate-900">{item.quantity}</td>
                        <td className="p-2.5 text-right font-mono text-slate-700">{formatGHS(item.unit_price)}</td>
                        <td className="p-2.5 text-right font-mono font-black text-slate-900">
                          {formatGHS(item.quantity * item.unit_price)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400 text-xs">
                        Bulk consignment items totaling {formatGHS(po.total_amount)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals & Financial Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
            <div className="max-w-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Procurement Notes:
              </span>
              <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                {po.notes || 'Goods must be in pristine manufacturer packaging with tamper-evident seals intact.'}
              </p>
            </div>

            <div className="w-full sm:w-64 space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Units:</span>
                <span className="font-bold text-slate-800">{totalItemsCount} units</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-bold text-slate-800">{formatGHS(po.total_amount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Estimated VAT / Levies:</span>
                <span className="font-mono text-slate-600">₵0.00 (Exempt)</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900 text-sm">
                <span>Total Amount:</span>
                <span className="font-mono text-blue-700">{formatGHS(po.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Authorization & Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
            <div className="space-y-10">
              <div className="border-b border-slate-400 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Authorized Procurement Officer:
                </span>
                <p className="font-bold text-slate-800 mt-1">{po.user_name || 'Procurement Desk'}</p>
              </div>
              <div className="text-[10px] text-slate-400">Signature / Seal & Date</div>
            </div>

            <div className="space-y-10">
              <div className="border-b border-slate-400 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Vendor Acknowledgment & Warehouse Receipt:
                </span>
                <p className="font-bold text-slate-800 mt-1">
                  {po.confirmed_by ? `Received by ${po.confirmed_by}` : 'Pending Receiving Officer Verification'}
                </p>
              </div>
              <div className="text-[10px] text-slate-400">Goods Receipt Note (GRN) Verification</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
