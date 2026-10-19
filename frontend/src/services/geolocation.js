export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is unavailable. You can still search by city or area.')); return; }
    navigator.geolocation.getCurrentPosition(
      ({coords}) => resolve({latitude:coords.latitude, longitude:coords.longitude, accuracy:coords.accuracy}),
      error => reject(new Error(error.code === 1
        ? 'Location permission was denied. Allow location in your browser or search by city or area.'
        : 'Could not find your location. Please retry or search by city or area.')),
      {enableHighAccuracy:true, timeout:15000, maximumAge:60000}
    );
  });
}
