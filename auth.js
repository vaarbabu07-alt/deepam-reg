/**
 * Administrator Authentication Middleware
 * Secure session verification using cryptographic HMAC cookies / authorization tokens.
 */

const crypto = require('crypto');
const config = require('../config');

// Cookie name for admin session
const COOKIE_NAME = 'rotary_admin_token';

/**
 * Creates a signed token for admin session.
 */
function createSessionToken(username) {
  const payload = {
    username,
    role: 'ADMIN',
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(dataStr)
    .digest('base64url');
  return `${dataStr}.${signature}`;
}

/**
 * Verifies a signed token.
 */
function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [dataStr, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(dataStr)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return null; // Tampered token
  }

  try {
    const payload = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Express middleware to protect admin routes.
 */
function requireAdmin(req, res, next) {
  // Check cookie or Authorization header
  let token = req.cookies ? req.cookies[COOKIE_NAME] : null;

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access. Administrator login required.'
    });
  }

  req.admin = session;
  next();
}

module.exports = {
  COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  requireAdmin
};
