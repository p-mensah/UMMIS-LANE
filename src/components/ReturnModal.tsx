import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import { 
  RotateCcw, X, Search, CheckCircle2, AlertCircle, Package, 
  Trash2, Plus, Minus, CreditCard, ShieldCheck, ArrowRight, HelpCircle
} from 'lucide-react';

interface ReturnModalProps {
  initialSaleId?: number | null;
  onClose: () => void;
  onReturnProcessed: (returnData: any) => void;
}

interface SelectedReturnItem {
  quantity: number;
  maxQty: number;
  unit_price: number;
  product_id: number;
  product_name: string;
  restock_to_inventory: boolean;
  reason: string;
}

export default function ReturnModal({ initialSaleId, onClose, onReturnProcessed }: ReturnModalProps) {
  const [searchSaleId, setSearchSaleId] = useState<string>(initialSaleId ? initialSaleId.toString() : '');
  const [loadingSale, setLoadingSale] = useState<boolean>(false);
  const [saleData, setSaleData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Return Form State
  const [selectedItems, setSelectedItems] = useState<Record<number, SelectedReturnItem>>({});

  const [refundMethod, setRefundMethod] = useState<'Cash' | 'Mobile Money' | 'Card' | 'Store Credit'>('Cash');
  const [globalReason, setGlobalReason] = useState<string>('Defective / Damaged Item');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (initialSaleId) {
      loadSaleDetails(initialSaleId);
    }
  }, [initialSaleId]);

  const loadSaleDetails = async (id: number | string) => {
    setLoadingSale(true);
    setErrorMsg(null);
    try {
      const data = await fetchApi(`/sales/${id}`);
      if (!data || !data.items) {
        throw new Error("Sale record not found or has no line items.");
      }
      setSaleData(data);

      // Pre-fill returnable items map
      const itemsMap: Record<number, any> = {};
      data.items.forEach((item: any) => {
        // Calculate remaining returnable quantity if partially returned
        const alreadyReturned = item.returned_quantity || 0;
        const availableToReturn = item.quantity - alreadyReturned;

        if (availableToReturn > 0) {
          itemsMap[item.id] = {
            quantity: 0, // default 0 selected
            maxQty: availableToReturn,
            unit_price: item.unit_price,
            product_id: item.product_id,
            product_name: item.product_name || `Product #${item.product_id}`,
            restock_to_inventory: true,
            reason: 'Defective / Damaged Item'
          };
        }
      });

      setSelectedItems(itemsMap);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch sale details.');
      setSaleData(null);
    } finally {
      setLoadingSale(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = searchSaleId.replace(/[^0-9]/g, '');
    if (!cleanId) {
      setErrorMsg("Please enter a valid Sale / Invoice ID (e.g. 15)");
      return;
    }
    loadSaleDetails(cleanId);
  };

  const updateItemQty = (saleItemId: number, delta: number) => {
    setSelectedItems(prev => {
      const existing = prev[saleItemId];
      if (!existing) return prev;
      const newQty = Math.max(0, Math.min(existing.maxQty, existing.quantity + delta));
      return {
        ...prev,
        [saleItemId]: { ...existing, quantity: newQty }
      };
    });
  };

  const toggleRestock = (saleItemId: number) => {
    setSelectedItems(prev => {
      const existing = prev[saleItemId];
      if (!existing) return prev;
      return {
        ...prev,
        [saleItemId]: { ...existing, restock_to_inventory: !existing.restock_to_inventory }
      };
    });
  };

  // Calculate total refund
  const totalRefundAmount = (Object.values(selectedItems) as SelectedReturnItem[]).reduce(
    (sum: number, item: SelectedReturnItem) => sum + (item.quantity * item.unit_price), 0
  );

  const totalItemsToReturn = (Object.values(selectedItems) as SelectedReturnItem[]).reduce(
    (sum: number, item: SelectedReturnItem) => sum + item.quantity, 0
  );

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleData) return;
    if (totalItemsToReturn === 0) {
      alert("Please select at least 1 item and quantity to return.");
      return;
    }

    setSubmitting(true);
    try {
      const returnItemsPayload = (Object.entries(selectedItems) as [string, SelectedReturnItem][])
        .filter(([_, item]) => item.quantity > 0)
        .map(([saleItemId, item]) => ({
          sale_item_id: Number(saleItemId),
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          restock_to_inventory: item.restock_to_inventory ? 1 : 0,
          reason: item.reason || globalReason
        }));

      const res = await fetchApi(`/sales/${saleData.id}/return`, {
        method: 'POST',
        body: JSON.stringify({
          items: returnItemsPayload,
          refund_method: refundMethod,
          return_reason: globalReason,
          notes: notes
        })
      });

      if (res.success && res.returnData) {
        onReturnProcessed(res.returnData);
      } else {
        throw new Error(res.error || "Failed to process return.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to process sales return.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[75] overflow-y-auto">
      <div className="bg-white rounded-md max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-600 rounded flex items-center justify-center text-white shrink-0 shadow-sm">
              <RotateCcw size={22} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-white">
                Process Customer Sale Return & Refund
              </h2>
              <p className="text-[11px] text-slate-300 font-medium">
                Lookup transaction receipt, select returned items, and issue refund credit
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white transition rounded-sm"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 bg-slate-50">
          {/* Sale Search Lookup Bar */}
          <form onSubmit={handleSearchSubmit} className="bg-white p-4 rounded border border-slate-200 shadow-2xs space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              Lookup Sale Transaction by Receipt / Sale ID
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Enter Sale ID e.g. 12 or #SALE-12"
                  value={searchSaleId}
                  onChange={e => setSearchSaleId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>
              <button 
                type="submit"
                disabled={loadingSale || !searchSaleId.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {loadingSale ? 'Searching...' : 'Fetch Receipt'}
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded font-medium flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {saleData && (
            <form onSubmit={handleSubmitReturn} className="space-y-5">
              {/* Sale Metadata Summary Box */}
              <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="font-mono font-black text-slate-900 text-sm">#SALE-{saleData.id}</span>
                    <span className="text-[11px] text-slate-500 ml-2">
                      Date: {new Date(saleData.created_at + 'Z').toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      Cashier: {saleData.user_name || 'Staff'}
                    </span>
                    <span className="px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Customer: {saleData.customer_name || 'Walk-in'}
                    </span>
                  </div>
                </div>

                {/* Items Selection Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Package size={15} className="text-rose-600" />
                      Select Line Items To Return
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Total Returnable Items: {Object.keys(selectedItems).length}
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded overflow-hidden bg-white text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5 text-right">Paid Unit Price</th>
                          <th className="p-2.5 text-center">Return Qty</th>
                          <th className="p-2.5 text-center">Inventory Action</th>
                          <th className="p-2.5 text-right">Refund Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(Object.entries(selectedItems) as [string, SelectedReturnItem][]).map(([saleItemIdStr, item]) => {
                          const saleItemId = Number(saleItemIdStr);
                          return (
                            <tr key={saleItemId} className={item.quantity > 0 ? 'bg-rose-50/40' : 'hover:bg-slate-50'}>
                              <td className="p-2.5 font-bold text-slate-900 max-w-[180px] truncate">
                                <div>{item.product_name}</div>
                                <div className="text-[10px] text-slate-400 font-normal">Max returnable: {item.maxQty} units</div>
                              </td>
                              <td className="p-2.5 text-right font-medium text-slate-700">
                                {formatGHS(item.unit_price)}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => updateItemQty(saleItemId, -1)}
                                    disabled={item.quantity <= 0}
                                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-100 text-slate-700 disabled:opacity-30"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span className="w-8 text-center font-black text-slate-900">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateItemQty(saleItemId, 1)}
                                    disabled={item.quantity >= item.maxQty}
                                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-100 text-slate-700 disabled:opacity-30"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleRestock(saleItemId)}
                                  className={`px-2 py-1 rounded font-bold text-[10px] border transition ${
                                    item.restock_to_inventory
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : 'bg-rose-50 text-rose-800 border-rose-300'
                                  }`}
                                  title="Click to toggle between shelf restock and defective disposal"
                                >
                                  {item.restock_to_inventory ? '📦 Restock to Shelf' : '⚠️ Damaged / Waste'}
                                </button>
                              </td>
                              <td className="p-2.5 text-right font-black text-rose-700">
                                {formatGHS(item.quantity * item.unit_price)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Return Options & Refund Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reason & Refund Method */}
                <div className="bg-white p-4 rounded border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Primary Return Reason</label>
                    <select
                      value={globalReason}
                      onChange={e => setGlobalReason(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-rose-500 bg-white"
                    >
                      <option value="Defective / Damaged Item">Defective / Damaged Item</option>
                      <option value="Expired Product">Expired Product</option>
                      <option value="Wrong Item Purchased">Wrong Item Purchased</option>
                      <option value="Customer Mind Change">Customer Mind Change</option>
                      <option value="Pricing / Overcharge Dispute">Pricing / Overcharge Dispute</option>
                      <option value="Quality Satisfaction Issue">Quality Satisfaction Issue</option>
                      <option value="Other / Manager Discretion">Other / Manager Discretion</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Refund Payment Channel</label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(['Cash', 'Mobile Money', 'Card', 'Store Credit'] as const).map(mode => (
                        <button
                          type="button"
                          key={mode}
                          onClick={() => setRefundMethod(mode)}
                          className={`p-2 rounded border font-bold text-center transition ${
                            refundMethod === mode
                              ? 'bg-rose-50 border-rose-600 text-rose-800'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Audit Notes / Comments (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Serial # matched, manager override verified..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Refund Totals & Confirm Action */}
                <div className="bg-rose-50 border border-rose-200 rounded p-4 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block mb-1">
                      TOTAL REFUND CALCULATED
                    </span>
                    <div className="text-3xl font-black text-rose-700">
                      {formatGHS(totalRefundAmount)}
                    </div>
                    <p className="text-[11px] text-rose-800 mt-1">
                      {totalItemsToReturn} item(s) selected for return via <span className="font-bold">{refundMethod}</span>.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-rose-200/80 space-y-2">
                    <button
                      type="submit"
                      disabled={submitting || totalItemsToReturn === 0}
                      className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded font-black text-xs uppercase tracking-wider transition shadow-sm disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={16} />
                      {submitting ? 'Processing Return...' : `Confirm Return & Issue ${formatGHS(totalRefundAmount)}`}
                    </button>
                    <p className="text-[10px] text-slate-500 text-center italic">
                      This action will update inventory stock, refund customer ledger, and issue an official credit note.
                    </p>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
