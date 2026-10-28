import React, { useState } from 'react';
import { formatGHS } from '../../lib/formatters';
import PODocumentModal from './PODocumentModal';
import ReceivePOModal from './ReceivePOModal';
import { useNotifications } from '../../context/NotificationContext';
import { useModalDismiss } from '../../hooks/useModalDismiss';
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
  RotateCcw,
  Package,
  MoreHorizontal,
  Printer
} from 'lucide-react';
import RowActionMenu from '../common/RowActionMenu';

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
  onOpenASNModal?: (po: PurchaseOrder) => void;
  onOpenInvoiceModal?: (po: PurchaseOrder) => void;
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
  onOpenASNModal,
  onOpenInvoiceModal,
  catalogProducts = [],
  userRole = 'admin'
}: POManagementProps) {
  // Quick filters as requested: All, Pending Confirmation, Ready for Pickup, In-Transit, Received, Canceled
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPoId, setExpandedPoId] = useState<number | null>(null);

  // Modals state
  const [documentModalPo, setDocumentModalPo] = useState<PurchaseOrder | null>(null);
  const [receiveModalPo, setReceiveModalPo] = useState<PurchaseOrder | null>(null);
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  const [ackModalPo, setAckModalPo] = useState<PurchaseOrder | null>(null);
  const [ackNotes, setAckNotes] = useState('Order received and confirmed for production.');

  const [attachModalPo, setAttachModalPo] = useState<PurchaseOrder | null>(null);
  const [docType, setDocType] = useState<'invoice' | 'packing_list' | 'bill_of_lading'>('invoice');
  const [docName, setDocName] = useState('');

  // Logistics & Fulfillment Modal State
  const [logisticsModalPo, setLogisticsModalPo] = useState<PurchaseOrder | null>(null);

  const { addToast } = useNotifications();
  useModalDismiss(!!logisticsModalPo, () => setLogisticsModalPo(null));
  useModalDismiss(!!ackModalPo, () => setAckModalPo(null));
  useModalDismiss(!!attachModalPo, () => setAttachModalPo(null));
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

  // Quick pipeline metric counts according to Module 2 lifecycle
  const allCount = purchases.length;
  const draftCount = purchases.filter((p) => p.status.toLowerCase() === 'draft').length;
  const sentCount = purchases.filter((p) => ['sent', 'pending', 'pending_confirmation', 'submitted', 'ordered'].includes(p.status.toLowerCase()) && !p.acknowledged_at).length;
  const confirmedCount = purchases.filter((p) => p.status.toLowerCase() === 'confirmed' || (p.acknowledged_at && p.status.toLowerCase() !== 'received' && p.status.toLowerCase() !== 'cancelled')).length;
  const productionCount = purchases.filter((p) => ['in_production', 'preparing', 'ready_for_pickup'].includes(p.status.toLowerCase())).length;
  const shippedCount = purchases.filter((p) => ['shipped', 'in-transit', 'out_for_delivery'].includes(p.status.toLowerCase())).length;
  const deliveredCount = purchases.filter((p) => ['delivered', 'received'].includes(p.status.toLowerCase())).length;
  const canceledCount = purchases.filter((p) => p.status.toLowerCase() === 'cancelled').length;

  const totalSpend = purchases.reduce((acc, p) => acc + (p.total_amount || 0), 0);
  const pendingSpend = purchases
    .filter((p) => ['pending', 'pending_confirmation', 'submitted', 'ordered'].includes(p.status.toLowerCase()))
    .reduce((acc, p) => acc + (p.total_amount || 0), 0);
  const receivedSpend = purchases
    .filter((p) => p.status.toLowerCase() === 'received')
    .reduce((acc, p) => acc + (p.total_amount || 0), 0);

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
      addToast(err.message || 'Failed to update logistics.', 'error');
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
      if (statusFilter === 'draft') {
        matchesStatus = st === 'draft';
      } else if (statusFilter === 'sent') {
        matchesStatus = ['sent', 'pending', 'pending_confirmation', 'submitted', 'ordered'].includes(st) && !po.acknowledged_at;
      } else if (statusFilter === 'confirmed') {
        matchesStatus = st === 'confirmed' || (!!po.acknowledged_at && st !== 'received' && st !== 'cancelled');
      } else if (statusFilter === 'in_production') {
        matchesStatus = ['in_production', 'preparing', 'ready_for_pickup'].includes(st);
      } else if (statusFilter === 'shipped') {
        matchesStatus = ['shipped', 'in-transit', 'out_for_delivery'].includes(st);
      } else if (statusFilter === 'delivered' || statusFilter === 'received') {
        matchesStatus = ['delivered', 'received'].includes(st);
      } else if (statusFilter === 'cancelled') {
        matchesStatus = st === 'cancelled';
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

  const sortedPOs = [...filteredPOs].sort((a, b) => {
    if (sortBy === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'amount_desc') return b.total_amount - a.total_amount;
    if (sortBy === 'amount_asc') return a.total_amount - b.total_amount;
    return 0;
  });

  const handleExportAllCsv = () => {
    if (sortedPOs.length === 0) {
      addToast('No purchase orders to export.', 'warning');
      return;
    }
    const headers = ['PO Reference', 'Date', 'Supplier', 'Contact', 'Status', 'Total Amount (GHS)', 'Units', 'Fulfillment Mode', 'Driver', 'Vehicle Reg', 'Dock Bay'];
    const rows = sortedPOs.map((po) => [
      `PO-${po.id}`,
      new Date(po.created_at).toLocaleDateString(),
      `"${(po.supplier_name || '').replace(/"/g, '""')}"`,
      `"${(po.supplier_contact || '').replace(/"/g, '""')}"`,
      po.status,
      po.total_amount.toFixed(2),
      po.total_units || (po.items ? po.items.reduce((s, it) => s + it.quantity, 0) : 0),
      po.fulfillment_mode || 'direct_delivery',
      `"${(po.driver_name || '').replace(/"/g, '""')}"`,
      `"${(po.vehicle_number || '').replace(/"/g, '""')}"`,
      `"${(po.dock_slot || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Purchase_Orders_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Draft
          </span>
        );
      case 'pending':
      case 'pending_confirmation':
      case 'ordered':
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={11} className="text-amber-500" /> Pending
          </span>
        );
      case 'ready_for_pickup':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Building2 size={11} className="text-purple-500" /> Ready for Pickup
          </span>
        );
      case 'in-transit':
      case 'out_for_delivery':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Truck size={11} className="text-blue-500" /> In-Transit
          </span>
        );
      case 'received':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={11} className="text-emerald-500" /> Received
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Canceled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
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
      addToast(`Purchase Order #PO-${ackModalPo.id} acknowledged successfully.`, 'success');
      setAckModalPo(null);
    } catch (err: any) {
      addToast(err.message || 'Failed to acknowledge PO', 'error');
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
      addToast(`Document "${generatedName}" attached to PO #PO-${attachModalPo.id}.`, 'success');
      setAttachModalPo(null);
      setDocName('');
    } catch (err: any) {
      addToast(err.message || 'Failed to attach document', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total PO Volume</span>
            <Package size={14} className="text-blue-500" />
          </div>
          <div className="text-lg font-black text-slate-900 font-mono">{formatGHS(totalSpend)}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">{allCount} orders issued</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending Orders</span>
            <Clock size={14} className="text-amber-500" />
          </div>
          <div className="text-lg font-black text-amber-900 font-mono">{formatGHS(pendingSpend)}</div>
          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">{sentCount} orders awaiting SLA delivery</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Logistics</span>
            <Truck size={14} className="text-blue-500" />
          </div>
          <div className="text-lg font-black text-blue-900 font-mono">{shippedCount + productionCount} Shipments</div>
          <div className="text-[11px] text-blue-700 font-semibold mt-0.5">{shippedCount} in-transit, {productionCount} in production</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Fulfilled & Restocked</span>
            <CheckCircle2 size={14} className="text-emerald-500" />
          </div>
          <div className="text-lg font-black text-emerald-900 font-mono">{formatGHS(receivedSpend)}</div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">{deliveredCount} GRNs completed & stocked</div>
        </div>
      </div>

      {/* Control bar: Quick Filters, Search, Sort and Action Buttons */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Search Box */}
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search PO #, vendor, driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 focus:bg-white transition"
            />
          </div>

          {/* Quick Filters with live counts: [Draft, Sent, Confirmed, In Production, Shipped, Delivered, Cancelled] */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs overflow-x-auto">
            {[
              { id: 'all', label: 'All', count: allCount },
              { id: 'draft', label: 'Draft', count: draftCount },
              { id: 'sent', label: 'Sent', count: sentCount },
              { id: 'confirmed', label: 'Confirmed', count: confirmedCount },
              { id: 'in_production', label: 'In Production', count: productionCount },
              { id: 'shipped', label: 'Shipped', count: shippedCount },
              { id: 'delivered', label: 'Delivered', count: deliveredCount },
              { id: 'cancelled', label: 'Cancelled', count: canceledCount }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === st.id ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{st.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === st.id ? 'bg-blue-100 text-blue-800' : 'bg-slate-200/80 text-slate-600'
                }`}>
                  {st.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Amount: High to Low</option>
            <option value="amount_asc">Amount: Low to High</option>
          </select>

          {/* Export CSV Button */}
          <button
            onClick={handleExportAllCsv}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 flex items-center gap-1.5 cursor-pointer transition"
            title="Export filtered purchase orders to CSV"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {onCreatePO && (
            <button
              onClick={onCreatePO}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition"
            >
              <Plus size={14} /> Create Purchase Order
            </button>
          )}
        </div>
      </div>

      {/* PO List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">PO Number & Date</th>
                <th className="py-3 px-4">Supplier Partner</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Logistics & Fulfillment</th>
                <th className="py-3 px-4">Docs</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sortedPOs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 px-4 text-center text-slate-400">
                    <Package size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-500">No purchase orders found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting your search query or status filter.</p>
                  </td>
                </tr>
              ) : (
                sortedPOs.map((po) => {
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
                      <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-blue-50/20' : ''}`}>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
                            title={isExpanded ? "Collapse details" : "Expand line items & details"}
                          >
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold font-mono text-slate-900 flex items-center gap-1.5">
                            <span className="text-blue-600 font-bold">#PO-{po.id}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans mt-0.5 flex items-center gap-1">
                            <Calendar size={11} className="text-slate-400" />
                            {new Date(po.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{po.supplier_name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[180px]">
                            {po.supplier_contact || 'Standard Vendor'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {getStatusBadge(po.status)}
                          {po.acknowledged_at && (
                            <div className="text-[10px] text-emerald-600 font-medium mt-1 flex items-center gap-0.5">
                              <span>✓ Ack {new Date(po.acknowledged_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{formatGHS(po.total_amount)}</div>
                          {po.invoice_status && (
                            <span className={`inline-block text-[10px] font-semibold mt-0.5 ${
                              po.invoice_status === 'paid' ? 'text-emerald-600' : 'text-slate-400'
                            }`}>
                              Inv: {po.invoice_status}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {po.fulfillment_mode === 'store_pickup' ? (
                            <div className="text-[11px] space-y-0.5">
                              <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                                <Building2 size={11} /> Warehouse Pickup
                              </span>
                              {po.pickup_code && (
                                <div className="text-[10px] font-mono text-slate-500 pl-0.5">
                                  PIN: <strong className="text-slate-700">{po.pickup_code}</strong>
                                </div>
                              )}
                            </div>
                          ) : po.fulfillment_mode === 'direct_delivery' || po.driver_name || po.carrier ? (
                            <div className="text-[11px] space-y-0.5">
                              <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                <Truck size={11} /> Direct Delivery
                              </span>
                              {po.driver_name && (
                                <div className="text-[10px] text-slate-500 pl-0.5 truncate max-w-[160px]">
                                  {po.driver_name}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenLogistics(po)}
                              className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <Truck size={12} /> Set Logistics
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            {attachments.length > 0 ? (
                              <button
                                onClick={() => setAttachModalPo(po)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-medium text-slate-700 transition cursor-pointer"
                                title="View / Add attachments"
                              >
                                <Paperclip size={11} className="text-blue-600" />
                                <span>{attachments.length}</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setAttachModalPo(po)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-300 hover:text-slate-600 transition cursor-pointer"
                                title="Attach Document"
                              >
                                <Paperclip size={13} />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Primary Quick Action: Receive & Stock via GRN */}
                            {!isReceived && po.status !== 'cancelled' && (
                              <button
                                onClick={() => setReceiveModalPo(po)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                title="Goods physically received, verified & stocked into inventory with GRN"
                              >
                                <CheckCircle2 size={11} /> Receive
                              </button>
                            )}

                            {/* Kebab RowActionMenu with complete workflow options */}
                            <RowActionMenu
                              triggerTitle={`Options for #PO-${po.id}`}
                              actions={[
                                {
                                  label: 'View & Print Document',
                                  sublabel: 'Official Purchase Order form',
                                  icon: <Printer size={14} />,
                                  onClick: () => setDocumentModalPo(po)
                                },
                                (!isReceived && po.status !== 'cancelled') ? {
                                  label: 'Receive Goods (GRN)',
                                  sublabel: 'Verify batch & stock inventory',
                                  icon: <CheckCircle2 size={14} />,
                                  onClick: () => setReceiveModalPo(po)
                                } : null,
                                (!isReceived && po.status !== 'cancelled') ? {
                                  label: 'Submit ASN Notice',
                                  sublabel: 'Advanced shipping & tracking',
                                  icon: <Truck size={14} />,
                                  onClick: () => onOpenASNModal ? onOpenASNModal(po) : handleOpenLogistics(po)
                                } : null,
                                (po.status !== 'cancelled') ? {
                                  label: 'Upload Supplier Invoice',
                                  sublabel: '3-way match & accounting',
                                  icon: <FileText size={14} />,
                                  onClick: () => onOpenInvoiceModal ? onOpenInvoiceModal(po) : setAttachModalPo(po)
                                } : null,
                                (isDraft || (isPending && !po.acknowledged_at)) ? {
                                  label: 'Accept Order',
                                  sublabel: 'Confirm PO for production',
                                  icon: <Check size={14} />,
                                  onClick: () => {
                                    setAckModalPo(po);
                                    setAckNotes(`Order #PO-${po.id} accepted and confirmed for production.`);
                                  }
                                } : null,
                                (isDraft || (isPending && !po.acknowledged_at)) ? {
                                  label: 'Reject Order',
                                  sublabel: 'Decline purchase order',
                                  icon: <X size={14} />,
                                  destructive: true,
                                  onClick: () => onUpdateStatus(po.id, 'cancelled')
                                } : null,
                                (!isReceived && po.status !== 'cancelled') ? {
                                  label: 'Cancel Purchase Order',
                                  sublabel: 'Mark PO as cancelled',
                                  icon: <X size={14} />,
                                  destructive: true,
                                  onClick: () => {
                                    if (confirm(`Cancel Purchase Order #PO-${po.id}?`)) {
                                      onUpdateStatus(po.id, 'cancelled');
                                    }
                                  }
                                } : null
                              ]}
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Expanded PO details: Line Items, Full Logistics & Attachments */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          <td colSpan={8} className="p-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Order Line Items */}
                              <div className="md:col-span-2 space-y-2">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                                  <span>Order Line Items ({po.items?.length || 0})</span>
                                  <span>Expected Delivery: {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : 'Standard SLA'}</span>
                                </div>
                                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto shadow-2xs">
                                  {po.items && po.items.length > 0 ? (
                                    po.items.map((item, iIdx) => (
                                      <div key={iIdx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50">
                                        <div>
                                          <span className="font-semibold text-slate-900 block">{item.product_name}</span>
                                          <span className="text-[10px] font-mono text-slate-400">SKU: {item.sku}</span>
                                        </div>
                                        <div className="text-right">
                                          <span className="font-bold text-slate-900 block">{item.quantity} units @ {formatGHS(item.unit_price)}</span>
                                          <span className="text-[11px] text-blue-600 font-semibold">{formatGHS(item.quantity * item.unit_price)}</span>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="p-4 text-center text-slate-400 text-xs">No item details loaded for this PO.</div>
                                  )}
                                </div>
                                {po.notes && (
                                  <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                                    <strong className="text-slate-800">Order Notes:</strong> {po.notes}
                                  </p>
                                )}
                              </div>

                              {/* Logistics Summary Card */}
                              <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <Truck size={14} className="text-blue-600" /> Logistics Profile
                                  </span>
                                  <button
                                    onClick={() => handleOpenLogistics(po)}
                                    className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                                  >
                                    Configure
                                  </button>
                                </div>

                                <div className="text-xs space-y-2 text-slate-700">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Fulfillment Mode:</span>
                                    <span className="font-semibold capitalize">{po.fulfillment_mode === 'store_pickup' ? 'Warehouse Pickup' : 'Direct Delivery'}</span>
                                  </div>

                                  {po.driver_name && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Driver / Carrier:</span>
                                      <span className="font-semibold">{po.driver_name}</span>
                                    </div>
                                  )}

                                  {po.driver_phone && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Contact:</span>
                                      <span className="font-semibold">{po.driver_phone}</span>
                                    </div>
                                  )}

                                  {po.vehicle_number && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Vehicle Reg:</span>
                                      <span className="font-mono font-semibold">{po.vehicle_number}</span>
                                    </div>
                                  )}

                                  {po.eta_window && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">ETA Window:</span>
                                      <span className="font-semibold text-blue-700">{po.eta_window}</span>
                                    </div>
                                  )}

                                  {po.dock_slot && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Dock Slot:</span>
                                      <span className="font-semibold text-emerald-700">{po.dock_slot}</span>
                                    </div>
                                  )}

                                  {po.pickup_code && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Pickup Code:</span>
                                      <span className="font-mono font-bold text-purple-700">{po.pickup_code}</span>
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
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLogisticsModalPo(null);
          }}
          role="dialog"
          aria-modal="true"
        >
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
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAckModalPo(null);
          }}
          role="dialog"
          aria-modal="true"
        >
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
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAttachModalPo(null);
          }}
          role="dialog"
          aria-modal="true"
        >
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

      {/* PO Document Viewer & Print Modal */}
      {documentModalPo && (
        <PODocumentModal
          po={documentModalPo}
          isOpen={!!documentModalPo}
          onClose={() => setDocumentModalPo(null)}
        />
      )}

      {/* Goods Receipt Note (GRN) Confirmation Modal */}
      {receiveModalPo && (
        <ReceivePOModal
          po={receiveModalPo}
          isOpen={!!receiveModalPo}
          onClose={() => setReceiveModalPo(null)}
          onConfirm={async (poId) => {
            await onUpdateStatus(poId, 'received');
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
