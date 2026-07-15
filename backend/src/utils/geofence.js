const distanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  
  // WFO only if the point is inside one of the given (active) offices; else WFH.
  function resolveAgainstOffices(offices, latitude, longitude) {
    let best = null;
    for (const office of offices) {
      if (!office || office.isActive === false) continue;
      const dist = distanceMeters(latitude, longitude, office.latitude, office.longitude);
      if (dist <= office.radiusMeters && (!best || dist < best.dist)) best = { office, dist };
    }
    return best
      ? { detectedLocationType: 'WFO', officeLocation: best.office._id }
      : { detectedLocationType: 'WFH', officeLocation: null };
  }
  
  module.exports = { distanceMeters, resolveAgainstOffices };