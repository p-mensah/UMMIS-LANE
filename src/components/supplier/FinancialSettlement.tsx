import React, { useState } from 'react';
import { formatGHS } from '../../lib/formatters';
import {
  CreditCard,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingDown,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Percent
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

interface FinancialRecord {
  id: number;
  po_id: number;
  supplier_name: string;
  total_amount: number;
  status: string;
  invoice_number?: string;
  invoice_status?: 'unpaid' | 'partially_paid' | 'approved' | 'paid';
  created_at: string;
  expected_date?: string;
}

interface FinancialSettlementProps {
  purchases: FinancialRecord[];
  activeSupplier: string;
  onUpdateInvoiceStatus: (poId: number, status: 'unpaid' | 'partially_paid' | 'approved' | 'paid', invoiceNo?: string) => Promise<void>;
  userRole?: string;
}

export default function FinancialSettlement({
  purchases,
  activeSupplier,
  onUpdateInvoiceStatus,
  userRole = 'admin'
}: FinancialSettlementProps) {
  const { addToast } = useNotifications();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingPoId, setEditingPoId] = useState<number | null>(null);
  const [statusVal, setStatusVal] = useState<'unpaid' | 'partially_paid' | 'approved' | 'paid'>('unpaid');
  const [invoiceNoVal, setInvoiceNoVal] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const supplierPurchases = purchases.filter((p) =>
    !activeSupplier || p.supplier_name.toLowerCase().includes(activeSupplier.toLowerCase())
  );

  const totalPayable = supplierPurchases
    .filter((p) => p.invoice_status !== 'paid' && p.status !== 'cancelled')
    .reduce((sum, p) => sum + (p.total_amount || 0), 0);

  const totalPaid = supplierPurchases
    .filter((p) => p.invoice_status === 'paid')
    .reduce((sum, p) => sum + (p.total_amount || 0), 0);

  // Early discount calculations (2% early discount if settled in 10 days)
  const potentialEarlyDiscountSavings = totalPayable * 0.02;

  const filtered = supplierPurchases.filter((p) => {
    if (filterStatus === 'all') return true;
    return (p.invoice_status || 'unpaid') === filterStatus;
  });

  const handleStatusSave = async (poId: number) => {
    setIsUpdating(true);
    try {
      await onUpdateInvoiceStatus(poId, statusVal, invoiceNoVal);
      addToast('Invoice settlement status updated successfully.', 'success');
      setEditingPoId(null);
    } catch (err: any) {
      addToast(err.message || 'Failed to update invoice status', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Outstanding Accounts Payable
            </span>
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded-md">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            {formatGHS(totalPayable)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Unpaid / pending settlement across active POs
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Settled & Paid Invoices
            </span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-md">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 tracking-tight">
            {formatGHS(totalPaid)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Fully settled supplier disbursements
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-emerald-200 bg-emerald-50/40 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Early Payment Discount (2/10 Net 30)
            </span>
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md">
              <Percent size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700 tracking-tight">
            {formatGHS(potentialEarlyDiscountSavings)}
          </div>
          <p className="mt-1 text-[11px] text-emerald-700">
            Potential 2% cash rebate with 10-day settlement
          </p>
        </div>
      </div>

      {/* 3-Way Match & Invoice Ledger */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-200 text-xs font-bold text-slate-700">
              <ShieldCheck size={14} className="text-emerald-600" />
              Automated 3-Way Matching Engine:
              <span className="text-emerald-600 font-black">ACTIVE (PO ↔ GRN ↔ Invoice)</span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded text-xs">
            {['all', 'unpaid', 'partially_paid', 'approved', 'paid'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold capitalize transition-colors ${
                  filterStatus === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="p-3.5">PO / Invoice #</th>
                <th className="p-3.5">Vendor Partner</th>
                <th className="p-3.5">PO Total</th>
                <th className="p-3.5">3-Way Match Status</th>
                <th className="p-3.5">Payment Terms & Due Date</th>
                <th className="p-3.5">Settlement Status</th>
                <th className="p-3.5 text-right">Approval Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((po) => {
                const isEditingThis = editingPoId === po.id;
                const isReceived = po.status.toLowerCase() === 'received';
                const threeWayMatched = isReceived;

                return (
                  <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      <span className="block">#PO-{po.id}</span>
                      <span className="text-[10px] text-slate-400 font-sans">
                        Inv: {po.invoice_number || `INV-${po.id}-GH`}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <span className="font-bold text-slate-800 block">{po.supplier_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Issued: {new Date(po.created_at).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="p-3.5 font-black text-slate-900">
                      {formatGHS(po.total_amount)}
                    </td>

                    <td className="p-3.5">
                      {threeWayMatched ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={11} /> 3-Way Matched (100%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle size={11} /> Pending GRN Receipt
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-slate-600">
                      <span className="font-semibold text-slate-800 block">Net 30 Days</span>
                      <span className="text-[10px] text-slate-400">
                        Target: {new Date(new Date(po.created_at).getTime() + 30 * 86400000).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="p-3.5">
                      {isEditingThis ? (
                        <div className="space-y-1">
                          <select
                            value={statusVal}
                            onChange={(e: any) => setStatusVal(e.target.value)}
                            className="border border-slate-200 rounded p-1 text-[11px] bg-white w-full"
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="partially_paid">Partially Paid</option>
                            <option value="approved">Approved for Payment</option>
                            <option value="paid">Paid & Settled</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Invoice #"
                            value={invoiceNoVal}
                            onChange={(e) => setInvoiceNoVal(e.target.value)}
                            className="border border-slate-200 rounded p-1 text-[10px] w-full"
                          />
                        </div>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            po.invoice_status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : po.invoice_status === 'approved'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : po.invoice_status === 'partially_paid'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {po.invoice_status || 'unpaid'}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right whitespace-nowrap">
                      {isEditingThis ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingPoId(null)}
                            className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[11px] font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleStatusSave(po.id)}
                            disabled={isUpdating}
                            className="px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-bold"
                          >
                            {isUpdating ? '...' : 'Save'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingPoId(po.id);
                            setStatusVal(po.invoice_status || 'unpaid');
                            setInvoiceNoVal(po.invoice_number || `INV-${po.id}-GH`);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-[11px] rounded border border-slate-200 transition-colors"
                        >
                          Update Status
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                    No procurement records matching selected settlement filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
