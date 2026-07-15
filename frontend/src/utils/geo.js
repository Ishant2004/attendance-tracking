// Resolves to { latitude, longitude } from the browser's GPS.
export function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(new Error(err.message || 'Could not get location')),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }