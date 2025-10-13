// api/_lib/geocode-service.js
import { getPropertyAddress } from "./montana-api-service.js"; // we'll create this next

export async function getPropertyInfo(geocode) {
  const result = await getPropertyAddress(String(geocode || "").trim());

  if (!result?.success) {
    throw new Error(result?.error || "Failed to fetch property information");
  }
  if (!result?.address) {
    throw new Error("No address found in response");
  }

  // pick coordinates: parcel center if geometry is provided, else geocode the address
  let coordinates = null;
  if (result.parcelGeometry) {
    coordinates = calculatePolygonCenter(result.parcelGeometry) || null;
  } else {
    coordinates = await extractCoordinatesFromAddress(result.address);
  }

  return {
    geocode: result.geocode || geocode,
    address: result.address,
    county: extractCountyFromAddress(result.address),
    coordinates: coordinates ? `${coordinates.lat}°N, ${Math.abs(coordinates.lng)}°W` : undefined,
    lat: coordinates?.lat,
    lng: coordinates?.lng,
    parcelGeometry: result.parcelGeometry ?? null,
  };
}

/* ---------- helpers (ported from your TS file, adapted to JS) ---------- */

function extractCountyFromAddress(address) {
  const counties = [
    "Lewis and Clark", "Yellowstone", "Flathead", "Gallatin", "Missoula",
    "Cascade", "Silver Bow", "Lake", "Park", "Ravalli", "Big Horn",
    "Custer", "Hill", "Lincoln", "Roosevelt", "Dawson", "Glacier",
  ];
  const upper = String(address || "").toUpperCase();
  for (const county of counties) {
    if (upper.includes(county.toUpperCase())) return county;
  }
  const cityMatch = String(address || "").match(/,\s*([^,]+),\s*MT/i);
  if (cityMatch) {
    const city = cityMatch[1].trim().toLowerCase();
    const cityToCounty = {
      helena: "Lewis and Clark",
      billings: "Yellowstone",
      missoula: "Missoula",
      bozeman: "Gallatin",
      kalispell: "Flathead",
      "great falls": "Cascade",
      butte: "Silver Bow",
    };
    return cityToCounty[city];
  }
  return undefined;
}

async function extractCoordinatesFromAddress(address) {
  const precise = getPreciseCoordinates(address);
  if (precise) return precise;

  try {
    const coords = await tryMultipleGeocodingServices(address);
    if (coords) return coords;
    return getCityCoordinates(address);
  } catch (err) {
    console.warn("Geocoding error:", err);
    return getCityCoordinates(address);
  }
}

function getPreciseCoordinates(address) {
  const preciseCoords = {
    "2324 REHBERG LN BILLINGS, MT 59102": { lat: 45.79349712262358, lng: -108.59169642387414 },
  };
  const exact = preciseCoords[address];
  if (exact) return exact;

  const normalized = String(address || "").replace(/\s+/g, " ").trim().toUpperCase();
  for (const [known, coords] of Object.entries(preciseCoords)) {
    const normKnown = known.replace(/\s+/g, " ").trim().toUpperCase();
    if (normalized === normKnown) return coords;
  }
  return null;
}

async function tryMultipleGeocodingServices(address) {
  // Nominatim (OpenStreetMap) — be gentle with usage
  try {
    const encoded = encodeURIComponent(String(address || ""));
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=3&countrycodes=us&addressdetails=1&extratags=1`;

    const resp = await fetch(url, {
      headers: { "User-Agent": "Montana Property Lookup App (contact: user@example.com)" },
    });

    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const precise =
          data.find(r => r?.class === "place" && (r?.type === "house" || r?.type === "building")) || data[0];
        return {
          lat: parseFloat(precise.lat),
          lng: parseFloat(precise.lon),
        };
      }
    }
  } catch (err) {
    console.warn("Nominatim geocoding failed:", err);
  }
  return null;
}

function getCityCoordinates(address) {
  const cityCoords = {
    helena: { lat: 46.5967, lng: -112.0362 },
    billings: { lat: 45.7833, lng: -108.5007 },
    missoula: { lat: 46.8721, lng: -113.994 },
    bozeman: { lat: 45.677, lng: -111.0429 },
    kalispell: { lat: 48.1958, lng: -114.3137 },
    "great falls": { lat: 47.4941, lng: -111.2833 },
    butte: { lat: 46.0038, lng: -112.5348 },
  };

  const match = String(address || "").match(/,\s*([^,]+),\s*MT/i);
  if (match) {
    const city = match[1].trim().toLowerCase();
    return cityCoords[city] || null;
  }
  return { lat: 47.0527, lng: -109.6333 }; // Montana center
}

function calculatePolygonCenter(geometry) {
  try {
    const rings = geometry?.coordinates;
    if (!Array.isArray(rings) || rings.length === 0) return null;

    const outer = rings[0];
    if (!Array.isArray(outer) || outer.length === 0) return null;

    let sumLat = 0, sumLng = 0;
    for (const pt of outer) {
      sumLng += pt[0];
      sumLat += pt[1];
    }
    return { lat: sumLat / outer.length, lng: sumLng / outer.length };
  } catch (err) {
    console.warn("Failed to calculate polygon center:", err);
    return null;
  }
}
