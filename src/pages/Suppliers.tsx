import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import { useNotifications } from '../context/NotificationContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { 
  Truck, Plus, Search, Edit, Trash2, X, RefreshCw, 
  Phone, Mail, MapPin, User, FileText, 
  ShoppingBag, Calendar, LayoutGrid, List, ChevronRight, ExternalLink,
  Building2, CheckCircle2, Clock, History
} from 'lucide-react';
import { CediSign } from '../components/common/CediSign';
import RowActionMenu from '../components/common/RowActionMenu';
import Pagination from '../components/common/Pagination';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // UI & View State
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'with_purchases' | 'no_purchases'>('all');

  // Supplier Form Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: ''
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const { addToast, confirmModal } = useNotifications();

  // Supplier History Drawer/Modal
  const [historySupplier, setHistorySupplier] = useState<any | null>(null);
  const [historyPurchases, setHistoryPurchases] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  useModalDismiss(showModal, () => setShowModal(false));
  useModalDismiss(historySupplier !== null, () => setHistorySupplier(null));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    fetchApi('/suppliers')
      .then((data) => {
        if (Array.isArray(data)) setSuppliers(data);
      })
      .catch((err) => {
        addToast({
          type: 'danger',
          title: 'Error Loading Suppliers',
          message: err.message || 'Could not load suppliers.'
        });
      })
      .finally(() => setLoading(false));
  };

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setFormData({ name: '', contact_person: '', email: '', phone: '', address: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (sup: any) => {
    setEditingSupplier(sup);
    setFormData({
      name: sup.name || '',
      contact_person: sup.contact_person || '',
      email: sup.email || '',
      phone: sup.phone || '',
      address: sup.address || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setIsSubmitting(true);

    try {
      if (editingSupplier) {
        await fetchApi(`/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
        addToast({
          type: 'success',
          title: 'Supplier Updated',
          message: `Supplier "${formData.name.trim()}" has been updated.`
        });
      } else {
        await fetchApi('/suppliers', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
        addToast({
          type: 'success',
          title: 'Supplier Added',
          message: `Supplier "${formData.name.trim()}" was created successfully.`
        });
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Save Failed',
        message: err.message || 'Failed to save supplier.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    const confirmed = await confirmModal({
      title: 'Delete Supplier?',
      message: `Are you sure you want to delete supplier "${name}"? This action cannot be undone.`,
      confirmText: 'Delete Supplier',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await fetchApi(`/suppliers/${id}`, { method: 'DELETE' });
      addToast({
        type: 'success',
        title: 'Supplier Deleted',
        message: `Supplier "${name}" has been removed.`
      });
      loadData();
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Delete Failed',
        message: err.message || 'Failed to delete supplier.'
      });
    }
  };

  const handleViewHistory = async (supplierId: number) => {
    setHistoryLoading(true);
    setHistorySupplier(null);
    setHistoryPurchases([]);

    try {
      const res = await fetchApi(`/suppliers/${supplierId}/purchases`);
      setHistorySupplier(res.supplier);
      setHistoryPurchases(res.purchases || []);
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'History Failed',
        message: 'Failed to load supplier purchase history: ' + err.message
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  // KPI Calculations
  const totalSuppliersCount = suppliers.length;
  const totalPurchasesCount = suppliers.reduce((acc, s) => acc + (s.total_purchases || 0), 0);
  const totalPurchaseSpend = suppliers.reduce((acc, s) => acc + (s.total_spent || 0), 0);
  const avgSpendPerSupplier = totalSuppliersCount > 0 ? totalPurchaseSpend / totalSuppliersCount : 0;

  // Filter & Search
  const filteredSuppliers = suppliers.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      s.name.toLowerCase().includes(term) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(term)) ||
      (s.email && s.email.toLowerCase().includes(term)) ||
      (s.phone && s.phone.toLowerCase().includes(term)) ||
      (s.address && s.address.toLowerCase().includes(term));

    if (filterType === 'with_purchases') return matchesSearch && (s.total_purchases || 0) > 0;
    if (filterType === 'no_purchases') return matchesSearch && (!s.total_purchases || s.total_purchases === 0);

    return matchesSearch;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const totalPages = Math.ceil(filteredSuppliers.length / pageSize) || 1;
  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 text-white rounded-md shadow-xs">
              <Truck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Suppliers & Vendor Directory</h1>
              <p className="text-xs text-slate-500 font-medium">Manage wholesale suppliers, track purchase order expenditure, and maintain contact ledgers.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition border border-slate-200"
            title="Refresh Suppliers"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2"
          >
            <Plus size={16} /> Add New Supplier
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">
            <span>Total Suppliers</span>
            <Building2 size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalSuppliersCount}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Active wholesale vendor contacts
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">
            <span>Purchase Orders Issued</span>
            <ShoppingBag size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700">{totalPurchasesCount}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Total completed & pending restock orders
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">
            <span>Total Vendor Expenditure</span>
            <CediSign size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800">{formatGHS(totalPurchaseSpend)}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Cumulative wholesale order volume
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">
            <span>Avg Spend / Supplier</span>
            <CediSign size={16} className="text-slate-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{formatGHS(avgSpendPerSupplier)}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Mean procurement spend per vendor
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search supplier name, contact person, phone, email, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded text-xs font-medium focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded border border-slate-200">
            {[
              { id: 'all', label: 'All Suppliers' },
              { id: 'with_purchases', label: 'With Orders' },
              { id: 'no_purchases', label: 'No Orders Yet' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded transition-all ${
                  filterType === f.id ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-900'
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
              className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500'}`}
              title="Grid Cards View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500'}`}
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
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
          Loading supplier directory & procurement stats...
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white p-12 text-center rounded border border-slate-200 text-slate-400">
          <Truck size={36} className="mx-auto mb-2 text-slate-300" />
          <div className="font-bold text-slate-700">No Suppliers Found</div>
          <p className="text-xs text-slate-400 mt-1">
            {searchTerm ? 'No vendor matches your search criteria.' : 'Click "Add New Supplier" to create your first vendor record.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedSuppliers.map((sup) => (
              <div
                key={sup.id}
                className="bg-white border border-slate-200 hover:border-blue-300 rounded p-5 shadow-2xs hover:shadow-xs transition-all space-y-4 flex flex-col justify-between"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded bg-blue-50 border border-blue-200 text-blue-700 font-black text-sm flex items-center justify-center uppercase">
                        {sup.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-sm tracking-tight leading-snug">
                          {sup.name}
                        </h3>
                        {sup.contact_person && (
                          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                            <User size={12} className="text-slate-400" />
                            {sup.contact_person}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center">
                      <RowActionMenu
                        triggerTitle={`Actions for ${sup.name}`}
                        actions={[
                          {
                            label: 'Procurement History',
                            sublabel: 'View purchase order records',
                            icon: <History size={14} />,
                            onClick: () => handleViewHistory(sup.id),
                          },
                          {
                            label: 'Edit Supplier',
                            icon: <Edit size={14} />,
                            onClick: () => handleOpenEdit(sup),
                          },
                          {
                            label: 'Delete Supplier',
                            destructive: true,
                            icon: <Trash2 size={14} />,
                            onClick: () => handleDelete(sup.id, sup.name),
                          },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1.5 text-xs text-slate-600 my-3 bg-slate-50/70 p-3 rounded border border-slate-100">
                    {sup.phone ? (
                      <a
                        href={`tel:${sup.phone}`}
                        className="flex items-center gap-2 hover:text-blue-600 font-mono text-[11px]"
                      >
                        <Phone size={13} className="text-slate-400" />
                        {sup.phone}
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 italic text-[11px]">
                        <Phone size={13} /> No phone recorded
                      </div>
                    )}

                    {sup.email ? (
                      <a
                        href={`mailto:${sup.email}`}
                        className="flex items-center gap-2 hover:text-blue-600 text-[11px] truncate"
                      >
                        <Mail size={13} className="text-slate-400" />
                        {sup.email}
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 italic text-[11px]">
                        <Mail size={13} /> No email recorded
                      </div>
                    )}

                    {sup.address && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-600 truncate">
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        {sup.address}
                      </div>
                    )}
                  </div>

                  {/* Spend & PO Breakdown */}
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2 bg-slate-50 rounded border border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase">Purchase Orders</div>
                      <div className="font-black text-slate-900 mt-0.5">{sup.total_purchases || 0} order(s)</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase">Total Spend</div>
                      <div className="font-black text-emerald-700 mt-0.5">{formatGHS(sup.total_spent || 0)}</div>
                    </div>
                  </div>
                </div>

                {/* Action Toolbar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-500">
                    Active Vendor
                  </span>

                  <Link
                    to="/purchases"
                    className="text-blue-600 hover:text-blue-800 font-bold text-xs inline-flex items-center gap-1"
                  >
                    <span>Purchase Orders</span>
                    <ChevronRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredSuppliers.length}
            pageSize={pageSize}
          />
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">Contact Person</th>
                  <th className="px-4 py-3">Phone & Email</th>
                  <th className="px-4 py-3 text-center">Total Orders</th>
                  <th className="px-4 py-3 text-right">Total Expenditure</th>
                  <th className="px-4 py-3">Last Order Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-black text-slate-900 tracking-tight">
                      {sup.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {sup.contact_person || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="font-mono text-[11px]">{sup.phone || '—'}</div>
                      <div className="text-[10px] text-slate-400">{sup.email || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 rounded font-black text-[11px]">
                        {sup.total_purchases || 0} order(s)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-emerald-700">
                      {formatGHS(sup.total_spent || 0)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {sup.last_purchase_date
                        ? new Date(sup.last_purchase_date).toLocaleDateString()
                        : 'No Orders Yet'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end">
                        <RowActionMenu
                          triggerTitle={`Actions for ${sup.name}`}
                          actions={[
                            {
                              label: 'Procurement History',
                              sublabel: 'View purchase order records',
                              icon: <History size={14} />,
                              onClick: () => handleViewHistory(sup.id),
                            },
                            {
                              label: 'Edit Supplier',
                              icon: <Edit size={14} />,
                              onClick: () => handleOpenEdit(sup),
                            },
                            {
                              label: 'Delete Supplier',
                              destructive: true,
                              icon: <Trash2 size={14} />,
                              onClick: () => handleDelete(sup.id, sup.name),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredSuppliers.length}
            pageSize={pageSize}
          />
        </div>
      )}

      {/* SUPPLIER CREATE / EDIT FORM MODAL */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Truck size={18} className="text-blue-600" />
                {editingSupplier ? 'Update Supplier Record' : 'Register New Vendor Supplier'}
              </h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Company / Supplier Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g., Ghana Wholesale Beverages Ltd"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +233 24 000 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. sales@wholesaler.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Physical Address / Warehouse Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Plot 42, Industrial Area, Accra"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.name.trim()}
                  className="px-5 py-2 text-xs font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER PURCHASE HISTORY DRAWER / MODAL */}
      {(historySupplier || historyLoading) && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistorySupplier(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 border border-slate-200 shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" />
                  Supplier Purchase Ledger: {historySupplier?.name || 'Loading...'}
                </h2>
                {historySupplier?.contact_person && (
                  <p className="text-xs text-slate-500 font-medium">Contact: {historySupplier.contact_person} ({historySupplier.phone || 'No phone'})</p>
                )}
              </div>
              <button
                onClick={() => setHistorySupplier(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                Loading purchase orders for this supplier...
              </div>
            ) : historyPurchases.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <ShoppingBag size={28} className="mx-auto mb-2 text-slate-300" />
                <div className="font-bold text-slate-700">No Purchase Orders Issued Yet</div>
                <p className="text-xs text-slate-400 mt-1">This vendor has no recorded restock purchase history.</p>
              </div>
            ) : (
              <div className="overflow-y-auto space-y-3 flex-1 pr-1">
                {historyPurchases.map((po) => (
                  <div key={po.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-blue-600">#PO-{po.id}</span>
                        <span className={`px-2 py-0.5 font-bold uppercase rounded text-[10px] ${
                          po.status === 'received' ? 'bg-emerald-100 text-emerald-800' :
                          po.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {po.status || 'Received'}
                        </span>
                      </div>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {new Date(po.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs border-t border-slate-200/60 pt-2">
                      <span className="text-slate-600 font-medium">
                        Issued by: <strong className="text-slate-900">{po.user_name || 'Admin'}</strong>
                      </span>
                      <span className="font-black text-slate-900 text-sm">
                        {formatGHS(po.total_amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">
                Total Orders: {historyPurchases.length}
              </span>
              <button
                onClick={() => setHistorySupplier(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold uppercase"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
