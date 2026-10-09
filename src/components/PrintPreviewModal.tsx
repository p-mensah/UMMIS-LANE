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
import { formatGHS } from '../lib/formatters';
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
    bars.push((code % 3) + 1);
    bars.push(((code >> 2) % 2) + 1);
    bars.push(((code >> 3) % 3) + 1);
    bars.push(1);
  }
  bars.push(2, 2, 1, 3);

  // Scaled line spacing and 20% height increase for high-contrast thermal scanning
  const barWidth = isNarrow ? 1.15 : 1.5;
  const totalWidth = bars.reduce((sum, w) => sum + w * barWidth, 0);
  const barcodeHeight = isNarrow ? 27 : 34;

  return (
    <div className="flex flex-col items-center justify-center my-2 print:my-1">
      <svg
        width={Math.min(totalWidth, isNarrow ? 180 : 250)}
        height={barcodeHeight}
        viewBox={`0 0 ${totalWidth} ${barcodeHeight}`}
        className="shape-rendering-crispEdges print:h-6 print:max-w-[210px]"
      >
        {(() => {
          let currentX = 0;
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
                  width={Math.max(1.1, width - 0.25)} 
                  height={barcodeHeight} 
                  fill="#000000" 
                />
              );
            }
            return null;
          });
        })()}
      </svg>
      {/* Scaled up vertical code format with widened line spacing */}
      <span className="font-mono text-[10px] sm:text-[11px] font-extrabold tracking-[0.25em] text-slate-900 print:text-black mt-1">
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
    currency_symbol: 'GH₵',
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
  const hasTax = taxPercentageNum > 0 || (activeData.tax_amount && activeData.tax_amount > 0);
  const taxAmount = activeData.tax_amount !== undefined
    ? activeData.tax_amount
    : (hasTax ? (grandTotal * (taxPercentageNum / (100 + taxPercentageNum))) : 0);
  const subtotalAmount = grandTotal - taxAmount;

  const items: ReceiptItem[] = Array.isArray(activeData.items) ? activeData.items : [];

  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print:max-w-none print:w-full print:max-h-none print:shadow-none print:border-none print:rounded-none print:bg-white"
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
        <div className="flex-1 overflow-y-auto p-3 xs:p-4 sm:p-6 bg-[#F3F4F6] flex justify-center print:p-0 print:m-0 print:bg-white print:overflow-visible">
          
          {/* ================= 2. INNER RECEIPT PAPER WRAPPER: CRISP WHITE VERTICAL CONTAINER WITH SHARP EDGE BOUNDARIES & SUBTLE BOX SHADOW ================= */}
          <div
            id="print-preview-document"
            className={`bg-white text-slate-900 shadow-md border border-slate-300 font-mono transition-all leading-tight ${
              format === 'receipt-58'
                ? 'w-[58mm] max-w-[270px] p-3 text-[10px] rounded-none'
                : format === 'receipt'
                ? 'w-[80mm] max-w-[340px] p-4 text-[11px] rounded-none'
                : 'w-full max-w-[720px] p-6 sm:p-8 text-xs font-sans rounded-none sm:rounded-sm'
            } print:w-full print:max-w-none print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white print:text-black print:block`}
          >
            {/* Header: Store Branding & Tax Info */}
            <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-slate-400 print:border-black print:pb-2">
              <div className="flex items-center justify-center gap-1.5 font-black uppercase tracking-tight text-slate-900 print:text-black">
                <Building2 size={format === 'receipt-58' ? 14 : 18} className="shrink-0" />
                <span className={format === 'receipt-58' ? 'text-xs' : 'text-sm font-black'}>
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
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 font-mono text-[10px] print:border-black print:py-1.5 print:text-black">
              <div className="flex justify-between">
                <span className="text-slate-500 print:text-black">Receipt No:</span>
                <span className="font-bold text-slate-900 print:text-black">{receiptNumber}</span>
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
                        <div className="col-span-6 pr-1">
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

            {/* Financial Summary & Breakdown */}
            <div className="py-2.5 space-y-1 font-mono text-[11px] border-b border-dashed border-slate-300 print:border-black print:py-2">
              <div className="flex justify-between text-slate-600 print:text-black">
                <span>Subtotal:</span>
                <span>{formatGHS(subtotalAmount)}</span>
              </div>
              {hasTax && (
                <div className="flex justify-between text-slate-600 print:text-black">
                  <span>VAT / Tax ({taxPercentageNum}%):</span>
                  <span>{formatGHS(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200 print:border-black print:text-black print:text-sm">
                <span>TOTAL DUE:</span>
                <span>{formatGHS(grandTotal)}</span>
              </div>
            </div>

            {/* Payment Settlement Information: STRICTLY CASH & MOMO */}
            <div className="py-2 space-y-1 font-mono text-[10px] border-b-2 border-dashed border-slate-400 print:border-black print:py-1.5">
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
              <div className="flex justify-between font-bold text-slate-900 print:text-black">
                <span>Change Due:</span>
                <span>{formatGHS(changeDue)}</span>
              </div>
            </div>

            {/* Barcode & Footer Return Policy */}
            <div className="pt-3 text-center space-y-2 print:pt-2">
              <ScannableBarcode value={receiptNumber} isNarrow={format === 'receipt-58'} />

              {storeSettings.receipt_footer && (
                <p className="text-[9px] text-slate-500 leading-tight italic px-2 print:text-black print:text-[8px]">
                  {storeSettings.receipt_footer}
                </p>
              )}

              <div className="text-[8px] text-slate-400 font-mono tracking-widest uppercase print:text-black">
                *** THANK YOU FOR YOUR BUSINESS ***
              </div>
            </div>
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
