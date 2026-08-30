/**
 * Formats a number as Sri Lankan Rupees: "Rs. 320.00"
 * All prices in this app are in LKR (assumption based on Sinhala place names
 * and price ranges — update if incorrect).
 */
export function formatPrice(amount) {
  return `Rs. ${Number(amount).toFixed(2)}`;
}
