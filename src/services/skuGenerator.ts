import { fetchApi } from '../lib/api';

export interface SkuAlternative {
  label: string;
  sku: string;
  style: 'standard' | 'compact' | 'simple';
}

export interface SkuSuggestion {
  sku: string;
  categoryPrefix: string;
  subCategoryPrefix: string;
  basePrefix: string;
  sequence: number;
  formattedSequence: string;
  isUnique: boolean;
  alternatives: SkuAlternative[];
}

export interface GenerateSkuOptions {
  category?: string;
  subCategory?: string;
  existingSkus?: string[];
  format?: 'standard' | 'compact' | 'simple';
  padding?: number;
  customPrefix?: string;
}

// Canonical category code dictionary for standard retail categories
const CATEGORY_CODE_MAP: Record<string, string> = {
  'beverages': 'BEV',
  'beverage': 'BEV',
  'groceries': 'GRO',
  'grocery': 'GRO',
  'provisions': 'PRV',
  'provision': 'PRV',
  'dairy & frozen': 'DAI',
  'dairy and frozen': 'DAI',
  'dairy': 'DAI',
  'frozen': 'FRZ',
  'household & cleaning': 'HOU',
  'household': 'HOU',
  'cleaning': 'CLN',
  'snacks & sweets': 'SNK',
  'snacks': 'SNK',
  'sweets': 'SWT',
  'confectionery': 'CNF',
  'personal care': 'PER',
  'toiletries': 'TOI',
  'bakery & pastry': 'BAK',
  'bakery': 'BAK',
  'pastry': 'PAS',
  'canned goods': 'CAN',
  'electronics': 'ELE',
  'pharmacy': 'PHA',
  'stationery': 'STA',
  'hardware': 'HRD',
  'automotive': 'AUT',
  'fruits & vegetables': 'FRU',
  'produce': 'PRD',
  'meat & poultry': 'MEA',
  'seafood & fish': 'SEA',
  'alcoholic beverages': 'ALC',
  'liquor': 'LIQ',
  'wine & spirits': 'WIN',
};

// Canonical sub-category code dictionary
const SUB_CATEGORY_CODE_MAP: Record<string, string> = {
  'juices & sodas': 'JUC',
  'juices and sodas': 'JUC',
  'juice': 'JUC',
  'soda': 'SDA',
  'soft drinks': 'SFT',
  'water & hydration': 'WAT',
  'water': 'WAT',
  'mineral water': 'WAT',
  'coffee & tea': 'COF',
  'tea & coffee': 'TEA',
  'tea': 'TEA',
  'coffee': 'COF',
  'energy drinks': 'NRG',
  'rice & grains': 'RIC',
  'rice': 'RIC',
  'grains': 'GRN',
  'cereal & breakfast': 'CER',
  'cereal': 'CER',
  'canned foods': 'CAN',
  'canned fish': 'FSH',
  'cooking oils & sauces': 'OIL',
  'cooking oil': 'OIL',
  'spices & seasoning': 'SPC',
  'pasta & noodles': 'PAS',
  'breads & rolls': 'BRD',
  'bread': 'BRD',
  'cakes & pastries': 'CAK',
  'biscuits & cookies': 'BIS',
  'biscuits & wafers': 'BIS',
  'chocolates & candies': 'CHO',
  'sweets & candies': 'CND',
  'chips & crisps': 'CHP',
  'nuts & dried fruits': 'NUT',
  'milk & dairy': 'MLK',
  'milk & cream': 'MLK',
  'milk': 'MLK',
  'evaporated milk': 'MLK',
  'cheese & yogurt': 'CHS',
  'ice cream': 'ICR',
  'frozen foods': 'FRZ',
  'detergents & soaps': 'DET',
  'soaps & detergents': 'DET',
  'soaps': 'SOP',
  'surface cleaners': 'CLN',
  'cleaners & sanitizers': 'CLN',
  'laundry': 'LND',
  'oral care': 'ORL',
  'toothpaste': 'PST',
  'soaps & hygiene': 'HYG',
  'hair care': 'HAR',
  'skin care': 'SKN',
  'baby products': 'BBY',
  'pet food': 'PET',
  'general': 'GEN',
  'others': 'OTH',
};

/**
 * Extracts a concise 3-4 letter uppercase prefix from a category string.
 */
export function getCategoryPrefix(categoryName?: string, maxLen = 3): string {
  if (!categoryName || !categoryName.trim()) return 'PRD';
  const normalized = categoryName.trim().toLowerCase();

  // 1. Direct dictionary match
  if (CATEGORY_CODE_MAP[normalized]) {
    return CATEGORY_CODE_MAP[normalized];
  }

  // 2. Partial dictionary match
  for (const [key, code] of Object.entries(CATEGORY_CODE_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return code;
    }
  }

  // 3. Algorithmic abbreviation
  const clean = categoryName.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    // Acronym or blend
    if (words.length >= 3) {
      return words.map(w => w[0]).join('').slice(0, maxLen);
    }
    // 2 words: 2 chars from word 1, 1 char from word 2
    return (words[0].slice(0, 2) + words[1].slice(0, 1)).slice(0, maxLen);
  }

  const single = words[0] || 'PRD';
  return single.length >= 3 ? single.slice(0, maxLen) : single.padEnd(maxLen, 'X');
}

/**
 * Extracts a concise 3-letter uppercase prefix from a sub-category string.
 */
export function getSubCategoryPrefix(subCategoryName?: string, maxLen = 3): string {
  if (!subCategoryName || !subCategoryName.trim()) return '';
  const normalized = subCategoryName.trim().toLowerCase();

  if (SUB_CATEGORY_CODE_MAP[normalized]) {
    return SUB_CATEGORY_CODE_MAP[normalized];
  }

  for (const [key, code] of Object.entries(SUB_CATEGORY_CODE_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return code;
    }
  }

  const clean = subCategoryName.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    if (words.length >= 3) {
      return words.map(w => w[0]).join('').slice(0, maxLen);
    }
    return (words[0].slice(0, 2) + words[1].slice(0, 1)).slice(0, maxLen);
  }

  const single = words[0] || 'GEN';
  return single.length >= 3 ? single.slice(0, maxLen) : single.padEnd(maxLen, 'X');
}

/**
 * Calculates the next unused sequence number for a given prefix from a list of existing SKUs.
 */
export function getNextSequence(basePrefix: string, existingSkus: string[] = []): number {
  if (!existingSkus || existingSkus.length === 0) return 1;

  const normalizedBase = basePrefix.toUpperCase();
  const escapedBase = normalizedBase.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

  // Regex pattern matching: BASE-001, BASE-01, BASE001, etc.
  const regex = new RegExp(`^${escapedBase}-?(\\d+)$`, 'i');
  let maxSeq = 0;

  for (const sku of existingSkus) {
    if (!sku) continue;
    const cleanSku = sku.trim().toUpperCase();
    const match = cleanSku.match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  const existingSet = new Set(existingSkus.map(s => (s || '').trim().toUpperCase()));

  // Guarantee absolute uniqueness: if candidate exists (e.g. out-of-order custom input), increment
  while (existingSet.has(`${normalizedBase}-${String(nextSeq).padStart(3, '0')}`)) {
    nextSeq++;
  }

  return nextSeq;
}

/**
 * Generates a complete unique SKU suggestion based on category, sub-category, and numeric sequence.
 */
export function generateSuggestedSku(options: GenerateSkuOptions): SkuSuggestion {
  const {
    category = '',
    subCategory = '',
    existingSkus = [],
    format = 'standard',
    padding = 3,
    customPrefix,
  } = options;

  const categoryPrefix = customPrefix || getCategoryPrefix(category);
  const subCategoryPrefix = getSubCategoryPrefix(subCategory);

  // Base prefix: if sub-category is present: CAT-SUB; otherwise: CAT
  let basePrefix = categoryPrefix;
  if (subCategoryPrefix && subCategoryPrefix.trim().length > 0) {
    basePrefix = `${categoryPrefix}-${subCategoryPrefix}`;
  }

  const sequence = getNextSequence(basePrefix, existingSkus);
  const formattedSequence = String(sequence).padStart(Math.max(2, padding), '0');

  // Format styles:
  // Standard: BEV-JUC-001 or BEV-001
  const standardSku = `${basePrefix}-${formattedSequence}`;
  
  // Compact: BEVJUC001 or BEV001
  const compactSku = `${categoryPrefix}${subCategoryPrefix}${formattedSequence}`;
  
  // Simple: BEV-001 (category only)
  const simpleSeq = getNextSequence(categoryPrefix, existingSkus);
  const simpleSku = `${categoryPrefix}-${String(simpleSeq).padStart(Math.max(2, padding), '0')}`;

  let primarySku = standardSku;
  if (format === 'compact') primarySku = compactSku;
  if (format === 'simple') primarySku = simpleSku;

  const existingSet = new Set(existingSkus.map(s => (s || '').trim().toUpperCase()));
  const isUnique = !existingSet.has(primarySku.toUpperCase());

  const alternatives: SkuAlternative[] = [
    { label: 'Standard (CAT-SUB-NUM)', sku: standardSku, style: 'standard' },
    { label: 'Compact (No Hyphens)', sku: compactSku, style: 'compact' },
  ];

  if (subCategoryPrefix) {
    alternatives.push({ label: 'Category Only (CAT-NUM)', sku: simpleSku, style: 'simple' });
  }

  return {
    sku: primarySku,
    categoryPrefix,
    subCategoryPrefix,
    basePrefix,
    sequence,
    formattedSequence,
    isUnique,
    alternatives,
  };
}

/**
 * Calls the backend SKU generator endpoint for database-authoritative suggestion with fallback.
 */
export async function fetchSuggestedSkuFromApi(
  category: string,
  subCategory = '',
  clientExistingSkus: string[] = []
): Promise<SkuSuggestion> {
  try {
    const params = new URLSearchParams({
      category: category || '',
      sub_category: subCategory || '',
    });
    const res = await fetchApi<SkuSuggestion>(`/products/generate-sku?${params.toString()}`);
    if (res && res.sku) {
      return res;
    }
  } catch (err) {
    console.warn('API SKU generation fallback to client service:', err);
  }

  // Graceful client-side fallback
  return generateSuggestedSku({
    category,
    subCategory,
    existingSkus: clientExistingSkus,
  });
}

/**
 * Checks if a proposed SKU is already taken by an existing product.
 */
export function checkSkuUniqueness(
  skuToCheck: string,
  existingProducts: Array<{ id?: number; sku: string; name?: string }> = [],
  currentProductId?: number
): { isUnique: boolean; conflictProduct?: { id?: number; name?: string; sku: string } } {
  if (!skuToCheck || !skuToCheck.trim()) {
    return { isUnique: true };
  }

  const cleanTarget = skuToCheck.trim().toUpperCase();
  const conflict = existingProducts.find(p => {
    if (currentProductId && p.id === currentProductId) return false;
    return (p.sku || '').trim().toUpperCase() === cleanTarget;
  });

  return {
    isUnique: !conflict,
    conflictProduct: conflict ? { id: conflict.id, name: conflict.name, sku: conflict.sku } : undefined,
  };
}
