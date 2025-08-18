import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { PropertyInfo } from '@shared/schema';

interface PythonResult {
  success: boolean;
  address?: string;
  geocode?: string;
  error?: string;
}

export class GeocodeService {
  private pythonScriptPath: string;

  constructor() {
    // Handle __dirname in ES modules
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    // Use original Playwright script for reliable data extraction
    this.pythonScriptPath = path.join(currentDir, '../scripts/property_lookup.py');
  }

  async getPropertyInfo(geocode: string): Promise<PropertyInfo> {
    return new Promise((resolve, reject) => {
      // Use the virtual environment python from uv
      const pythonPath = '/home/runner/workspace/.pythonlibs/bin/python';
      const pythonProcess = spawn(pythonPath, [this.pythonScriptPath, geocode], {
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSERS_PATH: '/home/runner/workspace/.cache/ms-playwright'
        }
      });
      
      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result: PythonResult = JSON.parse(stdout);
          
          if (!result.success) {
            reject(new Error(result.error || 'Failed to fetch property information'));
            return;
          }

          if (!result.address) {
            reject(new Error('No address found in response'));
            return;
          }

          // Extract coordinates from address if possible (basic geocoding)
          const coordinates = this.extractCoordinatesFromAddress(result.address);
          
          const propertyInfo: PropertyInfo = {
            geocode: result.geocode || geocode,
            address: result.address,
            county: this.extractCountyFromAddress(result.address),
            coordinates: coordinates ? `${coordinates.lat}°N, ${Math.abs(coordinates.lng)}°W` : undefined,
            legalDescription: undefined, // Would need additional scraping
            lat: coordinates?.lat,
            lng: coordinates?.lng
          };

          resolve(propertyInfo);
        } catch (error) {
          reject(new Error(`Failed to parse Python script output: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python script: ${error.message}`));
      });
    });
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

  private extractCoordinatesFromAddress(address: string): { lat: number; lng: number } | null {
    // Basic geocoding for major Montana cities - in a real app, you'd use a geocoding service
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
