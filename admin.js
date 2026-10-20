/**
 * Administrator API Routes
 * Endpoints for login, dashboard metrics, search/filter, status modification, and CSV export.
 */

const express = require('express');
const router = express.Router();
const config = require('../config');
const storageService = require('../services/storage');
const sheetsService = require('../services/sheets');
const { COOKIE_NAME, createSessionToken, requireAdmin } = require('../middleware/auth');

/**
 * POST /api/admin/login
 * Verifies admin credentials and sets session cookie.
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required.'
    });
  }

  if (username === config.adminUsername && password === config.adminPassword) {
    const token = createSessionToken(username);

    // Set secure HTTP-only cookie
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.json({
      success: true,
      message: 'Authentication successful.',
      token,
      username
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid administrator credentials.'
  });
});

/**
 * POST /api/admin/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * GET /api/admin/check-auth
 */
router.get('/check-auth', requireAdmin, (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    username: req.admin.username
  });
});

/**
 * GET /api/admin/stats
 * Provides KPI counts and financial summaries.
 */
router.get('/stats', requireAdmin, (req, res) => {
  const stats = storageService.getStats();
  res.json({
    success: true,
    stats
  });
});

/**
 * GET /api/admin/registrations
 * Query registrations with search & status filters.
 */
router.get('/registrations', requireAdmin, (req, res) => {
  const { search = '', status = 'ALL', limit = 100, offset = 0 } = req.query;

  const result = storageService.getRegistrations({
    search,
    status,
    limit: parseInt(limit, 10) || 100,
    offset: parseInt(offset, 10) || 0
  });

  res.json({
    success: true,
    ...result
  });
});

/**
 * POST /api/admin/update-status
 * Updates payment status (PAID / PENDING / REJECTED).
 */
router.post('/update-status', requireAdmin, (req, res) => {
  const { registrationId, status, note } = req.body;

  if (!registrationId || !status) {
    return res.status(400).json({
      success: false,
      message: 'Registration ID and status are required.'
    });
  }

  try {
    const updated = storageService.updateStatus(registrationId, status, note);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Registration ${registrationId} not found.`
      });
    }

    // Asynchronously synchronize status change to Google Sheets (non-blocking)
    sheetsService.syncRegistration(updated).catch(err => {
      console.warn('[Sheets Sync] Admin status sync notice:', err.message);
    });

    res.json({
      success: true,
      message: `Status updated to ${status}.`,
      registration: updated
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

/**
 * GET /api/admin/export-csv
 * Streams full registrations dataset as a downloadable CSV.
 */
router.get('/export-csv', requireAdmin, (req, res) => {
  const { records } = storageService.getRegistrations({ limit: 100000 });
  const maxAllowedMembers = config.maxRotarians || 10;

  // Build Headers
  const headers = [
    'Registration ID',
    'Registration Date',
    'Registration Time',

    // A. PARTICIPANT INFORMATION
    'Participant Full Name',
    'Participant Contact Number',
    'Participant Email ID',
    'Rotary Club Of',
    'District',

    // B. REGISTRATION DETAILS
    'Total Members Attending',
    'Number of Rotarians',
    "Number of Ann's",
    "Number of Annette's"
  ];

  for (let m = 1; m <= maxAllowedMembers; m++) {
    headers.push(`Member ${m} Full Name`);
    headers.push(`Member ${m} Contact Number`);
  }

  // C. PREFERRED FOOD
  headers.push('Veg Count');
  headers.push('Non-Veg Count');

  // D. PAYMENT REFERENCE
  headers.push('Total Registration Amount');
  headers.push('UPI ID');
  headers.push('UPI Transaction ID / UTR');
  headers.push('Payment Status');

  // Helper to escape CSV values for Microsoft Excel compatibility
  const escapeCsv = (val, isPhone = false) => {
    if (val === null || val === undefined) return '""';
    let str = String(val).trim();

    // Strip newlines / carriage returns to ensure exactly one row per registration
    str = str.replace(/[\r\n]+/g, ' ');

    // If it's a contact/phone number, format as ="..." so Excel preserves leading zeros and doesn't convert to scientific notation
    if (isPhone && str !== '') {
      const cleanPhone = str.replace(/"/g, '""');
      return `="${cleanPhone}"`;
    }

    str = str.replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map(r => {
    const rowValues = [];
    const ts = new Date(r.timestamp || Date.now());
    const dateStr = ts.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = ts.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    rowValues.push(escapeCsv(r.registrationId));
    rowValues.push(escapeCsv(dateStr));
    rowValues.push(escapeCsv(timeStr));

    // A. PARTICIPANT INFORMATION
    rowValues.push(escapeCsv(r.fullName));
    rowValues.push(escapeCsv(r.mobileNumber, true));
    rowValues.push(escapeCsv(r.email));
    rowValues.push(escapeCsv(r.rotaryClub));
    rowValues.push(escapeCsv(r.rotaryDistrict));

    // B. REGISTRATION DETAILS
    const totalMembers = (parseInt(r.rotariansCount, 10) || 0) + (parseInt(r.annsCount, 10) || 0) + (parseInt(r.annettesCount, 10) || 0);
    rowValues.push(escapeCsv(totalMembers || 1));
    rowValues.push(escapeCsv(r.rotariansCount ?? 0));
    rowValues.push(escapeCsv(r.annsCount ?? 0));
    rowValues.push(escapeCsv(r.annettesCount ?? 0));

    // Member 1 is primary participant
    const members = [
      { name: r.fullName || '', phone: r.mobileNumber || '' }
    ];

    // Additional members
    if (r.additionalMembers && Array.isArray(r.additionalMembers)) {
      r.additionalMembers.forEach(m => {
        members.push({
          name: m.name || '',
          phone: m.phone || ''
        });
      });
    }

    // Member columns up to maxAllowedMembers
    for (let m = 0; m < maxAllowedMembers; m++) {
      const member = members[m];
      if (member) {
        rowValues.push(escapeCsv(member.name));
        rowValues.push(escapeCsv(member.phone, true));
      } else {
        rowValues.push('""');
        rowValues.push('""');
      }
    }

    // C. PREFERRED FOOD
    rowValues.push(escapeCsv(r.vegCount ?? 0));
    rowValues.push(escapeCsv(r.nonVegCount ?? 0));

    // D. PAYMENT REFERENCE
    rowValues.push(escapeCsv(r.totalAmount ?? 0));
    rowValues.push(escapeCsv(r.upiId || config.upiId || ''));
    rowValues.push(escapeCsv(r.utr || ''));
    rowValues.push(escapeCsv(r.paymentStatus || ''));

    return rowValues.join(',');
  });

  const csvContent = '\uFEFF' + headers.map(h => escapeCsv(h)).join(',') + '\n' + rows.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=DEEPAM26_Registrations.csv');
  res.status(200).send(csvContent);
});

module.exports = router;
