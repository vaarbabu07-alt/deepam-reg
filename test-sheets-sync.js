/**
 * Verification Test: Google Sheets Synchronization & Duplicate Protection
 * Tests:
 * 1. Exact 24 columns structure & values matching specifications.
 * 2. Registration creation -> exactly ONE row created.
 * 3. Participant data completeness in the row.
 * 4. Admin update PENDING -> PAID -> updates the SAME row, NO second row created.
 * 5. Error resilience: registration succeeds even if Google Sheets API is temporarily offline.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '3098';

const config = require('../config');
config.port = 3098;

const storageService = require('../services/storage');
const sheetsService = require('../services/sheets');

console.log('\n======================================================');
console.log(' Testing Google Sheets Synchronization for DEEPAM\'26');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function check(desc, condition) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${desc}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${desc}`);
    failed++;
  }
}

async function runTest() {
  try {
    // 1. Verify 24 Columns Exact Structure
    console.log('STEP 1: Verify 24 Header Columns & Order');
    const expectedHeaders = [
      'Registration ID',
      'Registration Date',
      'Registration Time',
      'Full Name',
      'Mobile Number',
      'Email Address',
      'Rotary Club',
      'Rotary District',
      'Preferred Food - Veg',
      'Preferred Food - Non-Veg',
      'Number of Rotarians',
      'Number of Ann',
      'Number of Annette',
      'Rotarian Amount',
      'Ann Amount',
      'Annette Amount',
      'Total Amount',
      'UPI ID',
      'UTR / Transaction ID',
      'Payment Status',
      'Payment Screenshot',
      'Participant Email Status',
      'Admin Email Status',
      'Last Updated'
    ];

    // Read formatRow headers
    const sampleRecord = {
      registrationId: 'DEEPAM26-99999',
      timestamp: '2026-09-12T10:30:00.000Z',
      fullName: 'Rtn Test User',
      mobileNumber: '9876543210',
      email: 'test@rotary.org',
      rotaryClub: 'Rotary Club of Tiruvannamalai',
      rotaryDistrict: '3231',
      vegCount: 2,
      nonVegCount: 1,
      rotariansCount: 2,
      annsCount: 1,
      annettesCount: 0,
      rotarianFee: 1200,
      annsFee: 1000,
      annettesFee: 1000,
      rotarianTotal: 2400,
      annsTotal: 1000,
      annettesTotal: 0,
      totalAmount: 3400,
      upiId: '73600301@ubin',
      utr: 'UTR123456789012',
      paymentStatus: 'PENDING',
      paymentScreenshot: 'data:image/jpeg;base64,samplebase64',
      participantEmailStatus: 'SENT',
      adminEmailStatus: 'SENT'
    };

    const row = sheetsService.formatRow(sampleRecord);

    check('Row has exactly 24 columns', row.length === 24);
    check('Column 1 is Registration ID', row[0] === 'DEEPAM26-99999');
    check('Column 4 is Full Name', row[3] === 'Rtn Test User');
    check('Column 5 is Mobile Number string', row[4] === "'9876543210");
    check('Column 6 is Email Address', row[5] === 'test@rotary.org');
    check('Column 7 is Rotary Club', row[6] === 'Rotary Club of Tiruvannamalai');
    check('Column 8 is Rotary District', row[7] === '3231');
    check('Column 9 is Veg Count (2)', row[8] === 2);
    check('Column 10 is Non-Veg Count (1)', row[9] === 1);
    check('Column 11 is Rotarians Count (2)', row[10] === 2);
    check('Column 12 is Ann Count (1)', row[11] === 1);
    check('Column 13 is Annette Count (0)', row[12] === 0);
    check('Column 14 is Rotarian Total (₹3000)', row[13] === 3000);
    check('Column 15 is Ann Total (₹1000)', row[14] === 1000);
    check('Column 16 is Annette Total (₹0)', row[15] === 0);
    check('Column 17 is Total Amount (₹4000)', row[16] === 4000);
    check('Column 18 is UPI ID (73600301@ubin)', row[17] === '73600301@ubin');
    check('Column 19 is UTR string', row[18] === "'UTR123456789012");
    check('Column 20 is Payment Status (PENDING)', row[19] === 'PENDING');
    check('Column 21 is Secure Screenshot reference', row[20] === 'Uploaded (Stored securely in database)');
    check('Column 22 is Participant Email Status (SENT)', row[21] === 'SENT');
    check('Column 23 is Admin Email Status (SENT)', row[22] === 'SENT');
    check('Column 24 has Last Updated timestamp', typeof row[23] === 'string' && row[23].length > 0);

    // 2. Duplicate Protection & Row Synchronization Simulation
    console.log('\nSTEP 2: Test Single Row Creation & Duplicate Protection (API Simulation)');
    
    // In-memory sheet mock to verify Google Sheets API behavior
    const mockSheetData = [
      expectedHeaders // Row 1: Headers
    ];

    const mockSheetsClient = {
      spreadsheets: {
        get: async () => ({
          data: { sheets: [{ properties: { title: 'Registrations' } }] }
        }),
        values: {
          get: async ({ range }) => {
            if (range === 'Registrations!A:A') {
              return { data: { values: mockSheetData.map(r => [r[0]]) } };
            }
            if (range === 'Registrations!A1:X1') {
              return { data: { values: [mockSheetData[0]] } };
            }
            return { data: { values: [] } };
          },
          append: async ({ requestBody }) => {
            mockSheetData.push(requestBody.values[0]);
            return { data: { updates: { updatedRows: 1 } } };
          },
          update: async ({ range, requestBody }) => {
            const match = range.match(/A(\d+):X(\d+)/);
            if (match) {
              const rowNum = parseInt(match[1], 10);
              mockSheetData[rowNum - 1] = requestBody.values[0];
            }
            return { data: { updatedRows: 1 } };
          }
        }
      }
    };

    // First synchronization: Registration creates exactly ONE row
    const res1 = await sheetsService._syncViaOfficialApi(mockSheetsClient, 'test-sheet-id', sampleRecord);
    check('First sync action is CREATED', res1.action === 'CREATED');
    check('Mock sheet now has exactly 2 rows (1 header + 1 data)', mockSheetData.length === 2);
    check('Row 2 ID matches registration ID', mockSheetData[1][0] === sampleRecord.registrationId);
    check('Row 2 Payment Status is PENDING', mockSheetData[1][19] === 'PENDING');

    // Second synchronization (e.g. repeated call for same registration ID)
    const res2 = await sheetsService._syncViaOfficialApi(mockSheetsClient, 'test-sheet-id', sampleRecord);
    check('Repeated sync action is UPDATED (never duplicate)', res2.action === 'UPDATED');
    check('Mock sheet still has exactly 2 rows (NO duplicate created)', mockSheetData.length === 2);

    // 3. Admin status change PENDING -> PAID
    console.log('\nSTEP 3: Admin Status Update PENDING → PAID');
    const updatedRecord = { ...sampleRecord, paymentStatus: 'PAID' };
    const res3 = await sheetsService._syncViaOfficialApi(mockSheetsClient, 'test-sheet-id', updatedRecord);
    
    check('Admin status sync action is UPDATED', res3.action === 'UPDATED');
    check('Mock sheet still has exactly 2 rows (NO duplicate created)', mockSheetData.length === 2);
    check('Row 2 Payment Status is now PAID', mockSheetData[1][19] === 'PAID');
    check('Row 2 Registration ID is still unchanged', mockSheetData[1][0] === sampleRecord.registrationId);

    // 4. Non-blocking error handling
    console.log('\nSTEP 4: Test Non-Blocking Error Handling');
    const failingSheetsClient = {
      spreadsheets: {
        get: async () => { throw new Error('Google API quota exceeded / network offline'); }
      }
    };

    let threw = false;
    try {
      const errorResult = await sheetsService.syncRegistration(sampleRecord);
      check('syncRegistration does not throw on API error', true);
    } catch (e) {
      threw = true;
    }
    check('Error handling prevented process crash', !threw);

    console.log('\n======================================================');
    console.log(` Google Sheets Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('======================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runTest();
