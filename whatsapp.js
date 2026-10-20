/**
 * WhatsApp Business Cloud API Integration Service — DEEPAM'26 Multi District Meeting
 *
 * Sends participant registration confirmation via WhatsApp Business Cloud API
 * using an approved Meta template message.
 *
 * Configuration (environment variables):
 *   WHATSAPP_ACCESS_TOKEN          — page / system-user access token
 *   WHATSAPP_PHONE_NUMBER_ID       — the sending phone number ID (NOT the WABA ID)
 *   WHATSAPP_BUSINESS_ACCOUNT_ID   — optional, used only for reference/logging
 *   WHATSAPP_TEMPLATE_NAME         — approved template name (default: deepam26_registration_confirmation)
 *   WHATSAPP_TEMPLATE_LANGUAGE     — template language code (default: en)
 *
 * Non-blocking and fault-tolerant: a WhatsApp failure never cancels a successful registration.
 */

'use strict';

const https  = require('https');
const config = require('../config');

/* ─── Startup diagnostic (printed once at module load / server boot) ───────── */

function printStartupDiagnostic() {
  const token    = config.whatsappAccessToken       || process.env.WHATSAPP_ACCESS_TOKEN       || '';
  const phoneId  = config.whatsappPhoneNumberId     || process.env.WHATSAPP_PHONE_NUMBER_ID     || '';
  const wabaId   = config.whatsappBusinessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
  const tmplName = config.whatsappTemplateName      || process.env.WHATSAPP_TEMPLATE_NAME      || '';

  console.log('[WhatsApp] Credential Diagnostic:');
  console.log('[WhatsApp]   WHATSAPP_ACCESS_TOKEN        :', token    ? 'SET'    : 'MISSING WARNING');
  console.log('[WhatsApp]   WHATSAPP_PHONE_NUMBER_ID     :', phoneId  ? 'SET'    : 'MISSING WARNING');
  console.log('[WhatsApp]   WHATSAPP_BUSINESS_ACCOUNT_ID :', wabaId   ? 'SET'    : 'NOT SET (optional)');
  console.log('[WhatsApp]   WHATSAPP_TEMPLATE_NAME       :', tmplName ? tmplName : '(using default: deepam26_registration_confirmation)');
}

printStartupDiagnostic();

/* ─── Service ───────────────────────────────────────────────────────────────── */

class WhatsAppService {

  /** Resolves live credential set. @private */
  _credentials() {
    return {
      token:    config.whatsappAccessToken      || process.env.WHATSAPP_ACCESS_TOKEN      || '',
      phoneId:  config.whatsappPhoneNumberId    || process.env.WHATSAPP_PHONE_NUMBER_ID    || '',
      tmplName: config.whatsappTemplateName     || process.env.WHATSAPP_TEMPLATE_NAME     || 'deepam26_registration_confirmation',
      tmplLang: config.whatsappTemplateLanguage || process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en',
    };
  }

  /**
   * Returns names of required-but-missing credentials.
   * @returns {string[]}
   */
  getMissingCredentials() {
    const { token, phoneId } = this._credentials();
    const missing = [];
    if (!token   || token.trim()   === '') missing.push('WHATSAPP_ACCESS_TOKEN');
    if (!phoneId || phoneId.trim() === '') missing.push('WHATSAPP_PHONE_NUMBER_ID');
    return missing;
  }

  /**
   * Normalises an Indian mobile number to plain digits: 91XXXXXXXXXX
   *  - Strips +, spaces, hyphens, parentheses etc.
   *  - 0XXXXXXXXXX (11 digits, leading 0)  → strip 0 → XXXXXXXXXX
   *  - XXXXXXXXXX  (10 digits bare)         → prepend 91
   *  - 91XXXXXXXXXX (12 digits)             → keep as-is (no double-91)
   * Returns plain digit string; Meta Cloud API wants "91XXXXXXXXXX" (no leading +).
   *
   * @param {string|number} phone
   * @returns {string}  e.g. "919876543210"
   */
  normalizePhoneNumber(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/\D/g, '');

    // Leading 0 with 11 digits → drop the 0
    if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    // Bare 10-digit Indian number → prepend country code
    if (digits.length === 10) {
      digits = '91' + digits;
    }

    // Already has country code or is some other format → use as-is
    return digits;
  }

  /**
   * Builds the WhatsApp Cloud API template payload.
   * Template body placeholders (7):
   *   {{1}} Participant full name
   *   {{2}} Registration ID
   *   {{3}} Rotarians count
   *   {{4}} Ann's count
   *   {{5}} Annette's count
   *   {{6}} Total amount (Indian locale)
   *   {{7}} UTR / transaction ID or "Not Provided"
   *
   * @param {object} reg
   * @param {string} to           – normalised digit-only recipient number
   * @param {string} templateName
   * @param {string} templateLang
   * @returns {object}
   */
  buildTemplatePayload(reg, to, templateName, templateLang) {
    const rotariansCount = Number(reg.rotariansCount) || 0;
    const annsCount      = Number(reg.annsCount)      || 0;
    const annettesCount  = Number(reg.annettesCount)  || 0;
    const totalAmountStr = Number(reg.totalAmount || 0).toLocaleString('en-IN');
    const utrDisplay     = (reg.utr && String(reg.utr).trim() !== '')
      ? reg.utr.trim()
      : 'Not Provided';

    return {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'template',
      template: {
        name:     templateName,
        language: { code: templateLang },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: String(reg.fullName       || '') },
              { type: 'text', text: String(reg.registrationId || '') },
              { type: 'text', text: String(rotariansCount) },
              { type: 'text', text: String(annsCount) },
              { type: 'text', text: String(annettesCount) },
              { type: 'text', text: totalAmountStr },
              { type: 'text', text: utrDisplay }
            ]
          }
        ]
      }
    };
  }

  /** Returns a safe masked version of a digit phone string for logging. @private */
  _maskPhone(digits) {
    if (!digits || digits.length < 6) return '***';
    return digits.slice(0, 2) + '****' + digits.slice(-4);
  }

  /**
   * Sends a WhatsApp template confirmation to the registered participant.
   * Always resolves (never rejects); a failure cannot roll back a registration.
   *
   * @param {object} record  – saved registration record
   * @returns {Promise<{ sent: boolean, status: 'SENT'|'NOT_SENT'|'FAILED', error?: string }>}
   */
  async sendConfirmation(record) {
    /* 1. Guard: required credentials */
    const missing = this.getMissingCredentials();
    if (missing.length > 0) {
      console.warn('[WhatsApp] NOT_SENT for', record.registrationId,
        '— missing credentials:', missing.join(', '));
      return { sent: false, status: 'NOT_SENT', error: 'Missing: ' + missing.join(', ') };
    }

    const { token, phoneId, tmplName, tmplLang } = this._credentials();

    /* 2. Normalise and validate recipient phone */
    const recipientDigits = this.normalizePhoneNumber(record.mobileNumber);

    if (!recipientDigits || recipientDigits.length < 10 || recipientDigits.length > 15) {
      console.warn('[WhatsApp] FAILED for', record.registrationId,
        '— invalid phone after normalisation: "' + record.mobileNumber + '" →', recipientDigits);
      return { sent: false, status: 'FAILED', error: 'Invalid recipient phone number' };
    }

    const maskedPhone = this._maskPhone(recipientDigits);

    /* 3. Build payload */
    const payloadObj = this.buildTemplatePayload(record, recipientDigits, tmplName, tmplLang);
    const postData   = JSON.stringify(payloadObj);

    console.log('[WhatsApp] Attempting send for', record.registrationId,
      '| to:', maskedPhone,
      '| template:', tmplName, '(' + tmplLang + ')',
      '| phoneId:', phoneId);

    /* 4. HTTPS POST to Meta Cloud API */
    return new Promise((resolve) => {
      const options = {
        hostname: 'graph.facebook.com',
        path:     '/v20.0/' + phoneId + '/messages',
        method:   'POST',
        headers: {
          'Authorization':  'Bearer ' + token,
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end',  () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('[WhatsApp] SENT for', record.registrationId,
              'to', maskedPhone, '| HTTP', res.statusCode);
            resolve({ sent: true, status: 'SENT' });
          } else {
            /* Parse Meta error for full diagnosis — never logs the token */
            let errorMsg     = 'HTTP ' + res.statusCode;
            let errorCode    = null;
            let errorSubcode = null;
            let fbTraceId    = null;
            try {
              const parsed = JSON.parse(responseBody);
              if (parsed.error) {
                errorMsg     = parsed.error.message       || errorMsg;
                errorCode    = parsed.error.code          || null;
                errorSubcode = parsed.error.error_subcode || null;
                fbTraceId    = parsed.error.fbtrace_id    || null;
              }
            } catch (_) { /* non-JSON body; keep HTTP status message */ }

            console.warn(
              '[WhatsApp] FAILED for', record.registrationId,
              '(' + maskedPhone + ')',
              '| HTTP', res.statusCode,
              '| code:', errorCode,
              '| subcode:', errorSubcode,
              '| msg:', errorMsg,
              '| fbtrace_id:', fbTraceId
            );
            resolve({ sent: false, status: 'FAILED', error: errorMsg });
          }
        });
      });

      req.on('error', (err) => {
        console.warn('[WhatsApp] Network error for', record.registrationId + ':', err.message);
        resolve({ sent: false, status: 'FAILED', error: err.message });
      });

      req.setTimeout(15000, () => {
        req.destroy();
        console.warn('[WhatsApp] Request timed out for', record.registrationId);
        resolve({ sent: false, status: 'FAILED', error: 'Connection timeout' });
      });

      req.write(postData);
      req.end();
    });
  }
}

module.exports = new WhatsAppService();
