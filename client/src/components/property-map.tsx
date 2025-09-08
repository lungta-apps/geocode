import { useEffect, useRef, useMemo, memo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import { PropertyInfo } from "@shared/schema";

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface PropertyMapProps {
  properties: PropertyInfo[];
  selectedGeocode?: string | null;
}

interface PropertyWithColor extends PropertyInfo {
  color: string;
  colorIndex: number;
}

// Color constants for properties
const PROPERTY_COLOR = '#2196F3'; // Nice blue for unselected
const SELECTED_COLOR = '#FF6B35'; // Orange for selected/highlighted property
const UNSELECTED_OPACITY = 0.4; // Dimmed when another property is selected

// Performance constants
const MAX_VISIBLE_PROPERTIES = 50;
const POLYGON_SIMPLIFICATION_TOLERANCE = 0.0001;

function MapController({ properties, selectedGeocode }: { properties: PropertyInfo[], selectedGeocode?: string | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedGeocode) {
      // Find the selected property and center on it
      const selectedProperty = properties.find(p => p.geocode === selectedGeocode);
      if (selectedProperty && selectedProperty.lat && selectedProperty.lng) {
        map.setView([selectedProperty.lat, selectedProperty.lng], 16);
        return;
      }
    }

    if (properties.length === 0) return;

    // Collect all coordinates for bounds calculation
    const allCoordinates: [number, number][] = [];
    
    properties.forEach(property => {
      // Add center point coordinates
      if (property.lat && property.lng) {
        allCoordinates.push([property.lat, property.lng]);
      }
      
      // Add polygon coordinates if available
      if (property.parcelGeometry?.coordinates) {
        const outerRing = property.parcelGeometry.coordinates[0];
        outerRing.forEach(([lng, lat]) => {
          allCoordinates.push([lat, lng]);
        });
      }
    });

    if (allCoordinates.length > 0) {
      if (allCoordinates.length === 1) {
        // Single point - center on it
        map.setView(allCoordinates[0], 15);
      } else {
        // Multiple points - fit bounds to show all
        const bounds = new L.LatLngBounds(allCoordinates);
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }
  }, [map, properties, selectedGeocode]);

  return null;
}

function ZoomControls() {
  const map = useMap();

  return (
    <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
      <Button
        onClick={() => map.zoomIn()}
        className="bg-surface hover:bg-surface-variant text-on-surface p-2 rounded-lg shadow-lg border border-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Zoom in"
        data-testid="button-zoom-in"
        size="sm"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => map.zoomOut()}
        className="bg-surface hover:bg-surface-variant text-on-surface p-2 rounded-lg shadow-lg border border-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Zoom out"
        data-testid="button-zoom-out"
        size="sm"
      >
        <Minus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export const PropertyMap = memo(function PropertyMap({ properties, selectedGeocode }: PropertyMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  
  // Memoized processing of properties with single color and performance optimizations
  const propertiesWithColors: PropertyWithColor[] = useMemo(() => {
    const validProperties = properties.filter(p => p.lat && p.lng);
    
    // Limit visible properties for performance
    const limitedProperties = validProperties.slice(0, MAX_VISIBLE_PROPERTIES);
    
    return limitedProperties.map((property, index) => ({
      ...property,
      color: PROPERTY_COLOR, // All properties use the same blue color
      colorIndex: index
    }));
  }, [properties]);

  // Custom marker icons for selected and unselected properties
  const { selectedIcon, unselectedIcon, dimmedIcon } = useMemo(() => {
    const selectedIcon = L.divIcon({
      className: 'custom-marker-selected',
      html: `<div style="background-color: ${SELECTED_COLOR}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4); animation: pulse 2s infinite;"></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    
    const unselectedIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${PROPERTY_COLOR}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
    
    const dimmedIcon = L.divIcon({
      className: 'custom-marker-dimmed',
      html: `<div style="background-color: ${PROPERTY_COLOR}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.2); opacity: ${UNSELECTED_OPACITY};"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    
    return { selectedIcon, unselectedIcon, dimmedIcon };
  }, []);
  
  // Memoized center point calculation for initial map positioning
  const { centerLat, centerLng } = useMemo(() => {
    if (propertiesWithColors.length === 0) {
      return { centerLat: 45.7833, centerLng: -110.5 }; // Montana center as fallback
    }
    
    const totalLat = propertiesWithColors.reduce((sum, p) => sum + (p.lat || 0), 0);
    const totalLng = propertiesWithColors.reduce((sum, p) => sum + (p.lng || 0), 0);
    
    return {
      centerLat: totalLat / propertiesWithColors.length,
      centerLng: totalLng / propertiesWithColors.length
    };
  }, [propertiesWithColors]);
  
  // Simplified polygon coordinates for performance
  const simplifyPolygonCoordinates = useMemo(() => {
    return (coordinates: [number, number][]): [number, number][] => {
      if (coordinates.length <= 10) return coordinates; // Don't simplify small polygons
      
      // Simple Douglas-Peucker-like simplification
      const simplified: [number, number][] = [coordinates[0]];
      for (let i = 2; i < coordinates.length - 1; i += 2) {
        simplified.push(coordinates[i]);
      }
      simplified.push(coordinates[coordinates.length - 1]);
      
      return simplified;
    };
  }, []);

  return (
    <div className="relative">
      <div
        role="img"
        aria-label={`Interactive map showing ${propertiesWithColors.length} ${propertiesWithColors.length === 1 ? 'property' : 'properties'}`}
        data-testid="map-container"
      >
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={propertiesWithColors.length === 1 ? 15 : 10}
          className="w-full h-80 rounded-lg border border-gray-600 leaflet-dark-theme"
          zoomControl={false}
          ref={mapRef}
        >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={20}
        />
        
        {/* Render all properties with highlighting */}
        {propertiesWithColors.map((property) => {
          const isSelected = selectedGeocode === property.geocode;
          const isAnySelected = selectedGeocode !== null;
          const shouldBeDimmed = isAnySelected && !isSelected;
          
          // Determine colors and opacity based on selection state
          const polygonColor = isSelected ? SELECTED_COLOR : PROPERTY_COLOR;
          const polygonOpacity = shouldBeDimmed ? UNSELECTED_OPACITY : 1;
          const fillOpacity = isSelected ? 0.2 : (shouldBeDimmed ? 0.05 : 0.1);
          const weight = isSelected ? 3 : 2;
          
          // Choose appropriate icon
          const markerIcon = isSelected ? selectedIcon : (shouldBeDimmed ? dimmedIcon : unselectedIcon);
          
          return (
            <div key={`property-${property.geocode}-${property.colorIndex}`}>
              {/* Render parcel polygon if geometry is available */}
              {property.parcelGeometry?.coordinates && (
                <Polygon
                  positions={property.parcelGeometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])}
                  pathOptions={{
                    color: polygonColor,
                    weight: weight,
                    opacity: polygonOpacity,
                    fillColor: polygonColor,
                    fillOpacity: fillOpacity
                  }}
                >
                  <Popup className="dark-popup">
                    <div className="text-gray-900 font-sans">
                      <strong className="text-primary block mb-1">
                        {isSelected ? '📍 Selected Property Parcel' : 'Property Parcel'}
                      </strong>
                      <div className="text-sm font-medium mb-1">{property.geocode}</div>
                      <span className="text-sm">{property.address}</span>
                    </div>
                  </Popup>
                </Polygon>
              )}
              
              {/* Center point marker */}
              {property.lat && property.lng && (
                <Marker 
                  position={[property.lat, property.lng]} 
                  icon={markerIcon}
                >
                  <Popup className="dark-popup">
                    <div className="text-gray-900 font-sans">
                      <strong className="text-primary block mb-1">
                        {isSelected ? '📍 Selected Property Center' : 'Property Center'}
                      </strong>
                      <div className="text-sm font-medium mb-1">{property.geocode}</div>
                      <span className="text-sm">{property.address}</span>
                    </div>
                  </Popup>
                </Marker>
              )}
            </div>
          );
        })}
        
          <MapController properties={propertiesWithColors} selectedGeocode={selectedGeocode} />
          <ZoomControls />
        </MapContainer>
      </div>
      
      {/* Enhanced Map Legend */}
      <div className="mt-4 space-y-3">
        {propertiesWithColors.length > 1 && (
          <div className="text-sm font-medium text-on-surface mb-2">
            Properties ({propertiesWithColors.length}{properties.length > MAX_VISIBLE_PROPERTIES ? ` of ${properties.length}` : ''})
            {properties.length > MAX_VISIBLE_PROPERTIES && (
              <span className="text-xs text-on-surface-variant ml-2">
                Showing first {MAX_VISIBLE_PROPERTIES} for performance
              </span>
            )}
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-2 text-sm text-on-surface-variant max-h-32 overflow-y-auto">
          {propertiesWithColors.map((property) => (
            <div key={`legend-${property.geocode}-${property.colorIndex}`} className="flex items-center space-x-3 p-2 rounded bg-surface-variant/20">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full border border-white flex-shrink-0"
                  style={{ backgroundColor: PROPERTY_COLOR }}
                ></div>
                {property.parcelGeometry && (
                  <div 
                    className="w-3 h-3 border-2 bg-opacity-10 flex-shrink-0"
                    style={{ 
                      borderColor: PROPERTY_COLOR, 
                      backgroundColor: PROPERTY_COLOR + '1A' // Add transparency
                    }}
                  ></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-xs text-on-surface">{property.geocode}</div>
                <div className="text-xs truncate" title={property.address}>{property.address}</div>
              </div>
            </div>
          ))}
        </div>
        
        {propertiesWithColors.length > 0 && (
          <div className="flex items-center space-x-4 text-xs text-on-surface-variant pt-2 border-t border-gray-600">
            <div className="flex items-center space-x-2">
              <div 
                className="w-2 h-2 rounded-full border border-white"
                style={{ backgroundColor: PROPERTY_COLOR }}
              ></div>
              <span>Property Center</span>
            </div>
            {propertiesWithColors.some(p => p.parcelGeometry) && (
              <div className="flex items-center space-x-2">
                <div 
                  className="w-2 h-2 border-2 bg-opacity-10"
                  style={{ 
                    borderColor: PROPERTY_COLOR, 
                    backgroundColor: PROPERTY_COLOR + '1A'
                  }}
                ></div>
                <span>Parcel Boundary</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// Set display name for debugging
PropertyMap.displayName = 'PropertyMap';
