import React, { useState, useEffect } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useNotifications } from '../../context/NotificationContext';
import { uploadToCloudinary } from '../../lib/cloudinary';
import {
  Truck,
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  X,
  Upload,
  AlertCircle,
  Layers,
  RefreshCw,
  Hash,
  Boxes
} from 'lucide-react';

interface POLineItem {
  id?: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

interface PurchaseOrderSummary {
  id: number;
  supplier_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  items?: POLineItem[];
}

interface SubmitASNModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSupplier: string;
  purchases: PurchaseOrderSummary[];
  preselectedPoId?: number;
  onASNSubmitted?: () => void;
}

export default function SubmitASNModal({
  isOpen,
  onClose,
  activeSupplier,
  purchases,
  preselectedPoId,
  onASNSubmitted
}: SubmitASNModalProps) {
  const { addToast } = useNotifications();
  useModalDismiss(isOpen, onClose);

  const eligiblePOs = purchases.filter(
    (p) =>
      (!activeSupplier || p.supplier_name.toLowerCase().includes(activeSupplier.toLowerCase())) &&
      p.status !== 'received' &&
      p.status !== 'cancelled'
  );

  const [selectedPoId, setSelectedPoId] = useState<number | ''>(
    preselectedPoId || (eligiblePOs.length > 0 ? eligiblePOs[0].id : '')
  );

  const [carrier, setCarrier] = useState('Direct Supplier Fleet');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippedDate, setShippedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eta, setEta] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');

  // Line items state for split shipment & backorders
  const [lineItems, setLineItems] = useState<
    {
      product_id: number;
      product_name: string;
      sku: string;
      quantity_ordered: number;
      quantity_shipped: number;
      backorder_quantity: number;
      batch_lot_number: string;
      expiry_date: string;
    }[]
  >([]);

  // Document upload state (<= 1MB Cloudinary constraint)
  const [file, setFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const targetPO = purchases.find((p) => p.id === Number(selectedPoId));

  // Initialize or reload line items when selected PO changes
  useEffect(() => {
    if (targetPO) {
      if (!trackingNumber) {
        setTrackingNumber(`TRK-${targetPO.id}-${Date.now().toString().slice(-6)}`);
      }
      if (targetPO.items && targetPO.items.length > 0) {
        setLineItems(
          targetPO.items.map((it) => ({
            product_id: it.product_id,
            product_name: it.product_name || `Product #${it.product_id}`,
            sku: it.sku || `SKU-${it.product_id}`,
            quantity_ordered: it.quantity,
            quantity_shipped: it.quantity,
            backorder_quantity: 0,
            batch_lot_number: `LOT-${Date.now().toString().slice(-6)}`,
            expiry_date: new Date(Date.now() + 86400000 * 365).toISOString().slice(0, 10)
          }))
        );
      } else {
        // Fallback placeholder item
        setLineItems([
          {
            product_id: 1,
            product_name: 'Procured Commodity Restock',
            sku: `PO-${targetPO.id}-ITM`,
            quantity_ordered: 50,
            quantity_shipped: 50,
            backorder_quantity: 0,
            batch_lot_number: `LOT-${Date.now().toString().slice(-6)}`,
            expiry_date: new Date(Date.now() + 86400000 * 365).toISOString().slice(0, 10)
          }
        ]);
      }
    }
  }, [selectedPoId, targetPO]);

  const handleQtyShippedChange = (index: number, val: number) => {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const shipped = Math.max(0, val);
        const backorder = Math.max(0, item.quantity_ordered - shipped);
        return {
          ...item,
          quantity_shipped: shipped,
          backorder_quantity: backorder
        };
      })
    );
  };

  const handleBatchChange = (index: number, val: string) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, batch_lot_number: val } : item))
    );
  };

  const hasBackorders = lineItems.some((it) => it.backorder_quantity > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoId) {
      addToast({ title: 'Select Purchase Order', message: 'Please choose an active purchase order to issue an ASN.', type: 'warning' });
      return;
    }

    if (!trackingNumber.trim()) {
      addToast({ title: 'Tracking # Required', message: 'Please provide a shipment tracking or consignment number.', type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let documentUrl: string | undefined = undefined;

      if (file) {
        setIsCompressing(true);
        try {
          const uploadRes = await uploadToCloudinary(file, {
            folder: 'ummis_asns',
            fileName: `ASN_${selectedPoId}_${trackingNumber}`
          });
          documentUrl = uploadRes.url;
        } finally {
          setIsCompressing(false);
        }
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/purchases/${selectedPoId}/asn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          tracking_number: trackingNumber.trim(),
          carrier: carrier.trim(),
          eta,
          shipped_date: shippedDate,
          is_split_shipment: hasBackorders,
          notes: notes.trim(),
          document_url: documentUrl,
          line_items: lineItems
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to submit ASN');
      }

      const resData = await response.json();

      addToast({
        title: 'ASN Dispatched Successfully! 🚚',
        message: `Advanced Shipping Notice registered. ${hasBackorders ? 'Split shipment logged with backorder tracking.' : 'Full order in transit.'}`,
        type: 'success'
      });

      if (onASNSubmitted) onASNSubmitted();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'ASN submission failed');
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
      <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <Truck size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Submit Advanced Shipping Notice (ASN)
              </h2>
              <p className="text-[11px] text-slate-300 font-medium">
                Consignment Tracking • Batch/Lot Tracing • Split Shipments & Backorders
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              <div>
                <strong className="font-bold">Error:</strong> {errorMsg}
              </div>
            </div>
          )}

          {/* 1. Target Purchase Order Selection */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
              Select Purchase Order to Dispatch <span className="text-rose-500">*</span>
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
                  #PO-{p.id} • {p.supplier_name} • ({p.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Logistics & Tracking Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                Logistics Carrier / Transporter <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="e.g. DHL Express, Direct Fleet, DHL Ghana"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                Tracking / Waybill # <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. TRK-89230192"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                Shipped Date
              </label>
              <input
                type="date"
                value={shippedDate}
                onChange={(e) => setShippedDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                Estimated Time of Arrival (ETA) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 3. Line-Item Batch/Lot Details & Split Shipment */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-100 flex items-center justify-between border-b border-slate-200">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Boxes size={14} className="text-blue-600" /> Line-Item Batch / Lot Details & Split Shipment
              </span>
              {hasBackorders && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                  Split Shipment (Backorders Detected)
                </span>
              )}
            </div>

            <div className="p-3 max-h-56 overflow-y-auto space-y-3">
              {lineItems.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span className="truncate">{item.product_name}</span>
                    <span className="font-mono text-slate-500 text-[10px]">SKU: {item.sku}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Ordered</span>
                      <span className="font-black text-slate-900">{item.quantity_ordered} units</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase">
                        Qty Shipped
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={item.quantity_ordered}
                        value={item.quantity_shipped}
                        onChange={(e) => handleQtyShippedChange(idx, parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Backorder</span>
                      <span className={`font-black ${item.backorder_quantity > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {item.backorder_quantity} units
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase">
                        Batch / Lot #
                      </label>
                      <input
                        type="text"
                        value={item.batch_lot_number}
                        onChange={(e) => handleBatchChange(idx, e.target.value)}
                        placeholder="LOT-XXXXXX"
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-mono font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={item.expiry_date}
                        onChange={(e) =>
                          setLineItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, expiry_date: e.target.value } : it))
                          )
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Packing Slip / Consignment Document Upload (Cloudinary <= 1MB) */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
              Packing Slip / Delivery Waybill (Optional • Max 1.0MB)
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-2.5 text-center transition-colors bg-slate-50/60">
              <input
                type="file"
                id="asn-file-input"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="asn-file-input" className="cursor-pointer block">
                <Upload size={18} className="mx-auto text-slate-400 mb-1" />
                <span className="font-bold text-blue-600 hover:underline block text-[11px]">
                  {file ? file.name : 'Select Waybill / Dispatch Slip Document'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  PDF or Images automatically compressed below 1MB
                </span>
              </label>

              {file && (
                <div className="mt-1 text-[10px] font-bold text-slate-600 flex items-center justify-center gap-1.5">
                  <span>{file.name}</span>
                  <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  <button type="button" onClick={() => setFile(null)} className="text-rose-500 hover:text-rose-700">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 5. Dispatch Notes */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
              Dispatch Instructions / Carrier Contact
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Driver will call upon arrival at Central Warehouse Dock Bay 2."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
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
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting || isCompressing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>{isCompressing ? 'Compressing & Uploading...' : 'Submitting ASN...'}</span>
                </>
              ) : (
                <>
                  <Truck size={14} />
                  <span>Dispatch & Submit ASN</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
