import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { 
  Truck, Plus, Search, Filter, Calendar, Clock, CheckCircle2, 
  AlertCircle, ChevronRight, FileText, Download, X, Eye, ArrowUpRight,
  PackageCheck, RefreshCw, AlertTriangle, Zap
} from 'lucide-react';
import { formatGHS } from '../lib/formatters';
import { useNotifications } from '../context/NotificationContext';

interface PurchaseOrderItem {
  product_id: number;
  product_name?: string;
  sku?: string;
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
  created_at: string;
  item_count?: number;
  total_units?: number;
}

export default function Purchases() {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAutoDraft, setIsAutoDraft] = useState(false);

  // New PO Modal state
  const [showModal, setShowModal] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [poStatus, setPoStatus] = useState<'draft' | 'ordered' | 'received'>('ordered');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<PurchaseOrderItem[]>([]);
  const [creating, setCreating] = useState(false);

  // PO Detail Drawer state
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const { addToast, refreshNotifications } = useNotifications();

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, sRes, prRes] = await Promise.all([
        fetchApi('/purchases'),
        fetchApi('/suppliers'),
        fetchApi('/products')
      ]);
      const fetchedPurchases = pRes || [];
      const fetchedSuppliers = sRes || [];
      const fetchedProducts = prRes || [];

      setPurchases(fetchedPurchases);
      setSuppliers(fetchedSuppliers);
      setProducts(fetchedProducts);

      // Check for quick reorder parameter
      const reorderParam = searchParams.get('reorder');
      if (reorderParam) {
        let itemsToReorder: any[] = [];
        if (reorderParam === 'all') {
          itemsToReorder = fetchedProducts.filter((p: any) => p.stock_quantity <= (p.min_stock_level || 10));
        } else {
          const targetId = parseInt(reorderParam, 10);
          if (!isNaN(targetId)) {
            const found = fetchedProducts.find((p: any) => p.id === targetId);
            if (found) itemsToReorder = [found];
          } else {
            // search by SKU or name
            itemsToReorder = fetchedProducts.filter((p: any) => 
              p.sku?.toLowerCase() === reorderParam.toLowerCase() ||
              p.name?.toLowerCase().includes(reorderParam.toLowerCase())
            );
          }
        }

        if (itemsToReorder.length > 0) {
          const draftCart: PurchaseOrderItem[] = itemsToReorder.map((p: any) => {
            const targetQty = Math.max(20, (p.min_stock_level || 10) * 2 - Math.max(0, p.stock_quantity));
            return {
              product_id: p.id,
              product_name: p.name,
              sku: p.sku,
              quantity: targetQty,
              unit_price: p.cost_price || 0
            };
          });

          setCart(draftCart);
          if (fetchedSuppliers.length > 0) {
            setSelectedSupplier(fetchedSuppliers[0].name);
          }
          setPoStatus('draft');
          setIsAutoDraft(true);
          setShowModal(true);
          setNotes(`Quick Reorder Draft generated from Low Stock Alert (${itemsToReorder.map((i: any) => i.sku || i.name).join(', ')})`);

          addToast({
            title: 'Draft PO Auto-Populated! ⚡',
            message: `Created Purchase Order draft with ${draftCart.length} low-stock item(s).`,
            type: 'warning'
          });

          // Clean search param
          setSearchParams({}, { replace: true });
        }
      }
    } catch (err) {
      console.error('Failed to load purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePO = async () => {
    if (cart.length === 0 || !selectedSupplier) {
      alert("Please select a supplier and add at least one product.");
      return;
    }
    setCreating(true);
    const supp = suppliers.find(s => s.name === selectedSupplier);
    try {
      await fetchApi('/purchases', {
        method: 'POST',
        body: JSON.stringify({ 
          supplier_name: selectedSupplier, 
          supplier_contact: supp ? supp.contact_person || supp.phone : '',
          status: poStatus,
          expected_date: expectedDate || null,
          notes: notes || null,
          items: cart 
        })
      });

      setShowModal(false);
      setCart([]);
      setSelectedSupplier('');
      setNotes('');
      setExpectedDate('');

      addToast({
        title: 'Purchase Order Created',
        message: `Purchase Order for ${selectedSupplier} created successfully!`,
        type: 'success'
      });

      await loadData();
      await refreshNotifications();
    } catch (err: any) {
      alert(err.message || 'Failed to create Purchase Order');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (poId: number, newStatus: string) => {
    try {
      await fetchApi(`/purchases/${poId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });

      setPurchases(prev => prev.map(p => p.id === poId ? { ...p, status: newStatus as any } : p));
      if (selectedPO && selectedPO.id === poId) {
        setSelectedPO({ ...selectedPO, status: newStatus });
      }

      addToast({
        title: 'PO Status Changed',
        message: `PO #PO-${poId} status updated to ${newStatus.toUpperCase()}`,
        type: newStatus === 'received' ? 'success' : newStatus === 'cancelled' ? 'danger' : 'info'
      });

      loadData();
      refreshNotifications();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleViewDetail = async (poId: number) => {
    setLoadingDetail(true);
    try {
      const poData = await fetchApi(`/purchases/${poId}`);
      setSelectedPO(poData);
    } catch (err: any) {
      alert(err.message || 'Failed to load PO details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { 
        product_id: product.id, 
        product_name: product.name,
        sku: product.sku,
        quantity: 1, 
        unit_price: product.cost_price 
      }];
    });
  };

  const updateCartQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.product_id !== productId));
    } else {
      setCart(prev => prev.map(i => i.product_id === productId ? { ...i, quantity: qty } : i));
    }
  };

  const updateCartUnitPrice = (productId: number, price: number) => {
    setCart(prev => prev.map(i => i.product_id === productId ? { ...i, unit_price: Math.max(0, price) } : i));
  };

  const handleExportCSV = () => {
    if (purchases.length === 0) return;
    const headers = ['PO ID', 'Date', 'Supplier', 'Status', 'Items', 'Total Cost'];
    const csvRows = [headers.join(',')];

    for (const p of purchases) {
      const row = [
        `PO-${p.id}`,
        `"${new Date(p.created_at).toLocaleString()}"`,
        `"${p.supplier_name}"`,
        `"${p.status}"`,
        `"${p.item_count || 1}"`,
        `"${formatGHS(p.total_amount)}"`
      ];
      csvRows.push(row.join(','));
    }

    const csvStr = csvRows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `purchase_orders_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredPurchases = purchases.filter(p => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch = !searchQuery || 
      `PO-${p.id}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplier_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase rounded-full inline-flex items-center gap-1"><CheckCircle2 size={11} /> Received</span>;
      case 'ordered':
      case 'submitted':
        return <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black uppercase rounded-full inline-flex items-center gap-1"><Truck size={11} /> Ordered</span>;
      case 'draft':
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-black uppercase rounded-full inline-flex items-center gap-1"><Clock size={11} /> Draft</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 text-[10px] font-black uppercase rounded-full inline-flex items-center gap-1"><AlertCircle size={11} /> Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-full">{status}</span>;
    }
  };

  // Stats calculation
  const totalCost = purchases.reduce((s, p) => s + p.total_amount, 0);
  const pendingOrders = purchases.filter(p => p.status === 'ordered' || p.status === 'submitted').length;
  const receivedOrders = purchases.filter(p => p.status === 'received').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded shrink-0">
            <Truck size={22} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Purchase Order Tracking & Restocking</h1>
            <p className="text-[12px] text-slate-500 font-medium">Manage supplier procurement, order status updates, and stock fulfillment alerts</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowModal(true)} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs shadow-2xs transition flex items-center gap-1.5"
          >
            <Plus size={15} /> Create Purchase Order
          </button>
          <button 
            onClick={handleExportCSV} 
            disabled={purchases.length === 0} 
            className="px-4 py-2 bg-slate-800 text-white rounded font-bold text-xs hover:bg-slate-900 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total PO Volume</span>
            <div className="text-xl font-black text-slate-900 mt-0.5">{purchases.length} Orders</div>
          </div>
          <FileText size={24} className="text-blue-500 opacity-80" />
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pending Orders</span>
            <div className="text-xl font-black text-blue-600 mt-0.5">{pendingOrders} Active</div>
          </div>
          <Truck size={24} className="text-blue-500 opacity-80" />
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Fulfilled Orders</span>
            <div className="text-xl font-black text-emerald-600 mt-0.5">{receivedOrders} Received</div>
          </div>
          <PackageCheck size={24} className="text-emerald-500 opacity-80" />
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Investment</span>
            <div className="text-lg font-black text-red-600 mt-0.5">{formatGHS(totalCost)}</div>
          </div>
          <span className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold uppercase rounded">Expenditure</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'ordered', 'received', 'draft', 'cancelled'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition ${statusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Search PO # or supplier..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full border border-slate-300 rounded pl-9 pr-3 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* PO Table */}
      <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <p className="text-xs font-bold">Loading Purchase Orders...</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">PO Number</th>
                <th className="px-5 py-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">Supplier</th>
                <th className="px-5 py-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">Total Cost</th>
                <th className="px-5 py-3 text-right text-[11px] font-black text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredPurchases.length > 0 ? (
                filteredPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-black text-slate-900">
                      #PO-{p.id}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 font-medium">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-800 font-bold">
                      {p.supplier_name}
                      {p.supplier_contact && <span className="block text-[10px] text-slate-400 font-normal">{p.supplier_contact}</span>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {getStatusBadge(p.status)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-extrabold text-red-600">
                      {formatGHS(p.total_amount)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right text-xs">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={p.status}
                          onChange={e => handleStatusChange(p.id, e.target.value)}
                          className="border border-slate-300 rounded px-2 py-1 text-[11px] font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="draft">Draft</option>
                          <option value="ordered">Ordered</option>
                          <option value="received">Received (Fulfill)</option>
                          <option value="cancelled">Cancelled</option>
                        </select>

                        <button
                          onClick={() => handleViewDetail(p.id)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 text-xs font-medium">
                    No purchase orders matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* New Purchase Order Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md max-w-4xl w-full flex flex-col md:flex-row overflow-hidden max-h-[90vh] border border-slate-200 shadow-2xl">
            {/* Left: Product Selection */}
            <div className="w-full md:w-1/2 flex flex-col border-r border-slate-200 bg-slate-50/50">
              <div className="px-5 py-3.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                <span>Select Products to Restock</span>
                <span className="text-[10px] text-slate-400">{products.length} Items Available</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[450px]">
                {products.map(p => (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="p-3 bg-white border border-slate-200 rounded hover:border-blue-500 hover:shadow-2xs transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{p.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>SKU: {p.sku}</span>
                        <span>Stock: <strong className={p.stock_quantity <= 5 ? 'text-red-600' : 'text-slate-700'}>{p.stock_quantity}</strong></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-slate-900">{formatGHS(p.cost_price)}</div>
                      <span className="text-[10px] font-bold text-blue-600 hover:underline">+ Add</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: PO Form & Cart */}
            <div className="w-full md:w-1/2 flex flex-col bg-white">
              <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                <span className="font-black text-xs uppercase tracking-wider text-slate-900">New Purchase Order</span>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[400px]">
                {/* Supplier & Status Form */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Supplier</label>
                    <select 
                      value={selectedSupplier} 
                      onChange={e => setSelectedSupplier(e.target.value)} 
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Initial Status</label>
                    <select 
                      value={poStatus} 
                      onChange={e => setPoStatus(e.target.value as any)} 
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="draft">Draft (Save only)</option>
                      <option value="ordered">Ordered (Notify Managers)</option>
                      <option value="received">Received (Fulfill Stock Immediately)</option>
                    </select>
                  </div>
                </div>

                {/* Items in Cart */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Selected Order Items</label>
                  {cart.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded text-slate-400">
                      <Truck size={28} className="mx-auto mb-1 opacity-40" />
                      <p className="text-xs font-medium">Click products on the left to add items</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cart.map((item) => (
                        <div key={item.product_id} className="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between gap-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900 truncate">{item.product_name}</div>
                            <div className="text-[10px] text-slate-400">{item.sku}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => updateCartQuantity(item.product_id, parseInt(e.target.value, 10) || 1)}
                              className="w-14 border border-slate-300 rounded px-1.5 py-1 text-center font-bold text-xs"
                            />
                            <span className="font-extrabold text-slate-900 min-w-[70px] text-right">
                              {formatGHS(item.quantity * item.unit_price)}
                            </span>
                            <button onClick={() => updateCartQuantity(item.product_id, 0)} className="text-slate-300 hover:text-red-600">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Cost</span>
                  <span className="text-lg font-black text-red-600">
                    {formatGHS(cart.reduce((s, i) => s + (i.quantity * i.unit_price), 0))}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
                  <button onClick={handleCreatePO} disabled={creating || cart.length === 0 || !selectedSupplier} className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded disabled:opacity-50 flex items-center gap-1.5">
                    {creating && <RefreshCw size={12} className="animate-spin" />}
                    {creating ? 'Recording...' : 'Submit Purchase Order'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PO Detail Modal */}
      {selectedPO && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Purchase Order #PO-{selectedPO.id}</h3>
                <p className="text-[11px] text-slate-500 font-medium">Created on {new Date(selectedPO.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedPO(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Supplier</span>
                <span className="font-bold text-slate-900">{selectedPO.supplier_name}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Status</span>
                {getStatusBadge(selectedPO.status)}
              </div>
            </div>

            {/* Items table */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2">Itemized Order Breakdown</h4>
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-100 font-bold text-slate-500">
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
                      <td className="px-3 py-2 font-bold text-slate-900">{item.product_name} <span className="text-[10px] font-mono text-slate-400">({item.sku})</span></td>
                      <td className="px-3 py-2 text-center font-bold text-slate-800">{item.quantity}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatGHS(item.unit_price)}</td>
                      <td className="px-3 py-2 text-right font-black text-slate-900">{formatGHS(item.quantity * item.unit_price)}</td>
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

              <button onClick={() => setSelectedPO(null)} className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded hover:bg-slate-800">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
