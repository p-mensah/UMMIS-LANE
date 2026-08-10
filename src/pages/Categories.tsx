import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { Edit, Trash2, Plus, X } from 'lucide-react';

export default function Categories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    fetchApi('/categories').then(setCategories).finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await fetchApi(`/categories/${editingCategory.id}`, { method: 'PUT', body: JSON.stringify({ name, parent_id: parentId || null }) });
      } else {
        await fetchApi('/categories', { method: 'POST', body: JSON.stringify({ name, parent_id: parentId || null }) });
      }
      handleClose();
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const handleEdit = (cat: any) => {
    setEditingCategory(cat);
    setName(cat.name);
    setParentId(cat.parent_id?.toString() || '');
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await fetchApi(`/categories/${id}`, { method: 'DELETE' });
        loadData();
      } catch (err: any) { alert(err.message); }
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingCategory(null);
    setName('');
    setParentId('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Product Categories</h1>
           <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest mt-1">Classification & Organization</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-sm font-bold text-[12px] uppercase tracking-widest hover:bg-slate-800 transition shadow-sm active:scale-95"
        >
          <Plus size={16} className="mr-2" /> Add Category
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">ID</th>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Category Name</th>
              <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {categories.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-[13px] font-mono text-slate-400">#{c.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-[13px] font-bold text-slate-900 uppercase tracking-tight">{c.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right space-x-3">
                  <button onClick={() => handleEdit(c)} className="text-slate-400 hover:text-blue-500 transition-colors"><Edit size={16} /></button>
                  <button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && !loading && (
              <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-500 text-[13px] font-medium italic">No categories found. Click "Add Category" to start.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm max-w-sm w-full p-6 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100">
               <h2 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">{editingCategory ? 'Update Category' : 'New Category'}</h2>
               <button onClick={handleClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Category Label</label>
                <input 
                  required 
                  type="text" 
                  autoFocus
                  className="w-full border border-slate-300 rounded-sm px-4 py-3 text-[13px] focus:outline-none focus:border-blue-500 transition-all shadow-sm" 
                  placeholder="e.g. Beverages, Stationery..."
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Parent Category (Optional)</label>
                <select 
                  className="w-full border border-slate-300 rounded-sm px-4 py-3 text-[13px] focus:outline-none focus:border-blue-500 transition-all shadow-sm" 
                  value={parentId} 
                  onChange={e => setParentId(e.target.value)}
                >
                  <option value="">No Parent</option>
                  {categories.filter(c => c.id !== editingCategory?.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={handleClose} className="flex-1 py-3 text-[11px] font-black uppercase text-slate-400 tracking-widest hover:bg-slate-50 border border-slate-200 rounded-sm transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 text-[11px] font-black uppercase text-white bg-slate-900 rounded-sm hover:bg-blue-600 transition-all shadow-lg active:scale-95">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
