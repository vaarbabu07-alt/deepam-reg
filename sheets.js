/**
 * Google Sheets Synchronization Service
 * 
 * Synchronizes participant registrations to Google Sheets in real-time.
 * Features:
 * - Official Google Sheets API v4 via `googleapis` with Service Account JWT authentication.
 * - Exact 24-column structure matching Rotary DEEPAM'26 requirements.
 * - Duplicate protection: verifies Registration ID in Column A before inserting (updates existing, never duplicates).
 * - Admin status sync: automatically updates row status when changed (PENDING -> PAID).
 * - Resilient non-blocking error handling: failures never block or invalidate participant registrations.
 * - Optional webhook fallback for Google Apps Script.
 */

const { google } = require('googleapis');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const config = require('../config');

const SHEET_NAME = 'Registrations';

const HEADERS = [
  'Registration ID',
  'Registration Date',
  'Registration Time',
  'Full Name',
  'Mobile Number',
  'Email Address',
  'Rotary Club',
  'Rotary District',
  'Preferred Food — Non-Veg (Count)',
  'Preferred Food — Veg (Count)',
  'Number of Rotarians',
  'Number of Ann',
  'Number of Annette',
  'Rotarian Amount',
  'Ann Amount',
  'Annette Amount',
  'Total Registration Amount',
  'UPI ID',
  'UTR / Transaction ID',
  'Payment Status',
  'Payment Screenshot Reference',
  'Participant Email Status',
  'Admin Email Status',
  'WhatsApp Confirmation Status',
  'Last Updated'
];

class SheetsService {
  constructor() {
    this.sheetsClient = null;
    this.headersInitialized = false;
  }

  /**
   * Initializes or returns the authenticated Google Sheets API v4 client.
   * Uses server-side Service Account credentials from environment variables.
   */
  _getSheetsClient() {
    if (this.sheetsClient) return this.sheetsClient;

    const spreadsheetId = config.googleSheetId;
    const clientEmail = config.googleServiceAccountEmail;
    const privateKey = config.googlePrivateKey;

    if (!spreadsheetId || !clientEmail || !privateKey) {
      return null;
    }

    try {
      const formattedKey = privateKey.includes('\\n') 
        ? privateKey.replace(/\\n/g, '\n') 
        : privateKey;

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: formattedKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheetsClient = google.sheets({ version: 'v4', auth });
      return this.sheetsClient;
    } catch (err) {
      console.warn('[Sheets Sync] Error initializing Google Auth JWT:', err.message);
      return null;
    }
  }

  /**
   * Ensures the target worksheet 'Registrations' exists and has proper headers.
   */
  async _ensureSheetAndHeaders(sheets, spreadsheetId) {
    if (this.headersInitialized) return;

    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetList = meta.data.sheets || [];
      const sheetExists = sheetList.some(
        s => s.properties && s.properties.title === SHEET_NAME
      );

      if (!sheetExists) {
        // Create the 'Registrations' tab if missing
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: SHEET_NAME,
                    gridProperties: { rowCount: 1000, columnCount: 26, frozenRowCount: 1 }
                  }
                }
              }
            ]
          }
        });
      }

      // Check row 1 headers
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A1:Y1`
      });

      const currentHeaders = res.data.values && res.data.values[0];
      if (!currentHeaders || currentHeaders.length === 0 || currentHeaders[0] !== HEADERS[0] || currentHeaders.length !== HEADERS.length) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${SHEET_NAME}!A1:Y1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [HEADERS] }
        });
      }

      this.headersInitialized = true;
    } catch (err) {
      console.warn('[Sheets Sync] Header verification notice:', err.message);
    }
  }

  /**
   * Converts a registration database record into the exact 24 spreadsheet columns.
   */
  formatRow(record) {
    let regDate = '';
    let regTime = '';

    if (record.timestamp) {
      try {
        const d = new Date(record.timestamp);
        regDate = d.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        regTime = d.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      } catch (_) {
        const parts = String(record.timestamp).split('T');
        regDate = parts[0] || '';
        regTime = parts[1] || '';
      }
    }

    const lastUpdated = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let screenshotRef = 'Not Uploaded';
    if (record.paymentScreenshot) {
      const scr = String(record.paymentScreenshot);
      if (scr.startsWith('data:')) {
        screenshotRef = 'Uploaded (Stored securely in database)';
      } else if (scr.startsWith('/uploads/')) {
        screenshotRef = `Uploaded (${scr})`;
      } else {
        screenshotRef = 'Uploaded';
      }
    }

    const rotariansCount = Number(record.rotariansCount) || 0;
    const annsCount = Number(record.annsCount) || 0;
    const annettesCount = Number(record.annettesCount) || 0;

    const rotarianAmount = Number(record.rotarianTotal) || (rotariansCount * (Number(record.rotarianFee) || 1200));
    const annAmount = Number(record.annsTotal) || (annsCount * (Number(record.annsFee) || 1000));
    const annetteAmount = Number(record.annettesTotal) || (annettesCount * (Number(record.annettesFee) || 1000));

    return [
      record.registrationId || '',
      regDate,
      regTime,
      record.fullName || '',
      `'${record.mobileNumber || ''}`, // Preserve mobile number string without scientific notation
      record.email || '',
      record.rotaryClub || '',
      record.rotaryDistrict || '3231',
      Number(record.nonVegCount) || 0, // Column 9: Preferred Food — Non-Veg (Count)
      Number(record.vegCount) || 0,    // Column 10: Preferred Food — Veg (Count)
      rotariansCount,
      annsCount,
      annettesCount,
      rotarianAmount,
      annAmount,
      annetteAmount,
      Number(record.totalAmount) || 0, // Column 17: Total Registration Amount
      record.upiId || '73600301@ubin',
      record.utr ? `'${record.utr}` : '',
      record.paymentStatus || 'PENDING',
      screenshotRef,                   // Column 21: Payment Screenshot reference
      record.participantEmailStatus || 'PENDING',
      record.adminEmailStatus || 'PENDING',
      record.whatsappStatus || 'PENDING',
      lastUpdated
    ];
  }

  /**
   * Synchronizes a registration record to Google Sheets.
   * Checks for duplicate row by Registration ID:
   * - If row exists: UPDATES the existing row.
   * - If row does not exist: APPENDS exactly one new row.
   * 
   * Non-blocking: Errors are caught and logged, never disrupting the registration flow.
   * @param {object} registrationRecord
   */
  async syncRegistration(registrationRecord) {
    if (!registrationRecord || !registrationRecord.registrationId) {
      return { synced: false, reason: 'Invalid registration record' };
    }

    const sheets = this._getSheetsClient();
    const spreadsheetId = config.googleSheetId;

    let apiSyncResult = { synced: false };

    if (sheets && spreadsheetId) {
      try {
        apiSyncResult = await this._syncViaOfficialApi(sheets, spreadsheetId, registrationRecord);
      } catch (err) {
        console.warn(`[Sheets Sync] Official API error for ${registrationRecord.registrationId}:`, err.message);
      }
    }

    // Also support optional Webhook fallback if configured
    let webhookResult = { synced: false };
    if (config.googleSheetsWebhookUrl && config.googleSheetsWebhookUrl.trim()) {
      try {
        webhookResult = await this._syncViaWebhook(registrationRecord);
      } catch (err) {
        console.warn(`[Sheets Sync] Webhook fallback error:`, err.message);
      }
    }

    return {
      synced: apiSyncResult.synced || webhookResult.synced,
      apiResult: apiSyncResult,
      webhookResult: webhookResult
    };
  }

  /**
   * Core logic for Official Google Sheets API v4 with duplicate check.
   */
  async _syncViaOfficialApi(sheets, spreadsheetId, record) {
    await this._ensureSheetAndHeaders(sheets, spreadsheetId);

    const rowData = this.formatRow(record);

    // Read Column A to locate any existing row with this Registration ID
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A:A`
    });

    const rows = getRes.data.values || [];
    let existingRowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === record.registrationId) {
        existingRowIndex = i + 1; // Convert 0-indexed array to 1-indexed Sheet row number
        break;
      }
    }

    if (existingRowIndex > 0) {
      // Row already exists -> UPDATE existing row (prevent duplicates)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A${existingRowIndex}:Y${existingRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] }
      });

      return { synced: true, action: 'UPDATED', row: existingRowIndex };
    } else {
      // Row does not exist -> APPEND exactly one new row
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_NAME}!A:Y`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowData] }
      });

      return { synced: true, action: 'CREATED' };
    }
  }

  /**
   * Optional webhook dispatcher for Google Apps Script Webhook.
   */
  async _syncViaWebhook(registrationRecord) {
    const webhookUrl = config.googleSheetsWebhookUrl;
    if (!webhookUrl) return { synced: false, reason: 'No webhook URL' };

    const payload = JSON.stringify({
      action: 'SYNC_REGISTRATION',
      data: registrationRecord
    });

    const parsedUrl = new URL(webhookUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise((resolve) => {
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 8000
      };

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          resolve({ synced: res.statusCode >= 200 && res.statusCode < 400, statusCode: res.statusCode });
        });
      });

      req.on('error', (err) => resolve({ synced: false, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ synced: false, error: 'Timeout' }); });
      req.write(payload);
      req.end();
    });
  }
}

module.exports = new SheetsService();
