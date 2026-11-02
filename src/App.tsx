/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ChatProvider } from './context/ChatContext';
import SessionTimeoutManager from './components/SessionTimeoutManager';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Adjustments from './pages/Adjustments';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Customers from './pages/Customers';
import Expenses from './pages/Expenses';
import Shifts from './pages/Shifts';
import Categories from './pages/Categories';
import Suppliers from './pages/Suppliers';
import Transactions from './pages/Transactions';
import AuditLogs from './pages/AuditLogs';
import ProductDetail from './pages/ProductDetail';
import Returns from './pages/Returns';
import SupplierDashboard from './pages/SupplierDashboard';
import Communication from './pages/Communication';
import TabletInventory from './pages/TabletInventory';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Loading Ummis Retail OS...</span>
        </div>
      </div>
    );
  }
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

function HomeRoute() {
  const { user } = useAuth();
  if (user?.role === 'supplier') {
    return <SupplierDashboard initialTab="overview" />;
  }
  return <Dashboard />;
}

function PurchasesRoute() {
  const { user } = useAuth();
  if (user?.role === 'supplier') {
    return <SupplierDashboard initialTab="shipments" />;
  }
  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return <Navigate to="/" replace />;
  }
  return <Purchases />;
}

function ProductsRoute() {
  const { user } = useAuth();
  if (user?.role === 'supplier') {
    return <SupplierDashboard initialTab="products" />;
  }
  return <Products />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SessionTimeoutManager />
        <NotificationProvider>
          <ChatProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<PrivateRoute><HomeRoute /></PrivateRoute>} />
              <Route path="/communication" element={<PrivateRoute><Communication /></PrivateRoute>} />
              <Route path="/supplier-dashboard" element={<PrivateRoute><SupplierDashboard initialTab="overview" /></PrivateRoute>} />
              <Route path="/supplier/overview" element={<PrivateRoute><SupplierDashboard initialTab="overview" /></PrivateRoute>} />
              <Route path="/supplier/products" element={<PrivateRoute><SupplierDashboard initialTab="products" /></PrivateRoute>} />
              <Route path="/supplier/shipments" element={<PrivateRoute><SupplierDashboard initialTab="shipments" /></PrivateRoute>} />
              <Route path="/supplier/invoices" element={<PrivateRoute><SupplierDashboard initialTab="invoices" /></PrivateRoute>} />
              <Route path="/supplier/pos" element={<PrivateRoute><SupplierDashboard initialTab="shipments" /></PrivateRoute>} />
              <Route path="/supplier/inventory" element={<PrivateRoute><SupplierDashboard initialTab="products" /></PrivateRoute>} />
              <Route path="/supplier/catalog" element={<PrivateRoute><SupplierDashboard initialTab="products" /></PrivateRoute>} />
              <Route path="/supplier/analytics" element={<PrivateRoute><SupplierDashboard initialTab="analytics" /></PrivateRoute>} />
              <Route path="/supplier/qc" element={<PrivateRoute><SupplierDashboard initialTab="qc_rma" /></PrivateRoute>} />
              <Route path="/supplier/profile" element={<PrivateRoute><SupplierDashboard initialTab="master_data" /></PrivateRoute>} />
              <Route path="/supplier/reports" element={<PrivateRoute><SupplierDashboard initialTab="reports" /></PrivateRoute>} />
              <Route path="/supplier/messages" element={<PrivateRoute><Communication /></PrivateRoute>} />
              <Route path="/products" element={<PrivateRoute><ProductsRoute /></PrivateRoute>} />
              <Route path="/products/:id" element={<PrivateRoute><ProductDetail /></PrivateRoute>} />
              <Route path="/sales" element={<PrivateRoute><Sales /></PrivateRoute>} />
              <Route path="/returns" element={<PrivateRoute><Returns /></PrivateRoute>} />
              <Route path="/purchases" element={<PrivateRoute><PurchasesRoute /></PrivateRoute>} />
              <Route path="/adjustments" element={<PrivateRoute><Adjustments /></PrivateRoute>} />
              <Route path="/inventory" element={<PrivateRoute><Navigate to="/adjustments" replace /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
              <Route path="/reports" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />
              <Route path="/customers" element={<PrivateRoute><Customers /></PrivateRoute>} />
              <Route path="/expenses" element={<PrivateRoute><Expenses /></PrivateRoute>} />
              <Route path="/shifts" element={<PrivateRoute><Shifts /></PrivateRoute>} />
              <Route path="/categories" element={<PrivateRoute><Categories /></PrivateRoute>} />
              <Route path="/suppliers" element={<PrivateRoute><Suppliers /></PrivateRoute>} />
              <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
              <Route path="/audit-logs" element={<PrivateRoute><AuditLogs /></PrivateRoute>} />
              <Route path="/tablet-pos" element={<PrivateRoute><Navigate to="/sales?mode=tablet" replace /></PrivateRoute>} />
              <Route path="/tablet-inventory" element={<PrivateRoute><TabletInventory /></PrivateRoute>} />
              <Route path="/tablet-mode" element={<PrivateRoute><TabletInventory /></PrivateRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ChatProvider>
        </NotificationProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
