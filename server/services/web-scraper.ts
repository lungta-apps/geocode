// @ts-ignore - node-fetch ESM module compatibility
const fetch = require('node-fetch');
import { PropertyInfo } from '@shared/schema';

/**
 * Node.js-based web scraper for deployment environments
 * This provides a fallback when Python/Playwright isn't available
 */
export class WebScraperService {
  private baseUrl = 'https://svc.mt.gov/msl/cadastral/';

  async lookupProperty(geocode: string): Promise<PropertyInfo> {
    try {
      // For deployment environments, we'll use a different approach
      // Since direct web scraping without browser automation is complex,
      // we'll implement a service that can handle known geocodes
      
      console.log(`WebScraperService: Looking up geocode ${geocode}`);
      
      // Clean the geocode - remove any dashes
      const cleanGeocode = geocode.replace(/-/g, '');
      
      // Since we can't directly scrape the cadastral website without browser automation,
      // we cannot provide authentic property data in the deployment environment
      throw new Error('Browser automation not available in deployment environment - authentic data extraction requires Playwright which is not supported in the current hosting environment.');
      
    } catch (error) {
      console.error('WebScraperService error:', error);
      throw new Error(`Failed to lookup property: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractCoordinatesFromAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    // Check for known precise coordinates first
    const preciseCoords = this.getPreciseCoordinates(address);
    if (preciseCoords) {
      return preciseCoords;
    }

    try {
      // Use OpenStreetMap Nominatim API for geocoding
      const encodedAddress = encodeURIComponent(address);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=us`;
      
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'Montana Property Lookup App (contact: user@example.com)'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && Array.isArray(data) && data.length > 0) {
          const result = data[0];
          return {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon)
          };
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  private getPreciseCoordinates(address: string): { lat: number; lng: number } | null {
    // Database of known precise coordinates for Montana properties
    const preciseCoords: { [key: string]: { lat: number; lng: number } } = {
      '2324 REHBERG LN BILLINGS, MT 59102': { lat: 45.79349712262358, lng: -108.59169642387414 },
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

  private extractCountyFromAddress(address: string): string | undefined {
    // Common Montana counties
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


}