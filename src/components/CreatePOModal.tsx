import React, { useState, useEffect } from 'react';
import { formatGHS } from '../lib/formatters';
import { fetchApi } from '../lib/api';
import { useNotifications } from '../context/NotificationContext';
import {
  FileText,
  X,
  Plus,
  Trash2,
  Truck,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Layers,
  MapPin,
  Clock,
  Send,
  Boxes
} from 'lucide-react';

interface PurchaseOrderItem {
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedProduct?: any;
}

export default function CreatePOModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedProduct
}: CreatePOModalProps) {
  const { addToast, refreshNotifications } = useNotifications();

  // Suppliers & Products Catalog State
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);

  // Form State
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [cart, setCart] = useState<PurchaseOrderItem[]>([]);
  const [expectedDate, setExpectedDate] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  );
  const [fulfillmentMode, setFulfillmentMode] = useState<'supplier_delivery' | 'store_pickup'>('supplier_delivery');
  const [dockSlot, setDockSlot] = useState('Bay 1 (Standard Consignment)');
  const [dockTimeWindow, setDockTimeWindow] = useState('10:00 AM - 12:00 PM');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load suppliers and products when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingInitial(true);
      Promise.all([
        fetchApi('/suppliers').catch(() => []),
        fetchApi('/products').catch(() => [])
      ])
        .then(([suppList, prodList]) => {
          const validSupps = Array.isArray(suppList) ? suppList : [];
          setSuppliers(validSupps);

          const validProds = Array.isArray(prodList) ? prodList : [];
          setProducts(validProds);

          // Default supplier
          if (validSupps.length > 0 && !selectedSupplierName) {
            setSelectedSupplierName(validSupps[0].name);
          } else if (!selectedSupplierName) {
            setSelectedSupplierName('Nestlé Ghana Ltd');
          }

          // Initial product row if cart is empty
          if (cart.length === 0) {
            if (preselectedProduct) {
              setCart([
                {
                  product_id: preselectedProduct.id,
                  product_name: preselectedProduct.name || preselectedProduct.title,
                  sku: preselectedProduct.sku || 'SKU-001',
                  quantity: Math.max(20, (preselectedProduct.min_stock_level || 10) * 2 - Math.max(0, preselectedProduct.stock_quantity || 0)),
                  unit_price: preselectedProduct.cost_price || 10
                }
              ]);
            } else if (validProds.length > 0) {
              setCart([
                {
                  product_id: validProds[0].id,
                  product_name: validProds[0].name,
                  sku: validProds[0].sku || 'SKU-001',
                  quantity: 50,
                  unit_price: validProds[0].cost_price || 10
                }
              ]);
            }
          }
        })
        .finally(() => setLoadingInitial(false));
    }
  }, [isOpen, preselectedProduct]);

  if (!isOpen) return null;

  const selectedSupplierObj = suppliers.find(
    (s) => s.name.toLowerCase() === selectedSupplierName.toLowerCase()
  );

  const handleAddItemRow = () => {
    if (products.length === 0) return;
    const defaultProd = products[0];
    setCart([
      ...cart,
      {
        product_id: defaultProd.id,
        product_name: defaultProd.name,
        sku: defaultProd.sku || 'SKU-GEN',
        quantity: 25,
        unit_price: defaultProd.cost_price || 10
      }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (cart.length > 1) {
      setCart(cart.filter((_, i) => i !== idx));
    }
  };

  const handleItemProductChange = (idx: number, productId: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    const next = [...cart];
    next[idx] = {
      ...next[idx],
      product_id: prod.id,
      product_name: prod.name,
      sku: prod.sku || 'SKU-GEN',
      unit_price: prod.cost_price || 0
    };
    setCart(next);
  };

  const handleItemFieldChange = (idx: number, field: 'quantity' | 'unit_price', value: number) => {
    const next = [...cart];
    next[idx] = {
      ...next[idx],
      [field]: Math.max(0, value)
    };
    setCart(next);
  };

  const totalOrderUnits = cart.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const totalOrderValue = cart.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierName) {
      addToast('Please assign a target supplier for this order', 'warning');
      return;
    }
    if (cart.length === 0 || cart.some((it) => it.quantity <= 0)) {
      addToast('Please specify valid product quantities (min 1)', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        supplier_name: selectedSupplierName,
        supplier_contact: selectedSupplierObj
          ? `${selectedSupplierObj.contact_person || ''} ${selectedSupplierObj.phone || ''}`.trim()
          : '',
        status: 'pending_confirmation',
        expected_date: expectedDate || null,
        fulfillment_mode: fulfillmentMode,
        dock_slot: dockSlot,
        dock_time_window: dockTimeWindow,
        notes: notes.trim() || null,
        items: cart.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: it.unit_price
        }))
      };

      const res = await fetchApi('/purchases', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      addToast(
        `Purchase Order #PO-${res.purchaseId || 'New'} issued to ${selectedSupplierName}! Supplier has been notified.`,
        'success'
      );

      await refreshNotifications();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err.message || 'Failed to create Purchase Order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900">
                  STORE PURCHASING
                </span>
                <h3 className="font-black text-base text-white">Create Purchase Order (PO)</h3>
              </div>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                Assign a target vendor, specify items and quantities, and notify the supplier in real-time.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* 1. Target Supplier Assignment */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-black text-slate-900 flex items-center gap-2 text-xs uppercase tracking-wider">
                <Building2 size={16} className="text-blue-600" />
                Target Supplier Assignment <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-bold text-slate-500">
                Supplier will receive an instant notification
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <select
                  required
                  value={selectedSupplierName}
                  onChange={(e) => setSelectedSupplierName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-800 focus:outline-none focus:border-blue-500 text-xs shadow-2xs"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.contact_person || 'Verified Vendor'})
                    </option>
                  ))}
                  {suppliers.length === 0 && (
                    <>
                      <option value="Nestlé Ghana Ltd">Nestlé Ghana Ltd</option>
                      <option value="Wilmar Africa Ltd">Wilmar Africa Ltd</option>
                      <option value="Unilever Ghana">Unilever Ghana</option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex items-center gap-3 text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Terms:</span>
                  <span className="font-bold text-slate-900">{selectedSupplierObj?.payment_terms || 'Net 30'}</span>
                </div>
                <div className="border-l border-slate-200 pl-3">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Standard SLA:</span>
                  <span className="font-bold text-indigo-700">{selectedSupplierObj?.lead_time_days || 3} Days</span>
                </div>
                <div className="border-l border-slate-200 pl-3">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Rating:</span>
                  <span className="font-bold text-emerald-600">{selectedSupplierObj?.quality_score || 96}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Product Items & Quantities Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-black text-slate-900 flex items-center gap-2 text-xs uppercase tracking-wider">
                <Boxes size={16} className="text-blue-600" />
                Order Line Items & Quantities <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-blue-200"
              >
                <Plus size={13} /> Add Product Line
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase">
                    <th className="py-2.5 px-3">Select Product</th>
                    <th className="py-2.5 px-3">SKU & In-Hand</th>
                    <th className="py-2.5 px-3 text-right">Order Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost (GHS)</th>
                    <th className="py-2.5 px-3 text-right">Line Total</th>
                    <th className="py-2.5 px-2 text-center w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {cart.map((item, idx) => {
                    const prodMatch = products.find((p) => p.id === item.product_id);
                    const isLow = prodMatch && prodMatch.stock_quantity <= (prodMatch.min_stock_level || 10);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        {/* Product Picker */}
                        <td className="py-2.5 px-3 w-56 sm:w-64">
                          <select
                            value={item.product_id}
                            onChange={(e) => handleItemProductChange(idx, Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-bold text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* SKU & Current In-Hand */}
                        <td className="py-2.5 px-3">
                          <div className="font-mono text-[11px] text-slate-500">{item.sku}</div>
                          {prodMatch && (
                            <div className="text-[10px] flex items-center gap-1 mt-0.5">
                              <span className="text-slate-400">Stock:</span>
                              <strong className={isLow ? 'text-rose-600 font-black' : 'text-slate-700'}>
                                {prodMatch.stock_quantity} units
                              </strong>
                              {isLow && <span className="text-[9px] px-1 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">LOW</span>}
                            </div>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => handleItemFieldChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className="w-20 px-2 py-1 text-right border border-slate-300 rounded-md font-black text-slate-900 focus:outline-none focus:border-blue-500 bg-white"
                          />
                        </td>

                        {/* Unit Price */}
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={item.unit_price}
                            onChange={(e) => handleItemFieldChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 text-right border border-slate-300 rounded-md font-bold text-slate-700 focus:outline-none focus:border-blue-500 bg-white"
                          />
                        </td>

                        {/* Line Total */}
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          {formatGHS((item.quantity || 0) * (item.unit_price || 0))}
                        </td>

                        {/* Remove */}
                        <td className="py-2.5 px-2 text-center">
                          {cart.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Logistics & Delivery SLA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-blue-600" />
                Requested Delivery Date (SLA)
              </label>
              <input
                type="date"
                required
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Truck size={13} className="text-blue-600" />
                Fulfillment Mode
              </label>
              <select
                value={fulfillmentMode}
                onChange={(e: any) => setFulfillmentMode(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:border-blue-500 text-xs"
              >
                <option value="supplier_delivery">Direct Supplier Delivery</option>
                <option value="store_pickup">Store Vehicle Pickup</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin size={13} className="text-blue-600" />
                Store Receiving Dock
              </label>
              <select
                value={dockSlot}
                onChange={(e) => setDockSlot(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:border-blue-500 text-xs"
              >
                <option value="Bay 1 (Standard Consignment)">Bay 1 (Standard)</option>
                <option value="Bay 2 (Bulk Pallet Inflow)">Bay 2 (Bulk Pallet)</option>
                <option value="Cold Chain Receiving Dock">Cold Chain Dock</option>
              </select>
            </div>
          </div>

          {/* 4. Special Instructions & Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Order Instructions & Delivery Notes for Supplier
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Please ensure cartons are sealed and batch expiration exceeds 12 months. Driver to call dock master 30m prior to arrival."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          {/* 5. Summary Card */}
          <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Line Items</span>
                <span className="text-base font-black text-white">{cart.length} Products</span>
              </div>
              <div className="border-l border-slate-800 pl-6">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Total Quantity</span>
                <span className="text-base font-black text-amber-400">{totalOrderUnits} Units</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Total PO Value</span>
              <span className="text-lg font-black text-emerald-400">{formatGHS(totalOrderValue)}</span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Issuing Purchase Order & Notifying Supplier...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Issue Purchase Order & Notify Supplier</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
