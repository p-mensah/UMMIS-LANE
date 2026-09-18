import React, { useState, useEffect, useMemo } from 'react';
import { X, Package, DollarSign, Barcode, CheckCircle2, AlertTriangle, Layers, Percent } from 'lucide-react';
import { useFormValidation, validators } from '../lib/validation';
import { FormField, ValidatedInput, ValidatedSelect } from './common/FormField';
import { formatGHS } from '../lib/formatters';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface ProductFormData {
  name: string;
  sku: string;
  category: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  barcode: string;
  brand: string;
  unit_of_measure: string;
  image_url: string;
  min_stock_level: number;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => Promise<void>;
  editingProduct?: any | null;
  categories: Array<{ id: number; name: string }>;
}

export default function ProductFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingProduct,
  categories,
}: ProductFormModalProps) {
  const isEditing = !!editingProduct;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialValues: ProductFormData = useMemo(() => {
    if (editingProduct) {
      return {
        name: editingProduct.name || '',
        sku: editingProduct.sku || '',
        category: editingProduct.category || '',
        cost_price: Number(editingProduct.cost_price) || 0,
        selling_price: Number(editingProduct.selling_price) || 0,
        stock_quantity: Number(editingProduct.stock_quantity) || 0,
        barcode: editingProduct.barcode || '',
        brand: editingProduct.brand || '',
        unit_of_measure: editingProduct.unit_of_measure || 'pcs',
        image_url: editingProduct.image_url || '',
        min_stock_level: editingProduct.min_stock_level ?? 10,
      };
    }
    return {
      name: '',
      sku: '',
      category: '',
      cost_price: 0,
      selling_price: 0,
      stock_quantity: 0,
      barcode: '',
      brand: '',
      unit_of_measure: 'pcs',
      image_url: '',
      min_stock_level: 10,
    };
  }, [editingProduct]);

  const validationRules = useMemo(() => ({
    name: [
      validators.required('Product name is required'),
      validators.minLength(2, 'Name must be at least 2 characters'),
    ],
    sku: [
      validators.required('SKU code is required'),
      validators.pattern(/^[A-Za-z0-9\-_.]+$/, 'SKU may only contain letters, numbers, hyphens, or dots'),
    ],
    category: [
      validators.required('Please select a category'),
    ],
    cost_price: [
      validators.required('Cost price is required'),
      validators.min(0, 'Cost price cannot be negative'),
    ],
    selling_price: [
      validators.required('Selling price is required'),
      validators.min(0.01, 'Selling price must be greater than zero'),
      (val: any, all: any) => {
        if (all && Number(val) < Number(all.cost_price)) {
          return 'Selling price is below unit cost (negative profit margin)';
        }
        return null;
      },
    ],
    stock_quantity: [
      validators.min(0, 'Stock quantity cannot be negative'),
    ],
    min_stock_level: [
      validators.min(0, 'Minimum stock alert level cannot be negative'),
    ],
    barcode: [
      validators.pattern(/^[A-Za-z0-9]*$/, 'Barcode must be alphanumeric'),
    ],
    image_url: [
      validators.url('Please enter a valid HTTP or HTTPS image URL'),
    ],
  }), []);

  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    reset,
    isValid,
  } = useFormValidation<ProductFormData>(initialValues, validationRules);

  // Keep form in sync when editingProduct changes
  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  useModalDismiss(isOpen, onClose);

  if (!isOpen) return null;

  // Margin and markup calculations
  const cost = Number(values.cost_price) || 0;
  const price = Number(values.selling_price) || 0;
  const grossProfit = price - cost;
  const marginPercent = price > 0 ? ((grossProfit / price) * 100).toFixed(1) : '0.0';
  const markupPercent = cost > 0 ? ((grossProfit / cost) * 100).toFixed(1) : '0.0';

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Package size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                {isEditing ? `Edit Product — ${editingProduct.name}` : 'Create New Product Catalog Item'}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {isEditing ? 'Update specifications, pricing, and reorder levels' : 'Enter product details with live validation feedback'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs">
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Product Title / Name"
              required
              error={errors.name}
              isTouched={touched.name}
              isValid={!errors.name && !!values.name}
              helperText="Full descriptive name of the item"
            >
              <ValidatedInput
                name="name"
                value={values.name}
                onChange={(e) => handleChange('name', e.target.value)}
                onBlur={() => handleBlur('name')}
                placeholder="e.g., Ceramic Brake Pads - Front"
                error={errors.name}
                isTouched={touched.name}
                isValid={!errors.name && !!values.name}
              />
            </FormField>

            <FormField
              label="SKU Identifier"
              required
              error={errors.sku}
              isTouched={touched.sku}
              isValid={!errors.sku && !!values.sku}
              helperText="Unique product stock keeping unit"
            >
              <ValidatedInput
                name="sku"
                value={values.sku}
                onChange={(e) => handleChange('sku', e.target.value)}
                onBlur={() => handleBlur('sku')}
                placeholder="e.g., BP-FRT-001"
                className="font-mono uppercase"
                error={errors.sku}
                isTouched={touched.sku}
                isValid={!errors.sku && !!values.sku}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField
              label="Category"
              required
              error={errors.category}
              isTouched={touched.category}
              isValid={!errors.category && !!values.category}
            >
              <ValidatedSelect
                name="category"
                value={values.category}
                onChange={(e) => handleChange('category', e.target.value)}
                onBlur={() => handleBlur('category')}
                error={errors.category}
                isTouched={touched.category}
                isValid={!errors.category && !!values.category}
              >
                <option value="">-- Choose Category --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </ValidatedSelect>
            </FormField>

            <FormField
              label="Brand / Manufacturer"
              helperText="Optional manufacturer name"
            >
              <ValidatedInput
                name="brand"
                value={values.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                onBlur={() => handleBlur('brand')}
                placeholder="e.g., Bosch, Toyota, Generic"
              />
            </FormField>

            <FormField
              label="Unit of Measure"
              helperText="Packaging or sales unit"
            >
              <ValidatedInput
                name="unit_of_measure"
                value={values.unit_of_measure}
                onChange={(e) => handleChange('unit_of_measure', e.target.value)}
                onBlur={() => handleBlur('unit_of_measure')}
                placeholder="pcs, set, box, kg"
              />
            </FormField>
          </div>

          {/* Pricing & Financial Metrics Section */}
          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <span className="flex items-center gap-1.5">
                <DollarSign size={14} className="text-emerald-600" />
                Pricing & Margins
              </span>
              <span className="text-[10px] text-slate-400 font-medium normal-case">
                Live GHS profit estimation
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                label="Cost Price (GH₵)"
                required
                error={errors.cost_price}
                isTouched={touched.cost_price}
                isValid={!errors.cost_price && values.cost_price >= 0}
                helperText="Purchase cost from supplier"
              >
                <ValidatedInput
                  type="number"
                  step="0.01"
                  min="0"
                  name="cost_price"
                  value={values.cost_price}
                  onChange={(e) => handleChange('cost_price', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  onBlur={() => handleBlur('cost_price')}
                  error={errors.cost_price}
                  isTouched={touched.cost_price}
                  isValid={!errors.cost_price && values.cost_price >= 0}
                  className="font-mono font-semibold"
                />
              </FormField>

              <FormField
                label="Selling Price (GH₵)"
                required
                error={errors.selling_price}
                isTouched={touched.selling_price}
                isValid={!errors.selling_price && values.selling_price > 0}
                helperText="Retail price charged at checkout"
              >
                <ValidatedInput
                  type="number"
                  step="0.01"
                  min="0"
                  name="selling_price"
                  value={values.selling_price}
                  onChange={(e) => handleChange('selling_price', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  onBlur={() => handleBlur('selling_price')}
                  error={errors.selling_price}
                  isTouched={touched.selling_price}
                  isValid={!errors.selling_price && values.selling_price > 0}
                  className="font-mono font-semibold"
                />
              </FormField>
            </div>

            {/* Real-time Profit Preview Ribbon */}
            <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
              grossProfit < 0
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : grossProfit === 0
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            }`}>
              <div className="flex items-center gap-2">
                <Percent size={14} className={grossProfit < 0 ? 'text-rose-600' : 'text-emerald-600'} />
                <span className="font-bold">
                  {grossProfit < 0 ? 'Warning: Selling at Loss' : 'Estimated Margin:'}
                </span>
                <span className="font-mono font-black">{marginPercent}%</span>
                <span className="text-[11px] text-slate-500 font-medium">({markupPercent}% markup)</span>
              </div>
              <div className="font-mono font-black text-sm">
                Profit: {formatGHS(grossProfit)}/unit
              </div>
            </div>
          </div>

          {/* Stock & Reorder Levels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!isEditing ? (
              <FormField
                label="Initial Stock Quantity"
                required
                error={errors.stock_quantity}
                isTouched={touched.stock_quantity}
                isValid={!errors.stock_quantity && values.stock_quantity >= 0}
                helperText="Opening physical stock units on shelf"
              >
                <ValidatedInput
                  type="number"
                  min="0"
                  name="stock_quantity"
                  value={values.stock_quantity}
                  onChange={(e) => handleChange('stock_quantity', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                  onBlur={() => handleBlur('stock_quantity')}
                  error={errors.stock_quantity}
                  isTouched={touched.stock_quantity}
                  isValid={!errors.stock_quantity && values.stock_quantity >= 0}
                  className="font-mono font-semibold"
                />
              </FormField>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current Stock On-Hand</span>
                <span className="text-base font-black text-slate-900 font-mono mt-0.5">
                  {values.stock_quantity} {values.unit_of_measure}
                </span>
                <span className="text-[10px] text-slate-400">Use "Adjust Stock" on the catalog table to modify inventory balance</span>
              </div>
            )}

            <FormField
              label="Low Stock Alert Threshold"
              error={errors.min_stock_level}
              isTouched={touched.min_stock_level}
              isValid={!errors.min_stock_level && values.min_stock_level >= 0}
              helperText="Alert triggers when on-hand drops below this number"
            >
              <ValidatedInput
                type="number"
                min="0"
                name="min_stock_level"
                value={values.min_stock_level}
                onChange={(e) => handleChange('min_stock_level', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                onBlur={() => handleBlur('min_stock_level')}
                error={errors.min_stock_level}
                isTouched={touched.min_stock_level}
                isValid={!errors.min_stock_level && values.min_stock_level >= 0}
                className="font-mono font-semibold"
              />
            </FormField>
          </div>

          {/* Optional Barcode & Image */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              label="Barcode / EAN (Optional)"
              error={errors.barcode}
              isTouched={touched.barcode}
              isValid={!errors.barcode && !!values.barcode}
              helperText="Supports scanner input (alphanumeric)"
            >
              <ValidatedInput
                name="barcode"
                value={values.barcode}
                onChange={(e) => handleChange('barcode', e.target.value)}
                onBlur={() => handleBlur('barcode')}
                placeholder="Scan or type barcode"
                error={errors.barcode}
                isTouched={touched.barcode}
                isValid={!errors.barcode && !!values.barcode}
              />
            </FormField>

            <FormField
              label="Image URL (Optional)"
              error={errors.image_url}
              isTouched={touched.image_url}
              isValid={!errors.image_url && !!values.image_url}
              helperText="Direct image link"
            >
              <ValidatedInput
                type="url"
                name="image_url"
                value={values.image_url}
                onChange={(e) => handleChange('image_url', e.target.value)}
                onBlur={() => handleBlur('image_url')}
                placeholder="https://example.com/product.jpg"
                error={errors.image_url}
                isTouched={touched.image_url}
                isValid={!errors.image_url && !!values.image_url}
              />
            </FormField>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[11px] text-slate-400 font-medium">
              <span className="text-rose-500 font-bold">*</span> Required fields validated in real-time
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isValid}
                className={`px-5 py-2 text-white font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                  !isValid
                    ? 'bg-slate-400 opacity-60 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <CheckCircle2 size={14} />
                {isSubmitting
                  ? 'Saving...'
                  : isEditing
                  ? 'Update Product'
                  : 'Save New Product'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
