import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Scan, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  X, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  User, 
  Clock, 
  Package, 
  Volume2, 
  VolumeX, 
  ArrowLeft, 
  Hash, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  CornerDownLeft, 
  SlidersHorizontal, 
  Calculator,
  Receipt,
  Maximize2,
  Minimize2,
  Keyboard
} from 'lucide-react';
import { formatGHS } from '../../lib/formatters';
import { soundFeedback } from '../../lib/soundFeedback';
import BarcodeScannerOverlay from './BarcodeScannerOverlay';
import InvoiceModal from '../InvoiceModal';
import PrintPreviewModal from '../PrintPreviewModal';
import OnScreenKeyboard from './OnScreenKeyboard';

export interface CartItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  notes?: string;
}

interface TabletPOSLayoutProps {
  products: any[];
  categories: any[];
  customers: any[];
  user: any;
  onCheckout: (items: CartItem[], customerId: string | null, paymentMethod: string) => Promise<any>;
  onExitTabletMode?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function TabletPOSLayout({
  products,
  categories,
  customers,
  user,
  onCheckout,
  onExitTabletMode,
  onRefresh,
  isLoading = false
}: TabletPOSLayoutProps) {
  // Cart & Transaction States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Mobile Money'>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  
  // On-Screen Virtual Keyboard State for Tablet Mode
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(true);
  
  // Touch Numpad Modal / Drawer State
  const [showNumpadModal, setShowNumpadModal] = useState<boolean>(false);
  const [numpadMode, setNumpadMode] = useState<'tender' | 'quantity'>('tender');
  const [activeCartProductId, setActiveCartProductId] = useState<number | null>(null);
  const [numpadValue, setNumpadValue] = useState<string>('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Scanner & Audio
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Completed sale receipt modal
  const [completedSaleData, setCompletedSaleData] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Responsive Viewport States for zero-sliding fit on any screen size
  const [activeTab, setActiveTab] = useState<'catalog' | 'cart'>('catalog');
  const [isWideScreen, setIsWideScreen] = useState<boolean>(() => 
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsWideScreen(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Time ticker
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Total cart calculation
  const totalCart = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Cash change calculation
  const numericTendered = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, numericTendered - totalCart);

  // 1. Hardware Bluetooth/USB Barcode Scanner Global Key Listener
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is manually typing inside standard inputs or numpad
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName) || showNumpadModal) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 2) {
          const code = bufferRef.current.trim();
          bufferRef.current = '';
          handleBarcodeScanned(code);
        }
        bufferRef.current = '';
        return;
      }

      // Keys in rapid burst (< 90ms) indicates hardware barcode scanner
      if (e.key.length === 1) {
        if (timeDiff > 120) {
          bufferRef.current = '';
        }
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, showNumpadModal]);

  // Add Item to Cart
  const handleAddToCart = (product: any, delta = 1) => {
    if (product.stock_quantity <= 0) {
      if (soundEnabled) soundFeedback.playScanError();
      setScanMessage({ type: 'error', text: `${product.name} is Out of Stock` });
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        if (existing.quantity + delta > product.stock_quantity) {
          if (soundEnabled) soundFeedback.playScanError();
          setScanMessage({ type: 'error', text: `Max stock limit (${product.stock_quantity}) reached` });
          return prev;
        }
        const nextQty = existing.quantity + delta;
        if (nextQty <= 0) {
          return prev.filter(i => i.product_id !== product.id);
        }
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: nextQty } : i);
      } else {
        if (delta <= 0) return prev;
        return [...prev, { product_id: product.id, quantity: delta, unit_price: product.selling_price }];
      }
    });

    if (soundEnabled) soundFeedback.playKeypadClick();
  };

  // Change Item Quantity directly
  const handleUpdateQuantity = (productId: number, newQty: number) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;

    if (newQty <= 0) {
      setCart(prev => prev.filter(i => i.product_id !== productId));
      if (soundEnabled) soundFeedback.playKeypadClick();
      return;
    }

    if (newQty > p.stock_quantity) {
      if (soundEnabled) soundFeedback.playScanError();
      setScanMessage({ type: 'error', text: `Only ${p.stock_quantity} available in stock` });
      return;
    }

    setCart(prev => prev.map(i => i.product_id === productId ? { ...i, quantity: newQty } : i));
    if (soundEnabled) soundFeedback.playKeypadClick();
  };

  // Remove Line Item
  const handleRemoveFromCart = (productId: number) => {
    setCart(prev => prev.filter(i => i.product_id !== productId));
    if (soundEnabled) soundFeedback.playKeypadClick();
  };

  // Update Line Item Note
  const handleUpdateItemNote = (productId: number, note: string) => {
    setCart(prev => prev.map(i => i.product_id === productId ? { ...i, notes: note } : i));
  };

  // Barcode Scanned handler
  const handleBarcodeScanned = (code: string) => {
    const clean = code.trim().toLowerCase();
    const matched = products.find(p => 
      (p.barcode && p.barcode.toLowerCase() === clean) ||
      (p.sku && p.sku.toLowerCase() === clean) ||
      p.name.toLowerCase() === clean
    );

    if (matched) {
      if (soundEnabled) soundFeedback.playScanSuccess();
      handleAddToCart(matched, 1);
      setScanMessage({ type: 'success', text: `Added: ${matched.name} (${formatGHS(matched.selling_price)})` });
    } else {
      if (soundEnabled) soundFeedback.playScanError();
      setScanMessage({ type: 'error', text: `No item found for barcode "${code}"` });
      setSearchQuery(code);
    }

    setTimeout(() => setScanMessage(null), 3000);
  };

  // Quick Cash Tender presets (+10, +20, +50, Exact)
  const applyQuickTender = (amt: number | 'exact') => {
    if (soundEnabled) soundFeedback.playKeypadClick();
    if (amt === 'exact') {
      setCashTendered(totalCart.toFixed(2));
    } else {
      const current = parseFloat(cashTendered) || 0;
      const nextVal = current === 0 ? amt : current + amt;
      setCashTendered(nextVal.toFixed(2));
    }
  };

  // Open Numpad for Custom Cash Tendered
  const openTenderNumpad = () => {
    setNumpadMode('tender');
    setActiveCartProductId(null);
    setNumpadValue(cashTendered || '');
    setShowNumpadModal(true);
  };

  // Open Numpad for Manual Item Quantity / Stock Entry
  const openQuantityNumpad = (productId: number) => {
    const item = cart.find(i => i.product_id === productId);
    setNumpadMode('quantity');
    setActiveCartProductId(productId);
    setNumpadValue(String(item?.quantity || 1));
    setShowNumpadModal(true);
  };

  // Handle Virtual Numpad Press
  const handleNumpadKey = (key: string) => {
    if (soundEnabled) soundFeedback.playKeypadClick();

    if (key === 'CLEAR') {
      setNumpadValue('');
      return;
    }

    if (key === 'BACK') {
      setNumpadValue(prev => prev.slice(0, -1));
      return;
    }

    if (key === '.') {
      if (numpadMode === 'quantity') return; // integer only for quantity
      setNumpadValue(prev => (prev.includes('.') ? prev : (prev || '0') + '.'));
      return;
    }

    if (key === '+10' || key === '+20' || key === '+50') {
      const add = parseInt(key.replace('+', ''), 10);
      const cur = parseFloat(numpadValue) || 0;
      setNumpadValue(String(cur + add));
      return;
    }

    setNumpadValue(prev => (prev === '0' ? key : prev + key).slice(0, 7));
  };

  // Commit Virtual Numpad value
  const handleNumpadConfirm = () => {
    if (soundEnabled) soundFeedback.playKeypadClick();

    if (numpadMode === 'tender') {
      setCashTendered(numpadValue ? parseFloat(numpadValue).toFixed(2) : '');
    } else if (numpadMode === 'quantity' && activeCartProductId !== null) {
      const parsedQty = Math.max(1, parseInt(numpadValue, 10) || 1);
      handleUpdateQuantity(activeCartProductId, parsedQty);
    }

    setShowNumpadModal(false);
  };

  // Complete and Submit Transaction
  const handleProcessSale = async () => {
    if (cart.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await onCheckout(
        cart,
        selectedCustomerId ? selectedCustomerId : null,
        paymentMethod
      );

      if (soundEnabled) soundFeedback.playAdjustmentSuccess();

      // Build sale receipt payload
      const customerObj = customers.find(c => c.id.toString() === selectedCustomerId);
      setCompletedSaleData({
        saleId: result?.saleId || Date.now(),
        id: result?.saleId || Date.now(),
        items: cart.map(item => {
          const prod = products.find(p => p.id === item.product_id);
          return {
            product_id: item.product_id,
            name: prod?.name || 'Item',
            sku: prod?.sku || '',
            quantity: item.quantity,
            unit_price: item.unit_price,
            notes: item.notes
          };
        }),
        total: totalCart,
        total_amount: totalCart,
        amount_paid: paymentMethod === 'Cash' && numericTendered > totalCart ? numericTendered : totalCart,
        change: changeDue,
        created_at: new Date().toISOString(),
        customer_name: customerObj?.name || 'Walk-in Customer',
        customer_phone: customerObj?.phone || null,
        payment_method: paymentMethod,
        user_name: user?.name || 'Cashier'
      });

      // Clear cart for next customer & close keyboard
      setCart([]);
      setCashTendered('');
      setSelectedCustomerId('');
      setPaymentMethod('Cash');
      setIsKeyboardOpen(false);
    } catch (err: any) {
      if (soundEnabled) soundFeedback.playScanError();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Product Grid
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter(p => {
      const matchesSearch = !q || 
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));

      const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory || p.category_name === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, selectedCategory]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-full h-[100dvh] max-h-[100dvh] bg-slate-950 text-slate-100 overflow-hidden select-none touch-manipulation overscroll-none">
      
      {/* ================= 1. REFACTORED HEADER & BREADCRUMB BAR (NO COLLISION) ================= */}
      <header className="h-13 sm:h-14 bg-slate-950 text-slate-200 px-2.5 sm:px-4 flex items-center justify-between shrink-0 border-b border-slate-800 z-20 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {onExitTabletMode && (
            <button
              type="button"
              onClick={onExitTabletMode}
              className="min-h-[42px] flex items-center gap-1.5 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition cursor-pointer font-bold text-xs active:scale-95 shadow-xs shrink-0"
              title="Return to standard dashboard sales table"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Exit POS</span>
            </button>
          )}

          {/* Clean Single Breadcrumb Hierarchy */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <ShoppingCart size={16} />
            </div>
            <div className="min-w-0 hidden xs:block">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                <span>Retail POS</span>
                <span>/</span>
                <span className="text-white font-black truncate">Sales Terminal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Mobile / Compact Segmented Tabs when not wide screen */}
        {!isWideScreen && (
          <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) soundFeedback.playKeypadClick();
                setActiveTab('catalog');
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Catalog
            </button>
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) soundFeedback.playKeypadClick();
                setActiveTab('cart');
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'cart'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingCart size={13} />
              <span>Cart ({totalItemsCount})</span>
              {totalCart > 0 && (
                <span className="font-mono text-[10px] text-emerald-300 ml-0.5">
                  {formatGHS(totalCart)}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Global Controls & Status Cluster (Properly Padded, Zero Collision) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {scanMessage && (
            <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold animate-in fade-in duration-100 ${
              scanMessage.type === 'success' 
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' 
                : 'bg-rose-950 text-rose-300 border border-rose-700'
            }`}>
              <Check size={13} />
              <span className="truncate max-w-[160px]">{scanMessage.text}</span>
            </div>
          )}

          {/* Barcode / Camera Scan Trigger (Min 44px Touch Target) */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="min-h-[42px] px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            title="Scan barcode with camera or bluetooth scanner"
          >
            <Scan size={15} />
            <span className="hidden sm:inline">Scan</span>
          </button>

          {/* On-Screen Keyboard Toggle Button for Tablet Mode */}
          <button
            type="button"
            onClick={() => setIsKeyboardOpen(prev => !prev)}
            className={`min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 ${
              isKeyboardOpen 
                ? 'bg-blue-600 text-white ring-2 ring-blue-400/40 shadow-md' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title={isKeyboardOpen ? 'On-screen keyboard active (click to hide)' : 'Open on-screen keyboard for typing and search'}
          >
            <Keyboard size={16} className={isKeyboardOpen ? 'text-white' : 'text-slate-400'} />
            <span className="hidden md:inline">Keyboard</span>
            <span className={`text-[10px] px-1 py-0.2 rounded font-black uppercase ${
              isKeyboardOpen ? 'bg-blue-800 text-blue-200' : 'bg-slate-700 text-slate-400'
            }`}>
              {isKeyboardOpen ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Audio Feedback Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(prev => !prev)}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title={soundEnabled ? 'Audio sound feedback active' : 'Audio muted'}
          >
            {soundEnabled ? <Volume2 size={16} className="text-emerald-400" /> : <VolumeX size={16} className="text-slate-500" />}
          </button>

          {/* Fullscreen Kiosk Mode Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (Tablet Kiosk)'}
          >
            {isFullscreen ? <Minimize2 size={16} className="text-blue-400" /> : <Maximize2 size={16} />}
          </button>

          {/* Cashier Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold shrink-0">
            <User size={14} className="text-blue-400" />
            <span className="hidden sm:inline truncate max-w-[100px]">{user?.name || 'Cashier'}</span>
          </div>
        </div>
      </header>

      {/* ================= 2. ADAPTIVE VIEWPORT (FITS ALL SCREEN SIZES, NO SLIDING) ================= */}
      <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-800 bg-slate-900">
        
        {/* ================= LEFT SECTION: CATALOG & TOUCH PRODUCTS ================= */}
        <div className={`flex-1 min-w-0 min-h-0 flex flex-col bg-slate-900 text-white p-2.5 sm:p-4 space-y-2.5 sm:space-y-3 overflow-hidden ${
          !isWideScreen && activeTab !== 'catalog' ? 'hidden' : 'flex'
        }`}>
          
          {/* Search Input (Min 48px Touch Height Target) */}
          <div className="space-y-2 shrink-0">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsKeyboardOpen(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Item title, SKU, or Barcode..."
                className="w-full min-h-[48px] bg-slate-800/90 border border-slate-700 rounded-2xl pl-11 pr-11 py-3 text-sm font-semibold text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="min-h-[48px] min-w-[48px] absolute right-0 top-0 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Smooth Touch-Drag / Swipe Category Bar (No Desktop Scrollbars / No Arrows) */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar scroll-smooth overscroll-x-contain touch-pan-x">
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) soundFeedback.playKeypadClick();
                  setSelectedCategory('ALL');
                }}
                className={`min-h-[48px] px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider whitespace-nowrap transition cursor-pointer active:scale-95 shrink-0 ${
                  selectedCategory === 'ALL'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/80'
                }`}
              >
                All Items ({products.length})
              </button>
              {categories.map((c) => {
                const count = products.filter(p => p.category === c.name || p.category_name === c.name).length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (soundEnabled) soundFeedback.playKeypadClick();
                      setSelectedCategory(c.name);
                    }}
                    className={`min-h-[48px] px-5 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition cursor-pointer active:scale-95 shrink-0 ${
                      selectedCategory === c.name
                        ? 'bg-blue-600 text-white font-black shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/80'
                    }`}
                  >
                    {c.name} {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Touch Grid (Min 48px Buttons, Distinct High-Contrast Stock Status Badges) */}
          <div className={`flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0 ${isKeyboardOpen ? 'pb-72 sm:pb-80' : 'pb-16'}`}>
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500 space-y-3">
                <Package size={40} className="opacity-30" />
                <p className="text-sm font-bold text-slate-400">No items match your search filter</p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); }}
                  className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold rounded-xl"
                >
                  Clear Search Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredProducts.map((p) => {
                  const cartItem = cart.find(i => i.product_id === p.id);
                  const isOutOfStock = p.stock_quantity <= 0;
                  const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_level || 5);

                  return (
                    <div
                      key={p.id}
                      onClick={() => !isOutOfStock && handleAddToCart(p, 1)}
                      className={`relative min-h-[110px] p-3 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer active:scale-98 select-none ${
                        isOutOfStock
                          ? 'bg-slate-800/40 border-slate-800/80 opacity-45 grayscale-[40%] cursor-not-allowed'
                          : cartItem
                            ? 'bg-slate-800 border-blue-500 ring-2 ring-blue-500/40 shadow-lg'
                            : 'bg-slate-800/90 border-slate-700 hover:border-slate-500 hover:bg-slate-800 shadow-xs'
                      }`}
                    >
                      {/* Top Bar: SKU & Active Cart Count Indicator */}
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-mono text-[10px] text-slate-400 font-bold truncate">
                          {p.sku || `#${p.id}`}
                        </span>

                        {cartItem && (
                          <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-mono font-black text-[11px] shadow-sm animate-in zoom-in-75">
                            x{cartItem.quantity}
                          </span>
                        )}
                      </div>

                      {/* Product Name (Bold & Crisp) */}
                      <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-tight my-1.5">
                        {p.name}
                      </h4>

                      {/* Bottom Bar: Price & Stock Status Badges */}
                      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-700/60">
                        <span className="text-xs sm:text-sm font-mono font-black text-emerald-400">
                          {formatGHS(p.selling_price)}
                        </span>

                        {/* Distinct High-Contrast Stock Badge */}
                        {isOutOfStock ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-800 font-black text-[10px] uppercase tracking-wide">
                            Out of stock
                          </span>
                        ) : isLowStock ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wide shadow-2xs">
                            {p.stock_quantity} left
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-700 text-slate-300 font-bold text-[10px]">
                            {p.stock_quantity} in stock
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Order Cart Bar on narrow screens */}
          {!isWideScreen && totalItemsCount > 0 && (
            <div className="shrink-0 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) soundFeedback.playKeypadClick();
                  setActiveTab('cart');
                }}
                className="w-full min-h-[46px] px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-between shadow-lg active:scale-98 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart size={16} />
                  <span>View Order Cart ({totalItemsCount} items)</span>
                </div>
                <span className="font-mono text-sm font-bold">{formatGHS(totalCart)} →</span>
              </button>
            </div>
          )}
        </div>

        {/* ================= RIGHT SECTION: CART & ENHANCED PAYMENT PANE ================= */}
        <div className={`w-full md:w-[380px] lg:w-[420px] xl:w-[450px] shrink-0 flex flex-col min-h-0 bg-slate-950 p-2.5 sm:p-3.5 space-y-2 sm:space-y-2.5 border-t md:border-t-0 md:border-l border-slate-800 overflow-hidden text-white ${
          !isWideScreen && activeTab !== 'cart' ? 'hidden' : 'flex'
        }`}>
          
          {/* Back to Catalog button when on narrow screens */}
          {!isWideScreen && (
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) soundFeedback.playKeypadClick();
                setActiveTab('catalog');
              }}
              className="w-full min-h-[38px] px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 border border-slate-800 active:scale-98 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Continue Adding Products</span>
            </button>
          )}

          {/* Customer Selection Row */}
          <div className="shrink-0 flex items-center justify-between gap-2 bg-slate-900 p-2.5 rounded-2xl border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-xs shrink-0">
              <User size={15} className="text-blue-400" />
              <span>Customer:</span>
            </div>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="flex-1 min-h-[38px] bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">Walk-in Customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) soundFeedback.playKeypadClick();
                  setCart([]);
                  setCashTendered('');
                }}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-500 hover:text-rose-400 rounded-xl transition cursor-pointer"
                title="Clear entire cart"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {/* Cart Items List: Direct Quantity Steppers, Notes, and Clear Item Trash */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/90 bg-slate-900 rounded-2xl border border-slate-800 p-2 custom-scrollbar min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-slate-500 text-center space-y-2.5">
                <ShoppingCart size={36} strokeWidth={1.5} className="opacity-30" />
                <p className="text-xs font-bold text-slate-400">Cart is empty</p>
                <p className="text-[11px] text-slate-500">Tap items on the left or scan barcode to add</p>
              </div>
            ) : (
              cart.map((item) => {
                const p = products.find(prod => prod.id === item.product_id);
                const lineTotal = item.quantity * item.unit_price;

                return (
                  <div key={item.product_id} className="py-2.5 px-1.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <h5 className="font-bold text-white text-xs truncate leading-tight">
                          {p?.name || 'Product'}
                        </h5>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                          <span className="text-emerald-400 font-bold">{formatGHS(item.unit_price)}</span>
                          <span>•</span>
                          <span>Subtotal: <strong className="text-slate-200">{formatGHS(lineTotal)}</strong></span>
                        </div>
                      </div>

                      {/* Direct Touch Stepper (+ / - / Tap-for-Numpad) */}
                      <div className="flex items-center gap-1 shrink-0 bg-slate-800 rounded-xl p-1 border border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleAddToCart(p, -1)}
                          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg active:scale-95 cursor-pointer font-bold"
                          title="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openQuantityNumpad(item.product_id)}
                          className="w-9 h-8 flex items-center justify-center text-center font-mono font-black text-blue-400 text-xs hover:bg-blue-900/40 rounded-lg cursor-pointer transition"
                          title="Tap to type custom quantity on numpad"
                        >
                          {item.quantity}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddToCart(p, 1)}
                          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg active:scale-95 cursor-pointer font-bold"
                          title="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      {/* Direct Clear-Item Trash Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.product_id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                        title="Remove item from order"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Line-Item Note Field */}
                    <input
                      type="text"
                      placeholder="Add customer / discount note..."
                      value={item.notes || ''}
                      onChange={(e) => handleUpdateItemNote(item.product_id, e.target.value)}
                      className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Summary Banner */}
          <div className="shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Items Total ({totalItemsCount} units)</span>
              <span className="font-mono text-slate-200">{formatGHS(totalCart)}</span>
            </div>

            <div className="flex items-center justify-between text-base font-black text-white pt-1.5 border-t border-slate-800">
              <span className="uppercase tracking-wider text-xs font-bold text-slate-300">Total Due</span>
              <span className="font-mono text-2xl text-emerald-400 font-black">
                {formatGHS(totalCart)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector (Min 48px Touch Targets) - STRICTLY CASH & MOMO ONLY */}
          <div className="shrink-0 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              {[
                { id: 'Cash', label: 'Cash', icon: <Banknote size={16} /> },
                { id: 'Mobile Money', label: 'MoMo', icon: <Smartphone size={16} /> },
              ].map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    if (soundEnabled) soundFeedback.playKeypadClick();
                    setPaymentMethod(mode.id as any);
                  }}
                  className={`min-h-[48px] p-2 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                    paymentMethod === mode.id
                      ? 'bg-blue-600 text-white font-black shadow-md ring-2 ring-blue-400/40'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {mode.icon}
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>

            {/* Quick-Cash Buttons Wrapped/Scaled Correctly Without Horizontal Clipping */}
            {paymentMethod === 'Cash' && totalCart > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 space-y-2">
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyQuickTender('exact')}
                    className="min-h-[44px] px-2 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-black uppercase tracking-wider flex items-center justify-center text-center active:scale-95"
                    title="Exact cash tendered"
                  >
                    Exact
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickTender(10)}
                    className="min-h-[44px] px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center active:scale-95"
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickTender(20)}
                    className="min-h-[44px] px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center active:scale-95"
                  >
                    +20
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickTender(50)}
                    className="min-h-[44px] px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center active:scale-95"
                  >
                    +50
                  </button>
                </div>

                {/* Second row of quick cash & custom numpad trigger */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyQuickTender(100)}
                    className="min-h-[42px] px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center active:scale-95"
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickTender(200)}
                    className="min-h-[42px] px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center active:scale-95"
                  >
                    +200
                  </button>
                  <button
                    type="button"
                    onClick={openTenderNumpad}
                    className="min-h-[42px] px-2 py-1 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/50 text-xs font-black flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Calculator size={14} /> Custom
                  </button>
                </div>

                {/* Tendered Input & Dynamic Change Due */}
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800 font-mono">
                  <div className="flex items-center gap-1 text-slate-400">
                    <span>Tendered:</span>
                    <span className="text-white font-bold">
                      {cashTendered ? formatGHS(numericTendered) : '---'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 font-bold">
                    <span className="text-slate-400">Change Due:</span>
                    <span className={`font-black text-sm ${numericTendered >= totalCart ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {formatGHS(changeDue)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Big Instant "CHARGE / COMPLETE SALE" Button (Min 54px Target) */}
          <button
            type="button"
            disabled={cart.length === 0 || isSubmitting}
            onClick={handleProcessSale}
            className={`w-full min-h-[54px] rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg active:scale-98 ${
              cart.length === 0 || isSubmitting
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 ring-2 ring-emerald-500/50'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing Sale...</span>
              </div>
            ) : (
              <>
                <Check size={20} strokeWidth={3} />
                <span>Charge {formatGHS(totalCart)}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ================= 3. TOUCH-FRIENDLY VIRTUAL NUMPAD DRAWER / MODAL ================= */}
      {showNumpadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Numpad Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Calculator size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {numpadMode === 'tender' ? 'Custom Cash Tendered' : 'Set Line Item Quantity'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Touchpad rapid entry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNumpadModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-white rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            {/* Display Screen */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-right">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">
                {numpadMode === 'tender' ? 'Amount (GH₵)' : 'Units Count'}
              </span>
              <span className="font-mono text-3xl font-black text-emerald-400">
                {numpadValue || '0'}
              </span>
            </div>

            {/* 4x3 Keypad Matrix */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleNumpadKey(d)}
                  className="min-h-[52px] bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-white font-mono text-xl font-black rounded-xl active:scale-95 shadow-xs cursor-pointer"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleNumpadKey('CLEAR')}
                className="min-h-[52px] bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-black uppercase rounded-xl active:scale-95 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleNumpadKey('0')}
                className="min-h-[52px] bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-white font-mono text-xl font-black rounded-xl active:scale-95 shadow-xs cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleNumpadKey('BACK')}
                className="min-h-[52px] bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-base font-bold rounded-xl active:scale-95 cursor-pointer flex items-center justify-center"
              >
                ⌫
              </button>
            </div>

            {/* Commit & Close Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNumpadModal(false)}
                className="min-h-[48px] border border-slate-700 text-slate-300 font-bold text-xs uppercase rounded-xl hover:bg-slate-800 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNumpadConfirm}
                className="min-h-[48px] bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase rounded-xl active:scale-95 shadow-md flex items-center justify-center gap-1.5"
              >
                <Check size={16} />
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode & Camera Scanner Overlay Modal */}
      <BarcodeScannerOverlay
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanResult={handleBarcodeScanned}
        title="POS Barcode Scanner"
      />

      {/* On-Screen Virtual Keyboard for Tablet Mode: Strictly bounded to catalog section so it NEVER affects the payment side */}
      <OnScreenKeyboard
        isOpen={isKeyboardOpen && !completedSaleData && !showNumpadModal && !isScannerOpen && activeTab === 'catalog'}
        value={searchQuery}
        onChange={setSearchQuery}
        onSubmit={() => setIsKeyboardOpen(false)}
        onClose={() => setIsKeyboardOpen(false)}
        title="Tablet Search"
        placeholder="Type item title, SKU, or barcode..."
        soundEnabled={soundEnabled}
        className="md:right-[380px] lg:right-[420px] xl:right-[450px] border-r border-slate-800"
      />

      {/* Floating Keyboard Pill when closed: repositioned strictly to the bottom-LEFT so it NEVER touches the Charge button or payment side */}
      {!isKeyboardOpen && !completedSaleData && !showNumpadModal && !isScannerOpen && activeTab === 'catalog' && (
        <button
          type="button"
          onClick={() => {
            if (soundEnabled) soundFeedback.playKeypadClick();
            setIsKeyboardOpen(true);
          }}
          className="fixed bottom-4 left-4 z-30 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-3.5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold transition-all active:scale-95 cursor-pointer border border-blue-400/40 no-print"
          title="Open On-Screen Keyboard"
        >
          <Keyboard size={18} />
          <span>Keyboard</span>
        </button>
      )}

      {/* Reusable Print Preview Modal upon Completed Sale */}
      {completedSaleData && (
        <PrintPreviewModal
          isOpen={Boolean(completedSaleData)}
          receiptData={completedSaleData}
          initialFormat="receipt"
          onClose={() => setCompletedSaleData(null)}
        />
      )}
    </div>
  );
}
