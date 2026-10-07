import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Receipt,
  Calendar,
  Sparkles,
  ArrowUpRight,
  Award,
  Layers,
  BarChart3
} from 'lucide-react';
import { formatGHS } from '../lib/formatters';

export interface SalesTrendDataPoint {
  date?: string;
  day: string;
  label?: string;
  total: number;
  sales_count: number;
}

interface DailySalesTrendChartProps {
  data: SalesTrendDataPoint[];
  timeframe: '7days' | '14days' | '30days' | 'monthly';
  onTimeframeChange: (timeframe: '7days' | '14days' | '30days' | 'monthly') => void;
  isLoading?: boolean;
}

export default function DailySalesTrendChart({
  data,
  timeframe,
  onTimeframeChange,
  isLoading = false
}: DailySalesTrendChartProps) {
  const [metricView, setMetricView] = useState<'revenue' | 'orders' | 'aov' | 'dual'>('revenue');
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');

  // Performance Math & Quick Insights
  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalRevenue: 0,
        totalOrders: 0,
        avgDailyRevenue: 0,
        avgDailyOrders: 0,
        avgOrderValue: 0,
        peakDay: null,
        lowestDay: null,
        insightText: 'No sales transactions recorded in this period yet.'
      };
    }

    const totalRevenue = data.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const totalOrders = data.reduce((acc, curr) => acc + (curr.sales_count || 0), 0);
    const dayCount = data.length || 1;
    const avgDailyRevenue = totalRevenue / dayCount;
    const avgDailyOrders = totalOrders / dayCount;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const sortedByRevenue = [...data].sort((a, b) => (b.total || 0) - (a.total || 0));
    const peakDay = sortedByRevenue[0] || null;
    const lowestDay = sortedByRevenue[sortedByRevenue.length - 1] || null;

    // Generate intelligent retail performance insight
    let insightText = '';
    if (totalRevenue === 0) {
      insightText = 'Awaiting completed sales transactions for this timeframe.';
    } else if (peakDay && peakDay.total > avgDailyRevenue * 1.5) {
      insightText = `Peak retail surge on ${peakDay.label || peakDay.day} (${formatGHS(peakDay.total)}), outperforming the daily average by +${Math.round(((peakDay.total - avgDailyRevenue) / (avgDailyRevenue || 1)) * 100)}%.`;
    } else if (data.length >= 7) {
      const mid = Math.floor(data.length / 2);
      const firstHalfRev = data.slice(0, mid).reduce((sum, d) => sum + (d.total || 0), 0);
      const secondHalfRev = data.slice(mid).reduce((sum, d) => sum + (d.total || 0), 0);
      const growth = firstHalfRev > 0 ? ((secondHalfRev - firstHalfRev) / firstHalfRev) * 100 : 0;
      if (growth > 5) {
        insightText = `Positive retail acceleration: Sales volume rose by +${growth.toFixed(1)}% in the latter half of the period.`;
      } else if (growth < -5) {
        insightText = `Steady retail pace averaging ${formatGHS(avgDailyRevenue)}/day across ${avgDailyOrders.toFixed(1)} daily transactions.`;
      } else {
        insightText = `Consistent daily revenue velocity: Averaging ${formatGHS(avgDailyRevenue)} per day with balanced turnover.`;
      }
    } else {
      insightText = `Daily sales run rate is ${formatGHS(avgDailyRevenue)}/day across ${avgDailyOrders.toFixed(1)} transactions.`;
    }

    return {
      totalRevenue,
      totalOrders,
      avgDailyRevenue,
      avgDailyOrders,
      avgOrderValue,
      peakDay,
      lowestDay,
      insightText
    };
  }, [data]);

  // Enrich data points with AOV and share of total
  const enrichedData = useMemo(() => {
    const totalRev = stats.totalRevenue || 1;
    return (data || []).map(point => {
      const rev = point.total || 0;
      const count = point.sales_count || 0;
      const aov = count > 0 ? Math.round(rev / count) : 0;
      const share = totalRev > 0 ? ((rev / totalRev) * 100).toFixed(1) : '0';
      return {
        ...point,
        aov,
        share: `${share}%`
      };
    });
  }, [data, stats.totalRevenue]);

  // Custom Rich Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const currentPoint = payload[0].payload as SalesTrendDataPoint & { aov: number; share: string };

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[210px] space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-black text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Calendar size={13} className="text-blue-400" />
            {currentPoint.date || label}
          </span>
          <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
            {currentPoint.share} of period
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Gross Sales:</span>
            </span>
            <strong className="text-white font-mono text-sm">{formatGHS(currentPoint.total)}</strong>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Completed Orders:</span>
            </span>
            <strong className="text-white font-mono">{currentPoint.sales_count} sale(s)</strong>
          </div>

          <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Avg Basket Size:</span>
            </span>
            <strong className="text-amber-300 font-mono">{formatGHS(currentPoint.aov)}</strong>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
      {/* Header with Title and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                Daily Sales Trend Visualization
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 rounded-full">
                  Retail Performance
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Day-by-day revenue velocity, customer footfall, transaction counts, and basket sizing.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Granularity Timeframe & Metric Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {[
              { id: '7days', label: '7 Days' },
              { id: '14days', label: '14 Days' },
              { id: '30days', label: '30 Days' },
              { id: 'monthly', label: '12 Months' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => onTimeframeChange(t.id as any)}
                className={`px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  timeframe === t.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Metric View Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {[
              { id: 'revenue', label: 'Revenue', icon: DollarSign },
              { id: 'orders', label: 'Orders', icon: ShoppingCart },
              { id: 'aov', label: 'Avg Ticket', icon: Receipt },
              { id: 'dual', label: 'Combo', icon: Layers }
            ].map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setMetricView(m.id as any)}
                  className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    metricView === m.id
                      ? 'bg-white text-slate-900 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={`View ${m.label}`}
                >
                  <Icon size={12} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Chart Type Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {[
              { id: 'area', label: 'Area' },
              { id: 'bar', label: 'Bar' },
              { id: 'line', label: 'Line' }
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setChartType(type.id as any)}
                className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  chartType === type.id
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* QUICK RETAIL INSIGHTS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 text-xs">
        <div className="space-y-0.5">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <DollarSign size={11} className="text-blue-600" />
            <span>Period Gross Sales</span>
          </div>
          <div className="text-lg font-black text-slate-900">
            {formatGHS(stats.totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Avg: <strong className="text-slate-700">{formatGHS(stats.avgDailyRevenue)}</strong> / day
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <ShoppingCart size={11} className="text-emerald-600" />
            <span>Completed Orders</span>
          </div>
          <div className="text-lg font-black text-slate-900">
            {stats.totalOrders} <span className="text-xs font-bold text-slate-500">tickets</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Avg: <strong className="text-slate-700">{stats.avgDailyOrders.toFixed(1)}</strong> orders / day
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Receipt size={11} className="text-amber-600" />
            <span>Average Order Value</span>
          </div>
          <div className="text-lg font-black text-amber-700">
            {formatGHS(stats.avgOrderValue)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Spend per customer visit
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Award size={11} className="text-purple-600" />
            <span>Top Performing Day</span>
          </div>
          <div className="text-lg font-black text-purple-700 truncate">
            {stats.peakDay ? formatGHS(stats.peakDay.total) : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500 font-medium truncate">
            {stats.peakDay?.label || stats.peakDay?.day || 'No sales recorded'}
          </div>
        </div>
      </div>

      {/* Retail Insight Callout Banner */}
      <div className="px-3.5 py-2 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center gap-2 text-xs text-blue-900">
        <Sparkles size={15} className="text-blue-600 shrink-0" />
        <span className="font-bold text-[11px] text-blue-950">Performance Insight:</span>
        <span className="text-[11px] text-blue-800 font-medium truncate">{stats.insightText}</span>
      </div>

      {/* RECHARTS VISUALIZATION CANVAS */}
      <div className="h-[300px] w-full min-w-0 pt-2 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center z-10 text-xs font-bold text-slate-600">
            Loading sales trends...
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260} initialDimension={{ width: 600, height: 280 }}>
          {metricView === 'dual' ? (
            /* COMBO CHART: Revenue Area + Orders Bar/Line */
            <ComposedChart data={enrichedData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="trendRevDual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `GHS ${v}`} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#10b981' }} tickFormatter={(v) => `${v} orders`} />
              <Tooltip content={<CustomTooltip />} />
              <Area yAxisId="left" type="monotone" dataKey="total" name="Revenue" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#trendRevDual)" />
              <Bar yAxisId="right" dataKey="sales_count" name="Orders" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} opacity={0.85} />
            </ComposedChart>
          ) : chartType === 'area' ? (
            /* AREA CHART */
            <AreaChart data={enrichedData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTrendMain" x1="0" y1="0" x2="0" y2="1">
                  <stop 
                    offset="5%" 
                    stopColor={metricView === 'orders' ? '#10b981' : metricView === 'aov' ? '#d97706' : '#2563eb'} 
                    stopOpacity={0.35} 
                  />
                  <stop 
                    offset="95%" 
                    stopColor={metricView === 'orders' ? '#10b981' : metricView === 'aov' ? '#d97706' : '#2563eb'} 
                    stopOpacity={0.02} 
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                tickFormatter={(v) => metricView === 'orders' ? `${v}` : `GHS ${v}`} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey={metricView === 'orders' ? 'sales_count' : metricView === 'aov' ? 'aov' : 'total'} 
                stroke={metricView === 'orders' ? '#059669' : metricView === 'aov' ? '#d97706' : '#2563eb'} 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#colorTrendMain)" 
              />
            </AreaChart>
          ) : chartType === 'bar' ? (
            /* BAR CHART */
            <BarChart data={enrichedData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                tickFormatter={(v) => metricView === 'orders' ? `${v}` : `GHS ${v}`} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey={metricView === 'orders' ? 'sales_count' : metricView === 'aov' ? 'aov' : 'total'} 
                fill={metricView === 'orders' ? '#10b981' : metricView === 'aov' ? '#f59e0b' : '#2563eb'} 
                radius={[5, 5, 0, 0]} 
                maxBarSize={40}
              />
            </BarChart>
          ) : (
            /* LINE CHART */
            <LineChart data={enrichedData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                tickFormatter={(v) => metricView === 'orders' ? `${v}` : `GHS ${v}`} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey={metricView === 'orders' ? 'sales_count' : metricView === 'aov' ? 'aov' : 'total'} 
                stroke={metricView === 'orders' ? '#059669' : metricView === 'aov' ? '#d97706' : '#2563eb'} 
                strokeWidth={2.5} 
                dot={{ r: 3.5, fill: '#ffffff', strokeWidth: 2, stroke: metricView === 'orders' ? '#059669' : '#2563eb' }}
                activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#bfdbfe', strokeWidth: 2 }} 
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
