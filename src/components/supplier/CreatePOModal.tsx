import React, { useState, useEffect } from 'react';
import { formatGHS } from '../../lib/formatters';
import { validators } from '../../lib/validation';
import { FormField, ValidatedInput, ValidatedSelect, ValidatedTextarea } from '../common/FormField';
import {
  Plus,
  Trash2,
  X,
  Building2,
  Calendar,
  Truck,
  Package,
  AlertCircle,
  Clock,
  CheckCircle2,
  CreditCard,
  Check
} from 'lucide-react';

interface ProductItem {
  id: number;
  name: string;
  sku: string;
  cost_price: number;
  stock_quantity: number;
  brand?: string;
  category?: string;
}

interface POLineItem {
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  stock_quantity: number;
}

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSupplier: string;
  availableSuppliers: string[];
  catalog: ProductItem[];
  prefilledItem?: { id: number; quantity?: number; cost_price?: number; name?: string };
  onSubmit: (poData: any) => Promise<void>;
}

export default function CreatePOModal({
  isOpen,
  onClose,
  activeSupplier,
  availableSuppliers,
  catalog,
  prefilledItem,
  onSubmit
}: CreatePOModalProps) {
  const [supplierName, setSupplierName] = useState(activeSupplier || 'Nestlé Ghana Ltd');
  const [supplierContact, setSupplierContact] = useState('Procurement Desk');
  const [expectedDate, setExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [fulfillmentMode, setFulfillmentMode] = useState<'direct_delivery' | 'store_pickup'>('direct_delivery');
  const [dockSlot, setDockSlot] = useState('Bay Slot #2 (Central Inbound)');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [notes, setNotes] = useState('Standard replenishment delivery to central warehouse dock.');

  // Multi-line items state
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [selectedQty, setSelectedQty] = useState<number>(50);
  const [selectedUnitPrice, setSelectedUnitPrice] = useState<number>(20);

  // Field touched states for real-time visual feedback
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize line items
  useEffect(() => {
    if (isOpen) {
      setSupplierName(activeSupplier || (availableSuppliers.length > 0 ? availableSuppliers[0] : 'Nestlé Ghana Ltd'));
      
      if (prefilledItem && catalog.length > 0) {
        const prod = catalog.find((c) => c.id === prefilledItem.id);
        if (prod) {
          setLineItems([
            {
              product_id: prod.id,
              product_name: prod.name,
              sku: prod.sku,
              quantity: prefilledItem.quantity || 50,
              unit_price: prefilledItem.cost_price || prod.cost_price || 20,
              stock_quantity: prod.stock_quantity || 0
            }
          ]);
        }
      } else if (catalog.length > 0) {
        const initialProd = catalog[0];
        setLineItems([
          {
            product_id: initialProd.id,
            product_name: initialProd.name,
            sku: initialProd.sku,
            quantity: 50,
            unit_price: initialProd.cost_price || 20,
            stock_quantity: initialProd.stock_quantity || 0
          }
        ]);
      } else {
        setLineItems([]);
      }
      setTouched({});
      setErrors({});
    }
  }, [isOpen, activeSupplier, prefilledItem, catalog, availableSuppliers]);

  if (!isOpen) return null;

  // Real-time validation checks
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    const suppErr = validators.required('Supplier name is required')(supplierName);
    if (suppErr) newErrors.supplierName = suppErr;

    const dateErr = validators.required('Expected delivery date is required')(expectedDate);
    if (dateErr) {
      newErrors.expectedDate = dateErr;
    } else {
      const futureErr = validators.futureDate('Delivery date must be today or in the future')(expectedDate);
      if (futureErr) newErrors.expectedDate = futureErr;
    }

    if (lineItems.length === 0) {
      newErrors.lineItems = 'At least one line item is required to issue a purchase order.';
    }

    // Check individual items
    for (let i = 0; i < lineItems.length; i++) {
      const it = lineItems[i];
      if (!it.quantity || it.quantity < 1) {
        newErrors[`item_${i}_qty`] = 'Quantity must be at least 1 unit';
      }
      if (!it.unit_price || it.unit_price <= 0) {
        newErrors[`item_${i}_price`] = 'Unit cost must be greater than 0';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Add an item to the PO line items
  const handleAddLineItem = () => {
    if (!selectedProductId) {
      alert('Please select a product from the catalog');
      return;
    }
    const prod = catalog.find((c) => c.id === Number(selectedProductId));
    if (!prod) return;

    // Check if already in lineItems
    const existsIndex = lineItems.findIndex((it) => it.product_id === prod.id);
    if (existsIndex >= 0) {
      // Increase quantity
      const updated = [...lineItems];
      updated[existsIndex].quantity += selectedQty;
      setLineItems(updated);
    } else {
      setLineItems([
        ...lineItems,
        {
          product_id: prod.id,
          product_name: prod.name,
          sku: prod.sku,
          quantity: selectedQty,
          unit_price: selectedUnitPrice || prod.cost_price || 20,
          stock_quantity: prod.stock_quantity || 0
        }
      ]);
    }

    // Reset picker
    setSelectedProductId('');
    setSelectedQty(50);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, idx) => idx !== index));
  };

  const handleUpdateItemQty = (index: number, qty: number) => {
    const updated = [...lineItems];
    updated[index].quantity = qty;
    setLineItems(updated);
    setTouched((prev) => ({ ...prev, [`item_${index}_qty`]: true }));
  };

  const handleUpdateItemPrice = (index: number, price: number) => {
    const updated = [...lineItems];
    updated[index].unit_price = price;
    setLineItems(updated);
    setTouched((prev) => ({ ...prev, [`item_${index}_price`]: true }));
  };

  const calculateTotalAmount = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const calculateTotalUnits = () => {
    return lineItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      supplierName: true,
      expectedDate: true,
      ...lineItems.reduce((acc, _, i) => ({ ...acc, [`item_${i}_qty`]: true, [`item_${i}_price`]: true }), {})
    });

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        supplier_name: supplierName,
        supplier_contact: supplierContact,
        status: 'ordered',
        notes,
        expected_date: expectedDate,
        fulfillment_mode: fulfillmentMode,
        dock_slot: dockSlot,
        items: lineItems.map((it) => ({
          product_id: it.product_id,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price)
        }))
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to issue purchase order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Plus size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">
                Create & Issue Purchase Order
              </h3>
              <p className="text-[11px] text-slate-400">
                Multi-item procurement order with SLA date & inbound logistics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Row 1: Supplier & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Supplier / Vendor"
              required
              error={errors.supplierName}
              isTouched={touched.supplierName}
              isValid={!errors.supplierName}
            >
              <ValidatedSelect
                value={supplierName}
                onChange={(e) => {
                  setSupplierName(e.target.value);
                  setTouched((prev) => ({ ...prev, supplierName: true }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, supplierName: true }))}
                error={errors.supplierName}
                isTouched={touched.supplierName}
                isValid={!errors.supplierName}
              >
                {availableSuppliers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </ValidatedSelect>
            </FormField>

            <FormField label="Supplier Contact / Desk" helperText="Vendor account or representative name">
              <ValidatedInput
                type="text"
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
                placeholder="e.g. Sales Desk / Akosua"
              />
            </FormField>
          </div>

          {/* Row 2: SLA Expected Delivery & Payment Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label="Expected Delivery (SLA)"
              required
              error={errors.expectedDate}
              isTouched={touched.expectedDate}
              isValid={!errors.expectedDate}
              helperText="Scheduled arrival window"
            >
              <ValidatedInput
                type="date"
                required
                value={expectedDate}
                onChange={(e) => {
                  setExpectedDate(e.target.value);
                  setTouched((prev) => ({ ...prev, expectedDate: true }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, expectedDate: true }))}
                error={errors.expectedDate}
                isTouched={touched.expectedDate}
                isValid={!errors.expectedDate}
              >
                {null}
              </ValidatedInput>
            </FormField>

            <FormField label="Fulfillment Model">
              <ValidatedSelect
                value={fulfillmentMode}
                onChange={(e) => setFulfillmentMode(e.target.value as any)}
              >
                <option value="direct_delivery">Direct Vendor Delivery</option>
                <option value="store_pickup">Warehouse Store Pickup</option>
              </ValidatedSelect>
            </FormField>

            <FormField label="Receiving Dock Slot">
              <ValidatedSelect
                value={dockSlot}
                onChange={(e) => setDockSlot(e.target.value)}
              >
                <option value="Bay Slot #1 (Standard Inbound)">Bay Slot #1 (Standard Inbound)</option>
                <option value="Bay Slot #2 (Central Inbound)">Bay Slot #2 (Central Inbound)</option>
                <option value="Bay Slot #3 (High-Volume Dock)">Bay Slot #3 (High-Volume Dock)</option>
              </ValidatedSelect>
            </FormField>
          </div>

          {/* Multi-Line Items Builder */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Package size={14} className="text-blue-600" />
                Purchase Order Line Items ({lineItems.length})
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {calculateTotalUnits()} total units
              </span>
            </div>

            {/* Quick Product Add Row */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Add Catalog Product to Order
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <div className="sm:col-span-6">
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      const pid = Number(e.target.value);
                      setSelectedProductId(pid);
                      const prod = catalog.find((c) => c.id === pid);
                      if (prod && prod.cost_price) {
                        setSelectedUnitPrice(prod.cost_price);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">-- Select Product to Order --</option>
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Stock: {c.stock_quantity}) — {formatGHS(c.cost_price || 0)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <input
                    type="number"
                    min={1}
                    value={selectedQty}
                    onChange={(e) => setSelectedQty(Math.max(1, parseInt(e.target.value) || 1))}
                    placeholder="Qty"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-bold text-center focus:outline-none focus:border-blue-500"
                    title="Order Quantity"
                  />
                </div>

                <div className="sm:col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    value={selectedUnitPrice}
                    onChange={(e) => setSelectedUnitPrice(parseFloat(e.target.value) || 0)}
                    placeholder="Unit Cost"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-bold text-center focus:outline-none focus:border-blue-500"
                    title="Unit Cost (GHS)"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    disabled={!selectedProductId}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded flex items-center justify-center gap-1 transition shadow-2xs cursor-pointer"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
            </div>

            {/* Current Line Items Table */}
            {lineItems.length > 0 ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2 pl-3">Item Description</th>
                      <th className="p-2 w-24 text-center">Qty</th>
                      <th className="p-2 w-28 text-center">Unit Price (GHS)</th>
                      <th className="p-2 w-28 text-right">Line Total</th>
                      <th className="p-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.map((item, idx) => {
                      const qtyErr = errors[`item_${idx}_qty`];
                      const priceErr = errors[`item_${idx}_price`];
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="p-2 pl-3">
                            <div className="font-bold text-slate-900">{item.product_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              SKU: {item.sku || 'N/A'} • On Hand: {item.stock_quantity}
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value) || 1)}
                              className={`w-16 px-1.5 py-1 border text-center font-bold rounded focus:outline-none ${
                                qtyErr ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                              }`}
                            />
                            {qtyErr && <div className="text-[9px] text-rose-600 mt-0.5">{qtyErr}</div>}
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                              className={`w-20 px-1.5 py-1 border text-center font-bold rounded focus:outline-none ${
                                priceErr ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                              }`}
                            />
                            {priceErr && <div className="text-[9px] text-rose-600 mt-0.5">{priceErr}</div>}
                          </td>
                          <td className="p-2 text-right font-mono font-black text-slate-900">
                            {formatGHS(item.quantity * item.unit_price)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 border border-dashed border-slate-300 rounded-lg text-center text-slate-400">
                <Package size={24} className="mx-auto mb-1 opacity-40" />
                <p className="font-bold text-xs">No items added to this purchase order yet</p>
                <p className="text-[11px] mt-0.5">Select a product above to add it to the order.</p>
              </div>
            )}

            {errors.lineItems && (
              <div className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                <AlertCircle size={12} /> {errors.lineItems}
              </div>
            )}

            {/* Calculated Grand Total Strip */}
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-900">Calculated PO Total:</span>
                <span className="text-[11px] text-blue-700">({lineItems.length} lines, {calculateTotalUnits()} units)</span>
              </div>
              <span className="font-mono font-black text-blue-900 text-sm">
                {formatGHS(calculateTotalAmount())}
              </span>
            </div>
          </div>

          {/* Notes & Delivery Instructions */}
          <FormField label="Order Notes & Special Delivery Guidelines" helperText="Any packaging, palletization, or dock requirements">
            <ValidatedTextarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Standard replenishment delivery to central warehouse dock."
            />
          </FormField>

          {/* Submit Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || lineItems.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-wider rounded-lg shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Check size={14} />
              <span>{isSubmitting ? 'Issuing Purchase Order...' : 'Issue Purchase Order'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
