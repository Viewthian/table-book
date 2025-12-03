// middleware/auth.js
function basicAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('Authentication required');
  }

  // Decode base64 user:pass
  const base64 = authHeader.split(' ')[1];
  const [user, pass] = Buffer.from(base64, 'base64').toString().split(':');

  // Check against .env
  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
    return next(); // ✅ Allow access
  }

  res.setHeader('WWW-Authenticate', 'Basic');
  return res.status(401).send('Invalid credentials');
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.status(403).send("Access denied.");
  }
  next();
}

module.exports = basicAuth, requireAdmin;
