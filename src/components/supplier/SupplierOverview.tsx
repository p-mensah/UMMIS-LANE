import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatGHS } from '../../lib/formatters';
import SupplierKPIs from './SupplierKPIs';
import {
  Truck,
  Boxes,
  Barcode,
  CreditCard,
  BarChart3,
  RotateCcw,
  Building2,
  FileText,
  MessageSquare,
  Plus,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface SupplierOverviewProps {
  purchases: any[];
  triggersData: any;
  analyticsData: any;
  qcLogs: any[];
  rmas: any[];
  activeSupplier: string;
  activeSupplierRecord: any;
  loading: boolean;
  onNewPO: () => void;
  onUploadInvoice: (poId?: number) => void;
  onSubmitASN: (poId?: number) => void;
  onNavigateTab: (tab: string, path: string) => void;
}

export default function SupplierOverview({
  purchases,
  triggersData,
  analyticsData,
  qcLogs,
  rmas,
  activeSupplier,
  activeSupplierRecord,
  loading,
  onNewPO,
  onUploadInvoice,
  onSubmitASN,
  onNavigateTab
}: SupplierOverviewProps) {
  const navigate = useNavigate();

  // Get recent 5 POs
  const recentPOs = purchases.slice(0, 5);

  // Get low stock triggers (up to 4)
  const criticalStockItems = (triggersData?.triggers || []).slice(0, 4);

  // Calculate invoice snapshot
  const unpaidInvoices = purchases.filter(p => p.invoice_status === 'unpaid');
  const scheduledInvoices = purchases.filter(p => p.invoice_status === 'scheduled');
  const paidInvoices = purchases.filter(p => p.invoice_status === 'paid');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'received':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Delivered</span>;
      case 'shipped':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">Shipped</span>;
      case 'in_production':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">In Production</span>;
      case 'confirmed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">Confirmed</span>;
      case 'sent':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">Sent</span>;
      case 'draft':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">Draft</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">Cancelled</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Executive Summary & KPIs Header Cards */}
      <SupplierKPIs
        kpis={analyticsData?.kpis}
        loading={loading}
        onNewPO={onNewPO}
        onUploadInvoice={() => onUploadInvoice()}
        onSubmitASN={() => onSubmitASN()}
      />

      {/* 2. Direct Hub Quick Action Strip */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 p-4 rounded-xl text-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center shrink-0">
            <Building2 className="text-blue-400" size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white">{activeSupplier}</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Verified Vendor
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium">
              Terms: <strong className="text-white">{activeSupplierRecord?.payment_terms || 'Net 30'}</strong> • Avg Lead Time: <strong className="text-white">{activeSupplierRecord?.lead_time_days || 3} Days</strong> • SLA Quality: <strong className="text-emerald-400">{activeSupplierRecord?.quality_score || 95}%</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={onNewPO}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus size={14} /> New Purchase Order
          </button>
          <button
            type="button"
            onClick={() => onUploadInvoice()}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <FileText size={14} /> Upload Invoice
          </button>
          <button
            type="button"
            onClick={() => onSubmitASN()}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Truck size={14} /> Submit ASN
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('portal', '/supplier/messages')}
            className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <MessageSquare size={14} /> Messages
          </button>
        </div>
      </div>

      {/* 3. Grid of Main Dedicated Module Portals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Module Card: PO & ASN Lifecycle */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Truck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">PO & ASN Lifecycle</h3>
                  <span className="text-[11px] text-slate-500 font-medium">{purchases.length} total purchase orders</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('pos', '/supplier/pos')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
              >
                View Page <ChevronRight size={14} />
              </button>
            </div>

            <div className="space-y-2 mt-2">
              {recentPOs.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-3 text-center">No recent purchase orders</p>
              ) : (
                recentPOs.map((po) => (
                  <div key={po.id} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">PO #{po.id}</div>
                      <div className="text-[10px] text-slate-500">{new Date(po.created_at).toLocaleDateString()} • {formatGHS(po.total_cost || 0)}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(po.status)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onNewPO}
              className="text-xs font-bold text-slate-700 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
            >
              <Plus size={13} /> Create PO
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('pos', '/supplier/pos')}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Open Dedicated Page →
            </button>
          </div>
        </div>

        {/* Module Card: Inventory Alignment & VMI */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Boxes size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Inventory & VMI</h3>
                  <span className="text-[11px] text-slate-500 font-medium">Auto-replenishment triggers</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('replenishment', '/supplier/inventory')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
              >
                View Page <ChevronRight size={14} />
              </button>
            </div>

            <div className="space-y-2 mt-2">
              {criticalStockItems.length === 0 ? (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  All vendor-managed inventory levels are healthy!
                </div>
              ) : (
                criticalStockItems.map((item: any, idx: number) => (
                  <div key={idx} className="p-2 rounded-lg bg-amber-50/60 border border-amber-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{item.name}</div>
                      <div className="text-[10px] text-amber-700 font-medium">
                        Stock: {item.current_stock} / Min: {item.reorder_point} {item.unit || 'units'}
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-black text-[9px] uppercase">
                      Reorder
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">Safety stock alignment</span>
            <button
              type="button"
              onClick={() => onNavigateTab('replenishment', '/supplier/inventory')}
              className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
            >
              Open Dedicated Page →
            </button>
          </div>
        </div>

        {/* Module Card: Invoicing & 3-Way Match */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Invoicing & 3-Way Match</h3>
                  <span className="text-[11px] text-slate-500 font-medium">PO vs GRN vs Invoice</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('financial', '/supplier/invoices')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
              >
                View Page <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <div className="text-base font-black text-amber-800">{unpaidInvoices.length}</div>
                <div className="text-[10px] uppercase font-bold text-amber-700">Unpaid</div>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-base font-black text-blue-800">{scheduledInvoices.length}</div>
                <div className="text-[10px] uppercase font-bold text-blue-700">Scheduled</div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="text-base font-black text-emerald-800">{paidInvoices.length}</div>
                <div className="text-[10px] uppercase font-bold text-emerald-700">Settled</div>
              </div>
            </div>

            <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between font-medium">
                <span>Active Payment Terms:</span>
                <span className="font-bold text-slate-800">{activeSupplierRecord?.payment_terms || 'Net 30'}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>3-Way Auto Match:</span>
                <span className="font-bold text-emerald-600">Active & Automated</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onUploadInvoice()}
              className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <FileText size={13} /> Upload Invoice
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('financial', '/supplier/invoices')}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Open Dedicated Page →
            </button>
          </div>
        </div>

        {/* Module Card: Product Catalog & Item Master */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                  <Barcode size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Product Catalog & Master</h3>
                  <span className="text-[11px] text-slate-500 font-medium">Barcodes, MOQs & Spec Sheets</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('item_master', '/supplier/catalog')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
              >
                View Page <ChevronRight size={14} />
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Cross-reference internal SKUs with vendor codes and barcodes, configure tiered volume discounts, and access SDS, CoA, and technical spec sheets in the Cloudinary document vault.
            </p>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-teal-700 font-bold">1MB Compress Active</span>
            <button
              type="button"
              onClick={() => onNavigateTab('item_master', '/supplier/catalog')}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Open Dedicated Page →
            </button>
          </div>
        </div>

        {/* Module Card: Vendor Analytics & SLA Scorecard */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                  <BarChart3 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Vendor Analytics & SLA</h3>
                  <span className="text-[11px] text-slate-500 font-medium">Scorecard & Quality Trends</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('analytics', '/supplier/analytics')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
              >
                View Page <ChevronRight size={14} />
              </button>
            </div>

            <div className="space-y-2 mt-2">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>OTIF Delivery Rate</span>
                  <span className="font-bold text-violet-700">{analyticsData?.kpis?.otd_rate || 96}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-violet-600 h-2 rounded-full"
                    style={{ width: `${analyticsData?.kpis?.otd_rate || 96}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Fulfillment Accuracy</span>
                  <span className="font-bold text-emerald-700">{analyticsData?.kpis?.fulfillment_accuracy || 98}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 rounded-full"
                    style={{ width: `${analyticsData?.kpis?.fulfillment_accuracy || 98}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">Live Vendor SLA</span>
            <button
              type="button"
              onClick={() => onNavigateTab('analytics', '/supplier/analytics')}
              className="text-xs font-bold text-violet-700 hover:underline cursor-pointer"
            >
              Open Dedicated Page →
            </button>
          </div>
        </div>

        {/* Module Card: Inspection QC & RMAs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Inspection QC & RMAs</h3>
                  <span className="text-[11px] text-slate-500 font-medium">Quality checks & claims</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('qc_rma', '/supplier/qc')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
              >
                View Page <ChevronRight size={14} />
              </button>
            </div>

            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <span className="font-medium text-slate-700">QC Inspection Logs:</span>
                <span className="font-bold text-slate-900">{qcLogs.length} Records</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/70 border border-rose-200 text-xs">
                <span className="font-medium text-rose-800">Active Return Claims (RMAs):</span>
                <span className="font-bold text-rose-900">{rmas.length} Active</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-rose-700 font-bold">Defect Rate: {analyticsData?.kpis?.defect_rate || 0.8}%</span>
            <button
              type="button"
              onClick={() => onNavigateTab('qc_rma', '/supplier/qc')}
              className="text-xs font-bold text-rose-700 hover:underline cursor-pointer"
            >
              Open Dedicated Page →
            </button>
          </div>
        </div>

      </div>

      {/* 4. Bottom Quick Links to Profile, Reports & Messages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('master_data', '/supplier/profile')}
          className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left transition flex items-center justify-between group cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-105 transition-transform">
              <Building2 size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Supplier Master Profile</div>
              <div className="text-[11px] text-slate-500 font-medium">Bank details, terms, compliance certificates</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('reports', '/supplier/reports')}
          className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left transition flex items-center justify-between group cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg group-hover:scale-105 transition-transform">
              <FileText size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Procurement Reports</div>
              <div className="text-[11px] text-slate-500 font-medium">Export CSV & PDF vendor reports</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-800 transition-colors" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('portal', '/supplier/messages')}
          className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left transition flex items-center justify-between group cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-105 transition-transform">
              <MessageSquare size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Supplier Messages</div>
              <div className="text-[11px] text-slate-500 font-medium">Live procurement collaboration channel</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
        </button>
      </div>
    </div>
  );
}
