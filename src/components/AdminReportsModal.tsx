import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { 
  FileText, Download, Calendar, Filter, X, ChevronRight, 
  TrendingUp, Package, AlertTriangle, Users, Printer
} from 'lucide-react';

interface AdminReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'daily' | 'monthly' | 'staff' | 'inventory';
}

export default function AdminReportsModal({ isOpen, onClose, defaultTab = 'daily' }: AdminReportsModalProps) {
  useModalDismiss(isOpen, onClose);

  const [activeReportTab, setActiveReportTab] = useState<'daily' | 'monthly' | 'staff' | 'inventory'>(defaultTab);
  const [loading, setLoading] = useState(false);

  // Daily Summary State
  const [dailyData, setDailyData] = useState<any>(null);

  // Monthly Report State
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [monthlyData, setMonthlyData] = useState<any>(null);

  // Staff Summary State
  const [staffData, setStaffData] = useState<any[]>([]);

  // Inventory Status State
  const [inventoryReport, setInventoryReport] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (activeReportTab === 'daily') {
      loadDailyReport();
    } else if (activeReportTab === 'monthly') {
      loadMonthlyReport(selectedMonth);
    } else if (activeReportTab === 'staff') {
      loadStaffReport();
    } else if (activeReportTab === 'inventory') {
      loadInventoryReport();
    }
  }, [isOpen, activeReportTab, selectedMonth]);

  const loadDailyReport = async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/reports/daily-summary');
      setDailyData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyReport = async (month: string) => {
    setLoading(true);
    try {
      const data = await fetchApi(`/reports/monthly-summary?month=${month}`);
      setMonthlyData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadStaffReport = async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/reports/staff-performance');
      setStaffData(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryReport = async () => {
    setLoading(true);
    try {
      const [lowStock, summary] = await Promise.all([
        fetchApi('/reports/low-stock').catch(() => []),
        fetchApi('/reports/summary').catch(() => null)
      ]);
      setInventoryReport({
        lowStock: Array.isArray(lowStock) ? lowStock : [],
        summary
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportCurrentReportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let fileName = `Admin_Report_${activeReportTab}_${new Date().toISOString().split('T')[0]}.csv`;

    if (activeReportTab === 'daily' && dailyData) {
      headers = ['Metric', 'Value'];
      rows = [
        ['Report Date', dailyData.date || new Date().toISOString().split('T')[0]],
        ['Total Gross Sales (GHS)', dailyData.totalSales || 0],
        ['Completed Transactions', dailyData.salesCount || 0],
        ['Estimated Gross Profit (GHS)', dailyData.grossProfit || 0],
        ['Total Operational Expenses (GHS)', dailyData.totalExpenses || 0],
        ['Net Cash Revenue (GHS)', dailyData.netCash || 0]
      ];
    } else if (activeReportTab === 'monthly' && monthlyData) {
      headers = ['Category', 'Gross Revenue (GHS)', 'Estimated Cost (GHS)', 'Gross Profit (GHS)'];
      if (Array.isArray(monthlyData.categoryBreakdown)) {
        rows = monthlyData.categoryBreakdown.map((c: any) => [
          `"${c.category || 'General'}"`,
          c.total_revenue || 0,
          c.cost || 0,
          c.profit || 0
        ]);
      }
    } else if (activeReportTab === 'staff' && staffData.length > 0) {
      headers = ['Staff Name', 'Email', 'Role', 'Department', 'Orders Completed', 'Total Sales (GHS)'];
      rows = staffData.map((s: any) => [
        `"${s.name || ''}"`,
        `"${s.email || ''}"`,
        `"${s.role || ''}"`,
        `"${s.department || 'Retail'}"`,
        s.orders_count || 0,
        s.total_sales || 0
      ]);
    } else if (activeReportTab === 'inventory' && inventoryReport?.lowStock) {
      headers = ['Product ID', 'SKU', 'Product Name', 'Category', 'Stock Available', 'Min Stock Threshold', 'Selling Price (GHS)'];
      rows = inventoryReport.lowStock.map((p: any) => [
        p.id,
        `"${p.sku || ''}"`,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${p.category || 'General'}"`,
        p.stock_quantity,
        p.threshold || 10,
        p.selling_price || 0
      ]);
    }

    if (rows.length === 0) return;

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto py-8 custom-scrollbar animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Executive & Administrative Reports
              </h3>
              <p className="text-[11px] text-slate-400">Comprehensive sales, financial ledger, staff, and inventory audits</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition no-print"
          >
            <X size={18} />
          </button>
        </div>

        {/* Report Category Navigation Bar */}
        <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 no-print">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveReportTab('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeReportTab === 'daily'
                  ? 'bg-white text-blue-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar size={13} /> Daily EOD Audit
            </button>
            <button
              onClick={() => setActiveReportTab('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeReportTab === 'monthly'
                  ? 'bg-white text-blue-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp size={13} /> Monthly P&L Ledger
            </button>
            <button
              onClick={() => setActiveReportTab('staff')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeReportTab === 'staff'
                  ? 'bg-white text-blue-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={13} /> Staff Performance
            </button>
            <button
              onClick={() => setActiveReportTab('inventory')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeReportTab === 'inventory'
                  ? 'bg-white text-blue-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package size={13} /> Inventory Status
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCurrentReportCSV}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-bold transition flex items-center gap-1.5"
            >
              <Download size={13} /> Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-bold transition flex items-center gap-1.5"
            >
              <Printer size={13} /> Print
            </button>
          </div>
        </div>

        {/* Report Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs font-bold">
              Compiling report records...
            </div>
          ) : (
            <>
              {/* TAB 1: DAILY EOD AUDIT */}
              {activeReportTab === 'daily' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        End-of-Day Financial & Cash Audit
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Consolidated ledger for transactions recorded today
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                      Date: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-black uppercase text-slate-500">Gross Sales Revenue</div>
                      <div className="text-xl font-black text-slate-900 mt-1">{formatGHS(dailyData?.totalSales || 0)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{dailyData?.salesCount || 0} order(s) processed</div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-black uppercase text-slate-500">Estimated Gross Margin</div>
                      <div className="text-xl font-black text-emerald-700 mt-1">{formatGHS(dailyData?.grossProfit || 0)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Gain after product cost</div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-black uppercase text-slate-500">Operating Expenses</div>
                      <div className="text-xl font-black text-rose-700 mt-1">{formatGHS(dailyData?.totalExpenses || 0)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{dailyData?.expenseCount || 0} voucher(s) logged</div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-black uppercase text-slate-500">Net Retained Cash</div>
                      <div className="text-xl font-black text-blue-700 mt-1">{formatGHS(dailyData?.netCash || 0)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Gross revenue minus expenses</div>
                    </div>
                  </div>

                  {dailyData?.recentSales && dailyData.recentSales.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden mt-3">
                      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase">
                        Recent Transactions Today
                      </div>
                      <table className="w-full text-xs text-left divide-y divide-slate-100">
                        <thead className="bg-slate-100/70 text-[10px] uppercase font-bold text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Receipt #</th>
                            <th className="px-3 py-2">Customer</th>
                            <th className="px-3 py-2">Payment Method</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dailyData.recentSales.slice(0, 5).map((sale: any) => (
                            <tr key={sale.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-mono font-bold text-slate-800">#{sale.id}</td>
                              <td className="px-3 py-2 font-medium text-slate-700">{sale.customer_name || 'Walk-in Customer'}</td>
                              <td className="px-3 py-2 text-slate-600">{sale.payment_method || 'Cash'}</td>
                              <td className="px-3 py-2 text-right font-black text-slate-900">{formatGHS(sale.total_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MONTHLY P&L LEDGER */}
              {activeReportTab === 'monthly' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Monthly Financial Profit & Loss Statement
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Aggregated financial performance across departments and categories
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-600">Month:</label>
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-2.5 py-1 border border-slate-300 rounded text-xs font-bold bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Month Revenue</span>
                      <span className="text-lg font-black text-slate-900 mt-0.5 block">
                        {formatGHS(monthlyData?.totalRevenue || 0)}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Estimated Cost of Goods</span>
                      <span className="text-lg font-black text-slate-700 mt-0.5 block">
                        {formatGHS(monthlyData?.totalCogs || 0)}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Gross Profit Margin</span>
                      <span className="text-lg font-black text-emerald-700 mt-0.5 block">
                        {formatGHS(monthlyData?.grossProfit || 0)}
                      </span>
                    </div>
                  </div>

                  {monthlyData?.categoryBreakdown && monthlyData.categoryBreakdown.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
                      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase">
                        Revenue Contribution by Department / Category
                      </div>
                      <table className="w-full text-xs text-left divide-y divide-slate-100">
                        <thead className="bg-slate-100/70 text-[10px] uppercase font-bold text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Category</th>
                            <th className="px-3 py-2 text-right">Revenue</th>
                            <th className="px-3 py-2 text-right">Cost</th>
                            <th className="px-3 py-2 text-right">Profit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {monthlyData.categoryBreakdown.map((c: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-bold text-slate-800">{c.category || 'General'}</td>
                              <td className="px-3 py-2 text-right font-medium text-slate-700">{formatGHS(c.total_revenue || 0)}</td>
                              <td className="px-3 py-2 text-right text-slate-500">{formatGHS(c.cost || 0)}</td>
                              <td className="px-3 py-2 text-right font-black text-emerald-700">{formatGHS(c.profit || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: STAFF PERFORMANCE */}
              {activeReportTab === 'staff' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Cashier & Staff Sales Performance Ledger
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Individual sales transaction volume, order completion, and average ticket size
                    </p>
                  </div>

                  {staffData.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">
                      No staff sales transactions recorded for this reporting period.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs text-left divide-y divide-slate-100">
                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                          <tr>
                            <th className="px-3 py-2.5">Staff Member</th>
                            <th className="px-3 py-2.5">Role / Dept</th>
                            <th className="px-3 py-2.5 text-center">Orders Completed</th>
                            <th className="px-3 py-2.5 text-right">Gross Sales Volume</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {staffData.map((staff: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-2.5">
                                <div className="font-bold text-slate-900">{staff.name}</div>
                                <div className="text-[10px] text-slate-400">{staff.email}</div>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                                  {staff.role} • {staff.department || 'Retail'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800">
                                {staff.orders_count || 0}
                              </td>
                              <td className="px-3 py-2.5 text-right font-black text-slate-900">
                                {formatGHS(staff.total_sales || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: INVENTORY STATUS */}
              {activeReportTab === 'inventory' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Inventory Reorder & Low Stock Risk Audit
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Items nearing or breached below minimum safe operational thresholds
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left divide-y divide-slate-100">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                        <tr>
                          <th className="px-3 py-2.5">Product</th>
                          <th className="px-3 py-2.5">Category</th>
                          <th className="px-3 py-2.5 text-center">Available Stock</th>
                          <th className="px-3 py-2.5 text-center">Minimum Threshold</th>
                          <th className="px-3 py-2.5 text-center">Status</th>
                          <th className="px-3 py-2.5 text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {!inventoryReport?.lowStock || inventoryReport.lowStock.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">
                              No products currently below threshold. All stock levels are safe.
                            </td>
                          </tr>
                        ) : (
                          inventoryReport.lowStock.map((prod: any) => (
                            <tr key={prod.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2.5">
                                <div className="font-bold text-slate-900">{prod.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">SKU: {prod.sku}</div>
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">{prod.category || 'General'}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800">
                                {prod.stock_quantity}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono text-slate-600">
                                {prod.threshold || 10}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  prod.stock_quantity <= 0 
                                    ? 'bg-rose-100 text-rose-800' 
                                    : 'bg-amber-100 text-amber-900'
                                }`}>
                                  {prod.stock_quantity <= 0 ? 'Out of Stock' : 'Low Stock'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right font-black text-slate-900">
                                {formatGHS(prod.selling_price || 0)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            System generated real-time administrative report
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
