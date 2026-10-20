/**
 * DEEPAM'26 — MULTI DISTRICT MEETING
 * Registration Form — Frontend Logic
 *
 * Key behaviours:
 * - Three category steppers: Rotarians (₹1,200), Ann's (₹1,000), Annette's (₹1,000)
 * - Instant summary & UPI link update on every change
 * - Debounced QR code re-render (canvas reuse for speed)
 * - Mandatory payment screenshot with instant blob preview
 * - Full client-side validation matching server rules
 * - Config loaded from /api/config so fees stay in sync with .env
 */

document.addEventListener('DOMContentLoaded', () => {

  // ─── App State (Single Source of Truth) ──────────────────────────────────
  const state = {
    // Category Counts
    rotarians:    1,
    anns:         0,
    annettes:     0,
    nonVegCount:  0,
    vegCount:     0,

    // Pricing & Configuration
    rotarianFee:  1200,
    annsFee:      1000,
    annettesFee:  1000,
    maxRotarians: 10,
    maxAnns:      50,
    maxAnnettes:  50,
    upiId:        '73600301@ubin',
    payeeName:    'ROTARY CLUB',
    eventName:    "DEEPAM'26 — MULTI DISTRICT MEETING",
    currency:     'INR',
    currentUpiUri:   '',
    qrCodeInstance:  null,
    qrDebounceTimer: null,
    isSubmitting:    false,
    activeBlobUrl:   null
  };

  // ─── DOM Cache ───────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const el = {
    form:            $('registration-form'),
    formSection:     $('registration-form-section'),
    successScreen:   $('success-screen'),
    globalAlert:     $('global-alert'),

    // Inputs
    fullName:        $('fullName'),
    mobileNumber:    $('mobileNumber'),
    email:           $('email'),
    rotaryClub:      $('rotaryClub'),
    rotaryDistrict:  $('rotaryDistrict'),
    nonVegCount:     $('nonVegCount'),
    vegCount:        $('vegCount'),
    rotariansCount:  $('rotariansCount'),
    annsCount:       $('annsCount'),
    annettesCount:   $('annettesCount'),
    utr:             $('utr'),
    screenshot:      $('screenshot'),

    // Steppers
    btnRotDec:       $('btn-rot-decrement'),
    btnRotInc:       $('btn-rot-increment'),
    btnAnnDec:       $('btn-ann-decrement'),
    btnAnnInc:       $('btn-ann-increment'),
    btnAnnetteDec:   $('btn-annette-decrement'),
    btnAnnetteInc:   $('btn-annette-increment'),

    // Summary / payment display
    summaryRotarians:$('summary-rotarians-line'),
    summaryAnns:     $('summary-anns-line'),
    summaryAnnettes: $('summary-annettes-line'),
    summaryTotal:    $('summary-total'),
    paymentHero:     $('payment-hero-amount'),
    upiPayLink:      $('upi-pay-link'),
    upiButtonText:   $('upi-button-text'),
    payGpayLink:     $('pay-gpay-link'),
    payPhonepeLink:  $('pay-phonepe-link'),
    payPaytmLink:    $('pay-paytm-link'),
    helpUpiId:       $('help-upi-id'),
    paymentConfigError: $('payment-config-error'),
    qrPayLink:       $('qr-pay-link'),
    qrcodeContainer: $('qrcode-container'),
    upiIdDisplay:    $('upi-id-display'),
    btnCopyUpi:      $('btn-copy-upi'),

    // File upload
    dropZone:        $('drop-zone'),
    filePreviewImg:  $('file-preview-img'),
    fileUploadText:  $('file-upload-text'),

    // Submit
    btnSubmit:        $('btn-submit'),
    btnRegisterAnother: $('btn-register-another')
  };

  const NAME_REGEX   = /^[A-Za-z. '\-]+$/;
  const MOBILE_REGEX = /^[0-9]{10}$/;
  const EMAIL_REGEX  = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  // ─── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    setupEventListeners();

    // Synchronize initial input fields from central state
    if (el.rotariansCount) el.rotariansCount.value = state.rotarians;
    if (el.annsCount)      el.annsCount.value      = state.anns;
    if (el.annettesCount)  el.annettesCount.value  = state.annettes;

    // Render initial additional member fields (0 extra for 1 member)
    renderAdditionalMemberFields(state.rotarians);

    // Initialize QR canvas once
    initQRCode();

    // Render initial pricing immediately
    recalculate(false);

    // Fetch live config (async, non-blocking)
    fetch('/api/config')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        if (data.rotarianFee)  state.rotarianFee  = data.rotarianFee;
        if (data.annsFee)      state.annsFee      = data.annsFee;
        if (data.annettesFee)  state.annettesFee  = data.annettesFee;
        if (data.maxRotarians) state.maxRotarians  = data.maxRotarians;
        if (data.maxAnns)      state.maxAnns       = data.maxAnns;
        if (data.maxAnnettes)  state.maxAnnettes   = data.maxAnnettes;
        if (data.upiId)        state.upiId         = data.upiId;
        if (data.payeeName)    state.payeeName     = data.payeeName;
        if (data.eventName)    state.eventName     = data.eventName;

        if (el.upiIdDisplay) el.upiIdDisplay.textContent = state.upiId;
        if (el.helpUpiId) el.helpUpiId.textContent = state.upiId;

        // Diagnostic verification: check merchant UPI configuration
        const isValidUpi = state.upiId && typeof state.upiId === 'string' && state.upiId.includes('@');
        if (!isValidUpi) {
          if (el.paymentConfigError) el.paymentConfigError.style.display = 'block';
          if (el.upiPayLink) el.upiPayLink.style.display = 'none';
          const appOpts = $('upi-app-options');
          if (appOpts) appOpts.style.display = 'none';
        } else {
          if (el.paymentConfigError) el.paymentConfigError.style.display = 'none';
          if (el.upiPayLink) el.upiPayLink.style.display = 'inline-flex';
          const appOpts = $('upi-app-options');
          if (appOpts) appOpts.style.display = 'block';
        }

        // Update rate tags
        const rTag = $('rate-rotarian-tag');
        if (rTag) rTag.textContent = `Registration Fee: ₹${fmt(state.rotarianFee)} per member`;

        recalculate(false);
      })
      .catch(() => {});
  }

  // ─── Formatters ──────────────────────────────────────────────────────────
  function fmt(n) {
    return Number(n).toLocaleString('en-IN');
  }

  // ─── Stepper & Counter Handlers ──────────────────────────────────────────
  function updateRotarians(newVal) {
    let v = parseInt(newVal, 10);
    if (isNaN(v)) v = 1;
    v = Math.max(1, Math.min(state.maxRotarians, v));
    state.rotarians = v;
    if (el.rotariansCount) el.rotariansCount.value = v;
    renderAdditionalMemberFields(v);
    recalculate(true);
    if (el.rotariansCount) validateField(el.rotariansCount);
  }

  function updateAnns(newVal) {
    let v = parseInt(newVal, 10);
    if (isNaN(v)) v = 0;
    v = Math.max(0, Math.min(state.maxAnns, v));
    state.anns = v;
    if (el.annsCount) el.annsCount.value = v;
    recalculate(true);
    if (el.annsCount) validateField(el.annsCount);
  }

  function updateAnnettes(newVal) {
    let v = parseInt(newVal, 10);
    if (isNaN(v)) v = 0;
    v = Math.max(0, Math.min(state.maxAnnettes, v));
    state.annettes = v;
    if (el.annettesCount) el.annettesCount.value = v;
    recalculate(true);
    if (el.annettesCount) validateField(el.annettesCount);
  }

  // ─── Event Listeners ─────────────────────────────────────────────────────
  function setupEventListeners() {
    // Rotarians Counter Buttons & Input
    if (el.btnRotDec) {
      el.btnRotDec.addEventListener('click', () => updateRotarians(state.rotarians - 1));
    }
    if (el.btnRotInc) {
      el.btnRotInc.addEventListener('click', () => updateRotarians(state.rotarians + 1));
    }
    if (el.rotariansCount) {
      el.rotariansCount.addEventListener('input', () => {
        const val = el.rotariansCount.value.trim();
        if (/^\d+$/.test(val)) updateRotarians(val);
      });
      el.rotariansCount.addEventListener('blur', () => {
        if (!/^\d+$/.test(el.rotariansCount.value.trim()) || parseInt(el.rotariansCount.value, 10) < 1) {
          updateRotarians(1);
        }
      });
    }

    // Ann's Counter Buttons & Input
    if (el.btnAnnDec) {
      el.btnAnnDec.addEventListener('click', () => updateAnns(state.anns - 1));
    }
    if (el.btnAnnInc) {
      el.btnAnnInc.addEventListener('click', () => updateAnns(state.anns + 1));
    }
    if (el.annsCount) {
      el.annsCount.addEventListener('input', () => {
        const val = el.annsCount.value.trim();
        if (/^\d+$/.test(val)) updateAnns(val);
      });
      el.annsCount.addEventListener('blur', () => {
        if (!/^\d+$/.test(el.annsCount.value.trim()) || parseInt(el.annsCount.value, 10) < 0) {
          updateAnns(0);
        }
      });
    }

    // Annette's Counter Buttons & Input
    if (el.btnAnnetteDec) {
      el.btnAnnetteDec.addEventListener('click', () => updateAnnettes(state.annettes - 1));
    }
    if (el.btnAnnetteInc) {
      el.btnAnnetteInc.addEventListener('click', () => updateAnnettes(state.annettes + 1));
    }
    if (el.annettesCount) {
      el.annettesCount.addEventListener('input', () => {
        const val = el.annettesCount.value.trim();
        if (/^\d+$/.test(val)) updateAnnettes(val);
      });
      el.annettesCount.addEventListener('blur', () => {
        if (!/^\d+$/.test(el.annettesCount.value.trim()) || parseInt(el.annettesCount.value, 10) < 0) {
          updateAnnettes(0);
        }
      });
    }

    // Validate on blur / input for text fields
    [el.fullName, el.mobileNumber, el.email, el.rotaryClub, el.rotaryDistrict, el.utr].forEach(f => {
      if (f) {
        f.addEventListener('input', () => validateField(f));
        f.addEventListener('blur',  () => validateField(f));
      }
    });

    // Mobile: strip non-digits
    if (el.mobileNumber) {
      el.mobileNumber.addEventListener('input', () => {
        el.mobileNumber.value = el.mobileNumber.value.replace(/[^0-9]/g, '');
      });
    }

    // Food counts — validate only (no fee impact)
    [el.nonVegCount, el.vegCount].forEach(f => {
      if (f) {
        f.addEventListener('input', () => validateField(f));
        f.addEventListener('blur',  () => validateField(f));
      }
    });

    // Copy UPI
    if (el.btnCopyUpi) {
      el.btnCopyUpi.addEventListener('click', () => {
        const text = state.upiId;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(showCopySuccess).catch(() => fallbackCopy(text));
        } else {
          fallbackCopy(text);
        }
      });
    }

    // Mobile UPI deep link navigation
    if (el.upiPayLink) {
      el.upiPayLink.addEventListener('click', () => {
        if (state.currentUpiUri) {
          el.upiPayLink.href = state.currentUpiUri;
        }
      });
    }
    if (el.payGpayLink) {
      el.payGpayLink.addEventListener('click', (e) => {
        if (state.currentGpayUri) {
          el.payGpayLink.href = state.currentGpayUri;
        }
      });
    }
    if (el.payPhonepeLink) {
      el.payPhonepeLink.addEventListener('click', (e) => {
        if (state.currentPhonepeUri) {
          el.payPhonepeLink.href = state.currentPhonepeUri;
        }
      });
    }
    if (el.payPaytmLink) {
      el.payPaytmLink.addEventListener('click', (e) => {
        if (state.currentPaytmUri) {
          el.payPaytmLink.href = state.currentPaytmUri;
        }
      });
    }
    if (el.qrPayLink) {
      el.qrPayLink.addEventListener('click', () => {
        if (state.currentUpiUri) {
          el.qrPayLink.href = state.currentUpiUri;
        }
      });
    }

    // Screenshot
    if (el.screenshot) el.screenshot.addEventListener('change', handleFileSelect);

    // Drag-and-drop
    if (el.dropZone) {
      el.dropZone.addEventListener('dragover', e => { e.preventDefault(); el.dropZone.classList.add('drag-over'); });
      el.dropZone.addEventListener('dragleave', () => el.dropZone.classList.remove('drag-over'));
      el.dropZone.addEventListener('drop', e => {
        e.preventDefault();
        el.dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0] && el.screenshot) {
          el.screenshot.files = e.dataTransfer.files;
          handleFileSelect({ target: el.screenshot });
        }
      });
    }

    // Submit
    if (el.form) el.form.addEventListener('submit', handleSubmit);

    // Reset
    if (el.btnRegisterAnother) {
      el.btnRegisterAnother.addEventListener('click', resetForm);
    }
  }

  // ─── Additional Member Fields ─────────────────────────────────────────────
  /**
   * Renders (count - 1) sets of "Member N Name / Contact Number" fields.
   * Member 1 is always the primary participant (existing fullName / mobileNumber).
   */
  function renderAdditionalMemberFields(count) {
    const container = document.getElementById('additional-members');
    if (!container) return;

    const extras = Math.max(0, count - 1); // additional members beyond the primary

    // Remove extra sets if count decreased
    const existing = container.querySelectorAll('.additional-member-set');
    if (existing.length > extras) {
      // Remove surplus sets from the end
      for (let i = existing.length - 1; i >= extras; i--) {
        existing[i].remove();
      }
      return;
    }

    // Add new sets if count increased
    const startIdx = existing.length + 1; // member number label offset (+1 because Member 1 = primary)
    for (let i = existing.length; i < extras; i++) {
      const memberNum = i + 2; // Member 2, 3, ... (Member 1 is the primary participant)
      const set = document.createElement('div');
      set.className = 'additional-member-set';
      set.setAttribute('data-member', memberNum);
      set.style.cssText = 'margin-bottom:16px;padding:14px 16px;background:#f8fafc;border-radius:8px;border-left:3px solid #002244;';

      set.innerHTML = `
        <p style="font-size:13px;font-weight:700;color:#002244;margin:0 0 10px;">Member ${memberNum}</p>
        <div class="form-row two-col">
          <div class="form-group" id="group-member${memberNum}Name">
            <label class="form-label" for="member${memberNum}Name">
              Member Name <span class="req">*</span>
            </label>
            <input
              type="text"
              id="member${memberNum}Name"
              name="member${memberNum}Name"
              class="form-control additional-member-name"
              placeholder="e.g. R Kavitha"
              required
              autocomplete="off"
            >
            <p class="error-feedback" id="error-member${memberNum}Name">Please enter the member name (letters only).</p>
          </div>
          <div class="form-group" id="group-member${memberNum}Phone">
            <label class="form-label" for="member${memberNum}Phone">
              Contact Number <span class="req">*</span>
            </label>
            <input
              type="text"
              id="member${memberNum}Phone"
              name="member${memberNum}Phone"
              class="form-control additional-member-phone"
              placeholder="10-digit number"
              maxlength="10"
              required
              inputmode="numeric"
              autocomplete="off"
            >
            <p class="error-feedback" id="error-member${memberNum}Phone">Please enter a valid 10-digit mobile number.</p>
          </div>
        </div>`;

      // Attach live validation to new inputs
      const nameInput  = set.querySelector('.additional-member-name');
      const phoneInput = set.querySelector('.additional-member-phone');

      nameInput.addEventListener('input', () => validateAdditionalField(nameInput));
      nameInput.addEventListener('blur',  () => validateAdditionalField(nameInput));

      phoneInput.addEventListener('input', () => {
        phoneInput.value = phoneInput.value.replace(/[^0-9]/g, '');
        validateAdditionalField(phoneInput);
      });
      phoneInput.addEventListener('blur', () => validateAdditionalField(phoneInput));

      container.appendChild(set);
    }
  }

  /** Validates a single additional-member name or phone input. */
  function validateAdditionalField(input) {
    const id  = input.id;
    const val = input.value.trim();
    const errEl = document.getElementById('error-' + id);

    if (input.classList.contains('additional-member-name')) {
      if (!val) {
        input.classList.add('is-invalid'); input.classList.remove('is-valid');
        if (errEl) { errEl.textContent = 'Please enter the member name.'; errEl.style.display = 'block'; }
        return false;
      }
      if (!NAME_REGEX.test(val) || val.length < 2) {
        input.classList.add('is-invalid'); input.classList.remove('is-valid');
        if (errEl) { errEl.textContent = 'Name must contain letters, dots, or hyphens.'; errEl.style.display = 'block'; }
        return false;
      }
    } else if (input.classList.contains('additional-member-phone')) {
      if (!MOBILE_REGEX.test(val)) {
        input.classList.add('is-invalid'); input.classList.remove('is-valid');
        if (errEl) { errEl.textContent = 'Please enter a valid 10-digit mobile number.'; errEl.style.display = 'block'; }
        return false;
      }
    }

    input.classList.remove('is-invalid'); input.classList.add('is-valid');
    if (errEl) errEl.style.display = 'none';
    return true;
  }

  // ─── Core Calculation & UI Update (Single Source of Truth) ───────────────
  function recalculate(debounceQR = true) {
    const rot    = state.rotarians;
    const anns   = state.anns;
    const annett = state.annettes;

    // Authoritative math
    const rotTotal    = rot * state.rotarianFee;
    const annsTotal   = anns * state.annsFee;
    const annettTotal = annett * state.annettesFee;
    const grandTotal  = rotTotal + annsTotal + annettTotal;

    // 1. Update Registration Summary
    if (el.summaryRotarians) el.summaryRotarians.textContent = `${rot} × ₹${fmt(state.rotarianFee)} = ₹${fmt(rotTotal)}`;
    if (el.summaryAnns)      el.summaryAnns.textContent      = `${anns} × ₹${fmt(state.annsFee)} = ₹${fmt(annsTotal)}`;
    if (el.summaryAnnettes)  el.summaryAnnettes.textContent  = `${annett} × ₹${fmt(state.annettesFee)} = ₹${fmt(annettTotal)}`;
    if (el.summaryTotal)     el.summaryTotal.textContent     = `₹${fmt(grandTotal)}`;

    // Update dynamic max attribute on food inputs (combined limit based on total registration count)
    const totalReg = rot + anns + annett;
    const vegCurrent = parseInt(state.vegCount || 0, 10);
    const nonVegCurrent = parseInt(state.nonVegCount || 0, 10);
    if (el.nonVegCount) {
      el.nonVegCount.max = Math.max(0, totalReg - vegCurrent);
    }
    if (el.vegCount) {
      el.vegCount.max = Math.max(0, totalReg - nonVegCurrent);
    }

    // Re-check food count fields if they have values (combined limit)
    const nvVal = el.nonVegCount ? parseInt(el.nonVegCount.value || '0', 10) : 0;
    const vVal  = el.vegCount    ? parseInt(el.vegCount.value    || '0', 10) : 0;
    const nvNum = isNaN(nvVal) ? 0 : nvVal;
    const vNum  = isNaN(vVal)  ? 0 : vVal;
    if (nvNum + vNum > totalReg) {
      const msg = 'Food count cannot exceed the total registration count.';
      if (el.nonVegCount && el.nonVegCount.value !== '') showError('nonVegCount', msg);
      if (el.vegCount    && el.vegCount.value    !== '') showError('vegCount',    msg);
    } else {
      if (el.nonVegCount && el.nonVegCount.classList.contains('is-invalid')) clearError('nonVegCount');
      if (el.vegCount    && el.vegCount.classList.contains('is-invalid'))    clearError('vegCount');
    }

    // 2. Update UPI Amount & Button
    if (el.paymentHero)   el.paymentHero.textContent   = `₹${fmt(grandTotal)}`;
    if (el.upiButtonText) el.upiButtonText.textContent = `Pay ₹${fmt(grandTotal)} via UPI`;

    // 3. Dynamic Spec-Compliant UPI Payment URLs
    // Clean and strictly format parameters per NPCI guidelines:
    // - pa: valid VPA
    // - pn: alphanumeric + space only, percent-encoded
    // - am: exact two decimal places (e.g. 1200.00)
    // - cu: INR
    // - tn: strictly alphanumeric + space only (NO apostrophes, NO em-dashes), max 30 chars
    const cleanPa = (state.upiId || '73600301@ubin').trim();
    const cleanPn = (state.payeeName || 'ROTARY CLUB').trim().replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanAm = Number(grandTotal).toFixed(2);
    const cleanCu = (state.currency || 'INR').trim().toUpperCase();
    const cleanTn = 'DEEPAM26 Registration';

    // Standard NPCI generic URI for QR codes and system UPI intent
    const upiUri = `upi://pay?pa=${cleanPa}&pn=${encodeURIComponent(cleanPn)}&am=${cleanAm}&cu=${cleanCu}&tn=${encodeURIComponent(cleanTn)}`;
    state.currentUpiUri = upiUri;

    // Platform-specific app intents for direct 1-tap launching
    const isAndroid = /Android/i.test(navigator.userAgent);

    // Google Pay: Android explicit package intent, iOS tez/gpay scheme
    const gpayUri = isAndroid
      ? `intent://pay?pa=${cleanPa}&pn=${encodeURIComponent(cleanPn)}&am=${cleanAm}&cu=${cleanCu}&tn=${encodeURIComponent(cleanTn)}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`
      : `tez://upi/pay?pa=${cleanPa}&pn=${encodeURIComponent(cleanPn)}&am=${cleanAm}&cu=${cleanCu}&tn=${encodeURIComponent(cleanTn)}`;
    state.currentGpayUri = gpayUri;

    // PhonePe: Android explicit package intent, iOS phonepe scheme
    const phonepeUri = isAndroid
      ? `intent://pay?pa=${cleanPa}&pn=${encodeURIComponent(cleanPn)}&am=${cleanAm}&cu=${cleanCu}&tn=${encodeURIComponent(cleanTn)}#Intent;scheme=upi;package=com.phonepe.app;end`
      : `phonepe://pay?pa=${cleanPa}&pn=${encodeURIComponent(cleanPn)}&am=${cleanAm}&cu=${cleanCu}&tn=${encodeURIComponent(cleanTn)}`;
    state.currentPhonepeUri = phonepeUri;

    // Paytm: Android explicit package intent, iOS paytmmp scheme
    const paytmUri = isAndroid
      ? `intent://pay?pa=${cleanPa}&pn=${encodeURIComponent(cleanPn)}&am=${cleanAm}&cu=${cleanCu}&tn=${encodeURIComponent(cleanTn)}#Intent;scheme=upi;package=net.one97.paytm;end`
      : `paytmmp://pay?pa=${cleanPa}&pn=${encodeURIComponent(cleanPn)}&am=${cleanAm}&cu=${cleanCu}&tn=${encodeURIComponent(cleanTn)}`;
    state.currentPaytmUri = paytmUri;

    if (el.upiPayLink) {
      el.upiPayLink.style.opacity = '1';
      el.upiPayLink.style.pointerEvents = 'auto';
      el.upiPayLink.href = upiUri;
    }

    if (el.payGpayLink)    el.payGpayLink.href    = gpayUri;
    if (el.payPhonepeLink) el.payPhonepeLink.href = phonepeUri;
    if (el.payPaytmLink)   el.payPaytmLink.href   = paytmUri;

    if (el.qrPayLink) {
      el.qrPayLink.href = upiUri;
    }

    // 4. Update Dynamic QR Code with exact amount
    if (debounceQR) {
      clearTimeout(state.qrDebounceTimer);
      state.qrDebounceTimer = setTimeout(() => renderQR(upiUri), 50);
    } else {
      renderQR(upiUri);
    }
  }

  function initQRCode() {
    const container = el.qrcodeContainer || document.getElementById('qrcode-container');
    if (window.QRCode && container) {
      container.innerHTML = '';
      state.qrCodeInstance = new window.QRCode(container, {
        width: 200,
        height: 200,
        colorDark: '#002244',
        colorLight: '#FFFFFF',
        correctLevel: window.QRCode.CorrectLevel.M
      });
    }
  }

  function renderQR(upiUri) {
    if (!state.qrCodeInstance) {
      initQRCode();
    }
    if (state.qrCodeInstance) {
      requestAnimationFrame(() => {
        try {
          state.qrCodeInstance.makeCode(upiUri);
        } catch (e) {
          console.error('QR error:', e);
        }
      });
    }
  }

  // ─── File Select & Preview ───────────────────────────────────────────────
  function handleFileSelect(e) {
    const file = e.target.files ? e.target.files[0] : null;
    const errEl = $('error-screenshot');

    if (state.activeBlobUrl) {
      URL.revokeObjectURL(state.activeBlobUrl);
      state.activeBlobUrl = null;
    }

    if (!file) {
      el.filePreviewImg.style.display  = 'none';
      el.fileUploadText.style.display  = 'block';
      return;
    }

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      if (errEl) { errEl.textContent = 'Only JPG, PNG, and WebP images are accepted.'; errEl.style.display = 'block'; }
      el.screenshot.value = '';
      el.filePreviewImg.style.display = 'none';
      el.fileUploadText.style.display = 'block';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      if (errEl) { errEl.textContent = 'Screenshot size exceeds the 5 MB limit.'; errEl.style.display = 'block'; }
      el.screenshot.value = '';
      el.filePreviewImg.style.display = 'none';
      el.fileUploadText.style.display = 'block';
      return;
    }

    if (errEl) errEl.style.display = 'none';

    state.activeBlobUrl          = URL.createObjectURL(file);
    el.filePreviewImg.src        = state.activeBlobUrl;
    el.filePreviewImg.style.display = 'inline-block';
    el.fileUploadText.style.display = 'none';
  }

  // ─── Validation ──────────────────────────────────────────────────────────
  function showError(fieldId, msg) {
    const f   = $(fieldId);
    const err = $('error-' + fieldId);
    if (f)   { f.classList.add('is-invalid'); f.classList.remove('is-valid'); }
    if (err) { err.textContent = msg; err.style.display = 'block'; }
  }

  function clearError(fieldId) {
    const f   = $(fieldId);
    const err = $('error-' + fieldId);
    if (f)   { f.classList.remove('is-invalid'); f.classList.add('is-valid'); }
    if (err) { err.style.display = 'none'; }
  }

  function validateField(field) {
    const id  = field.id;
    const val = field.value.trim();

    if (id === 'fullName') {
      if (!val)                      { showError(id, 'Please enter your Full Name.'); return false; }
      if (!NAME_REGEX.test(val) || val.length < 2) { showError(id, 'Please enter your name using letters, dots, or hyphens.'); return false; }
    } else if (id === 'mobileNumber') {
      if (!MOBILE_REGEX.test(val))   { showError(id, 'Please enter a valid 10-digit mobile number.'); return false; }
    } else if (id === 'email') {
      if (!val || !EMAIL_REGEX.test(val)) { showError(id, 'Please enter a valid email address.'); return false; }
    } else if (id === 'rotaryClub') {
      if (!val)                      { showError(id, 'Please enter your Rotary Club name.'); return false; }
    } else if (id === 'rotaryDistrict') {
      if (!val)                      { showError(id, 'Please enter your Rotary District number.'); return false; }
    } else if (id === 'rotariansCount') {
      const n = parseInt(val, 10);
      if (!/^\d+$/.test(val) || isNaN(n) || n < 1 || n > state.maxRotarians) {
        showError(id, `Please enter a valid number (1–${state.maxRotarians}).`); return false;
      }
    } else if (id === 'annsCount') {
      const n = parseInt(val, 10);
      if (!/^\d+$/.test(val) || isNaN(n) || n < 0 || n > state.maxAnns) {
        showError(id, `Please enter a valid number (0–${state.maxAnns}).`); return false;
      }
    } else if (id === 'annettesCount') {
      const n = parseInt(val, 10);
      if (!/^\d+$/.test(val) || isNaN(n) || n < 0 || n > state.maxAnnettes) {
        showError(id, `Please enter a valid number (0–${state.maxAnnettes}).`); return false;
      }
    } else if (id === 'nonVegCount' || id === 'vegCount') {
      const fieldLabel = id === 'nonVegCount' ? 'Preferred Food — Non-Veg (Count)' : 'Preferred Food — Veg (Count)';
      // Optional: treat empty as zero
      const valTrim = val.trim();
      const n = valTrim === '' ? 0 : parseInt(valTrim, 10);
      if (valTrim !== '' && (!/^\d+$/.test(valTrim) || isNaN(n) || n < 0)) {
        showError(id, `${fieldLabel} must be a valid whole number (0 or more).`);
        return false;
      }
      const totalReg = (state.rotarians || 0) + (state.anns || 0) + (state.annettes || 0);
      // Compute other food count
      const otherId = id === 'nonVegCount' ? 'vegCount' : 'nonVegCount';
      const otherVal = (el[otherId] && el[otherId].value.trim()) || '';
      const otherN = otherVal === '' ? 0 : parseInt(otherVal, 10);
      if (n + otherN > totalReg) {
        showError(id, 'Combined food count cannot exceed the total registration count.');
        return false;
      }
    } else if (id === 'utr') {
      if (val && (val.length < 6 || !/^[A-Za-z0-9]+$/.test(val))) {
        showError(id, 'Please enter a valid UTR (alphanumeric, min 6 characters).'); return false;
      }
    }

    clearError(id);
    return true;
  }

  function validateAll() {
    const textFields = [
      el.fullName, el.mobileNumber, el.email,
      el.rotaryClub, el.rotaryDistrict,
      el.nonVegCount, el.vegCount,
      el.rotariansCount, el.annsCount, el.annettesCount,
      el.utr
    ].filter(Boolean);
    let ok = true;
    let firstBad = null;
    for (const f of textFields) {
      if (!validateField(f)) { ok = false; if (!firstBad) firstBad = f; }
    }

    // Validate additional member fields (Member 2 onwards)
    const additionalInputs = document.querySelectorAll(
      '#additional-members .additional-member-name, #additional-members .additional-member-phone'
    );
    for (const input of additionalInputs) {
      if (!validateAdditionalField(input)) {
        ok = false;
        if (!firstBad) firstBad = input;
      }
    }

    // Screenshot is required
    const errScr = $('error-screenshot');
    if (!el.screenshot.files || !el.screenshot.files[0]) {
      if (errScr) { errScr.textContent = 'Please upload your payment screenshot before submitting the registration.'; errScr.style.display = 'block'; }
      ok = false;
      if (!firstBad) firstBad = el.screenshot;
    } else {
      if (errScr) errScr.style.display = 'none';
    }

    if (firstBad) firstBad.focus();
    return ok;
  }

  // ─── Form Submission ──────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (state.isSubmitting) return;

    hideAlert();
    if (!validateAll()) {
      showAlert('Please fix the highlighted errors before submitting.', 'danger');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData(el.form);
      if (!formData.has('annsCount'))     formData.append('annsCount', '0');
      if (!formData.has('annettesCount')) formData.append('annettesCount', '0');

      // Collect additional member details (Member 2 onwards) as JSON
      const memberSets = document.querySelectorAll('#additional-members .additional-member-set');
      const additionalMembers = [];
      memberSets.forEach(set => {
        const nameInput  = set.querySelector('.additional-member-name');
        const phoneInput = set.querySelector('.additional-member-phone');
        additionalMembers.push({
          name:  nameInput  ? nameInput.value.trim()  : '',
          phone: phoneInput ? phoneInput.value.trim() : ''
        });
      });
      formData.append('additionalMembers', JSON.stringify(additionalMembers));

      const res    = await fetch('/api/register', { method: 'POST', body: formData });
      const result = await res.json();

      if (res.ok && result.success) {
        showSuccess(result.registration);
      } else {
        showAlert(result.message || 'Registration failed. Please check your inputs.', 'danger');
        if (result.errors) {
          Object.keys(result.errors).forEach(fid => {
            const f = $(fid), err = $('error-' + fid);
            if (f)   f.classList.add('is-invalid');
            if (err) { err.textContent = result.errors[fid]; err.style.display = 'block'; }
          });
        }
      }
    } catch (err) {
      showAlert('Something went wrong. Please check your connection and try again.', 'danger');
    } finally {
      setLoading(false);
    }
  }

  function setLoading(on) {
    state.isSubmitting = on;
    if (el.btnSubmit) {
      el.btnSubmit.disabled = on;
      el.btnSubmit.classList.toggle('loading', on);
      const txt = el.btnSubmit.querySelector('.btn-text');
      if (txt) {
        txt.textContent = on ? 'Submitting Registration...' : 'Submit Registration';
      }
    }
  }

  // ─── Success Screen ───────────────────────────────────────────────────────
  function showSuccess(reg) {
    el.formSection.style.display  = 'none';
    el.successScreen.style.display = 'block';

    if ($('success-participant-name')) $('success-participant-name').textContent = reg.fullName || '';
    if ($('success-reg-id'))           $('success-reg-id').textContent           = reg.registrationId || '';
    if ($('receipt-name'))             $('receipt-name').textContent             = reg.fullName || '-';
    if ($('receipt-mobile'))           $('receipt-mobile').textContent           = reg.mobileNumber || '-';
    if ($('receipt-email'))            $('receipt-email').textContent            = reg.email || '-';
    if ($('receipt-club'))             $('receipt-club').textContent             = reg.rotaryClub || '-';
    if ($('receipt-district'))         $('receipt-district').textContent         = reg.rotaryDistrict || '-';
    if ($('receipt-rotarians'))        $('receipt-rotarians').textContent        = reg.rotariansCount ?? '-';
    if ($('receipt-anns'))             $('receipt-anns').textContent             = reg.annsCount ?? '0';
    if ($('receipt-annettes'))         $('receipt-annettes').textContent         = reg.annettesCount ?? '0';
    if ($('receipt-total'))            $('receipt-total').textContent            = `₹${fmt(reg.totalAmount)}`;
    if ($('receipt-utr'))              $('receipt-utr').textContent              = reg.utr || '-';
    if ($('receipt-payment-status')) {
      $('receipt-payment-status').textContent = reg.paymentStatus || 'SUCCESS';
    }
    if ($('receipt-email-status')) {
      $('receipt-email-status').textContent   = reg.email ? `Sent to ${reg.email}` : 'Sent';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    el.form.reset();
    state.rotarians = 1;
    state.anns      = 0;
    state.annettes  = 0;
    if (el.rotariansCount) el.rotariansCount.value = '1';
    if (el.annsCount)      el.annsCount.value      = '0';
    if (el.annettesCount)  el.annettesCount.value  = '0';
    if (el.nonVegCount)    el.nonVegCount.value    = '0';
    if (el.vegCount)       el.vegCount.value       = '0';
    if (el.filePreviewImg) el.filePreviewImg.style.display = 'none';
    if (el.fileUploadText) el.fileUploadText.style.display = 'block';

    // Reset additional member fields back to 0 extras (1 member = primary only)
    renderAdditionalMemberFields(1);

    if (state.activeBlobUrl) {
      URL.revokeObjectURL(state.activeBlobUrl);
      state.activeBlobUrl = null;
    }

    el.form.querySelectorAll('.form-control, .stepper-input')
      .forEach(i => i.classList.remove('is-valid', 'is-invalid'));

    el.successScreen.style.display  = 'none';
    el.formSection.style.display    = 'block';
    recalculate(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── Alert ───────────────────────────────────────────────────────────────
  function showAlert(msg, type = 'danger') {
    el.globalAlert.textContent = msg;
    el.globalAlert.className   = `alert-banner alert-${type}`;
    el.globalAlert.style.display = 'block';
    el.globalAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function hideAlert() {
    el.globalAlert.style.display = 'none';
  }

  // ─── Copy UPI ────────────────────────────────────────────────────────────
  function showCopySuccess() {
    const orig = el.btnCopyUpi.textContent;
    el.btnCopyUpi.textContent = 'Copied!';
    el.btnCopyUpi.style.background = '#059669';
    el.btnCopyUpi.style.color = '#fff';
    setTimeout(() => {
      el.btnCopyUpi.textContent = orig;
      el.btnCopyUpi.style.background = '';
      el.btnCopyUpi.style.color = '';
    }, 1800);
  }

  function fallbackCopy(text) {
    const tmp = document.createElement('input');
    tmp.value = text;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
    showCopySuccess();
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  init();
});
