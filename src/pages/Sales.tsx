import React, { useEffect, useState, useRef } from 'react';
import { fetchApi } from '../lib/api';
import { 
  ShoppingCart, Printer, RotateCcw, Search, X, Tag, Minus, Plus, Trash2, 
  Scan, Volume2, VolumeX, Camera, CheckCircle2, AlertCircle, Zap, Sparkles 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatGHS } from '../lib/formatters';

export default function Sales() {
  const { user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [cart, setCart] = useState<{product_id: number, quantity: number, unit_price: number, notes?: string}[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Mobile Money'>('Cash');
  const [recepiptData, setReceiptData] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);

  // Barcode Scanner Integration states
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const mainScanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [startDate, endDate, categoryFilter, paymentFilter, statusFilter]);

  const playBeep = (type: 'success' | 'error' = 'success') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      // Audio autoplay restrictions
    }
  };

  const handleBarcodeScan = (scannedCode: string) => {
    const code = scannedCode.trim();
    if (!code) return;

    const matched = products.find(p => 
      (p.barcode && p.barcode.trim().toLowerCase() === code.toLowerCase()) ||
      (p.sku && p.sku.trim().toLowerCase() === code.toLowerCase()) ||
      (p.id.toString() === code)
    );

    if (matched) {
      if (matched.stock_quantity <= 0) {
        playBeep('error');
        setScanFeedback({ type: 'error', message: `"${matched.name}" is OUT OF STOCK!` });
        return;
      }

      // Check existing quantity in cart
      const existingInCart = cart.find(item => item.product_id === matched.id);
      const currentQty = existingInCart ? existingInCart.quantity : 0;

      if (currentQty + 1 > matched.stock_quantity) {
        playBeep('error');
        setScanFeedback({ type: 'error', message: `Cannot add more. Stock limit reached (${matched.stock_quantity})` });
        return;
      }

      addToCart(matched.id, matched.selling_price);
      playBeep('success');
      setScanFeedback({ type: 'success', message: `Scanned: ${matched.name} — ${formatGHS(matched.selling_price)}` });
      setBarcodeInput('');

      if (!showModal) {
        setShowModal(true);
      }
      
      setTimeout(() => {
        if (scannerInputRef.current) scannerInputRef.current.focus();
      }, 50);
    } else {
      playBeep('error');
      setScanFeedback({ type: 'error', message: `No product found matching SKU or Barcode "${code}"` });
      setBarcodeInput('');
    }
  };

  const handleRefund = async (saleId: number) => {
    const reason = prompt("Enter reason for refund (optional):");
    if (reason !== null && confirm("Are you sure you want to refund this sale? Items will be returned to inventory.")) {
      try {
        await fetchApi(`/sales/${saleId}/refund`, { 
          method: 'POST',
          body: JSON.stringify({ reason })
        });
        loadData();
      } catch (err: any) { alert(err.message); }
    }
  };

  const loadData = async () => {
    try {
      const query = new URLSearchParams();
      if (startDate) query.append('startDate', startDate);
      if (endDate) query.append('endDate', endDate);
      if (categoryFilter) query.append('category', categoryFilter);
      if (paymentFilter) query.append('payment_method', paymentFilter);
      if (statusFilter) query.append('status', statusFilter);

      const [salesRes, prodRes, usersRes, customersRes, categoriesRes] = await Promise.all([
        fetchApi(`/sales?${query.toString()}`),
        fetchApi('/products'),
        fetchApi('/users'),
        fetchApi('/customers'),
        fetchApi('/categories')
      ]);
      setSales(salesRes);
      setProducts(prodRes);
      setUsers(usersRes);
      setCustomers(customersRes);
      setCategories(categoriesRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      const res = await fetchApi('/sales', {
        method: 'POST',
        body: JSON.stringify({ 
          items: cart, 
          customer_id: selectedCustomer ? parseInt(selectedCustomer, 10) : null,
          payment_method: paymentMethod
        })
      });
      setShowConfirmModal(false);
      setShowModal(false);
      setReceiptData({
         saleId: res.saleId,
         items: [...cart],
         total: totalCart,
         date: new Date(),
         customerName: customers.find(c => c.id.toString() === selectedCustomer)?.name || null,
         paymentMethod
      });
      setCart([]);
      setSelectedCustomer('');
      setPaymentMethod('Cash');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReprint = async (saleId: number) => {
    try {
      const sale = await fetchApi(`/sales/${saleId}`);
      setReceiptData({
        saleId: sale.id,
        items: sale.items,
        total: sale.total_amount,
        date: new Date(sale.created_at + 'Z'),
        customerName: sale.customer_name,
        paymentMethod: sale.payment_method
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const addToCart = (productId: number, price: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === productId);
      if (existing) {
        const p = products.find(prod => prod.id === productId);
        if (p && existing.quantity + 1 > p.stock_quantity) {
           alert(`Cannot exceed stock of ${p.stock_quantity}`);
           return prev;
        }
        return prev.map(i => i.product_id === productId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product_id: productId, quantity: 1, unit_price: price }];
    });
  };

  const totalCart = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const handleExportCSV = () => {
    if (sales.length === 0) return;
    const headers = ['Sale ID', 'Date', 'Cashier', 'Payment Method', 'Status', 'Total Amount', 'Transaction Profit'];
    const csvRows = [headers.join(',')];

    for (const s of sales) {
      const row = [
        `SALE-${s.id}`,
        `"${new Date(s.created_at + 'Z').toLocaleString()}"`,
        `"${s.user_name}"`,
        s.payment_method,
        s.status,
        `"${formatGHS(s.total_amount)}"`,
        user?.role === 'admin' ? `"${formatGHS(s.profit || 0)}"` : '',
      ];
      csvRows.push(row.join(','));
    }

    const csvStr = csvRows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Quick Barcode Scanner Header Widget */}
      <div className="bg-slate-900 text-white p-4 rounded-sm border border-slate-800 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-sm shrink-0">
            <Scan size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-black uppercase tracking-widest">Hardware Barcode Scanner Active</h2>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Scan product barcodes or SKUs directly to launch transaction cart instantly.
            </p>
          </div>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (barcodeInput) {
              handleBarcodeScan(barcodeInput);
            }
          }}
          className="flex items-center gap-2 w-full md:w-auto"
        >
          <div className="relative flex-1 md:w-80">
            <input 
              ref={mainScanInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan Barcode / SKU here..."
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-sm pl-9 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
            />
            <Scan size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <button 
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-sm transition-colors shrink-0"
          >
            Scan Item
          </button>
        </form>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Sales Records</h1>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-3 bg-white p-1 rounded-sm border border-slate-200">
             <div className="flex items-center gap-2 px-2 border-l border-slate-100">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Category:</label>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border-none bg-slate-50 px-2 py-1.5 rounded-sm text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/20">
                  <option value="">All Categories</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
             </div>
             <div className="h-4 w-[1px] bg-slate-200 hidden sm:block"></div>
             <div className="flex items-center gap-2 px-2 border-l border-slate-100">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Payment:</label>
                <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="border-none bg-slate-50 px-2 py-1.5 rounded-sm text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/20">
                  <option value="">All</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Mobile Money">MoMo</option>
                </select>
             </div>
             <div className="h-4 w-[1px] bg-slate-200 hidden sm:block"></div>
             <div className="flex items-center gap-2 px-2 border-l border-slate-100">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Status:</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border-none bg-slate-50 px-2 py-1.5 rounded-sm text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/20">
                  <option value="">All</option>
                  <option value="completed">Completed</option>
                  <option value="refunded">Refunded</option>
                </select>
             </div>
             <div className="h-4 w-[1px] bg-slate-200 hidden sm:block"></div>
             <div className="flex items-center gap-2 px-2 border-l border-slate-100">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Period:</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border-none bg-slate-50 px-2 py-1.5 rounded-sm text-xs text-slate-700 focus:outline-none" />
                <span className="text-slate-300 text-xs">-</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border-none bg-slate-50 px-2 py-1.5 rounded-sm text-xs text-slate-700 focus:outline-none" />
             </div>
             {(startDate || endDate || categoryFilter || paymentFilter || statusFilter) && (
               <button 
                 onClick={() => {
                   setStartDate('');
                   setEndDate('');
                   setCategoryFilter('');
                   setPaymentFilter('');
                   setStatusFilter('');
                 }}
                 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest px-3 hover:text-blue-600 transition-colors border-l border-slate-100"
               >
                 Reset
               </button>
             )}
          </div>
          <button onClick={handleExportCSV} disabled={sales.length === 0} className="px-4 py-2 bg-slate-800 text-white rounded-sm font-semibold text-xs border-none hover:bg-slate-900 transition disabled:opacity-50 w-full sm:w-auto">
            Export CSV
          </button>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-500 text-white rounded-sm font-semibold text-xs border-none hover:bg-blue-600 transition w-full sm:w-auto">
            New Sale
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
           <div className="p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Filtered Sales Count</span>
              <span className="text-xl font-bold text-slate-900">{sales.length}</span>
           </div>
           <div className="p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Filtered Total Value</span>
              <span className="text-xl font-bold text-emerald-500">{formatGHS(sales.reduce((sum, s) => sum + s.total_amount, 0))}</span>
           </div>
           {user?.role === 'admin' && (
             <div className="p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Filtered Total Profit</span>
                <span className="text-xl font-bold text-blue-500">{formatGHS(sales.reduce((sum, s) => sum + (s.profit || 0), 0))}</span>
             </div>
           )}
        </div>
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sale ID</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cashier</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payment</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Amount</th>
              {user?.role === 'admin' && <th className="px-5 py-3 text-left text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Transaction Profit</th>}
              <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {sales.map(s => (
              <tr key={s.id} className={s.status === 'refunded' ? 'bg-red-50/50' : ''}>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] font-medium text-slate-900">#SALE-{s.id}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{new Date(s.created_at + 'Z').toLocaleString()}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{s.user_name}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-400 font-medium">{s.payment_method}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px]">
                   {s.status === 'refunded' ? (
                     <div>
                       <span className="text-red-500 font-bold uppercase text-[10px]">Refunded</span>
                       <p className="text-[10px] text-slate-400 mt-0.5 max-w-[150px] truncate" title={s.refund_reason}>{s.refund_reason}</p>
                     </div>
                   ) : <span className="text-emerald-500 font-bold uppercase text-[10px]">Completed</span>}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] font-bold text-slate-900">{formatGHS(s.total_amount)}</td>
                {user?.role === 'admin' && <td className="px-5 py-3 whitespace-nowrap text-[13px] font-bold text-emerald-600">+{formatGHS(s.profit || 0)}</td>}
                <td className="px-5 py-3 whitespace-nowrap text-right space-x-3">
                   <button onClick={() => handleReprint(s.id)} className="text-[12px] text-blue-500 hover:underline inline-flex items-center" title="Reprint Receipt">
                      <Printer size={14} className="mr-1" />
                   </button>
                   {s.status !== 'refunded' && (
                     <button onClick={() => handleRefund(s.id)} className="text-[12px] text-red-500 hover:underline flex items-center inline-flex">
                        <RotateCcw size={14} className="mr-1" /> Refund
                     </button>
                   )}
                </td>
              </tr>
            ))}
            {sales.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-[13px]">No sales found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm max-w-5xl w-full p-6 border border-slate-200 shadow-2xl overflow-y-auto max-h-[95vh]">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center text-white">
                   <ShoppingCart size={18} />
                </div>
                <h2 className="text-[16px] font-black text-slate-900 uppercase tracking-tight">New Sales Session</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Product Selection */}
              <div className="md:col-span-5 space-y-6">
                 <div className="space-y-4">
                    {/* Dedicated Barcode Scanner Box */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm space-y-3">
                       <form 
                         onSubmit={(e) => {
                           e.preventDefault();
                           if (barcodeInput) handleBarcodeScan(barcodeInput);
                         }}
                         className="space-y-2"
                       >
                         <div className="flex items-center justify-between">
                           <label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest text-left flex items-center gap-1.5">
                             <Scan size={14} className="text-blue-600" /> Barcode / SKU Scanner
                           </label>
                           <button 
                             type="button" 
                             onClick={() => setSoundEnabled(!soundEnabled)}
                             className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-full"
                             title="Toggle scan audio beep"
                           >
                             {soundEnabled ? <Volume2 size={12} className="text-emerald-600" /> : <VolumeX size={12} className="text-slate-400" />}
                             {soundEnabled ? 'Beep On' : 'Muted'}
                           </button>
                         </div>

                         <div className="relative group">
                           <input 
                             ref={scannerInputRef}
                             type="text"
                             autoFocus
                             value={barcodeInput}
                             onChange={(e) => setBarcodeInput(e.target.value)}
                             placeholder="Point scanner or type SKU/Barcode & press Enter..."
                             className="w-full border-2 border-blue-500 rounded-sm pl-10 pr-20 py-2.5 text-[13px] font-mono font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 bg-white text-slate-900 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                           />
                           <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 animate-pulse" size={16} />
                           <button 
                             type="submit"
                             className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-sm transition-all shadow-sm"
                           >
                             Scan
                           </button>
                         </div>
                       </form>

                       {/* Realtime Scan Feedback Toast */}
                       {scanFeedback && (
                         <div className={`p-2.5 rounded-sm border text-xs font-bold flex items-center justify-between animate-fadeIn ${
                           scanFeedback.type === 'success' 
                             ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                             : 'bg-red-50 text-red-800 border-red-200'
                         }`}>
                           <div className="flex items-center gap-2">
                             {scanFeedback.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertCircle size={16} className="text-red-600 shrink-0" />}
                             <span className="truncate">{scanFeedback.message}</span>
                           </div>
                           <button onClick={() => setScanFeedback(null)} className="text-slate-400 hover:text-slate-700 shrink-0 ml-2"><X size={14} /></button>
                         </div>
                       )}

                       {/* Interactive Barcode Test Chips */}
                       <div className="pt-1">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Quick Barcode Test Badges:</span>
                         <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                           {products.filter(p => p.stock_quantity > 0).slice(0, 8).map(p => (
                             <button
                               key={p.id}
                               type="button"
                               onClick={() => handleBarcodeScan(p.barcode || p.sku)}
                               className="text-[10px] font-mono font-bold bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 text-slate-700 px-2 py-0.5 rounded border border-slate-200 transition-all flex items-center gap-1 shadow-2xs"
                               title={`Click to scan barcode for ${p.name}`}
                             >
                               <Zap size={10} className="text-amber-500" /> {p.barcode || p.sku}
                             </button>
                           ))}
                         </div>
                       </div>
                    </div>

                    {/* Manual Dropdown Fallback */}
                    <div className="space-y-1">
                       <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Manual Dropdown Search Backup</label>
                       <select 
                         className="w-full border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
                         onChange={(e) => {
                           const pId = parseInt(e.target.value);
                           if (!pId) return;
                           const p = products.find(x => x.id === pId);
                           if (p) {
                             addToCart(p.id, p.selling_price);
                             e.target.value = "";
                           }
                         }}
                       >
                         <option value="">Select from product catalog manually...</option>
                         {products.filter(p => p.stock_quantity > 0).map(p => (
                           <option key={p.id} value={p.id}>{p.name} — SKU: {p.sku} | Barcode: {p.barcode || 'N/A'} ({p.stock_quantity} in stock)</option>
                         ))}
                       </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest text-left mb-1">Customer Selection</label>
                        <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 bg-slate-50">
                          <option value="">Walk-in Customer</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest text-left mb-1">Payment Channel</label>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 bg-slate-50">
                          <option value="Cash">Physical Cash</option>
                          <option value="Card">Bank Card</option>
                          <option value="Mobile Money">MoMo / Digital</option>
                        </select>
                      </div>
                    </div>
                 </div>
              </div>

              {/* Cart Ledger */}
              <div className="md:col-span-7 flex flex-col h-full min-h-[400px]">
                 <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
                    <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Transaction Ledger</h3>
                    <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full font-bold text-slate-500">{cart.length} Items</span>
                 </div>
                 <div className="flex-1 overflow-y-auto border border-slate-100 rounded-sm bg-slate-50/30">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12">
                         <ShoppingCart size={40} strokeWidth={1.5} className="mb-2 opacity-20" />
                         <span className="text-[11px] font-bold uppercase tracking-widest">Cart is currently empty</span>
                      </div>
                    ) : (
                      <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-white sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                            <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</th>
                            <th className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal</th>
                            <th className="px-5 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {cart.map((item, idx) => {
                            const p = products.find(x => x.id === item.product_id);
                            return (
                              <tr key={idx} className="text-[13px] hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-4">
                                   <div className="flex flex-col">
                                      <span className="font-bold text-slate-900">{p?.name}</span>
                                      <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{p?.sku}</span>
                                      <input 
                                        type="text" 
                                        placeholder="Note..." 
                                        className="w-full mt-1 bg-slate-100 border-none rounded px-2 py-0.5 text-[10px] focus:ring-1 focus:ring-blue-500"
                                        value={item.notes || ''}
                                        onChange={(e) => setCart(prev => prev.map(it => it.product_id === item.product_id ? { ...it, notes: e.target.value } : it))}
                                      />
                                      <div className="flex gap-1 mt-1 flex-wrap">
                                         {['Gift Wrap', 'No Bag', 'Discounted'].map(quickNote => (
                                           <button 
                                             key={quickNote}
                                             onClick={() => setCart(prev => prev.map(it => it.product_id === item.product_id ? { ...it, notes: quickNote } : it))}
                                             className="text-[8px] font-black uppercase bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded border border-slate-100 hover:bg-blue-50 hover:text-blue-500 hover:border-blue-100 transition-all"
                                           >
                                             + {quickNote}
                                           </button>
                                         ))}
                                      </div>
                                   </div>
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex items-center space-x-1">
                                    <button onClick={() => {
                                      setCart(prev => prev.map(i => i.product_id === item.product_id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i).filter(i => i.quantity > 0));
                                    }} className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-md text-slate-400 hover:text-red-600 hover:border-red-200 transition-colors"><Minus size={14} /></button>
                                    <span className="w-8 text-center font-black text-slate-700">{item.quantity}</span>
                                    <button onClick={() => addToCart(item.product_id, item.unit_price)} className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-md text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-colors"><Plus size={14} /></button>
                                  </div>
                                </td>
                                <td className="px-5 py-4 text-right font-black text-slate-900">{formatGHS(item.quantity * item.unit_price)}</td>
                                <td className="px-5 py-4 text-right">
                                  <button onClick={() => setCart(prev => prev.filter(i => i.product_id !== item.product_id))} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                 </div>

                 <div className="mt-6 pt-6 border-t-2 border-slate-100">
                    <div className="flex justify-between items-center mb-6 px-2">
                       <span className="text-[12px] font-black text-slate-500 uppercase tracking-[0.2em]">Final Total Due:</span>
                       <span className="text-[32px] font-black text-blue-600 tracking-tight">{formatGHS(totalCart)}</span>
                    </div>
                    <button 
                      onClick={() => setShowConfirmModal(true)} 
                      disabled={cart.length === 0} 
                      className="w-full py-4 bg-slate-900 text-white rounded-sm font-black text-[14px] uppercase tracking-[0.2em] hover:bg-blue-600 shadow-xl shadow-slate-200 hover:shadow-blue-200 transition-all disabled:opacity-20 disabled:shadow-none translate-y-0 active:translate-y-1"
                    >
                      Process Transaction
                    </button>
                    <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4 opacity-50">Validated Transaction Session</p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-sm max-w-sm w-full border border-slate-200 overflow-hidden shadow-2xl relative">
            <div className="p-8 text-center bg-slate-50 border-b border-slate-100">
               <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce hover:animate-none group">
                  <ShoppingCart size={24} className="group-hover:scale-110 transition-transform" />
               </div>
               <h2 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">Verify Transaction</h2>
               <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight mt-1">Final Review Protocol</p>
            </div>
            
            <div className="p-8 space-y-6 text-center">
              <div className="space-y-3">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Purchase Summary</div>
                 <div className="flex flex-col gap-1">
                    {cart.slice(0, 3).map(item => {
                       const p = products.find(prod => prod.id === item.product_id);
                       return <div key={item.product_id} className="text-[12px] font-bold text-slate-600 uppercase italic leading-none">{item.quantity}x {p?.name}</div>;
                    })}
                    {cart.length > 3 && <div className="text-[10px] font-bold text-slate-400 italic">...and {cart.length - 3} more items</div>}
                 </div>
              </div>

              <div className="py-4 border-y border-slate-100 space-y-1">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Expected Settlement</div>
                 <div className="text-3xl font-black text-slate-900">{formatGHS(totalCart)}</div>
                 <div className="text-[11px] font-black text-blue-500 uppercase tracking-[0.1em]">{paymentMethod} Payment Mode</div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={handleCheckout} 
                  className="w-full py-4 bg-slate-900 text-white rounded-sm font-black text-[12px] uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-lg active:scale-95"
                >
                  Checkout
                </button>
                <button 
                  onClick={() => setShowConfirmModal(false)} 
                  className="w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                >
                  Return to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {recepiptData && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-sm w-80 p-6 border border-slate-200 text-center shadow-xl flex flex-col">
            <style>{`@media print { body * { display: none; } #print-area, #print-area * { display: block; } #print-area { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; } }`}</style>
            <div id="print-area" className="text-left font-mono text-[12px] text-slate-800 space-y-3 pb-6 border-b border-dashed border-slate-300">
               <div className="text-center mb-4">
                  <h2 className="font-bold text-[16px] tracking-widest uppercase">Ummis Lane Enterprise</h2>
                  <p className="text-[10px] text-slate-500">Email: Issakrabiat92@gmail.com</p>
                  <p className="text-[10px] text-slate-500">Tel: 0545570191 / 0591369282</p>
                  <p className="text-[10px] text-slate-500">Sale #{recepiptData.saleId}</p>
                  <p className="text-[10px] text-slate-500">{recepiptData.date.toLocaleString()}</p>
                  {recepiptData.customerName && <p className="text-[10px] text-slate-500 border-t border-slate-200 mt-2 pt-1 inline-block">Customer: {recepiptData.customerName}</p>}
               </div>
               <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
                 {recepiptData.items.map((item: any, idx: number) => {
                    const product = products.find(p => p.id === item.product_id);
                    return (
                      <div key={idx} className="flex flex-col mb-1 last:mb-0">
                         <div className="flex justify-between">
                            <span>{product?.name} x{item.quantity}</span>
                            <span>{formatGHS(item.quantity * item.unit_price)}</span>
                         </div>
                         {item.notes && <div className="text-[9px] text-slate-500 italic">Note: {item.notes}</div>}
                      </div>
                    )
                 })}
               </div>
               <div className="flex justify-between font-bold text-[14px]">
                 <span>TOTAL</span>
                 <span>{formatGHS(recepiptData.total)}</span>
               </div>
               <p className="text-center italic text-[10px] pt-4">Thank you for your business!</p>
            </div>
            <div className="flex justify-center space-x-3 mt-6">
              <button onClick={() => setReceiptData(null)} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-sm hover:bg-slate-50">Close</button>
              <button onClick={() => { setReceiptData(null); setShowModal(true); }} className="px-4 py-2 text-xs font-bold text-white bg-blue-600 border-none rounded-sm hover:bg-blue-700">New Sale</button>
              <button onClick={() => window.print()} className="flex items-center px-4 py-2 text-xs font-bold text-white bg-slate-900 border-none rounded-sm hover:bg-slate-800"><Printer size={14} className="mr-2" /> Print Receipt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
