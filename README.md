# DEEPAM ’26 — Registration Portal Deployment

This package contains the standalone **Deepam ’26 Public Registration Portal**.

## Quick Start on GoDaddy:
1. Upload and extract this package to your website folder (e.g. `public_html` or a subfolder).
2. Under cPanel **Setup Node.js App**, create an application with:
   - Node.js version: 20.x
   - Application startup file: `server.js`
3. Click **Run NPM Install**.
4. Configure environment variables (see `.env.example`) in cPanel without quotation marks.
5. Restart the application.
6. Public form is accessible at `https://yourdomain.com/`.
