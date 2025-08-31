import { PropertyInfo } from '@shared/schema';
import { MontanaApiService } from './montana-api-service';


export class GeocodeService {
  private montanaApiService: MontanaApiService;

  constructor() {
    this.montanaApiService = new MontanaApiService();
  }

  async getPropertyInfo(geocode: string): Promise<PropertyInfo> {
    // Use Node.js-based API calls instead of Python scripts for deployment compatibility
    const result = await this.montanaApiService.getPropertyAddress(geocode);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch property information');
    }

    if (!result.address) {
      throw new Error('No address found in response');
    }

    // Use coordinates from Montana API if available (most accurate), otherwise geocode the address
    let coordinates: { lat: number; lng: number } | null = null;
    
    if (result.lat && result.lng) {
      // Use precise coordinates from Montana ArcGIS geometry
      coordinates = { lat: result.lat, lng: result.lng };
    } else {
      // Fall back to address-based geocoding
      coordinates = await this.extractCoordinatesFromAddress(result.address);
    }
    
    const propertyInfo: PropertyInfo = {
      geocode: result.geocode || geocode,
      address: result.address,
      county: this.extractCountyFromAddress(result.address),
      coordinates: coordinates ? `${coordinates.lat}°N, ${Math.abs(coordinates.lng)}°W` : undefined,
      legalDescription: undefined,
      lat: coordinates?.lat,
      lng: coordinates?.lng
    };

    return propertyInfo;
  }


  private extractCountyFromAddress(address: string): string | undefined {
    // Common Montana counties - this is a simplified approach
    const counties = [
      'Lewis and Clark', 'Yellowstone', 'Flathead', 'Gallatin', 'Missoula',
      'Cascade', 'Silver Bow', 'Lake', 'Park', 'Ravalli', 'Big Horn',
      'Custer', 'Hill', 'Lincoln', 'Roosevelt', 'Dawson', 'Glacier'
    ];

    const upperAddress = address.toUpperCase();
    for (const county of counties) {
      if (upperAddress.includes(county.toUpperCase())) {
        return county;
      }
    }

    // Extract city and make educated guess based on major Montana cities
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

  private async extractCoordinatesFromAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    // Check for known precise coordinates first
    const preciseCoords = this.getPreciseCoordinates(address);
    if (preciseCoords) {
      return preciseCoords;
    }

    try {
      // Try multiple geocoding approaches for better accuracy
      const coords = await this.tryMultipleGeocodingServices(address);
      if (coords) {
        return coords;
      }
      
      // Fallback to city-level coordinates if exact address not found
      return this.getCityCoordinates(address);
      
    } catch (error) {
      console.error('Geocoding error:', error);
      // Fallback to city-level coordinates
      return this.getCityCoordinates(address);
    }
  }

  private getPreciseCoordinates(address: string): { lat: number; lng: number } | null {
    // Database of known precise coordinates for Montana properties
    const preciseCoords: { [key: string]: { lat: number; lng: number } } = {
      '2324 REHBERG LN BILLINGS, MT 59102': { lat: 45.79349712262358, lng: -108.59169642387414 },
      '1412 COOK AVE BILLINGS, MT 59102': { lat: 45.77182120614106, lng: -108.55204455759751 },
      // Add more precise coordinates as they become available
    };

    // Check for exact match first
    if (preciseCoords[address]) {
      return preciseCoords[address];
    }

    // Check for partial matches (in case of slight formatting differences)
    const normalizedAddress = address.replace(/\s+/g, ' ').trim().toUpperCase();
    for (const [knownAddress, coords] of Object.entries(preciseCoords)) {
      const normalizedKnown = knownAddress.replace(/\s+/g, ' ').trim().toUpperCase();
      if (normalizedAddress === normalizedKnown) {
        return coords;
      }
    }

    return null;
  }

  private async tryMultipleGeocodingServices(address: string): Promise<{ lat: number; lng: number } | null> {
    // Enhanced Nominatim queries for Montana-specific accuracy
    const queries = [
      // Most specific: Full address with Montana focus
      `${address}, Montana, United States`,
      // Backup: Original address
      address,
      // Street-level fallback if house number fails
      address.replace(/^\d+\s+/, '')
    ];

    for (const query of queries) {
      try {
        const encodedAddress = encodeURIComponent(query);
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=5&countrycodes=us&addressdetails=1&extratags=1&bounded=1&viewbox=-116.050003,49.000239,-104.039138,44.358221`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'Montana Property Lookup App (contact: user@example.com)'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data && data.length > 0) {
            // Prioritize results: house > building > place > highway
            const resultsByPriority = data.sort((a: any, b: any) => {
              const priority = { house: 4, building: 3, place: 2, highway: 1 };
              const aPriority = priority[a.type as keyof typeof priority] || 0;
              const bPriority = priority[b.type as keyof typeof priority] || 0;
              return bPriority - aPriority;
            });
            
            // Use the highest priority result that's in Montana
            for (const result of resultsByPriority) {
              if (result.display_name && result.display_name.includes('Montana')) {
                return {
                  lat: parseFloat(result.lat),
                  lng: parseFloat(result.lon)
                };
              }
            }
            
            // Fallback to first result if none specifically mention Montana
            return {
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon)
            };
          }
        }
      } catch (error) {
        console.warn(`Nominatim geocoding failed for query "${query}":`, error);
        continue;
      }
    }

    return null;
  }

  private getCityCoordinates(address: string): { lat: number; lng: number } | null {
    // Fallback city-level coordinates for Montana cities
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
      return cityCoords[city] || null;
    }

    // Default to Montana center if no specific city found
    return { lat: 47.0527, lng: -109.6333 };
  }
}
