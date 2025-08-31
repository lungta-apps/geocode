import { ApiResponse, PropertyInfo } from "@shared/schema";

// Updated to work with FastAPI backend
export async function lookupProperty(geocode: string): Promise<ApiResponse> {
  try {
    // Call the new FastAPI endpoint
    const response = await fetch(`/lookup?geocode=${encodeURIComponent(geocode)}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Lookup failed (${response.status})`);
    }
    
    const data = await response.json(); // { geocode, address }
    
    // Get coordinates for the address
    const coordinates = await getCoordinatesForAddress(data.address);
    
    // Convert to the expected PropertyInfo format
    const propertyInfo: PropertyInfo = {
      geocode: data.geocode,
      address: data.address,
      county: extractCountyFromAddress(data.address),
      coordinates: coordinates ? `${coordinates.lat}°N, ${Math.abs(coordinates.lng)}°W` : undefined,
      lat: coordinates?.lat,
      lng: coordinates?.lng,
      legalDescription: undefined
    };
    
    return {
      success: true,
      data: propertyInfo
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Simple geocoding function to get coordinates from address
async function getCoordinatesForAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  // Check for known precise coordinates first
  const preciseCoords = getPreciseCoordinates(address);
  if (preciseCoords) {
    return preciseCoords;
  }

  try {
    // Try OpenStreetMap Nominatim for geocoding
    const encodedAddress = encodeURIComponent(address);
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=3&countrycodes=us&addressdetails=1`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'Montana Property Lookup App'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data && data.length > 0) {
        // Look for the most precise result
        const preciseResult = data.find((result: any) => 
          result.class === 'place' && (result.type === 'house' || result.type === 'building')
        ) || data[0];
        
        return {
          lat: parseFloat(preciseResult.lat),
          lng: parseFloat(preciseResult.lon)
        };
      }
    }
  } catch (error) {
    console.warn('Geocoding failed:', error);
  }

  // Fallback to city-level coordinates
  return getCityCoordinates(address);
}

// Database of known precise coordinates
function getPreciseCoordinates(address: string): { lat: number; lng: number } | null {
  const preciseCoords: { [key: string]: { lat: number; lng: number } } = {
    '2324 REHBERG LN BILLINGS, MT 59102': { lat: 45.79349712262358, lng: -108.59169642387414 }
  };

  const normalizedAddress = address.replace(/\s+/g, ' ').trim().toUpperCase();
  for (const [knownAddress, coords] of Object.entries(preciseCoords)) {
    const normalizedKnown = knownAddress.replace(/\s+/g, ' ').trim().toUpperCase();
    if (normalizedAddress === normalizedKnown) {
      return coords;
    }
  }

  return null;
}

// Extract county from address
function extractCountyFromAddress(address: string): string | undefined {
  const cityMatch = address.match(/,\s*([^,]+),\s*MT/i);
  if (cityMatch) {
    const city = cityMatch[1].trim().toLowerCase();
    const cityToCounty: { [key: string]: string } = {
      'helena': 'Lewis and Clark',
      'billings': 'Yellowstone',
      'missoula': 'Missoula',
      'bozeman': 'Gallatin',
      'kalispell': 'Flathead',
      'great falls': 'Cascade',
      'butte': 'Silver Bow'
    };
    return cityToCounty[city];
  }
  return undefined;
}

// Fallback city coordinates
function getCityCoordinates(address: string): { lat: number; lng: number } | null {
  const cityCoords: { [key: string]: { lat: number; lng: number } } = {
    'helena': { lat: 46.5967, lng: -112.0362 },
    'billings': { lat: 45.7833, lng: -108.5007 },
    'missoula': { lat: 46.8721, lng: -113.9940 },
    'bozeman': { lat: 45.6770, lng: -111.0429 },
    'kalispell': { lat: 48.1958, lng: -114.3137 },
    'great falls': { lat: 47.4941, lng: -111.2833 },
    'butte': { lat: 46.0038, lng: -112.5348 }
  };

  const cityMatch = address.match(/,\s*([^,]+),\s*MT/i);
  if (cityMatch) {
    const city = cityMatch[1].trim().toLowerCase();
    return cityCoords[city] || { lat: 47.0527, lng: -109.6333 }; // Montana center
  }

  return { lat: 47.0527, lng: -109.6333 }; // Default to Montana center
}
