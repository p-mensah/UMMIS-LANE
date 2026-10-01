import React, { useState } from 'react';
import { formatGHS } from '../../lib/formatters';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { fetchApi } from '../../lib/api';
import type { SupplierProduct } from '../../types/supplier';
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileEdit,
  Trash2,
  Filter,
  Check,
  X,
  Building2,
  Barcode
} from 'lucide-react';

interface SupplierProductsTabProps {
  products: SupplierProduct[];
  activeSupplier: string;
  onRefresh: () => void;
  userRole?: string;
}

export default function SupplierProductsTab({
  products,
  activeSupplier,
  onRefresh,
  userRole
}: SupplierProductsTabProps) {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const isAdmin = userRole === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending_approval' | 'out_of_stock' | 'draft'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [supplierSku, setSupplierSku] = useState('');
  const [internalSku, setInternalSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [unitCost, setUnitCost] = useState<number | ''>(50);
  const [sellingPrice, setSellingPrice] = useState<number | ''>(65);
  const [moq, setMoq] = useState<number | ''>(10);
  const [currentStock, setCurrentStock] = useState<number | ''>(100);
  const [status, setStatus] = useState<'active' | 'pending_approval' | 'out_of_stock' | 'draft'>('pending_approval');
  const [category, setCategory] = useState('Groceries');
  const [unit, setUnit] = useState('Carton');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSupplierSku('');
    setInternalSku('');
    setBarcode('');
    setUnitCost(50);
    setSellingPrice(65);
    setMoq(10);
    setCurrentStock(100);
    setStatus(isAdmin ? 'active' : 'pending_approval');
    setCategory('Groceries');
    setUnit('Carton');
    setEditingProduct(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (p: SupplierProduct) => {
    setEditingProduct(p);
    setTitle(p.title);
    setDescription(p.description || '');
    setSupplierSku(p.supplier_sku);
    setInternalSku(p.internal_sku || '');
    setBarcode(p.barcode || '');
    setUnitCost(p.unit_cost);
    setSellingPrice(p.selling_price || p.unit_cost * 1.25);
    setMoq(p.moq || 1);
    setCurrentStock(p.current_stock);
    setStatus(p.status);
    setCategory(p.category || 'Groceries');
    setUnit(p.unit || 'Carton');
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !supplierSku.trim() || unitCost === '') {
      addToast('Product Title, Supplier SKU, and Unit Cost are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await fetchApi(`/supplier/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            supplier_sku: supplierSku.trim(),
            internal_sku: internalSku.trim(),
            barcode: barcode.trim(),
            unit_cost: Number(unitCost),
            selling_price: Number(sellingPrice),
            moq: Number(moq),
            current_stock: Number(currentStock),
            status,
            category: category.trim(),
            unit: unit.trim()
          })
        });
        addToast(`Product "${title}" updated successfully`, 'success');
      } else {
        await fetchApi('/supplier/products', {
          method: 'POST',
          body: JSON.stringify({
            supplier_name: activeSupplier,
            title: title.trim(),
            description: description.trim(),
            supplier_sku: supplierSku.trim(),
            internal_sku: internalSku.trim(),
            barcode: barcode.trim(),
            unit_cost: Number(unitCost),
            selling_price: Number(sellingPrice),
            moq: Number(moq),
            current_stock: Number(currentStock),
            status: isAdmin ? status : 'pending_approval',
            category: category.trim(),
            unit: unit.trim()
          })
        });
        addToast(
          isAdmin
            ? `Product "${title}" created and activated.`
            : `Product "${title}" submitted. Marked as "Pending Admin Approval".`,
          'success'
        );
      }
      setShowAddModal(false);
      resetForm();
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to save product', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (p: SupplierProduct) => {
    try {
      await fetchApi(`/supplier/products/${p.id}/approve`, { method: 'POST' });
      addToast(`Product "${p.title}" approved and synced to master store catalog!`, 'success');
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to approve product', 'error');
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.supplier_sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.internal_sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (statusVal: string, approved: boolean | number | undefined) => {
    if (statusVal === 'pending_approval' || (!approved && statusVal !== 'draft')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">
          <Clock size={11} /> Pending Admin Approval
        </span>
      );
    }
    if (statusVal === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 size={11} /> Active
        </span>
      );
    }
    if (statusVal === 'out_of_stock') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-50 text-rose-800 border border-rose-200">
          <AlertTriangle size={11} /> Out of Stock
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
        Draft
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Functional Table Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Package className="text-blue-600" size={18} />
            My Products Catalog
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Manage your items, set wholesale unit costs, specify minimum order quantities (MOQs), and track stock levels.
          </p>
        </div>

        {/* Primary Action Button: "Add New Product" ONLY inside this functional page */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer self-start md:self-auto shrink-0"
        >
          <Plus size={15} /> Add New Product
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Search by title, supplier SKU, internal SKU, barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase shrink-0">Status:</span>
          {(['all', 'active', 'pending_approval', 'out_of_stock', 'draft'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs font-bold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'all' ? 'All Products' : st.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black tracking-wider text-[10px]">
                <th className="py-3 px-4">Product Details</th>
                <th className="py-3 px-4">SKU Cross-Ref</th>
                <th className="py-3 px-4">Unit Cost</th>
                <th className="py-3 px-4">Selling Price</th>
                <th className="py-3 px-4">MOQ</th>
                <th className="py-3 px-4">Stock Level</th>
                <th className="py-3 px-4">Approval Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Package size={28} className="mx-auto mb-2 opacity-30" />
                    No products found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{p.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {p.category || 'General'} • {p.unit || 'Units'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-bold text-slate-800">
                        {p.supplier_sku}
                      </div>
                      {p.internal_sku && (
                        <div className="font-mono text-[10px] text-slate-400">
                          Store SKU: {p.internal_sku}
                        </div>
                      )}
                      {p.barcode && (
                        <div className="font-mono text-[10px] text-teal-600 flex items-center gap-1">
                          <Barcode size={10} /> {p.barcode}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {formatGHS(p.unit_cost)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.selling_price ? formatGHS(p.selling_price) : '-'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-700">
                      {p.moq || 1}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${p.current_stock <= (p.reorder_point || 10) ? 'text-rose-600' : 'text-slate-800'}`}>
                        {p.current_stock}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Min: {p.reorder_point || 10}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(p.status, p.admin_approved)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isAdmin && (p.status === 'pending_approval' || !p.admin_approved) && (
                          <button
                            type="button"
                            onClick={() => handleApprove(p)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Approve and sync product to store catalog"
                          >
                            <Check size={12} /> Approve
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="Edit Product"
                        >
                          <FileEdit size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add or Edit Supplier Product */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {editingProduct ? 'Edit Product Details' : 'Add New Product'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isAdmin ? 'Store Admin Catalog Management' : 'Submitted products undergo Store Admin Approval'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Carnation Evaporated Milk 160g (Pack of 24)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Supplier SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NEST-CARN-160G"
                    value={supplierSku}
                    onChange={(e) => setSupplierSku(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Internal Store SKU</label>
                  <input
                    type="text"
                    placeholder="e.g. CARN-160G-24PK"
                    value={internalSku}
                    onChange={(e) => setInternalSku(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Barcode / UPC / EAN</label>
                  <input
                    type="text"
                    placeholder="e.g. 6151000210014"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Dairy & Milks"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit Cost (GHS) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Selling Price (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">MOQ *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={moq}
                    onChange={(e) => setMoq(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Current Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={currentStock}
                    onChange={(e) => setCurrentStock(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit Type</label>
                  <input
                    type="text"
                    placeholder="Carton, Box, Tin"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Stock Status</label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Packaging details, storage guidelines, batch specifications..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
