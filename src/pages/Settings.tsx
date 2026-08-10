import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';

export default function Settings() {
  const [threshold, setThreshold] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchApi('/settings')
      .then(data => {
        if (data.low_stock_threshold) {
          setThreshold(parseInt(data.low_stock_threshold, 10));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await fetchApi('/settings', {
        method: 'PUT',
        body: JSON.stringify({ low_stock_threshold: threshold })
      });
      setMessage('Settings saved successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">System Settings</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm p-6 max-w-lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
              Low Stock Threshold
            </label>
            <input 
              type="number" 
              required 
              value={threshold} 
              onChange={e => setThreshold(parseInt(e.target.value, 10) || 0)}
              className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-2">
              Products with stock quantities at or below this value will trigger a warning on the dashboard.
            </p>
          </div>

          {message && (
            <div className="bg-green-50 text-green-600 text-[11px] font-bold uppercase tracking-wide p-3 rounded-sm border border-green-200">
              {message}
            </div>
          )}

          <div className="pt-4 border-t border-slate-200">
            <button 
              type="submit" 
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-sm font-semibold text-xs border-none hover:bg-blue-600 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
