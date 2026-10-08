import React, { useState, useEffect } from 'react';
import { Printer, X, RotateCcw, FileText, CheckCircle2, User, Building2, Calendar, CreditCard, ShieldCheck } from 'lucide-react';
import { formatGHS } from '../lib/formatters';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { fetchApi } from '../lib/api';

interface ReturnInvoiceModalProps {
  returnData: {
    id: number;
    sale_id: number;
    created_at: string;
    refund_amount: number;
    refund_method: string;
    return_reason: string;
    user_name?: string;
    customer_name?: string | null;
    customer_phone?: string | null;
    notes?: string;
    items: Array<{
      product_name: string;
      quantity: number;
      unit_price: number;
      restock_to_inventory: number;
      reason?: string;
    }>;
  };
  onClose: () => void;
}

export default function ReturnInvoiceModal({ returnData, onClose }: ReturnInvoiceModalProps) {
  const [format, setFormat] = useState<'a4' | 'receipt'>('a4');
  const [storeName, setStoreName] = useState('Ummis Lane Enterprise');
  useModalDismiss(true, onClose);

  useEffect(() => {
    fetchApi('/settings')
      .then(data => {
        if (data?.store_name) setStoreName(data.store_name);
      })
      .catch(() => {});
  }, []);

  const rawDate = returnData.created_at || new Date().toISOString();
  const dateObj = new Date(rawDate.endsWith('Z') ? rawDate : rawDate + 'Z');
  const formattedDate = dateObj.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 z-[90] overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <style>{`
        @media print {
          @page {
            margin: ${format === 'receipt' ? '2mm 3mm' : '10mm 12mm'};
            size: ${format === 'receipt' ? '80mm auto' : 'A4 portrait'};
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
          /* Reset modal traps */
          .fixed,
          [role="dialog"],
          .modal-overlay,
          .overflow-y-auto,
          .overflow-hidden,
          .max-h-\\[96dvh\\] {
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
          #return-print-area, #return-print-area * {
            visibility: visible !important;
          }
          #return-print-area {
            position: relative !important;
            display: block !important;
            width: ${format === 'receipt' ? '72mm !important' : '100% !important'};
            max-width: ${format === 'receipt' ? '72mm !important' : '100% !important'};
            margin: 0 auto !important;
            padding: ${format === 'receipt' ? '1mm 1.5mm !important' : '0 !important'};
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
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

      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[96dvh] my-auto animate-in zoom-in-95 duration-150 min-w-0">
        {/* Modal Header & Controls */}
        <div className="no-print bg-slate-900 text-white p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 bg-rose-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs">
              <RotateCcw size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider text-white truncate">
                Sales Return Credit Note
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-300 truncate">
                Credit Note #{returnData.id} (Sale #SALE-{returnData.sale_id})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap xs:flex-nowrap">
            <div className="bg-slate-800 p-0.5 rounded-xl border border-slate-700 flex text-xs shrink-0">
              <button
                type="button"
                onClick={() => setFormat('a4')}
                className={`min-h-[36px] px-2.5 sm:px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                  format === 'a4' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Full Voucher
              </button>
              <button
                type="button"
                onClick={() => setFormat('receipt')}
                className={`min-h-[36px] px-2.5 sm:px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                  format === 'receipt' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                POS Thermal
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[36px] px-3.5 sm:px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer active:scale-95"
            >
              <Printer size={15} /> <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Voucher Body */}
        <div className="overflow-y-auto overflow-x-hidden p-2.5 xs:p-4 sm:p-6 md:p-8 bg-slate-50 text-slate-800 flex-1 flex justify-center custom-scrollbar">
          <div
            id="return-print-area"
            className={`bg-white border border-slate-200 rounded-xl shadow-sm w-full p-4 xs:p-5 sm:p-6 transition-all ${
              format === 'receipt' ? 'max-w-[340px] text-xs font-mono' : 'max-w-xl'
            }`}
          >
            {/* Store Banner */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4 text-left flex flex-col sm:flex-row justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-rose-600 font-black text-base sm:text-lg tracking-tight">
                  <Building2 size={20} className="shrink-0" />
                  <span className="truncate">{storeName.toUpperCase()}</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Sales Return & Refund Credit Note</p>
              </div>

              <div className="text-left sm:text-right shrink-0 w-full sm:w-auto">
                <span className="inline-block px-2.5 py-0.5 bg-rose-100 border border-rose-200 text-rose-800 font-black text-[10px] sm:text-[11px] uppercase rounded-md tracking-wider">
                  RETURN CREDIT NOTE
                </span>
                <div className="font-mono font-bold text-sm text-slate-900 mt-1">#RET-{returnData.id}</div>
                <div className="text-[11px] text-slate-500">Orig Sale: #SALE-{returnData.sale_id}</div>
              </div>
            </div>

            {/* Meta Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-5 bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-100 text-xs">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Date & Time</span>
                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                  <Calendar size={12} className="text-slate-400 shrink-0" />
                  <span>{formattedDate}</span>
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Refund Method</span>
                <span className="font-bold text-rose-700 flex items-center gap-1 mt-0.5 truncate">
                  <CreditCard size={12} className="text-rose-600 shrink-0" />
                  <span>{returnData.refund_method}</span>
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer Name</span>
                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 break-words">
                  <User size={12} className="text-slate-400 shrink-0" />
                  <span>{returnData.customer_name || 'Walk-in Customer'}</span>
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Processed By Staff</span>
                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                  <ShieldCheck size={12} className="text-slate-400 shrink-0" />
                  <span>{returnData.user_name || 'Staff Member'}</span>
                </span>
              </div>
            </div>

            {/* Return Reason Box */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 break-words">
              <span className="font-bold block uppercase text-[10px] text-amber-800">Return Reason</span>
              <p className="mt-0.5 font-medium">{returnData.return_reason}</p>
              {returnData.notes && <p className="text-[11px] text-amber-700 italic mt-1">Notes: {returnData.notes}</p>}
            </div>

            {/* Responsive Items Table: Cards on mobile, Table on desktop */}
            {/* 1. Mobile Cards Layout */}
            <div className="block sm:hidden print-hide-cards space-y-2 mb-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-1">
                Returned Items ({returnData.items.length})
              </div>
              {returnData.items.map((item, idx) => (
                <div key={idx} className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3 space-y-1 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <h5 className="font-bold text-slate-900 break-words flex-1 min-w-0">{item.product_name}</h5>
                    <span className="font-mono font-black text-slate-900 shrink-0">{formatGHS(item.quantity * item.unit_price)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-600 font-mono pt-1 border-t border-slate-200/60">
                    <span>Qty: <strong>{item.quantity}</strong> @ {formatGHS(item.unit_price)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      item.restock_to_inventory ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {item.restock_to_inventory ? 'Restocked' : 'Waste'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. Desktop Tabular Layout */}
            <div className="hidden sm:block print-show-table mb-5 border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[440px] sm:min-w-0">
                <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Returned Item</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Unit Price</th>
                    <th className="p-2.5 text-right">Subtotal</th>
                    <th className="p-2.5 text-center">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnData.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900 break-words">{item.product_name}</td>
                      <td className="p-2.5 text-center font-bold text-slate-700">{item.quantity}</td>
                      <td className="p-2.5 text-right font-medium text-slate-600 font-mono">{formatGHS(item.unit_price)}</td>
                      <td className="p-2.5 text-right font-black text-slate-900 font-mono">{formatGHS(item.quantity * item.unit_price)}</td>
                      <td className="p-2.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.restock_to_inventory ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {item.restock_to_inventory ? 'Restocked' : 'Waste'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Refund Summary */}
            <div className="border-t border-slate-200 pt-3 flex justify-between items-center bg-rose-50 p-3 sm:p-4 rounded-xl border border-rose-200 print-avoid-break">
              <div>
                <span className="text-xs font-black text-rose-900 uppercase block tracking-wider">TOTAL REFUND AMOUNT</span>
                <span className="text-[11px] text-rose-700 font-medium">Issued via {returnData.refund_method}</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-rose-700 font-mono">
                {formatGHS(returnData.refund_amount)}
              </div>
            </div>

            {/* Signatures & Footer */}
            <div className="mt-6 sm:mt-8 pt-5 border-t border-dashed border-slate-300 text-center text-[11px] text-slate-500 space-y-4 print-avoid-break">
              <div className="grid grid-cols-2 gap-4 sm:gap-8 text-center pt-2">
                <div className="border-t border-slate-300 pt-1">
                  <p className="font-bold text-slate-700 text-[10px] uppercase">Customer Signature</p>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <p className="font-bold text-slate-700 text-[10px] uppercase">Staff Authorized Signature</p>
                </div>
              </div>
              <p className="italic text-[10px]">Thank you for shopping with us. Please keep this credit note for your records.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
