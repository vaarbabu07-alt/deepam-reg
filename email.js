/**
 * Email Service — DEEPAM'26 Multi District Meeting
 * Sends participant confirmation and admin notification emails via SMTP (Nodemailer).
 * Handles verification, fallback, and delivery logging.
 */

const path = require('path');
const fs   = require('fs');
const config = require('../config');

let nodemailer = null;
let transporter = null;
let isVerifying = false;

// Path to the email header banner image
const EMAIL_HEADER_IMAGE_PATH = path.join(__dirname, '..', 'public', 'images', 'deepam26-email-header.jpg');

/**
 * Creates or retrieves the Nodemailer transporter.
 */
function getTransporter(forceRefresh = false) {
  if (transporter && !forceRefresh) return transporter;

  const missing = [];
  if (!config.smtpHost) missing.push('SMTP_HOST');
  if (!config.smtpUser) missing.push('SMTP_USER');
  if (!config.smtpPass) missing.push('SMTP_PASS');

  if (missing.length > 0) {
    console.warn(`[Email] SMTP is not configured. Missing ${missing.join(', ')}.`);
    return null;
  }

  try {
    nodemailer = nodemailer || require('nodemailer');

    // Clean App Password: remove spaces and any surrounding quotes
    const rawPass = config.smtpPass || '';
    const cleanPass = rawPass
      .replace(/^["']|["']$/g, '') // strip surrounding quotes
      .replace(/\s+/g, '');        // strip all whitespace (App Password groups)

    const isGmail = config.smtpHost.includes('gmail.com');
    const isSsl = config.smtpPort === 465;

    const transportOpts = {
      pool: false,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      auth: {
        user: config.smtpUser,
        pass: cleanPass
      }
    };

    if (isGmail) {
      transportOpts.service = 'gmail';
    } else {
      transportOpts.host = config.smtpHost;
      transportOpts.port = config.smtpPort;
      transportOpts.secure = isSsl;
    }

    transporter = nodemailer.createTransport(transportOpts);
    return transporter;
  } catch (err) {
    console.error('[Email] Failed to create SMTP transporter:', err.message);
    return null;
  }
}

/**
 * Verifies SMTP connection on startup / initialization.
 */
async function verifyConnection() {
  if (isVerifying) return;
  isVerifying = true;

  const t = getTransporter(true);
  if (!t) {
    console.warn('[Email] SMTP verification skipped: missing credentials.');
    isVerifying = false;
    return;
  }

  try {
    await t.verify();
    console.log('EMAIL SERVICE READY');
  } catch (err) {
    console.error('[Email] SMTP verification error:', err.message);
  } finally {
    isVerifying = false;
  }
}

/**
 * Formats currency in Indian locale.
 */
function fmt(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

/**
 * Helper: builds the HTML rows for additional member details.
 */
function buildMemberDetailsHtml(reg) {
  const members = [];

  // Member 1 is always the primary participant
  members.push({ name: reg.fullName || '-', phone: reg.mobileNumber || '-' });

  // Additional members (Member 2, 3, ...)
  if (reg.additionalMembers && Array.isArray(reg.additionalMembers)) {
    reg.additionalMembers.forEach(m => {
      members.push({ name: m.name || '-', phone: m.phone || '-' });
    });
  }

  let html = '';
  members.forEach((m, idx) => {
    const memberNum = idx + 1;
    html += `<tr><th>Member ${memberNum} — Name</th><td>${escHtml(m.name)}</td></tr>\n`;
    html += `<tr><th>Member ${memberNum} — Contact</th><td>${escHtml(m.phone)}</td></tr>\n`;
  });

  return html;
}

/**
 * Helper: builds the plain-text lines for additional member details.
 */
function buildMemberDetailsText(reg) {
  const members = [];
  members.push({ name: reg.fullName || '-', phone: reg.mobileNumber || '-' });

  if (reg.additionalMembers && Array.isArray(reg.additionalMembers)) {
    reg.additionalMembers.forEach(m => {
      members.push({ name: m.name || '-', phone: m.phone || '-' });
    });
  }

  let text = '';
  members.forEach((m, idx) => {
    text += `Member ${idx + 1} — Name: ${m.name}\n`;
    text += `Member ${idx + 1} — Contact: ${m.phone}\n`;
  });

  return text;
}

/** Escape HTML entities */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Participant Confirmation Email ──────────────────────────────────────────

/**
 * Builds the plain text body for participant confirmation email.
 */
function buildParticipantText(reg) {
  const rotariansCount = reg.rotariansCount || 0;
  const utrDisplay = (reg.utr && String(reg.utr).trim() !== '') ? reg.utr.trim() : 'Not Provided';
  const totalAmountStr = Number(reg.totalAmount || 0).toLocaleString('en-IN');

  return `Dear ${reg.fullName},

Thank you for registering for DEEPAM'26 — MULTI DISTRICT MEETING.
Your registration has been successfully received.

Registration ID: ${reg.registrationId}

PARTICIPANT INFORMATION

Full Name: ${reg.fullName}
Mobile Number: ${reg.mobileNumber}
Email ID: ${reg.email}
Rotary Club Of: ${reg.rotaryClub}
District: ${reg.rotaryDistrict}

REGISTRATION DETAILS

${buildMemberDetailsText(reg)}
Number of Members Attending: ${rotariansCount}
Preferred Food — Non-Veg Count: ${reg.nonVegCount || 0}
Preferred Food — Veg Count: ${reg.vegCount || 0}

PAYMENT REFERENCE

Total Registration Amount: ₹${totalAmountStr}
UPI ID: ${reg.upiId || config.upiId}
UPI Transaction ID / UTR: ${utrDisplay}
Payment Status: Pending — Awaiting Admin Verification

Thank you for your registration. We are excited to see you at the Multi District Meeting.

NOTE: THE INVOICE WILL BE SENT THROUGH YOUR WHATSAPP AFTER CONFIRMING THE PAYMENT DETAILS.

For any registration queries, contact:

Rtn.PP.PHF.THOMAS JAYABALAN A
+91 8144029925

Rtn.PP.PHF.M.M.BABU
+91 9443116788

Regards,

Rtn. T.S. Ravi Kumar
District Governor 26-27

Rtn. V. Banu
MULTI DISTRICT MEET CHAIRMAN 26-27`;
}

/**
 * Builds the HTML body for participant confirmation email.
 * Uses CID-embedded header image for maximum compatibility.
 */
function buildParticipantEmail(reg) {
  const rotariansCount = reg.rotariansCount || 0;
  const utrDisplay = (reg.utr && String(reg.utr).trim() !== '') ? reg.utr.trim() : 'Not Provided';
  const totalAmountStr = Number(reg.totalAmount || 0).toLocaleString('en-IN');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; line-height: 1.6; }
  .wrapper { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
  .header-img-container { width: 100%; background: #ffffff; text-align: center; }
  .header-img-container img { width: 100%; max-width: 600px; height: auto; display: block; }
  .body { padding: 30px 24px; color: #1f2937; }
  .reg-box { background: #f0fdf4; border: 2px solid #059669; border-radius: 8px; padding: 14px 20px; text-align: center; margin: 20px 0; }
  .reg-box .label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #065f46; font-weight: bold; }
  .reg-box .value { font-size: 24px; font-weight: 800; color: #002244; font-family: monospace; letter-spacing: 2px; }
  .section-title { font-size: 15px; font-weight: bold; color: #002244; border-bottom: 2px solid #F7A81B; padding-bottom: 5px; margin: 24px 0 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { padding: 9px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
  th { background: #f9fafb; color: #4b5563; font-weight: 600; width: 40%; }
  .total-row td { font-size: 17px; font-weight: 800; color: #059669; }
  .badge-success { display: inline-block; background-color: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 12.5px; }
  .badge-pending { display: inline-block; background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 12.5px; }
  .event-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .contact-box { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; }
  .note-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px; margin: 16px 0; font-size: 13.5px; color: #991b1b; font-weight: 600; text-align: center; }
  .signature-box { margin-top: 25px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 14px; line-height: 1.5; }
  .footer { background-color: #002244; color: #94a3b8; text-align: center; padding: 18px 24px; font-size: 12px; }
</style>
</head>
<body>
<div class="wrapper">
  <!-- Header Banner Image -->
  <div class="header-img-container">
    <img src="cid:deepam26-email-header" alt="DEEPAM'26 Multi District Meet — Rotary International District 3231" style="width:100%;max-width:600px;height:auto;display:block;">
  </div>

  <div class="body">
    <p>Dear <strong>${escHtml(reg.fullName)}</strong>,</p>
    <p>Thank you for registering for <strong>DEEPAM'26 — MULTI DISTRICT MEETING</strong>.<br>
       Your registration has been successfully received.</p>

    <div class="reg-box">
      <div class="label">Registration ID</div>
      <div class="value">${escHtml(reg.registrationId)}</div>
    </div>

    <div class="section-title">PARTICIPANT INFORMATION</div>
    <table>
      <tr><th>Full Name</th><td>${escHtml(reg.fullName)}</td></tr>
      <tr><th>Mobile Number</th><td>${escHtml(reg.mobileNumber)}</td></tr>
      <tr><th>Email ID</th><td>${escHtml(reg.email)}</td></tr>
      <tr><th>Rotary Club Of</th><td>${escHtml(reg.rotaryClub)}</td></tr>
      <tr><th>District</th><td>${escHtml(reg.rotaryDistrict)}</td></tr>
    </table>

    <div class="section-title">REGISTRATION DETAILS</div>
    <table>
      ${buildMemberDetailsHtml(reg)}
      <tr><th>Number of Members Attending</th><td>${rotariansCount}</td></tr>
      <tr><th>Preferred Food — Non-Veg</th><td>${reg.nonVegCount || 0}</td></tr>
      <tr><th>Preferred Food — Veg</th><td>${reg.vegCount || 0}</td></tr>
    </table>

    <div class="section-title">PAYMENT REFERENCE</div>
    <table>
      <tr class="total-row"><th>Total Registration Amount</th><td>₹${totalAmountStr}</td></tr>
      <tr><th>UPI ID</th><td>${reg.upiId || config.upiId}</td></tr>
      <tr><th>UPI Transaction ID / UTR</th><td style="font-family:monospace;font-weight:600;">${escHtml(utrDisplay)}</td></tr>
      <tr><th>Payment Status</th><td><span class="badge-pending">Pending Verification</span></td></tr>
    </table>

    <div class="section-title">EVENT DETAILS</div>
    <div class="event-box">
      <p style="margin: 0 0 8px;"><strong>Event Date:</strong><br>27th &amp; 28th November 2026</p>
      <p style="margin: 0;"><strong>Venue:</strong><br>Andal Singaravelu Kalyana Mandapam,<br>Vengikkal, Tiruvannamalai</p>
    </div>

    <p>Thank you for your registration. We are excited to see you at the Multi District Meeting.</p>

    <div class="note-box">
      NOTE: THE INVOICE WILL BE SENT THROUGH YOUR WHATSAPP AFTER CONFIRMING THE PAYMENT DETAILS.
    </div>

    <div class="contact-box">
      <strong>For any registration queries, contact:</strong><br><br>
      Rtn.PP.PHF.THOMAS JAYABALAN A<br>
      <a href="tel:+918144029925" style="color:#002244;text-decoration:none;font-weight:bold;">+91 8144029925</a><br><br>
      Rtn.PP.PHF.M.M.BABU<br>
      <a href="tel:+919443116788" style="color:#002244;text-decoration:none;font-weight:bold;">+91 9443116788</a>
    </div>

    <div class="signature-box">
      <p style="margin: 0 0 6px;">Regards,</p>
      <p style="margin: 0;"><strong>Rtn. T.S. Ravi Kumar</strong><br>District Governor 26-27</p>
      <p style="margin: 8px 0 0;"><strong>Rtn. V. Banu</strong><br>MULTI DISTRICT MEET CHAIRMAN 26-27</p>
    </div>
  </div>
  <div class="footer">
    <p style="margin: 0;">DEEPAM'26 — MULTI DISTRICT MEETING | Rotary International District 3231</p>
  </div>
</div>
</body>
</html>`;
}

// ─── Admin Notification Email ────────────────────────────────────────────────

/**
 * Builds the plain text body for admin notification email.
 */
function buildAdminText(reg) {
  const ts = new Date(reg.timestamp || Date.now());
  const dateStr = ts.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = ts.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const rotFee = reg.rotarianFee || 1200;
  const annFee = reg.annsFee || 1000;
  const annettFee = reg.annettesFee || 1000;

  const rotTotal = reg.rotarianTotal || ((reg.rotariansCount || 0) * rotFee);
  const annTotal = reg.annsTotal || ((reg.annsCount || 0) * annFee);
  const annettTotal = reg.annettesTotal || ((reg.annettesCount || 0) * annettFee);

  const utrDisplay = (reg.utr && String(reg.utr).trim() !== '') ? reg.utr.trim() : 'Not Provided';

  return `DEEPAM'26 – MULTI DISTRICT MEETING

New Registration Notification

--------------------------------
REGISTRATION DETAILS
--------------------------------
Registration ID: ${reg.registrationId}
Registration Date: ${dateStr}
Registration Time: ${timeStr}

--------------------------------
PARTICIPANT INFORMATION
--------------------------------
Full Name: ${reg.fullName}
Mobile Number: ${reg.mobileNumber}
Email Address: ${reg.email}
Rotary Club: ${reg.rotaryClub}
Rotary District: ${reg.rotaryDistrict}

--------------------------------
MEMBER DETAILS
--------------------------------
${buildMemberDetailsText(reg)}
Number of Members Attending: ${reg.rotariansCount || 0}

--------------------------------
REGISTRATION DETAILS & FEES
--------------------------------
Number of Members Attending: ${reg.rotariansCount || 0}
Registration Fee per Member: ₹${Number(rotFee).toLocaleString('en-IN')}
TOTAL REGISTRATION AMOUNT: ₹${Number(reg.totalAmount || 0).toLocaleString('en-IN')}

--------------------------------
FOOD REQUIREMENTS
--------------------------------
Non-Veg Count: ${reg.nonVegCount || 0}
Veg Count: ${reg.vegCount || 0}

--------------------------------
PAYMENT DETAILS
--------------------------------
UPI ID: ${reg.upiId || config.upiId}
UTR / Transaction ID: ${utrDisplay}
Payment Status: PENDING — Awaiting Verification
Payment Screenshot: ${reg.paymentScreenshot ? 'Attached to this email' : 'None'}`;
}

/**
 * Builds the HTML body for admin notification email.
 * Uses CID-embedded header image.
 */
function buildAdminEmail(reg) {
  const ts = new Date(reg.timestamp || Date.now());
  const dateStr = ts.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = ts.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const rotFee = reg.rotarianFee || 1200;
  const annFee = reg.annsFee || 1000;
  const annettFee = reg.annettesFee || 1000;

  const rotTotal = reg.rotarianTotal || ((reg.rotariansCount || 0) * rotFee);
  const annTotal = reg.annsTotal || ((reg.annsCount || 0) * annFee);
  const annettTotal = reg.annettesTotal || ((reg.annettesCount || 0) * annettFee);

  const utrDisplay = (reg.utr && String(reg.utr).trim() !== '') ? reg.utr.trim() : 'Not Provided';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: Arial, sans-serif; background: #f4f6f8; margin: 0; padding: 0; }
  .wrapper { max-width: 640px; margin: 30px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
  .header-img-container { width: 100%; background: #ffffff; text-align: center; }
  .header-img-container img { width: 100%; max-width: 640px; height: auto; display: block; }
  .header-bar { background: #002244; color: #fff; padding: 14px 22px; text-align: center; }
  .header-bar h2 { margin: 0; font-size: 16px; }
  .header-bar p { margin: 4px 0 0; font-size: 13px; color: #F7A81B; }
  .body { padding: 24px; color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13.5px; }
  th { background: #f8f9fa; color: #555; width: 42%; font-weight: 600; }
  .total-row td { font-size: 16px; font-weight: 800; color: #059669; }
  .section-head { color: #002244; border-bottom: 2px solid #F7A81B; padding-bottom: 4px; margin: 18px 0 8px; font-size: 14px; text-transform: uppercase; }
  .badge-success { display: inline-block; background-color: #d1fae5; color: #065f46; padding: 3px 10px; border-radius: 12px; font-weight: bold; font-size: 12px; }
  .badge-pending { display: inline-block; background-color: #fef3c7; color: #92400e; padding: 3px 10px; border-radius: 12px; font-weight: bold; font-size: 12px; }
  .footer { background: #002244; color: #aab; text-align: center; padding: 12px; font-size: 12px; }
</style>
</head>
<body>
<div class="wrapper">
  <!-- Header Banner Image -->
  <div class="header-img-container">
    <img src="cid:deepam26-email-header" alt="DEEPAM'26 Multi District Meet — Rotary International District 3231" style="width:100%;max-width:640px;height:auto;display:block;">
  </div>

  <div class="header-bar">
    <h2>New Registration Received</h2>
    <p>${escHtml(reg.registrationId)} &mdash; ${escHtml(reg.fullName)}</p>
  </div>

  <div class="body">
    <div style="background:#f0f4ff;border:2px solid #002244;border-radius:8px;padding:12px 18px;text-align:center;margin-bottom:16px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;">Registration ID</div>
      <div style="font-size:22px;font-weight:800;color:#002244;font-family:monospace;letter-spacing:2px;">${escHtml(reg.registrationId)}</div>
      <div style="font-size:12px;color:#888;margin-top:4px;">${dateStr} &mdash; ${timeStr}</div>
    </div>

    <div class="section-head">PARTICIPANT INFORMATION</div>
    <table>
      <tr><th>Full Name</th><td>${escHtml(reg.fullName)}</td></tr>
      <tr><th>Mobile Number</th><td>${escHtml(reg.mobileNumber)}</td></tr>
      <tr><th>Email Address</th><td>${escHtml(reg.email)}</td></tr>
      <tr><th>Rotary Club</th><td>${escHtml(reg.rotaryClub)}</td></tr>
      <tr><th>Rotary District</th><td>${escHtml(reg.rotaryDistrict)}</td></tr>
    </table>

    <div class="section-head">MEMBER DETAILS</div>
    <table>
      ${buildMemberDetailsHtml(reg)}
      <tr style="background:#e0f2fe;"><th>Number of Members Attending</th><td style="font-weight:700;">${reg.rotariansCount || 0}</td></tr>
    </table>

    <div class="section-head">REGISTRATION SUMMARY &amp; FEES</div>
    <table>
      <tr><th>Number of Members Attending</th><td style="font-weight:600;">${reg.rotariansCount || 0}</td></tr>
      <tr><th>Registration Fee per Member</th><td>₹${Number(rotFee).toLocaleString('en-IN')}</td></tr>
      <tr class="total-row"><th>Total Registration Amount</th><td>₹${Number(reg.totalAmount || 0).toLocaleString('en-IN')}</td></tr>
    </table>

    <div class="section-head">FOOD REQUIREMENTS</div>
    <table>
      <tr><th>Non-Veg Count</th><td>${reg.nonVegCount || 0}</td></tr>
      <tr><th>Veg Count</th><td>${reg.vegCount || 0}</td></tr>
    </table>

    <div class="section-head">PAYMENT DETAILS</div>
    <table>
      <tr><th>UPI ID</th><td>${reg.upiId || config.upiId}</td></tr>
      <tr><th>UTR / Transaction ID</th><td style="font-family:monospace;font-weight:bold;">${escHtml(utrDisplay)}</td></tr>
      <tr><th>Payment Status</th><td><span class="badge-pending">Pending — Awaiting Verification</span></td></tr>
      <tr><th>Payment Screenshot</th><td>${reg.paymentScreenshot ? 'Attached to this email' : 'None'}</td></tr>
    </table>
  </div>
  <div class="footer">
    <p style="margin:0;">DEEPAM'26 — MULTI DISTRICT MEETING | Admin Notification</p>
  </div>
</div>
</body>
</html>`;
}

// ─── Email Sending ───────────────────────────────────────────────────────────

/**
 * Builds the CID attachment for the email header image.
 * Returns an attachment object if the image exists, otherwise null.
 */
function getHeaderImageAttachment() {
  try {
    if (fs.existsSync(EMAIL_HEADER_IMAGE_PATH)) {
      const buffer = fs.readFileSync(EMAIL_HEADER_IMAGE_PATH);
      return {
        filename: 'deepam26-email-header.jpg',
        content: buffer,
        cid: 'deepam26-email-header',
        contentType: 'image/jpeg',
        contentDisposition: 'inline'
      };
    }
  } catch (e) {
    console.warn('[Email] Header image read warning:', e.message);
  }
  return null;
}

/**
 * Sends the participant confirmation email to the entered participant email address.
 * @param {object} reg - saved registration record
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendParticipantEmail(reg) {
  const t = getTransporter();
  if (!t) {
    console.log(`PARTICIPANT EMAIL FAILED: SMTP not configured`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  const participantEmail = reg.email ? String(reg.email).trim().toLowerCase() : '';
  if (!participantEmail) {
    console.log(`PARTICIPANT EMAIL FAILED: Participant email address missing`);
    return { sent: false, reason: 'Missing participant email' };
  }

  try {
    const attachments = [];
    const headerImg = getHeaderImageAttachment();
    if (headerImg) attachments.push(headerImg);

    const info = await t.sendMail({
      from:    config.smtpFrom,
      to:      participantEmail,
      subject: `Thank You for Registering for DEEPAM'26 — MULTI DISTRICT MEETING`,
      text:    buildParticipantText(reg),
      html:    buildParticipantEmail(reg),
      attachments
    });

    console.log(`PARTICIPANT EMAIL SENT: ${participantEmail} (MessageId: ${info && info.messageId})`);
    return { sent: true, messageId: info && info.messageId };
  } catch (err) {
    console.error(`PARTICIPANT EMAIL FAILED for ${reg.registrationId} (${participantEmail}):`, err.message);
    transporter = null; // Reset cached transporter on failure so next attempt reconnects fresh
    return { sent: false, reason: err.message };
  }
}

/**
 * Sends the admin notification email with complete registration details and screenshot attachment.
 * @param {object} reg - saved registration record
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendAdminEmail(reg) {
  const t = getTransporter();
  const adminEmail = config.adminEmail || 'deepammdm26@gmail.com';

  if (!t) {
    console.log(`ADMIN EMAIL FAILED: SMTP not configured`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  try {
    const attachments = [];

    // Embed header image as CID
    const headerImg = getHeaderImageAttachment();
    if (headerImg) attachments.push(headerImg);

    // Attach payment screenshot if available
    if (reg.paymentScreenshot) {
      if (typeof reg.paymentScreenshot === 'string' && reg.paymentScreenshot.startsWith('data:')) {
        const matches = reg.paymentScreenshot.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const ext = mime === 'image/jpeg' ? '.jpg' : (mime === 'image/webp' ? '.webp' : '.png');
          attachments.push({
            filename: `PaymentProof_${reg.registrationId}${ext}`,
            content: buffer,
            contentType: mime
          });
        }
      } else if (typeof reg.paymentScreenshot === 'string') {
        const filename = path.basename(reg.paymentScreenshot);
        const filePath = path.isAbsolute(reg.paymentScreenshot)
          ? reg.paymentScreenshot
          : path.join(config.uploadDir, filename);
        if (fs.existsSync(filePath)) {
          attachments.push({
            filename: `PaymentProof_${reg.registrationId}${path.extname(filename)}`,
            path: filePath
          });
        }
      }
    }

    const info = await t.sendMail({
      from:    config.smtpFrom,
      to:      adminEmail,
      subject: `DEEPAM'26 Registration – ${reg.fullName} (${reg.registrationId})`,
      text:    buildAdminText(reg),
      html:    buildAdminEmail(reg),
      attachments
    });

    console.log(`ADMIN EMAIL SENT: ${adminEmail} (MessageId: ${info && info.messageId})`);
    return { sent: true, messageId: info && info.messageId };
  } catch (err) {
    console.error(`ADMIN EMAIL FAILED for ${reg.registrationId} (${adminEmail}):`, err.message);
    transporter = null; // Reset cached transporter on failure so next attempt reconnects fresh
    return { sent: false, reason: err.message };
  }
}

module.exports = {
  sendParticipantEmail,
  sendAdminEmail,
  verifyConnection,
  buildParticipantText,
  buildParticipantEmail,
  buildAdminText,
  buildAdminEmail
};
