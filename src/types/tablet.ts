export interface TabletInventoryItem {
  id: number;
  name: string;
  sku: string;
  category: string;
  stock_quantity: number;
  cost_price: number;
  selling_price: number;
  barcode: string;
  brand?: string;
  unit_of_measure?: string;
  min_stock_level?: number;
  image_url?: string;
  // Tablet warehouse & lot enhancements
  bin_location?: string;
  zone?: string;
  shelf?: string;
  batch_number?: string;
  expiry_date?: string;
  last_counted_at?: string;
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface StockAdjustmentPayload {
  product_id: number;
  quantity_change: number;
  new_quantity: number;
  reason: string;
  notes?: string;
  bin_location?: string;
}

export interface QuickAdjustmentAudit {
  id: string;
  productId: number;
  productName: string;
  delta: number;
  newQuantity: number;
  timestamp: string;
  reason: string;
  performedBy: string;
}
