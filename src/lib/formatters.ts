/**
 * Formats a number as Ghana Cedis (GHS)
 * @param amount - The numerical value to format
 * @returns A string formatted with the Ghanaian Cedi symbol (₵)
 */
export const formatGHS = (amount: number): string => {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  return `₵${formatted}`;
};

export interface GhanaTaxBreakdown {
  taxableSubtotal: number;
  nhilAmount: number;        // National Health Insurance Levy (2.5%)
  getFundAmount: number;     // Ghana Education Trust Fund Levy (2.5%)
  covidLevyAmount: number;   // COVID-19 Health Recovery Levy (1.0%)
  totalLevies: number;       // Sum of levies (6.0%)
  vatAmount: number;         // Standard VAT (15.0% on base + levies = 15.9%)
  totalTax: number;          // Total statutory tax
  effectiveTaxRate: number;  // Combined rate (typically 21.9% or configured %)
  isExempt: boolean;         // Zero-Rated / Exempt flag
}

/**
 * Calculates Ghana Revenue Authority (GRA) compliant tax & statutory levy breakdown.
 * Under Act 870 as amended:
 * - NHIL: 2.5%
 * - GETFund: 2.5%
 * - COVID-19 Health Recovery Levy: 1.0%
 * - Standard VAT: 15.0% on (Base + Levies) = 15.9% of Base
 * Total combined rate = 21.9%
 */
export function calculateGhanaTax(
  grandTotal: number, 
  taxPercentageSetting: number = 0, 
  explicitTaxAmount?: number
): GhanaTaxBreakdown {
  const hasTax = taxPercentageSetting > 0 || (explicitTaxAmount !== undefined && explicitTaxAmount > 0);

  if (!hasTax) {
    return {
      taxableSubtotal: grandTotal,
      nhilAmount: 0,
      getFundAmount: 0,
      covidLevyAmount: 0,
      totalLevies: 0,
      vatAmount: 0,
      totalTax: 0,
      effectiveTaxRate: 0,
      isExempt: true,
    };
  }

  const standardEffectiveRate = 21.9;
  const rate = taxPercentageSetting > 0 ? taxPercentageSetting : standardEffectiveRate;
  
  const totalTax = explicitTaxAmount !== undefined && explicitTaxAmount > 0
    ? explicitTaxAmount
    : (grandTotal * (rate / (100 + rate)));
  
  const taxableSubtotal = Math.max(0, grandTotal - totalTax);

  // Proportional breakdown based on GRA statutory weights
  const nhilRatio = 2.5 / standardEffectiveRate;
  const getFundRatio = 2.5 / standardEffectiveRate;
  const covidRatio = 1.0 / standardEffectiveRate;
  const vatRatio = 15.9 / standardEffectiveRate;

  const nhilAmount = totalTax * nhilRatio;
  const getFundAmount = totalTax * getFundRatio;
  const covidLevyAmount = totalTax * covidRatio;
  const vatAmount = totalTax * vatRatio;

  return {
    taxableSubtotal,
    nhilAmount,
    getFundAmount,
    covidLevyAmount,
    totalLevies: nhilAmount + getFundAmount + covidLevyAmount,
    vatAmount,
    totalTax,
    effectiveTaxRate: rate,
    isExempt: false,
  };
}

