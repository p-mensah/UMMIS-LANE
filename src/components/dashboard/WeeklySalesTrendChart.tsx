import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  Calendar, 
  ShoppingCart, 
  RefreshCw, 
  Award, 
  ArrowUpRight,
  Sparkles,
  BarChart2
} from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { formatGHS } from '../../lib/formatters';

export interface WeeklyTrendPoint {
  date: string;
  label: string;
  day: string;
  total: number;
  sales_count: number;
  [key: string]: any;
}

interface WeeklySalesTrendChartProps {
  initialData?: WeeklyTrendPoint[];
  className?: string;
  onRefreshParent?: () => void;
}

export default function WeeklySalesTrendChart({
  initialData,
  className = '',
  onRefreshParent
}: WeeklySalesTrendChartProps) {
  const [data, setData] = useState<WeeklyTrendPoint[]>(initialData || []);
  const [loading, setLoading] = useState<boolean>(!initialData || initialData.length === 0);
  const [metricView, setMetricView] = useState<'revenue' | 'orders' | 'dual'>('revenue');

  const loadWeeklyTrends = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/reports/sales-trends?timeframe=7days');
      if (Array.isArray(res) && res.length > 0) {
        setData(res);
      } else {
        // Fallback: build 7 baseline calendar days
        const baseline: WeeklyTrendPoint[] = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const displayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const shortDay = d.toLocaleDateString('en-US', { weekday: 'short' });
          baseline.push({
            date: dateStr,
            label: displayLabel,
            day: shortDay,
            total: 0,
            sales_count: 0
          });
        }
        setData(baseline);
      }
    } catch (err) {
      console.error('Failed to load weekly sales trends', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData || initialData.length === 0) {
      loadWeeklyTrends();
    } else {
      setData(initialData);
    }
  }, [initialData]);

  // Formatted data points with weekday label and AOV
  const chartData = useMemo(() => {
    return data.map(pt => {
      let weekday = pt.day;
      if (pt.date) {
        const d = new Date(pt.date);
        if (!isNaN(d.getTime())) {
          weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
        }
      }
      const rev = Number(pt.total) || 0;
      const count = Number(pt.sales_count) || 0;
      const aov = count > 0 ? rev / count : 0;
      return {
        ...pt,
        displayDay: weekday,
        fullLabel: pt.label || pt.date || weekday,
        total: rev,
        sales_count: count,
        aov
      };
    });
  }, [data]);

  // 7-Day Performance Math
  const metrics = useMemo(() => {
    const totalRev = chartData.reduce((acc, curr) => acc + curr.total, 0);
    const totalOrders = chartData.reduce((acc, curr) => acc + curr.sales_count, 0);
    const avgDaily = chartData.length > 0 ? totalRev / chartData.length : 0;
    const avgDailyOrders = chartData.length > 0 ? totalOrders / chartData.length : 0;
    const sorted = [...chartData].sort((a, b) => b.total - a.total);
    const peakDay = sorted[0] || null;

    return {
      totalRev,
      totalOrders,
      avgDaily,
      avgDailyOrders,
      peakDay
    };
  }, [chartData]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const current = payload[0].payload as WeeklyTrendPoint & { fullLabel: string; aov: number };

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 sm:p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[200px] space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-black text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Calendar size={13} className="text-blue-400" />
            {current.fullLabel}
          </span>
          <span className="text-[10px] font-mono font-bold text-slate-400">
            {current.date}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Revenue:</span>
            </span>
            <strong className="text-white font-mono text-sm">{formatGHS(current.total)}</strong>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Orders:</span>
            </span>
            <strong className="text-white font-mono">{current.sales_count} sale(s)</strong>
          </div>

          {current.sales_count > 0 && (
            <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">Avg Ticket:</span>
              <strong className="text-amber-300 font-mono">{formatGHS(current.aov)}</strong>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden ${className}`}>
      {/* Chart Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <TrendingUp size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Weekly Sales Trend
              </h2>
              <span className="text-[10px] text-slate-400 font-medium">·</span>
              <span className="text-[11px] font-bold text-blue-600">Past 7 Days</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Day-by-day revenue velocity and sales performance across the last 7 calendar days.
            </p>
          </div>
        </div>

        {/* Metric Selector & Refresh Control */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setMetricView('revenue')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                metricView === 'revenue' 
                  ? 'bg-white text-blue-700 shadow-2xs font-black' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Revenue (₵)
            </button>
            <button
              type="button"
              onClick={() => setMetricView('orders')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                metricView === 'orders' 
                  ? 'bg-white text-emerald-700 shadow-2xs font-black' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Orders
            </button>
            <button
              type="button"
              onClick={() => setMetricView('dual')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                metricView === 'dual' 
                  ? 'bg-white text-indigo-700 shadow-2xs font-black' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dual Axis
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              loadWeeklyTrends();
              if (onRefreshParent) onRefreshParent();
            }}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
            title="Refresh weekly trends"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* 4-Item Quick Stats Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 sm:px-5 border-b border-slate-100 text-xs">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">7-Day Gross Revenue</span>
          <span className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight block mt-0.5">
            {formatGHS(metrics.totalRev)}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Avg {formatGHS(metrics.avgDaily)} / day</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed Orders</span>
          <span className="text-base sm:text-lg font-black text-blue-600 font-mono tracking-tight block mt-0.5">
            {metrics.totalOrders} <span className="text-xs font-normal text-slate-400">sales</span>
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Avg {metrics.avgDailyOrders.toFixed(1)} / day</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Peak Revenue Day</span>
          <span className="text-base sm:text-lg font-black text-emerald-600 font-mono tracking-tight block mt-0.5 truncate">
            {metrics.peakDay ? formatGHS(metrics.peakDay.total) : '₵0.00'}
          </span>
          <span className="text-[11px] text-slate-500 font-medium truncate block">
            {metrics.peakDay?.displayDay || metrics.peakDay?.label || '—'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Ticket Size</span>
          <span className="text-base sm:text-lg font-black text-amber-600 font-mono tracking-tight block mt-0.5">
            {metrics.totalOrders > 0 ? formatGHS(metrics.totalRev / metrics.totalOrders) : '₵0.00'}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Spend per checkout</span>
        </div>
      </div>

      {/* Recharts Canvas */}
      <div className="p-4 sm:p-5 pt-3">
        <div className="h-[260px] sm:h-[280px] w-full min-w-0 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center z-10 text-xs font-bold text-slate-600">
              Loading 7-day revenue trend...
            </div>
          )}

          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
            <LineChart data={chartData} margin={{ top: 12, right: 16, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              
              <XAxis 
                dataKey="displayDay" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                dy={6}
              />

              {metricView === 'dual' ? (
                <>
                  <YAxis 
                    yAxisId="left"
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 10, fill: '#2563eb', fontWeight: 600 }} 
                    tickFormatter={(v) => `₵${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 10, fill: '#059669', fontWeight: 600 }} 
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingBottom: 8 }} 
                  />
                  <Line 
                    yAxisId="left"
                    name="Revenue (₵)"
                    type="monotone" 
                    dataKey="total" 
                    stroke="#2563eb" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#ffffff', strokeWidth: 2.5, stroke: '#2563eb' }}
                    activeDot={{ r: 7, fill: '#1d4ed8', stroke: '#dbeafe', strokeWidth: 3 }} 
                  />
                  <Line 
                    yAxisId="right"
                    name="Orders"
                    type="monotone" 
                    dataKey="sales_count" 
                    stroke="#059669" 
                    strokeWidth={2.5} 
                    strokeDasharray="4 4"
                    dot={{ r: 3.5, fill: '#ffffff', strokeWidth: 2, stroke: '#059669' }}
                    activeDot={{ r: 6, fill: '#047857', stroke: '#d1fae5', strokeWidth: 2.5 }} 
                  />
                </>
              ) : metricView === 'orders' ? (
                <>
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="sales_count" 
                    stroke="#059669" 
                    strokeWidth={3} 
                    dot={{ r: 4.5, fill: '#ffffff', strokeWidth: 2.5, stroke: '#059669' }}
                    activeDot={{ r: 7, fill: '#047857', stroke: '#d1fae5', strokeWidth: 3 }} 
                  />
                </>
              ) : (
                <>
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} 
                    tickFormatter={(v) => `₵${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#2563eb" 
                    strokeWidth={3} 
                    dot={{ r: 4.5, fill: '#ffffff', strokeWidth: 2.5, stroke: '#2563eb' }}
                    activeDot={{ r: 7, fill: '#1d4ed8', stroke: '#dbeafe', strokeWidth: 3 }} 
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
