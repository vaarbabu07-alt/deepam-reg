# DEEPAM'26 — Netlify Deployment Guide
## Rotary International District 3231 Multi-District Meeting Registration System

This guide explains how to deploy the complete **DEEPAM'26** event registration platform to **Netlify** with serverless backend functions, automated persistence via Netlify Blobs, dynamic UPI QR payments, and automated email confirmations.

---

## Architecture Overview on Netlify

```
                    ┌─────────────────────────┐
                    │    Netlify Edge CDN     │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌──────────────────┐                         ┌──────────────────────┐
│  Static Assets   │                         │  Netlify Function    │
│  (publish: public)│                         │  (netlify/functions/ │
│  - index.html    │                         │   api.js)            │
│  - admin.html    │                         │  - Express app       │
│  - css/, js/     │                         │  - /api/* proxy      │
│  - images/       │                         └──────────┬───────────┘
└──────────────────┘                                    │
                                             ┌──────────┴───────────┐
                                             ▼                      ▼
                                    ┌─────────────────┐   ┌─────────────────┐
                                    │  Netlify Blobs  │   │  Gmail SMTP     │
                                    │  (Data store)   │   │  (Nodemailer)   │
                                    └─────────────────┘   └─────────────────┘
```

- **Frontend**: Static files served from `public/` folder with ultra-fast CDN caching.
- **Backend**: Express API running inside an AWS Lambda serverless function via `serverless-http` under `netlify/functions/api.js`.
- **API Routing**: `netlify.toml` proxies `/api/*` requests to `/.netlify/functions/api/:splat` transparently.
- **Database**: Zero-configuration persistence using **Netlify Blobs** (`deepam26-database` store), backed up by initial seed data.
- **Uploads**: Payment screenshots are processed in memory and stored securely as base64 data URIs inside the database record, eliminating ephemeral filesystem constraints.

---

## Method 1: Deploy via GitHub / GitLab / Bitbucket (Recommended)

### Step 1: Push Repository to GitHub
1. Initialize git and commit all project files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Netlify deployment"
   ```
2. Create a new private or public repository on GitHub.
3. Push your code:
   ```bash
   git remote add origin https://github.com/your-username/deepam26-registration.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Connect to Netlify
1. Log in to [Netlify](https://app.netlify.com/).
2. Click **"Add new site"** → **"Import an existing project"**.
3. Choose **GitHub** and authorize access.
4. Select your `deepam26-registration` repository.

### Step 3: Configure Build & Deploy Settings
Netlify will automatically detect settings from `netlify.toml`. Verify the values:
- **Base directory**: *(Leave blank)*
- **Build command**: `npm run build`
- **Publish directory**: `public`
- **Functions directory**: `netlify/functions`

---

## Method 2: Deploy via Netlify CLI (Direct Upload)

If you prefer deploying directly from your computer without GitHub:

1. Install the Netlify CLI globally:
   ```bash
   npm install -g netlify-cli
   ```
2. Log in to your Netlify account:
   ```bash
   netlify login
   ```
3. Initialize and link the site:
   ```bash
   netlify init
   ```
4. Deploy to production:
   ```bash
   netlify deploy --prod
   ```

---

## Environment Variables Configuration

In Netlify Dashboard, navigate to:
**Site configuration** → **Environment variables** → **Add a variable** (or **Import from .env**).

Add the following required variables:

| Variable Name | Recommended Value / Description | Sensitive |
|---|---|---|
| `NODE_VERSION` | `20` | No |
| `NODE_ENV` | `production` | No |
| `PORT` | `3000` | No |
| `ADMIN_USERNAME` | `admin` *(change for production)* | Yes |
| `ADMIN_PASSWORD` | `rotaryadmin2026` *(choose strong password)* | Yes |
| `SESSION_SECRET` | `rotary_deepam_secret_production_2026` | Yes |
| `SMTP_HOST` | `smtp.gmail.com` | No |
| `SMTP_PORT` | `587` | No |
| `SMTP_SECURE` | `false` | No |
| `SMTP_USER` | `deepammultidistrictmeetingreg@gmail.com` | Yes |
| `SMTP_PASS` | `pftx wron fgpy ehpb` | Yes |
| `EMAIL_FROM` | `DEEPAM'26 Multi District Meeting <deepammultidistrictmeetingreg@gmail.com>` | No |
| `ADMIN_NOTIFICATION_EMAIL` | `babusaaidigital@gmail.com` | Yes |
| `UPI_ID` | `73600301@ubin` | No |
| `UPI_PAYEE_NAME` | `ROTARY CLUB` | No |
| `FEE_ROTARIAN` | `1200` | No |
| `FEE_ANN` | `1000` | No |
| `FEE_ANNETTE` | `1000` | No |
| `EVENT_NAME` | `DEEPAM'26 - MULTI DISTRICT MEETING` | No |
| `ROTARY_DISTRICT` | `3231` | No |
| `GOOGLE_SHEET_ID` | Spreadsheet ID (e.g. `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`) | No |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service Account Email (e.g. `service-account@project.iam.gserviceaccount.com`) | Yes |
| `GOOGLE_SHEETS_WEBHOOK_URL` | *(Optional)* Google Apps Script Webhook URL | Yes |
| `WHATSAPP_ACCESS_TOKEN` | Meta System User / Page WhatsApp Business Cloud API Token | Yes |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Cloud API Phone Number ID (e.g. `1257813847426404`) | Yes |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | *(Optional)* WhatsApp Business Account ID | Yes |
| `WHATSAPP_TEMPLATE_NAME` | WhatsApp Template Name (`deepam26_registration_confirmation`) | No |
| `WHATSAPP_TEMPLATE_LANGUAGE` | WhatsApp Template Language (`en`) | No |

> [!IMPORTANT]
> After saving environment variables in Netlify, trigger a **Clear cache and deploy site** to apply them to serverless functions!

---

## Enabling Netlify Blobs for Database Persistence

Netlify Blobs is automatically available on all modern Netlify sites.
1. The code automatically connects to the store named `deepam26-database`.
2. Registrations are automatically written to Netlify Blobs on every new registration or admin status change.
3. On function cold-starts, the database loads the latest registrations from Netlify Blobs.
4. No database server (MySQL/Postgres) setup is required.

---

## Verification & Post-Deployment Checklist

After the deployment completes, verify the following 10 items:

1. [ ] **Homepage Loads**: Visit `https://<your-site-name>.netlify.app/` — verify title shows "DEEPAM'26 – MULTI DISTRICT MEETING".
2. [ ] **Pricing Calculation**: Change delegate counts (Rotarians, Ann's, Annette's) — ensure subtotal and grand total update instantly.
3. [ ] **Dynamic QR Code**: Ensure the QR code updates dynamically matching the total registration fee with UPI ID `73600301@ubin`.
4. [ ] **UPI Pay Button**: Click "Pay ₹X via UPI" on a mobile device — verify it launches your installed UPI app (GPay/PhonePe/Paytm).
5. [ ] **Form Submission**: Fill in required fields, upload a sample payment screenshot, and submit. Ensure registration ID (`DEEPAM26-XXXXX`) is generated.
6. [ ] **User Email**: Check registrant's inbox for the branded DEEPAM'26 registration confirmation receipt.
7. [ ] **Admin Email**: Check `babusaaidigital@gmail.com` for the admin alert containing delegate counts and the payment screenshot attachment.
8. [ ] **Admin Login**: Go to `https://<your-site-name>.netlify.app/admin.html` and log in with your configured admin credentials.
9. [ ] **Admin Operations**: View the registration details, inspect the uploaded payment screenshot, and change status from `PENDING` to `PAID`.
10. [ ] **CSV Export**: Click "Export CSV" in the admin dashboard to verify Excel/CSV export works.

---

## Troubleshooting

- **Function Timeout**: Netlify free tier functions default to a 10s timeout. Nodemailer email delivery typically completes in 1-2s. If an email fails, the API gracefully falls back and completes the registration response.
- **Build Failure**: Ensure `package.json` contains `"build": "echo No build step required && exit 0"`.
- **404 on API calls**: Ensure `netlify.toml` is committed in your repository root with the `[[redirects]]` configuration intact.
