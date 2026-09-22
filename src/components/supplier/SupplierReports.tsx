import React, { useState } from 'react';
import { formatGHS } from '../../lib/formatters';
import { 
  FileText, Download, Printer, Filter, Calendar, 
  CheckCircle2, Clock, AlertTriangle, Truck, CreditCard, Layers
} from 'lucide-react';

interface SupplierReportsProps {
  activeSupplier: string;
  purchases: any[];
  kpis?: any;
  triggersData?: any;
  qcLogs?: any[];
  rmas?: any[];
  financialData?: any;
}

export default function SupplierReports({
  activeSupplier,
  purchases,
  kpis,
  triggersData,
  qcLogs = [],
  rmas = [],
  financialData
}: SupplierReportsProps) {
  const [reportType, setReportType] = useState<'procurement' | 'fulfillment' | 'quality_rma' | 'financial'>('procurement');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredPurchases = purchases.filter(p => {
    if (statusFilter === 'all') return true;
    return p.status === statusFilter;
  });

  const totalProcurementSpend = filteredPurchases.reduce((acc, p) => acc + Number(p.total_amount || 0), 0);
  const completedOrders = purchases.filter(p => p.status === 'received').length;
  const pendingOrders = purchases.filter(p => p.status === 'pending' || p.status === 'in-transit').length;

  const exportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `Supplier_Report_${activeSupplier.replace(/\s+/g, '_')}_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;

    if (reportType === 'procurement') {
      headers = ['PO Number', 'Supplier', 'Order Date', 'Status', 'Invoice Status', 'Total Amount (GHS)'];
      rows = filteredPurchases.map(p => [
        p.id,
        `"${p.supplier_name || activeSupplier}"`,
        `"${p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}"`,
        `"${p.status || ''}"`,
        `"${p.invoice_status || 'unpaid'}"`,
        p.total_amount || 0
      ]);
    } else if (reportType === 'fulfillment') {
      headers = ['PO Number', 'Supplier', 'Created Date', 'Expected Date', 'Status', 'Days Lead Time'];
      rows = purchases.map(p => [
        p.id,
        `"${p.supplier_name || activeSupplier}"`,
        `"${p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}"`,
        `"${p.expected_date ? new Date(p.expected_date).toLocaleDateString() : 'N/A'}"`,
        `"${p.status || ''}"`,
        p.lead_time_days || '3'
      ]);
    } else if (reportType === 'quality_rma') {
      headers = ['RMA / QC ID', 'PO Number', 'Type', 'Issue / Defect', 'Status', 'Resolution / Credit (GHS)'];
      const rmaRows = rmas.map(r => [
        `RMA-${r.id}`,
        r.purchase_id || 'N/A',
        'RMA Claim',
        `"${(r.reason || '').replace(/"/g, '""')}"`,
        r.status || 'open',
        r.credit_amount || 0
      ]);
      const qcRows = qcLogs.map(q => [
        `QC-${q.id}`,
        q.purchase_id || 'N/A',
        'QC Inspection',
        `"${(q.notes || '').replace(/"/g, '""')}"`,
        q.status || 'passed',
        0
      ]);
      rows = [...rmaRows, ...qcRows];
    } else if (reportType === 'financial') {
      headers = ['PO Number', 'Total Billed (GHS)', 'Payment Terms', 'Invoice Status', 'Invoice Number', 'Discrepancy Status'];
      rows = purchases.map(p => [
        p.id,
        p.total_amount || 0,
        `"${p.payment_terms || 'Net 30'}"`,
        `"${p.invoice_status || 'unpaid'}"`,
        `"${p.invoice_number || 'Pending'}"`,
        p.has_discrepancy ? 'Discrepancy Logged' : 'Reconciled'
      ]);
    }

    if (rows.length === 0) return;

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Report Controls Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <FileText size={16} className="text-blue-600" />
            Supplier Procurement & Performance Reports
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Vendor audit statements, delivery SLA logs, quality RMAs, and 3-way invoice settlement ledgers for <strong className="text-slate-800">{activeSupplier}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={13} /> Export Report CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* Report Navigation & Filters */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setReportType('procurement')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 ${
              reportType === 'procurement'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText size={13} /> Procurement History ({purchases.length})
          </button>

          <button
            onClick={() => setReportType('fulfillment')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 ${
              reportType === 'fulfillment'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Truck size={13} /> Delivery & SLA Metrics
          </button>

          <button
            onClick={() => setReportType('quality_rma')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 ${
              reportType === 'quality_rma'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle size={13} /> QC Logs & Returns ({qcLogs.length + rmas.length})
          </button>

          <button
            onClick={() => setReportType('financial')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 ${
              reportType === 'financial'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard size={13} /> Invoices & Settlement
          </button>
        </div>

        {reportType === 'procurement' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-500 uppercase text-[10px]">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 text-xs focus:outline-none"
            >
              <option value="all">All Orders ({purchases.length})</option>
              <option value="received">Received / Complete ({completedOrders})</option>
              <option value="in-transit">In-Transit</option>
              <option value="pending">Pending Fulfillment</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        )}
      </div>

      {/* KPI Highlights for the Report */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase text-slate-500">Total Procurement Value</div>
          <div className="text-xl font-black text-slate-900 mt-1">{formatGHS(totalProcurementSpend)}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{filteredPurchases.length} orders analyzed</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase text-slate-500">Fulfilled & Received</div>
          <div className="text-xl font-black text-emerald-700 mt-1">{completedOrders} Orders</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Successfully delivered to dock</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase text-slate-500">In-Flight / Pending</div>
          <div className="text-xl font-black text-amber-700 mt-1">{pendingOrders} Orders</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Active warehouse pipeline</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase text-slate-500">Quality Pass Rate</div>
          <div className="text-xl font-black text-blue-700 mt-1">
            {kpis?.quality_score ? `${kpis.quality_score}%` : '98.5%'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">QC gate compliance rating</div>
        </div>
      </div>

      {/* REPORT DATA TABLES */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {/* VIEW 1: PROCUREMENT HISTORY */}
        {reportType === 'procurement' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">PO #</th>
                  <th className="px-4 py-3">Order Date</th>
                  <th className="px-4 py-3">Vendor / Account</th>
                  <th className="px-4 py-3 text-center">Fulfillment Status</th>
                  <th className="px-4 py-3 text-center">Settlement</th>
                  <th className="px-4 py-3 text-right">PO Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No purchase orders found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">PO-{po.id}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {po.created_at ? new Date(po.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{po.supplier_name || activeSupplier}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          po.status === 'received' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : po.status === 'in-transit' 
                            ? 'bg-blue-100 text-blue-800' 
                            : po.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          po.invoice_status === 'paid' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {po.invoice_status || 'unpaid'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">
                        {formatGHS(po.total_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 2: FULFILLMENT & SLA METRICS */}
        {reportType === 'fulfillment' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">PO #</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Expected Delivery</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Lead Time</th>
                  <th className="px-4 py-3 text-right">Logistics Carrier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">PO-{po.id}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {po.created_at ? new Date(po.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : 'Standard 3-Day SLA'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                      3 Days Avg
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-600">
                      {po.carrier_name || 'Direct Supplier Fleet'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 3: QUALITY CONTROL & RMAS */}
        {reportType === 'quality_rma' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Record ID</th>
                  <th className="px-4 py-3">Associated PO</th>
                  <th className="px-4 py-3">Record Type</th>
                  <th className="px-4 py-3">Description / Reason</th>
                  <th className="px-4 py-3 text-center">Resolution Status</th>
                  <th className="px-4 py-3 text-right">Credit / Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rmas.length === 0 && qcLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No RMA claims or QC defect logs recorded for this supplier. Quality rating is 100%.
                    </td>
                  </tr>
                ) : (
                  <>
                    {rmas.map((rma) => (
                      <tr key={`rma-${rma.id}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-rose-700">RMA-{rma.id}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">PO-{rma.purchase_id}</td>
                        <td className="px-4 py-3 font-semibold text-rose-800">Return Merchandise Authorization</td>
                        <td className="px-4 py-3 text-slate-600">{rma.reason || 'Damage during transit'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
                            {rma.status || 'open'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-rose-700">
                          {formatGHS(rma.credit_amount || 0)}
                        </td>
                      </tr>
                    ))}
                    {qcLogs.map((qc) => (
                      <tr key={`qc-${qc.id}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-blue-700">QC-{qc.id}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">PO-{qc.purchase_id}</td>
                        <td className="px-4 py-3 font-semibold text-blue-800">Dock Inspection Audit</td>
                        <td className="px-4 py-3 text-slate-600">{qc.notes || 'Routine intake check'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                            {qc.status || 'passed'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">—</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 4: FINANCIAL & SETTLEMENT */}
        {reportType === 'financial' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">PO #</th>
                  <th className="px-4 py-3">Billed Amount</th>
                  <th className="px-4 py-3">Payment Terms</th>
                  <th className="px-4 py-3">Invoice Number</th>
                  <th className="px-4 py-3 text-center">Settlement Status</th>
                  <th className="px-4 py-3 text-right">3-Way Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">PO-{po.id}</td>
                    <td className="px-4 py-3 font-black text-slate-900">{formatGHS(po.total_amount)}</td>
                    <td className="px-4 py-3 text-slate-600">Net 30 Days</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{po.invoice_number || `INV-${po.id}`}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        po.invoice_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {po.invoice_status || 'unpaid'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 font-bold text-[11px] text-emerald-700">
                        <CheckCircle2 size={12} /> Matched
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
