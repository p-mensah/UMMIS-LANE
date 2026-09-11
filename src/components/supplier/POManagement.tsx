import React, { useState } from 'react';
import { formatGHS } from '../../lib/formatters';
import {
  Truck,
  PackageCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Paperclip,
  Upload,
  Eye,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Download,
  Calendar,
  Building2,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  User,
  ShieldCheck,
  Send,
  Check,
  Sliders,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw
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

interface DocumentAttachment {
  id: string;
  name: string;
  type: 'invoice' | 'packing_list' | 'bill_of_lading' | 'other';
  size: string;
  uploaded_by: string;
  date: string;
  url?: string;
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
  attachments?: string | DocumentAttachment[];
  invoice_number?: string;
  invoice_status?: 'unpaid' | 'partially_paid' | 'approved' | 'paid';
  // Logistics Fields
  fulfillment_mode?: 'direct_delivery' | 'store_pickup' | string;
  driver_name?: string;
  driver_phone?: string;
  vehicle_number?: string;
  eta_window?: string;
  pickup_address?: string;
  dock_slot?: string;
  dispatch_time?: string;
  pickup_code?: string;
  vendor_contact_person?: string;
  vendor_contact_phone?: string;
}

interface POManagementProps {
  purchases: PurchaseOrder[];
  activeSupplier: string;
  onRefresh: () => void;
  onAcknowledgePO: (poId: number, notes: string) => Promise<void>;
  onDispatchPO: (poId: number, carrier: string, trackingNumber: string, notes: string) => Promise<void>;
  onUploadAttachment: (poId: number, attachment: { name: string; type: string; size: string }) => Promise<void>;
  onUpdateStatus: (poId: number, status: string) => Promise<void>;
  onUpdateLogistics?: (poId: number, logistics: any) => Promise<void>;
  onCreatePO?: () => void;
  catalogProducts?: any[];
  userRole?: string;
}

export default function POManagement({
  purchases,
  activeSupplier,
  onRefresh,
  onAcknowledgePO,
  onDispatchPO,
  onUploadAttachment,
  onUpdateStatus,
  onUpdateLogistics,
  onCreatePO,
  catalogProducts = [],
  userRole = 'admin'
}: POManagementProps) {
  // Quick filters as requested: All, Pending Confirmation, Ready for Pickup, In-Transit, Received, Canceled
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPoId, setExpandedPoId] = useState<number | null>(null);

  // Modals state
  const [ackModalPo, setAckModalPo] = useState<PurchaseOrder | null>(null);
  const [ackNotes, setAckNotes] = useState('Order received and confirmed for production.');

  const [attachModalPo, setAttachModalPo] = useState<PurchaseOrder | null>(null);
  const [docType, setDocType] = useState<'invoice' | 'packing_list' | 'bill_of_lading'>('invoice');
  const [docName, setDocName] = useState('');

  // Logistics & Fulfillment Modal State
  const [logisticsModalPo, setLogisticsModalPo] = useState<PurchaseOrder | null>(null);
  const [fulfillmentMode, setFulfillmentMode] = useState<'direct_delivery' | 'store_pickup'>('direct_delivery');
  
  // Direct Delivery fields
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [dispatchTime, setDispatchTime] = useState('');
  const [etaWindow, setEtaWindow] = useState('');
  const [dockSlot, setDockSlot] = useState('Dock Bay 2');

  // Store Pickup fields
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCode, setPickupCode] = useState('');
  const [vendorContactPerson, setVendorContactPerson] = useState('');
  const [vendorContactPhone, setVendorContactPhone] = useState('');
  const [storeVehicleDriver, setStoreVehicleDriver] = useState('Store Van #3 (Kojo Osei)');
  const [scheduledPickupDate, setScheduledPickupDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Open logistics modal with prefilled data
  const handleOpenLogistics = (po: PurchaseOrder) => {
    setLogisticsModalPo(po);
    const mode = (po.fulfillment_mode === 'store_pickup' ? 'store_pickup' : 'direct_delivery') as any;
    setFulfillmentMode(mode);
    setDriverName(po.driver_name || (mode === 'direct_delivery' ? 'Kwame Asante' : ''));
    setDriverPhone(po.driver_phone || '+233 24 991 2234');
    setVehicleNumber(po.vehicle_number || (mode === 'direct_delivery' ? 'GE-4421-23' : 'GS-8901-22'));
    setDispatchTime(po.dispatch_time || new Date().toISOString().slice(0, 16));
    setEtaWindow(po.eta_window || 'Today, 2:00 PM - 4:00 PM');
    setDockSlot(po.dock_slot || 'Bay Slot #2 (Central Inbound)');
    setPickupAddress(po.pickup_address || `${po.supplier_name} Central Logistics Depot, Spintex Road, Accra`);
    setPickupCode(po.pickup_code || `PK-${po.id}-${Math.floor(Math.random() * 899 + 100)}`);
    setVendorContactPerson(po.vendor_contact_person || 'Akosua Boakye (Depot Mgr)');
    setVendorContactPhone(po.vendor_contact_phone || '+233 20 882 1190');
    setStoreVehicleDriver(po.driver_name || 'Store Dispatch Van #2 (Kojo Osei)');
    setScheduledPickupDate(po.eta_window || 'Tomorrow, 10:00 AM');
  };

  const handleLogisticsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logisticsModalPo) return;
    setIsSubmitting(true);
    try {
      const payload: any = {
        fulfillment_mode: fulfillmentMode
      };

      if (fulfillmentMode === 'direct_delivery') {
        payload.driver_name = driverName;
        payload.driver_phone = driverPhone;
        payload.vehicle_number = vehicleNumber;
        payload.dispatch_time = dispatchTime;
        payload.eta_window = etaWindow;
        payload.dock_slot = dockSlot;
      } else {
        payload.driver_name = storeVehicleDriver;
        payload.pickup_address = pickupAddress;
        payload.eta_window = scheduledPickupDate;
        payload.pickup_code = pickupCode;
        payload.vendor_contact_person = vendorContactPerson;
        payload.vendor_contact_phone = vendorContactPhone;
        payload.vehicle_number = vehicleNumber;
      }

      if (onUpdateLogistics) {
        await onUpdateLogistics(logisticsModalPo.id, payload);
      } else {
        // Fallback dispatch
        await onDispatchPO(
          logisticsModalPo.id,
          fulfillmentMode === 'direct_delivery' ? `Direct Vendor Delivery (${driverName})` : `Store Pickup (${storeVehicleDriver})`,
          payload.vehicle_number || payload.pickup_code || 'LOCAL',
          `${fulfillmentMode.toUpperCase()}: ETA ${payload.eta_window}`
        );
      }

      setLogisticsModalPo(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update logistics.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter purchases
  const filteredPOs = purchases.filter((po) => {
    const matchesSupplier = !activeSupplier || po.supplier_name.toLowerCase().includes(activeSupplier.toLowerCase());
    
    // Status pipeline mapping
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      const st = po.status.toLowerCase();
      if (statusFilter === 'pending_confirmation') {
        matchesStatus = ['pending', 'pending_confirmation', 'submitted', 'ordered'].includes(st);
      } else if (statusFilter === 'ready_for_pickup') {
        matchesStatus = st === 'ready_for_pickup' || st === 'preparing';
      } else if (statusFilter === 'in-transit') {
        matchesStatus = st === 'in-transit' || st === 'out_for_delivery';
      } else if (statusFilter === 'received') {
        matchesStatus = st === 'received';
      } else if (statusFilter === 'cancelled') {
        matchesStatus = st === 'cancelled';
      } else if (statusFilter === 'draft') {
        matchesStatus = st === 'draft';
      }
    }

    const matchesSearch =
      searchQuery === '' ||
      po.id.toString().includes(searchQuery) ||
      po.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (po.carrier && po.carrier.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (po.driver_name && po.driver_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (po.tracking_number && po.tracking_number.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSupplier && matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-slate-100 text-slate-700 border border-slate-300 uppercase">Draft</span>;
      case 'pending':
      case 'pending_confirmation':
      case 'ordered':
      case 'submitted':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase flex items-center gap-1"><Clock size={10} /> Pending Confirmation</span>;
      case 'ready_for_pickup':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-purple-50 text-purple-700 border border-purple-200 uppercase flex items-center gap-1"><Building2 size={10} /> Ready for Pickup</span>;
      case 'in-transit':
      case 'out_for_delivery':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase flex items-center gap-1"><Truck size={10} /> In-Transit / Out for Delivery</span>;
      case 'received':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase flex items-center gap-1"><CheckCircle2 size={10} /> Received & Inspected</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-rose-50 text-rose-700 border border-rose-200 uppercase">Canceled</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-slate-100 text-slate-700 uppercase">{status}</span>;
    }
  };

  const parseAttachments = (raw: any): DocumentAttachment[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  const handleAckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ackModalPo) return;
    setIsSubmitting(true);
    try {
      await onAcknowledgePO(ackModalPo.id, ackNotes);
      setAckModalPo(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachModalPo) return;
    setIsSubmitting(true);
    try {
      const generatedName = docName || `PO_${attachModalPo.id}_${docType.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;
      await onUploadAttachment(attachModalPo.id, {
        name: generatedName,
        type: docType,
        size: `${Math.floor(Math.random() * 200 + 150)} KB`
      });
      setAttachModalPo(null);
      setDocName('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Control bar: Quick Filters, Search, and Action Buttons */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Search Box */}
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search PO #, driver, vendor, tracking..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Quick Filters as mandated */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs overflow-x-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'pending_confirmation', label: 'Pending Confirmation' },
              { id: 'ready_for_pickup', label: 'Ready for Pickup' },
              { id: 'in-transit', label: 'In-Transit' },
              { id: 'received', label: 'Received' },
              { id: 'cancelled', label: 'Canceled' }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-black whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === st.id ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {onCreatePO && (
          <button
            onClick={onCreatePO}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 shadow-sm shrink-0 cursor-pointer transition"
          >
            <Plus size={14} /> Create New PO
          </button>
        )}
      </div>

      {/* PO List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="p-3.5">PO # / Date</th>
                <th className="p-3.5">Vendor Partner</th>
                <th className="p-3.5">Lifecycle Status</th>
                <th className="p-3.5">Total Amount</th>
                <th className="p-3.5">Fulfillment & Logistics</th>
                <th className="p-3.5">Documents</th>
                <th className="p-3.5 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    No purchase orders matching the current filter.
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => {
                  const isExpanded = expandedPoId === po.id;
                  const attachments = parseAttachments(po.attachments);
                  const st = po.status.toLowerCase();
                  const isPending = ['pending', 'pending_confirmation', 'ordered', 'submitted'].includes(st);
                  const isReadyPickup = st === 'ready_for_pickup';
                  const isInTransit = ['in-transit', 'out_for_delivery'].includes(st);
                  const isReceived = st === 'received';
                  const isDraft = st === 'draft';

                  return (
                    <React.Fragment key={po.id}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 font-bold font-mono text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                              className="text-slate-400 hover:text-slate-600 cursor-pointer"
                              title="Toggle Order Details"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <span className="font-black text-slate-900">#PO-{po.id}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans font-medium mt-0.5">
                            {new Date(po.created_at).toLocaleDateString()}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span className="font-black text-slate-900 block">{po.supplier_name}</span>
                          <span className="text-[11px] text-slate-500 block">{po.supplier_contact || 'Local Vendor'}</span>
                        </td>

                        <td className="p-3.5">
                          {getStatusBadge(po.status)}
                          {po.acknowledged_at && (
                            <span className="block text-[10px] text-emerald-600 font-bold mt-1">
                              ✓ Ack: {new Date(po.acknowledged_at).toLocaleDateString()}
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 font-black text-slate-900">
                          {formatGHS(po.total_amount)}
                          {po.invoice_status && (
                            <span className={`block text-[9px] font-bold uppercase tracking-wider mt-0.5 ${
                              po.invoice_status === 'paid' ? 'text-emerald-600' : 'text-slate-500'
                            }`}>
                              Inv: {po.invoice_status}
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          {po.fulfillment_mode === 'store_pickup' ? (
                            <div className="text-[11px] space-y-0.5">
                              <span className="font-bold text-purple-700 flex items-center gap-1">
                                <Building2 size={12} /> Warehouse Pickup
                              </span>
                              <span className="text-[10px] text-slate-600 block">
                                {po.driver_name || 'Assigned Store Vehicle'}
                              </span>
                              {po.pickup_code && (
                                <span className="font-mono text-[9px] font-bold text-slate-500 block">
                                  Code: {po.pickup_code}
                                </span>
                              )}
                            </div>
                          ) : po.fulfillment_mode === 'direct_delivery' || po.driver_name || po.carrier ? (
                            <div className="text-[11px] space-y-0.5">
                              <span className="font-bold text-blue-700 flex items-center gap-1">
                                <Truck size={12} /> Direct Delivery
                              </span>
                              <span className="text-[10px] text-slate-700 block">
                                Driver: {po.driver_name || po.carrier || 'Vendor Driver'}
                              </span>
                              {po.dock_slot && (
                                <span className="text-[9px] font-bold text-slate-500 block">
                                  Slot: {po.dock_slot}
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenLogistics(po)}
                              className="text-blue-600 hover:text-blue-800 text-[11px] font-bold underline cursor-pointer"
                            >
                              + Configure Logistics
                            </button>
                          )}
                        </td>

                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {attachments.length > 0 ? (
                              attachments.map((doc, dIdx) => (
                                <span
                                  key={dIdx}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700"
                                  title={`${doc.name} (${doc.type})`}
                                >
                                  <FileText size={11} className="text-blue-600" />
                                  <span className="capitalize">{doc.type.replace('_', ' ')}</span>
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-300 text-[11px] italic">None</span>
                            )}
                            <button
                              onClick={() => setAttachModalPo(po)}
                              className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition-colors"
                              title="Attach Document (Invoice, Packing List, Bill of Lading)"
                            >
                              <Paperclip size={13} />
                            </button>
                          </div>
                        </td>

                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Action 1: Confirm Order */}
                            {(isDraft || (isPending && !po.acknowledged_at)) && (
                              <button
                                onClick={() => {
                                  setAckModalPo(po);
                                  setAckNotes(`Order #PO-${po.id} accepted and confirmed for production.`);
                                }}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-black text-[10px] uppercase tracking-wider rounded border border-amber-200 transition-colors"
                                title="Confirm Order / Acknowledgment"
                              >
                                Confirm Order
                              </button>
                            )}

                            {/* Action 2: Mark Ready for Pickup */}
                            {(isPending || isDraft) && !isReadyPickup && (
                              <button
                                onClick={() => onUpdateStatus(po.id, 'ready_for_pickup')}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 font-black text-[10px] uppercase tracking-wider rounded border border-purple-200 transition-colors"
                                title="Vendor has packed order; ready for pickup"
                              >
                                Mark Ready for Pickup
                              </button>
                            )}

                            {/* Action 3: Dispatch / Configure Logistics */}
                            {!isReceived && po.status !== 'cancelled' && (
                              <button
                                onClick={() => handleOpenLogistics(po)}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-black text-[10px] uppercase tracking-wider rounded border border-blue-200 transition-colors flex items-center gap-1"
                                title="Configure Direct Delivery or Warehouse Pickup Logistics"
                              >
                                <Truck size={11} /> {isInTransit ? 'Edit Logistics' : 'Dispatch / Pickup'}
                              </button>
                            )}

                            {/* Action 4: Receive & Stock */}
                            {!isReceived && po.status !== 'cancelled' && (
                              <button
                                onClick={() => onUpdateStatus(po.id, 'received')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded transition-colors shadow-2xs flex items-center gap-1"
                                title="Goods physically received, verified & stocked into inventory"
                              >
                                <CheckCircle2 size={11} /> Receive & Stock
                              </button>
                            )}

                            {/* Cancel Option */}
                            {!isReceived && po.status !== 'cancelled' && (
                              <button
                                onClick={() => {
                                  if (confirm(`Cancel Purchase Order #PO-${po.id}?`)) {
                                    onUpdateStatus(po.id, 'cancelled');
                                  }
                                }}
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded"
                                title="Cancel PO"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded PO details: Line Items, Full Logistics & Attachments */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={7} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Order Line Items */}
                              <div className="md:col-span-2 space-y-2">
                                <div className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                                  <span>Order Line Items ({po.items?.length || 0})</span>
                                  <span>Expected Delivery: {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : 'Standard SLA'}</span>
                                </div>
                                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                                  {po.items && po.items.length > 0 ? (
                                    po.items.map((item, iIdx) => (
                                      <div key={iIdx} className="p-2.5 flex items-center justify-between text-xs">
                                        <div>
                                          <span className="font-bold text-slate-900 block">{item.product_name}</span>
                                          <span className="text-[10px] font-mono text-slate-400">SKU: {item.sku}</span>
                                        </div>
                                        <div className="text-right">
                                          <span className="font-black text-slate-900 block">{item.quantity} units @ {formatGHS(item.unit_price)}</span>
                                          <span className="text-[10px] text-blue-600 font-bold">{formatGHS(item.quantity * item.unit_price)}</span>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="p-3 text-center text-slate-400 text-xs">No item details loaded for this PO.</div>
                                  )}
                                </div>
                                {po.notes && (
                                  <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                                    <strong className="text-slate-800">Order Notes:</strong> {po.notes}
                                  </p>
                                )}
                              </div>

                              {/* Logistics Summary Card */}
                              <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <Truck size={14} className="text-blue-600" /> Logistics Profile
                                  </span>
                                  <button
                                    onClick={() => handleOpenLogistics(po)}
                                    className="text-[10px] font-bold text-blue-600 hover:underline"
                                  >
                                    Configure
                                  </button>
                                </div>

                                <div className="text-xs space-y-1.5 text-slate-700">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Mode:</span>
                                    <span className="font-bold capitalize">{po.fulfillment_mode === 'store_pickup' ? 'Store Pickup (Warehouse Fleet)' : 'Direct Delivery (Vendor Truck)'}</span>
                                  </div>

                                  {po.driver_name && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Driver / Fleet:</span>
                                      <span className="font-bold">{po.driver_name}</span>
                                    </div>
                                  )}

                                  {po.driver_phone && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Driver Phone:</span>
                                      <span className="font-bold">{po.driver_phone}</span>
                                    </div>
                                  )}

                                  {po.vehicle_number && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Vehicle Reg:</span>
                                      <span className="font-mono font-bold">{po.vehicle_number}</span>
                                    </div>
                                  )}

                                  {po.eta_window && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">ETA Window:</span>
                                      <span className="font-bold text-blue-700">{po.eta_window}</span>
                                    </div>
                                  )}

                                  {po.dock_slot && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Dock Slot:</span>
                                      <span className="font-bold text-emerald-700">{po.dock_slot}</span>
                                    </div>
                                  )}

                                  {po.pickup_code && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Pickup Code:</span>
                                      <span className="font-mono font-black text-purple-700">{po.pickup_code}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Logistics & Fulfillment Mode Configuration Modal */}
      {logisticsModalPo && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-blue-400" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Logistics & Fulfillment Configuration
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    PO #PO-{logisticsModalPo.id} • {logisticsModalPo.supplier_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLogisticsModalPo(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLogisticsSubmit} className="p-6 space-y-4">
              {/* Fulfillment Model Toggle */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Select Local Fulfillment Model
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFulfillmentMode('direct_delivery')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      fulfillmentMode === 'direct_delivery'
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Truck size={16} className={fulfillmentMode === 'direct_delivery' ? 'text-blue-600' : 'text-slate-500'} />
                      <span className="font-black text-xs text-slate-900">Option A: Direct Delivery</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Vendor dispatches delivery directly to store/warehouse dock.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFulfillmentMode('store_pickup')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      fulfillmentMode === 'store_pickup'
                        ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 size={16} className={fulfillmentMode === 'store_pickup' ? 'text-purple-600' : 'text-slate-500'} />
                      <span className="font-black text-xs text-slate-900">Option B: Store Pickup</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Warehouse team or store driver collects from vendor depot.
                    </p>
                  </button>
                </div>
              </div>

              {/* Option A: Direct Delivery Fields */}
              {fulfillmentMode === 'direct_delivery' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-150">
                  <div className="text-xs font-black uppercase text-blue-900 flex items-center gap-1.5">
                    <Truck size={14} /> Vendor Delivery Logistics
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Delivery Driver Name</label>
                      <input
                        type="text"
                        required
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder="e.g. Kwame Asante"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Driver Phone Number</label>
                      <input
                        type="tel"
                        value={driverPhone}
                        onChange={(e) => setDriverPhone(e.target.value)}
                        placeholder="+233 24 991 2234"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Vehicle Registration Number</label>
                      <input
                        type="text"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        placeholder="e.g. GE-4421-23"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold font-mono text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Destination Dock Slot</label>
                      <input
                        type="text"
                        value={dockSlot}
                        onChange={(e) => setDockSlot(e.target.value)}
                        placeholder="e.g. Bay Slot #2 (Central Inbound)"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Dispatch Date & Time</label>
                      <input
                        type="datetime-local"
                        value={dispatchTime}
                        onChange={(e) => setDispatchTime(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Estimated Arrival (ETA Window)</label>
                      <input
                        type="text"
                        value={etaWindow}
                        onChange={(e) => setEtaWindow(e.target.value)}
                        placeholder="e.g. Today, 2:00 PM - 4:00 PM"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Option B: Store Pickup Fields */}
              {fulfillmentMode === 'store_pickup' && (
                <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200 space-y-3 animate-in fade-in duration-150">
                  <div className="text-xs font-black uppercase text-purple-900 flex items-center gap-1.5">
                    <Building2 size={14} /> Warehouse Pickup Schedule & Depot Details
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Designated Vendor Pickup Address / Depot</label>
                      <input
                        type="text"
                        required
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                        placeholder="Depot address, Spintex Rd, Accra"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Assigned Store Driver / Vehicle</label>
                      <input
                        type="text"
                        value={storeVehicleDriver}
                        onChange={(e) => setStoreVehicleDriver(e.target.value)}
                        placeholder="Store Van #2 (Kojo Osei)"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Scheduled Pickup Date / Window</label>
                      <input
                        type="text"
                        value={scheduledPickupDate}
                        onChange={(e) => setScheduledPickupDate(e.target.value)}
                        placeholder="Tomorrow, 10:00 AM - 12:00 PM"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Vendor Contact Person</label>
                      <input
                        type="text"
                        value={vendorContactPerson}
                        onChange={(e) => setVendorContactPerson(e.target.value)}
                        placeholder="Akosua Boakye (Depot Manager)"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Vendor Contact Phone</label>
                      <input
                        type="tel"
                        value={vendorContactPhone}
                        onChange={(e) => setVendorContactPhone(e.target.value)}
                        placeholder="+233 20 882 1190"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Pickup Confirmation Code / Receipt Note</label>
                      <input
                        type="text"
                        value={pickupCode}
                        onChange={(e) => setPickupCode(e.target.value)}
                        placeholder="PK-2026-XXXX"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-black text-purple-800 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLogisticsModalPo(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={14} />
                  <span>{isSubmitting ? 'Saving...' : 'Save Logistics Configuration'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Acknowledgment Modal */}
      {ackModalPo && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 bg-amber-500 text-white flex items-center justify-between">
              <span className="font-black text-xs uppercase tracking-wider">Confirm Order Acceptance</span>
              <button onClick={() => setAckModalPo(null)} className="text-white hover:text-amber-100">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAckSubmit} className="p-5 space-y-3.5">
              <p className="text-xs text-slate-600">
                Confirm order acceptance for <strong>#PO-{ackModalPo.id}</strong> ({ackModalPo.supplier_name}).
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Acknowledgment Note</label>
                <textarea
                  rows={3}
                  required
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAckModalPo(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase rounded-lg"
                >
                  Confirm & Notify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Attachment Modal */}
      {attachModalPo && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <span className="font-black text-xs uppercase tracking-wider">Attach Logistics Document</span>
              <button onClick={() => setAttachModalPo(null)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAttachSubmit} className="p-5 space-y-3.5">
              <p className="text-xs text-slate-600">
                Link electronic document to <strong>#PO-{attachModalPo.id}</strong>.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Document Classification</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-white"
                >
                  <option value="invoice">Commercial Invoice</option>
                  <option value="packing_list">Packing List / Manifest</option>
                  <option value="bill_of_lading">Bill of Lading / Waybill</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder={`PO_${attachModalPo.id}_${docType.toUpperCase()}.pdf`}
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                />
              </div>
              <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500">
                <Upload size={20} className="mx-auto text-slate-400 mb-1" />
                <span>Simulated PDF Attachment Ready</span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAttachModalPo(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase rounded-lg"
                >
                  Attach Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
