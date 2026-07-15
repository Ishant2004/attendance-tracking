const OfficeLocation = require('../models/OfficeLocation');
const ApiError = require('../utils/ApiError');

async function listLocations({ includeInactive = false } = {}) {
  const query = includeInactive ? {} : { isActive: true };
  return OfficeLocation.find(query).sort({ name: 1 });
}

async function getLocationById(id) {
  const loc = await OfficeLocation.findById(id);
  if (!loc) throw new ApiError(404, 'Office location not found');
  return loc;
}

async function createLocation(data) {
  const existing = await OfficeLocation.findOne({ name: data.name });
  if (existing) throw new ApiError(400, 'Office location already exists');
  return OfficeLocation.create({
    name: data.name,
    latitude: data.latitude,
    longitude: data.longitude,
    radiusMeters: data.radiusMeters,
  });
}

async function updateLocation(id, data) {
  const loc = await OfficeLocation.findById(id);
  if (!loc) throw new ApiError(404, 'Office location not found');

  ['name', 'latitude', 'longitude', 'radiusMeters', 'isActive'].forEach((f) => {
    if (data[f] !== undefined) loc[f] = data[f];
  });
  await loc.save();
  return loc;
}

async function deactivateLocation(id) {
  const loc = await OfficeLocation.findById(id);
  if (!loc) throw new ApiError(404, 'Office location not found');
  loc.isActive = false;
  await loc.save();
  return loc;
}

module.exports = {
  listLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deactivateLocation,
};