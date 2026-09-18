import React, { useState } from 'react';
import { formatGHS } from '../../lib/formatters';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useNotifications } from '../../context/NotificationContext';
import {
  PackageCheck,
  CheckCircle2,
  X,
  AlertTriangle,
  Building2,
  Calendar,
  Check
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
  supplier_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  items?: PurchaseItem[];
  dock_slot?: string;
  driver_name?: string;
  vehicle_number?: string;
}

interface ReceivePOModalProps {
  po: PurchaseOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (poId: number) => Promise<void>;
  currentUser?: string;
}

export default function ReceivePOModal({
  po,
  isOpen,
  onClose,
  onConfirm,
  currentUser = 'Warehouse Officer'
}: ReceivePOModalProps) {
  const [receivingNotes, setReceivingNotes] = useState('Goods verified in pristine condition, sealed pallets checked.');
  const [conditionChecked, setConditionChecked] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);

  const { addToast } = useNotifications();
  useModalDismiss(isOpen, onClose);

  if (!isOpen || !po) return null;

  const handleConfirm = async () => {
    if (!conditionChecked) {
      addToast('Please verify and check the condition confirmation before restocking.', 'warning');
      return;
    }
    setIsConfirming(true);
    try {
      await onConfirm(po.id);
      onClose();
    } catch (err: any) {
      addToast(err.message || 'Failed to confirm receipt of goods', 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  const totalUnits = po.items ? po.items.reduce((s, it) => s + it.quantity, 0) : 0;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageCheck size={20} className="text-emerald-200" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">
                Confirm Goods Receipt Note (GRN)
              </h3>
              <p className="text-[11px] text-emerald-100">
                PO #PO-{po.id} • Fulfill stock into warehouse inventory
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-emerald-100 hover:text-white p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="font-black text-slate-800 text-xs block">{po.supplier_name}</span>
              <span className="text-[11px] text-slate-500">
                Dock: {po.dock_slot || 'Central Inbound Bay'} {po.vehicle_number ? `• Vehicle: ${po.vehicle_number}` : ''}
              </span>
            </div>
            <div className="text-right">
              <span className="font-mono font-black text-emerald-800 text-sm block">
                {formatGHS(po.total_amount)}
              </span>
              <span className="text-[10px] font-bold text-emerald-700">{totalUnits} units</span>
            </div>
          </div>

          <div>
            <span className="font-black text-slate-700 block mb-2 uppercase tracking-wider text-[10px]">
              Inventory Stock To Be Restocked:
            </span>
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-2 pl-3">Item</th>
                    <th className="p-2 text-right">Restock Qty</th>
                    <th className="p-2 text-right pr-3">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {po.items && po.items.length > 0 ? (
                    po.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 pl-3 font-bold text-slate-800">
                          {it.product_name}
                          <span className="text-[10px] text-slate-400 block font-mono">SKU: {it.sku}</span>
                        </td>
                        <td className="p-2 text-right font-black text-emerald-700 font-mono">
                          +{it.quantity}
                        </td>
                        <td className="p-2 text-right pr-3 font-mono text-slate-700">
                          {formatGHS(it.quantity * it.unit_price)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="p-3 text-center text-slate-400">
                        Total consignment amount: {formatGHS(po.total_amount)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Receiving Verification Notes
            </label>
            <textarea
              rows={2}
              value={receivingNotes}
              onChange={(e) => setReceivingNotes(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <label className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={conditionChecked}
              onChange={(e) => setConditionChecked(e.target.checked)}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-[11px] text-slate-700 font-medium leading-tight">
              I verify that the delivered goods have been physically inspected at the dock, counts match the delivery manifest, and stock should now be added to live inventory.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isConfirming || !conditionChecked}
              onClick={handleConfirm}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>{isConfirming ? 'Restocking Inventory...' : 'Confirm GRN & Restock'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
