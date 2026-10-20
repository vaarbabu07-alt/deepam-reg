/**
 * ===================================================================
 * Google Apps Script - Rotary DEEPAM'26 Registration Webhook
 * ===================================================================
 * This script receives registration data from the Express / Netlify backend
 * and synchronizes it to the 'Registrations' worksheet with duplicate protection.
 *
 * Exact 24 columns matching Rotary DEEPAM'26 requirements:
 * 1. Registration ID
 * 2. Registration Date
 * 3. Registration Time
 * 4. Full Name
 * 5. Mobile Number
 * 6. Email Address
 * 7. Rotary Club
 * 8. Rotary District
 * 9. Preferred Food - Veg
 * 10. Preferred Food - Non-Veg
 * 11. Number of Rotarians
 * 12. Number of Ann
 * 13. Number of Annette
 * 14. Rotarian Amount
 * 15. Ann Amount
 * 16. Annette Amount
 * 17. Total Amount
 * 18. UPI ID
 * 19. UTR / Transaction ID
 * 20. Payment Status
 * 21. Payment Screenshot
 * 22. Participant Email Status
 * 23. Admin Email Status
 * 24. Last Updated
 * ===================================================================
 */

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
  'Payment Screenshot reference',
  'Participant Email Status',
  'Admin Email Status',
  'Last Updated'
];

/**
 * One-time setup function to initialize worksheet and headers.
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Registrations');
  if (!sheet) {
    sheet = ss.insertSheet('Registrations', 0);
  }

  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setValues([HEADERS]);
  headerRange.setBackground('#002244'); // Rotary Navy
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);
}

/**
 * Webhook handler for POST requests.
 * Searches Column A for existing Registration ID:
 * - If found: updates the existing row (prevents duplicates).
 * - If not found: appends exactly one new row.
 */
function doPost(e) {
  try {
    const rawData = e.postData.contents;
    const request = JSON.parse(rawData);
    const data = request.data;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Registrations');
    if (!sheet) {
      sheet = ss.insertSheet('Registrations', 0);
      setupSheet();
    } else if (sheet.getLastRow() === 0) {
      setupSheet();
    }

    let regDate = '';
    let regTime = '';
    if (data.timestamp) {
      try {
        const d = new Date(data.timestamp);
        regDate = Utilities.formatDate(d, 'Asia/Kolkata', 'dd-MMM-yyyy');
        regTime = Utilities.formatDate(d, 'Asia/Kolkata', 'HH:mm:ss');
      } catch (_) {
        const parts = String(data.timestamp).split('T');
        regDate = parts[0] || '';
        regTime = parts[1] || '';
      }
    }

    const lastUpdated = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy HH:mm:ss');

    let screenshotRef = 'Not Uploaded';
    if (data.paymentScreenshot) {
      const scr = String(data.paymentScreenshot);
      if (scr.startsWith('data:')) {
        screenshotRef = 'Uploaded (Stored securely in database)';
      } else if (scr.startsWith('/uploads/')) {
        screenshotRef = 'Uploaded (' + scr + ')';
      } else {
        screenshotRef = 'Uploaded';
      }
    }

    const rotariansCount = Number(data.rotariansCount) || 0;
    const annsCount = Number(data.annsCount) || 0;
    const annettesCount = Number(data.annettesCount) || 0;

    const rotarianAmount = Number(data.rotarianTotal) || (rotariansCount * (Number(data.rotarianFee) || 1200));
    const annAmount = Number(data.annsTotal) || (annsCount * (Number(data.annsFee) || 1000));
    const annetteAmount = Number(data.annettesTotal) || (annettesCount * (Number(data.annettesFee) || 1000));

    const row = [
      data.registrationId || '',
      regDate,
      regTime,
      data.fullName || '',
      `'${data.mobileNumber || ''}`,
      data.email || '',
      data.rotaryClub || '',
      data.rotaryDistrict || '3231',
      Number(data.nonVegCount) || 0, // Column 9: Preferred Food — Non-Veg (Count)
      Number(data.vegCount) || 0,    // Column 10: Preferred Food — Veg (Count)
      rotariansCount,
      annsCount,
      annettesCount,
      rotarianAmount,
      annAmount,
      annetteAmount,
      Number(data.totalAmount) || 0, // Column 17: Total Registration Amount
      data.upiId || '73600301@ubin',
      data.utr ? `'${data.utr}` : '',
      data.paymentStatus || 'PENDING',
      screenshotRef,                 // Column 21: Payment Screenshot reference
      data.participantEmailStatus || 'PENDING',
      data.adminEmailStatus || 'PENDING',
      lastUpdated
    ];

    // Check for existing row by Registration ID (Column A)
    const lastRow = sheet.getLastRow();
    let existingRow = -1;

    if (lastRow > 1) {
      const idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < idValues.length; i++) {
        if (idValues[i][0] === data.registrationId) {
          existingRow = i + 2; // Accounting for 1-based index + header row
          break;
        }
      }
    }

    if (existingRow > 0) {
      // Update existing row (no duplicates)
      sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        action: 'UPDATED',
        row: existingRow,
        registrationId: data.registrationId
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      // Append new row
      sheet.appendRow(row);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        action: 'CREATED',
        registrationId: data.registrationId
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (ping / health check).
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    status: 'DEEPAM 26 Google Sheets Sync endpoint is active',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
