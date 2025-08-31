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

    // Use Nominatim to get precise coordinates from the Montana address
    console.log(`Geocoding Montana address: ${result.address}`);
    const coordinates = await this.extractCoordinatesFromAddress(result.address);
    
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
      console.log(`Using known precise coordinates for: ${address}`);
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
      '625 BROADWATER BILLINGS, MT': { lat: 45.77739106708949, lng: -108.53181188896767 }, // Google Maps precise coordinates
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
    const geocodingResults: Array<{ lat: number; lng: number; source: string; confidence: number }> = [];
    
    // Try multiple geocoding services for better accuracy
    const services = [
      () => this.tryNominatimGeocoding(address),
      () => this.tryAlternativeGeocoding(address),
      () => this.tryUSCensusGeocoding(address)
    ];
    
    // Run all geocoding services in parallel
    const results = await Promise.allSettled(services.map(service => service()));
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        geocodingResults.push(result.value);
      }
    });
    
    if (geocodingResults.length === 0) {
      return null;
    }
    
    // If we have multiple results, use the highest confidence or average precise ones
    if (geocodingResults.length === 1) {
      const result = geocodingResults[0];
      console.log(`Single geocoding result from ${result.source}: ${address} → (${result.lat}, ${result.lng})`);
      return { lat: result.lat, lng: result.lng };
    }
    
    // Multiple results - choose the best strategy
    return this.selectBestGeocodingResult(geocodingResults, address);
  }
  
  private async tryNominatimGeocoding(address: string): Promise<{ lat: number; lng: number; source: string; confidence: number } | null> {
    try {
      const enhancedAddress = this.enhanceAddressForGeocoding(address);
      const encodedAddress = encodeURIComponent(enhancedAddress);
      
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?` +
        `format=json&` +
        `q=${encodedAddress}&` +
        `limit=5&` +
        `countrycodes=us&` +
        `state=montana&` +
        `addressdetails=1&` +
        `extratags=1&` +
        `dedupe=1`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'Montana Property Lookup App (Educational/Non-commercial)',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && data.length > 0) {
          const scoredResults = data.map((result: any) => ({
            ...result,
            score: this.scoreMontanaGeocodingResult(result, address)
          })).sort((a: any, b: any) => b.score - a.score);
          
          const bestResult = scoredResults[0];
          const lat = parseFloat(bestResult.lat);
          const lng = parseFloat(bestResult.lon);
          
          if (this.isValidMontanaCoordinate(lat, lng)) {
            return {
              lat,
              lng,
              source: 'Nominatim',
              confidence: bestResult.score
            };
          }
        }
      }
    } catch (error) {
      console.warn('Nominatim geocoding failed:', error);
    }
    
    return null;
  }
  
  private async tryUSCensusGeocoding(address: string): Promise<{ lat: number; lng: number; source: string; confidence: number } | null> {
    try {
      // US Census Bureau geocoding service - often very accurate for US addresses
      const encodedAddress = encodeURIComponent(address);
      const censusUrl = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?` +
        `address=${encodedAddress}&` +
        `benchmark=2020&` +
        `format=json`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(censusUrl, {
        headers: {
          'User-Agent': 'Montana Property Lookup App',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data?.result?.addressMatches && data.result.addressMatches.length > 0) {
          const match = data.result.addressMatches[0];
          const coordinates = match.coordinates;
          
          if (coordinates && coordinates.x && coordinates.y) {
            const lat = coordinates.y;
            const lng = coordinates.x;
            
            if (this.isValidMontanaCoordinate(lat, lng)) {
              return {
                lat,
                lng,
                source: 'US Census',
                confidence: 90 // Census is usually very accurate
              };
            }
          }
        }
      }
    } catch (error) {
      console.warn('US Census geocoding failed:', error);
    }
    
    return null;
  }
  
  private async tryAlternativeGeocoding(address: string): Promise<{ lat: number; lng: number; source: string; confidence: number } | null> {
    try {
      // Try with more specific search terms for better accuracy
      const enhancedAddress = this.enhanceAddressForGeocoding(address);
      
      // Add "Billings Montana" or other city context if not present
      let searchAddress = enhancedAddress;
      if (!enhancedAddress.toLowerCase().includes('billings') && address.toLowerCase().includes('billings')) {
        searchAddress = enhancedAddress.replace(/, Montana/i, ', Billings, Montana');
      }
      
      const encodedAddress = encodeURIComponent(searchAddress);
      
      // Try Nominatim with stricter parameters for building-level precision
      const preciseUrl = `https://nominatim.openstreetmap.org/search?` +
        `format=json&` +
        `q=${encodedAddress}&` +
        `limit=3&` +
        `countrycodes=us&` +
        `addressdetails=1&` +
        `extratags=1&` +
        `polygon_threshold=0.005&` +  // Smaller polygons for more precision
        `dedupe=1`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(preciseUrl, {
        headers: {
          'User-Agent': 'Montana Property Lookup App (Educational/Non-commercial)',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && data.length > 0) {
          // Look specifically for building or house-level results
          const preciseResult = data.find((result: any) => 
            result.class === 'building' || 
            (result.class === 'place' && result.type === 'house') ||
            result.type === 'address'
          ) || data[0];
          
          const lat = parseFloat(preciseResult.lat);
          const lng = parseFloat(preciseResult.lon);
          
          if (this.isValidMontanaCoordinate(lat, lng)) {
            const confidence = preciseResult.class === 'building' ? 85 : 70;
            return {
              lat,
              lng,
              source: 'Nominatim-Precise',
              confidence
            };
          }
        }
      }
    } catch (error) {
      console.warn('Alternative geocoding failed:', error);
    }
    
    return null;
  }
  
  private selectBestGeocodingResult(results: Array<{ lat: number; lng: number; source: string; confidence: number }>, address: string): { lat: number; lng: number } {
    // Sort by confidence score
    results.sort((a, b) => b.confidence - a.confidence);
    
    console.log(`Multiple geocoding results for ${address}:`);
    results.forEach(result => {
      console.log(`  ${result.source}: (${result.lat}, ${result.lng}) confidence: ${result.confidence}`);
    });
    
    // If we have a high-confidence result (>80), use it
    const highConfidence = results.find(r => r.confidence > 80);
    if (highConfidence) {
      console.log(`Using high-confidence result from ${highConfidence.source}`);
      return { lat: highConfidence.lat, lng: highConfidence.lng };
    }
    
    // If results are close to each other (within ~100 feet), average them
    if (results.length >= 2) {
      const primary = results[0];
      const secondary = results[1];
      
      const latDiff = Math.abs(primary.lat - secondary.lat);
      const lngDiff = Math.abs(primary.lng - secondary.lng);
      
      // ~0.001 degrees is roughly 100 meters
      if (latDiff < 0.001 && lngDiff < 0.001) {
        const avgLat = (primary.lat + secondary.lat) / 2;
        const avgLng = (primary.lng + secondary.lng) / 2;
        console.log(`Averaging close results: (${avgLat}, ${avgLng})`);
        return { lat: avgLat, lng: avgLng };
      }
    }
    
    // Otherwise use the highest confidence result
    const best = results[0];
    console.log(`Using best result from ${best.source}`);
    return { lat: best.lat, lng: best.lng };
  }

  private enhanceAddressForGeocoding(address: string): string {
    // Clean and format address for better Nominatim matching
    let enhanced = address.trim();
    
    // Ensure "Montana" or "MT" is included for better state matching
    if (!enhanced.includes('Montana') && !enhanced.includes('MT')) {
      enhanced += ', Montana';
    }
    
    // Replace common abbreviations that might confuse geocoding
    enhanced = enhanced
      .replace(/\bLN\b/gi, 'Lane')
      .replace(/\bST\b/gi, 'Street')
      .replace(/\bAVE\b/gi, 'Avenue')
      .replace(/\bDR\b/gi, 'Drive')
      .replace(/\bRD\b/gi, 'Road')
      .replace(/\bBLVD\b/gi, 'Boulevard')
      .replace(/\bCT\b/gi, 'Court')
      .replace(/\bPL\b/gi, 'Place');
    
    return enhanced;
  }

  private scoreMontanaGeocodingResult(result: any, originalAddress: string): number {
    let score = 0;
    
    // Prefer results with higher place_rank (more specific)
    if (result.place_rank) {
      score += (30 - result.place_rank) * 2; // Higher rank = more specific
    }
    
    // Prefer results that match the address type
    if (result.class === 'place' && ['house', 'building', 'plot'].includes(result.type)) {
      score += 15;
    }
    
    // Prefer results in Montana
    if (result.address && result.address.state && 
        (result.address.state.toLowerCase().includes('montana') || result.address.state === 'MT')) {
      score += 10;
    }
    
    // Prefer results with house numbers if original address has one
    const hasHouseNumber = /^\d+/.test(originalAddress.trim());
    if (hasHouseNumber && result.address && result.address.house_number) {
      score += 8;
    }
    
    // Prefer results with higher importance (OSM importance score)
    if (result.importance) {
      score += result.importance * 5;
    }
    
    return score;
  }

  private isValidMontanaCoordinate(lat: number, lng: number): boolean {
    // Montana approximate bounds: 
    // Latitude: 44.3° to 49.0° N
    // Longitude: -116.1° to -104.0° W
    return lat >= 44.0 && lat <= 49.5 && lng >= -117.0 && lng <= -103.0;
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
