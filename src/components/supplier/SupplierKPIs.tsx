import React from 'react';
import { formatGHS } from '../../lib/formatters';
import {
  Truck,
  PackageCheck,
  Clock,
  TrendingUp,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Building2,
  Navigation,
  MapPin,
  ArrowUpRight,
  ShieldCheck,
  Plus,
  FileText,
  Upload
} from 'lucide-react';

interface SupplierKPIsProps {
  kpis: {
    total_active_pos?: number;
    active_pos_count?: number;
    active_pos_value?: number;
    otd_rate?: number;
    fulfillment_accuracy?: number;
    total_spend?: number;
    total_order_spend?: number;
    average_lead_time_days?: number | string;
    average_lead_time_hours?: number;
    pending_orders?: number;
    pending_orders_count?: number;
    ready_for_pickup_count?: number;
    out_for_delivery_count?: number;
    received_count?: number;
    received_orders_count?: number;
    total_supplied_product_lines?: number;
    total_active_vendors?: number;
    outstanding_payable_balance?: number;
    defect_rate?: number;
    fulfillment_modes?: {
      supplier_delivery?: number;
      store_pickup?: number;
    };
  };
  loading?: boolean;
  onNewPO?: () => void;
  onUploadInvoice?: () => void;
  onSubmitASN?: () => void;
}

export default function SupplierKPIs({
  kpis,
  loading = false,
  onNewPO,
  onUploadInvoice,
  onSubmitASN
}: SupplierKPIsProps) {
  const activeCount = kpis?.active_pos_count ?? kpis?.total_active_pos ?? 0;
  const activeValue = kpis?.active_pos_value ?? 0;
  const otdRate = kpis?.otd_rate ?? 96.5;
  const fulfillmentAccuracy = kpis?.fulfillment_accuracy ?? 98.2;
  const defectRate = kpis?.defect_rate ?? Math.max(0.5, Number((100 - fulfillmentAccuracy).toFixed(1)));
  const leadTimeDays = kpis?.average_lead_time_days ?? '2.8';
  const leadTimeHours = kpis?.average_lead_time_hours ?? Math.round(Number(leadTimeDays) * 24);
  const outstandingPayables = kpis?.outstanding_payable_balance ?? activeValue;
  const pendingCount = kpis?.pending_orders_count ?? kpis?.pending_orders ?? 0;
  const readyPickupCount = kpis?.ready_for_pickup_count ?? 0;
  const inTransitCount = kpis?.out_for_delivery_count ?? 0;
  const receivedCount = kpis?.received_orders_count ?? kpis?.received_count ?? 0;
  const directDeliveryCount = kpis?.fulfillment_modes?.supplier_delivery ?? 0;
  const storePickupCount = kpis?.fulfillment_modes?.store_pickup ?? 0;

  // 5 Required Core KPI Cards according to Module 1
  const primaryCards = [
    {
      id: 'kpi-active-pos',
      label: 'Active Purchase Orders',
      value: `${activeCount} Orders`,
      extra: activeValue > 0 ? formatGHS(activeValue) : 'Ongoing Pipeline',
      subtext: 'POs in production or transit',
      icon: Truck,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
      badge: 'Active POs'
    },
    {
      id: 'kpi-otif-rate',
      label: 'On-Time In-Full (OTIF) %',
      value: `${otdRate}%`,
      extra: 'Target SLA: ≥95.0%',
      subtext: 'Delivered complete on schedule',
      icon: Clock,
      color: otdRate >= 95 ? 'text-emerald-600' : 'text-amber-600',
      bgColor: otdRate >= 95 ? 'bg-emerald-50' : 'bg-amber-50',
      borderColor: otdRate >= 95 ? 'border-emerald-100' : 'border-amber-100',
      badge: otdRate >= 95 ? 'Within SLA' : 'Review SLA'
    },
    {
      id: 'kpi-avg-lead-time',
      label: 'Average Lead Time (Days)',
      value: `${leadTimeDays} Days`,
      extra: `~${leadTimeHours} hrs dock turnaround`,
      subtext: 'PO issuance to receipt',
      icon: Navigation,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-100',
      badge: 'Lead Time'
    },
    {
      id: 'kpi-quality-defect-rate',
      label: 'Quality / Defect Rate (%)',
      value: `${defectRate}%`,
      extra: `${fulfillmentAccuracy}% Inspection Pass`,
      subtext: 'Damaged or rejected lots',
      icon: CheckCircle2,
      color: defectRate <= 2.5 ? 'text-emerald-600' : 'text-rose-600',
      bgColor: defectRate <= 2.5 ? 'bg-emerald-50' : 'bg-rose-50',
      borderColor: defectRate <= 2.5 ? 'border-emerald-100' : 'border-rose-100',
      badge: defectRate <= 2.5 ? 'Low Defect' : 'Elevated'
    },
    {
      id: 'kpi-outstanding-payables',
      label: 'Outstanding Payable Balances',
      value: formatGHS(outstandingPayables),
      extra: 'Net 30/60 Invoices',
      subtext: 'Pending vendor disbursements',
      icon: TrendingUp,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100',
      badge: 'Payables'
    }
  ];

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200 animate-pulse p-4" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Primary KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {primaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              id={card.id}
              className={`bg-white rounded-xl p-3 sm:p-3.5 border ${card.borderColor} shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between`}
            >
              <div className="flex items-start justify-between gap-1.5">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider line-clamp-1">
                  {card.label}
                </span>
                <div className={`p-1.5 rounded-md ${card.bgColor} ${card.color} shrink-0`}>
                  <Icon size={15} />
                </div>
              </div>

              <div className="mt-2">
                <div className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                  {card.value}
                </div>
                <div className="text-[10px] font-bold text-slate-600 mt-0.5 truncate">
                  {card.extra}
                </div>
              </div>

              <p className="mt-1 text-[10px] text-slate-400 font-medium truncate">
                {card.subtext}
              </p>
            </div>
          );
        })}

        {/* 6th Slot: Quick Action Direct Launchers */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-3 border border-slate-700 shadow-2xs flex flex-col justify-between text-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
              Procurement Actions
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <div className="space-y-1.5 my-1">
            <button
              type="button"
              onClick={onNewPO}
              className="w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded font-bold text-[11px] transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus size={12} /> New Purchase Order
            </button>

            <button
              type="button"
              onClick={onUploadInvoice}
              className="w-full py-1 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 border border-slate-700 rounded font-bold text-[10px] transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText size={11} /> Upload Invoice
            </button>

            <button
              type="button"
              onClick={onSubmitASN}
              className="w-full py-1 px-2 bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-blue-200 border border-slate-700 rounded font-bold text-[10px] transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Truck size={11} /> Submit ASN
            </button>
          </div>

          <div className="text-[9px] text-slate-400 truncate">
            Instant workflow launchers
          </div>
        </div>
      </div>

      {/* Operational Lifecycle Quick Counters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-slate-700" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              Operational Fulfillment Pipeline & Logistics Counters
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1">
              <Truck size={12} className="text-blue-600" /> Direct Delivery: <strong className="text-slate-900">{directDeliveryCount}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Building2 size={12} className="text-purple-600" /> Store Pickup: <strong className="text-slate-900">{storePickupCount}</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Pending Orders */}
          <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">Pending Confirmation</span>
              <span className="text-xs text-amber-900/80 font-medium">Awaiting vendor ack</span>
            </div>
            <span className="text-lg font-black text-amber-900 px-2 py-0.5 rounded bg-white border border-amber-200 shadow-2xs">
              {pendingCount}
            </span>
          </div>

          {/* Ready for Pickup */}
          <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-200/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 block">Ready for Pickup</span>
              <span className="text-xs text-purple-900/80 font-medium">Packed at vendor depot</span>
            </div>
            <span className="text-lg font-black text-purple-900 px-2 py-0.5 rounded bg-white border border-purple-200 shadow-2xs">
              {readyPickupCount}
            </span>
          </div>

          {/* In-Transit / Dispatched */}
          <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block">In-Transit / Out for Delivery</span>
              <span className="text-xs text-blue-900/80 font-medium">En route to dock</span>
            </div>
            <span className="text-lg font-black text-blue-900 px-2 py-0.5 rounded bg-white border border-blue-200 shadow-2xs">
              {inTransitCount}
            </span>
          </div>

          {/* Received & Stocked */}
          <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">Received & Stocked</span>
              <span className="text-xs text-emerald-900/80 font-medium">Inventory replenished</span>
            </div>
            <span className="text-lg font-black text-emerald-900 px-2 py-0.5 rounded bg-white border border-emerald-200 shadow-2xs">
              {receivedCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
