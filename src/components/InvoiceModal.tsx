import React, { useState } from 'react';
import { Printer, X, FileText, CheckCircle2, RotateCcw, Building2, User, Phone, Mail, Calendar, CreditCard } from 'lucide-react';
import { formatGHS } from '../lib/formatters';

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
  const [invoiceFormat, setInvoiceFormat] = useState<'a4' | 'receipt'>(initialFormat);

  const saleId = saleData.saleId || saleData.id || 0;
  const rawDate = saleData.date || saleData.created_at || new Date();
  const dateObj = typeof rawDate === 'string' ? new Date(rawDate.endsWith('Z') ? rawDate : rawDate + 'Z') : new Date(rawDate);
  const formattedDate = dateObj.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const customerName = saleData.customerName || saleData.customer_name || 'Walk-in Customer';
  const customerPhone = saleData.customer_phone || null;
  const customerEmail = saleData.customer_email || null;
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
            width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
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
                onClick={() => setInvoiceFormat('receipt')}
                className={`px-3 py-1 text-[11px] font-bold rounded transition-all flex items-center gap-1.5 ${
                  invoiceFormat === 'receipt' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>POS Thermal (80mm)</span>
              </button>
              <button
                onClick={() => setInvoiceFormat('a4')}
                className={`px-3 py-1 text-[11px] font-bold rounded transition-all flex items-center gap-1.5 ${
                  invoiceFormat === 'a4' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>A4 Official Invoice</span>
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
            >
              <Printer size={15} /> {invoiceFormat === 'receipt' ? 'Print Receipt' : 'Print Invoice'}
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors shrink-0"
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
                    {/* SVG Company Logo */}
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
                    <div className="text-lg font-black text-slate-900 font-mono">#INV-SALE-{saleId}</div>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">{formattedDate}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      <CreditCard size={12} className="text-blue-600" /> Payment: {paymentMethod}
                    </div>
                  </div>
                </div>

                {/* Status Alert if refunded */}
                {isRefunded && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800 text-xs font-bold flex items-center gap-2">
                    <RotateCcw size={16} className="text-red-600" />
                    <span>THIS TRANSACTION HAS BEEN REFUNDED. {saleData.refund_reason && `Reason: "${saleData.refund_reason}"`}</span>
                  </div>
                )}

                {/* Metadata Grid (Bill To & Sale Details) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 rounded border border-slate-200">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
                      <User size={12} /> Customer / Bill To
                    </h3>
                    <p className="text-sm font-bold text-slate-900">{customerName}</p>
                    {customerPhone && <p className="text-xs text-slate-600 font-medium">Tel: {customerPhone}</p>}
                    {customerEmail && <p className="text-xs text-slate-600 font-medium">Email: {customerEmail}</p>}
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
                      <Building2 size={12} /> Transaction Metadata
                    </h3>
                    <div className="text-xs space-y-1">
                      <p className="text-slate-600"><span className="font-bold text-slate-800">Cashier:</span> {cashierName}</p>
                      <p className="text-slate-600"><span className="font-bold text-slate-800">Status:</span> {isRefunded ? 'Refunded' : 'Paid in Full (Completed)'}</p>
                      <p className="text-slate-600"><span className="font-bold text-slate-800">Channel:</span> Point of Sale (POS Terminal #1)</p>
                    </div>
                  </div>
                </div>

                {/* Itemized Table */}
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900 mb-2">Itemized Line Items</h3>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                        <th className="p-2.5 text-left rounded-l-xs">#</th>
                        <th className="p-2.5 text-left">Item Description</th>
                        <th className="p-2.5 text-left">SKU</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Unit Price</th>
                        <th className="p-2.5 text-right rounded-r-xs">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {saleData.items.map((item, idx) => {
                        const subtotal = item.quantity * item.unit_price;
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 text-slate-400 font-mono font-bold">{idx + 1}</td>
                            <td className="p-2.5">
                              <span className="font-bold text-slate-900 block">{getItemName(item)}</span>
                              {item.notes && <span className="text-[10px] text-blue-600 font-semibold italic block">Note: {item.notes}</span>}
                            </td>
                            <td className="p-2.5 text-slate-500 font-mono text-[11px]">{getItemSku(item)}</td>
                            <td className="p-2.5 text-center font-bold text-slate-800">{item.quantity}</td>
                            <td className="p-2.5 text-right font-medium text-slate-600">{formatGHS(item.unit_price)}</td>
                            <td className="p-2.5 text-right font-bold text-slate-900">{formatGHS(subtotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Total Summary Block */}
                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <div className="w-full sm:w-72 space-y-2 bg-slate-50 p-4 rounded border border-slate-200">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-semibold">{formatGHS(grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>VAT / NHIL (0%):</span>
                      <span className="font-semibold">{formatGHS(0)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-300">
                      <span>TOTAL DUE:</span>
                      <span className="text-blue-600">{formatGHS(grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 pt-1 border-t border-slate-200">
                      <span>Amount Paid ({paymentMethod}):</span>
                      <span className="font-bold text-slate-800">{formatGHS(amountPaid)}</span>
                    </div>
                    {changeDue > 0 && (
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Change Given:</span>
                        <span className="font-bold text-emerald-600">{formatGHS(changeDue)}</span>
                      </div>
                    )}
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
              <div className="space-y-3 text-center text-slate-900">
                {/* Company Logo & Branding */}
                <div className="flex flex-col items-center justify-center pb-2 border-b border-dashed border-slate-400">
                  <div className="w-10 h-10 bg-slate-900 rounded-lg p-2 flex items-center justify-center text-white mb-1.5">
                    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                      <path d="M11 13H29L27 25H13L11 13Z" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="15" cy="30" r="2.5" fill="#38BDF8" />
                      <circle cx="25" cy="30" r="2.5" fill="#38BDF8" />
                      <path d="M17 19L20 22L24 17" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h2 className="font-black text-sm uppercase tracking-wider">UMMIS LANE ENTERPRISE</h2>
                  <p className="text-[9px] font-bold text-slate-700 tracking-wide uppercase">Retail & Wholesale Provisions</p>
                  <p className="text-[9px] text-slate-600 mt-0.5">Accra, Ghana • Tel: 0545570191 / 0591369282</p>
                  <p className="text-[9px] text-slate-600">Email: Issakrabiat92@gmail.com</p>
                  <p className="text-[9px] text-slate-600">TIN: TIN-GH90218821</p>
                </div>

                {/* Receipt Metadata */}
                <div className="text-left text-[10px] space-y-0.5 border-b border-dashed border-slate-400 pb-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">RECEIPT NO:</span>
                    <span className="font-bold font-mono">#REC-{saleId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">DATE & TIME:</span>
                    <span className="font-bold">{formattedDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">CASHIER:</span>
                    <span className="font-bold">{cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">CUSTOMER:</span>
                    <span className="font-bold truncate max-w-[170px]">{customerName}</span>
                  </div>
                  {customerPhone && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">PHONE:</span>
                      <span className="font-bold">{customerPhone}</span>
                    </div>
                  )}
                  {isRefunded && (
                    <div className="mt-1 p-1 bg-red-100 text-red-800 font-bold text-center rounded text-[9px] uppercase">
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
                <div className="border-b border-dashed border-slate-400 pb-3 text-left space-y-2">
                  {saleData.items.map((item, idx) => {
                    const lineTotal = item.quantity * item.unit_price;
                    return (
                      <div key={idx} className="text-[10px]">
                        <div className="flex justify-between font-bold">
                          <span className="truncate max-w-[210px] text-slate-900">{getItemName(item)}</span>
                          <span className="font-mono">{formatGHS(lineTotal)}</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-600">
                          <span>{item.quantity} x {formatGHS(item.unit_price)} [{getItemSku(item)}]</span>
                        </div>
                        {item.notes && <div className="text-[8px] italic text-blue-600">Note: {item.notes}</div>}
                      </div>
                    );
                  })}
                </div>

                {/* Totals Section */}
                <div className="border-b border-dashed border-slate-400 pb-2.5 space-y-1 text-right text-[10px]">
                  <div className="flex justify-between text-slate-600">
                    <span>SUBTOTAL:</span>
                    <span className="font-mono">{formatGHS(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>TAX / VAT (0%):</span>
                    <span className="font-mono">GH₵ 0.00</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-300">
                    <span>TOTAL:</span>
                    <span className="font-mono">{formatGHS(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>PAYMENT METHOD:</span>
                    <span className="font-bold">{paymentMethod}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>AMOUNT TENDERED:</span>
                    <span className="font-bold font-mono">{formatGHS(amountPaid)}</span>
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>CHANGE:</span>
                      <span className="font-mono">{formatGHS(changeDue)}</span>
                    </div>
                  )}
                </div>

                {/* Barcode / QR Simulation & Return Policy */}
                <div className="pt-1 space-y-2">
                  <div className="flex flex-col items-center">
                    {/* Simulated barcode representation */}
                    <div className="h-8 flex items-center justify-center gap-0.5 py-1 px-4 bg-slate-50 border border-slate-200 rounded">
                      {[4, 2, 6, 1, 3, 5, 2, 7, 3, 1, 4, 6, 2, 3, 5, 1, 4, 2].map((w, i) => (
                        <div key={i} className="h-6 bg-slate-900" style={{ width: `${w * 1.5}px` }} />
                      ))}
                    </div>
                    <span className="font-mono text-[8px] text-slate-500 tracking-widest mt-0.5">
                      *REC-{saleId}-UML-POS*
                    </span>
                  </div>

                  <div className="text-[8px] text-slate-500 leading-tight space-y-0.5">
                    <p className="font-bold text-slate-700">THANK YOU FOR YOUR PATRONAGE!</p>
                    <p>Goods sold in good condition are non-refundable after 7 days.</p>
                    <p>Must present this original receipt for any exchange or inquiry.</p>
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
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer size={14} /> Print Receipt
            </button>
            {onNewSale && (
              <button
                onClick={() => {
                  onClose();
                  onNewSale();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition-colors"
              >
                Start New Sale
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
