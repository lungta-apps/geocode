import { PropertyInfo, BatchPropertyResult } from '../../shared/schema';
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

    // Calculate center point from parcel geometry for fallback coordinates
    let coordinates: { lat: number; lng: number } | null = null;
    
    if (result.parcelGeometry) {
      // Calculate center of polygon for display coordinates
      coordinates = this.calculatePolygonCenter(result.parcelGeometry);
      console.log(`Using parcel center coordinates for: ${result.address}`);
    } else {
      // Fallback to geocoding service if no parcel geometry
      coordinates = await this.extractCoordinatesFromAddress(result.address);
      console.log(`Geocoding address (no parcel geometry): ${result.address}`);
    }
    
    const propertyInfo: PropertyInfo = {
      geocode: result.geocode || geocode,
      address: result.address,
      county: this.extractCountyFromAddress(result.address),
      coordinates: coordinates ? `${coordinates.lat}°N, ${Math.abs(coordinates.lng)}°W` : undefined,
      legalDescription: undefined,
      lat: coordinates?.lat,
      lng: coordinates?.lng,
      parcelGeometry: result.parcelGeometry
    };

    return propertyInfo;
  }

  async getPropertiesInfoBatch(geocodes: string[]): Promise<BatchPropertyResult[]> {
    console.log(`Processing batch of ${geocodes.length} geocodes...`);
    
    // Process all geocodes concurrently using Promise.allSettled to handle partial failures
    const settledPromises = await Promise.allSettled(
      geocodes.map(async (geocode): Promise<BatchPropertyResult> => {
        const processedAt = new Date().toISOString();
        try {
          const propertyInfo = await this.getPropertyInfo(geocode);
          return {
            geocode,
            success: true,
            data: propertyInfo,
            processedAt
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          console.warn(`Failed to process geocode ${geocode}:`, errorMessage);
          return {
            geocode,
            success: false,
            error: errorMessage,
            processedAt
          };
        }
      })
    );

    // Extract results from settled promises - all results will be BatchPropertyResult
    const results: BatchPropertyResult[] = settledPromises.map(settledResult => {
      if (settledResult.status === 'fulfilled') {
        return settledResult.value;
      } else {
        // This should rarely happen since we handle errors in the inner try-catch
        return {
          geocode: 'unknown',
          success: false,
          error: `Promise rejected: ${settledResult.reason}`,
          processedAt: new Date().toISOString()
        };
      }
    });

    console.log(`Batch processing complete: ${results.filter(r => r.success).length}/${results.length} successful`);
    return results;
  }

  async getPropertiesInfoBatchWithProgress(
    geocodes: string[], 
    batchId: string,
    onProgress: (progress: any) => void
  ): Promise<BatchPropertyResult[]> {
    console.log(`Processing batch ${batchId} with ${geocodes.length} geocodes...`);
    
    const results: BatchPropertyResult[] = [];
    const startTime = Date.now();
    let totalProcessingTime = 0;
    
    // Process geocodes sequentially with rate limiting for large batches
    const isLargeBatch = geocodes.length > 5;
    const delayBetweenRequests = isLargeBatch ? 100 : 0; // 100ms delay for large batches
    
    for (let i = 0; i < geocodes.length; i++) {
      const geocode = geocodes[i];
      const itemStartTime = Date.now();
      
      try {
        const propertyInfo = await this.getPropertyInfo(geocode);
        const processedAt = new Date().toISOString();
        
        results.push({
          geocode,
          success: true,
          data: propertyInfo,
          processedAt
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.warn(`Failed to process geocode ${geocode}:`, errorMessage);
        
        results.push({
          geocode,
          success: false,
          error: errorMessage,
          processedAt: new Date().toISOString()
        });
      }
      
      // Calculate timing metrics
      const itemProcessingTime = Date.now() - itemStartTime;
      totalProcessingTime += itemProcessingTime;
      const averageProcessingTime = totalProcessingTime / (i + 1);
      const remainingItems = geocodes.length - (i + 1);
      const estimatedTimeRemaining = Math.round((remainingItems * averageProcessingTime) / 1000); // in seconds
      
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      
      // Send progress update
      onProgress({
        status: 'processing',
        totalGeocodes: geocodes.length,
        processedCount: i + 1,
        successCount,
        failedCount,
        currentGeocode: geocode,
        estimatedTimeRemaining,
        processingRate: Math.round(60000 / averageProcessingTime), // items per minute
        elapsedTime: Math.round((Date.now() - startTime) / 1000) // seconds
      });
      
      // Rate limiting for large batches
      if (delayBetweenRequests > 0 && i < geocodes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }
    
    console.log(`Batch ${batchId} processing complete: ${results.filter(r => r.success).length}/${results.length} successful`);
    return results;
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
    // First try: Nominatim with building-level precision
    try {
      const encodedAddress = encodeURIComponent(address);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=3&countrycodes=us&addressdetails=1&extratags=1`;
      
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'Montana Property Lookup App (contact: user@example.com)'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && data.length > 0) {
          // Look for the most precise result (building or house number level)
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
      console.warn('Nominatim geocoding failed:', error);
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

  private calculatePolygonCenter(geometry: { type: "Polygon"; coordinates: number[][][] }): { lat: number; lng: number } | null {
    try {
      if (!geometry.coordinates || geometry.coordinates.length === 0) {
        return null;
      }

      // Get the outer ring (first ring in the polygon)
      const outerRing = geometry.coordinates[0];
      if (!outerRing || outerRing.length === 0) {
        return null;
      }

      // Calculate centroid of the polygon
      let totalLat = 0;
      let totalLng = 0;
      
      for (const point of outerRing) {
        totalLng += point[0]; // longitude
        totalLat += point[1]; // latitude
      }

      const centerLat = totalLat / outerRing.length;
      const centerLng = totalLng / outerRing.length;

      return { lat: centerLat, lng: centerLng };
    } catch (error) {
      console.warn('Failed to calculate polygon center:', error);
      return null;
    }
  }
}
