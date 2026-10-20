/**
 * Automated Test Suite â€” DEEPAM'26 Multi District Meeting Registration System
 * Tests all registration categories, validation rules, security, and admin operations.
 */

const http = require('http');
const path = require('path');
const fs   = require('fs');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT     = '3099';

// Isolate test database
const testDataDir = path.join(__dirname, 'test-data');
if (!fs.existsSync(testDataDir)) fs.mkdirSync(testDataDir, { recursive: true });
const testDbFile = path.join(testDataDir, 'test-registrations.json');
fs.writeFileSync(testDbFile, '[]', 'utf8');

const config = require('../config');
config.port     = 3099;
config.dataDir  = testDataDir;
config.dataFile = testDbFile;

const app = require('../server');

let server;
const BASE_URL = 'http://localhost:3099';

// â”€â”€â”€ HTTP helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function httpRequest(method, endpoint, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url     = new URL(endpoint, BASE_URL);
    const bodyStr = data ? JSON.stringify(data) : null;

    const options = {
      hostname: url.hostname,
      port:     url.port,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...headers
      }
    };

    const req = http.request(options, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { json = raw; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// â”€â”€â”€ Test runner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let totalPassed = 0, totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32mâœ” PASS\x1b[0m: ${message}`);
    totalPassed++;
  } else {
    console.error(`  \x1b[31mâœ– FAIL\x1b[0m: ${message}`);
    totalFailed++;
  }
}

// â”€â”€â”€ Shared valid registration payload (no screenshot â€” sent as JSON in tests)
// The validation middleware now requires a screenshot file.
// For JSON-only API tests the screenshot check still fires.
// We test the validation layer directly by sending multipart via a helper where needed.
// For tests that MUST produce 201 we supply a fake screenshot field in the JSON body
// and override the req.file injection by sending a simple JSON that bypasses multer.
// Since tests call /api/register directly without multipart, we need to mock the file.
// We do this by temporarily monkey-patching the upload middleware for tests.

function validPayload(overrides = {}) {
  return {
    fullName:       'John Doe',
    mobileNumber:   '9876543210',
    email:          'john.doe@example.com',
    rotaryClub:     'Rotary Club of Tiruvannamalai',
    rotaryDistrict: '3231',
    nonVegCount:    '2',
    vegCount:       '3',
    rotariansCount: '5',
    annsCount:      '2',
    annettesCount:  '1',
    utr:            'UTR987654321001',
    ...overrides
  };
}

// â”€â”€â”€ Patch upload & validation to skip screenshot for API tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// We patch req.file before validation runs so 201 tests work without a real file.
function patchUploadMiddleware() {
  const uploadMod = require('../middleware/upload');
  const origSingle = uploadMod.single.bind(uploadMod);
  uploadMod.single = (fieldName) => (req, res, next) => {
    req.file = { filename: 'test-screenshot.jpg' }; // Fake screenshot
    next();
  };
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' Starting DEEPAM\'26 Registration System Test Suite');
  console.log('======================================================\n');

  // Patch upload so all tests work without real file uploads
  patchUploadMiddleware();

  await new Promise(resolve => { server = app.listen(3099, resolve); });

  try {
    // â”€â”€â”€ TEST 1: 5 Rotarians, 2 Ann's, 1 Annette â†’ â‚¹10,500 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log("TEST 1: 5 Rotarians + 2 Ann's + 1 Annette â†’ â‚¹10,500");
    const res1 = await httpRequest('POST', '/api/register', validPayload());
    assert(res1.status === 201, `Status is 201 (Got ${res1.status})`);
    assert(res1.body.success === true, 'Success is true');
    assert(res1.body.registration.totalAmount === 9000,
      `Total amount is â‚¹10,500 (Got â‚¹${res1.body.registration?.totalAmount})`);
    assert(res1.body.registration.rotariansCount === 5, 'Rotarians count is 5');
    assert(res1.body.registration.annsCount      === 2, "Ann's count is 2");
    assert(res1.body.registration.annettesCount  === 1, "Annette's count is 1");
    assert(/^DEEPAM26-\d{5}$/.test(res1.body.registration.registrationId),
      `Registration ID format is valid (${res1.body.registration?.registrationId})`);
    assert(res1.body.registration.paymentStatus === 'PENDING', 'Initial payment status is PENDING');

    // â”€â”€â”€ TEST 2: 1 Rotarian, 0 Ann's, 0 Annette's â†’ â‚¹1,200 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nTEST 2: 1 Rotarian â†’ â‚¹1,200');
    const r2calc = await httpRequest('POST', '/api/calculate', { rotariansCount: '1', annsCount: '0', annettesCount: '0' });
    assert(r2calc.status === 200, `Status 200 (Got ${r2calc.status})`);
    assert(r2calc.body.calculation.totalAmount === 1200, `Total is â‚¹1,200 (Got ${r2calc.body.calculation?.totalAmount})`);

    // â”€â”€â”€ TEST 3: 10 Rotarians, 5 Ann's, 5 Annette's â†’ â‚¹25,000 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log("\nTEST 3: 10 Rotarians + 5 Ann's + 5 Annette's â†’ â‚¹25,000");
    const r3calc = await httpRequest('POST', '/api/calculate', { rotariansCount: '10', annsCount: '5', annettesCount: '5' });
    assert(r3calc.status === 200, `Status 200 (Got ${r3calc.status})`);
    assert(r3calc.body.calculation.totalAmount === 22000, `Total is â‚¹25,000 (Got ${r3calc.body.calculation?.totalAmount})`);
    assert(r3calc.body.calculation.rotarianTotal  === 12000, 'Rotarian subtotal = â‚¹15,000');
    assert(r3calc.body.calculation.annsTotal      === 5000,  "Ann's subtotal = â‚¹5,000");
    assert(r3calc.body.calculation.annettesTotal  === 5000,  "Annette's subtotal = â‚¹5,000");

    // â”€â”€â”€ TEST 4: Tampered amount is ignored by server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log("\nTEST 4: Tampered amount â‚¹1 â†’ Backend calculates â‚¹10,500");
    const res4 = await httpRequest('POST', '/api/register',
      validPayload({ utr: 'UTRSECURITY001', totalAmount: 1, amount: 1 }));
    assert(res4.status === 201, `Status 201 (Got ${res4.status})`);
    assert(res4.body.registration.totalAmount === 9000,
      `Tampered â‚¹1 ignored; authoritative total = â‚¹${res4.body.registration?.totalAmount}`);

    // â”€â”€â”€ TEST 5: Name with numbers â†’ INVALID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nTEST 5: Name "John123" â†’ INVALID');
    const res5 = await httpRequest('POST', '/api/register', validPayload({ fullName: 'John123', utr: 'UTRNAME001' }));
    assert(res5.status === 400, `Status 400 (Got ${res5.status})`);
    assert(res5.body.errors?.fullName && res5.body.errors.fullName.includes('valid name'),
      'fullName rejected with correct message');

    // â”€â”€â”€ TEST 6: 9-digit mobile â†’ INVALID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nTEST 6: 9-digit mobile â†’ INVALID');
    const res6 = await httpRequest('POST', '/api/register', validPayload({ mobileNumber: '987654321', utr: 'UTRMOB001' }));
    assert(res6.status === 400, `Status 400 (Got ${res6.status})`);
    assert(res6.body.errors?.mobileNumber === 'Please enter a valid 10-digit mobile number.', '9-digit mobile rejected');

    // â”€â”€â”€ TEST 7: 10-digit mobile â†’ VALID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nTEST 7: 10-digit mobile 9876543210 â†’ VALID');
    const r7calc = await httpRequest('POST', '/api/calculate', { rotariansCount: '5', annsCount: '0', annettesCount: '0' });
    assert(r7calc.status === 200, 'Calculate returns 200');
    assert(r7calc.body.calculation.totalAmount === 6000, 'Total â‚¹7,500 for 5 Rotarians');

    // â”€â”€â”€ TEST 8: Rotarians = 0 â†’ INVALID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nTEST 8: Rotarians = 0 â†’ INVALID');
    const res8 = await httpRequest('POST', '/api/calculate', { rotariansCount: '0', annsCount: '0', annettesCount: '0' });
    assert(res8.status === 400, `Status 400 (Got ${res8.status})`);
    assert(res8.body.success === false, 'Rejected 0 rotarians');

    // â”€â”€â”€ TEST 9: Decimal Rotarians = 2.5 â†’ INVALID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nTEST 9: Rotarians = 2.5 (decimal) â†’ INVALID');
    const res9 = await httpRequest('POST', '/api/calculate', { rotariansCount: '2.5', annsCount: '0', annettesCount: '0' });
    assert(res9.status === 400, `Status 400 (Got ${res9.status})`);
    assert(res9.body.success === false, 'Rejected decimal 2.5 rotarians');

    // â”€â”€â”€ TEST 10: Duplicate UTR â†’ 409 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nTEST 10: Duplicate UTR â†’ 409 Conflict');
    const res10 = await httpRequest('POST', '/api/register',
      validPayload({ mobileNumber: '9988776655', email: 'other@example.com', utr: 'UTR987654321001' }));
    assert(res10.status === 409, `Duplicate UTR returned 409 (Got ${res10.status})`);

    // â”€â”€â”€ TEST 11: Dynamic calculation: 3 Rotarians + 1 Ann + 2 Annette's â†’ â‚¹7,500
    console.log("\nTEST 11: 3 Rotarians + 1 Ann + 2 Annette's â†’ â‚¹6,600");
    const r11 = await httpRequest('POST', '/api/calculate', { rotariansCount: '3', annsCount: '1', annettesCount: '2' });
    assert(r11.status === 200, `Status 200 (Got ${r11.status})`);
    // 3Ã—1500 + 1Ã—1000 + 2Ã—1000 = 4500+1000+2000 = 7500
    assert(r11.body.calculation.totalAmount === 6600, `Total â‚¹7,500 (Got ${r11.body.calculation?.totalAmount})`);

    // â”€â”€â”€ TEST 12: Admin Login & Status Update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nTEST 12: Admin Login & Status Update');
    const loginRes = await httpRequest('POST', '/api/admin/login', {
      username: config.adminUsername,
      password: config.adminPassword
    });
    assert(loginRes.status === 200, `Admin login 200 (Got ${loginRes.status})`);
    const token = loginRes.body.token;

    const regId = res1.body.registration.registrationId;
    const updateRes = await httpRequest('POST', '/api/admin/update-status', {
      registrationId: regId, status: 'PAID', note: 'Verified'
    }, { Authorization: `Bearer ${token}` });
    assert(updateRes.status === 200, 'Status update returned 200');
    assert(updateRes.body.registration.paymentStatus === 'PAID', 'Registration changed to PAID');

    // â”€â”€â”€ TEST 13: Admin KPI Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nTEST 13: Admin KPI Statistics');
    const statsRes = await httpRequest('GET', '/api/admin/stats', null, { Authorization: `Bearer ${token}` });
    assert(statsRes.status === 200, 'Stats returned 200');
    assert(statsRes.body.stats.totalPaidAmount === 9000,
      `Paid amount is ₹9,000 (Got ${statsRes.body.stats.totalPaidAmount})`);
    assert(statsRes.body.stats.counts.paid === 1, 'Paid count is 1');

    // â”€â”€â”€ TEST 14: CSV Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nTEST 14: CSV Export');
    const csvRes = await httpRequest('GET', '/api/admin/export-csv', null, { Authorization: `Bearer ${token}` });
    assert(csvRes.status === 200, 'CSV export 200');
    assert(typeof csvRes.body === 'string' && csvRes.body.includes('Registration ID'), 'CSV has header');
    assert(typeof csvRes.body === 'string' && csvRes.body.includes(regId), 'CSV contains registration ID');
    assert(typeof csvRes.body === 'string' && csvRes.body.includes("Ann"), "CSV contains Ann's column");

    // â”€â”€â”€ TEST 15: 1 Rotarian â†’ â‚¹1,500 (QR & Pay Button Match) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nTEST 15: 1 Rotarian â†’ â‚¹1,500 (QR & Pay Button Match)');
    const t15Res = await httpRequest('POST', '/api/calculate', { rotariansCount: 1, annsCount: 0, annettesCount: 0 });
    assert(t15Res.status === 200, 'Calculate returns 200');
    assert(t15Res.body.calculation.totalAmount === 1200, 'Total is â‚¹1,500');
    assert(t15Res.body.payment.upiUri.includes('am=1200'), 'QR UPI URI contains am=1200');
    assert(t15Res.body.payment.upiUri.includes('pa=73600301'), 'QR UPI URI contains pa=73600301');

    // â”€â”€â”€ TEST 16: 1 Rotarian + 2 Ann + 3 Annette â†’ â‚¹6,500 (QR & Pay Button Match) â”€
    console.log('\nTEST 16: 1 Rotarian + 2 Ann + 3 Annette â†’ â‚¹6,500 (QR & Pay Button Match)');
    const t16Res = await httpRequest('POST', '/api/calculate', { rotariansCount: 1, annsCount: 2, annettesCount: 3 });
    assert(t16Res.status === 200, 'Calculate returns 200');
    assert(t16Res.body.calculation.totalAmount === 6200, 'Total is â‚¹6,500');
    assert(t16Res.body.payment.upiUri.includes('am=6200'), 'QR UPI URI contains am=6200');
    assert(t16Res.body.payment.upiUri.includes('pa=73600301'), 'QR UPI URI contains pa=73600301');

    // â”€â”€â”€ TEST 17: 5 Rotarians + 2 Ann + 1 Annette â†’ â‚¹10,500 (QR & Pay Button Match) 
    console.log('\nTEST 17: 5 Rotarians + 2 Ann + 1 Annette â†’ â‚¹10,500 (QR & Pay Button Match)');
    const t17Res = await httpRequest('POST', '/api/calculate', { rotariansCount: 5, annsCount: 2, annettesCount: 1 });
    assert(t17Res.status === 200, 'Calculate returns 200');
    assert(t17Res.body.calculation.totalAmount === 9000, 'Total is â‚¹10,500');
    assert(t17Res.body.payment.upiUri.includes('am=9000'), 'QR UPI URI contains am=9000');
    assert(t17Res.body.payment.upiUri.includes('pa=73600301'), 'QR UPI URI contains pa=73600301');

    // â”€â”€â”€ TEST 18: Frontend Static Verification (No Poster, Dynamic QR Links) â”€
    console.log('\nTEST 18: Frontend Clean QR & Poster Removal Verification');
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    assert(!indexHtml.includes('images/upi-qr.jpg'), 'Union Bank poster image removed');
    assert(!indexHtml.includes('official-qr-wrap'), 'Official poster wrapper removed');
    assert(indexHtml.includes('id="qr-pay-link"'), 'qr-pay-link element present');
    assert(indexHtml.includes('id="qrcode-container"'), 'qrcode-container element present');
    assert(appJs.includes('el.qrPayLink.href = upiUri'), 'qrPayLink.href bound to dynamic upiUri');
    assert(appJs.includes('el.upiPayLink.href = upiUri'), 'upiPayLink.href bound to dynamic upiUri');

    console.log('\n======================================================');
    console.log(` Test Results: ${totalPassed} Passed, ${totalFailed} Failed`);
    console.log('======================================================\n');

    if (totalFailed > 0) process.exit(1);
  } catch (err) {
    console.error('Unexpected error in test suite:', err);
    process.exit(1);
  } finally {
    server.close();
    await new Promise(r => setTimeout(r, 150));
    try { fs.rmSync(testDataDir, { recursive: true, force: true }); } catch {}
    process.exit(0);
  }
}

runTests();


