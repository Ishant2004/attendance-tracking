const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/officeLocationService');

const list = asyncHandler(async (req, res) => {
  // Only admins may see deactivated geofences.
  const includeInactive = req.user.role === 'admin' && req.query.includeInactive === 'true';
  const locations = await service.listLocations({ includeInactive });
  res.json({ success: true, data: { locations } });
});

const get = asyncHandler(async (req, res) => {
  const location = await service.getLocationById(req.params.id);
  res.json({ success: true, data: { location } });
});

const create = asyncHandler(async (req, res) => {
  const location = await service.createLocation(req.body);
  res.status(201).json({ success: true, data: { location } });
});

const update = asyncHandler(async (req, res) => {
  const location = await service.updateLocation(req.params.id, req.body);
  res.json({ success: true, data: { location } });
});

const remove = asyncHandler(async (req, res) => {
  const location = await service.deactivateLocation(req.params.id);
  res.json({ success: true, data: { location }, message: 'Office location deactivated' });
});

module.exports = { list, get, create, update, remove };