import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import {
  Truck,
  PackageCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  Eye,
  RefreshCw,
  Building2,
  Phone,
  FileText,
  Boxes,
  Calendar,
  User,
  ShieldAlert,
  Search,
  ExternalLink,
  ChevronRight
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
  user_id: number;
  user_name?: string;
  supplier_name: string;
  supplier_contact?: string;
  total_amount: number;
  status: 'draft' | 'submitted' | 'ordered' | 'received' | 'cancelled';
  notes?: string;
  expected_date?: string;
  received_at?: string;
  confirmed_by?: string;
  created_at: string;
  item_count?: number;
  total_units?: number;
  items?: PurchaseItem[];
}

interface SupplierInteraction {
  id: number;
  supplier_name: string;
  user_id?: number;
  sender_name: string;
  sender_role: string;
  message_type: 'note' | 'dispatch' | 'inquiry' | 'receipt_confirmation' | 'status_update';
  po_id?: number;
  message: string;
  created_at: string;
}

interface SupplierProduct {
  id: number;
  name: string;
  sku: string;
  category: string;
  brand?: string;
  cost_price: number;
  price: number;
  stock_quantity: number;
}

export default function SupplierDashboard() {
  const { user } = useAuth();
  const { addToast, refreshNotifications } = useNotifications();

  // Active supplier state (defaults to logged-in user or active vendor)
  const isActualSupplier = user?.role === 'supplier';
  const defaultSupplierName = isActualSupplier
    ? (user?.name || '').replace(/supplier/i, '').trim() || 'Nestlé Ghana Ltd'
    : 'Nestlé Ghana Ltd';

  const [activeSupplier, setActiveSupplier] = useState<string>(defaultSupplierName);
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);

  // Tabs
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'workflow' | 'catalog'>('pending');

  // Data states
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [interactions, setInteractions] = useState<SupplierInteraction[]>([]);
  const [catalog, setCatalog] = useState<SupplierProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Confirming state
  const [updatingPoId, setUpdatingPoId] = useState<number | null>(null);

  // Detail Modal
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Workflow messaging state
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState<'note' | 'dispatch' | 'inquiry'>('dispatch');
  const [relatedPoId, setRelatedPoId] = useState<string>('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Load all supplier data
  const loadSupplierData = async (suppName: string) => {
    setLoading(true);
    try {
      const [posRes, interactionsRes, productsRes, suppliersRes] = await Promise.all([
        fetchApi(`/purchases?supplier=${encodeURIComponent(suppName)}`),
        fetchApi(`/supplier/interactions?supplier_name=${encodeURIComponent(suppName)}`),
        fetchApi(`/supplier/catalog?brand=${encodeURIComponent(suppName)}`),
        fetchApi('/suppliers')
      ]);

      setPurchases(posRes || []);
      setInteractions(interactionsRes || []);
      setCatalog(productsRes || []);

      if (suppliersRes && suppliersRes.length > 0) {
        const names = suppliersRes.map((s: any) => s.name);
        if (!names.includes('Nestlé Ghana Ltd')) names.push('Nestlé Ghana Ltd');
        if (!names.includes('Wilmar Africa Ltd')) names.push('Wilmar Africa Ltd');
        setAvailableSuppliers(names);
      } else {
        setAvailableSuppliers(['Nestlé Ghana Ltd', 'Wilmar Africa Ltd', 'Unilever Ghana']);
      }
    } catch (err: any) {
      console.error('Error loading supplier dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupplierData(activeSupplier);
  }, [activeSupplier]);

  // Handle PO Receipt / Confirmation
  const handleConfirmReceipt = async (poId: number) => {
    setUpdatingPoId(poId);
    try {
      const res = await fetchApi(`/purchases/${poId}/confirm-receipt`, {
        method: 'POST'
      });

      addToast({
        title: 'Receipt Confirmed! 📦',
        message: `PO #PO-${poId} confirmed as received. Stock inventory has been replenished.`,
        type: 'success'
      });

      // Update state locally
      setPurchases(prev =>
        prev.map(p => (p.id === poId ? { ...p, status: 'received', received_at: new Date().toISOString() } : p))
      );
      if (selectedPO && selectedPO.id === poId) {
        setSelectedPO({ ...selectedPO, status: 'received', received_at: new Date().toISOString() });
      }

      await loadSupplierData(activeSupplier);
      await refreshNotifications();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm purchase order receipt');
    } finally {
      setUpdatingPoId(null);
    }
  };

  // Open PO details
  const handleViewDetail = async (poId: number) => {
    setLoadingDetail(true);
    try {
      const poData = await fetchApi(`/purchases/${poId}`);
      setSelectedPO(poData);
    } catch (err: any) {
      alert(err.message || 'Failed to load purchase order details');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Send interaction message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSendingMessage(true);
    try {
      await fetchApi('/supplier/interactions', {
        method: 'POST',
        body: JSON.stringify({
          supplier_name: activeSupplier,
          message: newMessage.trim(),
          message_type: messageType,
          po_id: relatedPoId ? parseInt(relatedPoId, 10) : undefined
        })
      });

      addToast({
        title: 'Update Dispatched',
        message: 'Your update has been recorded in the supplier-owner workflow thread.',
        type: 'success'
      });

      setNewMessage('');
      setRelatedPoId('');
      // Reload interactions
      const freshInteractions = await fetchApi(`/supplier/interactions?supplier_name=${encodeURIComponent(activeSupplier)}`);
      setInteractions(freshInteractions || []);
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // Filtered lists
  const pendingOrders = purchases.filter(
    p => p.status === 'ordered' || p.status === 'submitted' || p.status === 'draft'
  );
  const fulfilledOrders = purchases.filter(p => p.status === 'received');
  const totalSpend = purchases.reduce((acc, p) => acc + (p.total_amount || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return (
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-black uppercase rounded-full inline-flex items-center gap-1.5 shadow-2xs">
            <CheckCircle2 size={12} className="text-emerald-600" /> Received
          </span>
        );
      case 'ordered':
      case 'submitted':
        return (
          <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-black uppercase rounded-full inline-flex items-center gap-1.5 shadow-2xs">
            <Clock size={12} className="text-amber-600" /> Pending Delivery
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-300 text-[11px] font-black uppercase rounded-full inline-flex items-center gap-1.5 shadow-2xs">
            <AlertCircle size={12} className="text-rose-600" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold uppercase rounded-full">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-200/60 shrink-0 mt-0.5">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">{activeSupplier}</h1>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-extrabold uppercase rounded-full">
                  Supplier Portal
                </span>
                {isActualSupplier && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded">
                    Logged in as Vendor
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Purchase Order Tracking, Restocking & Supplier-to-Shop Workflow
              </p>
            </div>
          </div>

          {/* Supplier Selector for Admin / Shop Owner */}
          <div className="flex items-center gap-2.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-[11px] font-bold uppercase text-slate-500 whitespace-nowrap">
              Vendor View:
            </span>
            <select
              value={activeSupplier}
              onChange={e => setActiveSupplier(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
            >
              {availableSuppliers.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={() => loadSupplierData(activeSupplier)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition"
              title="Refresh Supplier Data"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-amber-50/60 border border-amber-200/80 p-3.5 rounded-lg">
            <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider flex items-center gap-1">
              <Clock size={12} /> Pending Orders
            </span>
            <div className="text-2xl font-black text-amber-900 mt-1">{pendingOrders.length}</div>
            <span className="text-[10px] text-amber-600 font-medium">Awaiting delivery / receipt</span>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200/80 p-3.5 rounded-lg">
            <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1">
              <PackageCheck size={12} /> Received & Stocked
            </span>
            <div className="text-2xl font-black text-emerald-900 mt-1">{fulfilledOrders.length}</div>
            <span className="text-[10px] text-emerald-600 font-medium">Restocked to store shelves</span>
          </div>

          <div className="bg-blue-50/60 border border-blue-200/80 p-3.5 rounded-lg">
            <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider flex items-center gap-1">
              <Boxes size={12} /> Supplied Items
            </span>
            <div className="text-2xl font-black text-blue-900 mt-1">{catalog.length}</div>
            <span className="text-[10px] text-blue-600 font-medium">Catalog product lines</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Total Order Volume
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">{formatGHS(totalSpend)}</div>
            <span className="text-[10px] text-slate-500 font-medium">Cumulative purchase spend</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-sm shadow-2xs overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'pending'
              ? 'border-blue-600 text-blue-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock size={15} />
          Pending Orders ({pendingOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PackageCheck size={15} />
          Order History ({fulfilledOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('workflow')}
          className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'workflow'
              ? 'border-blue-600 text-blue-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare size={15} />
          Supplier-Owner Workflow ({interactions.length})
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'catalog'
              ? 'border-blue-600 text-blue-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes size={15} />
          Supplied Products ({catalog.length})
        </button>
      </div>

      {/* TAB 1: PENDING ORDERS */}
      {activeTab === 'pending' && (
        <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Pending Purchase Orders for {activeSupplier}
              </h2>
              <p className="text-[11px] text-slate-500">
                Confirm receipt when items have been delivered to restock warehouse shelves
              </p>
            </div>
            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
              {pendingOrders.length} Pending
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
              Loading pending purchase orders...
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-bold text-slate-700">All purchase orders are fulfilled!</p>
              <p className="text-xs text-slate-500 mt-1">No pending deliveries from this supplier at this time.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-400">
                  <tr>
                    <th className="px-5 py-3">PO Number</th>
                    <th className="px-5 py-3">Date Ordered</th>
                    <th className="px-5 py-3">Expected Date</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Total Value</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {pendingOrders.map(po => (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5 font-black text-slate-900">#PO-{po.id}</td>
                      <td className="px-5 py-3.5 text-slate-500 font-medium">
                        {new Date(po.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-semibold">
                        {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : 'Standard Delivery'}
                      </td>
                      <td className="px-5 py-3.5">{getStatusBadge(po.status)}</td>
                      <td className="px-5 py-3.5 font-black text-red-600">{formatGHS(po.total_amount)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleConfirmReceipt(po.id)}
                            disabled={updatingPoId === po.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            {updatingPoId === po.id ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}
                            <span>Confirm Receipt</span>
                          </button>
                          <button
                            onClick={() => handleViewDetail(po.id)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                            title="View Items in PO"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ORDER HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Fulfilled Purchase History
              </h2>
              <p className="text-[11px] text-slate-500">
                Receipt-confirmed deliveries and stock fulfillment records for {activeSupplier}
              </p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
              {fulfilledOrders.length} Received
            </span>
          </div>

          {fulfilledOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs font-medium">
              No historical received orders recorded yet for this supplier.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-400">
                  <tr>
                    <th className="px-5 py-3">PO Number</th>
                    <th className="px-5 py-3">Order Date</th>
                    <th className="px-5 py-3">Received At</th>
                    <th className="px-5 py-3">Confirmed By</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {fulfilledOrders.map(po => (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5 font-black text-slate-900">#PO-{po.id}</td>
                      <td className="px-5 py-3.5 text-slate-500 font-medium">
                        {new Date(po.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium">
                        {po.received_at ? new Date(po.received_at).toLocaleDateString() : 'Received'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-bold">
                        {po.confirmed_by || po.user_name || 'Admin'}
                      </td>
                      <td className="px-5 py-3.5">{getStatusBadge(po.status)}</td>
                      <td className="px-5 py-3.5 font-black text-slate-900">{formatGHS(po.total_amount)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleViewDetail(po.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs inline-flex items-center gap-1 transition"
                        >
                          <Eye size={13} /> View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WORKFLOW & COMMUNICATION */}
      {activeTab === 'workflow' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Post Message / Dispatch Update Form */}
          <div className="bg-white border border-slate-200 p-5 rounded-sm shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <MessageSquare size={18} className="text-blue-600" />
              <div>
                <h3 className="text-sm font-black text-slate-900">Supplier & Shop Communication</h3>
                <p className="text-[11px] text-slate-500">Post dispatch notes, tracking numbers & restock updates</p>
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Update Category
                </label>
                <select
                  value={messageType}
                  onChange={e => setMessageType(e.target.value as any)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="dispatch">🚚 Dispatch / Shipment Alert</option>
                  <option value="note">📝 Delivery Instruction / Note</option>
                  <option value="inquiry">❓ Restock Inquiry / Status Request</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Related Purchase Order (Optional)
                </label>
                <select
                  value={relatedPoId}
                  onChange={e => setRelatedPoId(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">General Supplier Communication</option>
                  {purchases.map(p => (
                    <option key={p.id} value={p.id}>
                      #PO-{p.id} ({p.status.toUpperCase()} - {formatGHS(p.total_amount)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Message Content / Tracking Details
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Shipment #WAYBILL-8902 dispatched via delivery van. Expected delivery tomorrow morning..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={sendingMessage || !newMessage.trim()}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {sendingMessage ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                Send to Workflow Thread
              </button>
            </form>
          </div>

          {/* Interaction Thread Log */}
          <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-sm shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Workflow Timeline & Messages</h3>
                <p className="text-[11px] text-slate-500">Live conversation and automatic delivery audit trail</p>
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                {interactions.length} Events
              </span>
            </div>

            {interactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs font-medium">
                No interaction logs recorded yet for this supplier. Post a message to initiate workflow.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {interactions.map(item => {
                  const isSupplierSender = item.sender_role === 'supplier';
                  const isConfirmation = item.message_type === 'receipt_confirmation';

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-lg border text-xs transition ${
                        isConfirmation
                          ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
                          : isSupplierSender
                          ? 'bg-blue-50/60 border-blue-200/70 text-blue-950'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">{item.sender_name}</span>
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-black uppercase rounded ${
                              isSupplierSender
                                ? 'bg-blue-200 text-blue-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {item.sender_role}
                          </span>
                          {item.po_id && (
                            <span className="px-1.5 py-0.5 bg-white border border-slate-300 text-[9px] font-bold rounded">
                              #PO-{item.po_id}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="font-medium leading-relaxed">{item.message}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SUPPLIED PRODUCTS CATALOG */}
      {activeTab === 'catalog' && (
        <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Products Supplied by {activeSupplier}
              </h2>
              <p className="text-[11px] text-slate-500">
                Live inventory levels, cost pricing and stock status for items supplied by this vendor
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search catalog..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full border border-slate-300 rounded pl-9 pr-3 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3">Product Name</th>
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Cost Price</th>
                  <th className="px-5 py-3">Selling Price</th>
                  <th className="px-5 py-3">Current Stock</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {catalog
                  .filter(
                    p =>
                      !searchQuery ||
                      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5 font-bold text-slate-900">{p.name}</td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">{p.sku}</td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">{p.category}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-700">{formatGHS(p.cost_price)}</td>
                      <td className="px-5 py-3.5 font-bold text-emerald-700">{formatGHS(p.price)}</td>
                      <td className="px-5 py-3.5 font-black text-slate-900">{p.stock_quantity} units</td>
                      <td className="px-5 py-3.5">
                        {p.stock_quantity <= 5 ? (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase rounded">
                            Restock Required
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase rounded">
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PO Detail Modal */}
      {selectedPO && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Purchase Order Details</h3>
                <span className="text-xs text-slate-400">
                  Order ID: #PO-{selectedPO.id} &bull; Ordered on {new Date(selectedPO.created_at).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedPO(null)}
                className="text-slate-400 hover:text-slate-600 p-1 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-3 rounded border border-slate-200/60 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Supplier</span>
                <span className="font-bold text-slate-800">{selectedPO.supplier_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                <div className="mt-1">{getStatusBadge(selectedPO.status)}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Purchaser</span>
                <span className="font-bold text-slate-800">{selectedPO.user_name || 'Admin'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Expected Delivery</span>
                <span className="font-bold text-slate-800">
                  {selectedPO.expected_date ? new Date(selectedPO.expected_date).toLocaleDateString() : 'Immediate'}
                </span>
              </div>
            </div>

            {selectedPO.notes && (
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded text-xs text-slate-700">
                <span className="font-bold text-blue-900 block mb-0.5">PO Instructions:</span>
                {selectedPO.notes}
              </div>
            )}

            <div>
              <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider mb-2">Order Line Items</h4>
              <table className="min-w-full divide-y divide-slate-100 text-xs border border-slate-100 rounded overflow-hidden">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPO.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-bold text-slate-900">
                        {item.product_name} <span className="text-[10px] font-mono text-slate-400">({item.sku})</span>
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-slate-800">{item.quantity}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatGHS(item.unit_price)}</td>
                      <td className="px-3 py-2 text-right font-black text-slate-900">
                        {formatGHS(item.quantity * item.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Amount</span>
                <span className="text-base font-black text-red-600">{formatGHS(selectedPO.total_amount)}</span>
              </div>

              <div className="flex items-center gap-2">
                {selectedPO.status !== 'received' && selectedPO.status !== 'cancelled' ? (
                  <button
                    onClick={() => handleConfirmReceipt(selectedPO.id)}
                    disabled={updatingPoId === selectedPO.id}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {updatingPoId === selectedPO.id ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    Confirm Receipt & Fulfill Stock
                  </button>
                ) : selectedPO.status === 'received' ? (
                  <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    Receipt Confirmed & Stock Fulfilled
                  </span>
                ) : null}

                <button
                  onClick={() => setSelectedPO(null)}
                  className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
