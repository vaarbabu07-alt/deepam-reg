/**
 * Public API Routes — DEEPAM'26 Multi District Meeting
 * Endpoints for config retrieval, dynamic calculation, and registration submission.
 */

const express = require('express');
const router  = express.Router();
const config  = require('../config');
const { calculateRegistrationFee }      = require('../services/pricing');
const paymentService                     = require('../services/payment');
const storageService                     = require('../services/storage');
const sheetsService                      = require('../services/sheets');
const emailService                       = require('../services/email');
const whatsappService                    = require('../services/whatsapp');
const upload                             = require('../middleware/upload');
const { validateRegistrationInput }      = require('../middleware/validation');

/**
 * GET /api/config
 * Provides public event and payment configuration to the frontend.
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    eventName:    config.eventName,
    districtName: config.districtName,
    eventDate:    config.eventDate,
    eventVenue:   config.eventVenue,
    rotarianFee:  config.rotarianFee,
    annsFee:      config.annsFee,
    annettesFee:  config.annettesFee,
    maxRotarians: config.maxRotarians,
    maxAnns:      config.maxAnns,
    maxAnnettes:  config.maxAnnettes,
    upiId:        config.upiId,
    payeeName:    config.payeeName,
    currency:     config.currency,
    maxUploadMB:  config.uploadMaxSizeMB
  });
});

/**
 * POST /api/calculate
 * Computes dynamic registration fee for all three categories.
 * Body: { rotariansCount, annsCount, annettesCount }
 */
router.post('/calculate', (req, res) => {
  const { rotariansCount, annsCount, annettesCount } = req.body;
  const result = calculateRegistrationFee(rotariansCount, annsCount, annettesCount);

  if (!result.valid) {
    return res.status(400).json({ success: false, errors: result.errors });
  }

  const payment = paymentService.getPaymentDetails(result.totalAmount);

  res.json({ success: true, calculation: result, payment });
});

/**
 * POST /api/register
 * Submits registration, validates all inputs, recalculates fee server-side,
 * saves to database, syncs to Google Sheets, sends emails.
 */
router.post('/register', (req, res, next) => {
  // Handle multipart file upload first
  upload.single('screenshot')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'File upload error.' });
    }
    next();
  });
}, validateRegistrationInput, async (req, res) => {
  try {
    const data = req.sanitized;

    // Duplicate UTR check
    const duplicateCheck = storageService.checkDuplicate(data.mobileNumber, data.utr);
    if (duplicateCheck.isDuplicate) {
      return res.status(409).json({ success: false, message: duplicateCheck.reason });
    }

    // Attach screenshot if uploaded (base64 data URI for serverless privacy & zero disk dependencies)
    if (req.file) {
      if (req.file.buffer) {
        data.paymentScreenshot = `data:${req.file.mimetype || 'image/png'};base64,${req.file.buffer.toString('base64')}`;
      } else if (req.file.filename) {
        data.paymentScreenshot = `/uploads/${req.file.filename}`;
      }
    }

    // Persist registration record synchronously to disk & memory
    const savedRecord = storageService.saveRegistration(data);
    console.log(`[Registration] Successfully saved ${savedRecord.registrationId} for ${savedRecord.fullName}.`);

    // Send participant confirmation email and admin notification email
    const [participantResult, adminResult] = await Promise.allSettled([
      emailService.sendParticipantEmail(savedRecord),
      emailService.sendAdminEmail(savedRecord)
    ]);

    savedRecord.participantEmailStatus = (participantResult.status === 'fulfilled' && participantResult.value && participantResult.value.sent) ? 'SENT' : 'FAILED';
    savedRecord.adminEmailStatus = (adminResult.status === 'fulfilled' && adminResult.value && adminResult.value.sent) ? 'SENT' : 'FAILED';
    savedRecord.whatsappStatus = 'NOT_SENT';

    // Update delivery statuses in database
    storageService.updateDeliveryStatuses(savedRecord.registrationId, {
      participantEmailStatus: savedRecord.participantEmailStatus,
      adminEmailStatus:       savedRecord.adminEmailStatus,
      whatsappStatus:         savedRecord.whatsappStatus
    });

    // Attempt WhatsApp non-blocking in background (never blocks or delays registration)
    if (whatsappService && typeof whatsappService.sendConfirmation === 'function') {
      whatsappService.sendConfirmation(savedRecord)
        .then(res => {
          if (res && res.sent) {
            storageService.updateDeliveryStatuses(savedRecord.registrationId, { whatsappStatus: 'SENT' });
          }
        })
        .catch(() => {});
    }

    // Sync to Google Sheets
    sheetsService.syncRegistration(savedRecord).catch(() => {});

    // Return success response to frontend
    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully.',
      registration: {
        registrationId:         savedRecord.registrationId,
        timestamp:              savedRecord.timestamp,
        fullName:               savedRecord.fullName,
        mobileNumber:           savedRecord.mobileNumber,
        email:                  savedRecord.email,
        rotaryClub:             savedRecord.rotaryClub,
        rotaryDistrict:         savedRecord.rotaryDistrict,
        nonVegCount:            savedRecord.nonVegCount,
        vegCount:               savedRecord.vegCount,
        rotariansCount:         savedRecord.rotariansCount,
        annsCount:              savedRecord.annsCount,
        annettesCount:          savedRecord.annettesCount,
        rotarianFee:            savedRecord.rotarianFee,
        annsFee:                savedRecord.annsFee,
        annettesFee:            savedRecord.annettesFee,
        rotarianTotal:          savedRecord.rotarianTotal,
        annsTotal:              savedRecord.annsTotal,
        annettesTotal:          savedRecord.annettesTotal,
        totalAmount:            savedRecord.totalAmount,
        utr:                    savedRecord.utr,
        paymentStatus:          savedRecord.paymentStatus,
        statusText:             'Registration received — Payment pending admin verification',
        participantEmailStatus: savedRecord.participantEmailStatus,
        adminEmailStatus:       savedRecord.adminEmailStatus,
        whatsappStatus:         savedRecord.whatsappStatus
      }
    });
  } catch (error) {
    console.error('Registration processing error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your registration. Please try again.'
    });
  }
});

module.exports = router;
