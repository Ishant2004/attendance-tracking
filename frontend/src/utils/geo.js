export function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(Object.assign(new Error(err.message || 'Could not get location'), { code: err.code })),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }