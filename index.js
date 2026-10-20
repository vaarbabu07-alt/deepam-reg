/**
 * Central Configuration Module — DEEPAM'26 Multi District Meeting
 * Loads environment variables with robust fallback defaults.
 * Single source of truth for pricing, event details, UPI parameters, and admin credentials.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Strips surrounding single or double quotes and trims whitespace from an env string value.
 * Handles the common mistake of writing  KEY="value"  or  KEY='value'  in .env files,
 * which causes dotenv to include the literal quote characters on Linux/macOS.
 * @param {string|undefined} val
 * @returns {string}
 */
function stripEnv(val) {
  if (val === undefined || val === null) return '';
  let s = String(val).trim();
  // Remove matching surrounding double quotes
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    s = s.slice(1, -1).trim();
  }
  // Remove matching surrounding single quotes
  else if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,

  // Event details
  eventName:    stripEnv(process.env.EVENT_NAME)    || "DEEPAM'26 — MULTI DISTRICT MEETING",
  districtName: stripEnv(process.env.DISTRICT_NAME) || 'Rotary International District 3231',
  eventDate:    stripEnv(process.env.EVENT_DATE)    || '27th & 28th November 2026',
  eventVenue:   stripEnv(process.env.EVENT_VENUE)   || 'Andal Singaravelu Kalyana Mandapam, Vengikkal, Tiruvannamalai',

  // Registration fees per category (INR)
  rotarianFee:  parseInt(process.env.ROTARIAN_FEE,  10) || 1200,
  annsFee:      parseInt(process.env.ANNS_FEE,      10) || 1000,
  annettesFee:  parseInt(process.env.ANNETTES_FEE,  10) || 1000,

  // Participant limits per category
  maxRotarians: parseInt(process.env.MAX_ROTARIANS, 10) || 10,
  maxAnns:      parseInt(process.env.MAX_ANNS,      10) || 50,
  maxAnnettes:  parseInt(process.env.MAX_ANNETTES,  10) || 50,
  minRotarians: 1,
  minAnns:      0,
  minAnnettes:  0,

  // UPI Payment details
  upiId:     stripEnv(process.env.UPI_ID)     || '73600301@ubin',
  payeeName: stripEnv(process.env.PAYEE_NAME) || 'ROTARY CLUB',
  currency:  'INR',

  // Administrative Credentials & Session Security
  adminUsername: stripEnv(process.env.ADMIN_USERNAME) || 'admin',
  adminPassword: stripEnv(process.env.ADMIN_PASSWORD) || 'rotaryadmin2026',
  sessionSecret: stripEnv(process.env.SESSION_SECRET) || 'rotary_secure_session_token_2026_xyz',

  // Admin notification email
  adminEmail: stripEnv(process.env.ADMIN_EMAIL) || 'deepammdm26@gmail.com',

  // SMTP email settings
  smtpHost: stripEnv(process.env.SMTP_HOST) || '',
  smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
  smtpUser: stripEnv(process.env.SMTP_USER) || '',
  smtpPass: stripEnv(process.env.SMTP_PASS) || '',
  smtpFrom: stripEnv(process.env.SMTP_FROM) || "DEEPAM'26 <noreply@deepam26.org>",

  // Official Google Sheets API Integration (Service Account)
  googleSheetId:              stripEnv(process.env.GOOGLE_SHEET_ID)              || '',
  googleServiceAccountEmail:  stripEnv(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) || '',
  googlePrivateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),

  // Google Sheets Webhook (Optional Fallback)
  googleSheetsWebhookUrl: stripEnv(process.env.GOOGLE_SHEETS_WEBHOOK_URL) || '',

  // WhatsApp Business API Integration
  whatsappAccessToken:       stripEnv(process.env.WHATSAPP_ACCESS_TOKEN)        || '',
  whatsappPhoneNumberId:     stripEnv(process.env.WHATSAPP_PHONE_NUMBER_ID)     || '',
  whatsappBusinessAccountId: stripEnv(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID) || '',
  whatsappTemplateName:      stripEnv(process.env.WHATSAPP_TEMPLATE_NAME)       || 'deepam26_registration_confirmation',
  whatsappTemplateLanguage:  stripEnv(process.env.WHATSAPP_TEMPLATE_LANGUAGE)   || 'en',

  // File Uploads
  uploadMaxSizeMB: parseInt(process.env.UPLOAD_MAX_SIZE_MB, 10) || 5,
  uploadDir: (process.env.NETLIFY === 'true' || process.env.LAMBDA_TASK_ROOT)
    ? path.join('/tmp', 'uploads')
    : path.join(__dirname, '..', 'public', 'uploads'),
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],

  // Storage
  dataDir: (process.env.NETLIFY === 'true' || process.env.LAMBDA_TASK_ROOT)
    ? path.join('/tmp', 'data')
    : path.join(__dirname, '..', 'data'),
  dataFile: (process.env.NETLIFY === 'true' || process.env.LAMBDA_TASK_ROOT)
    ? path.join('/tmp', 'data', 'registrations.json')
    : path.join(__dirname, '..', 'data', 'registrations.json')
};

module.exports = config;
