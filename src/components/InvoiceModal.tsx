import React, { useState } from 'react';
import { Printer, X, FileText, CheckCircle2, RotateCcw, Building2, User, Phone, Mail, Calendar, CreditCard, Sparkles } from 'lucide-react';
import { formatGHS } from '../lib/formatters';

interface InvoiceModalProps {
  saleData: {
    saleId?: number;
    id?: number;
    date?: Date | string;
    created_at?: string;
    total?: number;
    total_amount?: number;
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
      quantity: number;
      unit_price: number;
      notes?: string;
    }>;
    status?: string;
    refund_reason?: string;
  };
  products?: any[];
  onClose: () => void;
  onNewSale?: () => void;
}

export default function InvoiceModal({ saleData, products = [], onClose, onNewSale }: InvoiceModalProps) {
  const [invoiceFormat, setInvoiceFormat] = useState<'a4' | 'receipt'>('a4');

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

  const getItemName = (item: any) => {
    if (item.product_name) return item.product_name;
    if (item.name) return item.name;
    const found = products.find(p => p.id === item.product_id);
    return found ? found.name : `Product #${item.product_id}`;
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
            padding: 20px !important;
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

      <div className="bg-white rounded-md max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header & Controls (Hidden during print) */}
        <div className="no-print bg-slate-900 text-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center text-white shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider">Sales Invoice & Receipt Viewer</h2>
              <p className="text-[11px] text-slate-400 font-medium">Invoice #INV-SALE-{saleId} • {formattedDate}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Format Switcher */}
            <div className="flex bg-slate-800 p-0.5 rounded border border-slate-700">
              <button
                onClick={() => setInvoiceFormat('a4')}
                className={`px-3 py-1 text-[11px] font-bold rounded transition-all ${
                  invoiceFormat === 'a4' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                A4 Official Invoice
              </button>
              <button
                onClick={() => setInvoiceFormat('receipt')}
                className={`px-3 py-1 text-[11px] font-bold rounded transition-all ${
                  invoiceFormat === 'receipt' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                POS Thermal Receipt
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Printer size={15} /> Print Invoice
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Area Wrapper */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          <div
            id="invoice-print-area"
            className={`mx-auto bg-white transition-all shadow-md ${
              invoiceFormat === 'a4'
                ? 'max-w-2xl p-8 sm:p-10 border border-slate-200 text-slate-800 font-sans'
                : 'max-w-[320px] p-5 border border-slate-300 font-mono text-xs text-slate-900'
            }`}
          >
            {/* ================= A4 OFFICIAL INVOICE VIEW ================= */}
            {invoiceFormat === 'a4' ? (
              <div className="space-y-6">
                {/* Invoice Header / Letterhead */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-slate-900">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 bg-slate-900 text-white rounded flex items-center justify-center font-black text-base">U</div>
                      <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Ummis Lane Enterprise</h1>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">Retail, Wholesale & Inventory Management</p>
                    <div className="mt-2 text-[11px] text-slate-600 space-y-0.5">
                      <p>Email: Issakrabiat92@gmail.com</p>
                      <p>Tel: 0545570191 / 0591369282</p>
                      <p>Location: Accra, Ghana</p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="inline-block bg-slate-900 text-white px-3 py-1 font-black text-xs uppercase tracking-widest rounded-xs mb-2">
                      {isRefunded ? 'Refunded Invoice' : 'Official Sales Invoice'}
                    </div>
                    <div className="text-lg font-black text-slate-900">#INV-SALE-{saleId}</div>
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
                      <User size={12} /> Billed To (Customer)
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
                      <p className="text-slate-600"><span className="font-bold text-slate-800">Served By / Cashier:</span> {cashierName}</p>
                      <p className="text-slate-600"><span className="font-bold text-slate-800">Status:</span> {isRefunded ? 'Refunded' : 'Paid in Full (Completed)'}</p>
                      <p className="text-slate-600"><span className="font-bold text-slate-800">Channel:</span> Point of Sale (POS)</p>
                    </div>
                  </div>
                </div>

                {/* Itemized Table */}
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900 mb-2">Purchased Items</h3>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                        <th className="p-2.5 text-left rounded-l-xs">#</th>
                        <th className="p-2.5 text-left">Item Description</th>
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
                  <div className="w-full sm:w-64 space-y-2 bg-slate-50 p-4 rounded border border-slate-200">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-semibold">{formatGHS(grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Taxes / Fees:</span>
                      <span className="font-semibold">{formatGHS(0)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-300">
                      <span>TOTAL DUE:</span>
                      <span className="text-blue-600">{formatGHS(grandTotal)}</span>
                    </div>
                    <div className="text-[10px] text-right font-bold text-emerald-600 uppercase tracking-wider pt-1">
                      ✓ Paid via {paymentMethod}
                    </div>
                  </div>
                </div>

                {/* Terms & Authorization Stamp */}
                <div className="pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-slate-500">
                  <div>
                    <p className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-1">Store Terms & Conditions</p>
                    <p className="text-[10px] leading-relaxed">
                      Thank you for doing business with Ummis Lane Enterprise. Please inspect all goods upon receipt. Items returned within 7 days must be accompanied by this original invoice.
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
              <div className="space-y-3 text-center">
                <div className="border-b border-dashed border-slate-400 pb-3">
                  <h2 className="font-bold text-sm uppercase tracking-wider">UMMIS LANE ENTERPRISE</h2>
                  <p className="text-[10px]">Email: Issakrabiat92@gmail.com</p>
                  <p className="text-[10px]">Tel: 0545570191 / 0591369282</p>
                  <p className="text-[10px] font-bold mt-1">INVOICE #{saleId}</p>
                  <p className="text-[10px]">{formattedDate}</p>
                  <p className="text-[10px] mt-0.5">Cashier: {cashierName}</p>
                  {customerName !== 'Walk-in Customer' && (
                    <p className="text-[10px] font-bold mt-1">Customer: {customerName}</p>
                  )}
                </div>

                <div className="border-b border-dashed border-slate-400 pb-3 text-left">
                  {saleData.items.map((item, idx) => (
                    <div key={idx} className="mb-1.5 last:mb-0">
                      <div className="flex justify-between font-bold">
                        <span className="truncate max-w-[180px]">{getItemName(item)}</span>
                        <span>{formatGHS(item.quantity * item.unit_price)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>{item.quantity} x {formatGHS(item.unit_price)}</span>
                        {item.notes && <span className="italic font-sans text-[9px] text-blue-600">Note: {item.notes}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-b border-dashed border-slate-400 pb-3 space-y-1 text-right">
                  <div className="flex justify-between font-bold text-sm">
                    <span>TOTAL:</span>
                    <span>{formatGHS(grandTotal)}</span>
                  </div>
                  <p className="text-[10px] text-slate-600">Payment: {paymentMethod}</p>
                </div>

                <div className="pt-2 text-[10px] text-slate-600 italic">
                  <p>Thank you for your patronage!</p>
                  <p className="text-[9px] mt-1">Ummis Lane Enterprise — Official Receipt</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls (Hidden during print) */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 font-medium">
            Format Selected: <span className="font-bold text-slate-800">{invoiceFormat === 'a4' ? 'A4 Official Letterhead' : '80mm POS Thermal Receipt'}</span>
          </p>

          <div className="flex items-center gap-2">
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
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
