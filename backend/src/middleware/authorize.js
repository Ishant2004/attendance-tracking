const ApiError = require('../utils/ApiError');

// Usage: authorize('manager', 'admin')
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Not authenticated'));
  if (roles.length && !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'Forbidden: insufficient role'));
  }
  next();
};
module.exports = authorize;