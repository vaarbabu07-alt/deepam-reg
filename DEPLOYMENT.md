# DEEPAM'26 — Multi District Meeting Registration System
## Complete Production Deployment & Publishing Guide

Event: **DEEPAM'26 – MULTI DISTRICT MEETING**  
Host District: **Rotary International District 3231**  
Date: **27th & 28th November 2026**  
Venue: **Andal Singaravelu Kalyana Mandapam, Vengikkal, Tiruvannamalai**  

---

## 1. Required Software & Prerequisites

Before deploying, ensure the target server or host has the following installed:

- **Node.js**: Version 18.x or 20.x LTS (Recommended: Node.js 20 LTS)
- **npm**: Version 9.x or 10.x (comes bundled with Node.js)
- **Process Manager (Production)**: PM2 (`npm install -g pm2`) or systemd service
- **Reverse Proxy (Optional but Recommended)**: Nginx or Caddy with SSL (Let's Encrypt Certbot)
- **Operating System**: Linux (Ubuntu 20.04/22.04/24.04 LTS, Debian, CentOS), Windows Server, or macOS

---

## 2. How to Copy / Download the Project

1. Upload or copy the deployment package `DEEPAM26-registration-production.zip` to the server:
   ```bash
   scp DEEPAM26-registration-production.zip user@your-server-ip:/var/www/
   ```
2. SSH into your server:
   ```bash
   ssh user@your-server-ip
   cd /var/www
   ```
3. Extract the ZIP package:
   ```bash
   unzip DEEPAM26-registration-production.zip -d deepam26-registration
   cd deepam26-registration
   ```

---

## 3. How to Install Dependencies

Install the required production dependencies using npm:

```bash
npm install --omit=dev
```

*(Or run `npm install` to install dependencies including the test suite).*

Runtime dependencies installed:
- `express` (Web framework)
- `dotenv` (Environment variable loader)
- `multer` (Multipart screenshot upload handler)
- `nodemailer` (SMTP email dispatcher)
- `cors` (Cross-origin resource sharing)
- `cookie-parser` (Admin session cookies)
- `compression` (Gzip response compression)

---

## 4. How to Configure .env

Create your live production `.env` file by copying the provided template:

```bash
cp .env.example .env
```

Open `.env` in your preferred editor (e.g. `nano .env`):

```ini
PORT=3000

# Event Information
EVENT_NAME="DEEPAM'26 — MULTI DISTRICT MEETING"
DISTRICT_NAME="Rotary International District 3231"
EVENT_DATE="27th & 28th November 2026"
EVENT_VENUE="Andal Singaravelu Kalyana Mandapam, Vengikkal, Tiruvannamalai"

# Registration Fees (INR)
ROTARIAN_FEE=1200
ANNS_FEE=1000
ANNETTES_FEE=1000

# Participant Limits
MAX_ROTARIANS=50
MAX_ANNS=50
MAX_ANNETTES=50

# UPI Payment Details
UPI_ID="73600301@ubin"
PAYEE_NAME="ROTARY CLUB"

# Admin Credentials (SET STRONG VALUES FOR PRODUCTION!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourStrongPasswordHere2026!
SESSION_SECRET=YourSuperSecretSessionKeyLongRandomString2026

# Admin Notification Email
ADMIN_EMAIL=babusaaidigital@gmail.com

# SMTP Email Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deepammultidistrictmeetingreg@gmail.com
SMTP_PASS=your-16-char-google-app-password
SMTP_FROM="DEEPAM'26 <deepammultidistrictmeetingreg@gmail.com>"

# Google Sheets Webhook Integration (Optional)
GOOGLE_SHEETS_WEBHOOK_URL=

# Upload Limits
UPLOAD_MAX_SIZE_MB=5
```

---

## 5. How to Configure Gmail SMTP

1. Use Gmail's official outbound SMTP server:
   - **Host**: `smtp.gmail.com`
   - **Port**: `587`
   - **Encryption**: STARTTLS (handled automatically when port is 587)
2. In `.env`, configure:
   ```ini
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=deepammultidistrictmeetingreg@gmail.com
   SMTP_FROM="DEEPAM'26 <deepammultidistrictmeetingreg@gmail.com>"
   ```

---

## 6. How to Add the Gmail App Password

Google accounts require a **16-character App Password** when using SMTP:

1. Log in to the Google account: **`deepammultidistrictmeetingreg@gmail.com`**
2. Visit [Google Account Security](https://myaccount.google.com/security).
3. Ensure **2-Step Verification** is turned **ON**.
4. Go to **[App Passwords](https://myaccount.google.com/apppasswords)**.
5. In the *App name* field, type `DEEPAM26 Registration` and click **Create**.
6. Google displays a 16-character code (e.g., `xxxx xxxx xxxx xxxx`).
7. Copy and paste that code directly into `.env` as `SMTP_PASS`:
   ```ini
   SMTP_PASS="xxxx xxxx xxxx xxxx"
   ```

---

## 7. How to Configure the Admin Email

Set the `ADMIN_EMAIL` variable in `.env`:

```ini
ADMIN_EMAIL=babusaaidigital@gmail.com
```

Every valid submitted registration will immediately trigger an admin notification email sent to `babusaaidigital@gmail.com` containing:
- Participant full details
- Category breakdown (Rotarians, Ann's, Annette's)
- Total amount calculated
- Food preference counts (Veg & Non-Veg)
- UPI UTR reference number
- **The uploaded payment proof screenshot attached directly as a file**

---

## 8. Database Initialization & Storage

- **Zero-Configuration Architecture**: The system uses a fast JSON flat-file database with in-memory write-through caching (`services/storage.js`).
- **Initialization**: You do **not** need to run database migrations, install MySQL, or configure PostgreSQL. On first server launch, the application automatically ensures the `data/` and `public/uploads/` directories exist and creates `data/registrations.json` if absent.

---

## 9. How to Run Locally

To test or develop locally:

```bash
npm start
```

Or:

```bash
node server.js
```

The server will output:
```text
=======================================================
 DEEPAM'26 — MULTI DISTRICT MEETING Registration
 Rotary International District 3231
 Public Registration Form: http://localhost:3000
 Administrator Dashboard:  http://localhost:3000/admin.html
 Rotarian Fee: ₹1200  |  Ann's Fee: ₹1000  |  Annette's Fee: ₹1000
=======================================================
```

---

## 10. How to Test the Application

The package includes an end-to-end automated test suite covering 18 validation, pricing, duplicate detection, admin, and dynamic QR test groups:

```bash
npm test
```

Expected output:
```text
======================================================
 Test Results: 58 Passed, 0 Failed
======================================================
```

---

## 11. Build for Production

This application is built with standard native ES/Node.js architecture and pure clientside assets (no complex Webpack/Vite bundler build step required). All scripts, CSS, and HTML are pre-optimized and served directly with Gzip compression and security headers. No build command is required before starting.

---

## 12. How to Start the Production Server

### Option A: Using PM2 (Recommended for 24/7 Uptime & Auto-Restart)

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```
2. Start the application:
   ```bash
   pm2 start server.js --name "deepam26-registration"
   ```
3. Enable auto-start on server reboot:
   ```bash
   pm2 startup
   pm2 save
   ```
4. Monitor logs:
   ```bash
   pm2 logs deepam26-registration
   ```

### Option B: Using Systemd Service (Standard Linux)

Create `/etc/systemd/system/deepam26.service`:
```ini
[Unit]
Description=DEEPAM26 Registration App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/deepam26-registration
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable deepam26
sudo systemctl start deepam26
```

---

## 13. Application Port & Customization

The application defaults to port **3000**.  
To use a custom port (e.g., 8080 or 4000), update `PORT` in `.env`:
```ini
PORT=8080
```

---

## 14. How to Deploy to a Production Server with Nginx & SSL

To point your domain (e.g. `register.deepam26.org`) to the Node.js application:

1. Install Nginx and Certbot:
   ```bash
   sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
   ```
2. Create Nginx site configuration `/etc/nginx/sites-available/deepam26`:
   ```nginx
   server {
       listen 80;
       server_name register.deepam26.org;

       # Max upload size matches UPLOAD_MAX_SIZE_MB
       client_max_body_size 10M;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
3. Enable the site and restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/deepam26 /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```
4. Obtain free SSL certificate:
   ```bash
   sudo certbot --nginx -d register.deepam26.org
   ```

---

## 15. Summary of Required Environment Variables

| Variable | Description | Example Value |
|---|---|---|
| `PORT` | Port on which Express server listens | `3000` |
| `EVENT_NAME` | Official name of conference | `DEEPAM'26 — MULTI DISTRICT MEETING` |
| `DISTRICT_NAME` | Host District | `Rotary International District 3231` |
| `EVENT_DATE` | Event dates | `27th & 28th November 2026` |
| `EVENT_VENUE` | Venue location | `Andal Singaravelu Kalyana Mandapam, Vengikkal, Tiruvannamalai` |
| `ROTARIAN_FEE` | Fee per Rotarian (INR) | `1200` |
| `ANNS_FEE` | Fee per Ann / Spouse (INR) | `1000` |
| `ANNETTES_FEE` | Fee per Annette / Child (INR) | `1000` |
| `MAX_ROTARIANS` | Maximum Rotarians per form | `50` |
| `MAX_ANNS` | Maximum Ann's per form | `50` |
| `MAX_ANNETTES` | Maximum Annette's per form | `50` |
| `UPI_ID` | Payee UPI VPA handle | `73600301@ubin` |
| `PAYEE_NAME` | Payee business/club name | `ROTARY CLUB` |
| `ADMIN_USERNAME` | Admin portal username | `admin` |
| `ADMIN_PASSWORD` | Admin portal password | `[Set Secure Password]` |
| `SESSION_SECRET` | Encryption key for admin cookie session | `[Random 32+ char string]` |
| `ADMIN_EMAIL` | Notification recipient for submissions | `babusaaidigital@gmail.com` |
| `SMTP_HOST` | SMTP mail server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP mail port | `587` |
| `SMTP_USER` | SMTP sender address | `deepammultidistrictmeetingreg@gmail.com` |
| `SMTP_PASS` | Gmail 16-character App Password | `[16-char code]` |
| `SMTP_FROM` | Sender display name & address | `DEEPAM'26 <deepammultidistrictmeetingreg@gmail.com>` |
| `UPLOAD_MAX_SIZE_MB` | Max screenshot upload file size in MB | `5` |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Optional Apps Script URL | `https://script.google.com/macros/s/.../exec` |

---

## 16. How to Verify Email Sending

Run a quick one-line check to verify SMTP connectivity:

```bash
node -e "
require('dotenv').config();
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
t.verify((err, success) => {
  if (err) console.error('SMTP Failed:', err.message);
  else console.log('SMTP Connection Success:', success);
});
"
```

If successful, output will print: `SMTP Connection Success: true`.

---

## 17. How to Verify Payment & QR Synchronization

1. Open the public registration form: `http://localhost:3000`.
2. Look at Step 2 (Registration Details):
   - Set **Rotarians = 1, Ann's = 0, Annette's = 0** $\rightarrow$ Summary & QR display **₹1,500**.
   - Set **Rotarians = 1, Ann's = 2, Annette's = 3** $\rightarrow$ Summary & QR display **₹6,500**.
   - Set **Rotarians = 5, Ann's = 2, Annette's = 1** $\rightarrow$ Summary & QR display **₹10,500**.
3. Scan the QR code with any UPI app scanner (Google Pay, PhonePe, Paytm, BHIM) $\rightarrow$ The app opens with Payee `73600301@ubin` and pre-fills the exact registration amount.
4. On a mobile device, tap **"Pay ₹X via UPI"** or tap the QR container $\rightarrow$ The mobile OS prompts to launch your preferred UPI app with amount prefilled.

---

## 18. How to Verify Screenshot Upload

1. On the registration form, in Step 5 (Upload Payment Screenshot), choose a JPG or PNG file (less than 5MB).
2. The image preview immediately displays on the form.
3. Upon form submission, the image is saved to `public/uploads/` with a cryptographically randomized name.
4. The admin notification email sent to `babusaaidigital@gmail.com` will have the screenshot attached.
5. In the Admin Dashboard (`/admin.html`), click on the registration to view the uploaded proof directly.

---

## 19. How to Verify Admin Login

1. Navigate to: `http://localhost:3000/admin.html`
2. Enter the credentials configured in your `.env` (`ADMIN_USERNAME` and `ADMIN_PASSWORD`).
3. Click **Sign In**.
4. The Dashboard loads showing:
   - 5 KPI summary cards (Total Registrations, Attendees, Expected Revenue, Paid Amount, Pending Amount)
   - Attendee category breakdown (Rotarians, Ann's, Annette's)
   - Food preference counters (Veg / Non-Veg)
   - Action buttons to mark registrations as **PAID** or **REJECTED**
   - **Export CSV** button to download full data for spreadsheet tools

---

## 20. How to Back Up the Database

All application data is contained in two folders:
1. `data/registrations.json` — JSON database storing all registrations, attendee details, and statuses.
2. `public/uploads/` — Uploaded payment screenshots.

### Automated Backup Script (Cron)
Create a backup shell script `/var/www/backup-deepam26.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/deepam26"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/deepam26_data_$TIMESTAMP.tar.gz -C /var/www/deepam26-registration data public/uploads
# Retain last 30 days of backups
find $BACKUP_DIR -type f -name "*.tar.gz" -mtime +30 -delete
```

Make executable and add to crontab (`crontab -e`) to back up daily at 2:00 AM:
```bash
0 2 * * * /bin/bash /var/www/backup-deepam26.sh
```

To restore from a backup:
```bash
tar -xzf /var/backups/deepam26/deepam26_data_TIMESTAMP.tar.gz -C /var/www/deepam26-registration
```
