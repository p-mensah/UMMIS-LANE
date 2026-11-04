import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import RowActionMenu from '../components/common/RowActionMenu';
import OfflineSyncBanner from '../components/common/OfflineSyncBanner';
import { Plus, ArrowUpRight, ArrowDownRight, Search, RotateCcw, Filter, CheckCircle2, AlertTriangle, FileText, Lock, ShieldAlert, Package, Eye, Copy, CloudOff } from 'lucide-react';

export default function Adjustments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useNotifications();
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowStaffAdjustments, setAllowStaffAdjustments] = useState<boolean>(false);

  // New Adjustment Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'deduct'>('add');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('Inventory Audit Discrepancy');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');

  // Toast feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Allow admin, manager, or authorized staff to adjust stock
  const canAdjustStock = user?.role === 'admin' || user?.role === 'manager' || allowStaffAdjustments;

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [adjData, prodData, settingsData] = await Promise.all([
        fetchApi('/inventory/adjustments').catch(() => []),
        fetchApi('/products').catch(() => []),
        fetchApi('/settings').catch(() => ({}))
      ]);
      setAdjustments(Array.isArray(adjData) ? adjData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
      if (settingsData && settingsData.allow_staff_stock_adjustments) {
        setAllowStaffAdjustments(settingsData.allow_staff_stock_adjustments === 'true');
      }
    } catch (err) {
      console.error('Failed to load adjustments data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdjustStock) {
      addToast('Permission Denied: Staff stock adjustments are disabled by administrator.', 'error');
      return;
    }

    if (!selectedProductId) {
      addToast('Please select a product to adjust.', 'warning');
      return;
    }

    const prod = products.find(p => p.id.toString() === selectedProductId);
    if (!prod) return;

    const qtyChange = adjustmentType === 'add' ? Math.abs(quantity) : -Math.abs(quantity);

    setIsSubmitting(true);
    try {
      const res = await fetchApi('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          product_id: parseInt(selectedProductId, 10),
          product_name: prod.name,
          sku: prod.sku,
          quantity_change: qtyChange,
          reason: `${reason}${notes ? ` - ${notes}` : ''}`,
          user_id: user?.id,
          user_name: user?.name || 'Staff'
        })
      });

      if (res && res.offline) {
        const offlineMsg = `Offline Mode: Stock adjustment for ${prod.name} (${qtyChange > 0 ? '+' : ''}${qtyChange} units) saved locally. It will auto-sync upon reconnection.`;
        setFeedback({ 
          type: 'success', 
          message: offlineMsg
        });
        addToast({
          title: 'Stock Adjustment Saved Offline',
          message: `Recorded ${qtyChange > 0 ? '+' : ''}${qtyChange} units for ${prod.name}. Will synchronize automatically when connected.`,
          type: 'info'
        });

        // Immediately update local product stock in state so UI reflects the change right away
        setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, stock_quantity: Math.max(0, (p.stock_quantity || 0) + qtyChange) } : p));
        // Add pending adjustment to table list with offline tag
        const newOfflineAdj = {
          id: res.offlineId || `OFFLINE-ADJ-${Date.now()}`,
          product_id: prod.id,
          product_name: prod.name,
          user_name: user?.name || 'Staff (Offline)',
          quantity_change: qtyChange,
          reason: `${reason}${notes ? ` - ${notes}` : ''} [Offline Queue]`,
          created_at: new Date().toISOString(),
          offline: true
        };
        setAdjustments(prev => [newOfflineAdj, ...prev]);
      } else {
        const successMsg = `Successfully adjusted stock for ${prod.name} (${qtyChange > 0 ? '+' : ''}${qtyChange} units)`;
        setFeedback({ 
          type: 'success', 
          message: successMsg
        });
        addToast(successMsg, 'success');
        loadData();
      }

      setShowModal(false);
      setSelectedProductId('');
      setQuantity(1);
      setNotes('');
    } catch (err: any) {
      addToast(err.message || 'Failed to submit stock adjustment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products.find(p => p.id.toString() === selectedProductId);

  const filteredAdjustments = adjustments.filter(adj => {
    const q = searchFilter.toLowerCase();
    const matchesQuery = 
      (adj.product_name && adj.product_name.toLowerCase().includes(q)) ||
      (adj.sku && adj.sku.toLowerCase().includes(q)) ||
      (adj.user_name && adj.user_name.toLowerCase().includes(q)) ||
      (adj.reason && adj.reason.toLowerCase().includes(q));
    
    const matchesReason = !reasonFilter || (adj.reason && adj.reason.toLowerCase().includes(reasonFilter.toLowerCase()));
    return matchesQuery && matchesReason;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw size={22} className="text-blue-600" />
            Stock Adjustments & Inventory Reconciliation
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Record manual stock additions, spoilage, breakage, returns, and inventory count corrections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {canAdjustStock ? (
            <button
              onClick={() => {
                setSelectedProductId('');
                setShowModal(true);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2"
            >
              <Plus size={16} /> New Stock Adjustment
            </button>
          ) : (
            <div className="px-3 py-2 bg-slate-100 border border-slate-200 text-slate-500 rounded text-xs font-bold flex items-center gap-1.5">
              <Lock size={14} className="text-amber-600" />
              <span>Staff Adjustments Locked</span>
            </div>
          )}
        </div>
      </div>

      {/* Offline Sync Banner */}
      <OfflineSyncBanner />

      {/* Staff Restricted Notice if not allowed */}
      {!canAdjustStock && user?.role !== 'admin' && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-md flex items-start gap-3 text-xs">
          <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-black uppercase tracking-wider text-[11px] text-amber-800">Staff Stock Adjustments Restricted</div>
            <p className="mt-0.5 text-amber-700 leading-relaxed font-medium">
              You are signed in with a Staff role. Manual stock adjustments, write-offs, and stock additions are restricted by the administrator. To perform an adjustment, please ask a store manager or administrator.
            </p>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedback && (
        <div className={`p-4 rounded border flex items-center justify-between text-xs font-bold animate-fadeIn ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-red-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search adjustments by product, SKU, cashier, or reason..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full border border-slate-200 rounded pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="border border-slate-200 bg-slate-50 rounded px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Reason Categories</option>
            <option value="Audit">Audit Discrepancy</option>
            <option value="Damage">Damage / Spoilage</option>
            <option value="Restock">Restock / Shipment</option>
            <option value="Return">Customer Return</option>
          </select>
        </div>
      </div>

      {/* Adjustment Table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Date & Time</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Product Name</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Cashier / Staff</th>
                <th className="px-5 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Quantity Change</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Reason & Note</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredAdjustments.map((adj) => {
                const isPositive = adj.quantity_change > 0;
                return (
                  <tr key={adj.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-mono">
                      {new Date(adj.created_at + 'Z').toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-bold text-slate-900">
                      <div>{adj.product_name}</div>
                      {adj.sku && <div className="text-[10px] text-slate-400 font-mono">{adj.sku}</div>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-700 font-medium">
                      {adj.user_name}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs ${
                        isPositive ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80' : 'bg-rose-50 text-rose-800 border-rose-200/80'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {isPositive ? `+${adj.quantity_change}` : adj.quantity_change}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium max-w-xs truncate">
                      {adj.reason}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end">
                        <RowActionMenu
                          triggerTitle={`Actions for ${adj.product_name}`}
                          actions={[
                            {
                              label: 'View Product Details',
                              sublabel: 'Stock levels & audit history',
                              icon: <Package size={14} />,
                              onClick: () => navigate(`/products/${adj.product_id}`)
                            },
                            {
                              label: 'View in Product Catalog',
                              sublabel: 'Catalog & batch pricing',
                              icon: <Eye size={14} />,
                              onClick: () => navigate(`/products?search=${encodeURIComponent(adj.product_name)}`)
                            },
                            {
                              label: 'Copy Product Name',
                              sublabel: adj.product_name,
                              icon: <Copy size={14} />,
                              onClick: () => {
                                navigator.clipboard.writeText(adj.product_name);
                                addToast('Copied product name to clipboard', 'info');
                              }
                            }
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredAdjustments.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-xs">No stock adjustment records match your filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW ADJUSTMENT MODAL (Only when allowed) */}
      {showModal && canAdjustStock && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-md max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Record Stock Adjustment</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="space-y-4">
              {/* Product Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Select Product</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Product from Inventory --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Current Stock: {p.stock_quantity}
                    </option>
                  ))}
                </select>

                {selectedProduct && (
                  <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Available Quantity:</span>
                    <span className="font-black text-slate-900">{selectedProduct.stock_quantity} {selectedProduct.unit_of_measure || 'units'}</span>
                  </div>
                )}
              </div>

              {/* Adjustment Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Adjustment Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('add')}
                    className={`py-2 px-3 rounded text-xs font-bold uppercase tracking-wider border flex items-center justify-center gap-1.5 transition-all ${
                      adjustmentType === 'add'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpRight size={16} /> Add Stock (+)
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentType('deduct')}
                    className={`py-2 px-3 rounded text-xs font-bold uppercase tracking-wider border flex items-center justify-center gap-1.5 transition-all ${
                      adjustmentType === 'deduct'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowDownRight size={16} /> Deduct Stock (-)
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="Inventory Audit Discrepancy">Inventory Audit Discrepancy</option>
                  <option value="Damage / Spoilage">Damage / Spoilage</option>
                  <option value="Restock / Shipment Arrival">Restock / Shipment Arrival</option>
                  <option value="Customer Return">Customer Return</option>
                  <option value="Internal Store Usage">Internal Store Usage</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Additional Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Damaged during shelf transport..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Buttons */}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedProductId}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
