import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  Receipt, 
  FileText, 
  Building2, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  SlidersHorizontal,
  CheckCircle2
} from 'lucide-react';
import { formatGHS, calculateGhanaTax } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';
import { getDisplayCustomerPhone, getDisplayCustomerEmail } from '../lib/privacy';

export type PrintReceiptFormat = 'receipt' | 'receipt-58' | 'a4';

export interface ReceiptItem {
  id?: number | string;
  product_id?: number;
  product_name?: string;
  name?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

export interface ReceiptData {
  id?: number | string;
  saleId?: number | string;
  sale_id?: number | string;
  receipt_number?: string;
  date?: Date | string;
  created_at?: string;
  total?: number;
  total_amount?: number;
  amount_paid?: number;
  change?: number;
  customerName?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  paymentMethod?: string;
  payment_method?: string;
  cashier_name?: string;
  user_name?: string;
  tax_amount?: number;
  items?: ReceiptItem[];
  status?: string;
  notes?: string;
  [key: string]: any;
}

export interface PrintPreviewModalProps {
  isOpen?: boolean;
  receiptData?: ReceiptData | null;
  /** Alias for receiptData to allow drop-in compatibility */
  saleData?: ReceiptData | null;
  data?: ReceiptData | null;
  title?: string;
  initialFormat?: PrintReceiptFormat;
  onClose: () => void;
  onPrint?: () => void;
}

/**
 * Deterministic SVG Barcode generator encoding the receipt reference
 */
function ScannableBarcode({ value, isNarrow = false }: { value: string; isNarrow?: boolean }) {
  const bars: number[] = [2, 1, 1, 2];
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    bars.push((code % 3) + 2);
    bars.push(((code >> 2) % 2) + 2);
  }
  bars.push(2, 2, 1, 3);

  // Scaled line spacing and 25%+ height increase for high-contrast thermal scanning
  const barWidth = isNarrow ? 1.3 : 1.6;
  const quietZone = isNarrow ? 12 : 16;
  const contentWidth = bars.reduce((sum, w) => sum + w * barWidth, 0);
  const totalSvgWidth = contentWidth + quietZone * 2;
  const barcodeHeight = isNarrow ? 48 : 54;

  return (
    <div className="flex flex-col items-center justify-center my-2.5 print:my-1.5">
      <div className="bg-white px-2 py-1 rounded-sm">
        <svg
          width={Math.min(totalSvgWidth, isNarrow ? 200 : 280)}
          height={barcodeHeight}
          viewBox={`0 0 ${totalSvgWidth} ${barcodeHeight}`}
          className="shape-rendering-crispEdges print:max-w-[220px]"
        >
          {(() => {
            let currentX = quietZone;
            return bars.map((w, idx) => {
              const x = currentX;
              const width = w * barWidth;
              currentX += width;
              if (idx % 2 === 0) {
                return (
                  <rect 
                    key={idx} 
                    x={x} 
                    y={0} 
                    width={Math.max(1.4, width - 0.2)} 
                    height={barcodeHeight} 
                    fill="#000000" 
                  />
                );
              }
              return null;
            });
          })()}
        </svg>
      </div>
      {/* Scaled up vertical code format with widened line spacing */}
      <span className="font-mono text-[10px] sm:text-[11px] font-extrabold tracking-[0.28em] text-slate-900 print:text-black mt-1">
        *{value}*
      </span>
    </div>
  );
}

/**
 * PrintPreviewModal:
 * Reusable modal component that takes receipt data as a prop and renders it within a clean,
 * centered overlay with a 'Print' button, ensuring all Tailwind print-specific classes are
 * correctly applied for perfect document formatting across standard thermal (80mm/58mm) and A4 paper.
 */
export default function PrintPreviewModal({
  isOpen = true,
  receiptData,
  saleData,
  data,
  title = 'Receipt Print Preview',
  initialFormat = 'receipt',
  onClose,
  onPrint
}: PrintPreviewModalProps) {
  const { user } = useAuth();
  const [format, setFormat] = useState<PrintReceiptFormat>(initialFormat);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialFormat) {
      setFormat(initialFormat);
    }
  }, [initialFormat]);

  // Normalize incoming receipt data from any prop alias
  const activeData: ReceiptData | null = receiptData || saleData || data || null;

  // Store configuration defaults
  const [storeSettings, setStoreSettings] = useState({
    store_name: 'Ummis Lane Enterprise',
    store_tagline: 'Retail & Wholesale Provisions',
    store_address: 'Accra, Ghana',
    store_phone: '0545570191 / 0591369282',
    store_email: 'Issakrabiat92@gmail.com',
    store_tin: 'TIN-GH90218821',
    tax_id: 'TIN-GH90218821',
    currency_symbol: '₵',
    currency_code: 'GHS',
    tax_percentage: '0',
    receipt_header: '',
    receipt_footer: 'Thank you for doing business with Ummis Lane Enterprise. Please inspect all goods upon receipt. Items returned within 7 days must be accompanied by this original receipt.'
  });

  useEffect(() => {
    let isMounted = true;
    fetchApi('/settings')
      .then(res => {
        if (isMounted && res && typeof res === 'object') {
          setStoreSettings(prev => ({
            ...prev,
            ...res,
            store_tin: res.store_tin || res.tax_id || prev.store_tin
          }));
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  if (!isOpen || !activeData) {
    return null;
  }

  // Formatting & calculations
  const rawId = activeData.id || activeData.saleId || activeData.sale_id || '0000';
  const receiptNumber = activeData.receipt_number || `REC-${String(rawId).padStart(5, '0')}`;
  
  const rawDate = activeData.date || activeData.created_at || new Date();
  const dateObj = typeof rawDate === 'string' 
    ? new Date(rawDate.endsWith('Z') ? rawDate : rawDate + 'Z') 
    : new Date(rawDate);
  const formattedDate = dateObj.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const customerName = activeData.customerName || activeData.customer_name || 'Walk-in Customer';
  const rawPhone = activeData.customer_phone || null;
  const rawEmail = activeData.customer_email || null;
  const customerPhone = getDisplayCustomerPhone(rawPhone, user?.role);
  const customerEmail = getDisplayCustomerEmail(rawEmail, user?.role);

  // Payment mode: CASH or MOMO
  const rawPaymentMethod = activeData.paymentMethod || activeData.payment_method || 'Cash';
  const displayPaymentMethod = rawPaymentMethod.toLowerCase().includes('momo') || rawPaymentMethod.toLowerCase().includes('mobile')
    ? 'MOMO'
    : 'CASH';

  const cashierName = activeData.cashier_name || activeData.user_name || user?.name || 'Staff Member';
  const grandTotal = activeData.total !== undefined ? activeData.total : (activeData.total_amount || 0);
  const amountPaid = activeData.amount_paid !== undefined ? activeData.amount_paid : grandTotal;
  const changeDue = activeData.change !== undefined ? activeData.change : Math.max(0, amountPaid - grandTotal);

  const taxPercentageNum = parseFloat(storeSettings.tax_percentage || '0') || 0;
  
  // Ghanaian GRA Tax breakdown calculation (NHIL 2.5%, GETFund 2.5%, COVID-19 1%, VAT 15%)
  const ghanaTax = calculateGhanaTax(grandTotal, taxPercentageNum, activeData.tax_amount);
  const subtotalAmount = ghanaTax.taxableSubtotal;
  const taxAmount = ghanaTax.totalTax;
  const hasTax = !ghanaTax.isExempt;

  const items: ReceiptItem[] = Array.isArray(activeData.items) ? activeData.items : [];

  const handlePrint = () => {
    setToastMessage(`Receipt #${receiptNumber} sent to printer successfully!`);
    if (onPrint) {
      onPrint();
    }
    window.print();
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto print:p-0 print:m-0 print:bg-white print:static print:inset-auto print:block no-scrollbar"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* 
        Print Media Rules:
        Configures page size per selected format and ensures zero clipping across thermal and desktop printers.
        CRITICAL: Isolates ONLY #print-preview-document and hides all other background elements,
        guaranteeing background app content never goes over or under the invoice or receipt.
      */}
      <style>{`
        @media print {
          @page {
            margin: ${format === 'receipt-58' ? '1mm 2mm' : format === 'receipt' ? '2mm 3mm' : '8mm 10mm'};
            size: ${format === 'receipt-58' ? '58mm auto' : format === 'receipt' ? '80mm auto' : 'A4 portrait'};
          }
          *, *::before, *::after {
            box-shadow: none !important;
            text-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          /* Hide EVERYTHING in the DOM during print */
          body * {
            visibility: hidden !important;
          }
          /* Reset modal traps */
          .fixed, [role="dialog"], .overflow-y-auto, .overflow-hidden {
            position: static !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            width: 100% !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            backdrop-filter: none !important;
          }
          /* Make ONLY #print-preview-document visible */
          #print-preview-document,
          #print-preview-document * {
            visibility: visible !important;
          }
          #print-preview-document {
            position: relative !important;
            display: block !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: ${format === 'receipt-58' ? '48mm !important' : format === 'receipt' ? '72mm !important' : '100% !important'};
            max-width: ${format === 'receipt-58' ? '48mm !important' : format === 'receipt' ? '72mm !important' : '100% !important'};
            padding: ${format === 'a4' ? '4mm 6mm !important' : '1mm 2mm !important'};
            font-family: ${format === 'a4' ? 'system-ui, -apple-system, sans-serif !important' : "'Courier New', Courier, monospace !important"};
            page-break-inside: auto;
            break-inside: auto;
          }
          .no-print {
            display: none !important;
            visibility: hidden !important;
          }
          tr, .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Transient Toast Notification element that hovers in the viewport area */}
      {toastMessage && (
        <div 
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[150] pointer-events-none transition-all duration-200 animate-in fade-in slide-in-from-top-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-900/95 text-white rounded-xl shadow-2xl border border-emerald-500/40 backdrop-blur-md text-xs font-semibold">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Centered Modal Container */}
      <div 
        className={`relative w-full ${format === 'a4' ? 'max-w-4xl sm:max-w-5xl' : 'max-w-xl'} bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] transition-all duration-200 print:max-w-none print:w-full print:max-h-none print:shadow-none print:border-none print:rounded-none print:bg-white`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= 1. OUTER MODAL LAYER: DARK HEADER BAR (#111827) ================= */}
        <div className="shrink-0 bg-[#111827] text-white px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 no-print print:hidden">
          {/* Left-aligned title "RECEIPT & INVOICE VIEWER #REC-..." and current transaction metadata */}
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-2 flex-wrap">
              <span>RECEIPT & INVOICE VIEWER</span>
              <span className="text-emerald-400 font-mono font-black">
                #{receiptNumber}
              </span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate mt-0.5">
              {storeSettings.store_name} • {formattedDate} • Cashier: {cashierName}
            </p>
          </div>

          {/* Right side: Grouped 3 toggle pills inside a single flex-row container + X close icon flush right */}
          <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto shrink-0">
            {/* Single flex-row container with subtle active borders */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setFormat('receipt')}
                className={`min-h-[32px] px-2.5 sm:px-3 py-1 text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer font-medium ${
                  format === 'receipt' 
                    ? 'bg-slate-800 text-white font-bold border border-slate-600 shadow-xs' 
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
                title="80mm Thermal Receipt (Standard)"
              >
                <span>80mm Thermal</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('receipt-58')}
                className={`min-h-[32px] px-2.5 sm:px-3 py-1 text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer font-medium ${
                  format === 'receipt-58' 
                    ? 'bg-slate-800 text-white font-bold border border-slate-600 shadow-xs' 
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
                title="58mm Compact Thermal Receipt"
              >
                <span>58mm Mini</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('a4')}
                className={`min-h-[32px] px-2.5 sm:px-3 py-1 text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer font-medium ${
                  format === 'a4' 
                    ? 'bg-slate-800 text-white font-bold border border-slate-600 shadow-xs' 
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
                title="A4 Full Page Document"
              >
                <span>A4 Official</span>
              </button>
            </div>

            {/* "X" close icon flush right */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
              aria-label="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ================= MAIN BACKGROUND BODY: CLEAN LIGHT-NEUTRAL CONTRAST GRAY (#F3F4F6) ================= */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 xs:p-4 sm:p-6 md:p-8 pb-12 bg-[#F3F4F6] flex justify-center items-start print:p-0 print:m-0 print:bg-white print:overflow-visible custom-scrollbar">
          
          {/* ================= 2. INNER RECEIPT PAPER WRAPPER: CRISP WHITE VERTICAL CONTAINER WITH SHARP EDGE BOUNDARIES & SUBTLE BOX SHADOW ================= */}
          <div
            id="print-preview-document"
            className={`bg-white shrink-0 transition-all shadow-md border border-slate-300 font-mono text-slate-900 leading-tight ${
              format === 'a4'
                ? 'w-full max-w-[840px] p-4 xs:p-5 sm:p-8 md:p-10 text-xs font-sans rounded-none sm:rounded-sm'
                : format === 'receipt-58'
                ? 'w-full max-w-[270px] p-3 pb-8 text-[10px] mx-auto rounded-none'
                : 'w-full max-w-[340px] p-4 sm:p-5 pb-8 text-xs mx-auto rounded-none'
            } print:w-full print:max-w-none print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white print:text-black print:block`}
          >
            {/* ================= 1. A4 OFFICIAL INVOICE VIEW ================= */}
            {format === 'a4' ? (
              <div className="space-y-5 sm:space-y-6">
                {/* Invoice Letterhead */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-5 sm:pb-6 border-b-2 border-slate-900">
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-900 rounded-xl p-2 sm:p-2.5 flex items-center justify-center text-white shadow-sm border border-slate-800 shrink-0">
                      <Building2 size={28} className="text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight break-words">
                        {storeSettings.store_name}
                      </h1>
                      <p className="text-[11px] sm:text-xs text-blue-600 font-bold uppercase tracking-wider">
                        {storeSettings.store_tagline}
                      </p>
                      {storeSettings.receipt_header && (
                        <p className="text-[10px] sm:text-[11px] font-semibold text-slate-700 italic mt-0.5">
                          {storeSettings.receipt_header}
                        </p>
                      )}
                      <div className="mt-1 text-[10px] sm:text-[11px] text-slate-500 space-y-0.5 break-words">
                        <p><span className="font-semibold text-slate-700">TIN:</span> {storeSettings.store_tin}</p>
                        <p><span className="font-semibold text-slate-700">Tel:</span> {storeSettings.store_phone}</p>
                        <p><span className="font-semibold text-slate-700">Email:</span> {storeSettings.store_email} · {storeSettings.store_address}</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0 w-full sm:w-auto">
                    <div className="inline-block bg-slate-900 text-white px-2.5 py-1 font-black text-[11px] uppercase tracking-widest rounded-md mb-1.5">
                      Official Sales Invoice
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900 break-all">
                      #{receiptNumber}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Issue Date: {formattedDate}
                    </div>
                    <div className="text-[10px] font-mono text-emerald-700 font-bold mt-1">
                      GRA FISCAL ID: GRA-GH-{rawId}
                    </div>
                  </div>
                </div>

                {/* Billed To / Cashier Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                  <div className="space-y-1">
                    <h3 className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                      Billed Customer
                    </h3>
                    <div className="text-xs font-black text-slate-900">{customerName}</div>
                    {customerPhone && <div className="text-[11px] text-slate-600">Tel: {customerPhone}</div>}
                    {customerEmail && <div className="text-[11px] text-slate-600">Email: {customerEmail}</div>}
                  </div>
                  <div className="space-y-1 sm:text-right">
                    <h3 className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                      Transaction Info
                    </h3>
                    <div className="text-xs text-slate-800">
                      <span className="font-bold">Attending Cashier:</span> {cashierName}
                    </div>
                    <div className="text-xs text-slate-800">
                      <span className="font-bold">Payment Method:</span> {displayPaymentMethod}
                    </div>
                  </div>
                </div>

                {/* Formal Line Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200">
                    <thead className="bg-slate-100 text-slate-800 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Price (₵)</th>
                        <th className="py-2.5 px-3 text-right">Total (₵)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-xs">
                      {items.map((item, idx) => {
                        const itemName = item.name || item.product_name || `Item #${item.product_id || idx + 1}`;
                        const lineTotal = item.quantity * item.unit_price;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 text-slate-400 font-sans">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold font-sans text-slate-900 break-words">{itemName}</td>
                            <td className="py-2 px-3 text-slate-500 text-[11px]">{item.sku || '-'}</td>
                            <td className="py-2 px-3 text-center font-bold text-slate-800 font-sans">{item.quantity}</td>
                            <td className="py-2 px-3 text-right text-slate-700">{formatGHS(item.unit_price)}</td>
                            <td className="py-2 px-3 text-right font-black text-slate-900">{formatGHS(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Ghanaian GRA Statutory Tax & Financial Summary Breakdown */}
                <div className="flex justify-end pt-2 print-avoid-break">
                  <div className="w-full sm:w-96 max-w-full space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 text-slate-600 border-b border-slate-100">
                      <span>Taxable Subtotal (Base):</span>
                      <span className="font-mono font-bold text-slate-900">{formatGHS(ghanaTax.taxableSubtotal)}</span>
                    </div>

                    {/* Ghana Statutory Levies Breakdown */}
                    <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/80 space-y-1 my-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pb-0.5 border-b border-slate-200 flex justify-between">
                        <span>Ghana Statutory Levies (GRA)</span>
                        <span>Rate</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>NHIL (Nat. Health Ins. Levy):</span>
                        <span className="font-mono">{ghanaTax.isExempt ? '₵0.00 (Exempt)' : formatGHS(ghanaTax.nhilAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>GETFund (Educ. Trust Fund):</span>
                        <span className="font-mono">{ghanaTax.isExempt ? '₵0.00 (Exempt)' : formatGHS(ghanaTax.getFundAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>COVID-19 Health Recovery Levy:</span>
                        <span className="font-mono">{ghanaTax.isExempt ? '₵0.00 (Exempt)' : formatGHS(ghanaTax.covidLevyAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>Standard VAT (15.0%):</span>
                        <span className="font-mono">{ghanaTax.isExempt ? '₵0.00 (Exempt)' : formatGHS(ghanaTax.vatAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-800 font-bold text-[11px] pt-1 border-t border-slate-200">
                        <span>Total Levies & VAT:</span>
                        <span className="font-mono">{formatGHS(ghanaTax.totalTax)}</span>
                      </div>
                    </div>

                    <div className="flex justify-between py-2 border-t-2 border-slate-900 font-black text-sm text-slate-900">
                      <span>Grand Total Payable:</span>
                      <span className="font-mono text-emerald-700">{formatGHS(grandTotal)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-600 border-t border-slate-200">
                      <span className="truncate mr-2">Amount Tendered ({displayPaymentMethod}):</span>
                      <span className="font-mono font-bold text-slate-900 shrink-0">{formatGHS(amountPaid)}</span>
                    </div>
                    {changeDue > 0 && (
                      <div className="flex justify-between py-1 text-emerald-700 font-bold">
                        <span>Change Due:</span>
                        <span className="font-mono shrink-0">{formatGHS(changeDue)}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-right font-bold text-emerald-600 uppercase tracking-wider pt-1 flex items-center justify-end gap-1">
                      <CheckCircle2 size={12} className="shrink-0" /> <span>GRA Compliant • Fully Settled</span>
                    </div>
                  </div>
                </div>

                {/* Terms & Authorization Stamp */}
                <div className="pt-6 sm:pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-xs text-slate-500 print-avoid-break">
                  <div>
                    <p className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-1">
                      Store Terms & Return Policy
                    </p>
                    <p className="text-[10px] leading-relaxed break-words">
                      {storeSettings.receipt_footer}
                    </p>
                  </div>
                  <div className="flex flex-col sm:items-end justify-end sm:text-right pt-2 sm:pt-0">
                    <div className="w-40 border-b border-slate-400 mb-1"></div>
                    <p className="text-[10px] font-bold text-slate-700 uppercase">Authorized Signature / Stamp</p>
                    <p className="text-[9px] text-slate-400">{storeSettings.store_name} POS System</p>
                  </div>
                </div>
              </div>
            ) : format === 'receipt-58' ? (
              /* ================= 2. POS COMPACT THERMAL RECEIPT (58mm MINI) ================= */
              <div className="space-y-2 text-center text-slate-900 font-mono text-[10px] leading-tight w-full">
                {/* 58mm Store Header */}
                <div className="pb-1.5 border-b border-dashed border-slate-400 space-y-0.5">
                  <div className="w-8 h-8 bg-black rounded p-1 mx-auto flex items-center justify-center text-white mb-1">
                    <Building2 size={18} />
                  </div>
                  <h2 className="font-black text-[11px] uppercase tracking-tight break-words">
                    {storeSettings.store_name}
                  </h2>
                  <p className="text-[9px] font-bold text-slate-700 uppercase break-words">
                    {storeSettings.store_tagline}
                  </p>
                  <p className="text-[8px] text-slate-600 break-words mt-0.5">
                    {storeSettings.store_address}
                  </p>
                  <p className="text-[8px] text-slate-600">
                    Tel: {storeSettings.store_phone}
                  </p>
                  <p className="text-[8px] text-slate-600">
                    TIN: {storeSettings.store_tin}
                  </p>
                </div>

                {/* 58mm Metadata */}
                <div className="text-left text-[9px] space-y-0.5 border-b border-dashed border-slate-400 pb-1.5">
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-slate-600">REC NO:</span>
                    <span className="font-bold">#{receiptNumber}</span>
                  </div>
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-slate-600">DATE:</span>
                    <span className="font-bold truncate">{formattedDate}</span>
                  </div>
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-slate-600">CASHIER:</span>
                    <span className="font-bold truncate">{cashierName}</span>
                  </div>
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-slate-600">CUST:</span>
                    <span className="font-bold truncate max-w-[130px]">{customerName}</span>
                  </div>
                </div>

                {/* 58mm Line Items Header */}
                <div className="border-b border-dashed border-slate-400 pb-0.5 text-[9px] font-bold flex justify-between uppercase">
                  <span>ITEM / QTY</span>
                  <span>TOTAL</span>
                </div>

                {/* 58mm Line Items List */}
                <div className="border-b border-dashed border-slate-400 pb-1.5 text-left space-y-1">
                  {items.map((item, idx) => {
                    const itemName = item.name || item.product_name || `Item #${item.product_id || idx + 1}`;
                    const lineTotal = item.quantity * item.unit_price;
                    return (
                      <div key={idx} className="text-[9px] space-y-0.5">
                        <div className="font-bold text-slate-900 break-words leading-tight">
                          {itemName}
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-700">
                          <span>{item.quantity} x {formatGHS(item.unit_price)}</span>
                          <span className="font-mono font-bold text-black">{formatGHS(lineTotal)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 58mm Totals Section */}
                <div className="border-b border-dashed border-slate-400 pb-1.5 space-y-0.5 text-right text-[9px]">
                  <div className="flex justify-between text-slate-600">
                    <span>TAXABLE SUBTOTAL:</span>
                    <span className="font-mono">{formatGHS(ghanaTax.taxableSubtotal)}</span>
                  </div>
                  {ghanaTax.isExempt ? (
                    <div className="flex justify-between text-slate-600 text-[8px]">
                      <span>GRA TAX STATUS:</span>
                      <span className="font-bold">EXEMPT / 0%</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-600 text-[8px]">
                        <span>LEVIES (NHIL+GETF+COV 6%):</span>
                        <span className="font-mono">{formatGHS(ghanaTax.totalLevies)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-[8px]">
                        <span>VAT (15%):</span>
                        <span className="font-mono">{formatGHS(ghanaTax.vatAmount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-black text-[11px] text-black pt-0.5 border-t border-slate-400">
                    <span>TOTAL DUE:</span>
                    <span className="font-mono">{formatGHS(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-0.5">
                    <span>PAY METHOD:</span>
                    <span className="font-bold">{displayPaymentMethod}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>TENDERED:</span>
                    <span className="font-bold font-mono">{formatGHS(amountPaid)}</span>
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between text-slate-900 font-bold">
                      <span>CHANGE:</span>
                      <span className="font-mono">{formatGHS(changeDue)}</span>
                    </div>
                  )}
                </div>

                {/* 58mm Barcode & Return Policy */}
                <div className="pt-1.5 space-y-1">
                  <ScannableBarcode value={receiptNumber} isNarrow={true} />
                  <div className="text-[7.5px] text-slate-700 leading-tight space-y-0.5 break-words">
                    <p className="font-bold text-black uppercase">THANK YOU FOR YOUR PATRONAGE!</p>
                    <p>{storeSettings.receipt_footer}</p>
                    <p className="font-mono text-[7px] text-slate-400">GRA FISCAL ID: GRA-GH-{rawId}</p>
                  </div>
                  {/* Thermal paper bottom print safety zone feed spacer */}
                  <div className="h-6 print:h-12 w-full shrink-0" aria-hidden="true" />
                </div>
              </div>
            ) : (
              /* ================= 3. POS STANDARD THERMAL RECEIPT (80mm) ================= */
              <div className="space-y-3 text-center text-slate-900 font-mono text-[11px] leading-tight w-full">
                {/* Header: Store Branding & Tax Info */}
                <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-slate-400 print:border-black print:pb-2">
                  <div className="flex items-center justify-center gap-1.5 font-black uppercase tracking-tight text-slate-900 print:text-black">
                    <Building2 size={18} className="shrink-0" />
                    <span className="text-sm font-black">
                      {storeSettings.store_name}
                    </span>
                  </div>
                  
                  {storeSettings.store_tagline && (
                    <div className="text-[10px] text-slate-600 font-medium print:text-black">
                      {storeSettings.store_tagline}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 space-y-0.5 print:text-black font-mono">
                    {storeSettings.store_address && <div>{storeSettings.store_address}</div>}
                    {storeSettings.store_phone && <div>Tel: {storeSettings.store_phone}</div>}
                    {storeSettings.store_tin && <div className="font-bold">TIN: {storeSettings.store_tin}</div>}
                  </div>

                  {storeSettings.receipt_header && (
                    <div className="mt-1 pt-1 border-t border-slate-200 text-[10px] font-bold text-slate-700 italic print:text-black print:border-black">
                      {storeSettings.receipt_header}
                    </div>
                  )}
                </div>

                {/* Receipt Metadata Info: Date, Cashier, Customer */}
                <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 font-mono text-[10px] print:border-black print:py-1.5 print:text-black text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-500 print:text-black">Receipt No:</span>
                    <span className="font-bold text-slate-900 print:text-black">#{receiptNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 print:text-black">Date & Time:</span>
                    <span className="text-slate-800 print:text-black">{formattedDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 print:text-black">Cashier:</span>
                    <span className="text-slate-800 print:text-black">{cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 print:text-black">Customer:</span>
                    <span className="font-bold text-slate-900 print:text-black truncate max-w-[150px]">{customerName}</span>
                  </div>
                  {customerPhone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 print:text-black">Contact:</span>
                      <span className="text-slate-800 print:text-black">{customerPhone}</span>
                    </div>
                  )}
                </div>

                {/* Items Table / Ledger */}
                <div className="py-2.5 border-b-2 border-dashed border-slate-400 print:border-black print:py-2">
                  <div className="grid grid-cols-12 gap-1 pb-1 border-b border-slate-300 font-mono font-bold text-[10px] uppercase text-slate-700 print:border-black print:text-black">
                    <div className="col-span-6">Item</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Price</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>

                  <div className="divide-y divide-slate-100 print:divide-slate-200">
                    {items.length === 0 ? (
                      <div className="py-3 text-center text-slate-400 italic">No items listed</div>
                    ) : (
                      items.map((item, idx) => {
                        const itemName = item.name || item.product_name || `Item #${item.product_id || idx + 1}`;
                        const lineTotal = item.quantity * item.unit_price;
                        return (
                          <div key={idx} className="grid grid-cols-12 gap-1 py-1.5 font-mono text-[10px] items-start print:py-1 print:break-inside-avoid">
                            <div className="col-span-6 pr-1 text-left">
                              <div className="font-bold text-slate-900 print:text-black break-words leading-tight">
                                {itemName}
                              </div>
                              {item.sku && (
                                <div className="text-[9px] text-slate-400 print:text-black">
                                  {item.sku}
                                </div>
                              )}
                              {item.notes && (
                                <div className="text-[9px] text-slate-500 italic">
                                  Note: {item.notes}
                                </div>
                              )}
                            </div>
                            <div className="col-span-2 text-center font-bold text-slate-800 print:text-black">
                              {item.quantity}
                            </div>
                            <div className="col-span-2 text-right text-slate-700 print:text-black">
                              {formatGHS(item.unit_price)}
                            </div>
                            <div className="col-span-2 text-right font-bold text-slate-900 print:text-black">
                              {formatGHS(lineTotal)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Financial Summary & Breakdown with Full Ghanaian Tax Structure */}
                <div className="py-2.5 space-y-1 font-mono text-[11px] border-b border-dashed border-slate-300 print:border-black print:py-2 text-right">
                  <div className="flex justify-between text-slate-600 print:text-black">
                    <span>TAXABLE SUBTOTAL:</span>
                    <span>{formatGHS(ghanaTax.taxableSubtotal)}</span>
                  </div>
                  {ghanaTax.isExempt ? (
                    <div className="flex justify-between text-slate-600 print:text-black text-[9px]">
                      <span>GRA TAX STATUS:</span>
                      <span className="font-bold">ZERO-RATED / EXEMPT (ACT 870)</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-600 print:text-black text-[9px]">
                        <span>NHIL (2.5%):</span>
                        <span>{formatGHS(ghanaTax.nhilAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 print:text-black text-[9px]">
                        <span>GETFund Levy (2.5%):</span>
                        <span>{formatGHS(ghanaTax.getFundAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 print:text-black text-[9px]">
                        <span>COVID-19 Levy (1.0%):</span>
                        <span>{formatGHS(ghanaTax.covidLevyAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 print:text-black text-[9px]">
                        <span>Standard VAT (15.0%):</span>
                        <span>{formatGHS(ghanaTax.vatAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 print:text-black font-bold text-[9.5px] pt-0.5 border-t border-dotted border-slate-300">
                        <span>TOTAL LEVIES & VAT:</span>
                        <span>{formatGHS(ghanaTax.totalTax)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200 print:border-black print:text-black print:text-sm">
                    <span>TOTAL PAYABLE:</span>
                    <span>{formatGHS(grandTotal)}</span>
                  </div>
                </div>

                {/* Payment Settlement Information: STRICTLY CASH & MOMO */}
                <div className="py-2 space-y-1 font-mono text-[10px] border-b-2 border-dashed border-slate-400 print:border-black print:py-1.5 text-right">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-600 print:text-black">Payment Channel:</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-900 uppercase font-black text-[10px] print:bg-transparent print:border-none print:p-0">
                      {displayPaymentMethod}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-700 print:text-black">
                    <span>Amount Tendered:</span>
                    <span>{formatGHS(amountPaid)}</span>
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between font-bold text-slate-900 print:text-black">
                      <span>Change Due:</span>
                      <span>{formatGHS(changeDue)}</span>
                    </div>
                  )}
                </div>

                {/* Barcode & Footer Return Policy */}
                <div className="pt-3 text-center space-y-2 print:pt-2">
                  <ScannableBarcode value={receiptNumber} isNarrow={false} />

                  {storeSettings.receipt_footer && (
                    <p className="text-[9px] text-slate-500 leading-tight italic px-2 print:text-black print:text-[8px]">
                      {storeSettings.receipt_footer}
                    </p>
                  )}

                  <div className="text-[8px] text-slate-400 font-mono tracking-widest uppercase print:text-black">
                    *** THANK YOU FOR YOUR BUSINESS ***
                  </div>
                  <p className="font-mono text-[7.5px] text-slate-400">GRA FISCAL ID: GRA-GH-{rawId}</p>

                  {/* Thermal paper bottom print safety zone feed spacer */}
                  <div className="h-8 print:h-14 w-full shrink-0" aria-hidden="true" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================= 3. BOTTOM BUTTON BAR: PROMINENT FULL-WIDTH / CENTER-ANCHORED BRIGHT GREEN (#059669) PRINT RECEIPT BUTTON ================= */}
        <div className="no-print p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-center shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:max-w-md py-3 px-6 bg-[#059669] hover:bg-[#047857] active:bg-[#065f46] text-white font-extrabold text-sm rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Printer size={18} />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
}
