import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Scan, 
  MapPin, 
  Boxes, 
  Calendar, 
  Layers, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  Filter, 
  RefreshCw, 
  SlidersHorizontal,
  ChevronRight,
  Package,
  Barcode,
  Truck,
  Edit2,
  Check,
  Building2,
  Eye,
  X
} from 'lucide-react';
import type { TabletInventoryItem, StockStatus, QuickAdjustmentAudit } from '../../types/tablet';
import TouchStockAdjuster from './TouchStockAdjuster';
import BarcodeScannerOverlay from './BarcodeScannerOverlay';
import { formatGHS } from '../../lib/formatters';
import { soundFeedback } from '../../lib/soundFeedback';

interface TabletInventoryLayoutProps {
  products: any[];
  categories: any[];
  onCommitAdjustment: (productId: number, delta: number, newStock: number, reason: string) => Promise<void>;
  onRefresh: () => void;
  isLoading?: boolean;
}

export default function TabletInventoryLayout({
  products,
  categories,
  onCommitAdjustment,
  onRefresh,
  isLoading = false
}: TabletInventoryLayoutProps) {
  // Normalize items to include tablet inventory fields
  const inventoryItems: TabletInventoryItem[] = useMemo(() => {
    return products.map((p) => {
      // Deterministic warehouse bin location based on category and SKU
      const catCode = (p.category || 'GEN').slice(0, 3).toUpperCase();
      const aisle = (p.id % 6) + 1;
      const shelf = ['A', 'B', 'C', 'D'][p.id % 4];
      const binNum = (p.id * 7) % 50 + 1;
      const defaultBin = `Aisle ${aisle} • Shelf ${shelf} • Bin ${binNum}`;

      return {
        ...p,
        bin_location: p.bin_location || defaultBin,
        zone: `Zone ${catCode}`,
        shelf: `Bay-${shelf}`,
        batch_number: p.batch_number || `LOT-${new Date().getFullYear()}-${p.id + 100}`,
        expiry_date: p.expiry_date || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
        last_counted_at: p.last_counted_at || new Date().toISOString()
      };
    });
  }, [products]);

  // State
  const [selectedItemId, setSelectedItemId] = useState<number | null>(inventoryItems[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | StockStatus>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [adjustmentLogs, setAdjustmentLogs] = useState<QuickAdjustmentAudit[]>([]);
  const [isEditingBin, setIsEditingBin] = useState(false);
  const [tempBinLocation, setTempBinLocation] = useState('');
  const [customBins, setCustomBins] = useState<Record<number, string>>({});
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState('Main Shelf Aisle 1');

  // Currently selected item
  const selectedItem = useMemo(() => {
    const item = inventoryItems.find(i => i.id === selectedItemId) || inventoryItems[0] || null;
    if (item && customBins[item.id]) {
      return { ...item, bin_location: customBins[item.id] };
    }
    return item;
  }, [inventoryItems, selectedItemId, customBins]);

  // Keep selection valid
  useEffect(() => {
    if (!selectedItemId && inventoryItems.length > 0) {
      setSelectedItemId(inventoryItems[0].id);
    }
  }, [inventoryItems, selectedItemId]);

  // Helper for stock status
  const getItemStatus = (item: TabletInventoryItem): StockStatus => {
    if (item.stock_quantity <= 0) return 'out_of_stock';
    const thresh = item.min_stock_level ?? 10;
    if (item.stock_quantity <= thresh) return 'low_stock';
    return 'in_stock';
  };

  // Filtered List for Left Column
  const filteredItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.bin_location && item.bin_location.toLowerCase().includes(q));

      const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

      const status = getItemStatus(item);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [inventoryItems, searchQuery, selectedCategory, statusFilter]);

  // Barcode Scan Handler
  const handleBarcodeScan = (scannedCode: string) => {
    const clean = scannedCode.trim().toLowerCase();
    const matched = inventoryItems.find(i => 
      (i.barcode && i.barcode.toLowerCase() === clean) ||
      i.sku.toLowerCase() === clean ||
      i.name.toLowerCase().includes(clean)
    );

    if (matched) {
      soundFeedback.playScanSuccess();
      setSelectedItemId(matched.id);
    } else {
      soundFeedback.playScanError();
      setSearchQuery(scannedCode);
    }
  };

  // Stock Adjustment Dispatcher
  const handleStockAdjustCommit = async (delta: number, newStock: number, reason: string) => {
    if (!selectedItem) return;
    await onCommitAdjustment(selectedItem.id, delta, newStock, reason);

    const logEntry: QuickAdjustmentAudit = {
      id: `TA-${Date.now()}`,
      productId: selectedItem.id,
      productName: selectedItem.name,
      delta,
      newQuantity: newStock,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reason,
      performedBy: 'Tablet Associate'
    };

    setAdjustmentLogs(prev => [logEntry, ...prev.slice(0, 9)]);
  };

  const handleSaveBinLocation = () => {
    if (selectedItem && tempBinLocation.trim()) {
      setCustomBins(prev => ({
        ...prev,
        [selectedItem.id]: tempBinLocation.trim()
      }));
      setIsEditingBin(false);
      soundFeedback.playKeypadClick();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 select-none touch-manipulation">
      {/* Tablet Top Operational Toolbar */}
      <div className="bg-slate-900 text-white px-4 py-3 shrink-0 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black shadow-xs">
            <Boxes size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-tight text-white uppercase">Tablet Mode • Floor Inventory</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase">
                Touch Live
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Physical stock takes, bin transfers & barcode audits</p>
          </div>
        </div>

        {/* Global Hardware & Barcode Trigger */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            title="Scan product barcode with device camera or bluetooth scanner"
          >
            <Scan size={18} />
            <span className="hidden sm:inline">Scan Barcode / QR</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="min-h-[44px] p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer active:scale-95"
            title="Refresh inventory sync"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Adaptive 2-Column Architecture (768px – 1024px tablet grid) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
        {/* LEFT COLUMN: Searchable Stock Inventory List (5 Cols on Tablet) */}
        <div className="md:col-span-5 lg:col-span-4 flex flex-col min-h-0 bg-white border-r border-slate-200">
          {/* Search Bar & Instant Clear */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Item, SKU, Barcode, Bin..."
                className="w-full min-h-[44px] pl-10 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 custom-scrollbar text-[11px] font-bold">
              {[
                { id: 'all', label: `All (${inventoryItems.length})` },
                { id: 'low_stock', label: 'Low Stock' },
                { id: 'out_of_stock', label: 'Out of Stock' },
                { id: 'in_stock', label: 'In Stock' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    soundFeedback.playKeypadClick();
                    setStatusFilter(tab.id as any);
                  }}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg whitespace-nowrap transition cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-slate-900 text-white font-black shadow-2xs'
                      : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Category Dropdown Selector */}
            <div className="flex items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full min-h-[36px] bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Categories ({categories.length})</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Searchable Scrollable Product List (Generous Touch Targets) */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Package size={32} className="mx-auto opacity-30" />
                <p className="text-xs font-bold text-slate-600">No items match your filter</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                    setStatusFilter('all');
                  }}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold rounded-lg text-xs"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const status = getItemStatus(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      soundFeedback.playKeypadClick();
                      setSelectedItemId(item.id);
                    }}
                    className={`min-h-[72px] p-3 sm:p-3.5 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-50/90 border-l-4 border-l-blue-600'
                        : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-black text-slate-500">{item.sku}</span>
                        <span className="text-[10px] text-slate-400">• {item.category}</span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-0.5">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 truncate text-slate-600">
                          <MapPin size={11} className="text-blue-600 shrink-0" />
                          <span className="truncate">{customBins[item.id] || item.bin_location}</span>
                        </span>
                      </div>
                    </div>

                    {/* Stock level badge */}
                    <div className="text-right shrink-0">
                      <div className="text-base font-mono font-black text-slate-900">
                        {item.stock_quantity}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase mt-0.5 ${
                        status === 'out_of_stock'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : status === 'low_stock'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {status === 'out_of_stock' ? 'Out' : status === 'low_stock' ? 'Low' : 'In Stock'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN / MAIN PANE: Detailed Item View, Touch Adjuster & Bin Mapping (7-8 Cols) */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col min-h-0 bg-slate-50 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
          {selectedItem ? (
            <>
              {/* Product Header Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-xs font-black">
                        {selectedItem.sku}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-bold">
                        {selectedItem.category}
                      </span>
                      {selectedItem.barcode && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-xs flex items-center gap-1">
                          <Barcode size={12} /> {selectedItem.barcode}
                        </span>
                      )}
                    </div>
                    <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {selectedItem.name}
                    </h1>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Brand: {selectedItem.brand || 'Standard Wholesale'} • Selling Price: <strong className="text-slate-900">{formatGHS(selectedItem.selling_price)}</strong>
                    </p>
                  </div>

                  {/* Stock Level Quick Summary Pill */}
                  <div className="text-left sm:text-right shrink-0 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Available Stock</span>
                    <span className="text-2xl sm:text-3xl font-mono font-black text-slate-900">{selectedItem.stock_quantity}</span>
                    <span className="text-xs text-slate-500 font-bold block">{selectedItem.unit_of_measure || 'units'}</span>
                  </div>
                </div>

                {/* Warehouse Location & Lot Info Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  {/* Physical Bin Location Mapping */}
                  <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1 mb-1">
                        <MapPin size={12} /> Physical Bin Location
                      </span>
                      {isEditingBin ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <input
                            type="text"
                            value={tempBinLocation}
                            onChange={(e) => setTempBinLocation(e.target.value)}
                            placeholder="Aisle, Shelf, Bin..."
                            className="bg-white border border-blue-300 rounded px-2 py-1 text-xs font-bold text-slate-800"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleSaveBinLocation}
                            className="p-1 bg-blue-600 text-white rounded text-xs"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="font-mono text-xs font-black text-slate-900">
                          {selectedItem.bin_location}
                        </div>
                      )}
                      <span className="text-[10px] text-blue-800 block mt-0.5">
                        {selectedItem.zone} • {selectedItem.shelf}
                      </span>
                    </div>

                    {!isEditingBin && (
                      <button
                        type="button"
                        onClick={() => {
                          setTempBinLocation(selectedItem.bin_location || '');
                          setIsEditingBin(true);
                        }}
                        className="p-1.5 bg-white text-blue-700 hover:bg-blue-100 rounded-lg transition text-xs shadow-2xs"
                        title="Edit bin location mapping"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Batch & Lot Tracking */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                        <Boxes size={12} /> Batch & Lot Control
                      </span>
                      <div className="font-mono text-xs font-black text-slate-900">
                        {selectedItem.batch_number}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Expiry Date: {selectedItem.expiry_date ? new Date(selectedItem.expiry_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowTransferModal(true)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg transition text-[11px] shadow-2xs flex items-center gap-1"
                    >
                      <ArrowRightLeft size={12} />
                      <span>Transfer</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Touch-Optimized Stock Adjuster Component */}
              <TouchStockAdjuster
                item={selectedItem}
                currentStock={selectedItem.stock_quantity}
                onCommitAdjustment={handleStockAdjustCommit}
                isLoading={isLoading}
              />

              {/* Recent Audit & Floor Activity Log for this Item */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                    <Clock size={14} className="text-blue-600" />
                    <span>Recent Floor Cycle Takes & Adjustments</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">Live Session</span>
                </div>

                {adjustmentLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No physical adjustments logged in this tablet session yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {adjustmentLogs.map(log => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <span>{log.productName}</span>
                            <span className="text-[10px] text-slate-400">• {log.timestamp}</span>
                          </div>
                          <span className="text-[11px] text-slate-500">{log.reason}</span>
                        </div>
                        <div className="text-right">
                          <span className={`font-mono font-black ${
                            log.delta > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {log.delta > 0 ? `+${log.delta}` : log.delta}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            New: {log.newQuantity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 space-y-3">
              <Package size={48} className="opacity-30" />
              <p className="text-sm font-bold text-slate-600">Select an inventory item on the left to adjust</p>
            </div>
          )}
        </div>
      </div>

      {/* Barcode & Camera Scanner Overlay Modal */}
      <BarcodeScannerOverlay
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanResult={handleBarcodeScan}
      />

      {/* Quick Bin / Stock Transfer Modal */}
      {showTransferModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ArrowRightLeft size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Relocate / Transfer Stock</h3>
                  <p className="text-[10px] text-slate-500 font-mono">{selectedItem.sku}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Destination / Bin</label>
                <select
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="Main Shelf Aisle 1">Main Shelf Aisle 1 • Front Bin</option>
                  <option value="Overstock Mezzanine">Overstock Mezzanine • Rack D</option>
                  <option value="Damaged / Quarantine Area">Quarantine / QA Bay 4</option>
                  <option value="Sales Display Floor">Sales Display Floor • Gondola 2</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Transfer Units</label>
                <input
                  type="number"
                  min="1"
                  max={selectedItem.stock_quantity}
                  defaultValue={Math.min(5, selectedItem.stock_quantity)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomBins(prev => ({
                    ...prev,
                    [selectedItem.id]: transferTarget
                  }));
                  setShowTransferModal(false);
                  soundFeedback.playAdjustmentSuccess();
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
