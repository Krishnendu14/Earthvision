import { GlobeMetrics, PresetLocation } from "../types";

export const PRESET_LOCATIONS: PresetLocation[] = [
  {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    lat: 35.6762,
    lng: 139.6503,
    type: "metropolis",
    tempC: 22.4,
    pressureHpa: 1014,
    windSpeedKmh: 16.5,
    seaLevelElevationM: 12,
    description: "Coastal megacity exposed to typhoons and moderate atmospheric pressure fronts.",
  },
  {
    id: "maldives",
    name: "Malé (Maldives)",
    country: "Maldives",
    lat: 4.1755,
    lng: 73.5093,
    type: "coastal",
    tempC: 29.8,
    pressureHpa: 1009,
    windSpeedKmh: 24.0,
    seaLevelElevationM: 1.5,
    description: "Low-lying coral atoll vulnerable to sea-level rise (+1.5m threat threshold).",
  },
  {
    id: "newyork",
    name: "New York City",
    country: "United States",
    lat: 40.7128,
    lng: -74.006,
    type: "metropolis",
    tempC: 18.2,
    pressureHpa: 1018,
    windSpeedKmh: 19.2,
    seaLevelElevationM: 10,
    description: "Nor'easter storm corridor with dynamic harbor currents and urban heat island effects.",
  },
  {
    id: "amazon",
    name: "Manaus (Amazon Basin)",
    country: "Brazil",
    lat: -3.119,
    lng: -60.0217,
    type: "eco",
    tempC: 31.5,
    pressureHpa: 1010,
    windSpeedKmh: 8.4,
    seaLevelElevationM: 42,
    description: "Tropical rainforest interior with high humidity, convection rainfall, and carbon exchange.",
  },
  {
    id: "sahara",
    name: "Tamanrasset (Sahara)",
    country: "Algeria",
    lat: 22.785,
    lng: 5.5228,
    type: "extreme",
    tempC: 38.6,
    pressureHpa: 1006,
    windSpeedKmh: 31.0,
    seaLevelElevationM: 1378,
    description: "High thermal radiation zone with intense desert thermals and dust plume airflow.",
  },
  {
    id: "antarctica",
    name: "McMurdo Station",
    country: "Antarctica",
    lat: -77.846,
    lng: 166.6682,
    type: "extreme",
    tempC: -24.5,
    pressureHpa: 988,
    windSpeedKmh: 48.0,
    seaLevelElevationM: 24,
    description: "Polar polar vortex zone with extreme katabatic wind currents and sub-zero ice shelf stability.",
  },
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    lat: 51.5074,
    lng: -0.1278,
    type: "metropolis",
    tempC: 16.0,
    pressureHpa: 1016,
    windSpeedKmh: 21.0,
    seaLevelElevationM: 11,
    description: "Temperate maritime climate affected by the Gulf Stream air current.",
  },
  {
    id: "venice",
    name: "Venice",
    country: "Italy",
    lat: 45.4371,
    lng: 12.3326,
    type: "coastal",
    tempC: 21.0,
    pressureHpa: 1012,
    windSpeedKmh: 14.0,
    seaLevelElevationM: 1.0,
    description: "Historic lagoon city experiencing high tide surges (Acqua Alta) and sea level challenges.",
  },
];

/**
 * Search location using free OpenStreetMap Nominatim API
 */
export async function searchLocationNominatim(
  query: string,
  seaLevelRiseM = 0,
  timeOffsetHours = 0
): Promise<GlobeMetrics> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      "Accept-Language": "en",
    },
  });
  if (!res.ok) {
    throw new Error(`Location search failed with status ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No location found for "${query}"`);
  }

  const first = data[0];
  const lat = parseFloat(first.lat);
  const lng = parseFloat(first.lon);

  const displayNameParts = (first.display_name || "").split(", ");
  const name = displayNameParts[0] || query;
  const country = displayNameParts.length > 1 ? displayNameParts[displayNameParts.length - 1] : undefined;

  return await fetchOpenMeteoMetrics(lat, lng, name, country, seaLevelRiseM, timeOffsetHours);
}

/**
 * Fetch live weather/climate metrics from free Open-Meteo API
 */
export async function fetchOpenMeteoMetrics(
  lat: number,
  lng: number,
  locationName?: string,
  country?: string,
  seaLevelRiseM = 0,
  timeOffsetHours = 0
): Promise<GlobeMetrics> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Open-Meteo request failed");
    const data = await res.json();

    const current = data.current || {};
    const tempC = current.temperature_2m !== undefined ? Number(current.temperature_2m.toFixed(1)) : 20;
    const humidity = current.relative_humidity_2m ?? 60;
    const pressureHpa = current.surface_pressure !== undefined ? Math.round(current.surface_pressure) : 1013;
    const windSpeedKmh = current.wind_speed_10m !== undefined ? Number(current.wind_speed_10m.toFixed(1)) : 12;
    const windDirectionDeg = current.wind_direction_10m ?? 180;
    const cloudCover = current.cloud_cover ?? 30;
    const elevation = data.elevation !== undefined ? Math.round(data.elevation) : 10;

    const fallbackMetrics = calculateGlobeMetrics(lat, lng, seaLevelRiseM, timeOffsetHours);

    const name = locationName || fallbackMetrics.locationName;
    const finalCountry = country || fallbackMetrics.country;

    let summary = `Live Open-Meteo data for ${name} (${lat.toFixed(2)}°, ${lng.toFixed(2)}°): `;
    if (elevation <= seaLevelRiseM) {
      summary += `CRITICAL COASTAL FLOOD RISK! Terrain elevation (${elevation}m) submerged at +${seaLevelRiseM}m sea level rise. `;
    } else if (tempC > 35) {
      summary += `Extreme heat alert (${tempC}°C). High surface thermal cell. `;
    } else if (tempC < -10) {
      summary += `Freezing conditions (${tempC}°C) with ${windSpeedKmh} km/h wind currents. `;
    } else {
      summary += `Surface temp is ${tempC}°C with ${pressureHpa} hPa barometric pressure and ${windSpeedKmh} km/h wind vector. `;
    }

    return {
      lat: Number(lat.toFixed(4)),
      lng: Number(lng.toFixed(4)),
      locationName: name,
      country: finalCountry,
      tempC,
      pressureHpa,
      windSpeedKmh,
      windDirectionDeg,
      humidity,
      cloudCover,
      seaLevelElevationM: elevation,
      seaLevelRiseM,
      uvIndex: fallbackMetrics.uvIndex,
      airQualityIndex: fallbackMetrics.airQualityIndex,
      summary,
    };
  } catch (err) {
    console.warn("Open-Meteo fetch failed, using fallback procedural calculation:", err);
    return calculateGlobeMetrics(lat, lng, seaLevelRiseM, timeOffsetHours);
  }
}

/**
 * Procedural Earth Climate Data Calculator based on spherical lat/lng coordinates
 */
export function calculateGlobeMetrics(
  lat: number,
  lng: number,
  seaLevelRiseM: number = 0,
  timeOffsetHours: number = 0
): GlobeMetrics {
  // Latitude factor (-90 to +90)
  const absLat = Math.abs(lat);
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  // Time / Seasonal oscillation
  const seasonFactor = Math.sin((timeOffsetHours / 24 / 365) * Math.PI * 2 + latRad);

  // Temperature calculation (°C): equator ~ 30°C, poles ~ -35°C, with regional noise
  const baseTemp = 32 - absLat * 0.72 + seasonFactor * 8 * Math.sign(lat || 1);
  const terrainNoise = Math.sin(lngRad * 4) * 3 + Math.cos(latRad * 6) * 2;
  const tempC = Number((baseTemp + terrainNoise).toFixed(1));

  // Pressure calculation (hPa): Standard 1013 hPa, subtropical high (~1024), polar low (~985)
  const pressureBase = 1013 + Math.sin(latRad * 3) * 12 + Math.cos(lngRad * 2 + timeOffsetHours * 0.05) * 8;
  const pressureHpa = Math.round(pressureBase);

  // Wind speed (km/h): Jet stream bands around 30°-60° latitude
  const jetStreamPeak = Math.sin(latRad * 2) * Math.sin(latRad * 2);
  const windSpeedKmh = Number((12 + jetStreamPeak * 35 + Math.abs(Math.sin(lngRad * 3)) * 15).toFixed(1));
  const windDirectionDeg = Math.round((((Math.atan2(Math.sin(lngRad), Math.cos(latRad)) * 180) / Math.PI) + 360) % 360);

  // Sea level elevation (m) & coastal impact calculation
  // Low-lying coastal approximation
  const isCoastOrIsland = Math.abs(Math.sin(latRad * 8) * Math.cos(lngRad * 8)) < 0.2;
  const baseElevation = isCoastOrIsland ? Math.abs(Math.sin(latRad * 12)) * 4 : 50 + Math.abs(Math.sin(lngRad * 5)) * 400;
  const seaLevelElevationM = Number(baseElevation.toFixed(1));

  // Humidity & Cloud cover (%)
  const humidity = Math.min(100, Math.max(15, Math.round(75 - absLat * 0.3 + Math.sin(lngRad * 2) * 20)));
  const cloudCover = Math.min(100, Math.max(5, Math.round(45 + Math.sin(latRad * 4 + lngRad) * 35)));

  // UV Index
  const uvIndex = Math.max(0, Math.min(12, Math.round((1 - absLat / 90) * 11 + Math.sin(timeOffsetHours * 0.1) * 2)));

  // Air Quality Index (1-5)
  const aqi = Math.max(1, Math.min(5, Math.round(1 + (1 - Math.abs(lat) / 90) * 2 + (pressureHpa < 1000 ? 1 : 0))));

  // Summary builder
  let summary = `Coordinates (${lat.toFixed(2)}°, ${lng.toFixed(2)}°): `;
  if (seaLevelElevationM <= seaLevelRiseM) {
    summary += `CRITICAL COASTAL FLOOD RISK! Inundation threshold breached (+${seaLevelRiseM}m rise vs ${seaLevelElevationM}m terrain). `;
  } else if (tempC > 35) {
    summary += `Extreme heat hazard front. High thermal convection and desert updrafts. `;
  } else if (tempC < -10) {
    summary += `Sub-zero polar condition with strong katabatic winds and low humidity. `;
  } else if (windSpeedKmh > 40) {
    summary += `Gale-force wind vector stream detected. Jet stream convergence zone. `;
  } else {
    summary += `Stable atmospheric cell with ${pressureHpa} hPa barometric pressure and ${tempC}°C surface temp. `;
  }

  // Find nearest preset location
  let closestPreset = PRESET_LOCATIONS[0];
  let minDistance = Infinity;
  for (const p of PRESET_LOCATIONS) {
    const d = Math.hypot(p.lat - lat, p.lng - lng);
    if (d < minDistance) {
      minDistance = d;
      closestPreset = p;
    }
  }

  const locationName = minDistance < 15 ? closestPreset.name : `${lat >= 0 ? lat.toFixed(1) + '°N' : Math.abs(lat).toFixed(1) + '°S'}, ${lng >= 0 ? lng.toFixed(1) + '°E' : Math.abs(lng).toFixed(1) + '°W'}`;

  return {
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
    locationName,
    country: minDistance < 15 ? closestPreset.country : undefined,
    tempC,
    pressureHpa,
    windSpeedKmh,
    windDirectionDeg,
    humidity,
    cloudCover,
    seaLevelElevationM,
    seaLevelRiseM,
    uvIndex,
    airQualityIndex: aqi,
    summary,
  };
}

/**
 * Determine if a given geographic coordinate (lat, lng) is on land vs ocean,
 * using precise continent bounding boxes and fractal shoreline noise.
 */
function getLandInfo(lat: number, lng: number): { isLand: boolean; landType: "ice" | "rainforest" | "desert" | "mountain" | "forest"; elevation: number } {
  // Antarctica Polar Ice Sheet
  if (lat < -60) {
    return { isLand: true, landType: "ice", elevation: 0.8 };
  }
  // Arctic & Greenland Ice Sheet
  if (lat > 60 && lng > -75 && lng < -10) {
    return { isLand: true, landType: "ice", elevation: 0.85 };
  }

  // Harmonic coastline noise
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const noise =
    Math.sin(lngRad * 18 + latRad * 12) * 2.2 +
    Math.cos(lngRad * 36 - latRad * 24) * 1.1 +
    Math.sin(lngRad * 72 + latRad * 48) * 0.5;

  let isLand = false;
  let landType: "ice" | "rainforest" | "desert" | "mountain" | "forest" = "forest";
  let elevation = 0.2;

  // 1. North America & Central America
  if (lat >= 8 + noise * 0.4 && lat <= 75 + noise && lng >= -168 - noise && lng <= -52 + noise) {
    // Exclude Atlantic ocean gap between NA and Europe
    if (!(lat < 45 && lng > -40)) {
      isLand = true;
      if (lat > 62) landType = "ice";
      else if (lat >= 28 && lat <= 42 && lng >= -118 && lng <= -100) landType = "desert"; // US Southwest
      else if (lng >= -115 && lng <= -105 && lat >= 35 && lat <= 60) {
        landType = "mountain"; // Rockies
        elevation = 0.9;
      } else landType = "forest";
    }
  }

  // 2. South America
  if (!isLand && lat >= -56 + noise * 0.3 && lat <= 13 + noise * 0.3 && lng >= -82 + noise && lng <= -34 + noise) {
    isLand = true;
    if (lat >= -15 && lat <= 8 && lng >= -78 && lng <= -50) landType = "rainforest"; // Amazon
    else if (lng >= -78 && lng <= -68) {
      landType = "mountain"; // Andes
      elevation = 0.95;
    } else landType = "forest";
  }

  // 3. Europe & UK & Scandinavia
  if (!isLand && lat >= 35 + noise * 0.3 && lat <= 71 + noise && lng >= -10 + noise && lng <= 42 + noise) {
    isLand = true;
    if (lat >= 42 && lat <= 48 && lng >= 5 && lng <= 18) {
      landType = "mountain"; // Alps
      elevation = 0.85;
    } else landType = "forest";
  }

  // 4. Africa & Madagascar
  if (!isLand && lat >= -35 + noise * 0.3 && lat <= 37 + noise * 0.3 && lng >= -18 + noise && lng <= 51 + noise) {
    // Exclude Red Sea / Indian Ocean cutouts
    if (!(lat > 12 && lat < 30 && lng > 32 && lng < 43 && Math.abs(lat - 20) < Math.abs(lng - 38) * 2)) {
      isLand = true;
      if (lat >= 14 && lat <= 32) landType = "desert"; // Sahara
      else if (lat >= -10 && lat <= 8 && lng >= 8 && lng <= 32) landType = "rainforest"; // Congo
      else landType = "forest";
    }
  }
  // Madagascar
  if (!isLand && lat >= -26 + noise * 0.2 && lat <= -12 + noise * 0.2 && lng >= 43 && lng <= 51) {
    isLand = true;
    landType = "rainforest";
  }

  // 5. Asia & Middle East & India & SE Asia & Japan & Indonesia
  if (!isLand && lat >= 1 + noise * 0.3 && lat <= 78 + noise && lng >= 34 + noise && lng <= 180) {
    isLand = true;
    if (lat >= 12 && lat <= 34 && lng >= 35 && lng <= 60) landType = "desert"; // Arabian Peninsula
    else if (lat >= 28 && lat <= 38 && lng >= 75 && lng <= 102) {
      landType = "mountain"; // Himalayas / Tibetan Plateau
      elevation = 1.0;
    } else if (lat >= 35 && lat <= 48 && lng >= 95 && lng <= 115) landType = "desert"; // Gobi
    else if (lat >= 1 && lat <= 20 && lng >= 92 && lng <= 110) landType = "rainforest"; // SE Asia
    else landType = "forest";
  }

  // Indonesia / Philippines
  if (!isLand && lat >= -10 + noise * 0.2 && lat <= 18 + noise * 0.2 && lng >= 95 && lng <= 150) {
    if ((lat < 7 && lng > 95 && lng < 119) || (lat < 0 && lng > 110 && lng < 141) || (lat > 5 && lat < 19 && lng > 117 && lng < 127)) {
      isLand = true;
      landType = "rainforest";
    }
  }

  // 6. Australia & New Zealand
  if (!isLand && lat >= -44 + noise * 0.3 && lat <= -10 + noise * 0.3 && lng >= 112 + noise && lng <= 154 + noise) {
    isLand = true;
    if (lat >= -32 && lat <= -18 && lng >= 118 && lng <= 142) landType = "desert"; // Outback
    else landType = "forest";
  }
  if (!isLand && lat >= -47 && lat <= -34 && lng >= 166 && lng <= 179) {
    isLand = true;
    landType = "forest";
  }

  return { isLand, landType, elevation };
}

/**
 * Generate high-resolution, photorealistic Earth surface texture map canvas
 * with recognizable, accurate continent silhouettes, lush biome vegetation, deserts, snow, and shallow waters.
 */
export function generateEarthMapCanvas(width = 2048, height = 1024): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180;
    const latRad = (lat * Math.PI) / 180;

    for (let x = 0; x < width; x++) {
      const lng = (x / width) * 360 - 180;
      const lngRad = (lng * Math.PI) / 180;

      const landInfo = getLandInfo(lat, lng);
      const i = (y * width + x) * 4;

      if (landInfo.isLand) {
        // Render Land Biome Colors
        if (landInfo.landType === "ice") {
          // Polar Ice / Snow White-Cyan
          data[i] = 241;
          data[i + 1] = 245;
          data[i + 2] = 249;
        } else if (landInfo.landType === "desert") {
          // Sahara / Arabian / Outback Golden Amber
          data[i] = 217;
          data[i + 1] = 160;
          data[i + 2] = 88;
        } else if (landInfo.landType === "rainforest") {
          // Lush Amazon / Congo Emerald Green
          data[i] = 21;
          data[i + 1] = 115;
          data[i + 2] = 52;
        } else if (landInfo.landType === "mountain") {
          // Himalayas / Rockies / Andes Snow Capped Slate
          data[i] = 160;
          data[i + 1] = 165;
          data[i + 2] = 175;
        } else {
          // Temperate Forest Rich Leaf Green
          data[i] = 40;
          data[i + 1] = 128;
          data[i + 2] = 58;
        }
        data[i + 3] = 255;
      } else {
        // Render Ocean & Shallow Coastal Waters
        // Check proximity to shore (coastal shelf turquoise)
        const checkPoints = [
          getLandInfo(lat + 1.2, lng).isLand,
          getLandInfo(lat - 1.2, lng).isLand,
          getLandInfo(lat, lng + 1.2).isLand,
          getLandInfo(lat, lng - 1.2).isLand,
        ];
        const isCoastal = checkPoints.some((p) => p);

        if (isCoastal) {
          // Shallow Coastal Shelf Sky Turquoise
          data[i] = 14;
          data[i + 1] = 95;
          data[i + 2] = 135;
        } else {
          // Deep Ocean Royal Navy Blue
          const oceanDepthFactor = Math.cos(latRad);
          data[i] = Math.round(10 + oceanDepthFactor * 4);
          data[i + 1] = Math.round(30 + oceanDepthFactor * 25);
          data[i + 2] = Math.round(65 + oceanDepthFactor * 40);
        }
        data[i + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Overlay clean lat-long coordinate grid lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let lng = -180; lng <= 180; lng += 30) {
    const x = ((lng + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  return canvas;
}

/**
 * Generate Earth Elevation Bump Map canvas for mountainous terrain 3D depth
 */
export function generateEarthBumpCanvas(width = 1024, height = 512): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180;
    for (let x = 0; x < width; x++) {
      const lng = (x / width) * 360 - 180;
      const landInfo = getLandInfo(lat, lng);
      const i = (y * width + x) * 4;

      const bumpVal = landInfo.isLand ? Math.round(landInfo.elevation * 255) : 0;
      data[i] = bumpVal;
      data[i + 1] = bumpVal;
      data[i + 2] = bumpVal;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Generate Earth Specular Reflectivity map (Oceans shiny white, land matte black)
 */
export function generateEarthSpecularCanvas(width = 1024, height = 512): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180;
    for (let x = 0; x < width; x++) {
      const lng = (x / width) * 360 - 180;
      const landInfo = getLandInfo(lat, lng);
      const i = (y * width + x) * 4;

      const specVal = landInfo.isLand ? 15 : 230; // Shiny oceans, matte land
      data[i] = specVal;
      data[i + 1] = specVal;
      data[i + 2] = specVal;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Generate 2K High-Resolution Heatmap Canvas for Temperature Layer
 * Color Ramp: Deep Blue (<-30°C) -> Light Cyan (0°C) -> White (15°C) -> Orange (30°C) -> Deep Red (>40°C)
 */
export function generateTemperatureTextureCanvas(width = 2048, height = 1024): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180;
    const absLat = Math.abs(lat);
    const latRad = (lat * Math.PI) / 180;

    for (let x = 0; x < width; x++) {
      const lng = (x / width) * 360 - 180;
      const lngRad = (lng * Math.PI) / 180;

      // Realistic global temperature calculation (°C)
      const landInfo = getLandInfo(lat, lng);
      const thermalInertia = landInfo.isLand ? 1.2 : 0.8;
      const tempC = 36 - absLat * 0.85 * thermalInertia + Math.sin(lngRad * 4) * 4 + Math.cos(latRad * 5) * 3;

      // Exact color mapping requested:
      // Deep Blue (<-30°C) -> Light Cyan (0°C) -> White (15°C) -> Orange (30°C) -> Deep Red (>40°C)
      let r = 0, g = 0, b = 0, a = 210;

      if (tempC <= -30) {
        // Deep Blue (<-30°C)
        r = 10; g = 20; b = 120;
      } else if (tempC <= 0) {
        // Deep Blue (-30°C) -> Light Cyan (0°C)
        const t = (tempC + 30) / 30;
        r = Math.round(10 * (1 - t) + 100 * t);
        g = Math.round(20 * (1 - t) + 230 * t);
        b = Math.round(120 * (1 - t) + 255 * t);
      } else if (tempC <= 15) {
        // Light Cyan (0°C) -> White (15°C)
        const t = tempC / 15;
        r = Math.round(100 * (1 - t) + 255 * t);
        g = Math.round(230 * (1 - t) + 255 * t);
        b = Math.round(255 * (1 - t) + 255 * t);
      } else if (tempC <= 30) {
        // White (15°C) -> Orange (30°C)
        const t = (tempC - 15) / 15;
        r = Math.round(255 * (1 - t) + 255 * t);
        g = Math.round(255 * (1 - t) + 140 * t);
        b = Math.round(255 * (1 - t) + 0 * t);
      } else {
        // Orange (30°C) -> Deep Red (>40°C)
        const t = Math.min(1, (tempC - 30) / 10);
        r = Math.round(255 * (1 - t) + 180 * t);
        g = Math.round(140 * (1 - t) + 0 * t);
        b = Math.round(0 * (1 - t) + 20 * t);
      }

      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Generate Barometric Pressure Layer Canvas Texture
 * Renders semi-transparent concentric isobar contour lines & High/Low pressure centers
 */
export function generatePressureTextureCanvas(width = 2048, height = 1024): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // 1. Draw atmospheric pressure gradient background
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  // Key Pressure Centers (lat, lng, centerHpa, isHigh)
  const pressureCenters = [
    { lat: 30, lng: -30, hpa: 1029, isHigh: true, name: "Azores High" },
    { lat: 55, lng: 95, hpa: 1032, isHigh: true, name: "Siberian High" },
    { lat: 32, lng: -140, hpa: 1028, isHigh: true, name: "Pacific High" },
    { lat: 62, lng: -25, hpa: 988, isHigh: false, name: "Icelandic Low" },
    { lat: 52, lng: -170, hpa: 984, isHigh: false, name: "Aleutian Low" },
    { lat: -65, lng: 0, hpa: 980, isHigh: false, name: "Antarctic Low" },
    { lat: -65, lng: 120, hpa: 982, isHigh: false, name: "Antarctic Low" },
  ];

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180;
    const latRad = (lat * Math.PI) / 180;

    for (let x = 0; x < width; x++) {
      const lng = (x / width) * 360 - 180;

      // Compute combined pressure field P(lat, lng) in hPa
      let pressure = 1013 + Math.sin(latRad * 3) * 6;
      for (const center of pressureCenters) {
        const dLat = lat - center.lat;
        const dLng = Math.abs(lng - center.lng) > 180 ? 360 - Math.abs(lng - center.lng) : lng - center.lng;
        const dist = Math.hypot(dLat, dLng);
        const influence = Math.exp(-dist / 22);
        pressure += (center.hpa - 1013) * influence;
      }

      // Isobar contour check (every 4 hPa)
      const isobarStep = 4;
      const rem = Math.abs(pressure % isobarStep);
      const isIsobarLine = rem < 0.6 || rem > isobarStep - 0.6;

      const i = (y * width + x) * 4;

      if (isIsobarLine) {
        // Crisp Isobar Contour Line (Emerald / Gold / Magenta)
        if (pressure >= 1020) {
          data[i] = 251; data[i + 1] = 191; data[i + 2] = 36; data[i + 3] = 230; // High Gold
        } else if (pressure <= 1000) {
          data[i] = 236; data[i + 1] = 72; data[i + 2] = 153; data[i + 3] = 230; // Low Pink/Magenta
        } else {
          data[i] = 52; data[i + 1] = 211; data[i + 2] = 153; data[i + 3] = 200; // Normal Emerald
        }
      } else {
        // Soft atmospheric tint
        if (pressure >= 1020) {
          data[i] = 245; data[i + 1] = 158; data[i + 2] = 11; data[i + 3] = 40;
        } else if (pressure <= 1000) {
          data[i] = 14; data[i + 1] = 165; data[i + 2] = 233; data[i + 3] = 45;
        } else {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // 2. Overlay High 'H' and Low 'L' Center badges and numerical hPa values
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const center of pressureCenters) {
    const cx = ((center.lng + 180) / 360) * width;
    const cy = ((90 - center.lat) / 180) * height;

    // Glowing badge circle
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fillStyle = center.isHigh ? "rgba(245, 158, 11, 0.85)" : "rgba(236, 72, 153, 0.85)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // Text 'H' or 'L'
    ctx.font = "bold 24px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(center.isHigh ? "H" : "L", cx, cy - 2);

    // Pressure Reading (e.g. "1029 hPa")
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${Math.round(center.hpa)} hPa`, cx, cy + 38);
  }

  return canvas;
}

/**
 * Generate Sea Level Rise Hazard Mask Canvas
 * Pulsating Neon Cyan / Hazard Coastal Inundation Overlay
 */
export function generateSeaLevelTextureCanvas(seaLevelRiseM: number, width = 2048, height = 1024): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180;
    const latRad = (lat * Math.PI) / 180;

    for (let x = 0; x < width; x++) {
      const lng = (x / width) * 360 - 180;
      const lngRad = (lng * Math.PI) / 180;

      const landInfo = getLandInfo(lat, lng);
      const i = (y * width + x) * 4;

      if (landInfo.isLand) {
        // Estimate terrain elevation near coast
        const isCoast = Math.abs(Math.sin(latRad * 12) * Math.cos(lngRad * 12)) < 0.25;
        const elevation = isCoast ? Math.abs(Math.sin(latRad * 18)) * 4 : 40 + landInfo.elevation * 300;

        if (elevation <= seaLevelRiseM) {
          // Inundated Low-Lying Coastal Flood Zone: Vibrant Neon Cyan / Warning Pink
          data[i] = 34; data[i + 1] = 211; data[i + 2] = 238; data[i + 3] = 220; // Glowing Cyan
        } else if (elevation <= seaLevelRiseM + 1.5) {
          // High-Risk Coastal Boundary Line
          data[i] = 244; data[i + 1] = 63; data[i + 2] = 94; data[i + 3] = 180; // Warning Rose
        } else {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
        }
      } else {
        // Check proximity to coast to draw bright Neon Cyan coastal boundary tracing
        const nearLand = [
          getLandInfo(lat + 0.8, lng).isLand,
          getLandInfo(lat - 0.8, lng).isLand,
          getLandInfo(lat, lng + 0.8).isLand,
          getLandInfo(lat, lng - 0.8).isLand,
        ].some((p) => p);

        if (nearLand) {
          // Neon Cyan Coastal Tracing Line
          const lineAlpha = seaLevelRiseM > 0 ? 230 : 120;
          data[i] = 6; data[i + 1] = 182; data[i + 2] = 212; data[i + 3] = lineAlpha;
        } else {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Generate UV & Solar Radiation Index Canvas Texture
 * Localized Golden/Yellow/Magenta radial solar exposure glow centered at subsolar position
 */
export function generateUVTextureCanvas(timeOffsetHours: number, width = 2048, height = 1024): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  // Subsolar point coordinates based on local time offset
  const solarLng = -(((timeOffsetHours % 24) + 24) % 24 / 24) * 360 + 180;
  const solarLat = 23.44 * Math.sin((timeOffsetHours / (24 * 365)) * Math.PI * 2);

  const solarLatRad = (solarLat * Math.PI) / 180;
  const solarLngRad = (solarLng * Math.PI) / 180;

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180;
    const latRad = (lat * Math.PI) / 180;

    for (let x = 0; x < width; x++) {
      const lng = (x / width) * 360 - 180;
      const lngRad = (lng * Math.PI) / 180;

      // Spherical angular distance to subsolar point
      const cosAngle = Math.sin(latRad) * Math.sin(solarLatRad) +
        Math.cos(latRad) * Math.cos(solarLatRad) * Math.cos(lngRad - solarLngRad);

      const angle = Math.acos(Math.min(1, Math.max(-1, cosAngle))); // radians (0 to PI)

      const i = (y * width + x) * 4;

      if (angle < Math.PI / 2) {
        // Dayside with UV exposure (UV index 0 to 12)
        const uvVal = Math.cos(angle) * 12;

        if (uvVal >= 9) {
          // Intense Solar Core: Brilliant White-Gold (#fef08a)
          data[i] = 254; data[i + 1] = 240; data[i + 2] = 138; data[i + 3] = 230;
        } else if (uvVal >= 6) {
          // Very High UV: Fiery Golden Orange (#f97316)
          const t = (uvVal - 6) / 3;
          data[i] = Math.round(249 * (1 - t) + 254 * t);
          data[i + 1] = Math.round(115 * (1 - t) + 240 * t);
          data[i + 2] = Math.round(22 * (1 - t) + 138 * t);
          data[i + 3] = 200;
        } else if (uvVal >= 3) {
          // Moderate UV: Vibrant Magenta / Coral (#e11d48)
          const t = (uvVal - 3) / 3;
          data[i] = Math.round(225 * (1 - t) + 249 * t);
          data[i + 1] = Math.round(29 * (1 - t) + 115 * t);
          data[i + 2] = Math.round(72 * (1 - t) + 22 * t);
          data[i + 3] = 160;
        } else if (uvVal >= 1) {
          // Low UV: Deep Violet Ring (#9333ea)
          data[i] = 147; data[i + 1] = 51; data[i + 2] = 234; data[i + 3] = 100;
        } else {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
        }
      } else {
        // Nightside - Transparent
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Overlay Subsolar Center Solar Halo Icon
  const cx = ((solarLng + 180) / 360) * width;
  const cy = ((90 - solarLat) / 180) * height;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 36, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(253, 224, 71, 0.9)";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  ctx.font = "bold 16px sans-serif";
  ctx.fillStyle = "#78350f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("UV 12+", cx, cy);
  ctx.restore();

  return canvas;
}



