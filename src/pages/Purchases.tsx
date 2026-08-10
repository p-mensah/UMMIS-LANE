import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { Truck } from 'lucide-react';
import { formatGHS } from '../lib/formatters';

export default function Purchases() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [cart, setCart] = useState<any[]>([]);

  const loadData = () => {
    Promise.all([
      fetchApi('/purchases'),
      fetchApi('/suppliers'),
      fetchApi('/products')
    ]).then(([pRes, sRes, prRes]) => {
      setPurchases(pRes);
      setSuppliers(sRes);
      setProducts(prRes);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCheckout = async () => {
    if (cart.length === 0 || !selectedSupplier) {
      alert("Please select a supplier and add items.");
      return;
    }
    const supp = suppliers.find(s => s.name === selectedSupplier);
    try {
      await fetchApi('/purchases', {
        method: 'POST',
        body: JSON.stringify({ 
          supplier_name: selectedSupplier, 
          supplier_contact: supp ? supp.contact_person : '',
          items: cart 
        })
      });
      setShowModal(false);
      setCart([]);
      setSelectedSupplier('');
      loadData();
    } catch(err: any) { alert(err.message); }
  };

  const addToCart = (productId: number, price: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === productId);
      if (existing) {
        return prev.map(i => i.product_id === productId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product_id: productId, quantity: 1, unit_price: price }];
    });
  };

  const handleExportCSV = () => {
    if (purchases.length === 0) return;
    const headers = ['Purchase ID', 'Date', 'Supplier Name', 'Total Cost'];
    const csvRows = [headers.join(',')];

    for (const p of purchases) {
      const row = [
        `PO-${p.id}`,
        `"${new Date(p.created_at + 'Z').toLocaleString()}"`,
        `"${p.supplier_name}"`,
        `"${formatGHS(p.total_amount)}"`,
      ];
      csvRows.push(row.join(','));
    }

    const csvStr = csvRows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `purchase_orders_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Purchase Orders</h1>
        <div className="flex space-x-3">
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-500 text-white rounded-sm font-semibold text-xs border-none hover:bg-blue-600 transition">
            New Purchase
          </button>
          <button onClick={handleExportCSV} disabled={purchases.length === 0} className="px-4 py-2 bg-slate-800 text-white rounded-sm font-semibold text-xs border-none hover:bg-slate-900 transition disabled:opacity-50">
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Purchase ID</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Supplier</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Cost</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {purchases.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 whitespace-nowrap text-[13px] font-medium text-slate-900">#PO-{p.id}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{new Date(p.created_at + 'Z').toLocaleString()}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{p.supplier_name}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] font-bold text-red-500">-{formatGHS(p.total_amount)}</td>
              </tr>
            ))}
            {purchases.length === 0 && !loading && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-[13px]">No purchases recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm max-w-2xl w-full flex overflow-hidden max-h-[80vh] border border-slate-200">
             <div className="w-1/2 flex flex-col border-r border-slate-200">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 font-bold text-[11px] uppercase tracking-wide text-slate-500">Products (to restock)</div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
                  {products.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => addToCart(p.id, p.cost_price)}
                      className="w-full text-left px-4 py-3 bg-white border border-slate-200 rounded-sm hover:-translate-y-0.5 hover:shadow-sm transition-all focus:outline-none focus:border-blue-400"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-800 text-[13px]">{p.name} <span className="text-[10px] text-slate-400 font-mono ml-1">{p.sku}</span></span>
                        <span className="font-bold text-slate-900 text-[13px]">{formatGHS(p.cost_price)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">Current Stock: {p.stock_quantity}</div>
                    </button>
                  ))}
                </div>
             </div>
             
             <div className="w-1/2 flex flex-col bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-[11px] uppercase tracking-wide text-slate-500">New Purchase Order</span>
                </div>
                <div className="flex-1 overflow-y-auto p-5 pb-0">
                   <div className="mb-4">
                     <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Supplier</label>
                     <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500">
                        <option value="">Select a Supplier</option>
                        {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                     </select>
                   </div>
                   {cart.length === 0 ? (
                     <div className="text-center py-10 text-slate-400">
                       <Truck size={32} className="mx-auto mb-2 opacity-50" />
                       <p className="text-[12px]">Order is empty</p>
                     </div>
                   ) : (
                      cart.map((item, idx) => {
                         const product = products.find(p => p.id === item.product_id);
                         return (
                           <div key={idx} className="flex justify-between items-center text-[13px] border-b border-slate-100 pb-2 mb-2">
                             <div className="font-medium text-slate-900">{product?.name} <span className="text-slate-500 ml-2 font-mono bg-slate-50 px-1 py-0.5 rounded-sm">x{item.quantity}</span></div>
                             <div className="font-bold text-slate-900">{formatGHS(item.quantity * item.unit_price)}</div>
                           </div>
                         )
                      })
                   )}
                </div>
                <div className="p-5 border-t border-slate-200 bg-slate-50">
                   <div className="flex justify-between items-center mb-4 text-[16px] font-bold">
                     <span>Total:</span>
                     <span className="text-red-500">{formatGHS(cart.reduce((s, i) => s + (i.quantity * i.unit_price), 0))}</span>
                   </div>
                   <div className="flex space-x-2">
                     <button onClick={() => setShowModal(false)} className="flex-1 py-2 px-4 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-sm hover:bg-slate-50">Cancel</button>
                     <button onClick={handleCheckout} disabled={cart.length === 0 || !selectedSupplier} className="flex-1 py-2 px-4 text-xs font-bold text-white bg-blue-500 border-none rounded-sm hover:bg-blue-600 disabled:opacity-50">Record Purchase</button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
