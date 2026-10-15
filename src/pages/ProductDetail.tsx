import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { useAuth } from '../context/AuthContext';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { 
  ArrowLeft, History, Package, Tag, CreditCard, AlertTriangle, Printer,
  Search, Filter, ShoppingCart, ArrowDownRight, ArrowUpRight, RefreshCw, RotateCcw,
  FileText, Calendar, UserCheck, QrCode, Barcode, X, ChevronRight
} from 'lucide-react';

interface Adjustment {
  id: number;
  reason: string;
  quantity_change: number;
  created_at: string;
  user_name: string;
}

interface PriceHistory {
  id: number;
  old_selling_price: number;
  new_selling_price: number;
  changed_at: string;
}

interface AuditEvent {
  event_type: 'adjustment' | 'sale' | 'restock' | 'refund';
  event_id: number;
  quantity_change: number;
  description: string;
  user_name: string;
  created_at: string;
  unit_price: number;
}

interface ProductDetails {
  id: number;
  name: string;
  sku: string;
  category: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  brand: string;
  unit_of_measure: string;
  barcode?: string;
  image_url?: string;
  adjustments: Adjustment[];
  priceHistory: PriceHistory[];
  auditLogs: AuditEvent[];
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';

  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  
  useModalDismiss(showPrintModal, () => setShowPrintModal(false));
  useModalDismiss(showLabelModal, () => setShowLabelModal(false));

  // Tab & Audit Log filters
  const [activeTab, setActiveTab] = useState<'overview' | 'audit_log' | 'price_history'>('overview');
  const [auditFilter, setAuditFilter] = useState<'all' | 'restock' | 'sale' | 'adjustment' | 'refund'>('all');
  const [auditSearch, setAuditSearch] = useState('');

  useEffect(() => {
    Promise.all([
      fetchApi(`/products/${id}`),
      fetchApi(`/products/${id}/price-history`),
      fetchApi(`/products/${id}/audit-log`)
    ])
      .then(([prod, history, audit]) => {
         setProduct({ ...prod, priceHistory: history, auditLogs: audit });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500 font-bold">Loading product intelligence & audit logs...</div>;
  if (!product) return <div className="p-8 text-center text-red-500 font-bold">Product not found.</div>;

  // Filter audit logs
  const filteredAuditLogs = (product.auditLogs || []).filter(item => {
    // If staff, remove admin or other related roles audit from the staff account. Only staff should see his logged only.
    if (isStaff) {
      const uLower = (item.user_name || '').toLowerCase();
      if (uLower.includes('admin') || uLower.includes('owner') || uLower.includes('mensah') || uLower.includes('superadmin')) {
        return false;
      }
      if (user?.name && !uLower.includes(user.name.toLowerCase())) {
        return false;
      }
    }
    const matchesFilter = auditFilter === 'all' || item.event_type === auditFilter;
    const matchesSearch = auditSearch.trim() === '' || 
      item.description.toLowerCase().includes(auditSearch.toLowerCase()) ||
      item.user_name.toLowerCase().includes(auditSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Calculate audit statistics
  const totalInflow = (product.auditLogs || [])
    .filter(i => i.quantity_change > 0)
    .reduce((sum, i) => sum + i.quantity_change, 0);

  const totalOutflow = (product.auditLogs || [])
    .filter(i => i.quantity_change < 0)
    .reduce((sum, i) => sum + Math.abs(i.quantity_change), 0);

  const netDelta = totalInflow - totalOutflow;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      {/* Structured Breadcrumbs & Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Link to="/" className="hover:text-blue-600 transition">Dashboard</Link>
          <ChevronRight size={13} className="text-slate-400" />
          <Link to="/products" className="hover:text-blue-600 transition">Product Catalog</Link>
          <ChevronRight size={13} className="text-slate-400" />
          <span className="font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-xs">{product.name}</span>
        </nav>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            product.stock_quantity <= 5 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {product.stock_quantity <= 5 ? 'Low Stock Warning' : 'Stock Level Optimal'}
          </span>
          <button
            onClick={() => setShowLabelModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
          >
            <QrCode size={14} /> Print Labels
          </button>
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-2xs transition-colors"
          >
            <Printer size={14} /> Print Sheet
          </button>
        </div>
      </div>

      {/* Main Banner Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-20 h-20 object-cover rounded-sm border border-slate-200" />
            ) : (
              <div className="w-20 h-20 bg-slate-100 rounded-sm border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs">
                NO IMAGE
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-blue-50 text-blue-700 rounded-sm border border-blue-100">
                  {product.category}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-mono text-slate-500 font-bold">SKU: {product.sku}</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">{product.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 mt-2">
                {product.brand && <span>Brand: <strong className="text-slate-800">{product.brand}</strong></span>}
                {product.unit_of_measure && <span>UOM: <strong className="text-slate-800">{product.unit_of_measure}</strong></span>}
                {product.barcode && <span>Barcode: <strong className="text-slate-800 font-mono">{product.barcode}</strong></span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
            <div className="text-right">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selling Price</div>
              <div className="text-2xl font-black text-slate-900">{formatGHS(product.selling_price)}</div>
              <div className="text-[10px] text-slate-400">Cost: {formatGHS(product.cost_price)}</div>
            </div>
            <div className="text-right bg-slate-50 p-3 rounded-sm border border-slate-200 min-w-[120px]">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Stock</div>
              <div className={`text-3xl font-black ${product.stock_quantity <= 5 ? 'text-red-600' : 'text-blue-600'}`}>
                {product.stock_quantity}
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                {product.unit_of_measure || 'Units'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-2 pt-2 rounded-t-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Package size={16} /> Overview & Metrics
        </button>
        <button
          onClick={() => setActiveTab('audit_log')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'audit_log'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <History size={16} /> {isStaff ? 'My Item Log' : 'Complete Audit Log'}
          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-black">
            {filteredAuditLogs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('price_history')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'price_history'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CreditCard size={16} /> Price History
          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-black">
            {product.priceHistory?.length || 0}
          </span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & METRICS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-2xs space-y-6">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <CreditCard size={16} className="text-blue-600" /> Financial & Inventory Valuation
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-sm border border-slate-200">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit Profit Margin</div>
                  <div className="text-xl font-black text-emerald-600">
                    {formatGHS(product.selling_price - product.cost_price)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold mt-1">
                    {Math.round(((product.selling_price - product.cost_price) / product.selling_price) * 100)}% Gross Margin
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-sm border border-slate-200">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Asset Value (Cost)</div>
                  <div className="text-xl font-black text-slate-900">
                    {formatGHS(product.stock_quantity * product.cost_price)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1">
                    At current GHS {product.cost_price} unit cost
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-sm border border-slate-200">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Potential Retail Value</div>
                  <div className="text-xl font-black text-blue-600">
                    {formatGHS(product.stock_quantity * product.selling_price)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1">
                    At full retail price
                  </div>
                </div>
              </div>

              {/* Quick Summary Preview */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-slate-900 uppercase">Audit Log Activity Preview</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {product.auditLogs?.length || 0} total inventory lifecycle events logged for this item.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('audit_log')}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider rounded-sm transition-colors shadow-2xs"
                >
                  View Full Audit Log
                </button>
              </div>
            </div>

            {/* Recent Adjustments Table Preview */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-2xs">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-slate-600" />
                  <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Manual Stock Adjustments History</h2>
                </div>
              </div>
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-wider">Reason</th>
                    <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-wider">Logged By</th>
                    <th className="px-6 py-3 text-right font-black text-slate-400 uppercase tracking-wider">Qty Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {product.adjustments && product.adjustments.length > 0 ? (
                    product.adjustments.map((adj) => (
                      <tr key={adj.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3.5 text-slate-500 font-mono">
                          {new Date(adj.created_at + (adj.created_at.endsWith('Z') ? '' : 'Z')).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5 font-bold text-slate-800">{adj.reason}</td>
                        <td className="px-6 py-3.5 text-slate-600">{adj.user_name || 'System'}</td>
                        <td className={`px-6 py-3.5 text-right font-black ${adj.quantity_change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">No manual adjustments recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-6">
            <div className="bg-slate-900 text-white rounded-sm p-6 shadow-md border border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">Product Actions</h3>
              </div>
              <p className="text-[12px] text-slate-300 mb-5 leading-relaxed">
                Update stock counts, re-label barcode prices, or modify product taxonomy parameters.
              </p>
              {user?.role === 'admin' ? (
                <button 
                  onClick={() => navigate('/products')}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-black text-[11px] uppercase tracking-wider transition-colors shadow-2xs mb-2.5"
                >
                  Edit Catalog Entry
                </button>
              ) : (
                <button 
                  onClick={() => navigate('/sales')}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-black text-[11px] uppercase tracking-wider transition-colors shadow-2xs mb-2.5 flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={14} /> Open in POS Terminal
                </button>
              )}
              <button 
                onClick={() => setShowLabelModal(true)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-black text-[11px] uppercase tracking-wider transition-colors shadow-2xs mb-2.5 flex items-center justify-center gap-2"
              >
                <QrCode size={14} /> Print QR / Barcode Labels
              </button>
              <button 
                onClick={() => setShowPrintModal(true)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-sm font-bold text-[11px] uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={14} /> Print Product Sheet
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-5 shadow-2xs space-y-3">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Inventory Lifecycle Principles</h4>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                  <span>Every POS sale automatically records an item outflow in the audit log.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                  <span>Restocking entries automatically attribute suppliers and purchase orders.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                  <span>All manual adjustments are permanently audit-stamped for security compliance.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOG (COMPLETE HISTORICAL LIFE CYCLE) */}
      {activeTab === 'audit_log' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Audit Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">
                <span>Total Inflow (+ Stock)</span>
                <ArrowDownRight size={16} className="text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-600">+{totalInflow}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">From restocks & positive adjustments</div>
            </div>

            <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">
                <span>Total Outflow (- Stock)</span>
                <ArrowUpRight size={16} className="text-red-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">-{totalOutflow}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">From sales & damage write-offs</div>
            </div>

            <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">
                <span>Net Inventory Delta</span>
                <RefreshCw size={16} className="text-blue-500" />
              </div>
              <div className={`text-2xl font-black ${netDelta >= 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                {netDelta >= 0 ? `+${netDelta}` : netDelta}
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">Cumulative stock movement balance</div>
            </div>

            <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">
                <span>Total Logged Events</span>
                <History size={16} className="text-purple-500" />
              </div>
              <div className="text-2xl font-black text-purple-700">{product.auditLogs?.length || 0}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">Audit timeline entries</div>
            </div>
          </div>

          {/* Audit Search and Filters Toolbar */}
          <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search description, staff, reference..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-sm text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Event Type:</span>
              {(['all', 'restock', 'sale', 'adjustment', 'refund'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setAuditFilter(type)}
                  className={`px-3 py-1.5 rounded-sm text-[11px] font-black uppercase tracking-wider transition-all ${
                    auditFilter === type
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {type === 'all' ? 'All Events' : type}
                </button>
              ))}
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={16} className="text-blue-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Item Inventory Audit Trail ({filteredAuditLogs.length} Events)
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50/60">
                  <tr>
                    <th className="px-6 py-3.5 text-left font-black text-slate-400 uppercase tracking-wider">Date & Time</th>
                    <th className="px-6 py-3.5 text-left font-black text-slate-400 uppercase tracking-wider">Event Type</th>
                    <th className="px-6 py-3.5 text-right font-black text-slate-400 uppercase tracking-wider">Qty Change</th>
                    <th className="px-6 py-3.5 text-right font-black text-slate-400 uppercase tracking-wider">Unit Value</th>
                    <th className="px-6 py-3.5 text-left font-black text-slate-400 uppercase tracking-wider">Description / Reference</th>
                    <th className="px-6 py-3.5 text-left font-black text-slate-400 uppercase tracking-wider">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAuditLogs.length > 0 ? (
                    filteredAuditLogs.map((log) => {
                      const isPositive = log.quantity_change > 0;
                      return (
                        <tr key={`${log.event_type}-${log.event_id}-${log.created_at}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 text-slate-500 font-mono whitespace-nowrap">
                            {new Date(log.created_at + (log.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString([], {
                              month: 'short',
                              day: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {log.event_type === 'restock' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm text-[10px] font-black uppercase tracking-wider">
                                <ArrowDownRight size={12} /> Restock
                              </span>
                            )}
                            {log.event_type === 'sale' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-sm text-[10px] font-black uppercase tracking-wider">
                                <ShoppingCart size={12} /> POS Sale
                              </span>
                            )}
                            {log.event_type === 'adjustment' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-sm text-[10px] font-black uppercase tracking-wider">
                                <RefreshCw size={12} /> Adjustment
                              </span>
                            )}
                            {log.event_type === 'refund' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-sm text-[10px] font-black uppercase tracking-wider">
                                <RotateCcw size={12} /> Refund
                              </span>
                            )}
                          </td>
                          <td className={`px-6 py-4 text-right font-black whitespace-nowrap text-sm ${
                            isPositive ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                            {isPositive ? `+${log.quantity_change}` : log.quantity_change}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-800 whitespace-nowrap">
                            {log.unit_price > 0 ? formatGHS(log.unit_price) : '—'}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800 max-w-xs truncate">
                            {log.description}
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap flex items-center gap-1.5">
                            <UserCheck size={14} className="text-slate-400" />
                            {log.user_name || 'System'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No audit events match the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRICE HISTORY */}
      {activeTab === 'price_history' && (
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-2xs animate-fadeIn">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <CreditCard size={16} className="text-slate-600" />
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Price Change Log</h2>
          </div>
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3.5 text-left font-black text-slate-400 uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-3.5 text-right font-black text-slate-400 uppercase tracking-wider">Old Selling Price</th>
                <th className="px-6 py-3.5 text-right font-black text-slate-400 uppercase tracking-wider">New Selling Price</th>
                <th className="px-6 py-3.5 text-right font-black text-slate-400 uppercase tracking-wider">Delta Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {product.priceHistory && product.priceHistory.length > 0 ? (
                product.priceHistory.map((ph) => {
                  const delta = ph.new_selling_price - ph.old_selling_price;
                  return (
                    <tr key={ph.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 font-mono">
                        {new Date(ph.changed_at + (ph.changed_at.endsWith('Z') ? '' : 'Z')).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-500">{formatGHS(ph.old_selling_price)}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-900">{formatGHS(ph.new_selling_price)}</td>
                      <td className={`px-6 py-4 text-right font-black ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {delta >= 0 ? `+${formatGHS(delta)}` : formatGHS(delta)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No price adjustments logged for this product.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PRINT MODAL */}
      {showPrintModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[70] animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPrintModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl w-96 p-8 border border-slate-200 text-center shadow-2xl flex flex-col animate-in zoom-in-95 duration-150">
            <style>{`@media print { body * { display: none; } #print-area, #print-area * { display: block; } #print-area { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; padding: 20px; } }`}</style>
            <div id="print-area" className="text-left font-mono text-[14px] text-slate-800 space-y-4">
               <div className="text-center mb-6 pb-4 border-b border-dashed border-slate-300">
                  <h2 className="font-black text-[18px] tracking-widest uppercase">Ummis Lane Ent.</h2>
                  <p className="text-[11px] text-slate-500 mt-1 uppercase font-bold tracking-tight">Product Information & Audit Sheet</p>
               </div>
               
               <div className="space-y-4">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Product Name</div>
                    <div className="text-[16px] font-black uppercase text-slate-900">{product.name}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">SKU</div>
                      <div className="font-bold text-slate-900">{product.sku}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Barcode</div>
                      <div className="font-bold text-slate-900">{product.barcode || 'N/A'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Selling Price</div>
                      <div className="text-[16px] font-black text-slate-900">{formatGHS(product.selling_price)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Cost Price</div>
                      <div className="text-[16px] font-black text-slate-900">{formatGHS(product.cost_price)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Current Stock</div>
                      <div className="text-[16px] font-black text-blue-600">{product.stock_quantity}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Brand</div>
                    <div className="font-bold text-slate-900">{product.brand}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Unit of Measure</div>
                    <div className="font-bold text-slate-900">{product.unit_of_measure}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Category</div>
                    <div className="font-bold text-slate-900 uppercase">{product.category}</div>
                  </div>
               </div>

               <div className="pt-8 border-t border-dashed border-slate-300 text-center opacity-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest">System Generated: {new Date().toLocaleString()}</p>
               </div>
            </div>

            <div className="flex justify-center space-x-3 mt-8">
              <button onClick={() => setShowPrintModal(false)} className="flex-1 py-3 text-[11px] font-black uppercase text-slate-400 tracking-widest hover:bg-slate-50 border border-slate-200 rounded-sm transition-colors">Cancel</button>
              <button 
                onClick={() => window.print()} 
                className="flex-1 flex items-center justify-center py-3 bg-slate-900 text-white rounded-sm font-black text-[11px] uppercase tracking-widest hover:bg-blue-600 shadow-lg transition-all"
              >
                <Printer size={14} className="mr-2" /> Start Print
              </button>
            </div>
          </div>
        </div>
      )}

      {showLabelModal && (
        <BarcodeLabelModal
          product={product}
          onClose={() => setShowLabelModal(false)}
        />
      )}
    </div>
  );
}

function SingleLabelItem({ product, labelType, qrDataUrl, showPrice, showSku, showName, showStoreName, size }: any) {
  const svgRef = useRef<SVGSVGElement>(null);
  const codeValue = product.barcode || product.sku || `PROD-${product.id}`;

  useEffect(() => {
    if (svgRef.current && (labelType === 'barcode' || labelType === 'dual')) {
      try {
        JsBarcode(svgRef.current, codeValue, {
          format: 'CODE128',
          width: size === 'small' ? 1.2 : size === 'large' ? 2.0 : 1.5,
          height: size === 'small' ? 25 : size === 'large' ? 45 : 35,
          displayValue: true,
          fontSize: 10,
          margin: 2
        });
      } catch (e) {
        console.error('JsBarcode rendering error:', e);
      }
    }
  }, [codeValue, labelType, size]);

  return (
    <div className={`bg-white border border-slate-300 rounded p-3 text-center flex flex-col justify-between items-center shadow-2xs font-sans text-slate-900 ${
      size === 'small' ? 'w-[160px] min-h-[120px]' : size === 'large' ? 'w-[240px] min-h-[180px]' : 'w-[200px] min-h-[150px]'
    }`}>
      {showStoreName && (
        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-1 w-full truncate">
          Ummis Lane Ent.
        </div>
      )}

      {showName && (
        <div className="text-[11px] font-black tracking-tight text-slate-900 line-clamp-2 my-1">
          {product.name}
        </div>
      )}

      {showSku && (
        <div className="text-[9px] font-mono text-slate-500 font-bold mb-1">
          SKU: {product.sku}
        </div>
      )}

      {/* Visual Code Area */}
      <div className="my-1 flex items-center justify-center gap-2 w-full">
        {(labelType === 'barcode' || labelType === 'dual') && (
          <svg ref={svgRef} className="max-w-full h-auto mx-auto overflow-visible" />
        )}

        {(labelType === 'qrcode' || labelType === 'dual') && qrDataUrl && (
          <img src={qrDataUrl} alt="QR Code" className={`${labelType === 'dual' ? 'w-12 h-12' : 'w-20 h-20'} object-contain mx-auto`} />
        )}
      </div>

      {showPrice && (
        <div className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mt-1 w-full">
          {formatGHS(product.selling_price)}
        </div>
      )}
    </div>
  );
}

function BarcodeLabelModal({ product, onClose }: { product: ProductDetails; onClose: () => void }) {
  const [labelType, setLabelType] = useState<'barcode' | 'qrcode' | 'dual'>('barcode');
  const [labelQuantity, setLabelQuantity] = useState<number>(product.stock_quantity > 0 ? product.stock_quantity : 1);
  const [labelSize, setLabelSize] = useState<'small' | 'standard' | 'large'>('standard');
  const [showPrice, setShowPrice] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showStoreName, setShowStoreName] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    const codeValue = product.barcode || product.sku || `PROD-${product.id}`;
    const qrPayload = JSON.stringify({
      id: product.id,
      sku: product.sku,
      barcode: codeValue,
      name: product.name,
      price: product.selling_price
    });
    QRCode.toDataURL(qrPayload, { width: 150, margin: 1 })
      .then(url => setQrDataUrl(url))
      .catch(console.error);
  }, [product]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[80] overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #label-print-area, #label-print-area * {
            visibility: visible !important;
          }
          #label-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 12px !important;
            padding: 10px !important;
            background: white !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="no-print bg-slate-900 text-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center text-white shrink-0">
              <QrCode size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider">Product QR & Barcode Label Generator</h2>
              <p className="text-[11px] text-slate-400 font-medium">Generate & print scannable sticker tags for POS catalog</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-2 shadow-sm"
            >
              <Printer size={15} /> Print {labelQuantity} {labelQuantity === 1 ? 'Label' : 'Labels'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Controls Sidebar */}
          <div className="no-print space-y-5 bg-white p-5 rounded border border-slate-200 shadow-2xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b pb-2">Label Customization</h3>

            {/* Code Type Switcher */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Code Format</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded">
                <button
                  type="button"
                  onClick={() => setLabelType('barcode')}
                  className={`py-1.5 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1 ${
                    labelType === 'barcode' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500'
                  }`}
                >
                  <Barcode size={12} /> Barcode
                </button>
                <button
                  type="button"
                  onClick={() => setLabelType('qrcode')}
                  className={`py-1.5 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1 ${
                    labelType === 'qrcode' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500'
                  }`}
                >
                  <QrCode size={12} /> QR Code
                </button>
                <button
                  type="button"
                  onClick={() => setLabelType('dual')}
                  className={`py-1.5 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1 ${
                    labelType === 'dual' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500'
                  }`}
                >
                  Both
                </button>
              </div>
            </div>

            {/* Print Quantity */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Print Count</label>
                <button
                  type="button"
                  onClick={() => setLabelQuantity(product.stock_quantity > 0 ? product.stock_quantity : 1)}
                  className="text-[10px] text-blue-600 font-bold hover:underline"
                >
                  Match Stock ({product.stock_quantity})
                </button>
              </div>
              <input
                type="number"
                min="1"
                max="100"
                value={labelQuantity}
                onChange={e => setLabelQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs font-bold text-slate-900"
              />
            </div>

            {/* Label Size */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Sticker Tag Dimension</label>
              <select
                value={labelSize}
                onChange={e => setLabelSize(e.target.value as any)}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value="small">Small Tag (38mm x 19mm)</option>
                <option value="standard">Standard Retail Sticker (50mm x 25mm)</option>
                <option value="large">Large Shelf Label (70mm x 35mm)</option>
              </select>
            </div>

            {/* Content Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Elements to Display</label>
              
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showStoreName}
                  onChange={e => setShowStoreName(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Store Header ("Ummis Lane Ent.")
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showName}
                  onChange={e => setShowName(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Product Name
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSku}
                  onChange={e => setShowSku(e.target.checked)}
                  className="rounded text-blue-600"
                />
                SKU Identifier
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={e => setShowPrice(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Selling Price ({formatGHS(product.selling_price)})
              </label>
            </div>
          </div>

          {/* Label Preview Grid */}
          <div className="md:col-span-2 space-y-3">
            <div className="no-print flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Live Sticker Sheet Preview ({labelQuantity} {labelQuantity === 1 ? 'Tag' : 'Tags'})
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Ready for Thermal / Desktop Print</span>
            </div>

            <div
              id="label-print-area"
              className="bg-white p-6 rounded border border-slate-200 min-h-[360px] flex flex-wrap gap-4 items-start justify-start overflow-y-auto max-h-[500px]"
            >
              {Array.from({ length: Math.min(100, labelQuantity) }).map((_, idx) => (
                <SingleLabelItem
                  key={idx}
                  product={product}
                  labelType={labelType}
                  qrDataUrl={qrDataUrl}
                  showPrice={showPrice}
                  showSku={showSku}
                  showName={showName}
                  showStoreName={showStoreName}
                  size={labelSize}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Barcode Value: <strong className="font-mono text-slate-800">{product.barcode || product.sku}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Printer size={15} /> Print Labels Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
