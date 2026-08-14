/**
 * Helper utility functions for unit conversions and text formatting across the app.
 */

/**
 * Converts Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

/**
 * Formats temperature value with appropriate unit designation (°C or °F)
 */
export function formatTemperature(tempC: number, useFahrenheit: boolean, decimals = 1): string {
  if (useFahrenheit) {
    return `${celsiusToFahrenheit(tempC).toFixed(decimals)}°F`;
  }
  return `${tempC.toFixed(decimals)}°C`;
}

/**
 * Formats latitude and longitude coordinates into a human-readable N/S E/W string.
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latStr = lat >= 0 ? `${lat.toFixed(2)}°N` : `${Math.abs(lat).toFixed(2)}°S`;
  const lngStr = lng >= 0 ? `${lng.toFixed(2)}°E` : `${Math.abs(lng).toFixed(2)}°W`;
  return `${latStr}, ${lngStr}`;
}
