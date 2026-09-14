import React, { useState, useMemo } from 'react';
import { X, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, HelpCircle, RefreshCw, Plus, Check } from 'lucide-react';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';

interface BulkCsvProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availableCategories?: any[];
}

interface ParsedRow {
  lineNumber: number;
  name: string;
  sku: string;
  category: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  barcode: string;
  min_stock_level: number;
  isValid: boolean;
  error?: string;
}

const SAMPLE_CSV = `Milo Refill Pack 400g, MIL-400G, Groceries, 42.00, 49.50, 45, 890103001, 15
Ideal Evaporated Milk 160g, IDL-160M, Dairy, 9.50, 12.00, 120, 890103002, 30
Gino Tomato Paste 70g, GIN-70G, Canned Goods, 4.20, 5.50, 80, 890103003, 20
Frytol Vegetable Oil 1L, FRY-1L, Cooking Oil, 38.00, 44.00, 25, 890103004, 10`;

export default function BulkCsvProductModal({
  isOpen,
  onClose,
  onSuccess,
  availableCategories = []
}: BulkCsvProductModalProps) {
  const [csvText, setCsvText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ imported: number; updated: number } | null>(null);

  // Real-time parsing logic
  const { parsedRows, validRows, invalidRows } = useMemo(() => {
    if (!csvText.trim()) {
      return { parsedRows: [], validRows: [], invalidRows: [] };
    }

    const lines = csvText.split('\n');
    const results: ParsedRow[] = [];

    lines.forEach((line, idx) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return; // ignore empty rows

      // Check if this line is likely a header row
      const lower = trimmedLine.toLowerCase();
      if (idx === 0 && (lower.includes('name') || lower.includes('product') || lower.includes('sku') || lower.includes('selling'))) {
        return; // skip header line
      }

      // Simple CSV split (supporting quotes if any)
      const parts = trimmedLine.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));

      const name = parts[0] || '';
      const sku = parts[1] || '';
      const category = parts[2] || 'General';
      const cost_price_raw = parts[3] || '0';
      const selling_price_raw = parts[4] || '0';
      const stock_qty_raw = parts[5] || '0';
      const barcode = parts[6] || '';
      const min_stock_raw = parts[7] || '10';

      const cost_price = parseFloat(cost_price_raw);
      const selling_price = parseFloat(selling_price_raw);
      const stock_quantity = parseInt(stock_qty_raw, 10);
      const min_stock_level = parseInt(min_stock_raw, 10);

      let isValid = true;
      let error = '';

      if (!name) {
        isValid = false;
        error = 'Product name is required';
      } else if (isNaN(selling_price) || selling_price < 0) {
        isValid = false;
        error = 'Selling price must be a valid positive number';
      } else if (isNaN(cost_price) || cost_price < 0) {
        isValid = false;
        error = 'Cost price must be a valid number';
      } else if (isNaN(stock_quantity)) {
        isValid = false;
        error = 'Stock quantity must be a valid integer';
      }

      results.push({
        lineNumber: idx + 1,
        name,
        sku,
        category,
        cost_price: isNaN(cost_price) ? 0 : cost_price,
        selling_price: isNaN(selling_price) ? 0 : selling_price,
        stock_quantity: isNaN(stock_quantity) ? 0 : stock_quantity,
        barcode,
        min_stock_level: isNaN(min_stock_level) ? 10 : min_stock_level,
        isValid,
        error
      });
    });

    const validRows = results.filter(r => r.isValid);
    const invalidRows = results.filter(r => !r.isValid);

    return { parsedRows: results, validRows, invalidRows };
  }, [csvText]);

  if (!isOpen) return null;

  const handleInsertSample = () => {
    setCsvText(SAMPLE_CSV);
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleClear = () => {
    setCsvText('');
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validRows.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const payload = {
        products: validRows.map(row => ({
          name: row.name,
          sku: row.sku || undefined, // server will auto-generate if empty
          category: row.category,
          cost_price: row.cost_price,
          selling_price: row.selling_price,
          stock_quantity: row.stock_quantity,
          barcode: row.barcode || null,
          min_stock_level: row.min_stock_level
        }))
      };

      const res = await fetchApi('/products/bulk-import', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSubmitSuccess({
        imported: res.importedCount || validRows.length,
        updated: res.updatedCount || 0
      });

      onSuccess();

      // Automatically clear and close after 1.5s on success
      setTimeout(() => {
        onClose();
        setSubmitSuccess(null);
        setCsvText('');
      }, 1800);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to import products. Please check formatting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Add Multiple Products via CSV Text
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Paste or type comma-separated product details to add multiple catalog items at once
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Format Specification Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <HelpCircle size={14} className="text-blue-600" />
                CSV Format Columns (One Product Per Line)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInsertSample}
                  className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> Insert Sample CSV
                </button>
                {csvText && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-red-600 bg-slate-200/70 hover:bg-red-50 rounded transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="p-2 bg-white rounded border border-slate-200 font-mono text-[11px] text-slate-700 overflow-x-auto">
              <span className="text-blue-600 font-bold">Name</span>,{' '}
              <span className="text-slate-500">SKU</span>,{' '}
              <span className="text-slate-500">Category</span>,{' '}
              <span className="text-slate-500">Cost Price</span>,{' '}
              <span className="text-emerald-600 font-bold">Selling Price</span>,{' '}
              <span className="text-slate-500">Stock Qty</span>,{' '}
              <span className="text-slate-400">Barcode</span>,{' '}
              <span className="text-slate-400">Reorder Level</span>
            </div>

            <p className="text-[11px] text-slate-500">
              * Required fields: <strong>Name</strong> and <strong>Selling Price</strong>. SKUs will be automatically generated if omitted. Default reorder level is 10.
            </p>
          </div>

          {/* Success Notification Alert */}
          {submitSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>
                Successfully processed {submitSuccess.imported} new product(s) added and {submitSuccess.updated} updated! Updating catalog...
              </span>
            </div>
          )}

          {/* Error Notification Alert */}
          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertTriangle size={16} className="text-red-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Text Input Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                CSV Input Text Area
              </label>
              <div className="flex items-center gap-3 text-xs">
                {validRows.length > 0 && (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Check size={13} /> {validRows.length} Product(s) Ready
                  </span>
                )}
                {invalidRows.length > 0 && (
                  <span className="text-amber-700 font-bold flex items-center gap-1">
                    <AlertTriangle size={13} /> {invalidRows.length} Row(s) Need Attention
                  </span>
                )}
              </div>
            </div>

            <textarea
              id="bulk-csv-textarea"
              rows={7}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`Paste or type product rows here. Example:\nCoca-Cola 500ml, COC-500, Beverages, 5.00, 6.50, 50, 54490001, 10\nVoltic Mineral Water 750ml, VOL-750, Beverages, 3.00, 4.00, 100, 89012345, 20`}
              className="w-full font-mono text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50 leading-relaxed custom-scrollbar"
            />
          </div>

          {/* Validation Warnings if any invalid rows */}
          {invalidRows.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
              <div className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Validation Warning
              </div>
              <ul className="text-[11px] text-amber-900 list-disc list-inside space-y-0.5">
                {invalidRows.slice(0, 3).map((r, i) => (
                  <li key={i}>
                    Line {r.lineNumber}: {r.error} (preview: "{r.name || 'Empty'}")
                  </li>
                ))}
                {invalidRows.length > 3 && (
                  <li>...and {invalidRows.length - 3} more invalid line(s).</li>
                )}
              </ul>
            </div>
          )}

          {/* Live Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Live Parsed Preview ({validRows.length} valid / {parsedRows.length} total)
                </h3>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-48 custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-black text-[10px] tracking-wider sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2 text-center w-8">#</th>
                      <th className="p-2">Product Name</th>
                      <th className="p-2">SKU</th>
                      <th className="p-2">Category</th>
                      <th className="p-2 text-right">Cost</th>
                      <th className="p-2 text-right">Selling Price</th>
                      <th className="p-2 text-center">Initial Stock</th>
                      <th className="p-2 text-center">Reorder Pt</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                        <td className="p-2 text-center font-mono text-slate-400 text-[11px]">
                          {row.lineNumber}
                        </td>
                        <td className="p-2 font-bold text-slate-900 truncate max-w-[180px]">
                          {row.name || <span className="text-red-500 italic">Missing Name</span>}
                        </td>
                        <td className="p-2 font-mono text-slate-500 text-[11px]">
                          {row.sku || <span className="text-slate-400 italic">Auto-gen</span>}
                        </td>
                        <td className="p-2 text-slate-600">
                          {row.category}
                        </td>
                        <td className="p-2 text-right text-slate-600 font-mono">
                          {formatGHS(row.cost_price)}
                        </td>
                        <td className="p-2 text-right font-black text-slate-900 font-mono">
                          {formatGHS(row.selling_price)}
                        </td>
                        <td className="p-2 text-center font-bold text-slate-800">
                          {row.stock_quantity}
                        </td>
                        <td className="p-2 text-center font-mono text-slate-500 text-[11px]">
                          {row.min_stock_level}
                        </td>
                        <td className="p-2 text-center">
                          {row.isValid ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded uppercase">
                              Valid
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded uppercase" title={row.error}>
                              Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {validRows.length > 0 ? (
              <span>Ready to add <strong>{validRows.length}</strong> product(s) to catalog</span>
            ) : (
              <span>Enter or paste CSV lines above to preview and import</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={validRows.length === 0 || isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Adding Products...</span>
                </>
              ) : (
                <>
                  <Plus size={15} />
                  <span>Add {validRows.length > 0 ? `${validRows.length} Products` : 'Products'} to Catalog</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
