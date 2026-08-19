/**
 * Formats a number as Ghana Cedis (GHS)
 * @param amount - The numerical value to format
 * @returns A string formatted with the GH₵ symbol
 */
export const formatGHS = (amount: number): string => {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  return `₵${formatted}`;
};

