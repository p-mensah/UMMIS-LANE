import React, { useState } from 'react';
import { formatGHS } from '../../lib/formatters';
import {
  AlertTriangle,
  PackageX,
  RefreshCw,
  Plus,
  ShoppingCart,
  TrendingDown,
  Clock,
  ArrowRight,
  CheckCircle2,
  Filter,
  Search,
  Boxes
} from 'lucide-react';

interface ReplenishmentItem {
  id: number;
  name: string;
  sku: string;
  category: string;
  brand?: string;
  stock_quantity: number;
  min_stock_level?: number;
  effective_rop?: number;
  stock_status: 'out_of_stock' | 'low_stock' | 'adequate';
  cost_price: number;
  price: number;
  on_order_quantity?: number;
}

interface ReplenishmentTriggersProps {
  triggersData: {
    triggers?: ReplenishmentItem[];
    low_stock?: ReplenishmentItem[];
    out_of_stock?: ReplenishmentItem[];
    low_stock_count?: number;
    out_of_stock_count?: number;
    total_triggers?: number;
  };
  onRestockItem?: (item: ReplenishmentItem) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export default function ReplenishmentTriggers({
  triggersData,
  onRestockItem,
  onRefresh,
  loading = false
}: ReplenishmentTriggersProps) {
  const [filterType, setFilterType] = useState<'all' | 'out_of_stock' | 'low_stock'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const items = triggersData.triggers || [];
  const lowCount = triggersData.low_stock_count ?? 0;
  const outCount = triggersData.out_of_stock_count ?? 0;
  const backorderCount = items.filter((i) => (i.on_order_quantity || 0) > 0 && i.stock_status !== 'adequate').length;

  const filteredItems = items.filter((it) => {
    const matchesFilter = filterType === 'all' || it.stock_status === filterType;
    const matchesSearch =
      searchQuery === '' ||
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (it.sku && it.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (it.brand && it.brand.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Summary Alert Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Out of Stock Card */}
        <div
          onClick={() => setFilterType('out_of_stock')}
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            filterType === 'out_of_stock'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/20'
              : 'bg-white border-slate-200 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Out of Stock (Zero Inventory)
            </span>
            <div className="p-1.5 bg-rose-100 text-rose-700 rounded-md">
              <PackageX size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600 tracking-tight">
            {outCount} <span className="text-xs font-semibold text-slate-500">critical SKUs</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Immediate reorder required to prevent lost sales
          </p>
        </div>

        {/* Low Stock ROP Breach Card */}
        <div
          onClick={() => setFilterType('low_stock')}
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            filterType === 'low_stock'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Below Reorder Point (ROP)
            </span>
            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-md">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 tracking-tight">
            {lowCount} <span className="text-xs font-semibold text-slate-500">items triggered</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Stock dipped below safety threshold level
          </p>
        </div>

        {/* Backorder Tracking Card */}
        <div
          onClick={() => setFilterType('all')}
          className="p-4 rounded-lg border bg-white border-slate-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Backorder & Pipeline Tracking
            </span>
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-md">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600 tracking-tight">
            {backorderCount} <span className="text-xs font-semibold text-slate-500">SKUs in pipeline</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Orders placed with suppliers awaiting receiving
          </p>
        </div>
      </div>

      {/* Trigger Controls & Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search trigger items by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded text-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  filterType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                All Triggers ({items.length})
              </button>
              <button
                onClick={() => setFilterType('out_of_stock')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  filterType === 'out_of_stock' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                Out of Stock ({outCount})
              </button>
              <button
                onClick={() => setFilterType('low_stock')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  filterType === 'low_stock' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                Low Stock ({lowCount})
              </button>
            </div>
          </div>

          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded border border-slate-200 bg-white flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh ROP Status
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="p-3.5">Product & SKU</th>
                <th className="p-3.5">Category / Brand</th>
                <th className="p-3.5 text-center">On-Hand Stock</th>
                <th className="p-3.5 text-center">Reorder Point (ROP)</th>
                <th className="p-3.5 text-center">Pipeline (On Order)</th>
                <th className="p-3.5">Unit Cost (GHS)</th>
                <th className="p-3.5 text-right">Quick Restock Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.map((item) => {
                const isOutOfStock = item.stock_quantity === 0;
                const rop = item.effective_rop || item.min_stock_level || 10;
                const onOrder = item.on_order_quantity || 0;
                const suggestedReorder = Math.max(rop * 3, 24);

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="font-mono text-[10px] text-slate-400">{item.sku || 'SKU-GEN'}</div>
                    </td>

                    <td className="p-3.5">
                      <span className="text-slate-700 font-medium block">{item.category}</span>
                      <span className="text-[10px] text-slate-400">{item.brand || 'General Vendor'}</span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded font-black text-xs ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {item.stock_quantity} units
                      </span>
                    </td>

                    <td className="p-3.5 text-center font-bold text-slate-700">
                      {rop} units
                    </td>

                    <td className="p-3.5 text-center">
                      {onOrder > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock size={10} /> {onOrder} on PO
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">0 on order</span>
                      )}
                    </td>

                    <td className="p-3.5 font-bold text-slate-800">
                      {formatGHS(item.cost_price || 0)}
                    </td>

                    <td className="p-3.5 text-right whitespace-nowrap">
                      {onRestockItem ? (
                        <button
                          onClick={() => onRestockItem(item)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded transition-colors inline-flex items-center gap-1 shadow-xs cursor-pointer"
                          title={`Generate PO for ${suggestedReorder} units`}
                        >
                          <ShoppingCart size={13} />
                          <span>Restock ({suggestedReorder})</span>
                        </button>
                      ) : (
                        <span className="text-blue-600 font-semibold text-xs">Reorder trigger active</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                    <CheckCircle2 size={24} className="mx-auto mb-1.5 text-emerald-500" />
                    All supplier catalog products are currently above safety reorder points (ROP).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
