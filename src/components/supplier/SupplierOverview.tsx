import React from 'react';
import { formatGHS } from '../../lib/formatters';
import {
  Truck,
  Package,
  CreditCard,
  MessageSquare,
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  ArrowUpRight,
  Activity,
  Layers,
  FileCheck
} from 'lucide-react';
import type { SupplierProduct, Shipment, SupplierInvoice } from '../../types/supplier';

interface SupplierOverviewProps {
  products: SupplierProduct[];
  shipments: Shipment[];
  invoices: SupplierInvoice[];
  purchases?: any[];
  activeSupplier: string;
  activeSupplierRecord: any;
  loading: boolean;
  onNavigateTab: (tab: string, path: string) => void;
}

export default function SupplierOverview({
  products,
  shipments,
  invoices,
  purchases = [],
  activeSupplier,
  activeSupplierRecord,
  loading,
  onNavigateTab
}: SupplierOverviewProps) {
  // 1. Store Owner Incoming Purchase Orders
  const pendingStorePOs = (purchases || []).filter(p =>
    p.status === 'pending' || p.status === 'pending_confirmation' || p.status === 'ordered' || p.status === 'draft'
  );
  const pendingPOValue = pendingStorePOs.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

  // 2. Calculated Status Metrics (Pure Read-Only Status Hub)
  const inTransitShipments = shipments.filter(s => s.status === 'in_transit' || s.status === 'preparing');
  const pendingApprovals = products.filter(p => p.status === 'pending_approval' || !p.admin_approved);
  const lowStockItems = products.filter(p => p.current_stock <= (p.reorder_point || 10));
  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid');
  const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

  // 3. Synthesize Recent Activity Log from live data (including Store POs!)
  const activityItems: { id: string; title: string; time: string; type: 'po' | 'shipment' | 'product' | 'invoice' | 'approval'; desc: string }[] = [];

  for (const po of (purchases || []).slice(0, 3)) {
    activityItems.push({
      id: `act-po-${po.id}`,
      title: `Store PO #PO-${po.id}: ${po.status?.toUpperCase().replace('_', ' ') || 'NEW'}`,
      time: po.created_at,
      type: 'po',
      desc: `Store Owner requested ${po.total_units || po.item_count || 1} units (${formatGHS(po.total_amount)}). Delivery requested: ${po.expected_date || 'Standard SLA'}.`
    });
  }

  for (const s of shipments.slice(0, 3)) {
    activityItems.push({
      id: `act-shp-${s.id}`,
      title: `Shipment ${s.shipment_number}: ${s.status.toUpperCase().replace('_', ' ')}`,
      time: s.delivered_date || s.shipped_date || s.created_at,
      type: 'shipment',
      desc: `${s.total_units || 0} units routed via ${s.carrier} (${s.tracking_number || s.trackingId})`
    });
  }

  for (const p of pendingApprovals.slice(0, 2)) {
    activityItems.push({
      id: `act-prd-${p.id}`,
      title: `Product Pending Approval: ${p.title || p.name}`,
      time: p.created_at || new Date().toISOString(),
      type: 'approval',
      desc: `Supplier SKU: ${p.supplier_sku || p.sku} • MOQ: ${p.moq}`
    });
  }

  for (const inv of invoices.slice(0, 2)) {
    activityItems.push({
      id: `act-inv-${inv.id}`,
      title: `Invoice ${inv.invoice_number || inv.id}: ${inv.status.toUpperCase()}`,
      time: inv.created_at || new Date().toISOString(),
      type: 'invoice',
      desc: `${formatGHS(inv.amount)} • Terms: ${inv.payment_terms || 'Net 30'}`
    });
  }

  // Sort activity descending by timestamp
  activityItems.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="space-y-6">
      {/* Vendor Profile Status Bar - Pure Status Visibility, Strictly No Action Buttons */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-white shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-blue-600/30 border border-blue-400/30 flex items-center justify-center shrink-0">
            <Building2 className="text-blue-400" size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white">{activeSupplier}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Verified Vendor
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Terms: <strong className="text-white">{activeSupplierRecord?.payment_terms || 'Net 30'}</strong> • Lead Time SLA: <strong className="text-white">{activeSupplierRecord?.lead_time_days || 3} Days</strong> • Quality Score: <strong className="text-emerald-400">{activeSupplierRecord?.quality_score || 95}%</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live Store Sync Active</span>
        </div>
      </div>

      {/* Real-time Store Owner Purchase Order Alert Banner */}
      {pendingStorePOs.length > 0 && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white p-4 sm:p-5 rounded-xl shadow-md border border-blue-400/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck size={24} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900 shadow-xs">
                  NEW STORE ORDER
                </span>
                <h3 className="text-sm font-black tracking-tight truncate">
                  {pendingStorePOs.length} Purchase Order{pendingStorePOs.length > 1 ? 's' : ''} Issued by Store Owner ({formatGHS(pendingPOValue)})
                </h3>
              </div>
              <p className="text-xs text-blue-100 font-medium mt-1">
                The store owner has placed restock orders. Review ordered items, acknowledge terms, and dispatch shipments with carrier & tracking details.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('shipments', '/supplier/shipments')}
            className="px-4 py-2 bg-white hover:bg-blue-50 text-blue-900 active:bg-blue-100 font-black text-xs rounded-lg transition-all shadow-sm shrink-0 flex items-center gap-2 cursor-pointer group"
          >
            <span>Review & Fulfill POs</span>
            <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      )}

      {/* 5 Clean, Uncluttered KPI Summary Cards - Pure Status Visibility */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 0: Incoming Store Owner POs */}
        <div 
          onClick={() => onNavigateTab('shipments', '/supplier/shipments')}
          className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-400 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Store Orders</span>
            <div className={`p-1.5 rounded-lg ${pendingStorePOs.length > 0 ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
              <FileCheck size={16} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">{pendingStorePOs.length}</span>
            <span className="text-xs font-bold text-amber-600">Pending</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
            {formatGHS(pendingPOValue)} awaiting fulfillment
          </p>
        </div>

        {/* KPI 1: Active Shipments */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Shipments</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Truck size={16} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">{inTransitShipments.length}</span>
            <span className="text-xs font-bold text-blue-600">In-Transit</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
            {shipments.filter(s => s.status === 'verified').length} verified & restocked
          </p>
        </div>

        {/* KPI 2: Pending Restock Approvals */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Product Approvals</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">{pendingApprovals.length}</span>
            <span className="text-xs font-bold text-amber-600">Awaiting Admin</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
            {products.filter(p => p.status === 'active').length} approved products active
          </p>
        </div>

        {/* KPI 3: Low Stock Alerts */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-rose-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Low Stock Alerts</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">{lowStockItems.length}</span>
            <span className="text-xs font-bold text-rose-600">Low Level</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
            {products.filter(p => p.current_stock === 0).length} out of stock
          </p>
        </div>

        {/* KPI 4: Unpaid Invoices Balance */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Unpaid Invoices</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 truncate">{formatGHS(unpaidTotal)}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
            {unpaidInvoices.length} invoices pending settlement
          </p>
        </div>
      </div>

      {/* Main Content Layout: Status Overview Cards + Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Dedicated Module Status Hubs (Links to pages, strictly no action buttons) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
            Functional Operations Hub
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Module Hub: Products */}
            <div 
              onClick={() => onNavigateTab('products', '/supplier/products')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-105 transition-transform">
                      <Package size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        My Products
                      </h3>
                      <span className="text-[11px] text-slate-500">{products.length} registered items</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                  Maintain supplier catalog, unit costs, minimum order quantities (MOQs), and barcode cross-references.
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Active Catalog:</span>
                <span className="font-bold text-emerald-600">{products.filter(p => p.status === 'active').length} Active</span>
              </div>
            </div>

            {/* Module Hub: Shipments */}
            <div 
              onClick={() => onNavigateTab('shipments', '/supplier/shipments')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-105 transition-transform">
                      <Truck size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        Restock Shipments
                      </h3>
                      <span className="text-[11px] text-slate-500">{shipments.length} total shipments</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                  Dispatch restock consignments, record tracking IDs and carriers, and track store verification status.
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">In Transit:</span>
                <span className="font-bold text-blue-600">{inTransitShipments.length} Shipments</span>
              </div>
            </div>

            {/* Module Hub: Invoices */}
            <div 
              onClick={() => onNavigateTab('invoices', '/supplier/invoices')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-105 transition-transform">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                        Invoices & Earnings
                      </h3>
                      <span className="text-[11px] text-slate-500">{invoices.length} invoices filed</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                  Attach invoices to verified shipments, track 3-way matching settlement, and monitor Net 30/60 pay dates.
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Unsettled:</span>
                <span className="font-bold text-amber-600">{formatGHS(unpaidTotal)}</span>
              </div>
            </div>

            {/* Module Hub: Direct Communications */}
            <div 
              onClick={() => onNavigateTab('communication', '/communication')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-violet-50 text-violet-600 rounded-lg group-hover:scale-105 transition-transform">
                      <MessageSquare size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-violet-600 transition-colors">
                        Direct Communications
                      </h3>
                      <span className="text-[11px] text-slate-500">Store Owner & Manager Chat</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                  Direct real-time messaging with the store leadership linked to specific SKUs, shipments, and invoice records.
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Channel Status:</span>
                <span className="font-bold text-violet-600">Connected & Synced</span>
              </div>
            </div>

          </div>
        </div>

        {/* Right 1 Column: Recent Activity Feed */}
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Recent Activity Log</span>
            <Activity size={14} className="text-slate-400" />
          </h2>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 divide-y divide-slate-100">
            {activityItems.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">No recent activity recorded</p>
            ) : (
              activityItems.map((act) => (
                <div key={act.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 line-clamp-1">{act.title}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                      {new Date(act.time).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{act.desc}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
