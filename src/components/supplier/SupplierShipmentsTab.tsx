import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatGHS } from '../../lib/formatters';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { fetchApi } from '../../lib/api';
import type { Shipment, SupplierProduct } from '../../types/supplier';
import ShipmentProgressStepper from './ShipmentProgressStepper';
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
  XCircle,
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  Send,
  Eye,
  Store,
  User,
  UserCheck,
  Filter,
  RotateCcw,
  Sparkles,
  Info
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

  // Sub-view: "orders" (Store Owner POs) vs "shipments" (Dispatched Logistics)
  const [activeSubView, setActiveSubView] = useState<'orders' | 'shipments'>('orders');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [dateRangePreset, setDateRangePreset] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Status Filters
  const [poStatusFilter, setPoStatusFilter] = useState<string>('all');
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState<'all' | 'preparing' | 'in_transit' | 'delivered' | 'verified'>('all');

  // Bulk Selection & Floating Toolbar State
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<Set<number>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState<'packaging' | 'in_transit' | null>(null);
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkCarrier, setBulkCarrier] = useState('FedEx Freight Ghana');
  const [bulkTrackingPrefix, setBulkTrackingPrefix] = useState('GH-LOG-');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // Read-only Timeline expansion per shipment
  const [expandedTimelineId, setExpandedTimelineId] = useState<number | null>(null);

  // Expanded Cards / Rows
  const [expandedShipmentId, setExpandedShipmentId] = useState<number | null>(null);
  const [expandedPoId, setExpandedPoId] = useState<number | null>(null);

  // Auto-expand and focus when directed via deep link or notification (e.g. ?po_id=12 or ?shipment_id=5)
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const poParam = searchParams.get('po_id');
    const shipmentParam = searchParams.get('shipment_id');
    if (poParam) {
      const parsedPo = parseInt(poParam, 10);
      if (!isNaN(parsedPo)) {
        setActiveSubView('orders');
        setExpandedPoId(parsedPo);
        setTimeout(() => {
          const el = document.getElementById(`po-row-${parsedPo}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 350);
      }
    } else if (shipmentParam) {
      const parsedShip = parseInt(shipmentParam, 10);
      if (!isNaN(parsedShip)) {
        setActiveSubView('shipments');
        setExpandedShipmentId(parsedShip);
        setExpandedTimelineId(parsedShip);
        setTimeout(() => {
          const el = document.getElementById(`shipment-row-${parsedShip}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 350);
      }
    }
  }, [searchParams]);

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [verifyingShipment, setVerifyingShipment] = useState<Shipment | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // PO Decision Modals: Accept vs Reject
  const [acceptingPo, setAcceptingPo] = useState<any | null>(null);
  const [acceptPromisedDate, setAcceptPromisedDate] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  );
  const [acceptNotes, setAcceptNotes] = useState('Order accepted. Preparation & packaging started.');
  const [isSubmittingAccept, setIsSubmittingAccept] = useState(false);

  const [rejectingPo, setRejectingPo] = useState<any | null>(null);
  const [rejectReasonCategory, setRejectReasonCategory] = useState('Out of Stock / Production Halted');
  const [rejectNotes, setRejectNotes] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Packing Slip Modal
  const [packingSlipPo, setPackingSlipPo] = useState<any | null>(null);

  // Create Shipment Form State (Support generic restock or linking directly to a Store PO)
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
  const [isSubmittingShipment, setIsSubmittingShipment] = useState(false);

  // Extract distinct store names for filter dropdown
  const storeNamesList = useMemo(() => {
    const names = new Set<string>();
    purchases.forEach((p) => {
      if (p.store_name) names.add(p.store_name);
    });
    shipments.forEach((s: any) => {
      if (s.store_name) names.add(s.store_name);
    });
    if (names.size === 0) names.add("Ummi's Lane Enterprise");
    return Array.from(names);
  }, [purchases, shipments]);

  // Dynamic Metrics for Lifecycle Bar
  const pendingOrders = purchases.filter(
    (p) => p.status === 'pending' || p.status === 'pending_confirmation' || p.status === 'draft'
  );
  const confirmedOrders = purchases.filter(
    (p) => p.status === 'confirmed' || p.status === 'acknowledged' || p.status === 'ordered'
  );
  const inTransitCount = shipments.filter(
    (s) => s.status === 'in_transit' || s.status === 'preparing'
  ).length;
  const verifiedCount = shipments.filter((s) => s.status === 'verified').length;

  // Generic Create Shipment
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

  // Pre-fill Create Shipment directly from a Store PO
  const handleFulfillPO = (po: any) => {
    setLinkedPoId(po.id);
    setCarrier('FedEx Freight Ghana');
    setTrackingNumber(`TRK-${Math.floor(100000 + Math.random() * 900000)}`);
    setEta(po.expected_date || new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    setShippedDate(new Date().toISOString().slice(0, 10));
    setDestination(
      po.pickup_address || `${po.store_name || "Main Store Warehouse"} Dock (${po.dock_slot || 'Bay 1'})`
    );
    setNotes(
      `Fulfilling Store Purchase Order #PO-${po.id} from ${po.store_name || "Store Owner"}. Mode: ${
        po.fulfillment_mode || 'Supplier Delivery'
      }`
    );

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
    if (products.length === 0) return;
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

  // Dispatch Restock Shipment
  const handleSubmitShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carrier.trim() || !trackingNumber.trim() || selectedItems.length === 0) {
      addToast('Carrier, tracking number, and products are required', 'error');
      return;
    }

    const payloadItems = selectedItems.map((si) => {
      const p = products.find((prod) => prod.id === Number(si.productId)) || products[0];
      return {
        product_id: p?.id || si.productId,
        product_name: p?.title || p?.name || 'Restock Item',
        sku: p?.internal_sku || p?.supplier_sku || p?.sku || 'SKU-GEN',
        quantity: Number(si.quantity) || 1,
        unit_cost: p?.unit_cost || 0,
        batch_lot_number: `LOT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
      };
    });

    setIsSubmittingShipment(true);
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
        addToast(
          `Shipment dispatched for Store PO #PO-${linkedPoId}! Status moved to In-Transit with live tracking.`,
          'success'
        );
      } else {
        addToast(`Restock shipment logged successfully. Status: In-Transit.`, 'success');
      }

      setShowCreateModal(false);
      setLinkedPoId(null);
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to dispatch shipment', 'error');
    } finally {
      setIsSubmittingShipment(false);
    }
  };

  // Handle Accept PO Decision
  const handleConfirmAcceptPO = async () => {
    if (!acceptingPo) return;
    setIsSubmittingAccept(true);
    try {
      await fetchApi(`/purchases/${acceptingPo.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'accept',
          reason: acceptNotes,
          estimated_completion_date: acceptPromisedDate
        })
      });

      addToast(
        `PO #PO-${acceptingPo.id} Accepted! Store Owner (${acceptingPo.store_name || 'Store'}) has been notified.`,
        'success'
      );
      setAcceptingPo(null);
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to accept PO', 'error');
    } finally {
      setIsSubmittingAccept(false);
    }
  };

  // Handle Reject PO Decision
  const handleConfirmRejectPO = async () => {
    if (!rejectingPo) return;
    const fullReason = rejectNotes.trim()
      ? `${rejectReasonCategory}: ${rejectNotes.trim()}`
      : rejectReasonCategory;

    setIsSubmittingReject(true);
    try {
      await fetchApi(`/purchases/${rejectingPo.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'reject',
          reason: fullReason
        })
      });

      addToast(
        `PO #PO-${rejectingPo.id} Declined. Store Owner has been notified with your reason.`,
        'info'
      );
      setRejectingPo(null);
      setRejectNotes('');
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to decline PO', 'error');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Mark Delivered
  const handleMarkDelivered = async (s: Shipment) => {
    try {
      await fetchApi(`/supplier/shipments/${s.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'delivered', notes: 'Consignment arrived at store receiving dock.' })
      });
      addToast(`Shipment ${s.shipment_number} marked as Delivered!`, 'success');
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to update delivery status', 'error');
    }
  };

  // Admin Verification & Stock Increase
  const handleConfirmVerify = async () => {
    if (!verifyingShipment) return;
    setIsVerifying(true);
    try {
      await fetchApi(`/supplier/shipments/${verifyingShipment.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ verification_notes: verificationNotes })
      });
      addToast(
        `Shipment ${verifyingShipment.shipment_number} verified! Store inventory automatically restocked.`,
        'success'
      );
      setVerifyingShipment(null);
      setVerificationNotes('');
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to verify shipment', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  // Date Filter Helpers
  const isDateInRange = (dateStr?: string) => {
    if (!dateStr || dateRangePreset === 'all') return true;
    const target = new Date(dateStr).getTime();
    const now = Date.now();
    if (isNaN(target)) return true;

    if (dateRangePreset === 'today') {
      const today = new Date().toDateString();
      return new Date(dateStr).toDateString() === today;
    }
    if (dateRangePreset === '7days') {
      return target >= now - 7 * 86400000;
    }
    if (dateRangePreset === '30days') {
      return target >= now - 30 * 86400000;
    }
    if (dateRangePreset === 'custom') {
      const start = customStartDate ? new Date(customStartDate).getTime() : 0;
      const end = customEndDate ? new Date(customEndDate).getTime() + 86400000 : Infinity;
      return target >= start && target <= end;
    }
    return true;
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStoreFilter('all');
    setDateRangePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setPoStatusFilter('all');
    setShipmentStatusFilter('all');
  };

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter((po) => {
      // 1. Text Search: matches PO #, store name, manager name, notes, product names
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        `#PO-${po.id}`.toLowerCase().includes(q) ||
        (po.store_name || '').toLowerCase().includes(q) ||
        (po.manager_name || po.user_name || '').toLowerCase().includes(q) ||
        (po.notes || '').toLowerCase().includes(q) ||
        (po.items || []).some(
          (it: any) =>
            (it.product_name || '').toLowerCase().includes(q) ||
            (it.sku || '').toLowerCase().includes(q)
        );

      // 2. Store Name Filter
      const matchesStore =
        selectedStoreFilter === 'all' ||
        (po.store_name || "Ummi's Lane Enterprise").toLowerCase() ===
          selectedStoreFilter.toLowerCase();

      // 3. Date Range Filter
      const matchesDate = isDateInRange(po.created_at || po.expected_date);

      // 4. Status Filter
      let matchesStatus = true;
      if (poStatusFilter === 'pending') {
        matchesStatus =
          po.status === 'pending' || po.status === 'pending_confirmation' || po.status === 'draft';
      } else if (poStatusFilter === 'confirmed') {
        matchesStatus =
          po.status === 'confirmed' || po.status === 'acknowledged' || po.status === 'ordered';
      } else if (poStatusFilter === 'in_transit') {
        matchesStatus = po.status === 'in-transit' || po.status === 'dispatched';
      } else if (poStatusFilter === 'delivered') {
        matchesStatus = po.status === 'received' || po.status === 'verified';
      } else if (poStatusFilter === 'rejected') {
        matchesStatus = po.status === 'cancelled' || po.status === 'rejected';
      } else if (poStatusFilter !== 'all') {
        matchesStatus = po.status === poStatusFilter;
      }

      return matchesSearch && matchesStore && matchesDate && matchesStatus;
    });
  }, [purchases, searchQuery, selectedStoreFilter, dateRangePreset, customStartDate, customEndDate, poStatusFilter]);

  // Filtered Shipments
  const filteredShipments = useMemo(() => {
    return shipments.filter((s: any) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (s.shipment_number || '').toLowerCase().includes(q) ||
        (s.tracking_number || '').toLowerCase().includes(q) ||
        (s.carrier || '').toLowerCase().includes(q) ||
        (s.store_name || '').toLowerCase().includes(q) ||
        (s.manager_name || '').toLowerCase().includes(q) ||
        (s.destination || '').toLowerCase().includes(q) ||
        `#PO-${s.po_id}`.toLowerCase().includes(q) ||
        (s.items || []).some(
          (it: any) =>
            (it.product_name || '').toLowerCase().includes(q) ||
            (it.sku || '').toLowerCase().includes(q)
        );

      const matchesStore =
        selectedStoreFilter === 'all' ||
        (s.store_name || "Ummi's Lane Enterprise").toLowerCase() ===
          selectedStoreFilter.toLowerCase();

      const matchesDate = isDateInRange(s.shipped_date || s.created_at || s.eta);

      const matchesStatus =
        shipmentStatusFilter === 'all' || s.status === shipmentStatusFilter;

      return matchesSearch && matchesStore && matchesDate && matchesStatus;
    });
  }, [shipments, searchQuery, selectedStoreFilter, dateRangePreset, customStartDate, customEndDate, shipmentStatusFilter]);

  // Bulk Selection Helpers & Calculations
  const isAllSelected = filteredShipments.length > 0 && filteredShipments.every((s: any) => selectedShipmentIds.has(s.id));
  const isSomeSelected = filteredShipments.some((s: any) => selectedShipmentIds.has(s.id));

  const toggleSelectShipment = (id: number) => {
    setSelectedShipmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllShipments = () => {
    if (isAllSelected) {
      setSelectedShipmentIds(new Set());
    } else {
      setSelectedShipmentIds(new Set(filteredShipments.map((s: any) => s.id)));
    }
  };

  const clearShipmentSelection = () => {
    setSelectedShipmentIds(new Set());
  };

  const openBulkModal = (stage: 'packaging' | 'in_transit') => {
    setShowBulkModal(stage);
    if (stage === 'packaging') {
      setBulkNotes('Bulk status update: Goods packaged, boxed, and palletized at supplier dock.');
    } else {
      setBulkNotes('Bulk status update: Dispatched in-transit with freight logistics carrier.');
    }
  };

  const handleExecuteBulkUpdate = async (stage: 'packaging' | 'in_transit') => {
    if (selectedShipmentIds.size === 0) return;
    setIsSubmittingBulk(true);
    try {
      const ids = Array.from(selectedShipmentIds);
      await fetchApi('/supplier/shipments/bulk-status', {
        method: 'PUT',
        body: JSON.stringify({
          ids,
          stage,
          notes: bulkNotes.trim(),
          carrier: stage === 'in_transit' ? bulkCarrier.trim() : undefined,
          tracking_number: stage === 'in_transit' ? `${bulkTrackingPrefix}${Math.floor(1000 + Math.random() * 9000)}` : undefined
        })
      });

      const label = stage === 'packaging' ? 'Packaging' : 'In Transit';
      addToast(`Successfully updated ${ids.length} shipments to '${label}' simultaneously!`, 'success');
      setShowBulkModal(null);
      setSelectedShipmentIds(new Set());
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to bulk update shipments', 'error');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Read-Only Timeline Renderer for Shipment Milestones
  const renderShipmentTimeline = (history?: any[], shipmentNumber?: string) => {
    const list = Array.isArray(history) && history.length > 0 ? history : [];

    if (list.length === 0) {
      return (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
          No status milestone entries recorded yet.
        </div>
      );
    }

    const getStageMeta = (stage: string) => {
      const st = (stage || '').toLowerCase().replace('-', '_');
      switch (st) {
        case 'verified':
          return {
            title: 'Verified & Stocked',
            badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
            dotClass: 'bg-emerald-600 text-white',
            icon: ShieldCheck
          };
        case 'delivered':
          return {
            title: 'Delivered at Dock',
            badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
            dotClass: 'bg-blue-600 text-white',
            icon: CheckCircle2
          };
        case 'in_transit':
          return {
            title: 'In-Transit / Dispatched',
            badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
            dotClass: 'bg-indigo-600 text-white',
            icon: Truck
          };
        case 'packaging':
          return {
            title: 'Packaging & Preparation',
            badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
            dotClass: 'bg-amber-500 text-white',
            icon: Package
          };
        case 'order_confirmed':
        default:
          return {
            title: 'Order Confirmed',
            badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
            dotClass: 'bg-slate-700 text-white',
            icon: FileCheck
          };
      }
    };

    return (
      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-blue-100 text-blue-800">
              <Clock size={13} />
            </span>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Status Milestone Timeline ({list.length} Records)
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 font-bold">
            Consignment #{shipmentNumber}
          </span>
        </div>

        <div className="relative pl-6 space-y-3.5 pt-1 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {list.map((evt, idx) => {
            const meta = getStageMeta(evt.stage);
            const IconComponent = meta.icon;
            const dateStr = evt.timestamp
              ? new Date(evt.timestamp).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })
              : 'Timestamp Recorded';

            return (
              <div key={idx} className="relative group">
                {/* Node marker */}
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full ${meta.dotClass} flex items-center justify-center shadow-xs ring-4 ring-white`}>
                  <IconComponent size={10} />
                </div>

                {/* Event Details Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded border ${meta.badgeClass}`}>
                      <IconComponent size={11} /> {meta.title}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1 font-medium">
                      <Calendar size={11} className="text-slate-400" /> {dateStr}
                    </span>
                  </div>

                  {evt.notes && (
                    <p className="text-xs text-slate-700 font-medium leading-relaxed mt-1">
                      {evt.notes}
                    </p>
                  )}

                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                    <User size={11} className="text-slate-400" />
                    <span>
                      Actor: <strong className="text-slate-700">{evt.user_name || 'System'}</strong>
                      {evt.user_role ? ` (${evt.user_role})` : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getPoStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase().replace('-', '_');
    switch (s) {
      case 'received':
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 size={12} /> Delivered & Verified
          </span>
        );
      case 'in_transit':
      case 'dispatched':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-900 border border-blue-300">
            <Truck size={12} /> In-Transit
          </span>
        );
      case 'confirmed':
      case 'acknowledged':
      case 'ordered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-100 text-indigo-900 border border-indigo-300">
            <Check size={12} /> Order Confirmed
          </span>
        );
      case 'cancelled':
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-900 border border-rose-300">
            <XCircle size={12} /> Order Rejected
          </span>
        );
      case 'pending':
      case 'pending_confirmation':
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
            <Clock size={12} /> Pending Review
          </span>
        );
    }
  };

  const getShipmentStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase().replace('-', '_');
    switch (s) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
            <ShieldCheck size={12} /> Verified by Store
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-900 border border-blue-300">
            <CheckCircle2 size={12} /> Delivered at Dock
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-100 text-indigo-900 border border-indigo-300">
            <Truck size={12} /> In-Transit
          </span>
        );
      case 'preparing':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-300">
            <Clock size={12} /> Packaging & Prep
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. ARCHITECTURAL PROCESS FLOW BAR: Zero Confusion Between PO & Shipment */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500 text-white">
                Fulfillment Pipeline
              </span>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Orders & Shipments Management Hub</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Clear 2-stage workflow: Review and accept <strong>Store Owner Purchase Orders (POs)</strong> first, then dispatch into <strong>Live Shipments</strong> with step-by-step milestone tracking.
            </p>
          </div>

          {/* Pipeline Funnel Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:w-auto">
            <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl">
              <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider block">1. POs Pending</span>
              <span className="text-base font-black text-white">{pendingOrders.length} Orders</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl">
              <span className="text-[10px] text-indigo-400 font-black uppercase tracking-wider block">2. Accepted / Prep</span>
              <span className="text-base font-black text-white">{confirmedOrders.length} Orders</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl">
              <span className="text-[10px] text-blue-400 font-black uppercase tracking-wider block">3. In Transit</span>
              <span className="text-base font-black text-white">{inTransitCount} Loads</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl">
              <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider block">4. Verified</span>
              <span className="text-base font-black text-white">{verifiedCount} Delivered</span>
            </div>
          </div>
        </div>

        {/* Sub-view Switcher Tabs */}
        <div className="pt-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setActiveSubView('orders')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeSubView === 'orders'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <FileCheck size={15} />
              <span>Incoming Purchase Orders</span>
              {pendingOrders.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-900 animate-pulse">
                  {pendingOrders.length} New
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-200">
                  {purchases.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSubView('shipments')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeSubView === 'shipments'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Truck size={15} />
              <span>Dispatched Shipments & Deliveries</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-200">
                {shipments.length}
              </span>
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={handleOpenCreateGeneric}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Plus size={15} /> Create Restock Shipment
          </button>
        </div>
      </div>

      {/* 2. ADVANCED SEARCH & FILTER BAR: Store Name, Date Range, Status */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by Store Name, Manager Name, PO #, Waybill / Tracking #, Product SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-slate-50/50 font-medium"
            />
          </div>

          {/* Store Name Dropdown Filter */}
          <div className="flex items-center gap-2">
            <Store size={15} className="text-slate-400 shrink-0" />
            <select
              value={selectedStoreFilter}
              onChange={(e) => setSelectedStoreFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
            >
              <option value="all">All Store Branches</option>
              {storeNamesList.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Preset Filter */}
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-slate-400 shrink-0" />
            <select
              value={dateRangePreset}
              onChange={(e: any) => setDateRangePreset(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>

          {/* Quick Reset */}
          {(searchQuery || selectedStoreFilter !== 'all' || dateRangePreset !== 'all' || (activeSubView === 'orders' ? poStatusFilter !== 'all' : shipmentStatusFilter !== 'all')) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              title="Reset all search and filter criteria"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>

        {/* Custom Date Range Pickers (if selected) */}
        {dateRangePreset === 'custom' && (
          <div className="flex items-center gap-3 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs animate-in fade-in">
            <span className="font-bold text-blue-900">Custom Date Range:</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-medium"
              />
            </div>
          </div>
        )}

        {/* Status Chips Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100">
          <span className="text-[10px] font-black uppercase text-slate-400 shrink-0 mr-1">Status Filter:</span>
          {activeSubView === 'orders' ? (
            [
              { id: 'all', label: 'All Orders' },
              { id: 'pending', label: 'Pending Review' },
              { id: 'confirmed', label: 'Order Confirmed' },
              { id: 'in_transit', label: 'In-Transit' },
              { id: 'delivered', label: 'Delivered & Stocked' },
              { id: 'rejected', label: 'Rejected / Declined' }
            ].map((flt) => (
              <button
                key={flt.id}
                type="button"
                onClick={() => setPoStatusFilter(flt.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  poStatusFilter === flt.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {flt.label}
              </button>
            ))
          ) : (
            [
              { id: 'all', label: 'All Shipments' },
              { id: 'preparing', label: 'Packaging & Prep' },
              { id: 'in_transit', label: 'In-Transit' },
              { id: 'delivered', label: 'Delivered at Dock' },
              { id: 'verified', label: 'Verified & Stocked' }
            ].map((flt) => (
              <button
                key={flt.id}
                type="button"
                onClick={() => setShipmentStatusFilter(flt.id as any)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  shipmentStatusFilter === flt.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {flt.label}
              </button>
            ))
          )}
        </div>
      </div>

      {/* VIEW 1: INCOMING STORE PURCHASE ORDERS (POs) */}
      {activeSubView === 'orders' && (
        <div className="space-y-4">
          {/* Header Explanation */}
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <FileCheck size={16} className="text-blue-600" />
              <span>Incoming Store Purchase Orders ({filteredPurchases.length})</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              Review line items, confirm delivery SLAs, or reject unfeasible orders.
            </span>
          </div>

          {/* PO Cards List */}
          {filteredPurchases.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
              <Store size={36} className="mx-auto mb-2 text-slate-300" />
              <h4 className="font-bold text-slate-800 text-sm">No Purchase Orders Found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No store purchase orders match your search and filter criteria. When a Store Owner issues a restock order for {activeSupplier}, it appears here immediately.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredPurchases.map((po) => {
                const isExpanded = expandedPoId === po.id;
                const isPending =
                  po.status === 'pending' ||
                  po.status === 'pending_confirmation' ||
                  po.status === 'draft';
                const isConfirmed =
                  po.status === 'confirmed' ||
                  po.status === 'acknowledged' ||
                  po.status === 'ordered';
                const isRejected = po.status === 'cancelled' || po.status === 'rejected';
                const canFulfill = isConfirmed || isPending;

                const storeNameDisplay = po.store_name || "Ummi's Lane Enterprise";
                const managerNameDisplay = po.manager_name || po.user_name || "Ing. Mensah (Store Owner)";

                return (
                  <div
                    key={po.id}
                    id={`po-row-${po.id}`}
                    className={`bg-white rounded-2xl border transition-all ${
                      isExpanded ? 'border-blue-400 ring-2 ring-blue-500/20 shadow-md' : 'border-slate-200/90 shadow-2xs hover:border-slate-300'
                    } overflow-hidden`}
                  >
                    {/* Top Row: Store Name, Manager Name, PO # & Status */}
                    <div className="p-4 sm:p-4.5 bg-slate-50/70 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                          <Store size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-slate-900">{storeNameDisplay}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black font-mono bg-blue-100 text-blue-900 border border-blue-200">
                              #PO-{po.id}
                            </span>
                            {getPoStatusBadge(po.status)}
                          </div>
                          <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1 font-bold text-slate-800">
                              <UserCheck size={13} className="text-emerald-600" />
                              <span>Issued By: {managerNameDisplay}</span>
                            </span>
                            {po.user_email && (
                              <span className="text-slate-400">• {po.user_email}</span>
                            )}
                            <span className="text-slate-400">
                              • Ordered on {new Date(po.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Key Summary & Values */}
                      <div className="flex items-center gap-4 self-end md:self-auto">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Value</span>
                          <span className="text-base font-black text-slate-900">{formatGHS(po.total_amount)}</span>
                        </div>
                        <div className="text-right border-l border-slate-200 pl-4">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Delivery SLA</span>
                          <span className="text-xs font-black text-indigo-700">
                            {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : 'Standard 3-Day SLA'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle Section: Progress Stepper for this Order */}
                    <div className="p-4 sm:p-4.5 border-b border-slate-100">
                      <ShipmentProgressStepper
                        status={po.status}
                        confirmedDate={po.acknowledged_at}
                        shippedDate={po.dispatch_date}
                        eta={po.expected_date}
                        carrier={po.carrier}
                        trackingNumber={po.tracking_number}
                      />
                    </div>

                    {/* Bottom Action Bar & Details Expander */}
                    <div className="p-3.5 sm:p-4 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      {/* Left: Quick Logistics Info */}
                      <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin size={13} className="text-slate-400" />
                          <span>Dock: <strong className="text-slate-800">{po.dock_slot || 'Bay 1 (Standard Consignment)'}</strong></span>
                        </span>
                        <span>•</span>
                        <span>Mode: <strong className="text-slate-800">{po.fulfillment_mode === 'store_pickup' ? 'Store Pickup' : 'Direct Supplier Delivery'}</strong></span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                          className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                        >
                          <span>{po.item_count || po.items?.length || 1} Line Items ({po.total_units || 0} Units)</span>
                          <ChevronDown size={14} className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                      </div>

                      {/* Right: Explicit Accept, Reject, and Fulfill Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* 1. Review & Accept PO */}
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setAcceptingPo(po);
                                setAcceptNotes(`PO #${po.id} accepted. Production and consignment packaging scheduled.`);
                                setAcceptPromisedDate(
                                  po.expected_date || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
                                );
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                              title="Accept this Purchase Order from the Store Owner"
                            >
                              <Check size={14} /> Accept PO
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRejectingPo(po);
                                setRejectNotes('');
                              }}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-black text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                              title="Decline this Purchase Order with reason"
                            >
                              <XCircle size={14} /> Reject PO
                            </button>
                          </>
                        )}

                        {/* 2. Packaging & Dispatch Shipment */}
                        {canFulfill && !isRejected && (
                          <button
                            type="button"
                            onClick={() => handleFulfillPO(po)}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            title="Package and dispatch shipment with carrier tracking"
                          >
                            <Truck size={14} /> Packaging & Dispatch
                          </button>
                        )}

                        {/* 3. Attach Invoice */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onAttachInvoiceForPO) {
                              onAttachInvoiceForPO(po);
                            } else {
                              addToast(`Invoice attached to PO #${po.id}`, 'info');
                            }
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                          title="Generate or attach invoice for this order"
                        >
                          <CreditCard size={13} /> Invoice
                        </button>

                        {/* 4. Print Packing Slip */}
                        <button
                          type="button"
                          onClick={() => setPackingSlipPo(po)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                          title="Print warehouse packing manifest"
                        >
                          <Printer size={13} /> Packing Slip
                        </button>
                      </div>
                    </div>

                    {/* Expandable Line Items Drawer */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                            <Boxes size={15} className="text-blue-600" />
                            <span>Ordered Manifest Line Items ({po.items?.length || 1} Products)</span>
                          </h4>
                          <span className="text-[11px] text-slate-500 font-bold">
                            Dock Slot: {po.dock_slot || 'Bay 1 (Standard)'} • Window: {po.dock_time_window || '10:00 AM - 12:00 PM'}
                          </span>
                        </div>

                        {po.notes && (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 font-medium">
                            <strong>Store Owner Delivery Instructions:</strong> {po.notes}
                          </div>
                        )}

                        {po.status === 'cancelled' && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950 font-medium flex items-center gap-2">
                            <AlertCircle size={15} className="text-rose-600 shrink-0" />
                            <span><strong>Order Declined:</strong> {po.acknowledgment_notes || 'Declined by supplier'}</span>
                          </div>
                        )}

                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                                <th className="py-2.5 px-3.5">Product Name</th>
                                <th className="py-2.5 px-3">SKU</th>
                                <th className="py-2.5 px-3">Category</th>
                                <th className="py-2.5 px-3 text-right">Requested Qty</th>
                                <th className="py-2.5 px-3 text-right">Unit Price</th>
                                <th className="py-2.5 px-3.5 text-right">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(po.items && po.items.length > 0) ? (
                                po.items.map((it: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50/70">
                                    <td className="py-2.5 px-3.5 font-bold text-slate-900">
                                      {it.product_name}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                                      {it.sku}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-500">
                                      {it.category || 'Standard Consignment'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                      {it.quantity} units
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-slate-600">
                                      {formatGHS(it.unit_price)}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-right font-black text-slate-900">
                                      {formatGHS((it.quantity || 0) * (it.unit_price || 0))}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={6} className="py-3 px-3.5 text-slate-400 italic">
                                    No item details recorded. Total order value: {formatGHS(po.total_amount)}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: DISPATCHED SHIPMENTS & LIVE LOGISTICS */}
      {activeSubView === 'shipments' && (
        <div className="space-y-4">
          {/* Header & Bulk Selection Controls Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isSomeSelected && !isAllSelected;
                  }}
                  onChange={toggleSelectAllShipments}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  id="select-all-shipments-cb"
                />
                <span className="text-xs font-bold text-slate-800">
                  Select All ({filteredShipments.length} Shipments)
                </span>
              </label>

              {selectedShipmentIds.size > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-200 animate-in fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                  {selectedShipmentIds.size} Selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedShipmentIds.size > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => openBulkModal('packaging')}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Package size={14} className="text-amber-700" />
                    <span>Set to Packaging ({selectedShipmentIds.size})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openBulkModal('in_transit')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Truck size={14} />
                    <span>Set to In Transit ({selectedShipmentIds.size})</span>
                  </button>

                  <button
                    type="button"
                    onClick={clearShipmentSelection}
                    className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-slate-500 font-medium">
                  Select items to bulk update status to Packaging or In Transit simultaneously.
                </span>
              )}
            </div>
          </div>

          {filteredShipments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
              <Truck size={36} className="mx-auto mb-2 text-slate-300" />
              <h4 className="font-bold text-slate-800 text-sm">No Shipments Found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No active restock consignments match your search and filter criteria. You can create a new restock shipment or fulfill an incoming Store PO.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateGeneric}
                className="mt-4 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Create Restock Shipment
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredShipments.map((s: any) => {
                const isExpanded = expandedShipmentId === s.id;
                const isTimelineExpanded = expandedTimelineId === s.id;
                const isSelected = selectedShipmentIds.has(s.id);
                const canAttachInvoice = s.status === 'delivered' || s.status === 'verified';
                const storeNameDisplay = s.store_name || "Ummi's Lane Enterprise";
                const managerNameDisplay = s.manager_name || "Ing. Mensah (Store Owner)";

                return (
                  <div
                    key={s.id}
                    id={`shipment-row-${s.id}`}
                    className={`bg-white rounded-2xl border transition-all ${
                      isExpanded || isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                        : 'border-slate-200/90 shadow-2xs hover:border-slate-300'
                    }`}
                  >
                    {/* Top Row: Checkbox, Store Name, Manager Name, Shipment #, Carrier */}
                    <div className="p-4 sm:p-4.5 bg-slate-50/70 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        {/* Row Selection Checkbox */}
                        <div className="pt-0.5 sm:pt-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectShipment(s.id)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                            aria-label={`Select shipment ${s.shipment_number}`}
                          />
                        </div>

                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                          <Truck size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-slate-900">{s.shipment_number}</span>
                            {s.po_id && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-200">
                                Linked PO #{s.po_id}
                              </span>
                            )}
                            {getShipmentStatusBadge(s.status)}
                          </div>
                          <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1 font-bold text-slate-800">
                              <Store size={13} className="text-blue-600" />
                              <span>Destination Store: {storeNameDisplay}</span>
                            </span>
                            <span className="text-slate-400">• Recipient: {managerNameDisplay}</span>
                            <span className="text-slate-400">
                              • Shipped {new Date(s.shipped_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Waybill & Carrier Info */}
                      <div className="flex items-center gap-4 self-end md:self-auto">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Carrier & Tracking</span>
                          <span className="text-xs font-black text-blue-700 font-mono">
                            {s.carrier}: {s.tracking_number}
                          </span>
                        </div>
                        <div className="text-right border-l border-slate-200 pl-4">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Consignment Value</span>
                          <span className="text-base font-black text-slate-900">{formatGHS(s.total_value || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Middle Section: Visual 4-Stage Stepper */}
                    <div className="p-4 sm:p-4.5 border-b border-slate-100">
                      <ShipmentProgressStepper
                        status={s.status}
                        carrier={s.carrier}
                        trackingNumber={s.tracking_number}
                        shippedDate={s.shipped_date}
                        deliveredDate={s.delivered_date}
                        eta={s.eta}
                      />
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="p-3.5 sm:p-4 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin size={13} className="text-slate-400" />
                          <span>Dock: <strong className="text-slate-800">{s.destination || 'Main Store Warehouse Dock'}</strong></span>
                        </span>
                        <span>•</span>
                        <span className="text-indigo-700 font-bold">
                          ETA: {new Date(s.eta).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setExpandedShipmentId(isExpanded ? null : s.id)}
                          className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                        >
                          <span>{s.item_count || s.items?.length || 1} Consignment Items ({s.total_units || 0} Units)</span>
                          <ChevronDown size={14} className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setExpandedTimelineId(isTimelineExpanded ? null : s.id)}
                          className={`font-bold flex items-center gap-1.5 cursor-pointer transition-all px-2.5 py-1 rounded-lg text-xs border ${
                            isTimelineExpanded
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                          title="View read-only status milestone timeline"
                        >
                          <Clock size={13} className={isTimelineExpanded ? 'text-white' : 'text-blue-600'} />
                          <span>Timeline ({s.history?.length || 1})</span>
                          <ChevronDown size={13} className={isTimelineExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* Invoice Attachment */}
                        {s.invoice_attached ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            <FileCheck size={12} /> {s.invoice_number || 'Invoice Attached'}
                          </span>
                        ) : canAttachInvoice ? (
                          <button
                            type="button"
                            onClick={() => onAttachInvoice && onAttachInvoice(s)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <CreditCard size={13} /> Attach Invoice
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Invoice billable upon delivery
                          </span>
                        )}

                        {/* Mark Delivered button */}
                        {!isAdmin && s.status === 'in_transit' && (
                          <button
                            type="button"
                            onClick={() => handleMarkDelivered(s)}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            Mark Delivered
                          </button>
                        )}

                        {/* Admin Verification */}
                        {isAdmin && s.status !== 'verified' && (
                          <button
                            type="button"
                            onClick={() => setVerifyingShipment(s)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Verify and stock goods into store inventory"
                          >
                            <ShieldCheck size={13} /> Verify & Stock
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Read-Only Status Milestone Timeline */}
                    {isTimelineExpanded && (
                      <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 animate-in fade-in">
                        {renderShipmentTimeline(s.history, s.shipment_number)}
                      </div>
                    )}

                    {/* Expandable Manifest Detail */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                            <Boxes size={15} className="text-blue-600" />
                            <span>Consignment Items for #{s.shipment_number}</span>
                          </h4>
                          <span className="text-[11px] text-slate-500 font-bold">
                            Carrier Waybill: {s.carrier} ({s.tracking_number})
                          </span>
                        </div>

                        {s.notes && (
                          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 font-medium">
                            <strong>Dispatch Consignment Notes:</strong> {s.notes}
                          </div>
                        )}

                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                                <th className="py-2.5 px-3.5">Product Name</th>
                                <th className="py-2.5 px-3">SKU</th>
                                <th className="py-2.5 px-3 text-right">Quantity</th>
                                <th className="py-2.5 px-3 text-right">Unit Cost</th>
                                <th className="py-2.5 px-3 text-right">Line Total</th>
                                <th className="py-2.5 px-3.5">Batch / Lot #</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(s.items && s.items.length > 0) ? (
                                s.items.map((it: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50/70">
                                    <td className="py-2.5 px-3.5 font-bold text-slate-900">
                                      {it.product_name}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                                      {it.sku}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                      {it.quantity} units
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-slate-600">
                                      {formatGHS(it.unit_cost)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                      {formatGHS((it.quantity || 0) * (it.unit_cost || 0))}
                                    </td>
                                    <td className="py-2.5 px-3.5 font-mono text-[10px] text-slate-500">
                                      {it.batch_lot_number || 'LOT-2026-STD'}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={6} className="py-3 px-3.5 text-slate-400 italic">
                                    No item breakdown details recorded.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* FLOATING ACTION TOOLBAR WHEN SHIPMENTS ARE SELECTED */}
          {selectedShipmentIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-200">
              <div className="flex items-center gap-3 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md">
                <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                    {selectedShipmentIds.size}
                  </span>
                  <span className="text-xs font-bold text-slate-200 hidden sm:inline">
                    {selectedShipmentIds.size === 1 ? 'Shipment Selected' : 'Shipments Selected'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={toggleSelectAllShipments}
                  className="text-xs font-bold text-slate-300 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {isAllSelected ? 'Deselect All' : 'Select All'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openBulkModal('packaging')}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Package size={14} /> <span>Update to Packaging</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openBulkModal('in_transit')}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Truck size={14} /> <span>Update to In Transit</span>
                  </button>

                  <button
                    type="button"
                    onClick={clearShipmentSelection}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors ml-1 cursor-pointer"
                    title="Clear selection"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BULK STATUS UPDATE MODAL */}
          {showBulkModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                      showBulkModal === 'packaging' ? 'bg-amber-500' : 'bg-blue-600'
                    }`}>
                      {showBulkModal === 'packaging' ? <Package size={18} /> : <Truck size={18} />}
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900">
                        Bulk Update {selectedShipmentIds.size} Shipments to {showBulkModal === 'packaging' ? 'Packaging' : 'In Transit'}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Simultaneously advance the lifecycle stage and append to status history
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  {/* Selected Shipments Tag List */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                      Target Shipments ({selectedShipmentIds.size}):
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                      {Array.from(selectedShipmentIds).map((id) => {
                        const found = shipments.find((s) => s.id === id);
                        return (
                          <span key={id} className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-200">
                            {found?.shipment_number || `#${id}`}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {showBulkModal === 'in_transit' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Assigned Freight Carrier
                        </label>
                        <select
                          value={bulkCarrier}
                          onChange={(e) => setBulkCarrier(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:border-blue-500"
                        >
                          <option value="FedEx Freight Ghana">FedEx Freight Ghana</option>
                          <option value="DHL Supply Chain">DHL Supply Chain</option>
                          <option value="Imperial Logistics Ghana">Imperial Logistics Ghana</option>
                          <option value="Direct Supplier Van">Direct Supplier Van</option>
                          <option value="Standard Store Freight">Standard Store Freight</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Waybill / Tracking Prefix
                        </label>
                        <input
                          type="text"
                          value={bulkTrackingPrefix}
                          onChange={(e) => setBulkTrackingPrefix(e.target.value)}
                          placeholder="e.g. GH-LOG-"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Status Change Audit Notes (Recorded in History Timeline)
                    </label>
                    <textarea
                      rows={3}
                      value={bulkNotes}
                      onChange={(e) => setBulkNotes(e.target.value)}
                      placeholder="e.g. Order batch moved to warehouse packaging station / dispatched with driver..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBulkModal(null)}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecuteBulkUpdate(showBulkModal)}
                      disabled={isSubmittingBulk}
                      className={`px-4 py-2 text-white font-black text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60 ${
                        showBulkModal === 'packaging'
                          ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                          : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                      }`}
                    >
                      {isSubmittingBulk ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Updating {selectedShipmentIds.size} Shipments...</span>
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          <span>Confirm Bulk Update to {showBulkModal === 'packaging' ? 'Packaging' : 'In Transit'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ACCEPT PURCHASE ORDER (Enter SLA & Notes) */}
      {acceptingPo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50 text-emerald-950 rounded-t-2xl">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-600" size={18} />
                  Accept Purchase Order #PO-{acceptingPo.id}
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  Confirm to Store Owner ({acceptingPo.store_name || "Store"}) that order terms and delivery SLAs are locked in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAcceptingPo(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex justify-between text-slate-700">
                  <span>Store Customer:</span>
                  <strong className="font-black text-slate-900">{acceptingPo.store_name || "Ummi's Lane Enterprise"}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Store Manager / Issuer:</span>
                  <strong className="font-black text-slate-900">{acceptingPo.manager_name || acceptingPo.user_name || "Ing. Mensah"}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Order Total:</span>
                  <strong className="font-black text-emerald-700 text-sm">{formatGHS(acceptingPo.total_amount)}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Delivery Dock:</span>
                  <strong className="font-bold text-slate-800">{acceptingPo.dock_slot || 'Bay 1 (Standard Consignment)'}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Promised Delivery SLA Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={acceptPromisedDate}
                  onChange={(e) => setAcceptPromisedDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supplier Confirmation Notes / Commitment
                </label>
                <textarea
                  rows={3}
                  value={acceptNotes}
                  onChange={(e) => setAcceptNotes(e.target.value)}
                  placeholder="e.g. Order accepted and allocated at factory. Preparation & packaging scheduled."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAcceptingPo(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAcceptPO}
                  disabled={isSubmittingAccept}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingAccept ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Confirming Acceptance...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Lock In SLA & Accept PO</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REJECT PURCHASE ORDER (Select Reason) */}
      {rejectingPo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-rose-50 text-rose-950 rounded-t-2xl">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <XCircle className="text-rose-600" size={18} />
                  Decline Purchase Order #PO-{rejectingPo.id}
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  Declining will notify the Store Owner with your explicit explanation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingPo(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between text-slate-700">
                  <span>Store Name:</span>
                  <strong className="font-black text-slate-900">{rejectingPo.store_name || "Ummi's Lane Enterprise"}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Order Value:</span>
                  <strong className="font-black text-slate-900">{formatGHS(rejectingPo.total_amount)}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Primary Rejection Reason Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={rejectReasonCategory}
                  onChange={(e) => setRejectReasonCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-bold text-slate-800 focus:outline-none focus:border-rose-500"
                >
                  <option value="Out of Stock / Production Halted">Out of Stock / Production Halted</option>
                  <option value="Minimum Order Quantity (MOQ) Not Met">Minimum Order Quantity (MOQ) Not Met</option>
                  <option value="Requested Delivery SLA Cannot Be Met">Requested Delivery SLA Cannot Be Met</option>
                  <option value="Pricing or Cost Discrepancy">Pricing or Cost Discrepancy</option>
                  <option value="Other / Factory Scheduling Constraint">Other / Factory Scheduling Constraint</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Explanation Note for Store Owner
                </label>
                <textarea
                  rows={3}
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Provide context so the Store Owner understands why the PO is declined (e.g. factory retooling until next week)."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingPo(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectPO}
                  disabled={isSubmittingReject}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingReject ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Declining PO...</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} />
                      <span>Decline & Notify Store Owner</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE RESTOCK SHIPMENT & DISPATCH */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <Truck className="text-blue-600" size={18} />
                  {linkedPoId ? `Packaging & Dispatch for Store Order #PO-${linkedPoId}` : 'Create Restock Shipment & Dispatch'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {linkedPoId
                    ? `Assign carrier, waybill tracking, and dispatch goods. Advances progress to In-Transit automatically.`
                    : 'Dispatch restock inventory consignment to the Store Owner.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setLinkedPoId(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitShipment} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {linkedPoId && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-blue-900 font-medium">
                  <div className="flex items-center gap-2">
                    <FileCheck size={16} className="text-blue-600" />
                    <span>Fulfilling Purchase Order <strong>#PO-{linkedPoId}</strong> for <strong>{activeSupplier}</strong></span>
                  </div>
                  <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Store Sync Active</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Logistics Carrier <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="e.g. FedEx Freight Ghana, DHL, Direct Fleet"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Waybill / Tracking Number <span className="text-rose-500">*</span>
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
                  <label className="block font-bold text-slate-700 mb-1">
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
                  <label className="block font-bold text-slate-700 mb-1">
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
                <label className="block font-bold text-slate-700 mb-1">
                  Destination Warehouse / Dock
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Ummi's Store Central Warehouse, Bay 2"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Items in Consignment */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-bold text-slate-700">
                    Consignment Manifest Items <span className="text-rose-500">*</span>
                  </label>
                  {!linkedPoId && (
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
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
                <label className="block font-bold text-slate-700 mb-1">
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
                  disabled={isSubmittingShipment}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingShipment ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Dispatching Shipment...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>{linkedPoId ? 'Dispatch Consignment (Advance to In-Transit)' : 'Dispatch Restock Shipment'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PRINT PACKING SLIP & DISPATCH MANIFEST */}
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
                  <div className="font-black text-slate-900 mt-0.5">{packingSlipPo.store_name || "Ummi's Lane Enterprise"}</div>
                  <div className="text-slate-600 font-bold">{packingSlipPo.manager_name || "Ing. Mensah (Store Owner)"}</div>
                  <div className="text-slate-500">Slot: {packingSlipPo.dock_slot || 'Bay 1 (Standard Consignment)'}</div>
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
                  <div className="text-[10px] text-slate-500 mt-1">Verified By: {packingSlipPo.manager_name || "Store Receiving Officer"}</div>
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

      {/* MODAL 5: VERIFY SHIPMENT MODAL (ADMIN ONLY) */}
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

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-950 font-medium leading-relaxed">
                Confirming receipt automatically updates the Store inventory levels, records this restock into inventory audits, and marks the shipment as Verified.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
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
