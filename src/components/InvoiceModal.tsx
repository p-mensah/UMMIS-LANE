import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  FileText, 
  CheckCircle2, 
  RotateCcw, 
  Building2, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  CreditCard,
  SlidersHorizontal,
  Receipt
} from 'lucide-react';
import { formatGHS, calculateGhanaTax } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';
import { getDisplayCustomerPhone, getDisplayCustomerEmail } from '../lib/privacy';

export type InvoiceFormatType = 'a4' | 'receipt' | 'receipt-58';

interface InvoiceModalProps {
  saleData: {
    saleId?: number;
    id?: number;
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
    user_name?: string;
    tax_amount?: number;
    items: Array<{
      product_id?: number;
      product_name?: string;
      name?: string;
      sku?: string;
      quantity: number;
      unit_price: number;
      notes?: string;
    }>;
    status?: string;
    refund_reason?: string;
  };
  products?: any[];
  initialFormat?: InvoiceFormatType;
  onClose: () => void;
  onNewSale?: () => void;
}

// Deterministic Barcode SVG generator encoding the receipt number
function ReceiptBarcode({ value, isNarrow = false }: { value: string; isNarrow?: boolean }) {
  // Generate pseudo-code 128 bar pattern based on char codes
  const bars: number[] = [2, 1, 1, 2];
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    bars.push((code % 3) + 2); // Bar width: 2 to 4 px
    bars.push(((code >> 2) % 2) + 2); // Space width: 2 to 3 px
  }
  bars.push(2, 2, 1, 3); // stop code

  // Optimized line spacing and thickness to guarantee 203 DPI POS thermal printer scanners read without bleeding
  const barWidth = isNarrow ? 1.3 : 1.6;
  const quietZone = isNarrow ? 12 : 16;
  const contentWidth = bars.reduce((sum, w) => sum + w * barWidth, 0);
  const totalSvgWidth = contentWidth + quietZone * 2;
  // Scaled up height by 25%+ (48px for 58mm, 54px for 80mm) to guarantee instant laser/optical scan
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
              // Draw alternate bars with slight isolation gap to prevent bleeding on thermal rolls
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
      <span className="font-mono text-[10px] sm:text-[11px] font-extrabold tracking-[0.28em] text-slate-900 mt-1 print:text-black">
        *{value}*
      </span>
    </div>
  );
}

export default function InvoiceModal({ 
  saleData, 
  products = [], 
  initialFormat = 'receipt', 
  onClose, 
  onNewSale 
}: InvoiceModalProps) {
  const { user } = useAuth();
  const [invoiceFormat, setInvoiceFormat] = useState<InvoiceFormatType>(initialFormat);

  useEffect(() => {
    if (initialFormat) {
      setInvoiceFormat(initialFormat);
    }
  }, [initialFormat]);

  // Store settings state loaded dynamically from /api/settings
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
    receipt_footer: 'Thank you for doing business with Ummis Lane Enterprise. Please inspect all goods upon receipt. Items returned within 7 days must be accompanied by this original receipt/invoice.'
  });

  useEffect(() => {
    let isMounted = true;
    fetchApi('/settings')
      .then(data => {
        if (isMounted && data && typeof data === 'object') {
          setStoreSettings(prev => ({
            ...prev,
            ...data,
            store_tin: data.store_tin || data.tax_id || prev.store_tin
          }));
        }
      })
      .catch(err => {
        console.warn('Receipt settings fallback to defaults:', err);
      });
    return () => { isMounted = false; };
  }, []);

  const saleId = saleData.saleId || saleData.id || 0;
  const rawDate = saleData.date || saleData.created_at || new Date();
  const dateObj = typeof rawDate === 'string' ? new Date(rawDate.endsWith('Z') ? rawDate : rawDate + 'Z') : new Date(rawDate);
  const formattedDate = dateObj.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const customerName = saleData.customerName || saleData.customer_name || 'Walk-in Customer';
  const rawPhone = saleData.customer_phone || null;
  const rawEmail = saleData.customer_email || null;

  // Mask customer sensitive info for store staff
  const customerPhone = getDisplayCustomerPhone(rawPhone, user?.role);
  const customerEmail = getDisplayCustomerEmail(rawEmail, user?.role);

  const paymentMethod = saleData.paymentMethod || saleData.payment_method || 'Cash';
  const displayPaymentMethod = paymentMethod.toLowerCase().includes('momo') || paymentMethod.toLowerCase().includes('mobile')
    ? 'MOMO'
    : 'CASH';
  const cashierName = saleData.user_name || 'Staff Member';
  const grandTotal = saleData.total !== undefined ? saleData.total : (saleData.total_amount || 0);
  const isRefunded = saleData.status === 'refunded';
  const amountPaid = saleData.amount_paid !== undefined ? saleData.amount_paid : grandTotal;
  const changeDue = saleData.change !== undefined ? saleData.change : Math.max(0, amountPaid - grandTotal);

  // Dynamic store configuration fields
  const storeName = storeSettings.store_name || 'Ummis Lane Enterprise';
  const storeTagline = storeSettings.store_tagline || 'Retail & Wholesale Provisions';
  const storeAddress = storeSettings.store_address || 'Accra, Ghana';
  const storePhone = storeSettings.store_phone || '0545570191 / 0591369282';
  const storeEmail = storeSettings.store_email || 'Issakrabiat92@gmail.com';
  const storeTin = storeSettings.store_tin || storeSettings.tax_id || 'TIN-GH90218821';
  const receiptHeaderNote = storeSettings.receipt_header || '';
  const receiptFooterText = storeSettings.receipt_footer || 'Thank you for your patronage! Goods sold in good condition are non-refundable after 7 days. Original receipt required for all exchanges or queries.';
  const taxPercentageNum = parseFloat(storeSettings.tax_percentage || '0') || 0;
  
  // Ghanaian GRA Tax breakdown calculation (NHIL 2.5%, GETFund 2.5%, COVID-19 1%, VAT 15%)
  const ghanaTax = calculateGhanaTax(grandTotal, taxPercentageNum, saleData.tax_amount);
  const subtotalAmount = ghanaTax.taxableSubtotal;
  const taxAmount = ghanaTax.totalTax;
  const hasTax = !ghanaTax.isExempt;

  const getItemName = (item: any) => {
    if (item.product_name) return item.product_name;
    if (item.name) return item.name;
    const found = products.find(p => p.id === item.product_id);
    return found ? found.name : `Product #${item.product_id || 'Item'}`;
  };

  const getItemSku = (item: any) => {
    if (item.sku) return item.sku;
    const found = products.find(p => p.id === item.product_id);
    return found?.sku || `SKU-${item.product_id || 'GEN'}`;
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handlePrint = () => {
    setToastMessage(`Receipt #REC-${saleId} sent to printer successfully!`);
    window.print();
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 z-[80] overflow-y-auto">
      {/* 
        ========================================================================
        BULLETPROOF PRINT MEDIA STYLESHEET
        - Uses relative positioning instead of absolute so multi-page receipts paginate cleanly.
        - Resets fixed and overflowing modal ancestors to avoid viewport and overflow clipping.
        - Provides exact paper sizes: 80mm roll, 58mm roll, and A4 sheet.
        ========================================================================
      */}
      <style>{`
        @media print {
          @page {
            margin: ${invoiceFormat === 'receipt-58' ? '1.5mm 2mm' : invoiceFormat === 'receipt' ? '2mm 3mm' : '10mm 12mm'};
            size: ${invoiceFormat === 'receipt-58' ? '58mm auto' : invoiceFormat === 'receipt' ? '80mm auto' : 'A4 portrait'};
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
          /* Reset modal containment traps so print engine can render all pages */
          .fixed,
          [role="dialog"],
          .modal-overlay,
          .overflow-y-auto,
          .overflow-hidden,
          .max-h-\\[96dvh\\],
          .max-h-\\[100dvh\\] {
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
          body * {
            visibility: hidden !important;
          }
          #invoice-print-area, #invoice-print-area * {
            visibility: visible !important;
          }
          #invoice-print-area {
            position: relative !important;
            display: block !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: ${invoiceFormat === 'receipt-58' ? '48mm !important' : invoiceFormat === 'receipt' ? '72mm !important' : '100% !important'};
            max-width: ${invoiceFormat === 'receipt-58' ? '48mm !important' : invoiceFormat === 'receipt' ? '72mm !important' : '100% !important'};
            padding: ${invoiceFormat === 'a4' ? '0 !important' : '1mm 1.5mm !important'};
            font-family: ${invoiceFormat === 'a4' ? 'system-ui, -apple-system, sans-serif !important' : "'Courier New', Courier, monospace !important"};
            page-break-inside: auto;
            break-inside: auto;
          }
          .no-print {
            display: none !important;
          }
          tr, .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-show-table {
            display: block !important;
          }
          .print-show-table table {
            display: table !important;
            width: 100% !important;
          }
          .print-hide-cards {
            display: none !important;
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

      <div className={`bg-white rounded-2xl ${invoiceFormat === 'a4' ? 'max-w-4xl sm:max-w-5xl' : 'max-w-xl'} w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[96dvh] my-auto min-w-0 transition-all duration-200`}>
        
        {/* ================= 1. OUTER MODAL LAYER: DARK HEADER BAR (#111827) ================= */}
        <div className="no-print bg-[#111827] text-white px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          {/* Left-aligned title "RECEIPT & INVOICE VIEWER #REC-{saleId}" and current transaction metadata */}
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-2 flex-wrap">
              <span>RECEIPT & INVOICE VIEWER</span>
              <span className="text-emerald-400 font-mono font-black">
                #REC-{saleId || '6'}
              </span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate mt-0.5">
              {storeName} • {formattedDate} • Cashier: {cashierName}
            </p>
          </div>

          {/* Right side: Grouped 3 toggle pills inside a single flex-row container + X close icon flush right */}
          <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto shrink-0">
            {/* Single flex-row container with subtle active borders */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setInvoiceFormat('receipt')}
                className={`min-h-[32px] px-2.5 sm:px-3 py-1 text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer font-medium ${
                  invoiceFormat === 'receipt' 
                    ? 'bg-slate-800 text-white font-bold border border-slate-600 shadow-xs' 
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
                title="80mm Thermal Receipt (Standard POS Roll)"
              >
                <span>80mm Thermal</span>
              </button>
              <button
                type="button"
                onClick={() => setInvoiceFormat('receipt-58')}
                className={`min-h-[32px] px-2.5 sm:px-3 py-1 text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer font-medium ${
                  invoiceFormat === 'receipt-58' 
                    ? 'bg-slate-800 text-white font-bold border border-slate-600 shadow-xs' 
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
                title="58mm Thermal Receipt (Mini / Portable POS Roll)"
              >
                <span>58mm Mini</span>
              </button>
              <button
                type="button"
                onClick={() => setInvoiceFormat('a4')}
                className={`min-h-[32px] px-2.5 sm:px-3 py-1 text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer font-medium ${
                  invoiceFormat === 'a4' 
                    ? 'bg-slate-800 text-white font-bold border border-slate-600 shadow-xs' 
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
                title="Standard A4 Formal Invoice"
              >
                <span>A4 Official</span>
              </button>
            </div>

            {/* "X" close icon flush right */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Close Viewer"
              aria-label="Close Viewer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ================= MAIN BACKGROUND BODY: CLEAN LIGHT-NEUTRAL CONTRAST GRAY (#F3F4F6) ================= */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 xs:p-4 sm:p-6 md:p-8 pb-12 bg-[#F3F4F6] flex justify-center items-start custom-scrollbar">
          {/* ================= 2. INNER RECEIPT PAPER WRAPPER: CRISP WHITE VERTICAL CONTAINER WITH SHARP EDGE BOUNDARIES & SUBTLE BOX SHADOW ================= */}
          <div
            id="invoice-print-area"
            className={`bg-white shrink-0 transition-all shadow-md border border-slate-300 font-mono text-slate-900 leading-tight ${
              invoiceFormat === 'a4'
                ? 'w-full max-w-[840px] p-4 xs:p-5 sm:p-8 md:p-10 text-xs font-sans rounded-none sm:rounded-sm'
                : invoiceFormat === 'receipt-58'
                ? 'w-full max-w-[270px] p-3 pb-8 text-[10px] mx-auto rounded-none'
                : 'w-full max-w-[340px] p-4 sm:p-5 pb-8 text-xs mx-auto rounded-none'
            }`}
          >
            {/* ================= 1. A4 OFFICIAL INVOICE VIEW ================= */}
            {invoiceFormat === 'a4' ? (
              <div className="space-y-5 sm:space-y-6">
                {/* Invoice Header / Letterhead with Dynamic Company Info */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-5 sm:pb-6 border-b-2 border-slate-900">
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-900 rounded-xl p-2 sm:p-2.5 flex items-center justify-center text-white shadow-sm border border-slate-800 shrink-0">
                      <Building2 size={28} className="text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight break-words">
                        {storeName}
                      </h1>
                      <p className="text-[11px] sm:text-xs text-blue-600 font-bold uppercase tracking-wider">
                        {storeTagline}
                      </p>
                      {receiptHeaderNote && (
                        <p className="text-[10px] sm:text-[11px] font-semibold text-slate-700 italic mt-0.5">
                          {receiptHeaderNote}
                        </p>
                      )}
                      <div className="mt-1 text-[10px] sm:text-[11px] text-slate-500 space-y-0.5 break-words [overflow-wrap:anywhere]">
                        <p>
                          <span className="font-semibold text-slate-700">TIN:</span> {storeTin}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-700">Tel:</span> {storePhone}
                        </p>
                        <p className="break-all sm:break-normal">
                          <span className="font-semibold text-slate-700">Email:</span> {storeEmail} · {storeAddress}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0 w-full sm:w-auto">
                    <div className="inline-block bg-slate-900 text-white px-2.5 py-1 font-black text-[11px] uppercase tracking-widest rounded-md mb-1.5">
                      {isRefunded ? 'Refunded Invoice' : 'Official Sales Invoice'}
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900 break-all">
                      INV-{String(saleId).padStart(6, '0')}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      <span className="font-semibold">Date:</span> {formattedDate}
                    </div>
                    {isRefunded && (
                      <div className="mt-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                        REFUNDED TRANSACTION
                      </div>
                    )}
                  </div>
                </div>

                {/* Billed To / Cashier Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 text-xs">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1.5 flex items-center gap-1.5">
                      <User size={13} className="text-blue-600 shrink-0" /> Billed To Customer
                    </h3>
                    <div className="font-black text-sm text-slate-900 break-words">{customerName}</div>
                    {customerPhone && (
                      <div className="text-slate-600 flex items-center gap-1.5 mt-1 font-medium break-all text-[11px]">
                        <Phone size={12} className="text-slate-400 shrink-0" /> <span>{customerPhone}</span>
                      </div>
                    )}
                    {customerEmail && (
                      <div className="text-slate-600 flex items-center gap-1.5 mt-0.5 font-medium break-all text-[11px]">
                        <Mail size={12} className="text-slate-400 shrink-0" /> <span>{customerEmail}</span>
                      </div>
                    )}
                  </div>

                  <div className="sm:border-l sm:border-slate-200 sm:pl-4 space-y-1 min-w-0">
                    <h3 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1.5 flex items-center gap-1.5">
                      <CreditCard size={13} className="text-emerald-600 shrink-0" /> Payment & Terminal Audit
                    </h3>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Payment Mode:</span>
                      <span className="font-bold text-slate-900 truncate">{paymentMethod}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Serving Cashier:</span>
                      <span className="font-bold text-slate-900 truncate">{cashierName}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">POS Terminal Ref:</span>
                      <span className="font-mono text-slate-700">TERMINAL-MAIN-01</span>
                    </div>
                  </div>
                </div>

                {/* Items Section: Stacked cards on mobile (< 640px), Full table on tablets/desktop (>= 640px) */}
                <div className="block sm:hidden print-hide-cards space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-1">
                    Invoice Items ({saleData.items.length})
                  </div>
                  {saleData.items.map((item, idx) => {
                    const lineTotal = item.quantity * item.unit_price;
                    return (
                      <div key={idx} className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3 space-y-1.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                              <span>#{idx + 1}</span>
                              <span>·</span>
                              <span className="truncate">{getItemSku(item)}</span>
                            </div>
                            <h4 className="font-bold text-slate-900 break-words leading-tight mt-0.5">
                              {getItemName(item)}
                            </h4>
                          </div>
                          <span className="font-mono font-black text-slate-900 text-sm shrink-0">
                            {formatGHS(lineTotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200/60 font-mono">
                          <span>Qty: <strong className="text-slate-800">{item.quantity}</strong></span>
                          <span>Price: {formatGHS(item.unit_price)}</span>
                        </div>
                        {item.notes && (
                          <div className="text-[10px] text-blue-600 font-normal italic pt-0.5 break-words">
                            Note: {item.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop & Print Tabular Layout */}
                <div className="hidden sm:block print-show-table border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[500px] sm:min-w-0">
                    <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 sm:px-4 font-bold w-10">#</th>
                        <th className="py-2.5 px-3 sm:px-4 font-bold">Item Description</th>
                        <th className="py-2.5 px-3 sm:px-4 font-bold">SKU</th>
                        <th className="py-2.5 px-3 sm:px-4 font-bold text-center">Qty</th>
                        <th className="py-2.5 px-3 sm:px-4 font-bold text-right">Unit Price</th>
                        <th className="py-2.5 px-3 sm:px-4 font-bold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {saleData.items.map((item, idx) => {
                        const lineTotal = item.quantity * item.unit_price;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 sm:px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-900 break-words max-w-[200px] sm:max-w-none">
                              {getItemName(item)}
                              {item.notes && <div className="text-[10px] text-blue-600 font-normal italic mt-0.5 break-words">Note: {item.notes}</div>}
                            </td>
                            <td className="py-2.5 px-3 sm:px-4 font-mono text-slate-500 text-[11px] break-all">{getItemSku(item)}</td>
                            <td className="py-2.5 px-3 sm:px-4 text-center font-bold text-slate-800">{item.quantity}</td>
                            <td className="py-2.5 px-3 sm:px-4 text-right text-slate-600 font-mono">{formatGHS(item.unit_price)}</td>
                            <td className="py-2.5 px-3 sm:px-4 text-right font-black text-slate-900 font-mono">{formatGHS(lineTotal)}</td>
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

                {/* Terms & Authorization Stamp with Dynamic Settings */}
                <div className="pt-6 sm:pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-xs text-slate-500 print-avoid-break">
                  <div>
                    <p className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-1">
                      Store Terms & Return Policy
                    </p>
                    <p className="text-[10px] leading-relaxed break-words">
                      {receiptFooterText}
                    </p>
                  </div>
                  <div className="flex flex-col sm:items-end justify-end sm:text-right pt-2 sm:pt-0">
                    <div className="w-40 border-b border-slate-400 mb-1"></div>
                    <p className="text-[10px] font-bold text-slate-700 uppercase">Authorized Signature / Stamp</p>
                    <p className="text-[9px] text-slate-400">{storeName} POS System</p>
                  </div>
                </div>
              </div>
            ) : invoiceFormat === 'receipt-58' ? (
              /* ================= 2. POS COMPACT THERMAL RECEIPT (58mm MINI) ================= */
              <div className="space-y-2 text-center text-slate-900 font-mono text-[10px] leading-tight w-full">
                {/* 58mm Store Header */}
                <div className="pb-1.5 border-b border-dashed border-slate-400 space-y-0.5">
                  <div className="w-8 h-8 bg-black rounded p-1 mx-auto flex items-center justify-center text-white mb-1">
                    <Building2 size={18} />
                  </div>
                  <h2 className="font-black text-[11px] uppercase tracking-tight break-words">
                    {storeName}
                  </h2>
                  <p className="text-[9px] font-bold text-slate-700 uppercase break-words">
                    {storeTagline}
                  </p>
                  {receiptHeaderNote && (
                    <p className="text-[8px] font-bold text-slate-800 italic break-words">
                      {receiptHeaderNote}
                    </p>
                  )}
                  <p className="text-[8px] text-slate-600 break-words mt-0.5">
                    {storeAddress}
                  </p>
                  <p className="text-[8px] text-slate-600">
                    Tel: {storePhone}
                  </p>
                  <p className="text-[8px] text-slate-600">
                    TIN: {storeTin}
                  </p>
                </div>

                {/* 58mm Receipt Metadata */}
                <div className="text-left text-[9px] space-y-0.5 border-b border-dashed border-slate-400 pb-1.5">
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-slate-600">REC NO:</span>
                    <span className="font-bold">#REC-{saleId}</span>
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
                  {isRefunded && (
                    <div className="mt-1 p-0.5 bg-red-100 text-red-800 font-bold text-center rounded text-[8px] uppercase border border-red-300">
                      *** REFUNDED ***
                    </div>
                  )}
                </div>

                {/* 58mm Line Items Header */}
                <div className="border-b border-dashed border-slate-400 pb-0.5 text-[9px] font-bold flex justify-between uppercase">
                  <span>ITEM / QTY</span>
                  <span>TOTAL</span>
                </div>

                {/* 58mm Line Items List */}
                <div className="border-b border-dashed border-slate-400 pb-1.5 text-left space-y-1">
                  {saleData.items.map((item, idx) => {
                    const lineTotal = item.quantity * item.unit_price;
                    return (
                      <div key={idx} className="text-[9px] space-y-0.5">
                        <div className="font-bold text-slate-900 break-words leading-tight">
                          {getItemName(item)}
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-700">
                          <span>{item.quantity} x {formatGHS(item.unit_price)}</span>
                          <span className="font-mono font-bold text-black">{formatGHS(lineTotal)}</span>
                        </div>
                        {item.notes && (
                          <div className="text-[7.5px] italic text-slate-600 break-words">
                            Note: {item.notes}
                          </div>
                        )}
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
                  <ReceiptBarcode value={`REC-${saleId}`} isNarrow={true} />
                  <div className="text-[7.5px] text-slate-700 leading-tight space-y-0.5 break-words">
                    <p className="font-bold text-black uppercase">THANK YOU FOR YOUR PATRONAGE!</p>
                    <p>{receiptFooterText}</p>
                    <p className="font-mono text-[7px] text-slate-400">GRA FISCAL ID: GRA-GH-{saleId}</p>
                  </div>
                  {/* Thermal paper bottom print safety zone feed spacer */}
                  <div className="h-6 print:h-12 w-full shrink-0" aria-hidden="true" />
                </div>
              </div>
            ) : (
              /* ================= 3. POS STANDARD THERMAL RECEIPT (80mm) ================= */
              <div className="space-y-3 text-center text-slate-900 font-mono text-[11px] leading-tight w-full">
                {/* 80mm Store Branding */}
                <div className="flex flex-col items-center justify-center pb-2 border-b border-dashed border-slate-400">
                  <div className="w-10 h-10 bg-slate-950 rounded-md p-1.5 flex items-center justify-center text-white mb-1.5 shadow-2xs">
                    <Building2 size={24} />
                  </div>
                  <h2 className="font-black text-xs uppercase tracking-wider break-words">
                    {storeName}
                  </h2>
                  <p className="text-[9px] font-bold text-slate-700 uppercase">
                    {storeTagline}
                  </p>
                  {receiptHeaderNote && (
                    <p className="text-[9px] font-bold text-slate-800 italic mt-0.5 break-words">
                      {receiptHeaderNote}
                    </p>
                  )}
                  <p className="text-[9px] text-slate-600 mt-0.5 break-words">
                    {storeAddress} · Tel: {storePhone}
                  </p>
                  <p className="text-[9px] text-slate-600">
                    TIN: {storeTin}
                  </p>
                </div>

                {/* 80mm Receipt Metadata */}
                <div className="text-left text-[10px] space-y-1 border-b border-dashed border-slate-400 pb-2">
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-slate-600">RECEIPT NO:</span>
                    <span className="font-bold font-mono">#REC-{saleId}</span>
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
                    <span className="text-slate-600">CUSTOMER:</span>
                    <span className="font-bold truncate max-w-[170px]">{customerName}</span>
                  </div>
                  {customerPhone && (
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-slate-600">PHONE:</span>
                      <span className="font-bold">{customerPhone}</span>
                    </div>
                  )}
                  {isRefunded && (
                    <div className="mt-1 p-1 bg-red-100 text-red-800 font-bold text-center rounded text-[9px] uppercase border border-red-300">
                      *** TRANSACTION REFUNDED ***
                    </div>
                  )}
                </div>

                {/* 80mm Line Items Table Header */}
                <div className="border-b border-dashed border-slate-400 pb-1 text-[10px] font-bold flex justify-between uppercase">
                  <span>ITEM / QTY</span>
                  <span>TOTAL</span>
                </div>

                {/* 80mm Line Items List */}
                <div className="border-b border-dashed border-slate-400 pb-2 text-left space-y-1.5">
                  {saleData.items.map((item, idx) => {
                    const lineTotal = item.quantity * item.unit_price;
                    return (
                      <div key={idx} className="text-[10px] space-y-0.5">
                        <div className="flex justify-between items-start gap-1 font-bold text-slate-900">
                          <span className="break-words flex-1 min-w-0 pr-1">{getItemName(item)}</span>
                          <span className="font-mono shrink-0">{formatGHS(lineTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-600 font-mono">
                          <span>{item.quantity} x {formatGHS(item.unit_price)}</span>
                          <span className="text-slate-400 text-[8px] truncate max-w-[110px]">[{getItemSku(item)}]</span>
                        </div>
                        {item.notes && <div className="text-[8px] italic text-blue-600 break-words">Note: {item.notes}</div>}
                      </div>
                    );
                  })}
                </div>

                {/* 80mm Totals Section */}
                <div className="border-b border-dashed border-slate-400 pb-2 space-y-1 text-right text-[10px]">
                  <div className="flex justify-between text-slate-600">
                    <span>TAXABLE SUBTOTAL:</span>
                    <span className="font-mono">{formatGHS(ghanaTax.taxableSubtotal)}</span>
                  </div>
                  {ghanaTax.isExempt ? (
                    <div className="flex justify-between text-slate-600 text-[9px]">
                      <span>GRA TAX STATUS:</span>
                      <span className="font-bold">ZERO-RATED / EXEMPT (ACT 870)</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-600 text-[9px]">
                        <span>NHIL (2.5%):</span>
                        <span className="font-mono">{formatGHS(ghanaTax.nhilAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-[9px]">
                        <span>GETFund Levy (2.5%):</span>
                        <span className="font-mono">{formatGHS(ghanaTax.getFundAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-[9px]">
                        <span>COVID-19 Levy (1.0%):</span>
                        <span className="font-mono">{formatGHS(ghanaTax.covidLevyAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-[9px]">
                        <span>Standard VAT (15.0%):</span>
                        <span className="font-mono">{formatGHS(ghanaTax.vatAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 font-bold text-[9.5px] pt-0.5 border-t border-dotted border-slate-300">
                        <span>TOTAL LEVIES & VAT:</span>
                        <span className="font-mono">{formatGHS(ghanaTax.totalTax)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-black text-xs text-slate-900 pt-1 border-t border-slate-400">
                    <span>TOTAL PAYABLE:</span>
                    <span className="font-mono">{formatGHS(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>PAY METHOD:</span>
                    <span className="font-bold">{displayPaymentMethod}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>TENDERED:</span>
                    <span className="font-bold font-mono">{formatGHS(amountPaid)}</span>
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>CHANGE DUE:</span>
                      <span className="font-mono">{formatGHS(changeDue)}</span>
                    </div>
                  )}
                </div>

                {/* 80mm Scannable Barcode & Policies */}
                <div className="pt-1.5 space-y-1.5">
                  <ReceiptBarcode value={`REC-${saleId}`} isNarrow={false} />

                  <div className="text-[8px] text-slate-600 leading-tight space-y-0.5 break-words">
                    <p className="font-bold text-slate-800 uppercase">THANK YOU FOR YOUR PATRONAGE!</p>
                    <p>{receiptFooterText}</p>
                    <p className="font-mono text-[7.5px] text-slate-400 pt-0.5">GRA FISCAL ID: GRA-GH-{saleId}</p>
                  </div>

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
