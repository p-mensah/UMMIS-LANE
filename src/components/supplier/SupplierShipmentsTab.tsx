import React, { useState } from 'react';
import { formatGHS } from '../../lib/formatters';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { fetchApi } from '../../lib/api';
import type { Shipment, SupplierProduct } from '../../types/supplier';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  ChevronDown,
  X,
  FileCheck,
  Package,
  Layers,
  ShieldCheck,
  CreditCard,
  FileText,
  Printer,
  Check,
  AlertCircle,
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  Send,
  Eye
} from 'lucide-react';

interface SupplierShipmentsTabProps {
  shipments: Shipment[];
  products: SupplierProduct[];
  purchases?: any[];
  activeSupplier: string;
  onRefresh: () => void;
  onAcknowledgePO?: (poId: number, notes: string) => Promise<void>;
  onAttachInvoice?: (shipment: Shipment) => void;
  onAttachInvoiceForPO?: (po: any) => void;
  userRole?: string;
}

export default function SupplierShipmentsTab({
  shipments,
  products,
  purchases = [],
  activeSupplier,
  onRefresh,
  onAcknowledgePO,
  onAttachInvoice,
  onAttachInvoiceForPO,
  userRole
}: SupplierShipmentsTabProps) {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const isAdmin = userRole === 'admin';

  // Sub-view: "orders" (Store Owner POs) vs "shipments" (Dispatched Shipments)
  const [activeSubView, setActiveSubView] = useState<'orders' | 'shipments'>('orders');

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState<'all' | 'preparing' | 'in_transit' | 'delivered' | 'verified'>('all');
  const [poStatusFilter, setPoStatusFilter] = useState<string>('all');
  
  // Expanded row tracking
  const [expandedShipmentId, setExpandedShipmentId] = useState<number | null>(null);
  const [expandedPoId, setExpandedPoId] = useState<number | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [verifyingShipment, setVerifyingShipment] = useState<Shipment | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // PO Action Modals
  const [acknowledgingPo, setAcknowledgingPo] = useState<any | null>(null);
  const [ackNotes, setAckNotes] = useState('Order accepted. Preparation started.');
  const [ackPromisedDate, setAckPromisedDate] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);

  const [packingSlipPo, setPackingSlipPo] = useState<any | null>(null);

  // Create Shipment Form State (Support linking directly to a Store PO)
  const [linkedPoId, setLinkedPoId] = useState<number | null>(null);
  const [carrier, setCarrier] = useState('FedEx Freight Ghana');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [eta, setEta] = useState(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  const [shippedDate, setShippedDate] = useState(new Date().toISOString().slice(0, 10));
  const [destination, setDestination] = useState('Main Store Warehouse Dock');
  const [notes, setNotes] = useState('Central warehouse restocking consignment.');
  const [selectedItems, setSelectedItems] = useState<{ productId: number; quantity: number }[]>([
    { productId: products[0]?.id || 1, quantity: 50 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate incoming PO metrics
  const pendingOrders = purchases.filter(p =>
    p.status === 'pending' || p.status === 'pending_confirmation' || p.status === 'ordered' || p.status === 'draft'
  );

  // Open modal for generic restock shipment
  const handleOpenCreateGeneric = () => {
    setLinkedPoId(null);
    setCarrier('FedEx Freight Ghana');
    setTrackingNumber(`TRK-${Math.floor(100000 + Math.random() * 900000)}`);
    setEta(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    setShippedDate(new Date().toISOString().slice(0, 10));
    setDestination('Main Store Warehouse Dock');
    setNotes('Central warehouse restocking consignment.');
    setSelectedItems([{ productId: products[0]?.id || 1, quantity: 50 }]);
    setShowCreateModal(true);
  };

  // Open modal pre-filled from a Store Owner Purchase Order
  const handleFulfillPO = (po: any) => {
    setLinkedPoId(po.id);
    setCarrier('FedEx Freight Ghana');
    setTrackingNumber(`TRK-${Math.floor(100000 + Math.random() * 900000)}`);
    setEta(po.expected_date || new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    setShippedDate(new Date().toISOString().slice(0, 10));
    setDestination(po.pickup_address || `Main Store Warehouse Dock (Slot: ${po.dock_slot || 'Bay 1'})`);
    setNotes(`Fulfilling Store Purchase Order #PO-${po.id}. Mode: ${po.fulfillment_mode || 'Supplier Delivery'}`);

    if (po.items && po.items.length > 0) {
      setSelectedItems(
        po.items.map((it: any) => ({
          productId: it.product_id,
          quantity: it.quantity || 1
        }))
      );
    } else {
      setSelectedItems([{ productId: products[0]?.id || 1, quantity: 50 }]);
    }
    setShowCreateModal(true);
  };

  const handleAddItemRow = () => {
    setSelectedItems([...selectedItems, { productId: products[0]?.id || 1, quantity: 20 }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (selectedItems.length > 1) {
      setSelectedItems(selectedItems.filter((_, i) => i !== idx));
    }
  };

  const handleItemChange = (idx: number, field: 'productId' | 'quantity', value: any) => {
    const next = [...selectedItems];
    next[idx] = { ...next[idx], [field]: value };
    setSelectedItems(next);
  };

  const handleSubmitShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carrier.trim() || !trackingNumber.trim() || selectedItems.length === 0) {
      addToast('Carrier, tracking number, and products are required', 'error');
      return;
    }

    // Build payload items
    const payloadItems = selectedItems.map((si) => {
      const p = products.find((prod) => prod.id === Number(si.productId)) || products[0];
      return {
        product_id: p?.id || si.productId,
        product_name: p?.title || 'Restock Item',
        sku: p?.internal_sku || p?.supplier_sku || 'SKU-GEN',
        quantity: Number(si.quantity) || 1,
        unit_cost: p?.unit_cost || 0,
        batch_lot_number: `LOT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
      };
    });

    setIsSubmitting(true);
    try {
      await fetchApi('/supplier/shipments', {
        method: 'POST',
        body: JSON.stringify({
          supplier_name: activeSupplier,
          po_id: linkedPoId,
          carrier: carrier.trim(),
          tracking_number: trackingNumber.trim(),
          eta,
          shipped_date: shippedDate,
          destination: destination.trim(),
          notes: notes.trim(),
          items: payloadItems
        })
      });

      if (linkedPoId) {
        addToast(`PO #PO-${linkedPoId} fulfilled and restock shipment dispatched!`, 'success');
      } else {
        addToast(`Restock shipment logged successfully. Status: In-Transit.`, 'success');
      }

      setShowCreateModal(false);
      setLinkedPoId(null);
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to create shipment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkDelivered = async (s: Shipment) => {
    try {
      await fetchApi(`/supplier/shipments/${s.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'delivered', notes: 'Package arrived at store warehouse.' })
      });
      addToast(`Shipment ${s.shipment_number} marked as Delivered!`, 'success');
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleConfirmVerify = async () => {
    if (!verifyingShipment) return;
    setIsVerifying(true);
    try {
      await fetchApi(`/supplier/shipments/${verifyingShipment.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ verification_notes: verificationNotes })
      });
      addToast(`Shipment ${verifyingShipment.shipment_number} verified! Store inventory automatically restocked.`, 'success');
      setVerifyingShipment(null);
      setVerificationNotes('');
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to verify shipment', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  // Submit PO Acknowledgment
  const handleSubmitAcknowledge = async () => {
    if (!acknowledgingPo) return;
    setIsSubmittingAck(true);
    try {
      if (onAcknowledgePO) {
        await onAcknowledgePO(acknowledgingPo.id, ackNotes);
      } else {
        await fetchApi(`/purchases/${acknowledgingPo.id}/acknowledge`, {
          method: 'POST',
          body: JSON.stringify({ notes: ackNotes, promised_date: ackPromisedDate })
        });
        addToast(`PO #PO-${acknowledgingPo.id} acknowledged and confirmed!`, 'success');
        onRefresh();
      }
      setAcknowledgingPo(null);
    } catch (err: any) {
      addToast(err.message || 'Failed to acknowledge PO', 'error');
    } finally {
      setIsSubmittingAck(false);
    }
  };

  // Filtered lists
  const filteredShipments = shipments.filter((s) => {
    const matchesSearch =
      (s.shipment_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.tracking_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.carrier || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = shipmentStatusFilter === 'all' || s.status === shipmentStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPurchases = purchases.filter((po) => {
    const matchesSearch =
      `#PO-${po.id}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (po.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (po.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (po.items || []).some((it: any) => (it.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      poStatusFilter === 'all' ||
      po.status === poStatusFilter ||
      (poStatusFilter === 'pending' && (po.status === 'pending' || po.status === 'pending_confirmation' || po.status === 'draft'));

    return matchesSearch && matchesStatus;
  });

  const getShipmentStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
            <ShieldCheck size={12} /> Verified by Admin
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-300">
            <CheckCircle2 size={12} /> Delivered
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-300">
            <Truck size={12} /> In-Transit
          </span>
        );
      case 'preparing':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-300">
            <Clock size={12} /> Preparing
          </span>
        );
    }
  };

  const getPoStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 size={12} /> Received & Stocked
          </span>
        );
      case 'in-transit':
      case 'dispatched':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-300">
            <Truck size={12} /> Dispatched & In-Transit
          </span>
        );
      case 'ordered':
      case 'acknowledged':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-300">
            <Check size={12} /> Order Acknowledged
          </span>
        );
      case 'pending':
      case 'pending_confirmation':
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
            <Clock size={12} /> Pending Confirmation
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-view Segmented Switcher & Top Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Truck className="text-blue-600" size={18} />
            Orders & Shipments Management
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Review Store Owner purchase orders, acknowledge fulfillment SLAs, and dispatch restock shipments with carrier tracking.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sub-view Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveSubView('orders')}
              className={`px-3 py-1.5 rounded-md text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubView === 'orders'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck size={14} />
              <span>Incoming Store Orders (POs)</span>
              {pendingOrders.length > 0 ? (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-500 text-white animate-pulse">
                  {pendingOrders.length} New
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                  {purchases.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSubView('shipments')}
              className={`px-3 py-1.5 rounded-md text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubView === 'shipments'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck size={14} />
              <span>Dispatched Shipments</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                {shipments.length}
              </span>
            </button>
          </div>

          {/* Context-bound Create Restock Shipment Button */}
          <button
            type="button"
            onClick={handleOpenCreateGeneric}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
          >
            <Plus size={15} /> Create Restock Shipment
          </button>
        </div>
      </div>

      {/* VIEW 1: STORE OWNER INCOMING PURCHASE ORDERS (POs) */}
      {activeSubView === 'orders' && (
        <div className="space-y-4">
          {/* Informational Banner */}
          <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-blue-900">
              <FileCheck size={18} className="text-blue-600 shrink-0" />
              <div>
                <strong className="font-black">Store Owner Purchase Order Stream:</strong> When a Store Owner places a restock order, it appears here in real-time. Review line items, click <strong>"Acknowledge"</strong> to confirm SLA, and click <strong>"Fulfill & Create Shipment"</strong> to dispatch with tracking.
              </div>
            </div>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded shrink-0">
              {purchases.length} Total Store POs
            </span>
          </div>

          {/* Search & Status Filters for POs */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search PO #, ordered product name, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-slate-50/50"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase shrink-0">Filter:</span>
              {[
                { id: 'all', label: 'All Orders' },
                { id: 'pending', label: 'Pending Confirmation' },
                { id: 'acknowledged', label: 'Acknowledged' },
                { id: 'in-transit', label: 'In-Transit' },
                { id: 'received', label: 'Received' }
              ].map((flt) => (
                <button
                  key={flt.id}
                  type="button"
                  onClick={() => setPoStatusFilter(flt.id)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    poStatusFilter === flt.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {flt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Purchase Orders Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black tracking-wider text-[10px]">
                    <th className="py-3 px-4">PO # & Issued Date</th>
                    <th className="py-3 px-4">Delivery SLA & Dock</th>
                    <th className="py-3 px-4">Line Items Ordered</th>
                    <th className="py-3 px-4">Order Total (GHS)</th>
                    <th className="py-3 px-4">Order Status</th>
                    <th className="py-3 px-4 text-right">Supplier Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <FileCheck size={32} className="mx-auto mb-2 opacity-30 text-blue-500" />
                        <p className="font-bold text-slate-600">No Purchase Orders Found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          When a Store Owner creates a Purchase Order for {activeSupplier}, it will automatically show here for acknowledgment and fulfillment.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((po) => {
                      const isExpanded = expandedPoId === po.id;
                      const isPending = po.status === 'pending' || po.status === 'pending_confirmation' || po.status === 'draft';
                      const canFulfill = isPending || po.status === 'ordered' || po.status === 'acknowledged';

                      return (
                        <React.Fragment key={po.id}>
                          <tr className="hover:bg-slate-50/70 transition-colors">
                            {/* PO # & Issued Date */}
                            <td className="py-3.5 px-4">
                              <div className="font-black text-slate-900 flex items-center gap-1.5">
                                <span className="text-blue-600">#PO-{po.id}</span>
                                {isPending && (
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Needs Action" />
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <Calendar size={11} />
                                <span>{new Date(po.created_at).toLocaleDateString()}</span>
                              </div>
                              {po.user_name && (
                                <div className="text-[10px] text-slate-500 font-medium">
                                  Issuer: {po.user_name}
                                </div>
                              )}
                            </td>

                            {/* Delivery SLA & Logistics */}
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-800">
                                {po.expected_date ? (
                                  <span className="text-indigo-700">Req: {new Date(po.expected_date).toLocaleDateString()}</span>
                                ) : (
                                  <span className="text-slate-500">Standard 3-Day SLA</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin size={11} className="text-slate-400" />
                                <span>{po.dock_slot || 'Bay 1 (Warehouse)'}</span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Mode: <strong className="text-slate-600">{po.fulfillment_mode === 'store_pickup' ? 'Store Pickup' : 'Supplier Delivery'}</strong>
                              </div>
                            </td>

                            {/* Line Items Count */}
                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                              >
                                <span>{po.item_count || po.items?.length || 1} Products</span>
                                <ChevronDown size={14} className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                              </button>
                              <div className="text-[10px] text-slate-400 font-medium">
                                {po.total_units || po.items?.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0) || 0} Total Units
                              </div>
                            </td>

                            {/* Order Total */}
                            <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                              {formatGHS(po.total_amount || 0)}
                            </td>

                            {/* Order Status */}
                            <td className="py-3.5 px-4">
                              {getPoStatusBadge(po.status)}
                              {po.tracking_number && (
                                <div className="text-[10px] text-blue-600 font-mono mt-0.5 flex items-center gap-1">
                                  <Truck size={10} /> {po.carrier}: {po.tracking_number}
                                </div>
                              )}
                            </td>

                            {/* Actions for Supplier */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {/* Acknowledge PO Button */}
                                {isPending && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAcknowledgingPo(po);
                                      setAckNotes(`PO #${po.id} order confirmed for fulfillment.`);
                                    }}
                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[11px] font-black transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                    title="Acknowledge acceptance of this Purchase Order"
                                  >
                                    <Check size={12} /> Acknowledge
                                  </button>
                                )}

                                {/* Fulfill & Ship Button */}
                                {canFulfill && (
                                  <button
                                    type="button"
                                    onClick={() => handleFulfillPO(po)}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded text-[11px] font-black transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                    title="Pre-populate restock shipment from this PO"
                                  >
                                    <Truck size={12} /> Fulfill & Ship
                                  </button>
                                )}

                                {/* Attach Invoice Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onAttachInvoiceForPO) {
                                      onAttachInvoiceForPO(po);
                                    } else {
                                      addToast(`Navigate to Invoices tab to bill PO #${po.id}`, 'info');
                                    }
                                  }}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="Create or attach invoice for this order"
                                >
                                  <CreditCard size={12} /> Invoice
                                </button>

                                {/* Print Packing Slip Button */}
                                <button
                                  type="button"
                                  onClick={() => setPackingSlipPo(po)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="Print Packing Slip and Dispatch Manifest"
                                >
                                  <Printer size={12} /> Slip
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded PO Line Items Drawer */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={6} className="p-4 pl-8">
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                      <Boxes size={15} className="text-blue-600" />
                                      Line Items Requested in Purchase Order #PO-{po.id}
                                    </h4>
                                    <span className="text-[11px] text-slate-500 font-bold">
                                      Expected Dock SLA: {po.dock_time_window || '10:00 AM - 12:00 PM'}
                                    </span>
                                  </div>

                                  {po.notes && (
                                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                                      <strong>Store Owner Instructions:</strong> {po.notes}
                                    </div>
                                  )}

                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase">
                                        <th className="py-2 px-3">Product Name</th>
                                        <th className="py-2 px-3">SKU</th>
                                        <th className="py-2 px-3">Category</th>
                                        <th className="py-2 px-3 text-right">Ordered Qty</th>
                                        <th className="py-2 px-3 text-right">Agreed Unit Cost</th>
                                        <th className="py-2 px-3 text-right">Line Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {(po.items && po.items.length > 0) ? (
                                        po.items.map((it: any, idx: number) => (
                                          <tr key={idx} className="hover:bg-slate-50">
                                            <td className="py-2 px-3 font-bold text-slate-800">
                                              {it.product_name}
                                            </td>
                                            <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                                              {it.sku}
                                            </td>
                                            <td className="py-2 px-3 text-slate-500">
                                              {it.category || 'General'}
                                            </td>
                                            <td className="py-2 px-3 text-right font-black text-slate-900">
                                              {it.quantity} units
                                            </td>
                                            <td className="py-2 px-3 text-right text-slate-600">
                                              {formatGHS(it.unit_price)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                                              {formatGHS((it.quantity || 0) * (it.unit_price || 0))}
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan={6} className="py-3 px-3 text-slate-400 italic">
                                            No explicit item breakdown provided. Total value: {formatGHS(po.total_amount)}
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>

                                  {/* Acknowledgment audit notes if present */}
                                  {po.acknowledged_at && (
                                    <div className="text-[11px] text-emerald-800 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200 flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 font-medium">
                                        <CheckCircle2 size={13} className="text-emerald-600" />
                                        <span>Acknowledged on {new Date(po.acknowledged_at).toLocaleString()}: "{po.acknowledgment_notes || 'Confirmed'}"</span>
                                      </div>
                                      <span className="font-bold">Promised SLA: {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : 'Confirmed'}</span>
                                    </div>
                                  )}
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
        </div>
      )}

      {/* VIEW 2: DISPATCHED RESTOCK SHIPMENTS */}
      {activeSubView === 'shipments' && (
        <div className="space-y-4">
          {/* Filter and Search Bar for Shipments */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search by shipment #, tracking number, carrier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-slate-50/50"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase shrink-0">Filter:</span>
              {(['all', 'in_transit', 'delivered', 'verified', 'preparing'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setShipmentStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    shipmentStatusFilter === st
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all' ? 'All Shipments' : st.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Shipments Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black tracking-wider text-[10px]">
                    <th className="py-3 px-4">Shipment # & Origin</th>
                    <th className="py-3 px-4">Logistics / Tracking</th>
                    <th className="py-3 px-4">Consignment Items</th>
                    <th className="py-3 px-4">Total Units & Value</th>
                    <th className="py-3 px-4">Status & Sync</th>
                    <th className="py-3 px-4">Invoice Attachment</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredShipments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Truck size={28} className="mx-auto mb-2 opacity-30" />
                        No shipments found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredShipments.map((s) => {
                      const isExpanded = expandedShipmentId === s.id;
                      const canAttachInvoice = s.status === 'delivered' || s.status === 'verified';

                      return (
                        <React.Fragment key={s.id}>
                          <tr className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{s.shipment_number}</span>
                                {s.po_id && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                                    PO #{s.po_id}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Shipped: {new Date(s.shipped_date).toLocaleDateString()}
                              </div>
                              <div className="text-[10px] text-indigo-600 font-medium">
                                ETA: {new Date(s.eta).toLocaleDateString()}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800">{s.carrier}</div>
                              <div className="font-mono text-[11px] text-blue-600 flex items-center gap-1 mt-0.5">
                                <span>{s.tracking_number}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                <MapPin size={10} /> {s.destination || 'Main Store Dock'}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => setExpandedShipmentId(isExpanded ? null : s.id)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                              >
                                <span>{s.item_count || s.items?.length || 1} Products</span>
                                <ChevronDown size={14} className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                              </button>
                              <div className="text-[10px] text-slate-400">
                                {s.total_units || s.items?.reduce((sum, it) => sum + (it.quantity || 0), 0) || 0} Total Units
                              </div>
                            </td>

                            <td className="py-3 px-4 font-bold text-slate-900">
                              {formatGHS(s.total_value || 0)}
                            </td>

                            <td className="py-3 px-4">
                              {getShipmentStatusBadge(s.status)}
                              {s.verified_by && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  By: {s.verified_by}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {s.invoice_attached ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <FileCheck size={12} /> {s.invoice_number || 'Attached'}
                                </span>
                              ) : canAttachInvoice ? (
                                <button
                                  type="button"
                                  onClick={() => onAttachInvoice && onAttachInvoice(s)}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <CreditCard size={12} /> Attach Invoice
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                  Available after delivery
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isAdmin && s.status !== 'verified' && (
                                  <button
                                    type="button"
                                    onClick={() => setVerifyingShipment(s)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                    title="Verify shipment and auto-restock inventory"
                                  >
                                    <ShieldCheck size={12} /> Verify & Stock
                                  </button>
                                )}

                                {!isAdmin && s.status === 'in_transit' && (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkDelivered(s)}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-bold transition-colors cursor-pointer"
                                  >
                                    Mark Delivered
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Line Items Detail Accordion */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={7} className="p-3 pl-8">
                                <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs">
                                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                                    Manifest Line Items for Shipment #{s.shipment_number}
                                  </h4>
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase">
                                        <th className="py-1.5 px-3">Product Name</th>
                                        <th className="py-1.5 px-3">SKU</th>
                                        <th className="py-1.5 px-3 text-right">Quantity</th>
                                        <th className="py-1.5 px-3 text-right">Unit Cost</th>
                                        <th className="py-1.5 px-3 text-right">Subtotal</th>
                                        <th className="py-1.5 px-3">Batch / Lot #</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {(s.items && s.items.length > 0) ? (
                                        s.items.map((it: any, idx: number) => (
                                          <tr key={idx}>
                                            <td className="py-1.5 px-3 font-medium text-slate-800">
                                              {it.product_name}
                                            </td>
                                            <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px]">
                                              {it.sku}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                                              {it.quantity}
                                            </td>
                                            <td className="py-1.5 px-3 text-right text-slate-600">
                                              {formatGHS(it.unit_cost)}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                                              {formatGHS((it.quantity || 0) * (it.unit_cost || 0))}
                                            </td>
                                            <td className="py-1.5 px-3 font-mono text-[10px] text-slate-400">
                                              {it.batch_lot_number || 'N/A'}
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan={6} className="py-2 px-3 text-slate-400 italic">
                                            No item details available.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
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
        </div>
      )}

      {/* MODAL 1: CREATE RESTOCK SHIPMENT (Support Generic or PO-Linked) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <Truck className="text-blue-600" size={18} />
                  {linkedPoId ? `Fulfill Store Order #PO-${linkedPoId}` : 'Create Restock Shipment & Dispatch'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {linkedPoId
                    ? `Dispatch restock shipment tied to Store PO #${linkedPoId}. Updates order to In-Transit automatically.`
                    : 'Dispatch restock inventory consignment to the Store Owner.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setLinkedPoId(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitShipment} className="p-5 overflow-y-auto space-y-4 flex-1">
              {linkedPoId && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 font-medium">
                  <div className="flex items-center gap-2">
                    <FileCheck size={16} className="text-blue-600" />
                    <span>Fulfilling Purchase Order <strong>#PO-{linkedPoId}</strong> for <strong>{activeSupplier}</strong></span>
                  </div>
                  <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Store Sync Active</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Logistics Carrier <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="e.g. FedEx Freight, DHL Express, Direct Fleet"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tracking Number / Waybill ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. TRK-9821734"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dispatch Date
                  </label>
                  <input
                    type="date"
                    value={shippedDate}
                    onChange={(e) => setShippedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estimated Delivery Date (ETA)
                  </label>
                  <input
                    type="date"
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destination Warehouse / Dock
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Central Store Warehouse, Bay 2"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Items in Consignment */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Consignment Manifest Items <span className="text-rose-500">*</span>
                  </label>
                  {!linkedPoId && (
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} /> Add Another Product
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex-1">
                        <select
                          value={item.productId}
                          onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 bg-white"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title || p.name} ({p.supplier_sku || p.sku}) - {formatGHS(p.unit_cost)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 bg-white text-right font-bold"
                          placeholder="Quantity"
                        />
                      </div>

                      {!linkedPoId && selectedItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Consignment Dispatch Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special storage handling, driver vehicle details, temp requirements..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setLinkedPoId(null);
                  }}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Dispatching Shipment...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>{linkedPoId ? 'Fulfill & Dispatch Restock Shipment' : 'Dispatch Restock Shipment'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ACKNOWLEDGE PURCHASE ORDER */}
      {acknowledgingPo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50 rounded-t-2xl">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="text-amber-600" size={18} />
                  Acknowledge Order Acceptance (#PO-{acknowledgingPo.id})
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  Confirm to the Store Owner that order terms and delivery SLAs are accepted.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAcknowledgingPo(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>Order Value:</span>
                  <strong className="font-black text-slate-900">{formatGHS(acknowledgingPo.total_amount)}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Requested Items:</span>
                  <strong className="font-black text-slate-900">{acknowledgingPo.items?.length || 1} line item(s)</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Requested Delivery:</span>
                  <strong className="font-black text-indigo-700">{acknowledgingPo.expected_date || 'Standard SLA'}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Promised Delivery Date (SLA)
                </label>
                <input
                  type="date"
                  value={ackPromisedDate}
                  onChange={(e) => setAckPromisedDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supplier Confirmation Notes / SLA Commitment
                </label>
                <textarea
                  rows={3}
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  placeholder="e.g. Order accepted and allocated at factory. Expected fulfillment within 48h."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAcknowledgingPo(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAcknowledge}
                  disabled={isSubmittingAck}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingAck ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirm & Acknowledge PO</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PRINT PACKING SLIP & DISPATCH MANIFEST */}
      {packingSlipPo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <Printer className="text-blue-600" size={18} />
                  Store Order Packing Slip & Manifest (#PO-{packingSlipPo.id})
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Official dispatch manifest for warehouse packaging and driver handover.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPackingSlipPo(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800" id="printable-packing-slip">
              {/* Slip Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <span className="text-xs uppercase font-black text-blue-600 tracking-wider">SUPPLIER DISPATCH MANIFEST</span>
                  <h2 className="text-xl font-black text-slate-900 mt-1">{activeSupplier}</h2>
                  <p className="text-xs text-slate-500">Corporate Key Accounts Logistics Division</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-mono font-black text-slate-900">#PO-{packingSlipPo.id}</div>
                  <div className="text-xs text-slate-400">Date: {new Date(packingSlipPo.created_at).toLocaleDateString()}</div>
                  <div className="font-mono text-[10px] text-slate-400 tracking-widest mt-1">||||| | |||| |||| || |||</div>
                </div>
              </div>

              {/* Delivery To / Dock Details */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <strong className="block text-slate-500 text-[10px] uppercase font-bold">Consignee (Delivery To):</strong>
                  <div className="font-black text-slate-900 mt-0.5">Central Store Warehouse</div>
                  <div className="text-slate-600">{packingSlipPo.pickup_address || 'Main Commercial Street Dock'}</div>
                  <div className="text-slate-500">Slot: {packingSlipPo.dock_slot || 'Bay 1 (Standard)'}</div>
                </div>
                <div>
                  <strong className="block text-slate-500 text-[10px] uppercase font-bold">Fulfillment Info:</strong>
                  <div className="text-slate-700 mt-0.5">Mode: <strong className="text-slate-900">{packingSlipPo.fulfillment_mode || 'Supplier Delivery'}</strong></div>
                  <div className="text-slate-700">Expected SLA: <strong className="text-indigo-700">{packingSlipPo.expected_date || 'Standard'}</strong></div>
                  <div className="text-slate-700">Dock Window: <strong className="text-slate-900">{packingSlipPo.dock_time_window || '10:00 AM - 12:00 PM'}</strong></div>
                </div>
              </div>

              {/* Manifest Items Table */}
              <div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                      <th className="py-2 px-3">Item Description</th>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3 text-right">Qty Packed</th>
                      <th className="py-2 px-3 text-right">Unit Price</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(packingSlipPo.items || []).map((it: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2 px-3 font-bold text-slate-900">{it.product_name}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{it.sku}</td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">{it.quantity}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{formatGHS(it.unit_price)}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{formatGHS((it.quantity || 0) * (it.unit_price || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-900 font-black">
                      <td colSpan={2} className="py-2.5 px-3 uppercase text-[11px]">Total Consignment Value</td>
                      <td className="py-2.5 px-3 text-right">{packingSlipPo.total_units || packingSlipPo.items?.reduce((s: number, it: any) => s + (it.quantity || 0), 0) || 0}</td>
                      <td />
                      <td className="py-2.5 px-3 text-right text-sm text-blue-700">{formatGHS(packingSlipPo.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Warehouse Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
                <div>
                  <div className="border-b border-slate-400 pb-8 text-slate-400">Warehouse Dispatcher Signature</div>
                  <div className="text-[10px] text-slate-500 mt-1">Authorized Dispatch Officer: {user?.name}</div>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-8 text-slate-400">Store Receiving Agent Signature</div>
                  <div className="text-[10px] text-slate-500 mt-1">Goods Verified & Stocked By Store</div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setPackingSlipPo(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-white text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer size={14} /> Print Manifest Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: VERIFY SHIPMENT MODAL (ADMIN ONLY) */}
      {verifyingShipment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50 rounded-t-2xl">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="text-emerald-600" size={18} />
                  Store Receiving: Verify & Restock
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  {verifyingShipment.shipment_number} ({verifyingShipment.total_units || 0} Units)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVerifyingShipment(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-medium leading-relaxed">
                Confirming receipt automatically updates the Store inventory levels, records this restock into inventory audits, and marks the shipment as Verified.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Receiving Inspection Notes
                </label>
                <textarea
                  rows={3}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="e.g. All cartons inspected. Sealed in factory packaging. No damages found."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyingShipment(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmVerify}
                  disabled={isVerifying}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isVerifying ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying & Stocking...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirm Verified & Restock</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
