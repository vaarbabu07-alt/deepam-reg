/**
 * Input Validation Middleware — DEEPAM'26 Multi District Meeting
 * Enforces strict validation on all form inputs and guarantees server-side calculation authority.
 * Server authoritatively calculates: totalAmount = (rotarians×1200) + (anns×1000) + (annettes×1000)
 */

const { validateRotariansCount, validateAnnsCount, validateAnnettesCount, calculateRegistrationFee } = require('../services/pricing');

const NAME_REGEX   = /^[A-Za-z. '\-]+$/;
const MOBILE_REGEX = /^[0-9]{10}$/;
const EMAIL_REGEX  = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates a mandatory food count field (non-negative integer).
 */
function validateFoodCount(value, label) {
  // Optional field: treat missing or empty as count 0
  if (value === undefined || value === null || String(value).trim() === '') {
    return { valid: true, count: 0 };
  }
  const s = String(value).trim();
  if (!/^\d+$/.test(s)) return { valid: false, error: `${label} must be a whole number (0 or more).` };
  const n = parseInt(s, 10);
  if (n < 0) return { valid: false, error: `${label} cannot be negative.` };
  return { valid: true, count: n };
}

function validateRegistrationInput(req, res, next) {
  const errors = {};
  const {
    fullName,
    mobileNumber,
    email,
    rotaryClub,
    rotaryDistrict,
    nonVegCount,
    vegCount,
    rotariansCount,
    annsCount,
    annettesCount,
    additionalMembers,
    utr
  } = req.body;

  // 1. Full Name
  if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
    errors.fullName = 'Full Name is required.';
  } else if (!NAME_REGEX.test(fullName.trim()) || fullName.trim().length < 2) {
    errors.fullName = 'Please enter a valid name using letters, dots, or hyphens.';
  }

  // 2. Mobile Number (normalize spaces, dashes, +91 prefix)
  let cleanMobile = String(mobileNumber || '').trim().replace(/[\s\-()]/g, '');
  if (cleanMobile.startsWith('+91')) cleanMobile = cleanMobile.slice(3);
  if (cleanMobile.startsWith('91') && cleanMobile.length === 12) cleanMobile = cleanMobile.slice(2);
  if (cleanMobile.startsWith('0') && cleanMobile.length === 11) cleanMobile = cleanMobile.slice(1);

  if (!cleanMobile) {
    errors.mobileNumber = 'Please enter a valid 10-digit mobile number.';
  } else if (!MOBILE_REGEX.test(cleanMobile)) {
    errors.mobileNumber = 'Please enter a valid 10-digit mobile number.';
  }

  // 3. Email
  if (!email || typeof email !== 'string' || email.trim() === '') {
    errors.email = 'Email address is required.';
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  // 4. Rotary Club
  if (!rotaryClub || typeof rotaryClub !== 'string' || rotaryClub.trim() === '') {
    errors.rotaryClub = 'Please enter your Rotary Club name.';
  }

  // 5. Rotary District
  if (!rotaryDistrict || typeof rotaryDistrict !== 'string' || rotaryDistrict.trim() === '') {
    errors.rotaryDistrict = 'Please enter your Rotary District number.';
  }

  // 6. Food counts (mandatory)
  const nonVegResult = validateFoodCount(nonVegCount, 'Preferred Food — Non-Veg (Count)');
  if (!nonVegResult.valid) errors.nonVegCount = nonVegResult.error;

  const vegResult = validateFoodCount(vegCount, 'Preferred Food — Veg (Count)');
  if (!vegResult.valid) errors.vegCount = vegResult.error;

  // 7. Registration categories — server recalculates authoritative total
  const rotV   = validateRotariansCount(rotariansCount);
  const annV   = validateAnnsCount(annsCount);
  const annettV = validateAnnettesCount(annettesCount);

  if (!rotV.valid)    errors.rotariansCount = rotV.error;
  if (!annV.valid)    errors.annsCount      = annV.error;
  if (!annettV.valid) errors.annettesCount  = annettV.error;

// Food counts cannot exceed total registration count (Rotarians + Ann + Annette)
if (rotV.valid && annV.valid && annettV.valid) {
  const totalRegistrationCount = rotV.sanitizedCount + annV.sanitizedCount + annettV.sanitizedCount;
  const combinedFood = (nonVegResult.valid ? nonVegResult.count : 0) + (vegResult.valid ? vegResult.count : 0);
  if (combinedFood > totalRegistrationCount) {
    const errorMsg = 'Food count cannot exceed the total registration count.';
    errors.nonVegCount = errorMsg;
    errors.vegCount = errorMsg;
  }
}

  // 8. Additional Members (optional JSON array — Member 2, 3, ...)
  let sanitizedAdditionalMembers = [];
  if (additionalMembers && String(additionalMembers).trim() !== '' && String(additionalMembers).trim() !== '[]') {
    let parsed;
    try {
      parsed = JSON.parse(additionalMembers);
    } catch (e) {
      errors.additionalMembers = 'Invalid additional member data.';
    }
    if (parsed && Array.isArray(parsed)) {
      const memberErrors = [];
      parsed.forEach((member, idx) => {
        const memberNum = idx + 2; // Display as Member 2, 3, ...
        const name  = (member.name  || '').trim();
        let phone = String(member.phone || '').trim().replace(/[\s\-()]/g, '');
        if (phone.startsWith('+91')) phone = phone.slice(3);
        if (phone.startsWith('91') && phone.length === 12) phone = phone.slice(2);
        if (phone.startsWith('0') && phone.length === 11) phone = phone.slice(1);

        if (!name) {
          memberErrors.push(`Member ${memberNum} name is required.`);
        } else if (!NAME_REGEX.test(name) || name.length < 2) {
          memberErrors.push(`Member ${memberNum} name must contain letters, dots, or hyphens.`);
        }
        if (!/^[0-9]{10}$/.test(phone)) {
          memberErrors.push(`Member ${memberNum} contact number must be a valid 10-digit mobile number.`);
        }
        sanitizedAdditionalMembers.push({ name, phone });
      });
      if (memberErrors.length > 0) {
        errors.additionalMembers = memberErrors.join(' ');
      }
    }
  }

  // 9. UTR (Optional)
  let cleanUtr = '';
  if (utr && typeof utr === 'string' && utr.trim() !== '') {
    cleanUtr = utr.trim().toUpperCase();
    if (cleanUtr.length < 6 || cleanUtr.length > 35 || !/^[A-Za-z0-9]+$/.test(cleanUtr)) {
      errors.utr = 'Please enter a valid UPI Reference / UTR Number (alphanumeric, min 6 characters).';
    }
  }

  // 9. Screenshot is required
  if (!req.file) {
    errors.screenshot = 'Please upload your payment screenshot before submitting the registration.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please correct the errors and try again.',
      errors
    });
  }

  // STRICT SERVER-SIDE RECALCULATION — disregard any client-sent amount
  const feeInfo = calculateRegistrationFee(
    rotV.sanitizedCount,
    annV.sanitizedCount,
    annettV.sanitizedCount
  );

  // Attach sanitized and server-verified values to req.sanitized
  req.sanitized = {
    fullName:            fullName.trim(),
    mobileNumber:        cleanMobile,
    email:               email.trim().toLowerCase(),
    rotaryClub:          rotaryClub.trim(),
    rotaryDistrict:      rotaryDistrict.trim(),
    nonVegCount:         nonVegResult.count,
    vegCount:            vegResult.count,
    rotariansCount:      feeInfo.rotariansCount,
    annsCount:           feeInfo.annsCount,
    annettesCount:       feeInfo.annettesCount,
    rotarianFee:         feeInfo.rotarianFee,
    annsFee:             feeInfo.annsFee,
    annettesFee:         feeInfo.annettesFee,
    rotarianTotal:       feeInfo.rotarianTotal,
    annsTotal:           feeInfo.annsTotal,
    annettesTotal:       feeInfo.annettesTotal,
    totalAmount:         feeInfo.totalAmount, // GUARANTEED SERVER CALCULATION
    additionalMembers:   sanitizedAdditionalMembers,
    utr:                 cleanUtr
  };

  next();
}

module.exports = {
  validateRegistrationInput,
  NAME_REGEX,
  MOBILE_REGEX
};
