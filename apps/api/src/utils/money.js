const Decimal = require('decimal.js');

/**
 * Convert LKR amount to integer cents (paise)
 */
function toCents(amount) {
  return new Decimal(amount).mul(100).round().toNumber();
}

/**
 * Convert integer cents back to LKR amount
 */
function fromCents(cents) {
  return new Decimal(cents).div(100).toFixed(2);
}

/**
 * Round money to 2 decimal places, half-up
 */
function roundMoney(amount) {
  return new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Calculate line total: qty * unitPrice, rounded at line level
 */
function calculateLineTotal(qty, unitPrice) {
  return new Decimal(qty).mul(unitPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Calculate order totals with tier discount
 * Returns { subtotal, tierDiscountAmount, total }
 */
function calculateOrderTotal(items, tierDiscountRate = 0) {
  const subtotal = items.reduce((sum, item) => {
    const lineTotal = calculateLineTotal(item.quantity, item.unit_price);
    return new Decimal(sum).plus(lineTotal);
  }, new Decimal(0));

  const tierDiscountAmount = tierDiscountRate > 0
    ? subtotal.mul(new Decimal(tierDiscountRate).div(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(0);

  const total = subtotal.minus(tierDiscountAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    subtotal: subtotal.toNumber(),
    tierDiscountAmount: tierDiscountAmount.toNumber(),
    total: total.toNumber(),
  };
}

/**
 * Calculate balance due: totalAmount + adjustments - paidAmount
 */
function calculateBalanceDue(totalAmount, paidAmount, adjustmentsSum = 0) {
  return new Decimal(totalAmount)
    .plus(adjustmentsSum)
    .minus(paidAmount)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Add two monetary values safely
 */
function add(a, b) {
  return new Decimal(a).plus(b).toNumber();
}

/**
 * Subtract b from a safely
 */
function subtract(a, b) {
  return new Decimal(a).minus(b).toNumber();
}

module.exports = {
  toCents,
  fromCents,
  roundMoney,
  calculateLineTotal,
  calculateOrderTotal,
  calculateBalanceDue,
  add,
  subtract,
};
