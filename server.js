/**
 * Rotary Event Registration Server
 * High-performance Express application entry point.
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const config = require('./config');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const emailService = require('./services/email');

const app = express();

// High-speed Gzip / Deflate compression
app.use(compression({
  threshold: 512, // compress responses above 512 bytes
  level: 6
}));

// Middlewares
app.use(cors());
app.use((req, res, next) => {
  if (req.is('application/json')) {
    express.json({ limit: '1mb' })(req, res, next);
  } else {
    next();
  }
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// High-performance static asset serving with HTTP caching
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : '1h',
  etag: true,
  lastModified: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), {
  maxAge: '30d',
  immutable: true
}));

// API Routes — support both standard Express /api and Netlify Functions path
app.use(['/api/admin', '/.netlify/functions/api/admin'], adminRoutes);
app.use(['/api', '/.netlify/functions/api'], apiRoutes);

// Fast Health check endpoint
app.get(['/health', '/.netlify/functions/api/health'], (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Central error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Start server if not in test runner and not running in serverless environment
const isServerless = process.env.NETLIFY === 'true' || !!process.env.LAMBDA_TASK_ROOT || process.env.SERVERLESS === 'true';

if (process.env.NODE_ENV !== 'test' && !isServerless) {
  const server = app.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(` DEEPAM'26 — MULTI DISTRICT MEETING Registration`);
    console.log(` ${config.districtName}`);
    console.log(` Public Registration Form: http://localhost:${config.port}`);
    console.log(` Administrator Dashboard:  http://localhost:${config.port}/admin.html`);
    console.log(` Rotarian Fee: ₹${config.rotarianFee}  |  Ann's Fee: ₹${config.annsFee}  |  Annette's Fee: ₹${config.annettesFee}`);
    console.log(`=======================================================`);

    // Verify SMTP connection on startup
    emailService.verifyConnection().catch(err => {
      console.error('[Email] SMTP startup verification failed:', err.message);
    });
  });

  process.on('SIGTERM', () => {
    server.close(() => {
      console.log('Server terminated gracefully');
    });
  });
}

module.exports = app;
