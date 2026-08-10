import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import { ArrowLeft, History, Package, Tag, CreditCard, DollarSign, AlertTriangle, Printer } from 'lucide-react';

interface Adjustment {
  id: number;
  reason: string;
  quantity_change: number;
  created_at: string;
  user_name: string;
}

interface PriceHistory {
  id: number;
  old_selling_price: number;
  new_selling_price: number;
  changed_at: string;
}

interface ProductDetails {
  id: number;
  name: string;
  sku: string;
  category: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  brand: string;
  unit_of_measure: string;
  image_url?: string;
  adjustments: Adjustment[];
  priceHistory: PriceHistory[];
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchApi(`/products/${id}`),
      fetchApi(`/products/${id}/price-history`)
    ])
      .then(([prod, history]) => {
         setProduct({ ...prod, priceHistory: history });
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading product details...</div>;
  if (!product) return <div className="p-8 text-center text-red-500">Product not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/products')}
          className="flex items-center text-[13px] font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest"
        >
          <ArrowLeft size={16} className="mr-2" /> Back to Products
        </button>
        <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              product.stock_quantity <= 5 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
            }`}>
              {product.stock_quantity <= 5 ? 'Low Stock' : 'In Stock'}
            </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Info Card */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-sm p-8 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-6">
                {product.image_url && (
                    <img src={product.image_url} alt={product.name} className="w-24 h-24 object-cover rounded-sm border border-slate-200" />
                )}
                <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">{product.name}</h1>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center"><Tag size={12} className="mr-1" /> {product.category}</span>
                  <span className="flex items-center"><Package size={12} className="mr-1" /> SKU: {product.sku}</span>
                  <span className="flex items-center">{product.brand}</span>
                  <span className="flex items-center">UOM: {product.unit_of_measure}</span>
                  {product.barcode && <span className="flex items-center">Barcode: {product.barcode}</span>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Stock</div>
              <div className="text-4xl font-black text-blue-600">{product.stock_quantity}</div>
            </div>
          </div>

            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-100">
               <div>
                 <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                   <CreditCard size={14} className="text-slate-300" /> Financial Overview
                 </div>
                 <div className="space-y-4">
                   <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                     <span className="text-[13px] text-slate-500 font-medium">Cost Price</span>
                     <span className="text-[16px] font-bold text-slate-900">{formatGHS(product.cost_price)}</span>
                   </div>
                   <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                     <span className="text-[13px] text-slate-500 font-medium">Selling Price</span>
                     <span className="text-[16px] font-bold text-slate-900">{formatGHS(product.selling_price)}</span>
                   </div>
                   <div className="flex justify-between items-end">
                     <span className="text-[13px] text-slate-500 font-medium">Margin</span>
                     <span className="text-[16px] font-black text-emerald-600">
                        {Math.round(((product.selling_price - product.cost_price) / product.selling_price) * 100)}%
                     </span>
                   </div>
                 </div>
               </div>

               <div>
                 <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                   <DollarSign size={14} className="text-slate-300" /> Inventory Value
                 </div>
                 <div className="bg-slate-50 rounded-sm p-4 text-center">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Asset Value</div>
                    <div className="text-2xl font-black text-slate-900">{formatGHS(product.stock_quantity * product.cost_price)}</div>
                    <div className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">Potential Revenue: {formatGHS(product.stock_quantity * product.selling_price)}</div>
                 </div>
               </div>
            </div>
          </div>

           <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <History size={16} className="text-slate-400" />
              <h2 className="text-[12px] font-black text-slate-600 uppercase tracking-widest">Stock Adjustment History</h2>
            </div>
            <table className="min-w-full divide-y divide-slate-100">
               <tbody className="divide-y divide-slate-100">
                 {product.adjustments.map((adj) => (
                   <tr key={adj.id} className="text-[12px] hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 font-mono">{new Date(adj.created_at + 'Z').toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-slate-600">{adj.reason}</td>
                      <td className={`px-6 py-4 text-right font-bold ${adj.quantity_change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                      </td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <CreditCard size={16} className="text-slate-400" />
              <h2 className="text-[12px] font-black text-slate-600 uppercase tracking-widest">Price Change History</h2>
            </div>
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Old Price</th>
                  <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">New Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {product.priceHistory.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-[12px] text-slate-400 font-medium italic">No price changes recorded</td>
                  </tr>
                ) : (
                  product.priceHistory.map((ph) => (
                    <tr key={ph.id} className="text-[12px] hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 font-mono">{new Date(ph.changed_at + 'Z').toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-600">{formatGHS(ph.old_selling_price)}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">{formatGHS(ph.new_selling_price)}</td>
                    </tr>
                  ))
                )}
               </tbody>
            </table>
           </div>
        </div>

        {/* Sidebar Tips/Actions */}
        <div className="space-y-6">
           <div className="bg-blue-600 text-white rounded-sm p-6 shadow-xl shadow-blue-100">
              <div className="flex items-center gap-2 mb-4">
                 <AlertTriangle size={20} className="text-blue-200" />
                 <h3 className="text-[14px] font-black uppercase tracking-widest">Quick Actions</h3>
              </div>
              <p className="text-[12px] text-blue-100 mb-6 leading-relaxed">
                Manage this product's inventory levels or update pricing information from here.
              </p>
              <button 
                onClick={() => navigate('/products')}
                className="w-full py-3 bg-white text-blue-600 rounded-sm font-black text-[11px] uppercase tracking-widest hover:bg-blue-50 transition-colors mb-3"
                id="edit-product-btn"
              >
                Edit Product Details
              </button>
              <button 
                onClick={() => setShowPrintModal(true)}
                className="w-full py-3 bg-blue-700 text-white rounded-sm font-black text-[11px] uppercase tracking-widest hover:bg-blue-800 transition-colors flex items-center justify-center p-2"
                id="print-product-info-btn"
              >
                <Printer size={14} className="mr-2" /> Print Info
              </button>
           </div>

           <div className="bg-slate-100 rounded-sm p-6">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4">Inventory Insights</h4>
              <ul className="space-y-3">
                 <li className="flex gap-3 text-[12px] text-slate-600 leading-tight">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0"></span>
                    Adjustments are permanent records used for auditing.
                 </li>
                 <li className="flex gap-3 text-[12px] text-slate-600 leading-tight">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0"></span>
                    Sales automatically decrement this product's stock levels.
                 </li>
              </ul>
           </div>
        </div>
      </div>

      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-sm w-96 p-8 border border-slate-200 text-center shadow-xl flex flex-col">
            <style>{`@media print { body * { display: none; } #print-area, #print-area * { display: block; } #print-area { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; padding: 20px; } }`}</style>
            <div id="print-area" className="text-left font-mono text-[14px] text-slate-800 space-y-4">
               <div className="text-center mb-6 pb-4 border-b border-dashed border-slate-300">
                  <h2 className="font-black text-[18px] tracking-widest uppercase">Ummis Lane Ent.</h2>
                  <p className="text-[11px] text-slate-500 mt-1 uppercase font-bold tracking-tight">Product Information Sheet</p>
               </div>
               
               <div className="space-y-4">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Product Name</div>
                    <div className="text-[16px] font-black uppercase text-slate-900">{product.name}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">SKU</div>
                      <div className="font-bold text-slate-900">{product.sku}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Barcode</div>
                      <div className="font-bold text-slate-900">{product.barcode || 'N/A'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Selling Price</div>
                      <div className="text-[16px] font-black text-slate-900">{formatGHS(product.selling_price)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Cost Price</div>
                      <div className="text-[16px] font-black text-slate-900">{formatGHS(product.cost_price)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Current Stock</div>
                      <div className="text-[16px] font-black text-blue-600">{product.stock_quantity}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Brand</div>
                    <div className="font-bold text-slate-900">{product.brand}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Unit of Measure</div>
                    <div className="font-bold text-slate-900">{product.unit_of_measure}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Category</div>
                    <div className="font-bold text-slate-900 uppercase">{product.category}</div>
                  </div>
               </div>

               <div className="pt-8 border-t border-dashed border-slate-300 text-center opacity-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest">System Generated: {new Date().toLocaleString()}</p>
               </div>
            </div>

            <div className="flex justify-center space-x-3 mt-8">
              <button onClick={() => setShowPrintModal(false)} className="flex-1 py-3 text-[11px] font-black uppercase text-slate-400 tracking-widest hover:bg-slate-50 border border-slate-200 rounded-sm transition-colors">Cancel</button>
              <button 
                onClick={() => window.print()} 
                className="flex-1 flex items-center justify-center py-3 bg-slate-900 text-white rounded-sm font-black text-[11px] uppercase tracking-widest hover:bg-blue-600 shadow-lg transition-all"
              >
                <Printer size={14} className="mr-2" /> Start Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
