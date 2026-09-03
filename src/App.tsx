/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
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

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" />;
}

function HomeRoute() {
  const { user } = useAuth();
  if (user?.role === 'supplier') {
    return <SupplierDashboard />;
  }
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SessionTimeoutManager />
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute><HomeRoute /></PrivateRoute>} />
            <Route path="/supplier-dashboard" element={<PrivateRoute><SupplierDashboard /></PrivateRoute>} />
            <Route path="/products" element={<PrivateRoute><Products /></PrivateRoute>} />
            <Route path="/products/:id" element={<PrivateRoute><ProductDetail /></PrivateRoute>} />
            <Route path="/sales" element={<PrivateRoute><Sales /></PrivateRoute>} />
            <Route path="/returns" element={<PrivateRoute><Returns /></PrivateRoute>} />
            <Route path="/purchases" element={<PrivateRoute><Purchases /></PrivateRoute>} />
            <Route path="/adjustments" element={<PrivateRoute><Adjustments /></PrivateRoute>} />
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
          </Routes>
        </NotificationProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
