const crypto = require('crypto');

function requireIotDevice(req, res, next) {
  const expected = process.env.IOT_DEVICE_TOKEN;
  if (!expected) {
    return res.status(503).json({ message: 'The local device key is not configured on the laptop.' });
  }

  const provided = req.get('x-device-token') || '';
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  const matches = expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (matches) return next();
  return res.status(401).json({ message: 'This device is not allowed to use the local plant gateway.' });
}

module.exports = { requireIotDevice };
