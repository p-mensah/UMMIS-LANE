import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { fetchApi } from '../lib/api';
import type { SupplierProduct, Shipment, SupplierInvoice } from '../types/supplier';

// Contextual Module Components
import SupplierOverview from '../components/supplier/SupplierOverview';
import SupplierProductsTab from '../components/supplier/SupplierProductsTab';
import SupplierShipmentsTab from '../components/supplier/SupplierShipmentsTab';
import SupplierInvoicesTab from '../components/supplier/SupplierInvoicesTab';

// Admin / Secondary Workflow Components
import POManagement from '../components/supplier/POManagement';
import ReplenishmentTriggers from '../components/supplier/ReplenishmentTriggers';
import SupplierMasterData from '../components/supplier/SupplierMasterData';
import QualityControlRMA from '../components/supplier/QualityControlRMA';
import FinancialSettlement from '../components/supplier/FinancialSettlement';
import SupplierAnalytics from '../components/supplier/SupplierAnalytics';
import SupplierReports from '../components/supplier/SupplierReports';

export type SupplierModuleTab =
  | 'overview'
  | 'products'
  | 'shipments'
  | 'invoices'
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

  // Helper to resolve active tab strictly from URL and initialTab
  const resolveTabFromUrl = (): SupplierModuleTab => {
    if (initialTab) return initialTab;
    const path = location.pathname;
    if (path === '/' || path === '/supplier/overview' || path === '/supplier-dashboard') return 'overview';
    if (path === '/supplier/products' || path === '/supplier/catalog' || path === '/products') return 'products';
    if (path === '/supplier/shipments' || path === '/supplier/pos' || path === '/purchases') return 'shipments';
    if (path === '/supplier/invoices') return 'invoices';
    if (path === '/supplier/inventory') return 'replenishment';
    if (path === '/supplier/analytics') return 'analytics';
    if (path === '/supplier/qc') return 'qc_rma';
    if (path === '/supplier/profile') return 'master_data';
    if (path === '/supplier/reports') return 'reports';
    return 'overview';
  };

  const isActualSupplier = user?.role === 'supplier';
  const defaultSupplierName = isActualSupplier
    ? (user?.name || '').replace(/supplier/i, '').trim() || 'Nestlé Ghana Ltd'
    : 'Nestlé Ghana Ltd';

  const [activeSupplier, setActiveSupplier] = useState<string>(defaultSupplierName);
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);
  const [suppliersListFull, setSuppliersListFull] = useState<any[]>([]);

  // Active module tab
  const [activeTab, setActiveTab] = useState<SupplierModuleTab>(resolveTabFromUrl());

  // Inter-tab workflow state (e.g. from Shipments -> Attach Invoice)
  const [preselectedShipment, setPreselectedShipment] = useState<Shipment | null>(null);
  const [preselectedPO, setPreselectedPO] = useState<any | null>(null);

  useEffect(() => {
    setActiveTab(resolveTabFromUrl());
  }, [location.pathname, initialTab]);

  const handleNavigateTab = (tab: string, path: string) => {
    setActiveTab(tab as SupplierModuleTab);
    navigate(path);
  };

  // Live Data States
  const [loading, setLoading] = useState(true);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [supplierShipments, setSupplierShipments] = useState<Shipment[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  
  // Secondary / Admin data
  const [purchases, setPurchases] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [triggersData, setTriggersData] = useState<any>({ triggers: [], low_stock: [], out_of_stock: [] });
  const [qcLogs, setQcLogs] = useState<any[]>([]);
  const [rmas, setRmas] = useState<any[]>([]);

  // Fetch all supplier dashboard endpoints
  const loadSupplierData = async (suppName: string) => {
    setLoading(true);
    try {
      const [
        prodsRes,
        shipmentsRes,
        invoicesRes,
        posRes,
        suppliersRes,
        analyticsRes,
        triggersRes,
        qcRes,
        rmasRes
      ] = await Promise.all([
        fetchApi(`/api/supplier/products?supplier_name=${encodeURIComponent(suppName)}`).catch(() => []),
        fetchApi(`/api/supplier/shipments?supplier_name=${encodeURIComponent(suppName)}`).catch(() => []),
        fetchApi(`/api/supplier/invoices-ledger?supplier_name=${encodeURIComponent(suppName)}`).catch(() => []),
        fetchApi(`/purchases?supplier=${encodeURIComponent(suppName)}`).catch(() => []),
        fetchApi('/suppliers').catch(() => []),
        fetchApi(`/supplier/analytics?supplier_name=${encodeURIComponent(suppName)}`).catch(() => null),
        fetchApi(`/supplier/replenishment-triggers?supplier_name=${encodeURIComponent(suppName)}`).catch(() => ({ triggers: [], low_stock: [], out_of_stock: [] })),
        fetchApi(`/supplier/qc-logs?supplier_name=${encodeURIComponent(suppName)}`).catch(() => []),
        fetchApi(`/supplier/rmas?supplier_name=${encodeURIComponent(suppName)}`).catch(() => [])
      ]);

      setSupplierProducts(Array.isArray(prodsRes) ? prodsRes : []);
      setSupplierShipments(Array.isArray(shipmentsRes) ? shipmentsRes : []);
      setSupplierInvoices(Array.isArray(invoicesRes) ? invoicesRes : []);
      setPurchases(Array.isArray(posRes) ? posRes : []);
      setAnalyticsData(analyticsRes || null);
      setTriggersData(triggersRes || { triggers: [], low_stock: [], out_of_stock: [] });
      setQcLogs(Array.isArray(qcRes) ? qcRes : []);
      setRmas(Array.isArray(rmasRes) ? rmasRes : []);

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
      console.error('Error loading supplier data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupplierData(activeSupplier);
  }, [activeSupplier]);

  // Real-time PO Tracking & Toast Alert System
  const knownPoIdsRef = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (!purchases || purchases.length === 0) return;

    if (knownPoIdsRef.current === null) {
      // Baseline initialization
      knownPoIdsRef.current = new Set(purchases.map((p: any) => p.id));
      return;
    }

    const brandNewPOs = purchases.filter((p: any) => !knownPoIdsRef.current!.has(p.id));
    if (brandNewPOs.length > 0) {
      for (const newPo of brandNewPOs) {
        knownPoIdsRef.current.add(newPo.id);
        const storeName = newPo.store_name || "Ummi's Lane Enterprise";
        const totalGHS = Number(newPo.total_amount || newPo.total_cost || 0).toFixed(2);
        const lineCount = Array.isArray(newPo.items) ? newPo.items.length : 1;

        addToast({
          title: '📦 New Purchase Order Created!',
          message: `${storeName} owner created PO #PO-${newPo.id} (${lineCount} line item${lineCount === 1 ? '' : 's'} • GHS ${totalGHS}). Click to open shipment details.`,
          type: 'info',
          link: `/supplier/shipments?po_id=${newPo.id}`,
          duration: 9000
        });
      }
    }
  }, [purchases, addToast]);

  // Background poller for live POs and shipments every 7 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [posRes, shipmentsRes] = await Promise.all([
          fetchApi(`/purchases?supplier=${encodeURIComponent(activeSupplier)}`).catch(() => null),
          fetchApi(`/api/supplier/shipments?supplier_name=${encodeURIComponent(activeSupplier)}`).catch(() => null)
        ]);

        if (Array.isArray(posRes)) {
          setPurchases(posRes);
        }
        if (Array.isArray(shipmentsRes)) {
          setSupplierShipments(shipmentsRes);
        }
      } catch (err) {
        // Silently ignore background polling hiccup
      }
    }, 7000);

    return () => clearInterval(interval);
  }, [activeSupplier]);

  const activeSupplierRecord =
    suppliersListFull.find((s) => s.name.toLowerCase() === activeSupplier.toLowerCase()) || {
      id: 1,
      name: activeSupplier,
      contact_person: 'Corporate Key Accounts Desk',
      email: 'orders@vendor-gh.com',
      phone: '+233 30 257 0191',
      address: 'Industrial Area, Tema / Accra, Ghana',
      tax_id: 'TIN-GH90218821',
      payment_terms: 'Net 30',
      currency: 'GHS',
      lead_time_days: 3,
      moq: 24,
      quality_score: 96
    };

  // Secondary PO actions if needed by admin
  const handleAcknowledgePO = async (poId: number, notes: string) => {
    await fetchApi(`/purchases/${poId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
    addToast('Purchase Order acknowledged', 'success');
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  const handleDispatchPO = async (poId: number, carrier: string, trackingNumber: string, notes: string) => {
    await fetchApi(`/purchases/${poId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ carrier, tracking_number: trackingNumber, notes })
    });
    addToast(`Shipment dispatched with carrier ${carrier}`, 'success');
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  const handleUploadAttachment = async (poId: number, attachment: { name: string; type: string; size: string }) => {
    await fetchApi(`/purchases/${poId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(attachment)
    });
    addToast(`${attachment.name} linked to PO`, 'success');
    await loadSupplierData(activeSupplier);
  };

  const handleUpdateStatus = async (poId: number, status: string) => {
    if (status === 'received') {
      await fetchApi(`/purchases/${poId}/confirm-receipt`, { method: 'POST' });
      addToast('Goods received and stock verified', 'success');
    } else {
      await fetchApi(`/purchases/${poId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      addToast(`Status updated to ${status.toUpperCase()}`, 'info');
    }
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  const handleUpdateLogistics = async (poId: number, logistics: any) => {
    await fetchApi(`/purchases/${poId}/logistics`, {
      method: 'PUT',
      body: JSON.stringify(logistics)
    });
    addToast('Logistics updated', 'success');
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  const handleSaveMasterData = async (updated: any) => {
    const activeSupplierObj = suppliersListFull.find(
      (s) => s.name.toLowerCase() === activeSupplier.toLowerCase()
    );
    const supplierId = activeSupplierObj?.id || 1;
    await fetchApi(`/suppliers/${supplierId}/master-data`, {
      method: 'PUT',
      body: JSON.stringify(updated)
    });
    addToast('Supplier master profile updated', 'success');
    await loadSupplierData(activeSupplier);
  };

  const handleCreateQCLog = async (data: any) => {
    await fetchApi('/supplier/qc-logs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    addToast('QC Inspection logged', 'success');
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  const handleCreateRMA = async (data: any) => {
    await fetchApi('/supplier/rmas', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    addToast('RMA initiated', 'info');
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  const handleUpdateRMAStatus = async (id: number, status: string) => {
    await fetchApi(`/supplier/rmas/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    addToast(`RMA status updated to ${status.toUpperCase()}`, 'info');
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  const handleUpdateInvoiceStatus = async (poId: number, status: 'unpaid' | 'partially_paid' | 'approved' | 'paid') => {
    await fetchApi(`/purchases/${poId}/invoice-status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    addToast(`Invoice status updated to ${status.toUpperCase()}`, 'success');
    await loadSupplierData(activeSupplier);
    await refreshNotifications();
  };

  const handleRestockItem = async (item: any) => {
    navigate('/supplier/shipments');
  };

  return (
    <div className="space-y-6">
      {/* 
        ARCHITECTURAL MANDATE:
        - Completely removed generic "Quick Action" buttons (New PO, Upload Invoice, Submit ASN) from header/top bars.
        - Completely removed the top header banner with "Dedicated Page" / "Vendor: [select...]" that was showing across all pages.
        - Every action lives strictly inside its respective functional tab:
          * "Add New Product" strictly in ProductsTab
          * "Create Restock Shipment" strictly in ShipmentsTab
          * "Attach Invoice" strictly in InvoicesTab
          * Overview is 100% read-only status visibility
      */}

      {/* 1. OVERVIEW: Read-Only Hub */}
      {activeTab === 'overview' && (
        <SupplierOverview
          products={supplierProducts}
          shipments={supplierShipments}
          invoices={supplierInvoices}
          purchases={purchases}
          activeSupplier={activeSupplier}
          activeSupplierRecord={activeSupplierRecord}
          loading={loading}
          onNavigateTab={handleNavigateTab}
        />
      )}

      {/* 2. PRODUCTS: "My Products" (Context-bound "Add New Product" in table top right) */}
      {(activeTab === 'products' || activeTab === 'item_master') && (
        <SupplierProductsTab
          products={supplierProducts}
          activeSupplier={activeSupplier}
          onRefresh={() => loadSupplierData(activeSupplier)}
          userRole={user?.role}
        />
      )}

      {/* 3. SHIPMENTS: Restock & Logistics (Context-bound "Create Restock Shipment" in table top right) */}
      {(activeTab === 'shipments' || activeTab === 'pos') && (
        <SupplierShipmentsTab
          shipments={supplierShipments}
          products={supplierProducts}
          purchases={purchases}
          activeSupplier={activeSupplier}
          onRefresh={() => loadSupplierData(activeSupplier)}
          onAcknowledgePO={handleAcknowledgePO}
          onAttachInvoice={(shipment) => {
            setPreselectedShipment(shipment);
            setPreselectedPO(null);
            handleNavigateTab('invoices', '/supplier/invoices');
          }}
          onAttachInvoiceForPO={(po) => {
            setPreselectedPO(po);
            setPreselectedShipment(null);
            handleNavigateTab('invoices', '/supplier/invoices');
          }}
          userRole={user?.role}
        />
      )}

      {/* 4. INVOICES: Invoices & Earnings (Context-bound "Attach Invoice" next to delivered shipments or POs) */}
      {(activeTab === 'invoices' || activeTab === 'financial') && (
        <SupplierInvoicesTab
          invoices={supplierInvoices}
          shipments={supplierShipments}
          purchases={purchases}
          preselectedPO={preselectedPO}
          onClearPreselectedPO={() => setPreselectedPO(null)}
          activeSupplier={activeSupplier}
          onRefresh={() => loadSupplierData(activeSupplier)}
          userRole={user?.role}
          preselectedShipment={preselectedShipment}
          onClearPreselectedShipment={() => setPreselectedShipment(null)}
        />
      )}

      {/* Secondary Administration Tabs (Only rendered when specifically routed) */}
      {activeTab === 'replenishment' && (
        <ReplenishmentTriggers
          triggersData={triggersData}
          onRestockItem={handleRestockItem}
          onRefresh={() => loadSupplierData(activeSupplier)}
          loading={loading}
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
    </div>
  );
}
