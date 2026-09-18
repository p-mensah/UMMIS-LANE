import React, { useEffect, useState, useMemo } from 'react';
import { fetchApi } from '../lib/api';
import { Users, Search, Plus, CreditCard, Mail, Phone, Award, X, CheckCircle2, UserPlus } from 'lucide-react';
import { formatGHS } from '../lib/formatters';
import { useFormValidation, validators } from '../lib/validation';
import { FormField, ValidatedInput } from '../components/common/FormField';

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
}

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function AddCustomerModal({ isOpen, onClose, onSuccess }: AddCustomerModalProps) {
  const initialValues: CustomerFormData = useMemo(() => ({
    name: '',
    phone: '',
    email: '',
  }), []);

  const validationRules = useMemo(() => ({
    name: [
      validators.required('Customer full name is required'),
      validators.minLength(2, 'Name must be at least 2 characters'),
    ],
    phone: [
      validators.phone('Please enter a valid phone number (e.g. 0241234567 or +233...)'),
    ],
    email: [
      validators.email('Please enter a valid email address'),
    ],
  }), []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isValid,
    resetForm,
  } = useFormValidation<CustomerFormData>(initialValues, validationRules);

  const handleCustomerSubmit = handleSubmit(async (formValues) => {
    setIsSubmitting(true);
    try {
      await fetchApi('/customers', {
        method: 'POST',
        body: JSON.stringify(formValues),
      });
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create customer');
    } finally {
      setIsSubmitting(false);
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <UserPlus size={16} />
            </div>
            <div>
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Add Customer</h2>
              <p className="text-[11px] text-slate-400 font-medium">Register client profile & loyalty tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleCustomerSubmit} className="p-5 space-y-4 text-xs">
          <FormField
            label="Customer Name"
            required
            error={errors.name}
            isTouched={touched.name}
            isValid={!errors.name && !!values.name}
            helperText="Full legal or business account name"
          >
            <ValidatedInput
              name="name"
              value={values.name}
              onChange={(e) => handleChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              placeholder="e.g. Samuel K. Addo"
              error={errors.name}
              isTouched={touched.name}
              isValid={!errors.name && !!values.name}
            />
          </FormField>

          <FormField
            label="Phone Number"
            error={errors.phone}
            isTouched={touched.phone}
            isValid={!errors.phone && !!values.phone}
            helperText="Ghana mobile or international contact (+233)"
          >
            <ValidatedInput
              name="phone"
              value={values.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              onBlur={() => handleBlur('phone')}
              placeholder="024 123 4567"
              error={errors.phone}
              isTouched={touched.phone}
              isValid={!errors.phone && !!values.phone}
            />
          </FormField>

          <FormField
            label="Email Address"
            error={errors.email}
            isTouched={touched.email}
            isValid={!errors.email && !!values.email}
            helperText="For receipts and notifications"
          >
            <ValidatedInput
              type="email"
              name="email"
              value={values.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              placeholder="customer@domain.com"
              error={errors.email}
              isTouched={touched.email}
              isValid={!errors.email && !!values.email}
            />
          </FormField>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">
              <span className="text-rose-500 font-bold">*</span> Required field
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isValid}
                className={`px-4 py-1.5 font-bold text-white rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                  !isValid
                    ? 'bg-slate-400 opacity-60 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <CheckCircle2 size={13} />
                {isSubmitting ? 'Saving...' : 'Register Customer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    fetchApi('/customers').then(setCustomers).finally(() => setLoading(false));
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery)) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
           <h1 className="text-[20px] font-bold text-slate-900 tracking-tight text-left">Customer Database</h1>
           <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest mt-1">Loyalty & Spending History</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-slate-200 rounded-sm pl-10 pr-4 py-2 text-[13px] focus:outline-none focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={() => setShowModal(true)} 
            className="flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-sm font-bold text-[12px] uppercase tracking-widest hover:bg-slate-800 transition shadow-sm w-full sm:w-auto cursor-pointer"
          >
            <Plus size={16} className="mr-2" /> Add Customer
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Client Name</th>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Contact Details</th>
              <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">Points</th>
              <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-widest text-emerald-600">Total Spent</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filteredCustomers.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-[13px] font-black text-slate-900 uppercase">{c.name}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">Registration ID: #{c.id}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                   <div className="flex flex-col gap-1">
                      {c.phone && (
                        <span className="text-[12px] font-bold text-slate-600 flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-400" /> {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="text-[12px] text-slate-500 flex items-center gap-1.5">
                          <Mail size={12} className="text-slate-400" /> {c.email}
                        </span>
                      )}
                      {!c.phone && !c.email && (
                        <span className="text-[12px] text-slate-400 italic">No contact info</span>
                      )}
                   </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Award size={11} className="mr-1" /> {c.points || 0} pts
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-[13px] font-bold text-slate-900">
                  {formatGHS(c.total_spent || 0)}
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && !loading && (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-[13px] font-medium italic">No matching customers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AddCustomerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
