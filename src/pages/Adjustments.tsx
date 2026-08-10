import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';

export default function Adjustments() {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/inventory/adjustments')
      .then(setAdjustments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Stock Adjustments History</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Product</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">User</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Change</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reason</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {adjustments.map(adj => (
              <tr key={adj.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{new Date(adj.created_at + 'Z').toLocaleString()}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] font-medium text-slate-900">{adj.product_name}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{adj.user_name}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px]">
                  <span className={`font-bold ${adj.quantity_change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                  </span>
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{adj.reason}</td>
              </tr>
            ))}
            {adjustments.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500 text-[13px]">No stock adjustments recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
