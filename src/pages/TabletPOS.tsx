import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import TabletPOSLayout, { CartItem } from '../components/tablet/TabletPOSLayout';

export default function TabletPOS() {
  const navigate = useNavigate();
  const { addToast } = useNotifications();
  const { user } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, cats, custs] = await Promise.all([
        fetchApi('/products'),
        fetchApi('/categories'),
        fetchApi('/customers').catch(() => [])
      ]);
      setProducts(Array.isArray(prods) ? prods : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setCustomers(Array.isArray(custs) ? custs : []);
    } catch (err: any) {
      addToast(err.message || 'Failed to load POS inventory', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle checkout via backend
  const handleCheckout = async (
    items: CartItem[],
    customerId: string | null,
    paymentMethod: string
  ) => {
    try {
      const res = await fetchApi('/sales', {
        method: 'POST',
        body: JSON.stringify({
          items,
          customer_id: customerId ? parseInt(customerId, 10) : null,
          payment_method: paymentMethod
        })
      });

      addToast('Sale transaction recorded successfully!', 'success');
      // Silently reload product inventory in background to update stock levels
      fetchApi('/products').then(p => {
        if (Array.isArray(p)) setProducts(p);
      }).catch(() => {});

      return res;
    } catch (err: any) {
      addToast(err.message || 'Failed to process sale', 'error');
      throw err;
    }
  };

  return (
    <div className="fixed inset-0 z-50 w-full h-[100dvh] bg-slate-900 overflow-hidden">
      {loading ? (
        <div className="h-full flex flex-col items-center justify-center text-white space-y-3 bg-slate-900">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-400">Loading Tablet POS Terminal...</p>
        </div>
      ) : (
        <TabletPOSLayout
          products={products}
          categories={categories}
          customers={customers}
          user={user}
          onCheckout={handleCheckout}
          onExitTabletMode={() => navigate('/sales')}
          onRefresh={loadData}
          isLoading={loading}
        />
      )}
    </div>
  );
}
