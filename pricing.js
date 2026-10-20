/**
 * Central Pricing Engine — DEEPAM'26 Multi District Meeting
 * Single authoritative source of truth for multi-category registration fee calculations.
 * Formula: (Rotarians × ₹1,200) + (Ann's × ₹1,000) + (Annette's × ₹1,000)
 */

const config = require('../config');

/**
 * Validates a non-negative integer count for a category.
 * @param {any}    count   - raw input value
 * @param {string} label   - human-readable category name for error messages
 * @param {number} min     - minimum allowed value
 * @param {number} max     - maximum allowed value
 * @returns {{ valid: boolean, error?: string, sanitizedCount?: number }}
 */
function validateCount(count, label, min, max) {
  if (count === undefined || count === null || count === '') {
    if (min === 0) return { valid: true, sanitizedCount: 0 }; // optional categories default to 0
    return { valid: false, error: `${label} count is required.` };
  }

  const stringVal = String(count).trim();
  if (!/^\d+$/.test(stringVal)) {
    return { valid: false, error: `Please enter a valid whole number for ${label} (no decimals or letters).` };
  }

  const num = parseInt(stringVal, 10);
  if (isNaN(num)) {
    return { valid: false, error: `Please enter a valid number for ${label}.` };
  }

  if (num < min) {
    return { valid: false, error: `${label} must be at least ${min}.` };
  }

  if (num > max) {
    return { valid: false, error: `${label} cannot exceed ${max}.` };
  }

  return { valid: true, sanitizedCount: num };
}

/**
 * Validates number of Rotarians (minimum 1).
 */
function validateRotariansCount(count) {
  return validateCount(count, 'Number of Rotarians', config.minRotarians, config.maxRotarians);
}

/**
 * Validates number of Ann's (minimum 0).
 */
function validateAnnsCount(count) {
  return validateCount(count, "Number of Ann's", config.minAnns, config.maxAnns);
}

/**
 * Validates number of Annette's (minimum 0).
 */
function validateAnnettesCount(count) {
  return validateCount(count, "Number of Annette's", config.minAnnettes, config.maxAnnettes);
}

/**
 * Authoritatively calculates total registration fee for all three categories.
 * This is the SINGLE source of truth — never trust a client-submitted amount.
 *
 * @param {number|string} rotariansCount
 * @param {number|string} annsCount
 * @param {number|string} annettesCount
 * @returns {{ valid: boolean, error?: string, errors?: object, ... }}
 */
function calculateRegistrationFee(rotariansCount, annsCount, annettesCount) {
  const errors = {};

  const rotV = validateRotariansCount(rotariansCount);
  const annV = validateAnnsCount(annsCount);
  const annettV = validateAnnettesCount(annettesCount);

  if (!rotV.valid)    errors.rotariansCount = rotV.error;
  if (!annV.valid)    errors.annsCount      = annV.error;
  if (!annettV.valid) errors.annettesCount  = annettV.error;

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  const rotarians  = rotV.sanitizedCount;
  const anns       = annV.sanitizedCount;
  const annettes   = annettV.sanitizedCount;

  const rotarianFee  = config.rotarianFee;
  const annsFee      = config.annsFee;
  const annettesFee  = config.annettesFee;

  const rotarianTotal  = rotarians * rotarianFee;
  const annsTotal      = anns      * annsFee;
  const annettesTotal  = annettes  * annettesFee;
  const totalAmount    = rotarianTotal + annsTotal + annettesTotal;

  return {
    valid: true,
    rotariansCount:  rotarians,
    annsCount:       anns,
    annettesCount:   annettes,
    rotarianFee,
    annsFee,
    annettesFee,
    rotarianTotal,
    annsTotal,
    annettesTotal,
    totalAmount,
    formattedTotal: `₹${totalAmount.toLocaleString('en-IN')}`,
    breakdown: {
      rotarians: `${rotarians} × ₹${rotarianFee.toLocaleString('en-IN')} = ₹${rotarianTotal.toLocaleString('en-IN')}`,
      anns:      `${anns} × ₹${annsFee.toLocaleString('en-IN')} = ₹${annsTotal.toLocaleString('en-IN')}`,
      annettes:  `${annettes} × ₹${annettesFee.toLocaleString('en-IN')} = ₹${annettesTotal.toLocaleString('en-IN')}`
    }
  };
}

module.exports = {
  validateRotariansCount,
  validateAnnsCount,
  validateAnnettesCount,
  calculateRegistrationFee
};
