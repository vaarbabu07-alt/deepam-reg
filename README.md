# DEEPAM'26 — MULTI DISTRICT MEETING Registration System
### Rotary International District 3231

A complete, production-ready, mobile-first registration and payment system for **DEEPAM'26 — MULTI DISTRICT MEETING**. Built to provide an intuitive, friction-free registration experience like Google Forms, coupled with **dynamic real-time fee calculation**, **dynamic amount-encoded UPI QR code and deep links**, **server-authoritative price validation**, **UTR reference checking**, **mandatory proof uploads**, **automated participant & admin emails with screenshot attachments**, **secure admin dashboard**, and **CSV data exports**.

---

## 🌟 Key Features

1. **Event Details & Branding**:
   - **Event**: `DEEPAM'26 — MULTI DISTRICT MEETING`
   - **Host District**: `Rotary International District 3231`
   - **Dates**: `27th & 28th November 2026`
   - **Venue**: `Andal Singaravelu Kalyana Mandapam, Vengikkal, Tiruvannamalai`
   - **Unique ID Format**: `DEEPAM26-00001`, `DEEPAM26-00002`, ...

2. **Tri-Category Dynamic Pricing**:
   - **Rotarian**: ₹1,500 per person (minimum 1)
   - **Ann (Spouse)**: ₹1,000 per person (minimum 0)
   - **Annette (Child)**: ₹1,000 per person (minimum 0)
   - **Formula**: `TOTAL = (Rotarians × 1,500) + (Ann's × 1,000) + (Annette's × 1,000)`
   - Immediate automatic calculation on the frontend, reflected in summary line items and total display.

3. **Food Preference Tracking**:
   - Dedicated inputs for Vegetarian and Non-Vegetarian attendee counts.
   - Preserved across confirmation pass, database, CSV export, and admin portal.

4. **Dynamic UPI QR Code & Mobile Deep Link**:
   - UPI ID: `73600301@ubin` (Payee: `ROTARY CLUB`).
   - Clean, scan-ready QR code dynamically generated from:
     `upi://pay?pa=73600301@ubin&pn=ROTARY%20CLUB&am=<TOTAL>&cu=INR&tn=DEEPAM%2726%20Registration`
   - Dynamically updates as counts change (e.g. ₹1,500, ₹6,500, ₹10,500).
   - Tap-to-pay on mobile: opens Google Pay, PhonePe, Paytm, BHIM, etc., with pre-filled amount.
   - 1-click **Copy UPI ID** button with confirmation feedback.

5. **Server-Side Financial Security**:
   - The backend independently recalculates registration amounts and never trusts client-submitted totals.
   - Rejects tampered values and enforces valid integers.

6. **Payment Proof & Duplicate Protection**:
   - Mandatory UPI Reference / UTR input.
   - Duplicate submissions with the same UTR are rejected with HTTP 409 Conflict.
   - Mandatory screenshot proof upload with MIME verification (JPEG, PNG, WebP) and 5MB size limit.

7. **Automated Email Dispatch**:
   - **Participant**: Confirmation email with branded header, registration ID, breakdown, and venue details.
   - **Admin**: Immediate notification sent to `babusaaidigital@gmail.com` with full participant info, category counts, food counts, UTR, and the **payment screenshot attached as a file**.

8. **Admin Management Dashboard (`/admin.html`)**:
   - Protected by session authentication.
   - Real-time KPI statistics: Total Registrations, Attendees, Expected Revenue, Paid Amount, Pending Amount.
   - Filter by status (`PENDING`, `PAID`, `REJECTED`).
   - Search by Name, Mobile, UTR, or Registration ID.
   - 1-click status update (`Mark as Paid`, `Mark as Rejected`).
   - **Export CSV** button for offline reporting.

---

## 🛠 Technology Stack

- **Runtime**: Node.js (v18+ or v20+ LTS)
- **Backend Framework**: Express.js
- **File Uploads**: Multer
- **Email Dispatch**: Nodemailer (SMTP / Gmail App Password)
- **Data Persistence**: In-memory write-through cache with atomic JSON flat-file storage (`data/registrations.json`)
- **Frontend**: Vanilla HTML5, CSS3 (Mobile-first responsive), JavaScript (ES6+)
- **QR Engine**: Standalone client-side `qrcode.min.js` (Canvas-based)
- **Compression & Security**: Gzip compression, strict CORS, cookie-parser

---

## 📁 Project Structure

```text
DEEPAM26-registration/
├── .env.example                 # Environment template (NO secrets)
├── .gitignore                   # Git exclusion rules
├── package.json                 # Node.js metadata & dependencies
├── package-lock.json            # Deterministic dependency lockfile
├── server.js                    # Express application entry point
├── README.md                    # Project overview & quick start
├── DEPLOYMENT.md                # Comprehensive 20-point production deployment guide
├── config/
│   └── index.js                 # Central configuration loader
├── services/
│   ├── pricing.js               # Pricing calculation engine
│   ├── payment.js               # UPI URI generator
│   ├── storage.js               # In-memory cached database & atomic file writer
│   ├── email.js                 # Participant & Admin email sender with attachment
│   └── sheets.js                # Optional Google Sheets webhook dispatcher
├── middleware/
│   ├── validation.js            # Server-side input & count validation
│   ├── auth.js                  # Admin session authentication
│   └── upload.js                # Screenshot file upload handler
├── routes/
│   ├── api.js                   # Public endpoints (/config, /calculate, /register)
│   └── admin.js                 # Admin endpoints (/login, /registrations, /update-status, /export-csv)
├── public/
│   ├── index.html               # Public registration form & confirmation receipt
│   ├── admin.html               # Administrator dashboard
│   ├── css/
│   │   ├── styles.css           # Public registration styles
│   │   └── admin.css            # Admin dashboard styles
│   ├── js/
│   │   ├── app.js               # Registration form frontend logic
│   │   ├── admin.js             # Admin dashboard frontend logic
│   │   └── qrcode.min.js        # Standalone QR code generator
│   ├── images/
│   │   └── upi-qr.jpg           # Official account QR asset
│   └── uploads/                 # Upload directory for screenshot proofs
├── data/                        # Runtime database folder
│   └── registrations.json       # Persisted registrations database
├── google-apps-script/
│   ├── Code.gs                  # Google Apps Script for Google Sheets mirror
│   └── README.md                # Google Sheets setup instructions
└── test/
    └── test-cases.js            # Automated test suite (58 assertions across 18 test groups)
```

---

## 🚀 Quick Start (Local Development)

1. **Clone or copy the project**:
   ```bash
   cd rotary-registration
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to set your desired port, admin credentials, and Gmail SMTP settings.

4. **Run the server**:
   ```bash
   npm start
   ```

5. **Access the application**:
   - **Public Registration**: `http://localhost:3000`
   - **Admin Portal**: `http://localhost:3000/admin.html`

---

## 🧪 Testing

Run the automated test suite:

```bash
npm test
```

Verifies:
- 1 Rotarian = ₹1,500 (QR & Pay button = ₹1,500)
- 1 Rotarian + 2 Ann + 3 Annette = ₹6,500 (QR & Pay button = ₹6,500)
- 5 Rotarians + 2 Ann + 1 Annette = ₹10,500 (QR & Pay button = ₹10,500)
- Input validations (name regex, mobile length, attendee minimums)
- Duplicate UTR prevention (HTTP 409)
- Admin login, status updates, KPI calculations, and CSV export
- Static asset checks (clean QR container, removal of bank poster artwork)

---

## 🔒 Security Best Practices

- **Never commit `.env`**: Always use `.env.example` as a template in version control.
- **Gmail App Password**: Never use your primary Google account password for SMTP; generate a 16-character App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
- **Admin Password**: Change `ADMIN_PASSWORD` and `SESSION_SECRET` before deploying to production.

---

## 📖 Production Deployment

For complete, step-by-step instructions on deploying with PM2, Nginx reverse proxy, SSL certificates, and database backups, refer to **[DEPLOYMENT.md](DEPLOYMENT.md)**.
