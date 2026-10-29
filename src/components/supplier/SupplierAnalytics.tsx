import React, { useState } from 'react';
import { formatGHS } from '../../lib/formatters';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Award,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  PieChart as PieIcon,
  Target
} from 'lucide-react';

interface SupplierAnalyticsProps {
  analyticsData: any;
  activeSupplier: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function SupplierAnalytics({ analyticsData, activeSupplier }: SupplierAnalyticsProps) {
  // Volume discount tier simulation state
  const [simulatedUnits, setSimulatedUnits] = useState(120);

  const scorecard = analyticsData?.scorecard || {
    otd_rate: 96.5,
    quality_rejection_rate: 1.8,
    price_variance: -1.2,
    overall_score: 95.8
  };

  const spendByCategory = analyticsData?.spend_by_category || [
    { category: 'Dairy & Milk', spend: 8500 },
    { category: 'Beverages & Drinks', spend: 6200 },
    { category: 'Cereals & Breakfast', spend: 4100 },
    { category: 'Snacks & Confectionery', spend: 2900 },
    { category: 'Cooking Ingredients', spend: 1800 }
  ];

  const leadTimeTrends = analyticsData?.lead_time_trends || [
    { batch: 'PO #1', expected: 3, actual: 2.5 },
    { batch: 'PO #2', expected: 3, actual: 3.0 },
    { batch: 'PO #3', expected: 3, actual: 2.0 },
    { batch: 'PO #4', expected: 3, actual: 4.0 },
    { batch: 'PO #5', expected: 3, actual: 2.8 },
    { batch: 'PO #6', expected: 3, actual: 2.6 }
  ];

  // Volume discount tier modeling
  const baseCost = 25.0; // GH₵25 base
  let tierDiscountPercent = 0;
  let tierLevel = 'Base / Single Pack (0% Discount)';

  if (simulatedUnits >= 200) {
    tierDiscountPercent = 7;
    tierLevel = 'Tier 2 Wholesale Partner (7% Discount)';
  } else if (simulatedUnits >= 50) {
    tierDiscountPercent = 3;
    tierLevel = 'Tier 1 Volume Discount (3% Discount)';
  }

  const undiscountedTotal = simulatedUnits * baseCost;
  const discountedCostPerUnit = baseCost * (1 - tierDiscountPercent / 100);
  const discountedTotal = simulatedUnits * discountedCostPerUnit;
  const simulatedSavings = undiscountedTotal - discountedTotal;

  return (
    <div className="space-y-4">
      {/* 1. Supplier Scorecard Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <Award size={16} className="text-amber-500" />
              Strategic Supplier Scorecard — {activeSupplier || 'Nestlé Ghana Ltd'}
            </h3>
            <p className="text-xs text-slate-500">
              Evaluated based on contract SLAs, dock-to-stock turnaround, and QC inspection pass rates
            </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 uppercase">Composite Rating:</span>
            <span className="text-base font-black text-emerald-700">{scorecard.overall_score || 95.8}%</span>
            <span className="text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded">Grade A+</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
              <span>On-Time Delivery (OTD)</span>
              <Clock size={14} className="text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-black text-slate-900">{scorecard.otd_rate || 96.5}%</span>
              <span className="text-[10px] font-bold text-emerald-600">+1.5% vs SLA</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">SLA Target: Minimum 95.0%</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
              <span>Quality Rejection Rate</span>
              <CheckCircle2 size={14} className="text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-black text-emerald-600">{scorecard.quality_rejection_rate || 1.8}%</span>
              <span className="text-[10px] font-bold text-emerald-600">Excellent</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Acceptance tolerance: &lt; 2.5%</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
              <span>Price Variance vs Market</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-black text-purple-600">-1.2%</span>
              <span className="text-[10px] font-bold text-emerald-600">Favorable</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Contract prices 1.2% below regional index</p>
          </div>
        </div>
      </div>

      {/* 2. Charts Grid: Spend Analysis & Lead Time Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spend by Category */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <PieIcon size={14} className="text-blue-600" />
              Procurement Spend by Product Category
            </h4>
            <span className="text-[10px] text-slate-400 font-medium">Last 6 Months</span>
          </div>

          <div className="h-64 w-full min-w-0 min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240} initialDimension={{ width: 400, height: 240 }}>
              <BarChart data={spendByCategory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => `₵${val}`} />
                <Tooltip
                  formatter={(val: any) => [formatGHS(Number(val)), 'Procurement Spend']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
                <Bar dataKey="spend" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Time Trend Analysis */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-indigo-600" />
              Lead Time SLA Trend (Expected vs Actual Days)
            </h4>
            <span className="text-[10px] text-slate-400 font-medium">Recent Order Batches</span>
          </div>

          <div className="h-64 w-full min-w-0 min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240} initialDimension={{ width: 400, height: 240 }}>
              <LineChart data={leadTimeTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="batch" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} unit="d" />
                <Tooltip
                  formatter={(val: any) => [`${val} Days`, '']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="expected" name="SLA Target" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="actual" name="Actual Delivery" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Volume Discount Tier Optimization Modeling */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sliders size={15} className="text-emerald-600" />
              Volume Discount Tier Optimization Modeling
            </h4>
            <p className="text-xs text-slate-500">
              Simulate order batch consolidation to unlock volume price discounts and minimize procurement cost per unit
            </p>
          </div>
          <div className="px-2.5 py-1 bg-emerald-50 rounded border border-emerald-200 text-xs font-bold text-emerald-800">
            {tierLevel}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Slider input */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-slate-700">Simulated Order Quantity:</span>
              <span className="font-black text-blue-600 text-sm">{simulatedUnits} units</span>
            </div>
            <input
              type="range"
              min={10}
              max={300}
              step={10}
              value={simulatedUnits}
              onChange={(e) => setSimulatedUnits(Number(e.target.value))}
              className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>10 units (Base)</span>
              <span>50 units (Tier 1: -3%)</span>
              <span>200+ units (Tier 2: -7%)</span>
            </div>
          </div>

          {/* Metrics breakdown */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Unit Cost</span>
              <span className="text-sm font-black text-slate-800">{formatGHS(discountedCostPerUnit)}</span>
              <span className="text-[10px] text-slate-500 block line-through">{formatGHS(baseCost)}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Batch Total</span>
              <span className="text-sm font-black text-slate-800">{formatGHS(discountedTotal)}</span>
              <span className="text-[10px] text-emerald-600 font-bold block">{tierDiscountPercent}% Off</span>
            </div>
          </div>

          {/* Savings Highlight */}
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
              <TrendingUp size={14} className="text-emerald-600" />
              Direct Margin Savings
            </div>
            <div className="mt-1 text-xl font-black text-emerald-700">
              {formatGHS(simulatedSavings)}
            </div>
            <p className="text-[10px] text-emerald-700 mt-0.5">
              Achieved by consolidating small recurring POs into optimal volume tiers
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
