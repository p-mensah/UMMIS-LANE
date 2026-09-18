import React, { useState } from 'react';
import { Printer, X, RotateCcw, FileText, CheckCircle2, User, Building2, Calendar, CreditCard, ShieldCheck } from 'lucide-react';
import { formatGHS } from '../lib/formatters';
import { useModalDismiss } from '../hooks/useModalDismiss';

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
  useModalDismiss(true, onClose);

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
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[90] overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #return-print-area, #return-print-area * {
            visibility: visible !important;
          }
          #return-print-area {
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

      <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-150">
        {/* Modal Header & Controls */}
        <div className="no-print bg-slate-900 text-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-rose-600 rounded flex items-center justify-center text-white shrink-0">
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-white">
                Sales Return & Refund Credit Note
              </h3>
              <p className="text-[11px] text-slate-300">
                Return Credit Note #{returnData.id} (Original Sale #SALE-{returnData.sale_id})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="bg-slate-800 p-0.5 rounded border border-slate-700 flex text-xs">
              <button
                type="button"
                onClick={() => setFormat('a4')}
                className={`px-2.5 py-1 rounded font-bold transition ${
                  format === 'a4' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Full Voucher
              </button>
              <button
                type="button"
                onClick={() => setFormat('receipt')}
                className={`px-2.5 py-1 rounded font-bold transition ${
                  format === 'receipt' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                POS Thermal
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              <Printer size={15} /> Print
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white transition rounded-sm"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Voucher Body */}
        <div className="overflow-y-auto p-6 sm:p-8 bg-slate-50 text-slate-800 flex-1">
          <div
            id="return-print-area"
            className={`bg-white border border-slate-200 rounded shadow-sm mx-auto p-6 ${
              format === 'receipt' ? 'max-w-[340px] text-xs font-mono' : 'max-w-xl'
            }`}
          >
            {/* Store Banner */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center sm:text-left flex flex-col sm:flex-row justify-between items-start gap-2">
              <div>
                <div className="flex items-center gap-2 text-rose-600 font-black text-lg tracking-tight">
                  <Building2 size={22} />
                  <span>RETAIL OS STORE</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Official Sales Return & Refund Credit Note</p>
              </div>

              <div className="text-right sm:text-right w-full sm:w-auto">
                <span className="inline-block px-2.5 py-0.5 bg-rose-100 border border-rose-200 text-rose-800 font-black text-[11px] uppercase rounded tracking-wider">
                  RETURN CREDIT NOTE
                </span>
                <div className="font-mono font-bold text-sm text-slate-900 mt-1">#RET-{returnData.id}</div>
                <div className="text-[11px] text-slate-500">Orig Sale: #SALE-{returnData.sale_id}</div>
              </div>
            </div>

            {/* Meta Info Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50 p-3.5 rounded border border-slate-100 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Date & Time</span>
                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                  <Calendar size={12} className="text-slate-400" />
                  {formattedDate}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Refund Method</span>
                <span className="font-bold text-rose-700 flex items-center gap-1 mt-0.5">
                  <CreditCard size={12} className="text-rose-600" />
                  {returnData.refund_method}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer Name</span>
                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                  <User size={12} className="text-slate-400" />
                  {returnData.customer_name || 'Walk-in Customer'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Processed By Staff</span>
                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                  <ShieldCheck size={12} className="text-slate-400" />
                  {returnData.user_name || 'Staff Member'}
                </span>
              </div>
            </div>

            {/* Return Reason Box */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
              <span className="font-bold block uppercase text-[10px] text-amber-800">Return Reason</span>
              <p className="mt-0.5 font-medium">{returnData.return_reason}</p>
              {returnData.notes && <p className="text-[11px] text-amber-700 italic mt-1">Notes: {returnData.notes}</p>}
            </div>

            {/* Items Table */}
            <div className="mb-6 border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
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
                      <td className="p-2.5 font-bold text-slate-900">{item.product_name}</td>
                      <td className="p-2.5 text-center font-bold text-slate-700">{item.quantity}</td>
                      <td className="p-2.5 text-right font-medium text-slate-600">{formatGHS(item.unit_price)}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">{formatGHS(item.quantity * item.unit_price)}</td>
                      <td className="p-2.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.restock_to_inventory ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {item.restock_to_inventory ? 'Restocked' : 'Damaged/Waste'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Refund Summary */}
            <div className="border-t border-slate-200 pt-4 flex justify-between items-center bg-rose-50 p-4 rounded border border-rose-200">
              <div>
                <span className="text-xs font-black text-rose-900 uppercase block tracking-wider">TOTAL REFUND AMOUNT</span>
                <span className="text-[11px] text-rose-700 font-medium">Issued via {returnData.refund_method}</span>
              </div>
              <div className="text-2xl font-black text-rose-700">
                {formatGHS(returnData.refund_amount)}
              </div>
            </div>

            {/* Signatures & Footer */}
            <div className="mt-8 pt-6 border-t border-dashed border-slate-300 text-center text-[11px] text-slate-500 space-y-4">
              <div className="grid grid-cols-2 gap-8 text-center pt-2">
                <div className="border-t border-slate-300 pt-1">
                  <p className="font-bold text-slate-700 text-[10px] uppercase">Customer Signature</p>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <p className="font-bold text-slate-700 text-[10px] uppercase">Staff Authorized Signature</p>
                </div>
              </div>
              <p className="italic">Thank you for shopping with us. Please keep this credit note for your records.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
