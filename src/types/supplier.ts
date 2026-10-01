// Central TypeScript interfaces for Supplier Management & Operations
// Comprehensive Type Safety Definitions for Dual-Perspective Supplier & Admin Sync

// Status Enums as specified:
// ProductStatus [Active, OutOfStock, Draft]
export enum ProductStatus {
  Active = 'Active',
  OutOfStock = 'OutOfStock',
  Draft = 'Draft'
}

// ShipmentStatus [Preparing, InTransit, Delivered, Verified]
export enum ShipmentStatus {
  Preparing = 'Preparing',
  InTransit = 'InTransit',
  Delivered = 'Delivered',
  Verified = 'Verified'
}

// InvoiceStatus [Unpaid, Scheduled, Paid]
export enum InvoiceStatus {
  Unpaid = 'Unpaid',
  Scheduled = 'Scheduled',
  Paid = 'Paid'
}

// Interoperable Type Aliases
export type ProductStatusType = ProductStatus | 'Active' | 'OutOfStock' | 'Draft' | 'active' | 'out_of_stock' | 'draft' | 'pending_approval' | string;
export type ShipmentStatusType = ShipmentStatus | 'Preparing' | 'InTransit' | 'Delivered' | 'Verified' | 'preparing' | 'in_transit' | 'delivered' | 'verified' | string;
export type InvoiceStatusType = InvoiceStatus | 'Unpaid' | 'Scheduled' | 'Paid' | 'unpaid' | 'scheduled' | 'paid' | string;

export type SupplierProductStatus = ProductStatusType;
export type SupplierInvoiceStatus = InvoiceStatusType;

export interface SupplierProduct {
  id: number;
  name: string;
  sku: string;
  unitCost: number;
  moq: number;
  status: ProductStatusType;
  // Extended and backward-compatible properties
  title?: string;
  description?: string;
  supplier_sku?: string;
  internal_sku?: string;
  barcode?: string;
  unit_cost?: number;
  selling_price?: number;
  current_stock?: number;
  reorder_point?: number;
  safety_stock?: number;
  category?: string;
  unit?: string;
  lead_time_days?: number;
  tiered_discounts?: { min_qty: number; discount_pct: number }[];
  documents?: {
    id: string;
    type: 'SDS' | 'CoA' | 'Spec Sheet';
    title: string;
    url: string;
    file_size?: string;
    uploaded_at: string;
  }[];
  supplier_name?: string;
  supplier_id?: number;
  admin_approved?: boolean | number;
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ShipmentItem {
  id?: number;
  shipment_id?: number;
  product_id: number;
  product_name: string;
  sku?: string;
  supplier_sku?: string;
  quantity: number;
  unit_cost?: number;
  batch_lot_number?: string;
  expiry_date?: string;
  notes?: string;
}

export interface Shipment {
  id: number;
  items: Array<any>;
  trackingId: string;
  carrier: string;
  eta: string;
  status: ShipmentStatusType;
  // Extended and backward-compatible properties
  tracking_number?: string;
  shipment_number?: string;
  po_id?: number;
  supplier_name?: string;
  shipped_date?: string;
  delivered_date?: string;
  item_count?: number;
  total_units?: number;
  total_value?: number;
  destination?: string;
  notes?: string;
  invoice_attached?: boolean | number;
  invoice_id?: number;
  invoice_number?: string;
  verified_at?: string;
  verified_by?: string;
  verification_notes?: string;
  client_ip?: string;
  created_at?: string;
  updated_at?: string;
}

export type InvoiceMatchStatus = 'matched' | 'discrepancy' | 'pending_verification';

export interface SupplierInvoice {
  id: number;
  shipmentId: number;
  amount: number;
  status: InvoiceStatusType;
  dueDate: string;
  // Extended and backward-compatible properties
  shipment_id?: number;
  invoice_number?: string;
  shipment_number?: string;
  po_id?: number;
  supplier_name?: string;
  invoice_date?: string;
  due_date?: string;
  payment_terms?: 'Net 30' | 'Net 60' | 'COD' | string;
  match_status?: InvoiceMatchStatus;
  document_url?: string;
  file_name?: string;
  notes?: string;
  payment_method?: string;
  paid_at?: string;
  paid_by?: string;
  scheduled_date?: string;
  client_ip?: string;
  created_at?: string;
  updated_at?: string;
}

export type MessageContextType = 'sku' | 'shipment' | 'invoice' | 'general';

export interface Message {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_role: 'admin' | 'manager' | 'supplier' | 'staff' | string;
  recipient_id?: number;
  recipient_name?: string;
  recipient_role?: string;
  content: string;
  context_type?: MessageContextType;
  context_id?: string;
  reference_title?: string;
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: string;
  }[];
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name: string;
  actor_role: string;
  action: string;
  category: string;
  sub_category?: string;
  details: string;
  ip_address: string;
  pre_state?: string;
  post_state?: string;
  delta?: string;
  device_terminal?: string;
  location?: string;
  created_at: string;
}

export interface SupplierKPIsData {
  active_shipments_count: number;
  pending_approvals_count: number;
  low_stock_alerts_count: number;
  unpaid_invoices_balance: number;
  average_lead_time_days: number;
  quality_acceptance_rate: number;
  on_time_delivery_rate: number;
}
