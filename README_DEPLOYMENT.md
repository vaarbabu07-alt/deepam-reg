# DEEPAM ’26 — Cloudflare Pages & Full-Stack Deployment Guide

## 1. Executive Summary & Architecture

The **DEEPAM ’26 Rotary Registration & Admin Portal** consists of:
1. **Frontend**: Static single-page application and admin portal located in **`public/`** (`index.html`, `admin.html`, `css/`, `js/`, `images/`).
2. **Backend**: Express.js server (`server.js`) providing:
   - Dynamic authoritative registration fee calculation (`services/pricing.js`)
   - Direct NPCI UPI Intent & dynamic QR code generation (`services/payment.js`)
   - Gmail SMTP confirmation emails with CID embedded graphics (`services/email.js`)
   - Google Sheets v4 API real-time sync with Google Service Account (`services/sheets.js`)
   - HMAC-SHA256 authenticated Admin dashboard session controls (`middleware/auth.js`)
   - Atomic disk-persisted registration data storage (`services/storage.js`)

> [!WARNING]
> **Why Cloudflare Pages failed with `node_modules/workerd/bin/workerd (134 MiB)`**:
> Cloudflare Pages or Wrangler was pointed to the repository root directory (`.`). Cloudflare has a strict 25 MiB asset limit and attempted to upload the internal `node_modules` binary.
>
> **The Real Static Directory is `public`**. Setting the output directory to `public` completely resolves the upload failure and excludes all server binaries.

---

## 2. Cloudflare Pages Deployment Steps (Frontend)

To deploy the frontend to Cloudflare Pages:

1. Log into your **Cloudflare Dashboard** and navigate to **Workers & Pages** ➔ **Create application** ➔ **Pages** ➔ **Connect to Git**.
2. Select repository: `vaarbabu07-alt/deepam-reg`.
3. Configure the build settings:
   - **Framework preset**: `None`
   - **Build command**: Leave completely **BLANK** (or `echo No build step required`)
   - **Build output directory**: **`public`**  *(CRITICAL: Do NOT use `.` or `dist`)*
   - **Root directory**: `/`
4. Click **Save and Deploy**.
5. The build will take seconds and deploy only `public/` (less than 1.5 MiB total, well within limits).

---

## 3. Backend Deployment (Render / GoDaddy / VPS)

Because Cloudflare Pages only hosts static files, the Node.js backend (`server.js`) handles database saving, emails, and sheets.

Deploy the backend to **Render** or **GoDaddy Node.js Application**:

### Render Deployment Settings:
- **Build Command**: `npm install`
- **Start Command**: `node server.js`
- **Node Version**: `20.x` or higher

### Environment Variables to Configure (Unquoted):
- `PORT`: `10000` (Render sets automatically) or `3001`
- `NODE_ENV`: `production`
- `UPI_ID`: `73600301@ubin`
- `PAYEE_NAME`: `ROTARY CLUB`
- `ROTARIAN_FEE`: `1200`
- `ANNS_FEE`: `1000`
- `ANNETTES_FEE`: `1000`
- `MAX_ROTARIANS`: `10`
- `MAX_ANNS`: `50`
- `MAX_ANNETTES`: `50`
- `ADMIN_USERNAME`: `admin`
- `ADMIN_PASSWORD`: *(your admin password)*
- `SESSION_SECRET`: *(32+ character random secret)*
- `ADMIN_EMAIL`: `deepammdm26@gmail.com`
- `SMTP_HOST`: `smtp.gmail.com`
- `SMTP_PORT`: `587`
- `SMTP_USER`: `saaidigitaltvm@gmail.com`
- `SMTP_PASS`: `vforwtvphqugukpv` *(16-char Google App Password, no spaces)*
- `SMTP_FROM`: `DEEPAM'26 <saaidigitaltvm@gmail.com>`
- `GOOGLE_SHEET_ID`: `1KCdSGNiCKxj1Nj5B_vVtBn70y-Xjr2m-rI-t35e7rh8`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: `deepam26-sheets@silent-star-508611-j6.iam.gserviceaccount.com`
- `GOOGLE_PRIVATE_KEY`: *(Full PEM RSA private key string)*

---

## 4. Connecting Cloudflare Pages Frontend to the Backend API

If the frontend and backend run on different domains (e.g. frontend on `deepam26.pages.dev` and backend on `deepam-reg.onrender.com`), configure `API_BASE` in `public/js/app.js` and `public/js/admin.js`:

```javascript
// At the top of public/js/app.js and public/js/admin.js:
const API_BASE = window.location.hostname.includes('pages.dev') 
  ? 'https://your-backend.onrender.com' 
  : '';
```
All API fetch requests (`/api/...`) will seamlessly route to your live backend.
