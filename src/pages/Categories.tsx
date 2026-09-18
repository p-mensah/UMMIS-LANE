import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { formatGHS } from '../lib/formatters';
import { 
  FolderTree, Plus, Search, Edit, Trash2, X, RefreshCw, 
  Package, Layers, DollarSign, LayoutGrid, List, ArrowRight,
  ChevronRight, Tag, ShieldAlert, CheckCircle2, Box, Lock
} from 'lucide-react';

export default function Categories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // UI & View State
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'with_products' | 'empty'>('all');

  const { addToast, confirmModal } = useNotifications();

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [name, setName] = useState<string>('');
  const [parentId, setParentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleClose = () => {
    setShowModal(false);
    setEditingCategory(null);
    setName('');
    setParentId('');
  };

  useModalDismiss(showModal, handleClose);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    fetchApi('/categories')
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch((err) => {
        addToast({
          type: 'danger',
          title: 'Error Loading Categories',
          message: err.message || 'Could not load product categories.'
        });
      })
      .finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);

    try {
      if (editingCategory) {
        await fetchApi(`/categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: name.trim(), parent_id: parentId || null })
        });
        addToast({
          type: 'success',
          title: 'Category Updated',
          message: `Category "${name.trim()}" was updated successfully.`
        });
      } else {
        await fetchApi('/categories', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), parent_id: parentId || null })
        });
        addToast({
          type: 'success',
          title: 'Category Created',
          message: `Category "${name.trim()}" has been added.`
        });
      }
      handleClose();
      loadData();
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Save Failed',
        message: err.message || 'Failed to save category.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (cat: any) => {
    setEditingCategory(cat);
    setName(cat.name);
    setParentId(cat.parent_id?.toString() || '');
    setShowModal(true);
  };

  const handleDelete = async (id: number, catName: string) => {
    const confirmed = await confirmModal({
      title: 'Delete Category?',
      message: `Are you sure you want to delete category "${catName}"? This action cannot be undone.`,
      confirmText: 'Delete Category',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await fetchApi(`/categories/${id}`, { method: 'DELETE' });
      addToast({
        type: 'success',
        title: 'Category Deleted',
        message: `Category "${catName}" has been removed.`
      });
      loadData();
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Delete Failed',
        message: err.message || 'Failed to delete category.'
      });
    }
  };

  // KPI Calculations
  const totalCategoriesCount = categories.length;
  const totalProductsCount = categories.reduce((acc, c) => acc + (c.product_count || 0), 0);
  const totalStockUnits = categories.reduce((acc, c) => acc + (c.total_stock || 0), 0);
  const totalCategoryValuation = categories.reduce((acc, c) => acc + (c.total_value || 0), 0);

  // Filter & Search Logic
  const filteredCategories = categories.filter((c) => {
    const matchesSearch =
      !searchTerm ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.parent_name && c.parent_name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (filterType === 'with_products') return matchesSearch && (c.product_count || 0) > 0;
    if (filterType === 'empty') return matchesSearch && (!c.product_count || c.product_count === 0);

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 text-white rounded-md shadow-xs">
              <FolderTree size={22} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Product Categories Dashboard</h1>
              <p className="text-xs text-slate-500 font-medium">Classify catalog products, monitor stock distribution per department, and manage taxonomy.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition border border-slate-200"
            title="Refresh Ledger"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {user?.role === 'admin' ? (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2"
            >
              <Plus size={16} /> Add Category
            </button>
          ) : (
            <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded text-xs font-bold flex items-center gap-1.5">
              <Lock size={13} className="text-slate-400" />
              <span>Read-Only Catalog</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">
            <span>Total Categories</span>
            <FolderTree size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalCategoriesCount}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            {categories.filter(c => c.parent_id).length} sub-category hierarchy items
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">
            <span>Categorized Products</span>
            <Package size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700">{totalProductsCount}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Catalog SKUs assigned to departments
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">
            <span>Total Physical Stock</span>
            <Box size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800">{totalStockUnits.toLocaleString()} units</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Inventory stored across categories
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">
            <span>Category Inventory Value</span>
            <DollarSign size={16} className="text-slate-700" />
          </div>
          <div className="text-2xl font-black text-slate-900">{formatGHS(totalCategoryValuation)}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Estimated retail stock valuation
          </div>
        </div>
      </div>

      {/* Filter and View Switcher Toolbar */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search category name or parent category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded text-xs font-medium focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded border border-slate-200">
            {[
              { id: 'all', label: 'All Categories' },
              { id: 'with_products', label: 'With Products' },
              { id: 'empty', label: 'Empty Categories' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded transition-all ${
                  filterType === f.id ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'}`}
              title="Grid Cards View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'}`}
              title="Table View"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded border border-slate-200 text-slate-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-600" />
          Loading category hierarchy and inventory metrics...
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-white p-12 text-center rounded border border-slate-200 text-slate-400">
          <FolderTree size={36} className="mx-auto mb-2 text-slate-300" />
          <div className="font-bold text-slate-700">No Categories Found</div>
          <p className="text-xs text-slate-400 mt-1">
            {searchTerm ? 'No category matches your filter criteria.' : 'Get started by creating your first product category.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white border border-slate-200 hover:border-indigo-300 rounded p-5 shadow-2xs hover:shadow-xs transition-all space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-50 text-indigo-700 rounded font-black text-xs">
                      #{cat.id}
                    </span>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">
                        {cat.name}
                      </h3>
                      {cat.parent_name && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          Parent: <span className="text-indigo-600">{cat.parent_name}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {user?.role === 'admin' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(cat)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded transition"
                        title="Edit Category"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id, cat.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                        title="Delete Category"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded border border-slate-100 text-center my-3">
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase">Products</div>
                    <div className="text-sm font-black text-slate-900">{cat.product_count || 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase">Stock Units</div>
                    <div className="text-sm font-black text-emerald-700">{cat.total_stock || 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase">Valuation</div>
                    <div className="text-xs font-black text-slate-800 truncate" title={formatGHS(cat.total_value || 0)}>
                      {formatGHS(cat.total_value || 0)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] font-medium text-slate-500">
                  {cat.product_count > 0 ? `${cat.product_count} active catalog item(s)` : 'No assigned products'}
                </span>

                <Link
                  to={`/products?category=${encodeURIComponent(cat.name)}`}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-bold rounded text-[11px] transition flex items-center gap-1"
                >
                  Products <ChevronRight size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Category Name</th>
                  <th className="px-4 py-3">Parent Hierarchy</th>
                  <th className="px-4 py-3 text-center">Assigned SKUs</th>
                  <th className="px-4 py-3 text-center">Total Stock Units</th>
                  <th className="px-4 py-3 text-right">Inventory Valuation</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-400">
                      #{cat.id}
                    </td>
                    <td className="px-4 py-3 font-black text-slate-900 uppercase tracking-tight">
                      {cat.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      {cat.parent_name ? (
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded font-bold text-[10px]">
                          {cat.parent_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">— Root —</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800">
                      <Link
                        to={`/products?category=${encodeURIComponent(cat.name)}`}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-blue-100 hover:text-blue-800 border border-slate-200 text-slate-800 rounded font-black text-[11px] transition inline-flex items-center gap-1"
                        title={`View ${cat.product_count || 0} products in ${cat.name}`}
                      >
                        {cat.product_count || 0} SKU(s)
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center font-black text-emerald-700">
                      {cat.total_stock || 0} units
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">
                      {formatGHS(cat.total_value || 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="space-x-1.5 inline-flex items-center">
                        <Link
                          to={`/products?category=${encodeURIComponent(cat.name)}`}
                          className="px-2 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-bold rounded text-[11px] transition inline-flex items-center gap-1"
                          title={`View ${cat.name} products`}
                        >
                          Products <ChevronRight size={11} />
                        </Link>
                        {user?.role === 'admin' && (
                          <>
                            <button
                              onClick={() => handleEdit(cat)}
                              className="px-2 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-bold rounded text-[11px] transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(cat.id, cat.name)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 font-bold rounded text-[11px] transition"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL FOR ADDING / EDITING CATEGORIES */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderTree size={18} className="text-blue-600" />
                {editingCategory ? 'Update Category Details' : 'Create New Category'}
              </h2>
              <button 
                onClick={handleClose} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Category Name *
                </label>
                <input
                  required
                  type="text"
                  autoFocus
                  placeholder="e.g., Beverages, Electronics, Groceries..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Parent Category (Optional)
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="">None (Top-Level Category)</option>
                  {categories
                    .filter((c) => c.id !== editingCategory?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Nest this category under an existing department to build sub-category trees.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-5 py-2 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded transition shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
