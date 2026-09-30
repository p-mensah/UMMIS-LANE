import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import {
  Truck,
  PackageCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  Eye,
  RefreshCw,
  Building2,
  Phone,
  FileText,
  Boxes,
  Calendar,
  User,
  ShieldAlert,
  Search,
  ExternalLink,
  ChevronRight,
  Plus,
  RotateCcw,
  CreditCard,
  BarChart3,
  Sliders,
  X,
  Barcode,
  Upload,
  LayoutDashboard,
  ArrowLeft
} from 'lucide-react';

import SupplierKPIs from '../components/supplier/SupplierKPIs';
import SupplierOverview from '../components/supplier/SupplierOverview';
import POManagement from '../components/supplier/POManagement';
import CreatePOModal from '../components/supplier/CreatePOModal';
import UploadInvoiceModal from '../components/supplier/UploadInvoiceModal';
import SubmitASNModal from '../components/supplier/SubmitASNModal';
import ItemMasterMapping from '../components/supplier/ItemMasterMapping';
import ReplenishmentTriggers from '../components/supplier/ReplenishmentTriggers';
import SupplierMasterData from '../components/supplier/SupplierMasterData';
import QualityControlRMA from '../components/supplier/QualityControlRMA';
import FinancialSettlement from '../components/supplier/FinancialSettlement';
import SupplierAnalytics from '../components/supplier/SupplierAnalytics';
import SupplierReports from '../components/supplier/SupplierReports';

interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

interface PurchaseOrder {
  id: number;
  user_id: number;
  user_name?: string;
  supplier_name: string;
  supplier_contact?: string;
  total_amount: number;
  status: 'draft' | 'pending' | 'in-transit' | 'received' | 'cancelled' | string;
  notes?: string;
  expected_date?: string;
  received_at?: string;
  confirmed_by?: string;
  created_at: string;
  item_count?: number;
  total_units?: number;
  items?: PurchaseItem[];
  carrier?: string;
  tracking_number?: string;
  dispatched_at?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  acknowledgment_notes?: string;
  attachments?: any;
  invoice_number?: string;
  invoice_status?: 'unpaid' | 'partially_paid' | 'approved' | 'paid';
}

interface SupplierInteraction {
  id: number;
  supplier_name: string;
  user_id?: number;
  sender_name: string;
  sender_role: string;
  message_type: 'note' | 'dispatch' | 'inquiry' | 'receipt_confirmation' | 'status_update';
  po_id?: number;
  message: string;
  created_at: string;
}

export type SupplierModuleTab =
  | 'overview'
  | 'pos'
  | 'replenishment'
  | 'item_master'
  | 'financial'
  | 'analytics'
  | 'qc_rma'
  | 'master_data'
  | 'reports'
  | 'portal';

interface SupplierDashboardProps {
  initialTab?: SupplierModuleTab;
}

export default function SupplierDashboard({ initialTab }: SupplierDashboardProps = {}) {
  const { user } = useAuth();
  const { addToast, refreshNotifications } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Helper to resolve active tab from route
  const resolveTabFromUrl = (): SupplierModuleTab => {
    if (initialTab) return initialTab;
    const path = location.pathname;
    if (path === '/' || path === '/supplier/overview' || path === '/supplier-dashboard') return 'overview';
    if (path === '/supplier/pos' || path === '/purchases') return 'pos';
    if (path === '/supplier/inventory') return 'replenishment';
    if (path === '/supplier/catalog' || path === '/products') return 'item_master';
    if (path === '/supplier/invoices') return 'financial';
    if (path === '/supplier/analytics') return 'analytics';
    if (path === '/supplier/qc') return 'qc_rma';
    if (path === '/supplier/profile') return 'master_data';
    if (path === '/supplier/reports') return 'reports';
    if (path === '/supplier/messages') return 'portal';
    return 'overview';
  };

  // Active supplier state
  const isActualSupplier = user?.role === 'supplier';
  const defaultSupplierName = isActualSupplier
    ? (user?.name || '').replace(/supplier/i, '').trim() || 'Nestlé Ghana Ltd'
    : 'Nestlé Ghana Ltd';

  const [activeSupplier, setActiveSupplier] = useState<string>(defaultSupplierName);
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);
  const [suppliersListFull, setSuppliersListFull] = useState<any[]>([]);

  // Active module tab
  const [activeTab, setActiveTab] = useState<SupplierModuleTab>(resolveTabFromUrl());

  useEffect(() => {
    setActiveTab(resolveTabFromUrl());
  }, [location.pathname, initialTab]);

  const handleNavigateTab = (tab: string, path: string) => {
    setActiveTab(tab as SupplierModuleTab);
    navigate(path);
  };

  // Data states
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [interactions, setInteractions] = useState<SupplierInteraction[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [triggersData, setTriggersData] = useState<any>({ triggers: [], low_stock: [], out_of_stock: [] });
  const [qcLogs, setQcLogs] = useState<any[]>([]);
  const [rmas, setRmas] = useState<any[]>([]);

  // Modal States
  const [showCreatePoModal, setShowCreatePoModal] = useState(false);
  const [showUploadInvoiceModal, setShowUploadInvoiceModal] = useState(false);
  const [showSubmitAsnModal, setShowSubmitAsnModal] = useState(false);
  const [invoiceModalPoId, setInvoiceModalPoId] = useState<number | undefined>(undefined);
  const [asnModalPoId, setAsnModalPoId] = useState<number | undefined>(undefined);
  const [prefilledRestockItem, setPrefilledRestockItem] = useState<any>(null);
  const [poSelectedProductId, setPoSelectedProductId] = useState<number | ''>('');
  const [poQuantity, setPoQuantity] = useState<number>(50);
  const [poUnitPrice, setPoUnitPrice] = useState<number>(25.0);
  const [poExpectedDate, setPoExpectedDate] = useState<string>(
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  );
  const [poNotes, setPoNotes] = useState<string>('Standard replenishment delivery to central warehouse dock.');
  const [isCreatingPo, setIsCreatingPo] = useState(false);

  // Workflow messaging state
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState<'note' | 'dispatch' | 'inquiry'>('dispatch');
  const [relatedPoId, setRelatedPoId] = useState<string>('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Fetch all supplier dashboard endpoints
  const loadSupplierData = async (suppName: string) => {
    setLoading(true);
    try {
      const [
        posRes,
        interactionsRes,
        productsRes,
        suppliersRes,
        analyticsRes,
        triggersRes,
        qcRes,
        rmasRes
      ] = await Promise.all([
        fetchApi(`/purchases?supplier=${encodeURIComponent(suppName)}`),
        fetchApi(`/supplier/interactions?supplier_name=${encodeURIComponent(suppName)}`),
        fetchApi(`/supplier/catalog?brand=${encodeURIComponent(suppName)}`),
        fetchApi('/suppliers'),
        fetchApi(`/supplier/analytics?supplier_name=${encodeURIComponent(suppName)}`),
        fetchApi(`/supplier/replenishment-triggers?supplier_name=${encodeURIComponent(suppName)}`),
        fetchApi(`/supplier/qc-logs?supplier_name=${encodeURIComponent(suppName)}`),
        fetchApi(`/supplier/rmas?supplier_name=${encodeURIComponent(suppName)}`)
      ]);

      setPurchases(posRes || []);
      setInteractions(interactionsRes || []);
      setCatalog(productsRes || []);
      setAnalyticsData(analyticsRes || null);
      setTriggersData(triggersRes || { triggers: [], low_stock: [], out_of_stock: [] });
      setQcLogs(qcRes || []);
      setRmas(rmasRes || []);

      if (suppliersRes && suppliersRes.length > 0) {
        setSuppliersListFull(suppliersRes);
        const names = suppliersRes.map((s: any) => s.name);
        if (!names.includes('Nestlé Ghana Ltd')) names.push('Nestlé Ghana Ltd');
        if (!names.includes('Wilmar Africa Ltd')) names.push('Wilmar Africa Ltd');
        setAvailableSuppliers(names);
      } else {
        setAvailableSuppliers(['Nestlé Ghana Ltd', 'Wilmar Africa Ltd', 'Unilever Ghana']);
      }
    } catch (err: any) {
      console.error('Error loading supplier dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupplierData(activeSupplier);
  }, [activeSupplier]);

  useEffect(() => {
    const handleOpenNewPO = () => {
      if (catalog.length > 0) setPoSelectedProductId(catalog[0].id);
      setShowCreatePoModal(true);
    };
    const handleOpenUploadInvoice = (e: any) => {
      setInvoiceModalPoId(e?.detail?.poId);
      setShowUploadInvoiceModal(true);
    };
    const handleOpenSubmitASN = (e: any) => {
      setAsnModalPoId(e?.detail?.poId);
      setShowSubmitAsnModal(true);
    };

    window.addEventListener('supplier-open-new-po', handleOpenNewPO);
    window.addEventListener('supplier-open-upload-invoice', handleOpenUploadInvoice);
    window.addEventListener('supplier-open-submit-asn', handleOpenSubmitASN);

    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    if (action === 'new-po') {
      setShowCreatePoModal(true);
    } else if (action === 'upload-invoice') {
      setShowUploadInvoiceModal(true);
    } else if (action === 'submit-asn') {
      setShowSubmitAsnModal(true);
    }

    return () => {
      window.removeEventListener('supplier-open-new-po', handleOpenNewPO);
      window.removeEventListener('supplier-open-upload-invoice', handleOpenUploadInvoice);
      window.removeEventListener('supplier-open-submit-asn', handleOpenSubmitASN);
    };
  }, [location.search, catalog]);

  // Handler: Acknowledge PO
  const handleAcknowledgePO = async (poId: number, notes: string) => {
    await fetchApi(`/purchases/${poId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
    addToast({
      title: 'Order Acknowledged',
      message: `Purchase Order #PO-${poId} acknowledgment confirmed.`,
      type: 'success'
    });
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  // Handler: Dispatch PO
  const handleDispatchPO = async (poId: number, carrier: string, trackingNumber: string, notes: string) => {
    await fetchApi(`/purchases/${poId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ carrier, tracking_number: trackingNumber, notes })
    });
    addToast({
      title: 'Shipment Dispatched! 🚚',
      message: `PO #PO-${poId} marked as in-transit with carrier ${carrier}.`,
      type: 'success'
    });
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  // Handler: Attach Document to PO
  const handleUploadAttachment = async (poId: number, attachment: { name: string; type: string; size: string }) => {
    await fetchApi(`/purchases/${poId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(attachment)
    });
    addToast({
      title: 'Document Attached',
      message: `${attachment.name} successfully linked to PO #PO-${poId}.`,
      type: 'success'
    });
    await loadSupplierData(activeSupplier);
  };

  // Handler: Update PO Status (e.g. Received)
  const handleUpdateStatus = async (poId: number, status: string) => {
    if (status === 'received') {
      await fetchApi(`/purchases/${poId}/confirm-receipt`, { method: 'POST' });
      addToast({
        title: 'Goods Received & Stocked',
        message: `PO #PO-${poId} fulfilled and stock levels updated.`,
        type: 'success'
      });
    } else {
      await fetchApi(`/purchases/${poId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      addToast({
        title: 'Status Updated',
        message: `PO #PO-${poId} status set to ${status.toUpperCase()}.`,
        type: 'info'
      });
    }
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  // Handler: Update Logistics & Fulfillment Configuration
  const handleUpdateLogistics = async (poId: number, logistics: any) => {
    await fetchApi(`/purchases/${poId}/logistics`, {
      method: 'PUT',
      body: JSON.stringify(logistics)
    });
    addToast({
      title: 'Logistics Saved',
      message: `Logistics & fulfillment configuration updated for PO #PO-${poId}.`,
      type: 'success'
    });
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  // Handler: Update Supplier Master Data
  const handleSaveMasterData = async (updated: any) => {
    const activeSupplierObj = suppliersListFull.find(
      (s) => s.name.toLowerCase() === activeSupplier.toLowerCase()
    );
    const supplierId = activeSupplierObj?.id || 1;

    await fetchApi(`/suppliers/${supplierId}/master-data`, {
      method: 'PUT',
      body: JSON.stringify(updated)
    });
    addToast({
      title: 'Master Profile Updated',
      message: 'Supplier profile, SLAs, bank details, and compliance terms saved.',
      type: 'success'
    });
    await loadSupplierData(activeSupplier);
  };

  // Handler: Log QC inspection
  const handleCreateQCLog = async (data: any) => {
    await fetchApi('/supplier/qc-logs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    addToast({
      title: 'QC Inspection Recorded',
      message: `Goods receipt note inspection logged for PO #${data.po_id}.`,
      type: 'success'
    });
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  // Handler: Initiate RMA
  const handleCreateRMA = async (data: any) => {
    await fetchApi('/supplier/rmas', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    addToast({
      title: 'RMA Ticket Filed',
      message: `RMA return claim submitted for ${data.product_name}.`,
      type: 'warning'
    });
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  // Handler: Update RMA status
  const handleUpdateRMAStatus = async (rmaId: number, status: string, creditAmount?: number) => {
    await fetchApi(`/supplier/rmas/${rmaId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, credit_amount: creditAmount })
    });
    addToast({
      title: 'RMA Status Updated',
      message: `RMA #${rmaId} status updated to ${status.toUpperCase()}.`,
      type: 'success'
    });
    await loadSupplierData(activeSupplier);
  };

  // Handler: Update Invoice Status
  const handleUpdateInvoiceStatus = async (poId: number, invoiceStatus: any, invoiceNo?: string) => {
    await fetchApi(`/purchases/${poId}/invoice-status`, {
      method: 'PUT',
      body: JSON.stringify({ invoice_status: invoiceStatus, invoice_number: invoiceNo })
    });
    addToast({
      title: 'Settlement Status Updated',
      message: `PO #${poId} invoice status set to ${invoiceStatus.toUpperCase()}.`,
      type: 'success'
    });
    await loadSupplierData(activeSupplier);
  };

  // Handler: Quick Restock from Replenishment triggers
  const handleRestockItem = (item: any) => {
    const suggestedUnits = Math.max((item.effective_rop || 10) * 3, 24);
    setPrefilledRestockItem({
      id: item.id,
      name: item.name,
      sku: item.sku || `SKU-${item.id}`,
      cost_price: item.cost_price || 20,
      quantity: suggestedUnits
    });
    setShowCreatePoModal(true);
  };

  // Handler: Create & Issue new PO
  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSelectedProductId) {
      alert('Please select a product line for the purchase order.');
      return;
    }
    const selectedProd = catalog.find((c) => c.id === Number(poSelectedProductId)) ||
      triggersData.triggers?.find((t: any) => t.id === Number(poSelectedProductId));

    setIsCreatingPo(true);
    try {
      await fetchApi('/purchases', {
        method: 'POST',
        body: JSON.stringify({
          supplier_name: activeSupplier,
          supplier_contact: 'Procurement Desk',
          status: 'ordered',
          notes: poNotes,
          expected_date: poExpectedDate,
          items: [
            {
              product_id: Number(poSelectedProductId),
              quantity: Number(poQuantity),
              unit_price: Number(poUnitPrice)
            }
          ]
        })
      });

      addToast({
        title: 'Purchase Order Issued! 📋',
        message: `PO successfully placed with ${activeSupplier} for ${poQuantity}x ${selectedProd?.name || 'items'}.`,
        type: 'success'
      });

      setShowCreatePoModal(false);
      await loadSupplierData(activeSupplier);
      await refreshNotifications();
    } catch (err: any) {
      alert(err.message || 'Failed to create purchase order');
    } finally {
      setIsCreatingPo(false);
    }
  };

  // Send interaction message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSendingMessage(true);
    try {
      await fetchApi('/supplier/interactions', {
        method: 'POST',
        body: JSON.stringify({
          supplier_name: activeSupplier,
          message: newMessage.trim(),
          message_type: messageType,
          po_id: relatedPoId ? parseInt(relatedPoId, 10) : undefined
        })
      });

      addToast({
        title: 'Update Dispatched',
        message: 'Your update has been recorded in the supplier-owner workflow thread.',
        type: 'success'
      });

      setNewMessage('');
      setRelatedPoId('');
      const freshInteractions = await fetchApi(
        `/supplier/interactions?supplier_name=${encodeURIComponent(activeSupplier)}`
      );
      setInteractions(freshInteractions || []);
    } catch (err: any) {
      alert(err.message || 'Failed to send communication update');
    } finally {
      setSendingMessage(false);
    }
  };

  const activeSupplierRecord =
    suppliersListFull.find((s) => s.name.toLowerCase() === activeSupplier.toLowerCase()) || {
      id: 1,
      name: activeSupplier,
      contact_person: 'Corporate Sales & Key Accounts Desk',
      email: 'orders@vendor-gh.com',
      phone: '+233 30 257 0191',
      address: 'Plot 12 Industrial Area, Tema / Accra, Ghana',
      tax_id: 'TIN-GH90218821',
      business_license: 'BL-2024-99120',
      payment_terms: 'Net 30',
      currency: 'GHS',
      bank_name: 'Ecobank Ghana PLC',
      bank_account: '0182001928491',
      bank_branch: 'High Street Branch, Accra',
      lead_time_days: 3,
      moq: 24,
      certifications: 'ISO 9001:2015, Ghana FDA Registered, GSA Compliant',
      tier_pricing: 'Tier 1: 50+ units (3%), Tier 2: 200+ units (7%)',
      quality_score: 95
    };

  const MODULE_TABS = [
    { id: 'overview', label: 'Supplier Overview', icon: LayoutDashboard, path: '/supplier/overview' },
    { id: 'pos', label: 'PO & ASN Lifecycle', icon: Truck, path: '/supplier/pos', badge: purchases.length },
    { id: 'replenishment', label: 'Inventory Alignment & VMI', icon: Boxes, path: '/supplier/inventory', badge: triggersData?.triggers?.length },
    { id: 'item_master', label: 'Product Catalog & Item Master', icon: Barcode, path: '/supplier/catalog' },
    { id: 'financial', label: 'Invoicing & 3-Way Match', icon: CreditCard, path: '/supplier/invoices' },
    { id: 'analytics', label: 'Vendor Analytics & SLA', icon: BarChart3, path: '/supplier/analytics' },
    { id: 'qc_rma', label: 'Inspection QC & RMAs', icon: RotateCcw, path: '/supplier/qc', badge: qcLogs.length + rmas.length },
    { id: 'master_data', label: 'Supplier Master Profile', icon: Building2, path: '/supplier/profile' },
    { id: 'reports', label: 'Procurement Reports', icon: FileText, path: '/supplier/reports' },
    { id: 'portal', label: 'Supplier Messages', icon: MessageSquare, path: '/supplier/messages', badge: interactions.length },
  ];

  return (
    <div className="space-y-5">
      {/* If activeTab is overview, render the rich SupplierOverview component */}
      {activeTab === 'overview' ? (
        <SupplierOverview
          purchases={purchases}
          triggersData={triggersData}
          analyticsData={analyticsData}
          qcLogs={qcLogs}
          rmas={rmas}
          activeSupplier={activeSupplier}
          activeSupplierRecord={activeSupplierRecord}
          loading={loading}
          onNewPO={() => {
            if (catalog.length > 0) setPoSelectedProductId(catalog[0].id);
            setShowCreatePoModal(true);
          }}
          onUploadInvoice={(poId) => {
            setInvoiceModalPoId(poId);
            setShowUploadInvoiceModal(true);
          }}
          onSubmitASN={(poId) => {
            setAsnModalPoId(poId);
            setShowSubmitAsnModal(true);
          }}
          onNavigateTab={handleNavigateTab}
        />
      ) : (
        <>
          {/* Header Bar for Dedicated Module Pages */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleNavigateTab('overview', '/supplier/overview')}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                title="Return to Supplier Overview"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Overview</span>
              </button>

              <div className="h-6 w-px bg-slate-200 hidden sm:block" />

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black text-slate-900 tracking-tight">
                    {MODULE_TABS.find(t => t.id === activeTab)?.label || 'Supplier Portal'}
                  </h1>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                    Dedicated Page
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Viewing operations for <strong className="text-slate-800">{activeSupplier}</strong> • {activeSupplierRecord?.payment_terms || 'Net 30'} • Lead: {activeSupplierRecord?.lead_time_days || 3}d
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Vendor:</span>
                <select
                  value={activeSupplier}
                  onChange={(e) => setActiveSupplier(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer"
                >
                  {availableSuppliers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => loadSupplierData(activeSupplier)}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200 transition-colors cursor-pointer"
                title="Refresh All Supplier Feeds"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (catalog.length > 0) setPoSelectedProductId(catalog[0].id);
                  setShowCreatePoModal(true);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Create and issue new purchase order"
              >
                <Plus size={14} /> New PO
              </button>

              <button
                type="button"
                onClick={() => {
                  setInvoiceModalPoId(undefined);
                  setShowUploadInvoiceModal(true);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Upload supplier invoice against fulfilled PO"
              >
                <FileText size={14} /> Upload Invoice
              </button>

              <button
                type="button"
                onClick={() => {
                  setAsnModalPoId(undefined);
                  setShowSubmitAsnModal(true);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-blue-300 font-bold text-xs rounded border border-slate-700 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Submit Advanced Shipping Notice (ASN)"
              >
                <Truck size={14} /> Submit ASN
              </button>
            </div>
          </div>

          {/* Dedicated Page Full-Width Content Container */}
          <main className="w-full space-y-4">
            {activeTab === 'pos' && (
              <POManagement
                purchases={purchases}
                activeSupplier={activeSupplier}
                onRefresh={() => loadSupplierData(activeSupplier)}
                onAcknowledgePO={handleAcknowledgePO}
                onDispatchPO={handleDispatchPO}
                onUploadAttachment={handleUploadAttachment}
                onUpdateStatus={handleUpdateStatus}
                onUpdateLogistics={handleUpdateLogistics}
                onCreatePO={() => setShowCreatePoModal(true)}
                onOpenASNModal={(po) => {
                  setAsnModalPoId(po.id);
                  setShowSubmitAsnModal(true);
                }}
                onOpenInvoiceModal={(po) => {
                  setInvoiceModalPoId(po.id);
                  setShowUploadInvoiceModal(true);
                }}
                userRole={user?.role}
              />
            )}

            {activeTab === 'replenishment' && (
              <ReplenishmentTriggers
                triggersData={triggersData}
                onRestockItem={handleRestockItem}
                onRefresh={() => loadSupplierData(activeSupplier)}
                loading={loading}
              />
            )}

            {activeTab === 'item_master' && (
              <ItemMasterMapping
                activeSupplier={activeSupplier}
                userRole={user?.role}
              />
            )}

            {activeTab === 'master_data' && (
              <SupplierMasterData
                supplier={activeSupplierRecord}
                onSaveMasterData={handleSaveMasterData}
                userRole={user?.role}
              />
            )}

            {activeTab === 'qc_rma' && (
              <QualityControlRMA
                qcLogs={qcLogs}
                rmas={rmas}
                activeSupplier={activeSupplier}
                onRefresh={() => loadSupplierData(activeSupplier)}
                onCreateQCLog={handleCreateQCLog}
                onCreateRMA={handleCreateRMA}
                onUpdateRMAStatus={handleUpdateRMAStatus}
                purchasesList={purchases}
              />
            )}

            {activeTab === 'financial' && (
              <FinancialSettlement
                purchases={purchases}
                activeSupplier={activeSupplier}
                onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
                userRole={user?.role}
              />
            )}

            {activeTab === 'analytics' && (
              <SupplierAnalytics
                analyticsData={analyticsData}
                activeSupplier={activeSupplier}
              />
            )}

            {activeTab === 'reports' && (
              <SupplierReports
                activeSupplier={activeSupplier}
                purchases={purchases}
                kpis={analyticsData?.kpis}
                triggersData={triggersData}
                qcLogs={qcLogs}
                rmas={rmas}
                financialData={purchases}
              />
            )}

            {activeTab === 'portal' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Send size={14} className="text-blue-600" />
                    Dispatch Collaboration Note
                  </h3>

                  <form onSubmit={handleSendMessage} className="space-y-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Message Type</label>
                      <select
                        value={messageType}
                        onChange={(e: any) => setMessageType(e.target.value)}
                        className="w-full border border-slate-200 rounded p-2 focus:outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="dispatch">Logistics Dispatch Notice</option>
                        <option value="note">Internal Procurement Note</option>
                        <option value="inquiry">Pricing & SLA Inquiry</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Related Purchase Order (Optional)</label>
                      <select
                        value={relatedPoId}
                        onChange={(e) => setRelatedPoId(e.target.value)}
                        className="w-full border border-slate-200 rounded p-2 focus:outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="">General Supplier Communication</option>
                        {purchases.map((p) => (
                          <option key={p.id} value={p.id}>
                            PO #{p.id} - {formatGHS(p.total_amount)} ({p.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Message Content</label>
                      <textarea
                        rows={4}
                        required
                        placeholder="Type updates, container arrival times, invoice questions..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="w-full border border-slate-200 rounded p-2 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={sendingMessage || !newMessage.trim()}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Send size={13} />
                      <span>{sendingMessage ? 'Sending...' : 'Send to Workflow Thread'}</span>
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-2xs p-4 flex flex-col justify-between space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <MessageSquare size={14} className="text-slate-600" />
                    Live Workflow & Collaboration Ledger ({activeSupplier})
                  </h3>

                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 text-xs">
                    {interactions.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900">{msg.sender_name}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 uppercase">
                              {msg.sender_role}
                            </span>
                            {msg.po_id && (
                              <span className="text-[10px] font-mono font-bold text-blue-600">
                                Ref: #PO-{msg.po_id}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1.5 text-slate-700 whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                      </div>
                    ))}

                    {interactions.length === 0 && (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        <MessageSquare size={24} className="mx-auto mb-1.5 opacity-30" />
                        No collaborative dispatch or status notes recorded for {activeSupplier} yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </>
      )}

      {/* 5. Create & Issue Purchase Order Modal */}
      {showCreatePoModal && (
        <CreatePOModal
          isOpen={showCreatePoModal}
          onClose={() => {
            setShowCreatePoModal(false);
            setPrefilledRestockItem(null);
          }}
          activeSupplier={activeSupplier}
          availableSuppliers={availableSuppliers}
          catalog={catalog.length > 0 ? catalog : (triggersData.triggers || [])}
          prefilledItem={prefilledRestockItem}
          onSubmit={async (poData) => {
            await fetchApi('/purchases', {
              method: 'POST',
              body: JSON.stringify(poData)
            });
            addToast({
              title: 'Purchase Order Issued! 📋',
              message: `PO successfully placed with ${poData.supplier_name}.`,
              type: 'success'
            });
            setShowCreatePoModal(false);
            setPrefilledRestockItem(null);
            await loadSupplierData(activeSupplier);
            await refreshNotifications();
          }}
        />
      )}

      {/* 6. Upload Supplier Invoice Modal */}
      {showUploadInvoiceModal && (
        <UploadInvoiceModal
          isOpen={showUploadInvoiceModal}
          onClose={() => {
            setShowUploadInvoiceModal(false);
            setInvoiceModalPoId(undefined);
          }}
          activeSupplier={activeSupplier}
          purchases={purchases}
          preselectedPoId={invoiceModalPoId}
          onInvoiceUploaded={async () => {
            await loadSupplierData(activeSupplier);
            await refreshNotifications();
          }}
        />
      )}

      {/* 7. Submit Advanced Shipping Notice (ASN) Modal */}
      {showSubmitAsnModal && (
        <SubmitASNModal
          isOpen={showSubmitAsnModal}
          onClose={() => {
            setShowSubmitAsnModal(false);
            setAsnModalPoId(undefined);
          }}
          activeSupplier={activeSupplier}
          purchases={purchases}
          preselectedPoId={asnModalPoId}
          onASNSubmitted={async () => {
            await loadSupplierData(activeSupplier);
            await refreshNotifications();
          }}
        />
      )}
    </div>
  );
}
