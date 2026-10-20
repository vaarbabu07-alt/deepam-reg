/**
 * Payment Service Module
 * Handles Level 1 (UPI Intent / QR code URI generation)
 * and provides Level 2 modular architecture for automated payment gateways (e.g. Razorpay/Cashfree).
 */

const config = require('../config');

class PaymentService {
  /**
   * Generates a standard, spec-compliant UPI payment intent URI.
   * Spec: upi://pay?pa={UPI_ID}&pn={PAYEE_NAME}&am={AMOUNT}&cu=INR&tn={NOTE}
   * @param {number} amount In INR (e.g., 7500)
   * @param {string} transactionNote Custom note/purpose (e.g., 'Rotary Conference 2026')
   * @param {string} [refUrl] Optional transaction reference URL
   * @returns {string} Fully encoded UPI payment URI
   */
  generateUpiUri(amount, transactionNote = null) {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      throw new Error('Invalid payment amount');
    }

    const cleanPa = String(config.upiId || '').trim();
    if (!cleanPa || !cleanPa.includes('@')) {
      throw new Error('Invalid or unconfigured merchant UPI ID');
    }

    const cleanPn = String(config.payeeName || 'ROTARY CLUB')
      .trim()
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Amount formatted to exactly two decimal places per NPCI specification
    const cleanAm = numAmount.toFixed(2);
    const cleanCu = String(config.currency || 'INR').trim().toUpperCase();

    // Standard NPCI transaction note: alphanumeric + space only, max 30 chars
    const rawNote = transactionNote || `${config.eventName || 'DEEPAM26'} Registration`;
    const cleanTn = String(rawNote)
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 30) || 'DEEPAM26 Registration';

    return `upi://pay?pa=${cleanPa}&pn=${encodeURIComponent(cleanPn)}&am=${cleanAm}&cu=${cleanCu}&tn=${encodeURIComponent(cleanTn)}`;
  }

  /**
   * Returns metadata required for payment display on the client.
   * @param {number} amount
   * @param {string} registrationRef
   * @returns {object}
   */
  getPaymentDetails(amount, registrationRef = null) {
    const note = registrationRef 
      ? `DEEPAM26 Ref ${String(registrationRef).replace(/[^a-zA-Z0-9]/g, '')}`.slice(0, 30)
      : 'DEEPAM26 Registration';

    const upiUri = this.generateUpiUri(amount, note);

    return {
      mode: 'UPI_LEVEL_1', // Level 1 = Intent/QR with UTR proof
      upiId: config.upiId,
      payeeName: config.payeeName,
      amount: amount,
      currency: config.currency,
      note: note,
      upiUri: upiUri,
      instructions: [
        `Scan the QR code using any UPI app (Google Pay, PhonePe, Paytm, BHIM, etc.).`,
        `Alternatively, click "Pay via UPI" on mobile to directly launch your preferred UPI app.`,
        `After completing the payment, note down the 12-digit UPI Reference / UTR Number.`,
        `Enter the UTR number in the field below and submit your registration.`
      ]
    };
  }

  /**
   * Level 2 Gateway Interface placeholder
   * Allows plugging in Razorpay / Cashfree / Stripe without rewriting registration flow.
   */
  async createGatewayOrder(amount, registrationData) {
    // Level 2 implementation hook:
    // e.g. const order = await razorpay.orders.create({ amount: amount * 100, currency: 'INR', ... });
    // return order;
    return {
      enabled: false,
      message: 'Level 2 Payment Gateway not activated. Operating in Level 1 UPI mode.'
    };
  }
}

module.exports = new PaymentService();
