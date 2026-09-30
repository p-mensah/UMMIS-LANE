// TypeScript interfaces for Supplier Management & Procurement System
// Strict Type Safety Definitions

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  business_license?: string;
  payment_terms?: string; // 'Net 30' | 'Net 60' | 'COD'
  currency?: string;
  bank_name?: string;
  bank_account?: string;
  bank_branch?: string;
  lead_time_days?: number;
  moq?: number;
  certifications?: string;
  tier_pricing?: string;
  quality_score?: number;
  created_at?: string;
}

export interface PurchaseOrderItem {
  id?: number;
  purchase_id?: number;
  product_id: number;
  product_name?: string;
  sku?: string;
  supplier_sku?: string;
  quantity: number;
  unit_price: number;
  shipped_quantity?: number;
  received_quantity?: number;
  backorder_quantity?: number;
  batch_lot_number?: string;
  notes?: string;
}

export interface PurchaseOrder {
  id: number;
  user_id: number;
  user_name?: string;
  supplier_name: string;
  supplier_contact?: string;
  total_amount: number;
  status: 'draft' | 'sent' | 'confirmed' | 'in_production' | 'shipped' | 'delivered' | 'received' | 'cancelled';
  notes?: string;
  expected_date?: string;
  received_at?: string;
  confirmed_by?: string;
  created_at: string;
  items?: PurchaseOrderItem[];
  item_count?: number;
  total_units?: number;
  // Logistics & ASN details
  carrier?: string;
  tracking_number?: string;
  eta_window?: string;
  fulfillment_mode?: 'direct_delivery' | 'store_pickup';
  dock_slot?: string;
  dock_time_window?: string;
  dispatched_at?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  acknowledgment_notes?: string;
  // Invoicing & 3-Way Matching
  invoice_number?: string;
  invoice_date?: string;
  invoice_amount?: number;
  invoice_status?: 'unpaid' | 'scheduled' | 'partially_paid' | 'paid';
  invoice_url?: string;
  three_way_match_status?: 'matched' | 'discrepancy' | 'pending_grn';
  payment_terms?: string;
  payment_due_date?: string;
  attachments?: string | any[];
  asns?: ASN[];
}

export interface SupplierItem {
  id: number;
  product_id: number;
  internal_sku: string;
  supplier_sku: string;
  product_name: string;
  category?: string;
  barcode?: string;
  unit_of_measure: string;
  brand?: string;
  unit_cost: number;
  moq: number; // Minimum Order Quantity
  tiered_discounts?: { min_qty: number; discount_pct: number }[];
  current_stock: number;
  reorder_point: number;
  safety_stock: number;
  lead_time_days: number;
  documents?: {
    id: string;
    type: 'SDS' | 'CoA' | 'Spec Sheet';
    title: string;
    url: string;
    file_size?: string;
    uploaded_at: string;
  }[];
}

export interface ASNLineItem {
  product_id: number;
  product_name?: string;
  sku?: string;
  supplier_sku?: string;
  quantity_ordered: number;
  quantity_shipped: number;
  backorder_quantity: number;
  batch_lot_number: string;
  expiry_date?: string;
}

export interface ASN {
  id: string | number;
  po_id: number;
  supplier_name: string;
  tracking_number: string;
  carrier: string;
  eta: string;
  shipped_date: string;
  is_split_shipment: boolean;
  notes?: string;
  document_url?: string;
  line_items: ASNLineItem[];
  created_at: string;
  created_by?: string;
  client_ip?: string;
}

export interface Invoice {
  id: string | number;
  po_id: number;
  supplier_name: string;
  invoice_number: string;
  invoice_date: string;
  amount: number;
  payment_terms: 'Net 30' | 'Net 60' | 'COD' | string;
  due_date: string;
  payment_status: 'unpaid' | 'scheduled' | 'paid';
  match_status: 'matched' | 'discrepancy' | 'pending_grn';
  document_url?: string;
  notes?: string;
  created_at: string;
  client_ip?: string;
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  user_name?: string | null;
  actor_role?: string | null;
  action: string;
  category: 'purchasing' | 'invoice' | 'asn' | 'stock' | 'auth' | 'settings' | 'general';
  details?: string | null;
  ip_address?: string | null;
  created_at: string;
  pre_state?: string | null;
  post_state?: string | null;
}
