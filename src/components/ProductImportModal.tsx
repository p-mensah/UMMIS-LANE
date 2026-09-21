import React, { useState, useRef } from 'react';
import { 
  X, Upload, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, 
  ArrowRight, Download, Trash2, Plus, RefreshCw, Check,
  Layers, Package, AlertTriangle, Eye, Table
} from 'lucide-react';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';

interface ProductImportModalProps {
  existingProducts: any[];
  categories: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export interface ParsedItem {
  id?: string;
  name: string;
  sku: string;
  category: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  barcode: string;
  brand: string;
  unit_of_measure: string;
  min_stock_level: number;
  selected: boolean;
  isExisting?: boolean;
  matchedProduct?: any;
  errors: string[];
}

const PRESET_TEMPLATES: { [key: string]: { title: string; desc: string; count: number; items: any[] } } = {
  groceries: {
    title: 'Supermarket Groceries & Provisions',
    desc: 'High-velocity fast moving retail goods (Milk, Milo, Rice, Oil, Sugar, etc.)',
    count: 8,
    items: [
      { sku: 'MLK-IDEAL-160', name: 'Ideal Evaporated Milk 160g', category: 'Groceries', cost_price: 5.50, selling_price: 7.20, stock_quantity: 120, barcode: '60010010001', brand: 'Nestle', unit_of_measure: 'tin', min_stock_level: 24 },
      { sku: 'MILO-TIN-400', name: 'Milo Chocolate Drink 400g', category: 'Groceries', cost_price: 24.00, selling_price: 32.00, stock_quantity: 45, barcode: '60010010002', brand: 'Nestle', unit_of_measure: 'tin', min_stock_level: 10 },
      { sku: 'RIC-GINO-5KG', name: 'Gino Thai Jasmine Rice 5kg', category: 'Grains & Pasta', cost_price: 78.00, selling_price: 95.00, stock_quantity: 30, barcode: '60010010003', brand: 'Gino', unit_of_measure: 'bag', min_stock_level: 5 },
      { sku: 'OIL-FRY-1L', name: 'Frytol Vegetable Cooking Oil 1L', category: 'Cooking Ingredients', cost_price: 28.00, selling_price: 35.00, stock_quantity: 40, barcode: '60010010004', brand: 'Frytol', unit_of_measure: 'bottle', min_stock_level: 8 },
      { sku: 'IND-ONION-70G', name: 'Indomie Instant Noodles Onion Chicken 70g', category: 'Grains & Pasta', cost_price: 3.20, selling_price: 4.50, stock_quantity: 200, barcode: '60010010005', brand: 'Indomie', unit_of_measure: 'pack', min_stock_level: 40 },
      { sku: 'MCK-GEISHA-425', name: 'Geisha Mackerel in Tomato Sauce 425g', category: 'Canned Goods', cost_price: 16.50, selling_price: 21.00, stock_quantity: 60, barcode: '60010010006', brand: 'Geisha', unit_of_measure: 'tin', min_stock_level: 12 },
      { sku: 'SUG-STLOUIS-500', name: 'St. Louis Sugar Cubes 500g', category: 'Groceries', cost_price: 14.00, selling_price: 18.00, stock_quantity: 50, barcode: '60010010007', brand: 'St. Louis', unit_of_measure: 'box', min_stock_level: 10 },
      { sku: 'TEA-LIPTON-100', name: 'Lipton Yellow Label Tea Bags 100s', category: 'Beverages', cost_price: 26.00, selling_price: 34.00, stock_quantity: 35, barcode: '60010010008', brand: 'Lipton', unit_of_measure: 'box', min_stock_level: 6 }
    ]
  },
  beverages: {
    title: 'Packaged Drinks & Beverages',
    desc: 'Bottled water, sodas, energy drinks, and fruit juices',
    count: 6,
    items: [
      { sku: 'WAT-BELAQUA-750', name: 'Bel-Aqua Natural Mineral Water 750ml', category: 'Beverages', cost_price: 1.80, selling_price: 3.00, stock_quantity: 150, barcode: '60020010001', brand: 'Bel-Aqua', unit_of_measure: 'bottle', min_stock_level: 30 },
      { sku: 'WAT-VOLTIC-500', name: 'Voltic Natural Mineral Water 500ml', category: 'Beverages', cost_price: 1.60, selling_price: 2.50, stock_quantity: 180, barcode: '60020010002', brand: 'Voltic', unit_of_measure: 'bottle', min_stock_level: 36 },
      { sku: 'SOD-COCA-330', name: 'Coca-Cola Classic Can 330ml', category: 'Beverages', cost_price: 6.00, selling_price: 8.50, stock_quantity: 72, barcode: '60020010003', brand: 'Coca-Cola', unit_of_measure: 'can', min_stock_level: 24 },
      { sku: 'MLT-GUINN-330', name: 'Malta Guinness Can 330ml', category: 'Beverages', cost_price: 7.00, selling_price: 10.00, stock_quantity: 80, barcode: '60020010004', brand: 'Guinness', unit_of_measure: 'can', min_stock_level: 20 },
      { sku: 'JUC-CERES-1L', name: 'Ceres 100% Fruit Juice Secrets of the Valley 1L', category: 'Beverages', cost_price: 22.00, selling_price: 29.00, stock_quantity: 30, barcode: '60020010005', brand: 'Ceres', unit_of_measure: 'carton', min_stock_level: 6 },
      { sku: 'NRG-STORM-330', name: 'Storm Energy Drink 330ml', category: 'Beverages', cost_price: 4.50, selling_price: 6.50, stock_quantity: 90, barcode: '60020010006', brand: 'Kasapreko', unit_of_measure: 'bottle', min_stock_level: 24 }
    ]
  },
  household: {
    title: 'Personal Care & Household Supplies',
    desc: 'Soaps, antiseptics, detergents, toothpaste, and cleaning products',
    count: 6,
    items: [
      { sku: 'ANT-DETTOL-250', name: 'Dettol Antiseptic Liquid 250ml', category: 'Personal Care', cost_price: 24.00, selling_price: 32.00, stock_quantity: 40, barcode: '60030010001', brand: 'Dettol', unit_of_measure: 'bottle', min_stock_level: 8 },
      { sku: 'DET-SUNLIGHT-1KG', name: 'Sunlight Washing Powder Detergent 1kg', category: 'Household', cost_price: 18.00, selling_price: 25.00, stock_quantity: 50, barcode: '60030010002', brand: 'Sunlight', unit_of_measure: 'pack', min_stock_level: 10 },
      { sku: 'SOP-GEISHA-200', name: 'Geisha Aloe Vera Beauty Soap 200g', category: 'Personal Care', cost_price: 6.50, selling_price: 9.00, stock_quantity: 100, barcode: '60030010003', brand: 'Geisha', unit_of_measure: 'bar', min_stock_level: 20 },
      { sku: 'PST-PEPSO-140', name: 'Pepsodent Triple Protection Toothpaste 140g', category: 'Personal Care', cost_price: 11.50, selling_price: 16.00, stock_quantity: 60, barcode: '60030010004', brand: 'Pepsodent', unit_of_measure: 'tube', min_stock_level: 12 },
      { sku: 'TIS-KLEEN-10', name: 'Kleenex Soft Facial Tissue Pocket 10s', category: 'Household', cost_price: 4.00, selling_price: 6.00, stock_quantity: 80, barcode: '60030010005', brand: 'Kleenex', unit_of_measure: 'pack', min_stock_level: 15 },
      { sku: 'CLN-OMO-500', name: 'OMO Multi-Active Washing Powder 500g', category: 'Household', cost_price: 10.00, selling_price: 14.00, stock_quantity: 65, barcode: '60030010006', brand: 'OMO', unit_of_measure: 'pack', min_stock_level: 12 }
    ]
  }
};

export default function ProductImportModal({
  existingProducts,
  categories,
  onClose,
  onSuccess
}: ProductImportModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'templates'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState('General');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to validate and enrich items against existing catalog
  const enrichParsedItems = (rawItems: any[]): ParsedItem[] => {
    return rawItems.map((raw, idx) => {
      const name = (raw.name || raw.product_name || raw.title || '').trim();
      const sku = (raw.sku || raw.item_code || raw.code || `SKU-${Date.now().toString(36).toUpperCase()}-${idx + 1}`).trim();
      const category = (raw.category || raw.department || defaultCategory).trim();
      const cost_price = typeof raw.cost_price === 'number' ? raw.cost_price : parseFloat(raw.cost_price || raw.cost || '0') || 0;
      const selling_price = typeof raw.selling_price === 'number' ? raw.selling_price : parseFloat(raw.selling_price || raw.price || '0') || 0;
      const stock_quantity = typeof raw.stock_quantity === 'number' ? raw.stock_quantity : parseInt(raw.stock_quantity || raw.qty || raw.stock || '0', 10) || 0;
      const barcode = (raw.barcode || raw.upc || raw.ean || '').toString().trim();
      const brand = (raw.brand || '').trim();
      const unit_of_measure = (raw.unit_of_measure || raw.uom || raw.unit || 'pcs').trim();
      const min_stock_level = typeof raw.min_stock_level === 'number' ? raw.min_stock_level : parseInt(raw.min_stock_level || '10', 10) || 10;

      // Validation
      const errors: string[] = [];
      if (!name) errors.push('Product Name is required');
      if (cost_price < 0) errors.push('Cost price cannot be negative');
      if (selling_price < 0) errors.push('Selling price cannot be negative');
      if (stock_quantity < 0) errors.push('Stock cannot be negative');

      // Check if product exists in catalog
      let matched: any = null;
      if (sku) {
        matched = existingProducts.find(p => p.sku && p.sku.toLowerCase() === sku.toLowerCase());
      }
      if (!matched && barcode) {
        matched = existingProducts.find(p => p.barcode && p.barcode.toLowerCase() === barcode.toLowerCase());
      }
      if (!matched && name) {
        matched = existingProducts.find(p => p.name && p.name.toLowerCase() === name.toLowerCase());
      }

      return {
        id: `import-${idx}-${Date.now()}`,
        name,
        sku,
        category: category || 'General',
        cost_price,
        selling_price,
        stock_quantity,
        barcode,
        brand,
        unit_of_measure,
        min_stock_level,
        selected: errors.length === 0,
        isExisting: !!matched,
        matchedProduct: matched,
        errors
      };
    });
  };

  // Parser for CSV / TSV / Semicolon-delimited Text
  const parseDelimitedText = (text: string) => {
    try {
      const trimmed = text.trim();
      if (!trimmed) {
        setStatusMessage({ type: 'error', message: 'No content found to parse.' });
        return;
      }

      // Check if text is JSON format
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const jsonArray = JSON.parse(trimmed);
          if (Array.isArray(jsonArray)) {
            const enriched = enrichParsedItems(jsonArray);
            setItems(enriched);
            setStatusMessage({ type: 'info', message: `Parsed ${enriched.length} items from JSON data.` });
            return;
          }
        } catch (jsonErr) {
          // fallback to line parser
        }
      }

      const lines = trimmed.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length === 0) {
        setStatusMessage({ type: 'error', message: 'Empty lines or data received.' });
        return;
      }

      // Detect delimiter from first line (comma, tab, or semicolon)
      const firstLine = lines[0];
      const commaCount = (firstLine.match(/,/g) || []).length;
      const tabCount = (firstLine.match(/\t/g) || []).length;
      const semicolonCount = (firstLine.match(/;/g) || []).length;

      let delimiter = ',';
      if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\t';
      else if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';';

      // Split line respecting quotes
      const splitRow = (line: string): string[] => {
        if (delimiter === '\t') return line.split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const regex = delimiter === ',' 
          ? /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g
          : /(?:;|\n|^)("(?:(?:"")*[^"]*)*"|[^";\n]*|(?:\n|$))/g;
        
        const row: string[] = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
          let val = match[1] || '';
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1).replace(/""/g, '"');
          }
          row.push(val.trim());
          if (regex.lastIndex >= line.length) break;
        }
        return row;
      };

      const rawHeaders = splitRow(lines[0]);
      const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

      // Check if first line is a header
      const hasHeaderKeywords = normalizedHeaders.some(h => 
        h.includes('sku') || h.includes('name') || h.includes('price') || h.includes('cost') || h.includes('category') || h.includes('stock')
      );

      const startIndex = hasHeaderKeywords ? 1 : 0;
      const parsedRows: any[] = [];

      for (let i = startIndex; i < lines.length; i++) {
        const row = splitRow(lines[i]);
        if (row.length === 0 || row.every(c => !c)) continue;

        const obj: any = {};

        if (hasHeaderKeywords) {
          normalizedHeaders.forEach((h, colIdx) => {
            const val = row[colIdx] || '';
            if (h.includes('sku') || h.includes('itemcode') || h.includes('code')) obj.sku = val;
            else if (h.includes('name') || h.includes('title') || h.includes('item') || h.includes('desc')) obj.name = val;
            else if (h.includes('cat') || h.includes('dept')) obj.category = val;
            else if (h.includes('cost') || h.includes('buy') || h.includes('purchase')) obj.cost_price = val;
            else if (h.includes('sell') || h.includes('price') || h.includes('retail')) obj.selling_price = val;
            else if (h.includes('stock') || h.includes('qty') || h.includes('quantity')) obj.stock_quantity = val;
            else if (h.includes('bar') || h.includes('upc') || h.includes('ean')) obj.barcode = val;
            else if (h.includes('brand') || h.includes('make')) obj.brand = val;
            else if (h.includes('unit') || h.includes('uom')) obj.unit_of_measure = val;
            else if (h.includes('min') || h.includes('reorder') || h.includes('alert')) obj.min_stock_level = val;
          });
        } else {
          // Positional fallback: SKU, Name, Category, Cost, Price, Stock, Barcode
          obj.sku = row[0] || '';
          obj.name = row[1] || '';
          obj.category = row[2] || defaultCategory;
          obj.cost_price = row[3] || '0';
          obj.selling_price = row[4] || '0';
          obj.stock_quantity = row[5] || '0';
          obj.barcode = row[6] || '';
        }

        if (obj.name || obj.sku || obj.barcode) {
          parsedRows.push(obj);
        }
      }

      if (parsedRows.length === 0) {
        setStatusMessage({ type: 'error', message: 'No valid product rows could be recognized from the text.' });
        return;
      }

      const enriched = enrichParsedItems(parsedRows);
      setItems(enriched);
      setStatusMessage({ 
        type: 'info', 
        message: `Successfully parsed ${enriched.length} structured rows (${enriched.filter(i => i.isExisting).length} existing catalog matches, ${enriched.filter(i => !i.isExisting).length} new items).` 
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', message: `Parse error: ${err.message}` });
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseDelimitedText(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const loadPreset = (presetKey: string) => {
    const preset = PRESET_TEMPLATES[presetKey];
    if (!preset) return;
    const enriched = enrichParsedItems(preset.items);
    setItems(enriched);
    setStatusMessage({
      type: 'info',
      message: `Loaded ${preset.title} preset template (${preset.count} items). Review and adjust quantities or prices before importing.`
    });
  };

  const downloadSampleTemplate = () => {
    const headers = ['SKU', 'Name', 'Category', 'Cost Price (GH₵)', 'Selling Price (GH₵)', 'Stock Quantity', 'Barcode', 'Brand', 'Unit of Measure', 'Min Stock Level'];
    const sampleRows = [
      ['MLK-160', 'Ideal Evaporated Milk 160g', 'Groceries', '5.50', '7.20', '100', '60010010001', 'Nestle', 'tin', '20'],
      ['RIC-5KG', 'Gino Jasmine Rice 5kg', 'Grains & Pasta', '78.00', '95.00', '35', '60010010002', 'Gino', 'bag', '5'],
      ['WAT-750', 'Bel-Aqua Mineral Water 750ml', 'Beverages', '1.80', '3.00', '150', '60010010003', 'Bel-Aqua', 'bottle', '30'],
      ['SOP-200', 'Geisha Soap Aloe Vera 200g', 'Personal Care', '6.50', '9.00', '80', '60010010004', 'Geisha', 'bar', '15']
    ];
    const csvContent = [headers.join(','), ...sampleRows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `product_catalog_import_template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectAll = () => {
    const allSelected = items.every(i => i.selected || i.errors.length > 0);
    setItems(items.map(i => ({
      ...i,
      selected: i.errors.length === 0 ? !allSelected : false
    })));
  };

  const toggleSelectItem = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItemField = (id: string, field: keyof ParsedItem, value: any) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      
      // Re-validate
      const errors: string[] = [];
      if (!updated.name.trim()) errors.push('Product Name is required');
      if (updated.cost_price < 0) errors.push('Cost price cannot be negative');
      if (updated.selling_price < 0) errors.push('Selling price cannot be negative');
      if (updated.stock_quantity < 0) errors.push('Stock cannot be negative');

      updated.errors = errors;
      if (errors.length > 0) updated.selected = false;
      return updated;
    }));
  };

  const handleExecuteImport = async () => {
    const selectedItems = items.filter(i => i.selected && i.errors.length === 0);
    if (selectedItems.length === 0) {
      setStatusMessage({ type: 'error', message: 'No valid products selected for catalog import.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const payload = selectedItems.map(item => ({
        name: item.name,
        sku: item.sku,
        category: item.category || defaultCategory,
        cost_price: Number(item.cost_price) || 0,
        selling_price: Number(item.selling_price) || 0,
        stock_quantity: Number(item.stock_quantity) || 0,
        barcode: item.barcode || null,
        brand: item.brand || null,
        unit_of_measure: item.unit_of_measure || 'pcs',
        min_stock_level: Number(item.min_stock_level) || 10
      }));

      const res = await fetchApi('/products/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ products: payload })
      });

      setStatusMessage({
        type: 'success',
        message: `Catalog Updated Successfully: ${res.importedCount || 0} new products added, ${res.updatedCount || 0} existing products updated!`
      });

      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      setStatusMessage({ type: 'error', message: `Import Failed: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = items.filter(i => i.errors.length === 0).length;
  const selectedCount = items.filter(i => i.selected && i.errors.length === 0).length;
  const newItemsCount = items.filter(i => !i.isExisting && i.errors.length === 0).length;
  const existingItemsCount = items.filter(i => i.isExisting && i.errors.length === 0).length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[90] overflow-y-auto">
      <div className="bg-white rounded-lg max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Table size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Import Product Catalog (Structured List)
                </h2>
                <span className="px-2 py-0.5 bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[10px] font-bold rounded uppercase">
                  Admin Tool
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Upload CSV/TSV, paste tabular spreadsheet data, or use starter templates to rapidly populate the catalog.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadSampleTemplate}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition"
              title="Download sample CSV template"
            >
              <Download size={13} />
              <span>Template CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-5 bg-slate-50 border-b border-slate-200 shrink-0 text-xs font-bold">
          <div className="flex space-x-1 sm:space-x-4">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'border-blue-600 text-blue-600 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Upload size={14} />
              <span>File Upload (CSV / TSV / JSON)</span>
            </button>

            <button
              onClick={() => setActiveTab('paste')}
              className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'paste'
                  ? 'border-blue-600 text-blue-600 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>Paste Structured List</span>
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'templates'
                  ? 'border-blue-600 text-blue-600 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers size={14} className="text-blue-600" />
              <span>Starter Presets</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <span>Catalog Items: <strong className="text-slate-800">{existingProducts.length}</strong></span>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* TAB 1: File Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
                  <Upload size={22} />
                </div>
                <div className="font-bold text-slate-900 text-sm">
                  {fileName ? `Selected: ${fileName}` : 'Click to Browse or Drag & Drop Product List File'}
                </div>
                <p className="text-xs text-slate-500 max-w-md">
                  Supports <strong className="text-slate-700">.csv</strong>, <strong className="text-slate-700">.tsv</strong>, or <strong className="text-slate-700">.json</strong> with columns: SKU, Name, Category, Cost Price, Selling Price, Stock Quantity, Barcode, Brand.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.tsv,.txt,.json"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Paste Structured List */}
          {activeTab === 'paste' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-700">
                  Paste rows directly from Excel, Google Sheets, CSV, or Tab-Delimited text:
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  Header order: SKU | Name | Category | Cost | Price | Stock | Barcode
                </span>
              </div>

              <textarea
                rows={5}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={`SKU\tName\tCategory\tCost\tPrice\tStock\tBarcode\nMLK-160\tIdeal Milk 160g\tGroceries\t5.50\t7.20\t100\t60010010001\nRIC-5KG\tGino Rice 5kg\tGrains\t78.00\t95.00\t35\t60010010002`}
                className="w-full border border-slate-300 rounded-lg p-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPastedText('')}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium"
                >
                  Clear Box
                </button>
                <button
                  type="button"
                  onClick={() => parseDelimitedText(pastedText)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <FileSpreadsheet size={13} />
                  <span>Parse & Preview Structured Rows</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Starter Presets */}
          {activeTab === 'templates' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Instantly populate your store catalog with industry-standard product packs configured with realistic Ghanaian wholesale and retail prices:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(PRESET_TEMPLATES).map(([key, template]) => (
                  <div 
                    key={key}
                    className="p-4 rounded-lg border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded uppercase">
                          {template.count} Items
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs mb-1">{template.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-normal">{template.desc}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => loadPreset(key)}
                      className="w-full py-1.5 px-3 bg-slate-900 hover:bg-blue-600 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Plus size={12} className="text-white" />
                      <span>Load into Queue</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Message Banner */}
          {statusMessage && (
            <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
              statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
              statusMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {statusMessage.type === 'success' && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
              {statusMessage.type === 'error' && <AlertCircle size={16} className="text-rose-600 shrink-0" />}
              {statusMessage.type === 'info' && <Layers size={16} className="text-blue-600 shrink-0" />}
              <span>{statusMessage.message}</span>
            </div>
          )}

          {/* Structured Data Preview Table & Validation Grid */}
          {items.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-100/80 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900">
                    Import Queue ({items.length} Total Items):
                  </span>
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-bold">
                    {newItemsCount} New
                  </span>
                  <span className="text-[11px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-bold">
                    {existingItemsCount} Updates
                  </span>
                  {items.some(i => i.errors.length > 0) && (
                    <span className="text-[11px] bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded font-bold">
                      {items.filter(i => i.errors.length > 0).length} Errors
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-[11px] font-bold text-slate-700 hover:text-blue-600 transition"
                  >
                    {items.every(i => i.selected) ? 'Deselect All' : 'Select All Valid'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setItems([])}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 transition"
                  >
                    Clear Queue
                  </button>
                </div>
              </div>

              {/* Editable Grid */}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto bg-white shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-[10px] uppercase text-slate-600 font-black sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-2.5 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={items.length > 0 && items.every(i => i.selected || i.errors.length > 0)}
                          onChange={toggleSelectAll}
                          className="rounded text-blue-600"
                        />
                      </th>
                      <th className="p-2.5">SKU / Code</th>
                      <th className="p-2.5">Product Name</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5 text-right">Cost (GH₵)</th>
                      <th className="p-2.5 text-right">Price (GH₵)</th>
                      <th className="p-2.5 text-right">Stock</th>
                      <th className="p-2.5">Barcode</th>
                      <th className="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const hasError = item.errors.length > 0;
                      return (
                        <tr 
                          key={item.id} 
                          className={`transition-colors ${
                            hasError ? 'bg-rose-50/50' : item.isExisting ? 'bg-amber-50/30' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              disabled={hasError}
                              checked={item.selected}
                              onChange={() => toggleSelectItem(item.id!)}
                              className="rounded text-blue-600"
                            />
                          </td>

                          {/* SKU */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.sku}
                              onChange={(e) => updateItemField(item.id!, 'sku', e.target.value)}
                              className="w-24 font-mono text-[11px] p-1 border border-slate-200 rounded font-semibold text-slate-800 bg-white"
                            />
                            {item.isExisting && (
                              <span className="block text-[9px] text-amber-700 font-bold">Existing Item</span>
                            )}
                          </td>

                          {/* Name */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateItemField(item.id!, 'name', e.target.value)}
                              className="w-full min-w-[160px] p-1 border border-slate-200 rounded font-bold text-slate-900 bg-white"
                            />
                            {hasError && (
                              <span className="block text-[9px] text-rose-600 font-bold">{item.errors.join(', ')}</span>
                            )}
                          </td>

                          {/* Category */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.category}
                              onChange={(e) => updateItemField(item.id!, 'category', e.target.value)}
                              className="w-24 p-1 border border-slate-200 rounded text-slate-700 bg-white text-[11px]"
                            />
                          </td>

                          {/* Cost */}
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={item.cost_price}
                              onChange={(e) => updateItemField(item.id!, 'cost_price', parseFloat(e.target.value) || 0)}
                              className="w-16 p-1 border border-slate-200 rounded text-right font-mono text-slate-700 bg-white"
                            />
                          </td>

                          {/* Selling Price */}
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={item.selling_price}
                              onChange={(e) => updateItemField(item.id!, 'selling_price', parseFloat(e.target.value) || 0)}
                              className="w-16 p-1 border border-slate-200 rounded text-right font-mono font-bold text-slate-900 bg-white"
                            />
                          </td>

                          {/* Stock Qty */}
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              value={item.stock_quantity}
                              onChange={(e) => updateItemField(item.id!, 'stock_quantity', parseInt(e.target.value, 10) || 0)}
                              className="w-16 p-1 border border-slate-200 rounded text-right font-mono font-bold text-blue-700 bg-white"
                            />
                          </td>

                          {/* Barcode */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.barcode}
                              onChange={(e) => updateItemField(item.id!, 'barcode', e.target.value)}
                              className="w-24 font-mono text-[10px] p-1 border border-slate-200 rounded text-slate-600 bg-white"
                            />
                          </td>

                          {/* Delete */}
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id!)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                              title="Remove item from queue"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600">
            {selectedCount > 0 ? (
              <span>Ready to import <strong className="text-slate-900 font-black">{selectedCount}</strong> valid products into store catalog.</span>
            ) : (
              <span>Upload, paste, or select a template to populate products.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || selectedCount === 0}
              onClick={handleExecuteImport}
              className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Importing Catalog...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Import {selectedCount} Products</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
