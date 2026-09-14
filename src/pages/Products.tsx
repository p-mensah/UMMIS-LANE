import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit, Trash2, Search, FileText, Upload, X, Scan, Download, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, FileSpreadsheet, MoreVertical, SlidersHorizontal, Table, Filter, Tag, Package, PackageSearch } from 'lucide-react';
import { formatGHS } from '../lib/formatters';
import ProductImportModal from '../components/ProductImportModal';
import BulkCsvProductModal from '../components/BulkCsvProductModal';

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  barcode: string;
  brand: string;
  unit_of_measure: string;
  image_url?: string;
  min_stock_level?: number;
}

export default function Products() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'name' | 'sku'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<number | null>(null);

  // Sync category from URL parameter whenever it changes
  useEffect(() => {
    const cat = searchParams.get('category') || '';
    setSelectedCategory(cat);
  }, [searchParams]);

  const handleCategoryChange = (categoryName: string) => {
    setSelectedCategory(categoryName);
    const nextParams = new URLSearchParams(searchParams);
    if (categoryName && categoryName !== 'ALL') {
      nextParams.set('category', categoryName);
    } else {
      nextParams.delete('category');
    }
    setSearchParams(nextParams);
  };
  
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustData, setAdjustData] = useState({ quantity_change: 0, reason: '' });

  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkCsvModal, setShowBulkCsvModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<'update' | 'import'>('update');
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedImportProducts, setParsedImportProducts] = useState<any[]>([]);
  const [bulkStatus, setBulkStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '', sku: '', category: '', cost_price: 0, selling_price: 0, stock_quantity: 0, barcode: '', brand: '', unit_of_measure: '', image_url: '', min_stock_level: 10
  });

  useEffect(() => {
    loadProducts();
    const handleClickOutside = () => setActiveActionMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const loadProducts = () => {
    Promise.all([
      fetchApi('/products'),
      fetchApi('/categories')
    ])
      .then(([prods, cats]) => {
          setProducts(prods);
          setCategories(cats);
      })
      .finally(() => setLoading(false));
  };

  const exportCatalogToCSV = () => {
    const headers = ['SKU', 'Barcode', 'Name', 'Category', 'Brand', 'Unit of Measure', 'Cost Price', 'Selling Price', 'Stock Quantity', 'Min Stock Level'];
    const rows = products.map(p => [
      p.sku || '',
      p.barcode || '',
      p.name || '',
      p.category || '',
      p.brand || '',
      p.unit_of_measure || 'pcs',
      (p.cost_price || 0).toFixed(2),
      (p.selling_price || 0).toFixed(2),
      (p.stock_quantity || 0).toString(),
      (p.min_stock_level ?? 10).toString()
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `store_catalog_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadUpdateTemplate = () => {
    const headers = ['SKU', 'Barcode', 'Name', 'Cost Price', 'Selling Price', 'Stock Quantity'];
    const sampleRows = [
      ['MLK-160', '6001001', 'Ideal Milk 160g', '5.50', '7.20', '65'],
      ['MLO-400', '6001002', 'Milo Beverage 400g', '22.00', '29.00', '50'],
      ['WAT-750', '6001007', 'Bel-Aqua Water 750ml', '1.60', '2.50', '120']
    ];
    const csvContent = [headers.join(','), ...sampleRows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'bulk_products_update_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSVLines = (text: string) => {
    const lines = text.split(/\r\n|\n/);
    const rows: string[][] = [];
    for (let line of lines) {
      if (!line.trim()) continue;
      const row: string[] = [];
      let insideQuote = false;
      let entry = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          row.push(entry.trim());
          entry = '';
        } else {
          entry += char;
        }
      }
      row.push(entry.trim());
      rows.push(row);
    }
    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setBulkFile(file);
    setBulkStatus(null);
    setParsedImportProducts([]);

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = parseCSVLines(text);
      if (rows.length < 2) {
        setBulkStatus({ type: 'error', message: 'CSV file appears empty or missing data rows.' });
        return;
      }

      const rawHeaders = rows[0];
      const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

      const parsed: any[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || !row.some(cell => cell.trim())) continue;

        let item: any = {};
        headers.forEach((h, idx) => {
          const val = row[idx] ? row[idx].trim() : '';
          if (!val) return;

          if (h.includes('sku') || h.includes('itemcode')) item.sku = val;
          else if (h.includes('barcode') || h.includes('upc') || h.includes('ean')) item.barcode = val;
          else if (h.includes('name') || h.includes('title') || h.includes('product')) item.name = val;
          else if (h.includes('cost')) item.cost_price = parseFloat(val);
          else if (h.includes('sell') || h.includes('price')) item.selling_price = parseFloat(val);
          else if (h.includes('change') || h.includes('adjust')) item.stock_change = parseInt(val, 10);
          else if (h.includes('stock') || h.includes('qty') || h.includes('quantity')) item.stock_quantity = parseInt(val, 10);
          else if (h.includes('cat')) item.category = val;
          else if (h.includes('brand')) item.brand = val;
          else if (h.includes('unit') || h.includes('uom')) item.unit_of_measure = val;
          else if (h.includes('min')) item.min_stock_level = parseInt(val, 10);
        });

        // Positional fallbacks
        if (!item.sku && !item.barcode && row[0]) {
          if (row[0].startsWith('SKU-') || row[0].match(/^[A-Z0-9-]{3,15}$/i)) {
            item.sku = row[0];
          }
        }

        // Try matching with existing product in store catalog
        let matched: Product | undefined = undefined;
        if (item.sku) {
          matched = products.find(p => p.sku.toLowerCase() === item.sku.toLowerCase());
        }
        if (!matched && item.barcode) {
          matched = products.find(p => p.barcode && p.barcode.toLowerCase() === item.barcode.toLowerCase());
        }
        if (!matched && item.name) {
          matched = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
        }

        item.matchedProduct = matched;
        if (matched) {
          item.id = matched.id;
          if (!item.sku) item.sku = matched.sku;
          if (!item.name) item.name = matched.name;
          
          item.costDiff = item.cost_price !== undefined && !isNaN(item.cost_price) ? item.cost_price - matched.cost_price : 0;
          item.priceDiff = item.selling_price !== undefined && !isNaN(item.selling_price) ? item.selling_price - matched.selling_price : 0;
          item.stockDiff = item.stock_quantity !== undefined && !isNaN(item.stock_quantity) 
            ? item.stock_quantity - matched.stock_quantity 
            : (item.stock_change || 0);
        }

        if (item.sku || item.barcode || item.name || item.id) {
          parsed.push(item);
        }
      }

      if (parsed.length === 0) {
        setBulkStatus({ type: 'error', message: 'Could not parse any valid product rows from CSV. Please verify file headers.' });
      } else {
        setParsedImportProducts(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile || parsedImportProducts.length === 0) return;

    try {
      if (bulkMode === 'update') {
        const res = await fetchApi('/products/bulk-update', {
          method: 'POST',
          body: JSON.stringify({ updates: parsedImportProducts })
        });

        setBulkStatus({
          type: 'success',
          message: `Success! ${res.updatedCount || 0} products updated (${res.priceChangeCount || 0} price changes, ${res.stockAdjustmentCount || 0} stock adjustments recorded).`
        });
      } else {
        const res = await fetchApi('/products/bulk-import', {
          method: 'POST',
          body: JSON.stringify({ products: parsedImportProducts })
        });

        setBulkStatus({
          type: 'success',
          message: `Success! ${res.importedCount || 0} new products created, ${res.updatedCount || 0} existing products updated.`
        });
      }

      loadProducts();
      setTimeout(() => {
        setShowBulkModal(false);
        setBulkStatus(null);
        setBulkFile(null);
        setParsedImportProducts([]);
      }, 2500);
    } catch (err: any) {
      setBulkStatus({ type: 'error', message: err.message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await fetchApi(`/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await fetchApi('/products', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      setShowModal(false);
      loadProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name, sku: p.sku, category: p.category, 
      cost_price: p.cost_price, selling_price: p.selling_price, stock_quantity: p.stock_quantity, barcode: p.barcode || '',
      brand: p.brand || '', unit_of_measure: p.unit_of_measure || '', image_url: p.image_url || '', min_stock_level: p.min_stock_level ?? 10
    });
    setShowModal(true);
  };

  const confirmDelete = async () => {
    if (deletingProductId) {
      try {
        await fetchApi(`/products/${deletingProductId}`, { method: 'DELETE' });
        setDeletingProductId(null);
        loadProducts();
      } catch (err: any) {
        alert(err.message);
        setDeletingProductId(null);
      }
    }
  };

  const openNew = () => {
    setEditingProduct(null);
    setFormData({ name: '', sku: '', category: '', cost_price: 0, selling_price: 0, stock_quantity: 0, barcode: '', brand: '', unit_of_measure: '' });
    setShowModal(true);
  };

  const openAdjust = (p: Product) => {
    setAdjustingProduct(p);
    setAdjustData({ quantity_change: 0, reason: '' });
    setShowAdjustModal(true);
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    if (!adjustData.reason || adjustData.reason.trim().length < 3) {
      alert("Reason must be at least 3 characters long.");
      return;
    }
    
    try {
      await fetchApi('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          product_id: adjustingProduct.id,
          quantity_change: adjustData.quantity_change,
          reason: adjustData.reason
        })
      });
      setShowAdjustModal(false);
      loadProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').filter(r => r.trim() !== '');
      const updates = [];
      
      // header: SKU,QuantityChange
      for (let i = 1; i < rows.length; i++) {
        const [sku, qty] = rows[i].split(',').map(s => s.trim());
        const product = products.find(p => p.sku === sku);
        if (product && !isNaN(parseInt(qty))) {
          updates.push({ id: product.id, quantity_change: parseInt(qty) });
        }
      }
      
      if (updates.length === 0) {
        setBulkStatus({ type: 'error', message: 'No valid products found in CSV. Check SKUs.' });
        return;
      }

      try {
        await fetchApi('/products/bulk-stock-update', {
          method: 'POST',
          body: JSON.stringify({ updates, reason: 'Bulk CSV Upload' })
        });
        setBulkStatus({ type: 'success', message: `Successfully updated ${updates.length} products.` });
        loadProducts();
        setTimeout(() => {
          setShowBulkModal(false);
          setBulkStatus(null);
          setBulkFile(null);
        }, 2000);
      } catch (err: any) {
        setBulkStatus({ type: 'error', message: err.message });
      }
    };
    reader.readAsText(bulkFile);
  };

  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stock_quantity <= (p.min_stock_level ?? 10)).length;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const cleanQ = q.replace(/[^a-z0-9]/gi, '');

    return products.filter(p => {
      // 1. Category filter
      const matchesCategory = !selectedCategory || selectedCategory === 'ALL' ||
        (p.category && p.category.trim().toLowerCase() === selectedCategory.trim().toLowerCase());

      if (!matchesCategory) return false;

      // 2. Real-time Search filter (by name or SKU)
      if (!q) return true;

      const nameLower = (p.name || '').toLowerCase();
      const skuLower = (p.sku || '').toLowerCase();
      const skuClean = skuLower.replace(/[^a-z0-9]/gi, '');
      const barcodeLower = (p.barcode || '').toLowerCase();

      if (searchScope === 'name') {
        const words = q.split(/\s+/).filter(Boolean);
        return words.every(w => nameLower.includes(w));
      }

      if (searchScope === 'sku') {
        return skuLower.includes(q) || (cleanQ.length > 0 && skuClean.includes(cleanQ));
      }

      // 'all': matches either Product Name OR SKU (also checks barcode)
      const words = q.split(/\s+/).filter(Boolean);
      const wordsMatchName = words.every(w => nameLower.includes(w));
      const matchesSku = skuLower.includes(q) || (cleanQ.length > 0 && skuClean.includes(cleanQ));
      const matchesBarcode = barcodeLower.includes(q);

      return wordsMatchName || matchesSku || matchesBarcode;
    });
  }, [products, searchQuery, searchScope, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* SOLID BLUE PAGE HEADER (No gradient) */}
      <div id="products-page-header" className="bg-blue-600 text-white rounded-lg p-5 shadow-sm border border-blue-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-blue-700/80 border border-blue-500/50 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Package size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Products Catalog
                </h1>
                <span className="px-2 py-0.5 bg-blue-700/90 text-blue-100 rounded text-[11px] font-bold border border-blue-500/40">
                  {products.length} Products
                </span>
                {lowStockCount > 0 && (
                  <span className="px-2 py-0.5 bg-amber-500 text-slate-900 rounded text-[11px] font-black shadow-2xs">
                    {lowStockCount} Low/Out of Stock
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                Manage inventory stock levels, barcode tracking, retail pricing, and supplier reorder points
              </p>
            </div>
          </div>

          {/* Action buttons with clean contrast against the blue background */}
          {user?.role === 'admin' && (
            <div className="flex items-center flex-wrap gap-2">
              <button 
                type="button"
                onClick={openNew} 
                className="flex items-center justify-center px-3.5 py-2 bg-white text-blue-900 hover:bg-blue-50 rounded font-black text-xs uppercase tracking-wider transition shadow-sm cursor-pointer active:scale-95"
              >
                <Plus size={15} className="mr-1 text-blue-700" /> Add Product
              </button>
              <button 
                type="button"
                onClick={() => setShowBulkCsvModal(true)}
                className="flex items-center justify-center px-3 py-2 bg-blue-700/90 hover:bg-blue-700 text-white border border-blue-500/50 rounded font-bold text-xs uppercase tracking-wider transition shadow-2xs cursor-pointer"
                title="Add multiple products at once via simple CSV-like text input area"
              >
                <FileSpreadsheet size={14} className="mr-1.5 text-blue-200" /> Bulk Add (CSV)
              </button>
              <button 
                type="button"
                onClick={() => {
                  setShowBulkModal(true);
                  setBulkMode('update');
                  setBulkFile(null);
                  setParsedImportProducts([]);
                  setBulkStatus(null);
                }}
                className="flex items-center justify-center px-3 py-2 bg-blue-700/90 hover:bg-blue-700 text-white border border-blue-500/50 rounded font-bold text-xs uppercase tracking-wider transition shadow-2xs cursor-pointer"
              >
                <Upload size={14} className="mr-1.5 text-blue-200" /> Bulk Update
              </button>
              <button 
                type="button"
                onClick={() => setShowImportModal(true)}
                className="flex items-center justify-center px-3 py-2 bg-blue-700/90 hover:bg-blue-700 text-white border border-blue-500/50 rounded font-bold text-xs uppercase tracking-wider transition shadow-2xs cursor-pointer"
              >
                <Table size={14} className="mr-1.5 text-blue-200" /> Import
              </button>
              <button 
                type="button"
                onClick={exportCatalogToCSV}
                className="flex items-center justify-center px-3 py-2 bg-blue-700/90 hover:bg-blue-700 text-white border border-blue-500/50 rounded font-bold text-xs uppercase tracking-wider transition shadow-2xs cursor-pointer"
              >
                <Download size={14} className="mr-1.5 text-blue-200" /> Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ROBUST REAL-TIME SEARCH & FILTER TOOLBAR */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Real-time search field */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600 transition-colors" size={18} />
            <input
              type="text"
              id="products-search-input"
              placeholder="Search products in real-time by Name or SKU (e.g. 'Ideal Milk', 'MLK-160')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-2 border-slate-200 focus:border-blue-600 rounded-lg pl-11 pr-24 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50 transition-all"
            />
            {/* Quick clear & live match counter pill */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-1.5 py-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Clear search"
                >
                  <X size={14} />
                  <span className="text-[11px]">Clear</span>
                </button>
              )}
              <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'match' : 'matches'}
              </span>
            </div>
          </div>

          {/* Search scope toggles: All vs Product Name vs SKU */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold shrink-0">
            <span className="text-[11px] text-slate-500 px-1.5 font-semibold hidden sm:inline">Filter by:</span>
            <button
              type="button"
              onClick={() => setSearchScope('all')}
              className={`px-2.5 py-1 rounded transition cursor-pointer text-xs font-black ${
                searchScope === 'all' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSearchScope('name')}
              className={`px-2.5 py-1 rounded transition cursor-pointer text-xs font-black ${
                searchScope === 'name' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Product Name
            </button>
            <button
              type="button"
              onClick={() => setSearchScope('sku')}
              className={`px-2.5 py-1 rounded transition cursor-pointer text-xs font-black ${
                searchScope === 'sku' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SKU
            </button>
          </div>

          {/* Category Filter Selector */}
          <div className="relative shrink-0 min-w-[190px]">
            <select
              value={selectedCategory || 'ALL'}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-lg pl-8 pr-8 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:border-blue-600 cursor-pointer transition-colors"
            >
              <option value="ALL">All Categories ({products.length})</option>
              {categories.map((c) => {
                const count = products.filter(p => p.category && p.category.trim().toLowerCase() === c.name.trim().toLowerCase()).length;
                return (
                  <option key={c.id} value={c.name}>
                    {c.name} ({count})
                  </option>
                );
              })}
            </select>
            <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Real-time search status indicator if active */}
        {(searchQuery || (selectedCategory && selectedCategory !== 'ALL')) && (
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-700">Active Filter:</span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                  <span>{searchScope === 'name' ? 'Name:' : searchScope === 'sku' ? 'SKU:' : 'Keyword:'}</span>
                  <span className="text-slate-900 font-mono font-black">"{searchQuery}"</span>
                  <button type="button" onClick={() => setSearchQuery('')} className="hover:text-red-600 ml-0.5 cursor-pointer">
                    <X size={12} />
                  </button>
                </span>
              )}
              {selectedCategory && selectedCategory !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                  <span>Category: {selectedCategory}</span>
                  <button type="button" onClick={() => handleCategoryChange('ALL')} className="hover:text-red-600 ml-0.5 cursor-pointer">
                    <X size={12} />
                  </button>
                </span>
              )}
              <span className="text-slate-500 font-medium">
                — Showing {filteredProducts.length} of {products.length} items
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                handleCategoryChange('ALL');
              }}
              className="text-[11px] font-bold text-slate-500 hover:text-red-600 underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto min-h-[300px]">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Image</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Product Name</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Brand</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">SKU</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">UOM</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Barcode</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Price (Sell)</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stock</th>
              <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center max-w-md mx-auto text-slate-500 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                      <PackageSearch size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">
                        {searchQuery ? `No products matching "${searchQuery}"` : 'No products found'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {searchQuery 
                          ? `We couldn't find any products with ${searchScope === 'sku' ? 'SKU' : searchScope === 'name' ? 'name' : 'name or SKU'} matching your search.`
                          : 'No items currently in catalog. Use "+ Add Product" or "Bulk Add (CSV)" to add products.'}
                      </p>
                    </div>
                    {(searchQuery || (selectedCategory && selectedCategory !== 'ALL')) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          handleCategoryChange('ALL');
                        }}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        Clear Search & Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredProducts.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 whitespace-nowrap text-[13px]">
                   {p.image_url ? (
                     <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-sm border border-slate-200" />
                   ) : (
                     <div className="w-10 h-10 bg-slate-100 rounded-sm flex items-center justify-center text-slate-400 font-bold uppercase text-[10px]">{p.name.substring(0,2)}</div>
                   )}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] font-medium text-slate-900 leading-none">
                  <Link to={`/products/${p.id}`} className="hover:text-blue-500 font-bold decoration-blue-500/20 underline decoration-2 underline-offset-2">
                    {p.name}
                  </Link>
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{p.brand || '-'}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500 font-mono bg-slate-50">{p.sku}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{p.unit_of_measure || '-'}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500 font-mono bg-slate-50">{p.barcode || '-'}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">
                  {p.category}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-900 font-semibold">{formatGHS(p.selling_price)}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px]">
                  <span className={`font-bold ${p.stock_quantity <= 10 ? 'text-red-600' : 'text-green-600'}`}>
                    {p.stock_quantity}
                  </span>
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-right text-[13px] font-medium">
                  {user?.role === 'admin' ? (
                    <div className="relative inline-block text-left">
                      <button 
                        id={`product-action-btn-${p.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveActionMenuId(activeActionMenuId === p.id ? null : p.id);
                        }} 
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors focus:outline-none"
                        title="Actions"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {activeActionMenuId === p.id && (
                        <div 
                          className="absolute right-0 mt-1 w-32 bg-white rounded border border-slate-200 shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-left"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button 
                            id={`action-adjust-${p.id}`}
                            onClick={() => {
                              setActiveActionMenuId(null);
                              openAdjust(p);
                            }} 
                            className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 transition-colors"
                          >
                            <SlidersHorizontal size={14} className="text-amber-500" />
                            <span>Adjust</span>
                          </button>
                          <button 
                            id={`action-edit-${p.id}`}
                            onClick={() => {
                              setActiveActionMenuId(null);
                              handleEdit(p);
                            }} 
                            className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors"
                          >
                            <Edit size={14} className="text-blue-500" />
                            <span>Edit</span>
                          </button>
                          <div className="border-t border-slate-100 my-0.5" />
                          <button 
                            id={`action-delete-${p.id}`}
                            onClick={() => {
                              setActiveActionMenuId(null);
                              setDeletingProductId(p.id);
                            }} 
                            className="w-full px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                          >
                            <Trash2 size={14} className="text-rose-500" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      to={`/products/${p.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs font-bold hover:underline"
                    >
                      View
                    </Link>
                  )}
                </td>
              </tr>
            ))
          )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm max-w-md w-full p-6 border border-slate-200">
            <h2 className="text-[14px] font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">{editingProduct ? 'Edit Product' : 'New Product'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">Name</label>
                <input required type="text" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">SKU</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">Brand</label>
                  <input type="text" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">Unit of Measure</label>
                  <input type="text" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.unit_of_measure} onChange={e => setFormData({...formData, unit_of_measure: e.target.value})} placeholder="e.g. pcs, kg" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">Image URL (Optional)</label>
                  <input type="url" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">Barcode (Alphanumeric)</label>
                  <input type="text" pattern="[a-zA-Z0-9]*" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">Category</label>
                  <select required className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                     <option value="">Select Category</option>
                     {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">Cost Price (GH₵)</label>
                  <input required type="number" step="0.01" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">Selling Price (GH₵)</label>
                  <input required type="number" step="0.01" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.selling_price} onChange={e => setFormData({...formData, selling_price: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">Low Stock Threshold</label>
                  <input type="number" min="0" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.min_stock_level} onChange={e => setFormData({...formData, min_stock_level: parseInt(e.target.value, 10) || 0})} placeholder="Default: 10" />
                </div>
              </div>
              {!editingProduct && (
                 <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">Initial Stock</label>
                    <input required type="number" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: parseInt(e.target.value, 10)})} />
                 </div>
              )}
              <div className="pt-5 flex justify-end space-x-3 border-t border-slate-200 mt-5">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-sm hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-blue-500 border-none rounded-sm hover:bg-blue-600">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdjustModal && adjustingProduct && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm max-w-sm w-full p-6 border border-slate-200">
            <h2 className="text-[14px] font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">Adjust Stock: {adjustingProduct.name}</h2>
            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">Quantity Change</label>
                <input required type="number" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={adjustData.quantity_change} onChange={e => setAdjustData({...adjustData, quantity_change: parseInt(e.target.value, 10)})} placeholder="E.g., -5 or 10" />
                <p className="text-[10px] text-slate-400 mt-1">Use negative values to deduct stock.</p>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left mb-1">Reason for Adjustment</label>
                <select 
                  required 
                  className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 bg-white" 
                  value={adjustData.reason} 
                  onChange={e => setAdjustData({...adjustData, reason: e.target.value})}
                >
                  <option value="">-- Select a predefined reason --</option>
                  <option value="Damage">Damage / Expired</option>
                  <option value="Inventory Count Discrepancy">Inventory Count Discrepancy</option>
                  <option value="Received Incorrectly">Received Incorrectly (Error Correction)</option>
                  <option value="Return to Vendor">Return to Vendor</option>
                  <option value="Internal Use">Internal consumption / Sample</option>
                  <option value="Restock">Restock / New Shipment</option>
                  <option value="Other">Other (Manual Entry)</option>
                </select>
                {adjustData.reason === 'Other' && (
                  <input 
                    required
                    type="text"
                    placeholder="Describe the other reason..."
                    className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 mt-2"
                    onChange={e => setAdjustData({...adjustData, reason: `Other: ${e.target.value}`})}
                  />
                )}
              </div>
              <div className="pt-5 flex justify-end space-x-3 border-t border-slate-200 mt-5">
                <button type="button" onClick={() => setShowAdjustModal(false)} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-sm hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-blue-500 border-none rounded-sm hover:bg-blue-600">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingProductId && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm max-w-sm w-full p-6 border border-slate-200 text-center">
            <h2 className="text-[16px] font-bold text-slate-900 mb-2">Delete Product</h2>
            <p className="text-[13px] text-slate-500 mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
            <div className="flex justify-center space-x-3">
              <button onClick={() => setDeletingProductId(null)} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-sm hover:bg-slate-50">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-xs font-bold text-white bg-red-500 border-none rounded-sm hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-md max-w-3xl w-full p-6 sm:p-8 border border-slate-200 shadow-2xl my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded flex items-center justify-center font-bold">
                    <Upload size={20} />
                 </div>
                 <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Bulk CSV Product Update & Operations</h2>
                    <p className="text-[11px] text-slate-500 font-medium">Update stock levels, costs, and selling prices across multiple items at once</p>
                 </div>
               </div>
               <button 
                 onClick={() => {
                   setShowBulkModal(false);
                   setBulkFile(null);
                   setParsedImportProducts([]);
                   setBulkStatus(null);
                 }} 
                 className="text-slate-400 hover:text-slate-600 p-1 rounded"
               >
                 <X size={18} />
               </button>
            </div>
            
            {/* Operation Mode Tabs */}
            <div className="flex border-b border-slate-200 my-5 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setBulkMode('update');
                  setBulkStatus(null);
                  setParsedImportProducts([]);
                }}
                className={`pb-2.5 px-4 transition-colors border-b-2 ${
                  bulkMode === 'update'
                    ? 'border-blue-600 text-blue-600 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Bulk Update Stock, Cost & Price (Existing Products)
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkMode('import');
                  setBulkStatus(null);
                  setParsedImportProducts([]);
                }}
                className={`pb-2.5 px-4 transition-colors border-b-2 ${
                  bulkMode === 'import'
                    ? 'border-blue-600 text-blue-600 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Bulk Import & Upsert New Items
              </button>
            </div>

            <form onSubmit={handleBulkSubmit} className="space-y-5">
              {/* Instructions Box & Download Tools */}
              <div className="bg-slate-50 border border-slate-200 rounded p-4 text-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                   <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <FileSpreadsheet size={16} className="text-blue-600" />
                      <span>{bulkMode === 'update' ? 'Catalog CSV Mass Update Tool' : 'Product Import & Creation Tool'}</span>
                   </div>

                   <div className="flex items-center gap-2">
                     <button
                       type="button"
                       onClick={exportCatalogToCSV}
                       className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-bold text-[11px] transition flex items-center gap-1 shadow-xs"
                       title="Download full current catalog as CSV file to edit in Excel"
                     >
                       <Download size={13} className="text-slate-500" /> Export Store Catalog CSV
                     </button>
                     <button
                       type="button"
                       onClick={downloadUpdateTemplate}
                       className="px-2.5 py-1 bg-white hover:bg-slate-100 text-blue-600 border border-slate-300 rounded font-bold text-[11px] transition flex items-center gap-1 shadow-xs"
                     >
                       <FileText size={13} /> Download Template
                     </button>
                   </div>
                </div>

                {bulkMode === 'update' ? (
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Managers can edit <span className="font-bold text-slate-800">Stock Quantity, Cost Price, and Selling Price</span> for multiple items at once.
                    Tip: Export your current catalog to CSV, update prices or stock levels in Excel / Google Sheets, and re-upload here.
                  </p>
                ) : (
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Import new items or upsert existing products using CSV columns: <span className="font-bold text-slate-800">SKU, Name, Category, Cost Price, Selling Price, Stock Quantity, Barcode</span>.
                  </p>
                )}
              </div>

              {/* File Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Upload Modified CSV File</label>
                <input 
                  required
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition cursor-pointer border border-dashed border-slate-300 p-2 rounded bg-white"
                />
              </div>

              {/* Parsed Preview Table & Diff Audit */}
              {parsedImportProducts.length > 0 && (
                <div className="space-y-2 border border-slate-200 rounded overflow-hidden bg-white">
                  <div className="bg-slate-100 px-3.5 py-2.5 text-xs font-bold text-slate-700 flex justify-between items-center border-b border-slate-200">
                    <span className="flex items-center gap-2">
                      <FileText size={14} className="text-blue-600" />
                      Parsed CSV Audit ({parsedImportProducts.length} Items Found)
                    </span>
                    <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-bold">
                      {parsedImportProducts.filter(p => p.matchedProduct).length} Matched in Catalog
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Product / SKU</th>
                          <th className="p-2.5 text-right">Cost Price</th>
                          <th className="p-2.5 text-right">Selling Price</th>
                          <th className="p-2.5 text-right">Stock Level</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedImportProducts.slice(0, 10).map((p, idx) => {
                          const m = p.matchedProduct;
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5">
                                <div className="font-bold text-slate-900 truncate max-w-[180px]">{p.name || m?.name || 'Unnamed Item'}</div>
                                <div className="font-mono text-[10px] text-slate-500">{p.sku || m?.sku || p.barcode || 'NO SKU'}</div>
                              </td>
                              <td className="p-2.5 text-right font-medium text-slate-700">
                                {m ? (
                                  p.cost_price !== undefined ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="text-slate-400 line-through text-[10px]">{formatGHS(m.cost_price)}</span>
                                      <ArrowRight size={10} className="text-slate-400" />
                                      <span className="font-bold text-slate-900">{formatGHS(p.cost_price)}</span>
                                    </div>
                                  ) : formatGHS(m.cost_price)
                                ) : (
                                  formatGHS(p.cost_price || 0)
                                )}
                              </td>
                              <td className="p-2.5 text-right font-medium text-slate-700">
                                {m ? (
                                  p.selling_price !== undefined ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="text-slate-400 line-through text-[10px]">{formatGHS(m.selling_price)}</span>
                                      <ArrowRight size={10} className="text-slate-400" />
                                      <span className={`font-bold ${p.priceDiff > 0 ? 'text-emerald-700 font-extrabold' : p.priceDiff < 0 ? 'text-amber-700 font-extrabold' : 'text-slate-900'}`}>
                                        {formatGHS(p.selling_price)}
                                      </span>
                                    </div>
                                  ) : formatGHS(m.selling_price)
                                ) : (
                                  formatGHS(p.selling_price || 0)
                                )}
                              </td>
                              <td className="p-2.5 text-right font-medium text-slate-700">
                                {m ? (
                                  p.stock_quantity !== undefined ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="text-slate-400 text-[10px]">{m.stock_quantity}</span>
                                      <ArrowRight size={10} className="text-slate-400" />
                                      <span className={`font-bold ${p.stockDiff !== 0 ? 'text-blue-700' : 'text-slate-900'}`}>
                                        {p.stock_quantity}
                                      </span>
                                      {p.stockDiff !== 0 && (
                                        <span className={`text-[10px] px-1 rounded font-bold ${p.stockDiff > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                          {p.stockDiff > 0 ? `+${p.stockDiff}` : p.stockDiff}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    p.stock_change ? `${m.stock_quantity + p.stock_change} (${p.stock_change > 0 ? '+' : ''}${p.stock_change})` : m.stock_quantity
                                  )
                                ) : (
                                  p.stock_quantity || 0
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                {m ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                                    <CheckCircle2 size={11} /> Found
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-bold">
                                    <AlertCircle size={11} /> {bulkMode === 'update' ? 'SKU Not Found' : 'New Item'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {parsedImportProducts.length > 10 && (
                      <div className="p-2.5 text-center text-[11px] text-slate-500 bg-slate-50 border-t border-slate-100 font-medium">
                        ...and {parsedImportProducts.length - 10} more items parsed from CSV file
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Message */}
              {bulkStatus && (
                <div className={`p-3 rounded text-xs font-bold ${
                  bulkStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {bulkStatus.message}
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  disabled={!!bulkStatus && bulkStatus.type === 'success'}
                  onClick={() => {
                    setShowBulkModal(false);
                    setBulkFile(null);
                    setParsedImportProducts([]);
                    setBulkStatus(null);
                  }} 
                  className="flex-1 py-2.5 px-4 border border-slate-300 rounded text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!bulkFile || parsedImportProducts.length === 0 || (!!bulkStatus && bulkStatus.type === 'success')}
                  className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-blue-600 text-white rounded text-xs font-bold transition shadow-sm disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} />
                  {bulkMode === 'update' ? `Apply CSV Updates (${parsedImportProducts.length} items)` : `Import ${parsedImportProducts.length} Items`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Structured Product Import Modal */}
      {showImportModal && (
        <ProductImportModal
          existingProducts={products}
          categories={categories}
          onClose={() => setShowImportModal(false)}
          onSuccess={loadProducts}
        />
      )}

      {/* Bulk Add Products via CSV Text Modal */}
      <BulkCsvProductModal
        isOpen={showBulkCsvModal}
        onClose={() => setShowBulkCsvModal(false)}
        onSuccess={loadProducts}
        availableCategories={categories}
      />

    </div>
  );
}
