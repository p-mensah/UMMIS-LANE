import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { 
  Truck, Plus, Search, Filter, Calendar, Clock, CheckCircle2, 
  AlertCircle, ChevronRight, FileText, Download, X, Eye, ArrowUpRight,
  PackageCheck, RefreshCw, AlertTriangle, Printer
} from 'lucide-react';
import { formatGHS } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import RowActionMenu from '../components/common/RowActionMenu';
import Pagination from '../components/common/Pagination';

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
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
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
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const { addToast, confirmModal, refreshNotifications } = useNotifications();
  useModalDismiss(showModal, () => setShowModal(false));
  useModalDismiss(!!selectedPO, () => setSelectedPO(null));

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
      addToast('Please select a supplier and add at least one product.', 'warning');
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
      addToast(err.message || 'Failed to create Purchase Order', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (poId: number, newStatus: string) => {
    setUpdatingId(poId);
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
        message: `PO #PO-${poId} status updated to ${newStatus.toUpperCase()}${newStatus === 'received' ? ' and inventory restocked!' : ''}`,
        type: newStatus === 'received' ? 'success' : newStatus === 'cancelled' ? 'danger' : 'info'
      });

      await loadData();
      await refreshNotifications();
    } catch (err: any) {
      addToast(err.message || 'Failed to update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmReceipt = async (poId: number) => {
    const confirmed = await confirmModal({
      title: 'Confirm Goods Receipt',
      message: `Confirm receipt of Purchase Order #PO-${poId}? This will restock all line items into inventory.`,
      confirmText: 'Confirm & Restock',
      type: 'success'
    });
    if (!confirmed) return;

    setUpdatingId(poId);
    try {
      await fetchApi(`/purchases/${poId}/confirm-receipt`, {
        method: 'POST'
      });

      setPurchases(prev => prev.map(p => p.id === poId ? { ...p, status: 'received' } : p));
      if (selectedPO && selectedPO.id === poId) {
        setSelectedPO({ ...selectedPO, status: 'received' });
      }

      addToast({
        title: 'Receipt Confirmed! 📦',
        message: `PO #PO-${poId} marked as RECEIVED. Items have been added to inventory stock.`,
        type: 'success'
      });

      await loadData();
      await refreshNotifications();
    } catch (err: any) {
      addToast(err.message || 'Failed to confirm receipt', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleViewDetail = async (poId: number) => {
    setLoadingDetail(true);
    try {
      const poData = await fetchApi(`/purchases/${poId}`);
      setSelectedPO(poData);
    } catch (err: any) {
      addToast(err.message || 'Failed to load PO details', 'error');
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
    addToast(`Exported ${purchases.length} purchase orders to CSV.`, 'success');
  };

  const handlePrintReport = () => {
    if (filteredPurchases.length === 0) {
      addToast('No purchase orders match current filters to print or export as PDF.', 'warning');
      return;
    }
    window.print();
  };

  const filteredPurchases = purchases.filter(p => {
    let matchesStatus = true;
    if (statusFilter === 'pending') {
      matchesStatus = p.status === 'ordered' || p.status === 'pending' || p.status === 'submitted' || p.status === 'dispatched';
    } else if (statusFilter !== 'all') {
      matchesStatus = p.status === statusFilter;
    }
    const matchesSearch = !searchQuery || 
      `PO-${p.id}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplier_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.ceil(filteredPurchases.length / pageSize) || 1;
  const paginatedPurchases = filteredPurchases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return (
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-black uppercase rounded-full inline-flex items-center gap-1.5 shadow-2xs">
            <CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Received
          </span>
        );
      case 'ordered':
      case 'submitted':
      case 'pending':
        return (
          <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-black uppercase rounded-full inline-flex items-center gap-1.5 shadow-2xs">
            <Clock size={12} className="text-amber-600 shrink-0" /> Pending Delivery
          </span>
        );
      case 'dispatched':
        return (
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 border border-indigo-300 text-[11px] font-black uppercase rounded-full inline-flex items-center gap-1.5 shadow-2xs">
            <Truck size={12} className="text-indigo-600 shrink-0" /> Dispatched
          </span>
        );
      case 'draft':
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-bold uppercase rounded-full inline-flex items-center gap-1.5">
            <Clock size={12} className="text-slate-500 shrink-0" /> Draft
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-300 text-[11px] font-black uppercase rounded-full inline-flex items-center gap-1.5 shadow-2xs">
            <AlertCircle size={12} className="text-rose-600 shrink-0" /> Cancelled
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

  // Stats calculation
  const totalCost = purchases.reduce((s, p) => s + p.total_amount, 0);
  const pendingOrders = purchases.filter(p => p.status === 'ordered' || p.status === 'submitted').length;
  const receivedOrders = purchases.filter(p => p.status === 'received').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
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
          {user?.role === 'admin' && (
            <button 
              type="button"
              onClick={() => setShowModal(true)} 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} /> Create Purchase Order
            </button>
          )}
          <button 
            type="button"
            id="export-purchases-csv-btn"
            onClick={handleExportCSV} 
            disabled={purchases.length === 0} 
            className="px-4 py-2 bg-slate-800 text-white rounded font-bold text-xs hover:bg-slate-900 transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            title="Export purchase records to CSV"
          >
            <Download size={14} /> Export CSV
          </button>
          <button 
            type="button"
            id="print-purchases-report-btn"
            onClick={handlePrintReport} 
            disabled={filteredPurchases.length === 0} 
            className="px-4 py-2 bg-slate-900 text-white rounded font-bold text-xs hover:bg-slate-800 transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Print or export current purchase report to PDF"
          >
            <Printer size={14} /> Print / Export PDF ({filteredPurchases.length})
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 no-print">
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
      <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'pending', 'received', 'draft', 'cancelled'].map(st => (
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
      <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden no-print">
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
              {paginatedPurchases.length > 0 ? (
                paginatedPurchases.map(p => (
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
                      <div className="flex items-center justify-end">
                        <RowActionMenu
                          triggerTitle={`Actions for PO #${p.id}`}
                          actions={[
                            {
                              label: 'View Order Details',
                              sublabel: 'Consignment items & breakdown',
                              icon: <Eye size={14} />,
                              onClick: () => handleViewDetail(p.id),
                            },
                            p.status !== 'received' && p.status !== 'cancelled' ? {
                              label: 'Confirm Receipt & Restock',
                              sublabel: 'Verify delivery into inventory',
                              icon: <CheckCircle2 size={14} className="text-emerald-600" />,
                              onClick: () => handleConfirmReceipt(p.id),
                            } : null,
                            p.status !== 'ordered' && p.status !== 'received' ? {
                              label: 'Mark as Pending (Ordered)',
                              icon: <Clock size={14} className="text-amber-500" />,
                              onClick: () => handleStatusChange(p.id, 'ordered'),
                            } : null,
                            p.status !== 'draft' && p.status !== 'received' ? {
                              label: 'Mark as Draft',
                              icon: <FileText size={14} className="text-slate-500" />,
                              onClick: () => handleStatusChange(p.id, 'draft'),
                            } : null,
                            p.status !== 'cancelled' && p.status !== 'received' ? {
                              label: 'Cancel Purchase Order',
                              destructive: true,
                              icon: <X size={14} />,
                              onClick: () => handleStatusChange(p.id, 'cancelled'),
                            } : null,
                          ]}
                        />
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

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredPurchases.length}
          pageSize={pageSize}
        />
      </div>

      {/* ================= FORMAL PRINT/PDF PROCUREMENT REPORT ================= */}
      <div className="print-only p-4 sm:p-6 text-black bg-white">
        {/* Official Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded bg-slate-900 text-white font-black text-sm flex items-center justify-center">
                Rx
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">RxIMS Pharmacy Management</h1>
            </div>
            <p className="text-xs text-slate-600 font-medium">Procurement, Supplier Orders & Restocking Audit</p>
            <p className="text-[10px] text-slate-500">Accra, Ghana • Tel: +233 24 000 0000 • Email: procurement@rximspharmacy.com</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-2.5 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider rounded">
              Procurement Audit
            </span>
            <div className="text-[11px] text-slate-600 font-bold mt-1.5">
              Generated: {new Date().toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500">
              Prepared by: <span className="font-bold text-slate-800">{user?.name}</span> ({user?.role})
            </div>
          </div>
        </div>

        {/* Report Scope & Filter Metadata */}
        <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Status Filter</span>
            <span className="font-bold text-slate-800 capitalize">{statusFilter}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Search Criteria</span>
            <span className="font-bold text-slate-800">{searchQuery || 'All Suppliers / POs'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Purchase Orders Count</span>
            <span className="font-black text-blue-700">{filteredPurchases.length} record(s)</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Expenditure</span>
            <span className="font-black text-red-600">
              {formatGHS(filteredPurchases.reduce((s, p) => s + p.total_amount, 0))}
            </span>
          </div>
        </div>

        {/* Executive Summary Metrics Grid */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="border border-slate-300 p-2.5 rounded bg-white">
            <div className="text-[9px] font-bold uppercase text-slate-500">Total Purchase Orders</div>
            <div className="text-base font-black text-slate-900 mt-0.5">{filteredPurchases.length} Orders</div>
          </div>
          <div className="border border-slate-300 p-2.5 rounded bg-white">
            <div className="text-[9px] font-bold uppercase text-slate-500">Pending Deliveries</div>
            <div className="text-base font-black text-amber-700 mt-0.5">
              {filteredPurchases.filter(p => p.status === 'ordered' || p.status === 'submitted' || p.status === 'pending').length}
            </div>
          </div>
          <div className="border border-slate-300 p-2.5 rounded bg-white">
            <div className="text-[9px] font-bold uppercase text-slate-500">Received & Stocked</div>
            <div className="text-base font-black text-emerald-700 mt-0.5">
              {filteredPurchases.filter(p => p.status === 'received').length}
            </div>
          </div>
          <div className="border border-slate-300 p-2.5 rounded bg-white">
            <div className="text-[9px] font-bold uppercase text-slate-500">Total Investment</div>
            <div className="text-base font-black text-red-700 mt-0.5">
              {formatGHS(filteredPurchases.reduce((s, p) => s + p.total_amount, 0))}
            </div>
          </div>
        </div>

        {/* Tabular Procurement Ledger */}
        <table className="w-full text-left text-xs border border-slate-300 border-collapse mb-6">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300">
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase border-r border-slate-200">PO Number</th>
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase border-r border-slate-200">Date</th>
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase border-r border-slate-200">Supplier Name</th>
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase border-r border-slate-200">Contact</th>
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase border-r border-slate-200">Status</th>
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase border-r border-slate-200 text-center">Items</th>
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase text-right">Total Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredPurchases.map((p, idx) => (
              <tr key={p.id} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                <td className="py-2 px-2.5 font-mono font-bold text-slate-900 border-r border-slate-200">
                  #PO-{p.id}
                </td>
                <td className="py-2 px-2.5 text-slate-600 border-r border-slate-200 whitespace-nowrap">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
                <td className="py-2 px-2.5 font-bold text-slate-900 border-r border-slate-200">
                  {p.supplier_name}
                </td>
                <td className="py-2 px-2.5 text-slate-500 border-r border-slate-200">
                  {p.supplier_contact || '—'}
                </td>
                <td className="py-2 px-2.5 border-r border-slate-200">
                  <span className="font-bold uppercase text-[10px]">
                    {p.status}
                  </span>
                </td>
                <td className="py-2 px-2.5 text-center text-slate-700 border-r border-slate-200">
                  {p.item_count || 1}
                </td>
                <td className="py-2 px-2.5 font-black text-slate-900 text-right whitespace-nowrap">
                  {formatGHS(p.total_amount)}
                </td>
              </tr>
            ))}
            {/* Grand Total Row */}
            <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
              <td colSpan={6} className="py-2.5 px-3 text-right uppercase text-[11px] font-black text-slate-800">
                Grand Total ({filteredPurchases.length} Purchase Orders):
              </td>
              <td className="py-2.5 px-2.5 text-right font-black text-red-700 text-xs whitespace-nowrap">
                {formatGHS(filteredPurchases.reduce((s, p) => s + p.total_amount, 0))}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Verification & Sign-off Block */}
        <div className="border-t border-slate-300 pt-6 mt-6 grid grid-cols-2 gap-12 text-xs">
          <div>
            <div className="border-b border-slate-400 pb-1 mb-1 font-semibold text-slate-700">
              Prepared By (Procurement Officer):
            </div>
            <div className="text-[11px] text-slate-500">Name: {user?.name} | Date: {new Date().toLocaleDateString()}</div>
          </div>
          <div>
            <div className="border-b border-slate-400 pb-1 mb-1 font-semibold text-slate-700">
              Approved By (Supervising Pharmacist / Auditor):
            </div>
            <div className="text-[11px] text-slate-500">Signature: __________________________ Date: _______________</div>
          </div>
        </div>

        <div className="text-center text-[10px] text-slate-400 mt-6">
          RxIMS Automated Procurement System • Report Generated Securely • Page End
        </div>
      </div>

      {/* New Purchase Order Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 no-print"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-4xl w-full flex flex-col md:flex-row overflow-hidden max-h-[90vh] border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150">
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
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 no-print"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPO(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
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

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => window.print()} 
                  className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Print this purchase order"
                >
                  <Printer size={14} /> Print Order
                </button>

                {selectedPO.status !== 'received' && selectedPO.status !== 'cancelled' ? (
                  <button
                    onClick={() => handleConfirmReceipt(selectedPO.id)}
                    disabled={updatingId === selectedPO.id}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {updatingId === selectedPO.id ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Confirm Receipt & Fulfill Stock
                  </button>
                ) : selectedPO.status === 'received' ? (
                  <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    Receipt Confirmed & Stock Fulfilled
                  </span>
                ) : null}

                <button onClick={() => setSelectedPO(null)} className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded hover:bg-slate-800">
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
