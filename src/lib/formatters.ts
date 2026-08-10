/**
 * Formats a number as Ghana Cedis (GHS)
 * @param amount - The numerical value to format
 * @returns A string formatted with the GH₵ symbol
 */
export const formatGHS = (amount: number): string => {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};
