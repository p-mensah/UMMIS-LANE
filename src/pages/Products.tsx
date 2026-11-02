import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Plus, Edit, Trash2, Search, FileText, Upload, X, Scan, Download, CheckCircle2, AlertCircle, AlertTriangle, ArrowRight, RefreshCw, FileSpreadsheet, MoreVertical, SlidersHorizontal, Table, Filter, Tag, Package, PackageSearch, Eye, Tablet, ShoppingCart } from 'lucide-react';
import { formatGHS } from '../lib/formatters';
import ProductImportModal from '../components/ProductImportModal';
import BulkCsvProductModal from '../components/BulkCsvProductModal';
import ProductFormModal from '../components/ProductFormModal';
import RowActionMenu from '../components/common/RowActionMenu';
import Pagination from '../components/common/Pagination';
import StatusBadge from '../components/common/StatusBadge';

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  sub_category?: string;
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
  const navigate = useNavigate();
  const { addToast } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'name' | 'sku'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [filterBelowMinStock, setFilterBelowMinStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const [categories, setCategories] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<number | null>(null);
  const [actionMenuCoords, setActionMenuCoords] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);

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

  // Multi-Select Batch Actions State
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [showBatchCategoryModal, setShowBatchCategoryModal] = useState(false);
  const [batchTargetCategory, setBatchTargetCategory] = useState('');
  const [batchTargetSubCategory, setBatchTargetSubCategory] = useState('');
  const [batchMinStockLevel, setBatchMinStockLevel] = useState('');
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  useEffect(() => {
    loadProducts();
    const handleCloseMenu = () => {
      setActiveActionMenuId(null);
      setActionMenuCoords(null);
    };
    window.addEventListener('click', handleCloseMenu);
    window.addEventListener('scroll', handleCloseMenu, true);
    window.addEventListener('resize', handleCloseMenu);
    return () => {
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('scroll', handleCloseMenu, true);
      window.removeEventListener('resize', handleCloseMenu);
    };
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
    exportTableToCSV();
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

  const handleProductSubmit = async (data: any) => {
    try {
      if (editingProduct) {
        await fetchApi(`/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      } else {
        await fetchApi('/products', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }
      setShowModal(false);
      loadProducts();
    } catch (err: any) {
      addToast(err.message || 'Failed to save product', 'error');
      throw err;
    }
  };

  const handleEdit = (p: Product) => {
    setEditingProduct(p);
    setShowModal(true);
  };

  const confirmDelete = async () => {
    if (deletingProductId) {
      try {
        await fetchApi(`/products/${deletingProductId}`, { method: 'DELETE' });
        setDeletingProductId(null);
        loadProducts();
        addToast('Product successfully deleted', 'success');
      } catch (err: any) {
        addToast(err.message || 'Failed to delete product', 'error');
        setDeletingProductId(null);
      }
    }
  };

  const openNew = () => {
    setEditingProduct(null);
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
      addToast("Reason must be at least 3 characters long.", "warning");
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
      addToast('Stock level adjusted successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to adjust stock', 'error');
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
      // Stock below minimum level quick restocking filter
      if (filterBelowMinStock) {
        const minLvl = p.min_stock_level ?? 10;
        if ((p.stock_quantity || 0) > minLvl) return false;
      }

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
  }, [products, searchQuery, searchScope, selectedCategory, filterBelowMinStock]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchScope, selectedCategory, filterBelowMinStock]);

  const exportTableToCSV = () => {
    if (filteredProducts.length === 0) {
      addToast('No product records match the current table filters to export.', 'warning');
      return;
    }
    const isAdmin = user?.role === 'admin';
    const headers = [
      'SKU',
      'Barcode',
      'Product Name',
      'Brand',
      'Category',
      'Unit of Measure',
      ...(isAdmin ? ['Cost Price (GHS)'] : []),
      'Selling Price (GHS)',
      'Current Stock',
      'Min Stock Level',
      'Stock Status'
    ];

    const rows = filteredProducts.map(p => {
      const status = (p.stock_quantity || 0) <= 0
        ? 'Out of Stock'
        : (p.stock_quantity || 0) <= (p.min_stock_level ?? 10)
          ? 'Low Stock'
          : 'In Stock';

      return [
        p.sku || '',
        p.barcode || '',
        p.name || '',
        p.brand || '',
        p.category || 'Uncategorized',
        p.unit_of_measure || 'pcs',
        ...(isAdmin ? [(p.cost_price || 0).toFixed(2)] : []),
        (p.selling_price || 0).toFixed(2),
        (p.stock_quantity || 0).toString(),
        (p.min_stock_level ?? 10).toString(),
        status
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `products_table_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`Exported ${filteredProducts.length} product records to CSV.`, 'success');
  };

  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const isAllPageSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProductIds.includes(p.id));

  const toggleSelectAllOnPage = () => {
    if (isAllPageSelected) {
      const pageIds = paginatedProducts.map(p => p.id);
      setSelectedProductIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      const pageIds = paginatedProducts.map(p => p.id);
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const selectAllFiltered = () => {
    setSelectedProductIds(filteredProducts.map(p => p.id));
  };

  const deselectAll = () => {
    setSelectedProductIds([]);
  };

  const exportSelectedProductsCSV = () => {
    const selected = products.filter(p => selectedProductIds.includes(p.id));
    if (selected.length === 0) return;

    const headers = ['ID', 'Product Name', 'Brand', 'SKU', 'Barcode', 'Unit', 'Category', 'Sub Category', 'Cost Price', 'Selling Price', 'Stock Quantity', 'Min Stock Level'];
    const rows = selected.map(p => [
      p.id,
      p.name,
      p.brand || '',
      p.sku || '',
      p.barcode || '',
      p.unit_of_measure || '',
      p.category || '',
      p.sub_category || '',
      p.cost_price,
      p.selling_price,
      p.stock_quantity,
      p.min_stock_level ?? 10
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `selected_products_batch_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`Exported ${selected.length} selected products to CSV.`, 'success');
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedProductIds.length === 0) return;
    setIsBatchDeleting(true);
    try {
      const res = await fetchApi('/products/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedProductIds })
      });
      addToast(res.message || `Deleted ${selectedProductIds.length} products.`, 'success');
      setSelectedProductIds([]);
      setShowBatchDeleteModal(false);
      loadProducts();
    } catch (err: any) {
      addToast(err.message || 'Failed to delete products.', 'error');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleConfirmBatchUpdate = async () => {
    if (selectedProductIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const payload: any = { ids: selectedProductIds };
      if (batchTargetCategory) payload.category = batchTargetCategory;
      if (batchTargetSubCategory) payload.sub_category = batchTargetSubCategory;
      if (batchMinStockLevel) payload.min_stock_level = parseInt(batchMinStockLevel, 10);

      const res = await fetchApi('/products/batch-update-status', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      addToast(res.message || `Updated ${selectedProductIds.length} products.`, 'success');
      setSelectedProductIds([]);
      setShowBatchCategoryModal(false);
      setBatchTargetCategory('');
      setBatchTargetSubCategory('');
      setBatchMinStockLevel('');
      loadProducts();
    } catch (err: any) {
      addToast(err.message || 'Failed to update products.', 'error');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* UNIFIED APPLICATION PAGE HEADER (Matches Purchases, Dashboard, Sales, Users) */}
      <div id="products-page-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-lg shrink-0 shadow-2xs">
            <Package size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Products Catalog
              </h1>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-bold border border-slate-200">
                {products.length} Products
              </span>
              {lowStockCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterBelowMinStock(!filterBelowMinStock)}
                  className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                    filterBelowMinStock
                      ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-300'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                  }`}
                  title="Click to filter items below their minimum stock level"
                >
                  <AlertTriangle size={12} className={filterBelowMinStock ? 'text-slate-950 animate-bounce' : 'text-amber-600'} />
                  <span>{lowStockCount} Below Min Stock</span>
                  <span className="text-[10px] opacity-80 underline">{filterBelowMinStock ? 'Clear' : 'Filter'}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manage inventory stock levels, barcode tracking, retail pricing, and supplier reorder points
            </p>
          </div>
        </div>

        {/* Action buttons styled consistently with application design system */}
        {user?.role === 'admin' && (
          <div className="flex items-center flex-wrap gap-2">
            <button 
              type="button"
              onClick={openNew} 
              className="flex items-center justify-center px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition shadow-2xs cursor-pointer active:scale-95"
            >
              <Plus size={15} className="mr-1" /> Add Product
            </button>
            <button 
              type="button"
              id="import-products-csv-btn"
              onClick={() => setShowImportModal(true)}
              className="flex items-center justify-center px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs uppercase tracking-wider transition shadow-2xs cursor-pointer"
              title="Bulk import products from CSV file with column mapping and data integrity validation"
            >
              <Upload size={14} className="mr-1.5 text-slate-500" /> Bulk CSV Import
            </button>
            <button 
              type="button"
              id="quick-csv-paste-btn"
              onClick={() => setShowBulkCsvModal(true)}
              className="flex items-center justify-center px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs uppercase tracking-wider transition shadow-2xs cursor-pointer"
              title="Quick CSV text input with real-time format validation"
            >
              <FileSpreadsheet size={14} className="mr-1.5 text-slate-500" /> Quick CSV
            </button>
            <button 
              type="button"
              id="export-products-header-csv-btn"
              onClick={exportTableToCSV}
              disabled={filteredProducts.length === 0}
              className="flex items-center justify-center px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition shadow-2xs cursor-pointer disabled:opacity-50"
              title="Export current table data to CSV"
            >
              <Download size={14} className="mr-1.5" /> Export CSV ({filteredProducts.length})
            </button>
          </div>
        )}
      </div>

      {/* ROBUST REAL-TIME SEARCH & FILTER TOOLBAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
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
            {/* Quick clear button */}
            {searchQuery && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                <button 
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition cursor-pointer"
                  title="Clear search"
                >
                  <X size={15} />
                </button>
              </div>
            )}
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

          {/* Quick Restocking Filter Button: Highlight items below minimum stock level */}
          <button
            type="button"
            id="filter-below-min-stock-btn"
            onClick={() => setFilterBelowMinStock(!filterBelowMinStock)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition cursor-pointer shrink-0 border shadow-2xs active:scale-95 ${
              filterBelowMinStock
                ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-300'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
            }`}
            title="Toggle to view only items below their defined minimum stock level for quick restocking"
          >
            <AlertTriangle size={14} className={filterBelowMinStock ? 'text-slate-950 animate-bounce' : 'text-amber-600'} />
            <span>Below Min Stock</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
              filterBelowMinStock ? 'bg-slate-950 text-amber-300' : 'bg-white text-amber-900 border border-amber-300'
            }`}>
              {lowStockCount}
            </span>
          </button>

          {/* Export Current Table Data Button */}
          <button
            type="button"
            id="export-products-table-csv-btn"
            onClick={exportTableToCSV}
            disabled={filteredProducts.length === 0}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer whitespace-nowrap active:scale-95 disabled:opacity-50 shrink-0"
            title="Export the currently displayed table rows to CSV"
          >
            <Download size={14} className="text-slate-600" />
            <span>Export Table CSV</span>
            <span className="ml-0.5 px-1.5 py-0.5 bg-white text-slate-700 rounded text-[10px] font-mono font-bold border border-slate-200">
              {filteredProducts.length}
            </span>
          </button>
        </div>

        {/* Real-time search & stock status indicator if active */}
        {(searchQuery || (selectedCategory && selectedCategory !== 'ALL') || filterBelowMinStock) && (
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-700">Filter applied:</span>
              <span className="text-slate-600">
                {searchQuery && `Search: "${searchQuery}"`}
                {searchQuery && selectedCategory && selectedCategory !== 'ALL' && ' • '}
                {selectedCategory && selectedCategory !== 'ALL' && `Category: ${selectedCategory}`}
                {filterBelowMinStock && (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded ml-1 border border-amber-300">
                    <AlertTriangle size={11} className="text-amber-600" />
                    Items Below Minimum Stock Level Only
                  </span>
                )}
              </span>
              <span className="text-slate-400 font-medium">
                ({filteredProducts.length} items found)
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                handleCategoryChange('ALL');
                setFilterBelowMinStock(false);
              }}
              className="text-[11px] font-bold text-blue-600 hover:text-red-600 transition cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Floating / Sticky Batch Actions Bar */}
      {selectedProductIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-blue-600 text-white rounded-md font-black text-xs">
              {selectedProductIds.length} Selected
            </span>
            <span className="text-xs text-slate-300 font-medium">
              of {products.length} total products
            </span>
            {selectedProductIds.length < filteredProducts.length && (
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
              >
                Select all {filteredProducts.length} filtered
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={exportSelectedProductsCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 shadow-2xs cursor-pointer active:scale-95"
              title="Export selected products to CSV"
            >
              <Download size={13} className="text-blue-400" />
              <span>Export CSV ({selectedProductIds.length})</span>
            </button>

            {user?.role === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowBatchCategoryModal(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 shadow-2xs cursor-pointer active:scale-95"
                  title="Update category or restock threshold on selected products"
                >
                  <Tag size={13} className="text-emerald-400" />
                  <span>Update Category / Status</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBatchDeleteModal(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                  title="Delete selected products"
                >
                  <Trash2 size={13} />
                  <span>Delete ({selectedProductIds.length})</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={deselectAll}
              className="px-2.5 py-1.5 text-slate-400 hover:text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-x-auto min-h-[300px]">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllPageSelected}
                  onChange={toggleSelectAllOnPage}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  title={isAllPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
                />
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Image</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Product Name</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Brand</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">SKU</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">UOM</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Barcode</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Category</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Price</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stock & Restock Status</th>
              <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center max-w-md mx-auto text-slate-500 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                      <PackageSearch size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">
                        {filterBelowMinStock 
                          ? 'No items currently below minimum stock level'
                          : searchQuery ? `No products matching "${searchQuery}"` : 'No products found'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {filterBelowMinStock
                          ? 'All inventory items are currently at healthy stock levels above their defined restocking thresholds.'
                          : searchQuery 
                          ? `We couldn't find any products with ${searchScope === 'sku' ? 'SKU' : searchScope === 'name' ? 'name' : 'name or SKU'} matching your search.`
                          : 'No items currently in catalog. Use "+ Add Product" to add products.'}
                      </p>
                    </div>
                    {(searchQuery || (selectedCategory && selectedCategory !== 'ALL') || filterBelowMinStock) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          handleCategoryChange('ALL');
                          setFilterBelowMinStock(false);
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
              paginatedProducts.map(p => {
                const minLevel = p.min_stock_level ?? 10;
                const isOutOfStock = (p.stock_quantity || 0) <= 0;
                const isBelowMin = (p.stock_quantity || 0) <= minLevel;

                const isSelected = selectedProductIds.includes(p.id);

                return (
                  <tr 
                    key={p.id} 
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-blue-50/70 hover:bg-blue-50'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="px-4 py-3 w-10 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectProduct(p.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        title={`Select ${p.name}`}
                      />
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-[13px]">
                       {p.image_url ? (
                         <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-sm border border-slate-200" />
                       ) : (
                         <div className="w-10 h-10 bg-slate-100 rounded-sm flex items-center justify-center text-slate-400 font-bold uppercase text-[10px]">{p.name.substring(0,2)}</div>
                       )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-[13px] font-medium text-slate-900 leading-none">
                      <div className="flex items-center gap-2">
                        <Link to={`/products/${p.id}`} className="hover:text-blue-500 font-bold decoration-blue-500/20 underline decoration-2 underline-offset-2">
                          {p.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{p.brand || '-'}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500 font-mono bg-slate-50">{p.sku}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{p.unit_of_measure || '-'}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500 font-mono bg-slate-50">{p.barcode || '-'}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">
                      <div className="font-medium text-slate-800">{p.category}</div>
                      {p.sub_category && (
                        <div className="text-[11px] text-slate-400 font-normal">{p.sub_category}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-900 font-semibold">{formatGHS(p.selling_price)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-[13px]">
                      {isOutOfStock ? (
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge
                            status="out_of_stock"
                            variant="out_of_stock"
                            label="Out of Stock (0)"
                            size="xs"
                            pulseDot
                          />
                          <span className="text-[10px] font-mono font-bold text-rose-600 pl-0.5">
                            Min: {minLevel} • Depleted
                          </span>
                        </div>
                      ) : isBelowMin ? (
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge
                            status="breached"
                            variant="breached"
                            label={`Low: ${p.stock_quantity} ${p.unit_of_measure || 'pcs'}`}
                            size="xs"
                          />
                          <span className="text-[10px] font-mono font-bold text-amber-700 pl-0.5">
                            Min: {minLevel} • Deficit
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start gap-0.5">
                          <StatusBadge
                            status="healthy"
                            variant="healthy"
                            label={`${p.stock_quantity} ${p.unit_of_measure || 'pcs'}`}
                            size="xs"
                          />
                          <span className="text-[10px] font-mono text-slate-400 pl-0.5">
                            Min: {minLevel}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-right text-[13px] font-medium">
                      <div className="flex items-center justify-end">
                        <RowActionMenu
                          triggerTitle={`Actions for ${p.name}`}
                          actions={[
                            {
                              label: 'View Product Details',
                              sublabel: user?.role === 'admin' ? 'Audit log & pricing history' : 'Item specifications & pricing',
                              icon: <Eye size={14} />,
                              onClick: () => navigate(`/products/${p.id}`),
                            },
                            {
                              label: 'Sell in POS Terminal',
                              sublabel: 'Open POS terminal',
                              icon: <ShoppingCart size={14} className="text-blue-600" />,
                              onClick: () => navigate(`/sales`),
                            },
                            user?.role === 'admin' ? {
                              label: isBelowMin ? 'Restock / Adjust Stock' : 'Adjust Stock',
                              icon: <SlidersHorizontal size={14} className={isBelowMin ? "text-amber-600 font-bold" : "text-amber-500"} />,
                              onClick: () => openAdjust(p),
                            } : null,
                            user?.role === 'admin' ? {
                              label: 'Edit Product',
                              icon: <Edit size={14} className="text-blue-500" />,
                              onClick: () => handleEdit(p),
                            } : null,
                            user?.role === 'admin' ? {
                              label: 'Delete Product',
                              destructive: true,
                              icon: <Trash2 size={14} className="text-rose-500" />,
                              onClick: () => setDeletingProductId(p.id),
                            } : null,
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={filteredProducts.length}
        pageSize={pageSize}
      />

      {showModal && (
        <ProductFormModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
          onSubmit={handleProductSubmit}
          editingProduct={editingProduct}
          categories={categories}
          existingProducts={products}
        />
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

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center bg-rose-50/70 border-b border-rose-100">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-black text-slate-900">Delete {selectedProductIds.length} Products</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete these selected products from your inventory catalog? This action cannot be undone.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="max-h-40 overflow-y-auto space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                {products.filter(p => selectedProductIds.includes(p.id)).slice(0, 10).map(p => (
                  <div key={p.id} className="flex items-center justify-between font-medium text-slate-700">
                    <span className="truncate max-w-[240px]">{p.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">{p.sku}</span>
                  </div>
                ))}
                {selectedProductIds.length > 10 && (
                  <div className="text-[11px] text-slate-400 italic text-center pt-1">
                    ...and {selectedProductIds.length - 10} more products
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmBatchDelete}
                  disabled={isBatchDeleting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isBatchDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>{isBatchDeleting ? 'Deleting...' : `Confirm Delete (${selectedProductIds.length})`}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchDeleteModal(false)}
                  disabled={isBatchDeleting}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Update Category / Status Modal */}
      {showBatchCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-blue-600" />
                <h3 className="text-sm font-black text-slate-900">Batch Update ({selectedProductIds.length} Products)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                  Assign Category
                </label>
                <select
                  value={batchTargetCategory}
                  onChange={e => setBatchTargetCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Keep Existing Categories --</option>
                  {categories.map((c: any) => (
                    <option key={c.id || c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                  Sub-Category (Optional)
                </label>
                <input
                  type="text"
                  value={batchTargetSubCategory}
                  onChange={e => setBatchTargetSubCategory(e.target.value)}
                  placeholder="e.g. Antibiotics, Beverages, Snacks"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                  Set Minimum Restock Threshold (Baseline Units)
                </label>
                <input
                  type="number"
                  min={1}
                  value={batchMinStockLevel}
                  onChange={e => setBatchMinStockLevel(e.target.value)}
                  placeholder="Leave blank to keep existing levels"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-blue-900 text-[11px] leading-relaxed">
                Applying will update all {selectedProductIds.length} currently selected products with the specified attributes.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmBatchUpdate}
                  disabled={isBatchUpdating || (!batchTargetCategory && !batchTargetSubCategory && !batchMinStockLevel)}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isBatchUpdating ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>{isBatchUpdating ? 'Updating...' : `Apply to ${selectedProductIds.length} Products`}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchCategoryModal(false)}
                  disabled={isBatchUpdating}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
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
