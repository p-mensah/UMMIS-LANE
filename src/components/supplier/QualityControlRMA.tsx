import React, { useState } from 'react';
import { formatGHS } from '../../lib/formatters';
import {
  ClipboardCheck,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Package,
  Plus,
  FileText,
  Calendar,
  Layers,
  X,
  ShieldAlert,
  ArrowRight,
  TrendingDown
} from 'lucide-react';

interface QCLog {
  id: number;
  po_id: number;
  supplier_name: string;
  inspector_name: string;
  ordered_quantity: number;
  accepted_quantity: number;
  damaged_quantity: number;
  shortage_quantity: number;
  overshipment_quantity: number;
  batch_number?: string;
  expiry_date?: string;
  qc_status: 'passed' | 'flagged_discrepancy' | 'rejected';
  discrepancy_notes?: string;
  received_date: string;
}

interface SupplierRMA {
  id: number;
  po_id: number;
  supplier_name: string;
  product_name: string;
  quantity: number;
  reason: string;
  requested_resolution: 'credit_memo' | 'replacement' | 'refund';
  status: 'pending' | 'approved' | 'shipped' | 'resolved' | 'rejected';
  credit_amount?: number;
  notes?: string;
  created_at: string;
}

interface QualityControlRMAProps {
  qcLogs: QCLog[];
  rmas: SupplierRMA[];
  activeSupplier: string;
  onRefresh: () => void;
  onCreateQCLog: (data: Partial<QCLog>) => Promise<void>;
  onCreateRMA: (data: Partial<SupplierRMA>) => Promise<void>;
  onUpdateRMAStatus: (rmaId: number, status: string, creditAmount?: number) => Promise<void>;
  purchasesList?: any[];
}

export default function QualityControlRMA({
  qcLogs,
  rmas,
  activeSupplier,
  onRefresh,
  onCreateQCLog,
  onCreateRMA,
  onUpdateRMAStatus,
  purchasesList = []
}: QualityControlRMAProps) {
  const [activeSubTab, setActiveSubTab] = useState<'qc_inspection' | 'rma_returns'>('qc_inspection');

  // Modal states
  const [showQcModal, setShowQcModal] = useState(false);
  const [showRmaModal, setShowRmaModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New QC state
  const [qcPoId, setQcPoId] = useState<number>(purchasesList[0]?.id || 1);
  const [qcInspector, setQcInspector] = useState('Senior Store Inspector');
  const [qcOrderedQty, setQcOrderedQty] = useState(100);
  const [qcAcceptedQty, setQcAcceptedQty] = useState(98);
  const [qcDamagedQty, setQcDamagedQty] = useState(2);
  const [qcShortageQty, setQcShortageQty] = useState(0);
  const [qcOvershipmentQty, setQcOvershipmentQty] = useState(0);
  const [qcBatchNo, setQcBatchNo] = useState(`LOT-${new Date().getFullYear()}-091`);
  const [qcExpiry, setQcExpiry] = useState(new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10));
  const [qcStatus, setQcStatus] = useState<'passed' | 'flagged_discrepancy' | 'rejected'>('flagged_discrepancy');
  const [qcNotes, setQcNotes] = useState('2 cartons dented on pallet corner during offloading.');

  // New RMA state
  const [rmaPoId, setRmaPoId] = useState<number>(purchasesList[0]?.id || 1);
  const [rmaProduct, setRmaProduct] = useState('Ideal Milk 160g');
  const [rmaQty, setRmaQty] = useState(2);
  const [rmaReason, setRmaReason] = useState('Transit denting and compromised packaging seal');
  const [rmaResolution, setRmaResolution] = useState<'credit_memo' | 'replacement' | 'refund'>('credit_memo');
  const [rmaCreditAmount, setRmaCreditAmount] = useState(11.0);

  const handleQcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreateQCLog({
        po_id: Number(qcPoId),
        supplier_name: activeSupplier,
        inspector_name: qcInspector,
        ordered_quantity: Number(qcOrderedQty),
        accepted_quantity: Number(qcAcceptedQty),
        damaged_quantity: Number(qcDamagedQty),
        shortage_quantity: Number(qcShortageQty),
        overshipment_quantity: Number(qcOvershipmentQty),
        batch_number: qcBatchNo,
        expiry_date: qcExpiry,
        qc_status: qcStatus,
        discrepancy_notes: qcNotes
      });
      setShowQcModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRmaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreateRMA({
        po_id: Number(rmaPoId),
        supplier_name: activeSupplier,
        product_name: rmaProduct,
        quantity: Number(rmaQty),
        reason: rmaReason,
        requested_resolution: rmaResolution,
        credit_amount: Number(rmaCreditAmount),
        status: 'pending'
      });
      setShowRmaModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Switcher & Quick Create Action */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex bg-slate-100 p-0.5 rounded text-xs">
          <button
            onClick={() => setActiveSubTab('qc_inspection')}
            className={`px-3.5 py-1.5 rounded font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'qc_inspection'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardCheck size={14} className="text-blue-600" />
            <span>Goods Receipt (GRN) & QC Inspection Logs ({qcLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('rma_returns')}
            className={`px-3.5 py-1.5 rounded font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'rma_returns'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <RotateCcw size={14} className="text-rose-600" />
            <span>Return to Vendor (RTV) / RMAs ({rmas.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'qc_inspection' ? (
            <button
              onClick={() => setShowQcModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Plus size={13} /> Log New GRN Inspection
            </button>
          ) : (
            <button
              onClick={() => setShowRmaModal(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Plus size={13} /> Initiate Vendor RMA
            </button>
          )}
        </div>
      </div>

      {/* QC Inspection Section */}
      {activeSubTab === 'qc_inspection' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3.5">GRN / PO Ref</th>
                  <th className="p-3.5">Vendor & Date</th>
                  <th className="p-3.5">Batch / Expiration</th>
                  <th className="p-3.5 text-center">Ordered</th>
                  <th className="p-3.5 text-center">Accepted</th>
                  <th className="p-3.5 text-center">Damaged / Short</th>
                  <th className="p-3.5">QC Verdict</th>
                  <th className="p-3.5">Discrepancy Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {qcLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      <span className="block">#GRN-{log.id}</span>
                      <span className="text-[10px] text-slate-400 font-sans">PO #{log.po_id}</span>
                    </td>

                    <td className="p-3.5">
                      <span className="font-bold text-slate-800 block">{log.supplier_name}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.received_date).toLocaleDateString()} • {log.inspector_name}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <span className="font-mono text-slate-800 text-[11px] font-bold block">
                        {log.batch_number || 'LOT-2026-N1'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Exp: {log.expiry_date ? new Date(log.expiry_date).toLocaleDateString() : 'Dec 2026'}
                      </span>
                    </td>

                    <td className="p-3.5 text-center font-bold text-slate-700">{log.ordered_quantity}</td>
                    <td className="p-3.5 text-center font-bold text-emerald-600">{log.accepted_quantity}</td>
                    <td className="p-3.5 text-center">
                      {(log.damaged_quantity > 0 || log.shortage_quantity > 0) ? (
                        <span className="font-bold text-rose-600">
                          {log.damaged_quantity > 0 && `${log.damaged_quantity} dmg `}
                          {log.shortage_quantity > 0 && `${log.shortage_quantity} short`}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.qc_status === 'passed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : log.qc_status === 'flagged_discrepancy'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {log.qc_status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="p-3.5 text-slate-600 max-w-xs truncate" title={log.discrepancy_notes}>
                      {log.discrepancy_notes || 'All quality standards verified.'}
                    </td>
                  </tr>
                ))}

                {qcLogs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                      No quality inspection logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Return to Vendor (RTV) / RMA Section */}
      {activeSubTab === 'rma_returns' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3.5">RMA #</th>
                  <th className="p-3.5">Vendor & PO</th>
                  <th className="p-3.5">Rejected Product & Qty</th>
                  <th className="p-3.5">Defect / Return Reason</th>
                  <th className="p-3.5">Requested Resolution</th>
                  <th className="p-3.5">Credit Amount</th>
                  <th className="p-3.5">RMA Status</th>
                  <th className="p-3.5 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {rmas.map((rma) => (
                  <tr key={rma.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      #RMA-{rma.id}
                      <span className="block text-[10px] font-sans text-slate-400">
                        {new Date(rma.created_at).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <span className="font-bold text-slate-800 block">{rma.supplier_name}</span>
                      <span className="text-[10px] text-slate-400">Linked to PO #{rma.po_id}</span>
                    </td>

                    <td className="p-3.5">
                      <span className="font-bold text-slate-900 block">{rma.product_name}</span>
                      <span className="text-[11px] text-rose-600 font-semibold">{rma.quantity} units rejected</span>
                    </td>

                    <td className="p-3.5 text-slate-600 max-w-xs">{rma.reason}</td>

                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {rma.requested_resolution.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="p-3.5 font-black text-slate-900">
                      {formatGHS(rma.credit_amount || 0)}
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rma.status === 'resolved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : rma.status === 'approved'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {rma.status}
                      </span>
                    </td>

                    <td className="p-3.5 text-right whitespace-nowrap">
                      {rma.status === 'pending' && (
                        <button
                          onClick={() => onUpdateRMAStatus(rma.id, 'approved', rma.credit_amount)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded border border-blue-200 transition-colors"
                        >
                          Approve RMA
                        </button>
                      )}
                      {rma.status === 'approved' && (
                        <button
                          onClick={() => onUpdateRMAStatus(rma.id, 'resolved', rma.credit_amount)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded border border-emerald-200 transition-colors"
                        >
                          Mark Settled
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {rmas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                      No RMA or return-to-vendor cases open.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: New QC Inspection */}
      {showQcModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <ClipboardCheck size={16} className="text-blue-600" />
                Record Goods Receipt Note (GRN) Inspection
              </h3>
              <button onClick={() => setShowQcModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleQcSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Purchase Order</label>
                  <select
                    value={qcPoId}
                    onChange={(e) => setQcPoId(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded p-2 focus:outline-none focus:border-blue-500 bg-white"
                  >
                    {purchasesList.map((po: any) => (
                      <option key={po.id} value={po.id}>PO #{po.id} - {po.supplier_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Inspector / QC Officer</label>
                  <input
                    type="text"
                    required
                    value={qcInspector}
                    onChange={(e) => setQcInspector(e.target.value)}
                    className="w-full border border-slate-200 rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ordered Qty</label>
                  <input
                    type="number"
                    value={qcOrderedQty}
                    onChange={(e) => setQcOrderedQty(parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-200 rounded p-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Accepted Qty</label>
                  <input
                    type="number"
                    value={qcAcceptedQty}
                    onChange={(e) => setQcAcceptedQty(parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-200 rounded p-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Damaged Qty</label>
                  <input
                    type="number"
                    value={qcDamagedQty}
                    onChange={(e) => setQcDamagedQty(parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-200 rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Batch / Lot Number</label>
                  <input
                    type="text"
                    value={qcBatchNo}
                    onChange={(e) => setQcBatchNo(e.target.value)}
                    className="w-full border border-slate-200 rounded p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Expiration Date</label>
                  <input
                    type="date"
                    value={qcExpiry}
                    onChange={(e) => setQcExpiry(e.target.value)}
                    className="w-full border border-slate-200 rounded p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Overall Inspection Verdict</label>
                <select
                  value={qcStatus}
                  onChange={(e: any) => setQcStatus(e.target.value)}
                  className="w-full border border-slate-200 rounded p-2 bg-white"
                >
                  <option value="passed">Passed (Conforms to Specification)</option>
                  <option value="flagged_discrepancy">Flagged Discrepancy (Damaged/Shortage)</option>
                  <option value="rejected">Rejected (Non-compliant)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Discrepancy / Pallet Notes</label>
                <textarea
                  rows={2}
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded p-2"
                  placeholder="Record package integrity, seal status, shortage details..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQcModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded hover:bg-blue-700"
                >
                  {isSubmitting ? 'Submitting...' : 'Save Inspection Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New RMA Return */}
      {showRmaModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <RotateCcw size={16} className="text-rose-600" />
                Initiate Return to Vendor (RMA)
              </h3>
              <button onClick={() => setShowRmaModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRmaSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Linked PO Reference</label>
                <select
                  value={rmaPoId}
                  onChange={(e) => setRmaPoId(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded p-2 bg-white"
                >
                  {purchasesList.map((po: any) => (
                    <option key={po.id} value={po.id}>PO #{po.id} ({po.supplier_name})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Rejected Product Name</label>
                <input
                  type="text"
                  required
                  value={rmaProduct}
                  onChange={(e) => setRmaProduct(e.target.value)}
                  className="w-full border border-slate-200 rounded p-2"
                  placeholder="e.g. Ideal Milk 160g"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Rejected Quantity</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={rmaQty}
                    onChange={(e) => setRmaQty(parseInt(e.target.value) || 1)}
                    className="w-full border border-slate-200 rounded p-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Credit Amount (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={rmaCreditAmount}
                    onChange={(e) => setRmaCreditAmount(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-200 rounded p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason for Rejection</label>
                <textarea
                  rows={2}
                  required
                  value={rmaReason}
                  onChange={(e) => setRmaReason(e.target.value)}
                  className="w-full border border-slate-200 rounded p-2"
                  placeholder="Describe damage, dented cans, seal rupture, wrong item..."
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Requested Resolution</label>
                <select
                  value={rmaResolution}
                  onChange={(e: any) => setRmaResolution(e.target.value)}
                  className="w-full border border-slate-200 rounded p-2 bg-white"
                >
                  <option value="credit_memo">Credit Memo on Next Invoice</option>
                  <option value="replacement">Physical Replacement Delivery</option>
                  <option value="refund">Direct Bank Refund</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRmaModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-rose-600 text-white font-bold rounded hover:bg-rose-700"
                >
                  {isSubmitting ? 'Creating...' : 'Submit RMA Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
