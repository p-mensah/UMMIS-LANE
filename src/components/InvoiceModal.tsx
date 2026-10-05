import React, { useState } from 'react';
import { Printer, X, FileText, CheckCircle2, RotateCcw, Building2, User, Phone, Mail, Calendar, CreditCard } from 'lucide-react';
import { formatGHS } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { getDisplayCustomerPhone, getDisplayCustomerEmail } from '../lib/privacy';

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
  initialFormat?: 'a4' | 'receipt';
  onClose: () => void;
  onNewSale?: () => void;
}

export default function InvoiceModal({ saleData, products = [], initialFormat = 'receipt', onClose, onNewSale }: InvoiceModalProps) {
  const { user } = useAuth();
  const [invoiceFormat, setInvoiceFormat] = useState<'a4' | 'receipt'>(initialFormat);

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
  const cashierName = saleData.user_name || 'Staff Member';
  const grandTotal = saleData.total !== undefined ? saleData.total : (saleData.total_amount || 0);
  const isRefunded = saleData.status === 'refunded';
  const amountPaid = saleData.amount_paid !== undefined ? saleData.amount_paid : grandTotal;
  const changeDue = saleData.change !== undefined ? saleData.change : Math.max(0, amountPaid - grandTotal);

  const getItemName = (item: any) => {
    if (item.product_name) return item.product_name;
    if (item.name) return item.name;
    const found = products.find(p => p.id === item.product_id);
    return found ? found.name : `Product #${item.product_id}`;
  };

  const getItemSku = (item: any) => {
    if (item.sku) return item.sku;
    const found = products.find(p => p.id === item.product_id);
    return found?.sku || `SKU-${item.product_id || 'GEN'}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[80] overflow-y-auto">
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: ${invoiceFormat === 'receipt' ? '80mm auto' : 'auto'};
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * {
            visibility: hidden !important;
          }
          #invoice-print-area, #invoice-print-area * {
            visibility: visible !important;
          }
          #invoice-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            width: ${invoiceFormat === 'receipt' ? '76mm !important' : '100% !important'};
            max-width: ${invoiceFormat === 'receipt' ? '76mm !important' : '210mm !important'};
            padding: ${invoiceFormat === 'receipt' ? '3mm 4mm !important' : '10mm !important'};
            font-family: ${invoiceFormat === 'receipt' ? "'Courier New', Courier, monospace !important" : 'inherit'};
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-md max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] my-auto">
        {/* Modal Header & Controls (Hidden during print) */}
        <div className="no-print bg-slate-900 text-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs">
              <Printer size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                Sales Transaction Receipt
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono font-bold">#REC-{saleId}</span>
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">Completed Transaction • {formattedDate}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Format Switcher */}
            <div className="flex bg-slate-800 p-0.5 rounded border border-slate-700">
              <button
                type="button"
                onClick={() => setInvoiceFormat('receipt')}
                className={`px-3 py-1 text-[11px] font-bold rounded transition-all flex items-center gap-1.5 cursor-pointer ${
                  invoiceFormat === 'receipt' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>POS Thermal (80mm)</span>
              </button>
              <button
                type="button"
                onClick={() => setInvoiceFormat('a4')}
                className={`px-3 py-1 text-[11px] font-bold rounded transition-all flex items-center gap-1.5 cursor-pointer ${
                  invoiceFormat === 'a4' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>A4 Official Invoice</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
            >
              <Printer size={15} /> {invoiceFormat === 'receipt' ? 'Print Receipt' : 'Print Invoice'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors shrink-0 cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Area Wrapper */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
          <div
            id="invoice-print-area"
            className={`bg-white transition-all shadow-md ${
              invoiceFormat === 'a4'
                ? 'w-full max-w-2xl p-8 sm:p-10 border border-slate-200 text-slate-800 font-sans'
                : 'w-[320px] max-w-[320px] p-5 border border-slate-300 font-mono text-xs text-slate-900 leading-tight'
            }`}
          >
            {/* ================= A4 OFFICIAL INVOICE VIEW ================= */}
            {invoiceFormat === 'a4' ? (
              <div className="space-y-6">
                {/* Invoice Header / Letterhead with Company Logo */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-slate-900">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-2.5 flex items-center justify-center text-white shadow-sm border border-slate-700 shrink-0">
                      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                        <rect width="40" height="40" rx="8" fill="#0F172A" />
                        <path d="M11 13H29L27 25H13L11 13Z" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="15" cy="30" r="2.5" fill="#38BDF8" />
                        <circle cx="25" cy="30" r="2.5" fill="#38BDF8" />
                        <path d="M17 19L20 22L24 17" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Ummis Lane Enterprise</h1>
                      <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Retail & Wholesale Provisions</p>
                      <div className="mt-1.5 text-[11px] text-slate-500 space-y-0.5">
                        <p><span className="font-semibold text-slate-700">TIN:</span> TIN-GH90218821 • <span className="font-semibold text-slate-700">Reg:</span> CS-88291029</p>
                        <p><span className="font-semibold text-slate-700">Tel:</span> 0545570191 / 0591369282</p>
                        <p><span className="font-semibold text-slate-700">Email:</span> Issakrabiat92@gmail.com • Accra, Ghana</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="inline-block bg-slate-900 text-white px-3 py-1 font-black text-xs uppercase tracking-widest rounded-xs mb-2">
                      {isRefunded ? 'Refunded Invoice' : 'Official Sales Invoice'}
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900">
                      INV-{String(saleId).padStart(6, '0')}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      <span className="font-semibold">Date:</span> {formattedDate}
                    </div>
                    {isRefunded && (
                      <div className="mt-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
                        REFUNDED TRANSACTION
                      </div>
                    )}
                  </div>
                </div>

                {/* Billed To / Cashier Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <h3 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-2 flex items-center gap-1.5">
                      <User size={13} className="text-blue-600" /> Billed To Customer
                    </h3>
                    <div className="font-black text-sm text-slate-900">{customerName}</div>
                    {customerPhone && (
                      <div className="text-slate-600 flex items-center gap-1.5 mt-1 font-medium">
                        <Phone size={12} className="text-slate-400" /> {customerPhone}
                      </div>
                    )}
                    {customerEmail && (
                      <div className="text-slate-600 flex items-center gap-1.5 mt-0.5 font-medium">
                        <Mail size={12} className="text-slate-400" /> {customerEmail}
                      </div>
                    )}
                  </div>

                  <div className="sm:border-l sm:border-slate-200 sm:pl-4 space-y-1">
                    <h3 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-2 flex items-center gap-1.5">
                      <CreditCard size={13} className="text-emerald-600" /> Payment & Terminal Audit
                    </h3>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Mode:</span>
                      <span className="font-bold text-slate-900">{paymentMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Serving Cashier:</span>
                      <span className="font-bold text-slate-900">{cashierName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">POS Terminal Ref:</span>
                      <span className="font-mono text-slate-700">TERMINAL-LANE-01</span>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4 font-bold">#</th>
                        <th className="py-2.5 px-4 font-bold">Item Description</th>
                        <th className="py-2.5 px-4 font-bold">SKU</th>
                        <th className="py-2.5 px-4 font-bold text-center">Qty</th>
                        <th className="py-2.5 px-4 font-bold text-right">Unit Price</th>
                        <th className="py-2.5 px-4 font-bold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {saleData.items.map((item, idx) => {
                        const lineTotal = item.quantity * item.unit_price;
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-4 font-bold text-slate-900">
                              {getItemName(item)}
                              {item.notes && <div className="text-[10px] text-blue-600 font-normal italic mt-0.5">Note: {item.notes}</div>}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">{getItemSku(item)}</td>
                            <td className="py-2.5 px-4 text-center font-bold text-slate-800">{item.quantity}</td>
                            <td className="py-2.5 px-4 text-right text-slate-600 font-mono">{formatGHS(item.unit_price)}</td>
                            <td className="py-2.5 px-4 text-right font-black text-slate-900 font-mono">{formatGHS(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary Breakdown */}
                <div className="flex justify-end pt-2">
                  <div className="w-72 space-y-2 text-xs">
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono font-bold text-slate-900">{formatGHS(grandTotal)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>Tax / VAT (0% Standard Retail):</span>
                      <span className="font-mono text-slate-900">GH₵ 0.00</span>
                    </div>
                    <div className="flex justify-between py-2 border-t-2 border-slate-900 font-black text-sm text-slate-900">
                      <span>Grand Total:</span>
                      <span className="font-mono text-blue-700">{formatGHS(grandTotal)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-600 border-t border-slate-200">
                      <span>Amount Tendered ({paymentMethod}):</span>
                      <span className="font-mono font-bold text-slate-900">{formatGHS(amountPaid)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-emerald-700 font-bold">
                      <span>Change Due:</span>
                      <span className="font-mono">{formatGHS(changeDue)}</span>
                    </div>
                    <div className="text-[10px] text-right font-bold text-emerald-600 uppercase tracking-wider pt-1 flex items-center justify-end gap-1">
                      <CheckCircle2 size={12} /> Transaction Fully Settled
                    </div>
                  </div>
                </div>

                {/* Terms & Authorization Stamp */}
                <div className="pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-slate-500">
                  <div>
                    <p className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-1">Store Terms & Conditions</p>
                    <p className="text-[10px] leading-relaxed">
                      Thank you for doing business with Ummis Lane Enterprise. Please inspect all goods upon receipt. Items returned within 7 days must be accompanied by this original receipt/invoice.
                    </p>
                  </div>
                  <div className="flex flex-col items-end justify-end text-right">
                    <div className="w-40 border-b border-slate-400 mb-1"></div>
                    <p className="text-[10px] font-bold text-slate-700 uppercase">Authorized Signature / Stamp</p>
                    <p className="text-[9px] text-slate-400">Ummis Lane Enterprise POS System</p>
                  </div>
                </div>
              </div>
            ) : (
              /* ================= POS THERMAL RECEIPT VIEW (80mm) ================= */
              <div className="space-y-3 text-center text-slate-900 font-mono text-[11px] leading-tight">
                {/* Company Logo & Branding */}
                <div className="flex flex-col items-center justify-center pb-2 border-b border-dashed border-slate-400">
                  <div className="w-10 h-10 bg-slate-900 rounded-md p-2 flex items-center justify-center text-white mb-1.5 shadow-2xs">
                    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                      <path d="M11 13H29L27 25H13L11 13Z" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="15" cy="30" r="2.5" fill="#38BDF8" />
                      <circle cx="25" cy="30" r="2.5" fill="#38BDF8" />
                      <path d="M17 19L20 22L24 17" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h2 className="font-black text-xs uppercase tracking-wider">UMMIS LANE ENTERPRISE</h2>
                  <p className="text-[9px] font-bold text-slate-700 uppercase">Retail & Wholesale Provisions</p>
                  <p className="text-[9px] text-slate-600 mt-0.5">Accra, Ghana • Tel: 0545570191 / 0591369282</p>
                  <p className="text-[9px] text-slate-600">TIN: TIN-GH90218821</p>
                </div>

                {/* Receipt Metadata */}
                <div className="text-left text-[10px] space-y-1 border-b border-dashed border-slate-400 pb-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">RECEIPT NO:</span>
                    <span className="font-bold font-mono">#REC-{saleId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">DATE:</span>
                    <span className="font-bold">{formattedDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">CASHIER:</span>
                    <span className="font-bold">{cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">CUSTOMER:</span>
                    <span className="font-bold truncate max-w-[160px]">{customerName}</span>
                  </div>
                  {customerPhone && (
                    <div className="flex justify-between">
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

                {/* Line Items Table Header */}
                <div className="border-b border-dashed border-slate-400 pb-1 text-[10px] font-bold flex justify-between uppercase">
                  <span>ITEM / QTY</span>
                  <span>TOTAL (GHS)</span>
                </div>

                {/* Line Items List */}
                <div className="border-b border-dashed border-slate-400 pb-2 text-left space-y-1.5">
                  {saleData.items.map((item, idx) => {
                    const lineTotal = item.quantity * item.unit_price;
                    return (
                      <div key={idx} className="text-[10px] space-y-0.5">
                        <div className="flex justify-between font-bold text-slate-900">
                          <span className="truncate max-w-[190px]">{getItemName(item)}</span>
                          <span className="font-mono shrink-0">{formatGHS(lineTotal)}</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                          <span>{item.quantity} x {formatGHS(item.unit_price)}</span>
                          <span className="text-slate-400 text-[8px]">[{getItemSku(item)}]</span>
                        </div>
                        {item.notes && <div className="text-[8px] italic text-blue-600">Note: {item.notes}</div>}
                      </div>
                    );
                  })}
                </div>

                {/* Totals Section */}
                <div className="border-b border-dashed border-slate-400 pb-2 space-y-1 text-right text-[10px]">
                  <div className="flex justify-between text-slate-600">
                    <span>SUBTOTAL:</span>
                    <span className="font-mono">{formatGHS(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>TAX / VAT (0%):</span>
                    <span className="font-mono">GH₵ 0.00</span>
                  </div>
                  <div className="flex justify-between font-black text-xs text-slate-900 pt-1 border-t border-slate-300">
                    <span>TOTAL:</span>
                    <span className="font-mono">{formatGHS(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>PAY METHOD:</span>
                    <span className="font-bold">{paymentMethod}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>TENDERED:</span>
                    <span className="font-bold font-mono">{formatGHS(amountPaid)}</span>
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>CHANGE:</span>
                      <span className="font-mono">{formatGHS(changeDue)}</span>
                    </div>
                  )}
                </div>

                {/* Thermal Barcode & Store Policies */}
                <div className="pt-1 space-y-1.5">
                  <div className="flex flex-col items-center">
                    {/* SVG barcode for thermal precision print */}
                    <div className="h-7 w-48 flex items-center justify-center gap-0.5 py-1 px-2 bg-slate-50 border border-slate-200 rounded">
                      {[3, 1, 4, 1, 2, 4, 1, 5, 2, 1, 3, 4, 1, 2, 4, 1, 3, 2, 4, 1].map((w, i) => (
                        <div key={i} className="h-5 bg-black" style={{ width: `${w * 1.6}px` }} />
                      ))}
                    </div>
                    <span className="font-mono text-[8px] text-slate-600 tracking-widest mt-0.5 font-bold">
                      *REC-{saleId}-UML-POS*
                    </span>
                  </div>

                  <div className="text-[8px] text-slate-600 leading-tight space-y-0.5">
                    <p className="font-bold text-slate-800">THANK YOU FOR YOUR PATRONAGE!</p>
                    <p>Goods sold in good condition are non-refundable after 7 days.</p>
                    <p>Original receipt required for all exchanges or queries.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls (Hidden during print) */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 font-medium">
            Active Layout: <span className="font-bold text-slate-800">{invoiceFormat === 'a4' ? 'A4 Official Invoice' : '80mm POS Thermal Receipt'}</span>
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer size={15} /> Print {invoiceFormat === 'receipt' ? 'Thermal Receipt' : 'Invoice'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
