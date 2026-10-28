import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, X, Package, ShoppingCart, Users, ArrowRight, Clock,
  ExternalLink, Sparkles, Filter, AlertTriangle, CheckCircle2,
  ChevronRight, ArrowUpRight, DollarSign, Tag, Barcode
} from 'lucide-react';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export default function GlobalSearchModal({ isOpen, onClose, initialQuery = '' }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'all' | 'products' | 'sales' | 'customers'>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    products: any[];
    sales: any[];
    customers: any[];
    totalCount: number;
  }>({
    products: [],
    sales: [],
    customers: [],
    totalCount: 0
  });

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('umis_recent_searches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Sync initial query
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // Save query to recents
  const saveRecentSearch = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) return;
    try {
      const updated = [trimmed, ...recentSearches.filter(s => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem('umis_recent_searches', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('umis_recent_searches');
  };

  // Debounced search query against backend /api/search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults({ products: [], sales: [], customers: [], totalCount: 0 });
      setLoading(false);
      setSelectedIndex(-1);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await fetchApi(`/search?q=${encodeURIComponent(trimmed)}&limit=15`);
        setResults({
          products: Array.isArray(data?.products) ? data.products : [],
          sales: Array.isArray(data?.sales) ? data.sales : [],
          customers: Array.isArray(data?.customers) ? data.customers : [],
          totalCount: (data?.products?.length || 0) + (data?.sales?.length || 0) + (data?.customers?.length || 0)
        });
        setSelectedIndex(-1);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Flattened items for keyboard arrow navigation
  const getFlattenedItems = () => {
    const items: Array<{ type: 'product' | 'sale' | 'customer'; data: any }> = [];
    if (activeTab === 'all' || activeTab === 'products') {
      results.products.forEach(p => items.push({ type: 'product', data: p }));
    }
    if (activeTab === 'all' || activeTab === 'sales') {
      results.sales.forEach(s => items.push({ type: 'sale', data: s }));
    }
    if (activeTab === 'all' || activeTab === 'customers') {
      results.customers.forEach(c => items.push({ type: 'customer', data: c }));
    }
    return items;
  };

  const handleSelectFlattened = (item: { type: 'product' | 'sale' | 'customer'; data: any }) => {
    saveRecentSearch(query);
    onClose();
    if (item.type === 'product') {
      navigate(`/products/${item.data.id}`);
    } else if (item.type === 'sale') {
      navigate(`/transactions?id=${item.data.id}`);
    } else if (item.type === 'customer') {
      navigate(`/customers?search=${encodeURIComponent(item.data.name || '')}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const flattened = getFlattenedItems();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < flattened.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : flattened.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < flattened.length) {
        e.preventDefault();
        handleSelectFlattened(flattened[selectedIndex]);
      } else if (flattened.length > 0) {
        e.preventDefault();
        handleSelectFlattened(flattened[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  const flattened = getFlattenedItems();
  const showProducts = (activeTab === 'all' || activeTab === 'products') && results.products.length > 0;
  const showSales = (activeTab === 'all' || activeTab === 'sales') && results.sales.length > 0;
  const showCustomers = (activeTab === 'all' || activeTab === 'customers') && results.customers.length > 0;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-4 sm:my-8 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center gap-3 bg-white">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Search size={20} />
          </div>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products by SKU, name, barcode; sales by ID, customer; accounts..."
              className="w-full text-sm sm:text-base font-semibold text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
            />
          </div>
          {query && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition shrink-0"
          >
            ESC
          </button>
        </div>

        {/* Filter Pills / Tabs */}
        <div className="px-3 sm:px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>All Results</span>
              {results.totalCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'all' ? 'bg-slate-700' : 'bg-slate-100 text-slate-600'}`}>
                  {results.totalCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'products'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Package size={13} />
              <span>Products</span>
              {results.products.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'products' ? 'bg-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                  {results.products.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'sales'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <ShoppingCart size={13} />
              <span>Sales & Receipts</span>
              {results.sales.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'sales' ? 'bg-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {results.sales.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'customers'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Users size={13} />
              <span>Customers</span>
              {results.customers.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'customers' ? 'bg-purple-800' : 'bg-slate-100 text-slate-600'}`}>
                  {results.customers.length}
                </span>
              )}
            </button>
          </div>

          <div className="hidden sm:flex items-center text-[11px] text-slate-400 font-medium shrink-0">
            <span>Use ↑↓ to navigate, ↵ to select</span>
          </div>
        </div>

        {/* Content Body */}
        <div 
          ref={resultsContainerRef} 
          className="max-h-[60vh] sm:max-h-[460px] overflow-y-auto divide-y divide-slate-100 p-2 sm:p-3 custom-scrollbar"
        >
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Searching across products, sales orders, and customer databases...</p>
            </div>
          ) : !query.trim() || query.length < 2 ? (
            /* Idle / Recent Searches State */
            <div className="py-4 px-2 space-y-4">
              {recentSearches.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Clock size={12} /> Recent Searches
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Search size={12} className="text-slate-400" />
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <Search size={18} />
                  </div>
                  <p className="text-xs font-semibold text-slate-600">Type at least 2 characters to search</p>
                  <p className="text-[11px] text-slate-400">Search products by SKU or barcode, receipts by sale number, and customers by phone.</p>
                </div>
              )}

              {/* Quick Navigation Shortcuts */}
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 block">
                  Quick Access
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => { onClose(); navigate('/sales'); }}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex items-center gap-2.5 text-left transition group"
                  >
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                      <ShoppingCart size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">POS Terminal</div>
                      <div className="text-[10px] text-slate-500">Create new sale</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { onClose(); navigate('/products'); }}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 flex items-center gap-2.5 text-left transition group"
                  >
                    <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition">
                      <Package size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Products Catalog</div>
                      <div className="text-[10px] text-slate-500">Manage stock & items</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { onClose(); navigate('/customers'); }}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 flex items-center gap-2.5 text-left transition group"
                  >
                    <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition">
                      <Users size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Customers Ledger</div>
                      <div className="text-[10px] text-slate-500">Balances & loyalty</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : results.totalCount === 0 ? (
            /* No Results */
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 mx-auto flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <p className="text-sm font-bold text-slate-800">No matching records found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No products, transactions, or customers matched "{query}". Try checking the spelling or searching with a different term.
              </p>
            </div>
          ) : (
            /* Search Results Listing */
            <div className="space-y-4 py-2">
              {/* Products Section */}
              {showProducts && (
                <div>
                  <div className="px-2 py-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1.5 text-blue-600">
                      <Package size={13} /> Products ({results.products.length})
                    </span>
                    <button
                      onClick={() => { saveRecentSearch(query); onClose(); navigate(`/products?search=${encodeURIComponent(query)}`); }}
                      className="text-blue-600 hover:underline flex items-center gap-0.5 text-[10px] font-bold"
                    >
                      View all in catalog <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 mt-1">
                    {results.products.map((prod) => {
                      const isLowStock = prod.stock_quantity <= (prod.min_stock_level || 10);
                      const isOut = prod.stock_quantity <= 0;
                      return (
                        <div
                          key={`prod-${prod.id}`}
                          onClick={() => handleSelectFlattened({ type: 'product', data: prod })}
                          className="p-2.5 rounded-xl hover:bg-blue-50/70 transition flex items-center justify-between gap-3 cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {prod.image_url ? (
                              <img 
                                src={prod.image_url} 
                                alt={prod.name} 
                                className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0" 
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs shrink-0">
                                <Package size={16} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 group-hover:text-blue-700 text-xs sm:text-sm truncate">
                                {prod.name}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                                <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-700 font-semibold">{prod.sku}</span>
                                {prod.barcode && <span>• Barcode: {prod.barcode}</span>}
                                {prod.category && <span className="text-slate-400">• {prod.category}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-black text-slate-900 text-xs sm:text-sm">
                                {formatGHS(prod.selling_price || 0)}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full mt-0.5 ${
                                isOut 
                                  ? 'bg-rose-100 text-rose-700' 
                                  : isLowStock 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {isOut ? 'Out of Stock' : `${prod.stock_quantity} in stock`}
                              </span>
                            </div>
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-600 transition" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sales / Transactions Section */}
              {showSales && (
                <div>
                  <div className="px-2 py-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <ShoppingCart size={13} /> Sales Orders & Receipts ({results.sales.length})
                    </span>
                    <button
                      onClick={() => { saveRecentSearch(query); onClose(); navigate('/transactions'); }}
                      className="text-emerald-600 hover:underline flex items-center gap-0.5 text-[10px] font-bold"
                    >
                      View all transactions <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 mt-1">
                    {results.sales.map((sale) => (
                      <div
                        key={`sale-${sale.id}`}
                        onClick={() => handleSelectFlattened({ type: 'sale', data: sale })}
                        className="p-2.5 rounded-xl hover:bg-emerald-50/70 transition flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                            #{sale.id}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 group-hover:text-emerald-700 text-xs sm:text-sm truncate">
                              Sale Order #{sale.id}
                              <span className="text-slate-400 font-normal"> — {sale.customer_name || 'Walk-in Customer'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                              <span className="uppercase text-[10px] font-bold bg-slate-100 px-1.5 py-0.2 rounded text-slate-700">
                                {sale.payment_method || 'CASH'}
                              </span>
                              <span>• Cashier: {sale.user_name || 'Staff'}</span>
                              <span>• {new Date(sale.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-black text-emerald-700 text-xs sm:text-sm">
                              {formatGHS(sale.total_amount || 0)}
                            </span>
                            <span className="text-[10px] text-slate-400">Verified Receipt</span>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-600 transition" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customers Section */}
              {showCustomers && (
                <div>
                  <div className="px-2 py-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1.5 text-purple-600">
                      <Users size={13} /> Customers & Accounts ({results.customers.length})
                    </span>
                    <button
                      onClick={() => { saveRecentSearch(query); onClose(); navigate('/customers'); }}
                      className="text-purple-600 hover:underline flex items-center gap-0.5 text-[10px] font-bold"
                    >
                      View customer ledger <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 mt-1">
                    {results.customers.map((cust) => (
                      <div
                        key={`cust-${cust.id}`}
                        onClick={() => handleSelectFlattened({ type: 'customer', data: cust })}
                        className="p-2.5 rounded-xl hover:bg-purple-50/70 transition flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {(cust.name || 'C').charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 group-hover:text-purple-700 text-xs sm:text-sm truncate">
                              {cust.name}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              {cust.phone && <span>📞 {cust.phone}</span>}
                              {cust.email && <span>✉️ {cust.email}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <div className="flex flex-col items-end">
                            <span className={`font-bold text-xs ${
                              (cust.balance || 0) > 0 ? 'text-rose-600' : 'text-slate-600'
                            }`}>
                              {(cust.balance || 0) > 0 ? `Owes ${formatGHS(cust.balance)}` : 'Balance: ₵0.00'}
                            </span>
                            <span className="text-[10px] text-slate-400">Customer #{cust.id}</span>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-purple-600 transition" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono shadow-2xs">ESC</kbd> to exit</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono shadow-2xs">↵</kbd> to select</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 ml-auto">
            <span>Retail OS Global Directory</span>
          </div>
        </div>
      </div>
    </div>
  );
}
