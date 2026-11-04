import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  RefreshCw,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  BarChart2,
  LineChart as LineChartIcon,
  Activity,
  Layers,
  Sparkles,
  Clock,
  DollarSign
} from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { formatGHS } from '../../lib/formatters';

export interface DailyTrendPoint {
  date: string;
  label: string;
  day: string;
  total: number;
  sales_count: number;
  [key: string]: any;
}

export type TimeframeOption = 'today' | '7days' | '14days' | '30days';
export type ChartTypeOption = 'area' | 'bar' | 'line';
export type MetricViewOption = 'revenue' | 'orders' | 'dual';

interface DailyRevenueChartProps {
  initialTimeframe?: TimeframeOption;
  className?: string;
  onRefreshParent?: () => void;
}

export default function DailyRevenueChart({
  initialTimeframe = '7days',
  className = '',
  onRefreshParent
}: DailyRevenueChartProps) {
  const [data, setData] = useState<DailyTrendPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeframe, setTimeframe] = useState<TimeframeOption>(initialTimeframe);
  const [chartType, setChartType] = useState<ChartTypeOption>('area');
  const [metricView, setMetricView] = useState<MetricViewOption>('revenue');

  const loadData = async (tf: TimeframeOption = timeframe) => {
    setLoading(true);
    try {
      const res = await fetchApi(`/reports/sales-trends?timeframe=${tf}`);
      if (Array.isArray(res) && res.length > 0) {
        setData(res);
      } else {
        // Fallback baseline if no sales recorded yet
        setData([]);
      }
    } catch (err) {
      console.error('[DailyRevenueChart] Failed to load trends:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(timeframe);
  }, [timeframe]);

  // Normalized data for Recharts
  const chartData = useMemo(() => {
    return data.map((pt) => {
      let displayLabel = pt.day || pt.label || pt.date;
      if (timeframe === 'today') {
        displayLabel = pt.date; // e.g. "09:00"
      } else if (pt.date && !pt.date.includes(':')) {
        const d = new Date(pt.date);
        if (!isNaN(d.getTime())) {
          displayLabel = d.toLocaleDateString('en-US', {
            weekday: 'short',
            month: timeframe === '30days' ? 'numeric' : 'short',
            day: 'numeric'
          });
        }
      }

      const rev = Number(pt.total) || 0;
      const count = Number(pt.sales_count) || 0;
      const aov = count > 0 ? rev / count : 0;

      return {
        ...pt,
        displayLabel,
        total: rev,
        sales_count: count,
        aov
      };
    });
  }, [data, timeframe]);

  // Performance Math & Key Indicators
  const metrics = useMemo(() => {
    const totalRev = chartData.reduce((acc, curr) => acc + curr.total, 0);
    const totalOrders = chartData.reduce((acc, curr) => acc + curr.sales_count, 0);
    const daysCount = chartData.length || 1;
    const avgDailyRev = totalRev / daysCount;
    const avgDailyOrders = totalOrders / daysCount;
    const overallAOV = totalOrders > 0 ? totalRev / totalOrders : 0;

    const sortedByRev = [...chartData].sort((a, b) => b.total - a.total);
    const peakDay = sortedByRev[0] || null;

    return {
      totalRev,
      totalOrders,
      avgDailyRev,
      avgDailyOrders,
      overallAOV,
      peakDay
    };
  }, [chartData]);

  // Export visible chart data to CSV
  const handleExportCSV = () => {
    if (chartData.length === 0) return;
    const headers = ['Timeframe Point', 'Date/Hour', 'Gross Revenue (GHS)', 'Orders Count', 'Average Order Value (GHS)'];
    const rows = chartData.map((d) => [
      `"${d.displayLabel}"`,
      `"${d.date}"`,
      d.total.toFixed(2),
      d.sales_count,
      d.aov.toFixed(2)
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily_revenue_${timeframe}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Custom High-Precision Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const current = payload[0].payload;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[210px] space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-black text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            {timeframe === 'today' ? <Clock size={13} className="text-blue-400" /> : <Calendar size={13} className="text-blue-400" />}
            {current.displayLabel}
          </span>
          <span className="text-[10px] font-mono text-slate-400 font-bold">
            {current.date}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Gross Revenue:</span>
            </span>
            <strong className="text-white font-mono text-sm font-black">
              {formatGHS(current.total)}
            </strong>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Orders:</span>
            </span>
            <strong className="text-emerald-400 font-mono font-bold">
              {current.sales_count} {current.sales_count === 1 ? 'ticket' : 'tickets'}
            </strong>
          </div>

          {current.sales_count > 0 && (
            <div className="flex items-center justify-between text-slate-300 pt-1.5 border-t border-slate-800/80 text-[11px]">
              <span className="text-slate-400">Avg Ticket (AOV):</span>
              <strong className="text-amber-300 font-mono font-semibold">
                {formatGHS(current.aov)}
              </strong>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden ${className}`}>
      {/* Header Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Daily Revenue & Store Performance
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                {timeframe === 'today' ? 'Today (Hourly)' : timeframe === '7days' ? 'Past 7 Days' : timeframe === '14days' ? 'Past 14 Days' : 'Past 30 Days'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Real-time revenue monitoring, daily sales velocity, and checkout transaction metrics.
            </p>
          </div>
        </div>

        {/* Interactive Controls (Timeframe, Chart Type, Metric, Actions) */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          {/* Timeframe Selector */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: '7days', label: '7 Days' },
                { id: '14days', label: '14 Days' },
                { id: '30days', label: '30 Days' }
              ] as const
            ).map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTimeframe(tf.id)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs ${
                  timeframe === tf.id
                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart Type Selector */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setChartType('area')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                chartType === 'area' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Area Gradient View"
            >
              <Activity size={13} />
              <span className="hidden sm:inline">Area</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                chartType === 'bar' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Daily Bar Comparison"
            >
              <BarChart2 size={13} />
              <span className="hidden sm:inline">Bars</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                chartType === 'line' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Trend Line View"
            >
              <LineChartIcon size={13} />
              <span className="hidden sm:inline">Line</span>
            </button>
          </div>

          {/* Metric View Mode */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setMetricView('revenue')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                metricView === 'revenue' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ₵ Revenue
            </button>
            <button
              type="button"
              onClick={() => setMetricView('orders')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                metricView === 'orders' ? 'bg-white text-emerald-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Orders
            </button>
            <button
              type="button"
              onClick={() => setMetricView('dual')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                metricView === 'dual' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dual
            </button>
          </div>

          {/* Export & Refresh */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={chartData.length === 0}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer disabled:opacity-40"
            title="Export chart data to CSV"
          >
            <Download size={14} />
          </button>

          <button
            type="button"
            onClick={() => {
              loadData(timeframe);
              if (onRefreshParent) onRefreshParent();
            }}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer disabled:opacity-40"
            title="Refresh daily revenue data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Performance Quick Monitoring Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 sm:px-5 border-b border-slate-100 text-xs">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Period Revenue</span>
          <span className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight block mt-0.5 truncate">
            {formatGHS(metrics.totalRev)}
          </span>
          <span className="text-[11px] text-slate-500 font-medium truncate block">
            Avg {formatGHS(metrics.avgDailyRev)} / {timeframe === 'today' ? 'hour' : 'day'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer Orders</span>
          <span className="text-base sm:text-lg font-black text-blue-600 font-mono tracking-tight block mt-0.5">
            {metrics.totalOrders} <span className="text-xs font-normal text-slate-400">tickets</span>
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            Avg {metrics.avgDailyOrders.toFixed(1)} / {timeframe === 'today' ? 'hr' : 'day'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Peak Velocity</span>
          <span className="text-base sm:text-lg font-black text-emerald-600 font-mono tracking-tight block mt-0.5 truncate">
            {metrics.peakDay ? formatGHS(metrics.peakDay.total) : '₵0.00'}
          </span>
          <span className="text-[11px] text-slate-500 font-medium truncate block">
            {metrics.peakDay?.displayLabel || '—'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Ticket Size</span>
          <span className="text-base sm:text-lg font-black text-amber-600 font-mono tracking-tight block mt-0.5">
            {formatGHS(metrics.overallAOV)}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Spend per checkout</span>
        </div>
      </div>

      {/* Recharts Canvas */}
      <div className="p-4 sm:p-5 pt-3">
        <div className="h-[270px] sm:h-[300px] w-full min-w-0 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center z-10 text-xs font-bold text-slate-600">
              <RefreshCw size={18} className="animate-spin text-blue-600 mr-2" />
              <span>Updating daily revenue visualization...</span>
            </div>
          )}

          {chartData.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
              <Calendar size={28} className="text-slate-300 mb-2" />
              <p className="font-bold">No completed sales recorded for this timeframe.</p>
              <p className="text-[11px] mt-0.5">New register transactions will visualize automatically.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240} initialDimension={{ width: 600, height: 280 }}>
              {chartType === 'area' ? (
                <AreaChart data={chartData} margin={{ top: 12, right: 16, left: -6, bottom: 4 }}>
                  <defs>
                    <linearGradient id="dailyRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="dailyOrdersGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                  <XAxis
                    dataKey="displayLabel"
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
                      <Area
                        yAxisId="left"
                        name="Gross Revenue (₵)"
                        type="monotone"
                        dataKey="total"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#dailyRevenueGradient)"
                      />
                      <Area
                        yAxisId="right"
                        name="Orders"
                        type="monotone"
                        dataKey="sales_count"
                        stroke="#059669"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fillOpacity={1}
                        fill="url(#dailyOrdersGradient)"
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
                      <Area
                        type="monotone"
                        name="Customer Orders"
                        dataKey="sales_count"
                        stroke="#059669"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#dailyOrdersGradient)"
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
                      <Area
                        type="monotone"
                        name="Gross Revenue"
                        dataKey="total"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#dailyRevenueGradient)"
                      />
                    </>
                  )}
                </AreaChart>
              ) : chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 12, right: 16, left: -6, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="displayLabel"
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
                      <Bar yAxisId="left" name="Gross Revenue (₵)" dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Bar yAxisId="right" name="Orders" dataKey="sales_count" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={36} />
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
                      <Bar name="Orders" dataKey="sales_count" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={44} />
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
                      <Bar name="Gross Revenue" dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={44}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={metrics.peakDay && entry.total === metrics.peakDay.total && entry.total > 0 ? '#1d4ed8' : '#3b82f6'}
                          />
                        ))}
                      </Bar>
                    </>
                  )}
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 12, right: 16, left: -6, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="displayLabel"
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
                        name="Gross Revenue (₵)"
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
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
