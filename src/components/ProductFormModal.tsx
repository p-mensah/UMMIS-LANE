import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, 
  Package, 
  Tag, 
  Barcode, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Percent, 
  Sparkles, 
  RefreshCw,
  FolderTree,
  Hash,
  Copy,
  Check
} from 'lucide-react';
import { useFormValidation, validators } from '../lib/validation';
import { FormField, ValidatedInput, ValidatedSelect } from './common/FormField';
import { formatGHS } from '../lib/formatters';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { 
  generateSuggestedSku, 
  checkSkuUniqueness, 
  fetchSuggestedSkuFromApi,
  SkuSuggestion 
} from '../services/skuGenerator';

export interface ProductFormData {
  name: string;
  sku: string;
  category: string;
  sub_category?: string;
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
  categories: Array<{ id: number; name: string; parent_id?: number | null; parent_name?: string | null }>;
  existingProducts?: Array<{ id: number; sku: string; name?: string; category?: string }>;
}

export default function ProductFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingProduct,
  categories,
  existingProducts = [],
}: ProductFormModalProps) {
  const isEditing = !!editingProduct;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualSku, setIsManualSku] = useState(isEditing);
  const [skuFormat, setSkuFormat] = useState<'standard' | 'compact' | 'simple'>('standard');
  const [copiedSku, setCopiedSku] = useState(false);
  const [isCustomSubCategory, setIsCustomSubCategory] = useState(false);

  // Extract all existing SKUs from existingProducts list
  const existingSkusList = useMemo(() => {
    return existingProducts.map(p => p.sku).filter(Boolean);
  }, [existingProducts]);

  // Separate parent categories from sub-categories
  const parentCategories = useMemo(() => {
    const parents = categories.filter(c => !c.parent_id);
    return parents.length > 0 ? parents : categories;
  }, [categories]);

  const initialValues: ProductFormData = useMemo(() => {
    if (editingProduct) {
      return {
        name: editingProduct.name || '',
        sku: editingProduct.sku || '',
        category: editingProduct.category || '',
        sub_category: editingProduct.sub_category || '',
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

    // Default auto-generated SKU on initial open
    const defaultSuggestion = generateSuggestedSku({
      category: categories[0]?.name || 'General',
      existingSkus: existingSkusList,
      format: 'standard'
    });

    return {
      name: '',
      sku: defaultSuggestion.sku,
      category: categories[0]?.name || '',
      sub_category: '',
      cost_price: 0,
      selling_price: 0,
      stock_quantity: 0,
      barcode: '',
      brand: '',
      unit_of_measure: 'pcs',
      image_url: '',
      min_stock_level: 10,
    };
  }, [editingProduct, categories, existingSkusList]);

  const validationRules = useMemo(() => ({
    name: [
      validators.required('Product name is required'),
      validators.minLength(2, 'Name must be at least 2 characters'),
    ],
    sku: [
      validators.required('SKU code is required'),
      validators.pattern(/^[A-Za-z0-9\-_.]+$/, 'SKU may only contain letters, numbers, hyphens, or dots'),
      (val: any) => {
        const check = checkSkuUniqueness(val, existingProducts, editingProduct?.id);
        if (!check.isUnique && check.conflictProduct) {
          return `SKU is already in use by "${check.conflictProduct.name}"`;
        }
        return null;
      }
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
  }), [existingProducts, editingProduct]);

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
    setIsManualSku(isEditing);
    setIsCustomSubCategory(false);
  }, [initialValues, reset, isEditing]);

  useModalDismiss(isOpen, onClose);

  // Available sub-categories for the selected category
  const availableSubCategories = useMemo(() => {
    if (!values.category) return [];
    const selectedCatObj = categories.find(
      c => c.name.toLowerCase() === values.category.toLowerCase()
    );
    if (!selectedCatObj) return [];

    return categories.filter(c => c.parent_id === selectedCatObj.id);
  }, [categories, values.category]);

  // Current live SKU suggestion computed by the SKU generator service
  const currentSkuSuggestion: SkuSuggestion = useMemo(() => {
    return generateSuggestedSku({
      category: values.category,
      subCategory: values.sub_category,
      existingSkus: existingSkusList,
      format: skuFormat
    });
  }, [values.category, values.sub_category, existingSkusList, skuFormat]);

  // Check uniqueness of the current entered SKU
  const skuUniquenessStatus = useMemo(() => {
    return checkSkuUniqueness(values.sku, existingProducts, editingProduct?.id);
  }, [values.sku, existingProducts, editingProduct]);

  // Automatically update SKU when category or sub-category changes (if not manually overridden)
  const handleCategorySelect = (newCategory: string) => {
    handleChange('category', newCategory);
    handleChange('sub_category', '');
    setIsCustomSubCategory(false);

    if (!isEditing && !isManualSku) {
      const suggestion = generateSuggestedSku({
        category: newCategory,
        subCategory: '',
        existingSkus: existingSkusList,
        format: skuFormat
      });
      handleChange('sku', suggestion.sku);
    }
  };

  const handleSubCategorySelect = (newSubCategory: string) => {
    if (newSubCategory === '__custom__') {
      setIsCustomSubCategory(true);
      handleChange('sub_category', '');
      return;
    }

    setIsCustomSubCategory(false);
    handleChange('sub_category', newSubCategory);

    if (!isEditing && !isManualSku) {
      const suggestion = generateSuggestedSku({
        category: values.category,
        subCategory: newSubCategory,
        existingSkus: existingSkusList,
        format: skuFormat
      });
      handleChange('sku', suggestion.sku);
    }
  };

  const handleCustomSubCategoryChange = (val: string) => {
    handleChange('sub_category', val);
    if (!isEditing && !isManualSku) {
      const suggestion = generateSuggestedSku({
        category: values.category,
        subCategory: val,
        existingSkus: existingSkusList,
        format: skuFormat
      });
      handleChange('sku', suggestion.sku);
    }
  };

  // Re-generate or apply a specific suggested format
  const handleApplySuggestion = (targetSku: string, formatStyle?: 'standard' | 'compact' | 'simple') => {
    if (formatStyle) setSkuFormat(formatStyle);
    handleChange('sku', targetSku);
    setIsManualSku(false);
  };

  const handleRegenerateSku = async () => {
    // Attempt backend authoritative suggestion first, then client fallback
    const suggestion = await fetchSuggestedSkuFromApi(
      values.category,
      values.sub_category,
      existingSkusList
    );
    handleChange('sku', suggestion.sku);
    setIsManualSku(false);
  };

  const copySkuToClipboard = () => {
    if (values.sku) {
      navigator.clipboard.writeText(values.sku);
      setCopiedSku(true);
      setTimeout(() => setCopiedSku(false), 2000);
    }
  };

  if (!isOpen) return null;

  // Margin and markup calculations
  const cost = Number(values.cost_price) || 0;
  const price = Number(values.selling_price) || 0;
  const grossProfit = price - cost;
  const marginPercent = price > 0 ? ((grossProfit / price) * 100).toFixed(1) : '0.0';
  const markupPercent = cost > 0 ? ((grossProfit / cost) * 100).toFixed(1) : '0.0';

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = { ...values };
    if (!finalData.sku || !finalData.sku.trim()) {
      finalData.sku = currentSkuSuggestion.sku;
      handleChange('sku', finalData.sku);
    }
    if (!validateAll()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(finalData);
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
      <div className="bg-white rounded-xl max-w-3xl w-full border border-slate-200 shadow-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
                {isEditing ? 'Update specifications, pricing, and reorder levels' : 'Intelligent sequential SKU auto-assignment by category & sub-category'}
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
          
          {/* ================= 1. PRODUCT TITLE & BASIC DETAILS ================= */}
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
                placeholder="e.g., Bel-Aqua Mineral Water 750ml"
                error={errors.name}
                isTouched={touched.name}
                isValid={!errors.name && !!values.name}
              />
            </FormField>

            <FormField
              label="Brand / Manufacturer"
              helperText="Optional manufacturer or brand name"
            >
              <ValidatedInput
                name="brand"
                value={values.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                onBlur={() => handleBlur('brand')}
                placeholder="e.g., Bel-Beverages, Nestlé, Gino"
              />
            </FormField>
          </div>

          {/* ================= 2. CATEGORY & SUB-CATEGORY SELECTION ================= */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-700">
              <span className="flex items-center gap-1.5">
                <FolderTree size={14} className="text-blue-600" />
                Category & Sub-Category Hierarchy
              </span>
              <span className="text-[10px] text-slate-400 normal-case font-medium">
                Drives automatic sequential SKU code prefixing
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Category Dropdown */}
              <FormField
                label="Category"
                required
                error={errors.category}
                isTouched={touched.category}
                isValid={!errors.category && !!values.category}
                helperText="Primary classification"
              >
                <ValidatedSelect
                  name="category"
                  value={values.category}
                  onChange={(e) => handleCategorySelect(e.target.value)}
                  onBlur={() => handleBlur('category')}
                  error={errors.category}
                  isTouched={touched.category}
                  isValid={!errors.category && !!values.category}
                >
                  <option value="">-- Choose Category --</option>
                  {parentCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </ValidatedSelect>
              </FormField>

              {/* Sub-Category Dropdown / Input */}
              <FormField
                label="Sub-Category (Optional)"
                helperText={isCustomSubCategory ? 'Custom sub-category title' : 'Refines SKU prefixing (e.g. Juices -> JUC)'}
              >
                {!isCustomSubCategory ? (
                  <div className="space-y-1.5">
                    <ValidatedSelect
                      name="sub_category"
                      value={values.sub_category || ''}
                      onChange={(e) => handleSubCategorySelect(e.target.value)}
                    >
                      <option value="">-- General / None --</option>
                      {availableSubCategories.map((sub) => (
                        <option key={sub.id} value={sub.name}>
                          {sub.name}
                        </option>
                      ))}
                      <option value="__custom__">+ Enter Custom Sub-Category...</option>
                    </ValidatedSelect>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <ValidatedInput
                      name="sub_category_custom"
                      value={values.sub_category || ''}
                      onChange={(e) => handleCustomSubCategoryChange(e.target.value)}
                      placeholder="e.g. Mineral Water, Soft Drinks"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomSubCategory(false);
                        handleSubCategorySelect('');
                      }}
                      className="px-2 py-2 text-slate-500 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded text-[11px] font-bold shrink-0 transition"
                      title="Back to list"
                    >
                      List
                    </button>
                  </div>
                )}
              </FormField>
            </div>
          </div>

          {/* ================= 3. INTELLIGENT SKU GENERATOR SERVICE PANEL ================= */}
          <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-blue-100 pb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-600" />
                <span className="font-black text-slate-900 text-[11px] uppercase tracking-wider">
                  Automated SKU Generator Service
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase inline-flex items-center gap-0.5 border border-emerald-200">
                  Seq #{currentSkuSuggestion.formattedSequence}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRegenerateSku}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer transition"
                  title="Generate next sequential code for this category"
                >
                  <RefreshCw size={11} />
                  <span>Regenerate Next</span>
                </button>
              </div>
            </div>

            {/* SKU Input and Quick Actions */}
            <FormField
              label={
                <div className="flex items-center justify-between w-full">
                  <span>Product SKU Code</span>
                  <div className="flex items-center gap-2">
                    {skuUniquenessStatus.isUnique ? (
                      <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Unique Code Available
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                        <AlertTriangle size={11} /> Conflict Detected
                      </span>
                    )}
                  </div>
                </div>
              }
              required
              error={errors.sku}
              isTouched={touched.sku}
              isValid={!errors.sku && !!values.sku}
              helperText={`Format: [Category Prefix]-[SubCategory Prefix]-[Sequence Number] (e.g., ${currentSkuSuggestion.sku})`}
            >
              <div className="relative">
                <ValidatedInput
                  name="sku"
                  value={values.sku}
                  onChange={(e) => {
                    handleChange('sku', e.target.value.toUpperCase());
                    setIsManualSku(true);
                  }}
                  onBlur={() => handleBlur('sku')}
                  placeholder="e.g., BEV-WAT-001"
                  className="font-mono uppercase font-bold text-slate-900 tracking-wider pr-24"
                  error={errors.sku}
                  isTouched={touched.sku}
                  isValid={!errors.sku && !!values.sku && skuUniquenessStatus.isUnique}
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={copySkuToClipboard}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                    title="Copy SKU code"
                  >
                    {copiedSku ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>
                  {isManualSku && (
                    <button
                      type="button"
                      onClick={() => handleApplySuggestion(currentSkuSuggestion.sku)}
                      className="px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-[9px] font-bold transition"
                      title="Reset to recommended code"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </FormField>

            {/* Quick Format Style Alternatives */}
            <div className="pt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">
                Suggested Formats:
              </span>
              {currentSkuSuggestion.alternatives.map((alt) => {
                const isSelected = values.sku === alt.sku;
                return (
                  <button
                    key={alt.sku}
                    type="button"
                    onClick={() => handleApplySuggestion(alt.sku, alt.style)}
                    className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition flex items-center gap-1 border cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <span>{alt.sku}</span>
                    <span className={`text-[8.5px] opacity-75`}>({alt.style})</span>
                  </button>
                );
              })}
            </div>

            {/* Uniqueness Feedback or Conflict Resolution */}
            {!skuUniquenessStatus.isUnique && skuUniquenessStatus.conflictProduct && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] flex items-center justify-between">
                <span>
                  <strong>Conflict:</strong> SKU is already assigned to <em>"{skuUniquenessStatus.conflictProduct.name}"</em>.
                </span>
                <button
                  type="button"
                  onClick={() => handleApplySuggestion(currentSkuSuggestion.sku)}
                  className="font-bold underline text-rose-900 ml-2 cursor-pointer"
                >
                  Use Next Available ({currentSkuSuggestion.sku})
                </button>
              </div>
            )}
          </div>

          {/* ================= 4. PRICING & MARGINS SECTION ================= */}
          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <span className="flex items-center gap-1.5">
                <Tag size={14} className="text-emerald-600" />
                Pricing & Profit Margins
              </span>
              <span className="text-[10px] text-slate-400 font-medium normal-case">
                Live retail margin estimation
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                label="Cost Price (₵)"
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
                label="Selling Price (₵)"
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

          {/* ================= 5. INVENTORY & PACKAGING ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {!isEditing ? (
              <FormField
                label="Initial Stock Quantity"
                required
                error={errors.stock_quantity}
                isTouched={touched.stock_quantity}
                isValid={!errors.stock_quantity && values.stock_quantity >= 0}
                helperText="Opening units on shelf"
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
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current On-Hand</span>
                <span className="text-base font-black text-slate-900 font-mono mt-0.5">
                  {values.stock_quantity} {values.unit_of_measure}
                </span>
              </div>
            )}

            <FormField
              label="Unit of Measure"
              helperText="Packaging sales unit"
            >
              <ValidatedInput
                name="unit_of_measure"
                value={values.unit_of_measure}
                onChange={(e) => handleChange('unit_of_measure', e.target.value)}
                onBlur={() => handleBlur('unit_of_measure')}
                placeholder="pcs, cans, bags, kg"
              />
            </FormField>

            <FormField
              label="Low Stock Alert Level"
              error={errors.min_stock_level}
              isTouched={touched.min_stock_level}
              isValid={!errors.min_stock_level && values.min_stock_level >= 0}
              helperText="Reorder alert trigger"
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

          {/* ================= 6. OPTIONAL BARCODE & IMAGE ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              label="Barcode / EAN (Optional)"
              error={errors.barcode}
              isTouched={touched.barcode}
              isValid={!errors.barcode && !!values.barcode}
              helperText="Physical barcode scanner code"
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
                disabled={isSubmitting || !isValid || !skuUniquenessStatus.isUnique}
                className={`px-5 py-2 text-white font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                  !isValid || !skuUniquenessStatus.isUnique
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
