import { useEffect, useRef, useMemo, memo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import "leaflet-draw";
import { Button } from "@/components/ui/button";
import { Plus, Minus, MousePointer, Circle, Map } from "lucide-react";
import { PropertyInfo } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Basemap configuration
interface BasemapConfig {
  id: string;
  name: string;
  url: string;
  attribution: string;
  description: string;
}

const BASEMAP_OPTIONS: BasemapConfig[] = [
  {
    id: 'dark',
    name: 'Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    description: 'Dark theme ideal for highlighting data'
  },
  {
    id: 'light',
    name: 'Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    description: 'Clean light theme'
  },
  {
    id: 'voyager',
    name: 'Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    description: 'Balanced neutral theme'
  }
];

const DEFAULT_BASEMAP = 'dark';

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
  isSelectionMode?: boolean;
  onPropertySelection?: (geocodes: string[]) => void;
  selectedPropertyGeocodes?: string[];
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

function MapController({ properties }: { properties: PropertyInfo[] }) {
  const map = useMap();
  
  useEffect(() => {
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
  }, [map, properties]);

  return null;
}

// Drawing control component for property selection
interface DrawingControlProps {
  isSelectionMode: boolean;
  onPropertySelection: (geocodes: string[]) => void;
  properties: PropertyInfo[];
  selectedPropertyGeocodes: string[];
}

function DrawingControl({ isSelectionMode, onPropertySelection, properties, selectedPropertyGeocodes }: DrawingControlProps) {
  const map = useMap();
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);

  useEffect(() => {
    if (!isSelectionMode) {
      // Clean up when not in selection mode
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
        drawControlRef.current = null;
      }
      if (drawnItemsRef.current) {
        map.removeLayer(drawnItemsRef.current);
        drawnItemsRef.current = null;
      }
      return;
    }

    // Initialize feature group for drawn items
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    // Initialize draw controls
    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
      },
      draw: {
        polyline: false,
        polygon: {},
        circle: {},
        rectangle: false,
        marker: false,
        circlemarker: false,
      },
    });
    
    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    // Handle draw events
    const handleDrawCreated = (e: L.LeafletEvent) => {
      const drawEvent = e as L.DrawEvents.Created;
      const layer = drawEvent.layer;
      
      // Clear previous selections
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);
      
      // Find properties within the drawn area
      const selectedGeocodes = findPropertiesInShape(layer, properties);
      onPropertySelection(selectedGeocodes);
    };
    
    const handleDrawDeleted = () => {
      onPropertySelection([]);
    };

    map.on(L.Draw.Event.CREATED, handleDrawCreated);
    map.on(L.Draw.Event.DELETED, handleDrawDeleted);
    map.on(L.Draw.Event.EDITED, handleDrawCreated);

    return () => {
      map.off(L.Draw.Event.CREATED, handleDrawCreated);
      map.off(L.Draw.Event.DELETED, handleDrawDeleted);
      map.off(L.Draw.Event.EDITED, handleDrawCreated);
      
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
      }
      if (drawnItemsRef.current) {
        map.removeLayer(drawnItemsRef.current);
      }
    };
  }, [isSelectionMode, map, onPropertySelection, properties]);

  return null;
}

// Function to find properties within a drawn shape
function findPropertiesInShape(layer: L.Layer, properties: PropertyInfo[]): string[] {
  const selectedGeocodes: string[] = [];
  
  properties.forEach(property => {
    if (!property.lat || !property.lng) return;
    
    const propertyLatLng = L.latLng(property.lat, property.lng);
    let isInside = false;
    
    if (layer instanceof L.Circle) {
      const distance = layer.getLatLng().distanceTo(propertyLatLng);
      isInside = distance <= layer.getRadius();
    } else if (layer instanceof L.Rectangle) {
      isInside = layer.getBounds().contains(propertyLatLng);
    } else if (layer instanceof L.Polygon) {
      // For polygon, check if point is inside using ray casting
      const bounds = layer.getBounds();
      if (bounds.contains(propertyLatLng)) {
        // Simple point-in-polygon check
        const polygon = layer.getLatLngs()[0] as L.LatLng[];
        isInside = isPointInPolygon(propertyLatLng, polygon);
      }
    }
    
    if (isInside) {
      selectedGeocodes.push(property.geocode);
    }
  });
  
  return selectedGeocodes;
}

// Ray casting algorithm for point-in-polygon detection
function isPointInPolygon(point: L.LatLng, polygon: L.LatLng[]): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

function BasemapSelector({ 
  selectedBasemap, 
  onBasemapChange 
}: { 
  selectedBasemap: string; 
  onBasemapChange: (basemapId: string) => void;
}) {
  const currentBasemap = BASEMAP_OPTIONS.find(option => option.id === selectedBasemap) || BASEMAP_OPTIONS[0];
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="bg-surface hover:bg-surface-variant text-on-surface p-2 rounded-lg shadow-lg border border-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Select basemap"
          data-testid="button-basemap-selector"
          size="sm"
        >
          <Map className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-surface border-gray-600 text-on-surface min-w-48"
        sideOffset={8}
      >
        <div className="px-2 py-1 text-xs text-gray-400 font-medium">
          Choose Basemap
        </div>
        {BASEMAP_OPTIONS.map((basemap) => (
          <DropdownMenuItem
            key={basemap.id}
            onClick={() => onBasemapChange(basemap.id)}
            className="focus:bg-surface-variant cursor-pointer px-2 py-2"
            data-testid={`basemap-option-${basemap.id}`}
          >
            <div className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <div 
                  className={`w-3 h-3 rounded-full border ${
                    selectedBasemap === basemap.id 
                      ? 'bg-primary border-primary' 
                      : 'border-gray-400'
                  }`}
                />
                <span className="font-medium text-sm">{basemap.name}</span>
              </div>
              <span className="text-xs text-gray-400 ml-5">
                {basemap.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ZoomControls() {
  const map = useMap();

  return (
    <div className="absolute top-14 right-4 flex flex-col space-y-2 z-50">
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

function BasemapControls({ 
  selectedBasemap, 
  onBasemapChange 
}: { 
  selectedBasemap: string; 
  onBasemapChange: (basemapId: string) => void; 
}) {
  return (
    <div 
      className="absolute top-4 right-4 z-[9999]"
      style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 9999 }}
    >
      <BasemapSelector 
        selectedBasemap={selectedBasemap}
        onBasemapChange={onBasemapChange}
      />
    </div>
  );
}

export const PropertyMap = memo(function PropertyMap({ 
  properties, 
  selectedGeocode,
  isSelectionMode = false,
  onPropertySelection,
  selectedPropertyGeocodes = [] 
}: PropertyMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  
  // Basemap state management with localStorage persistence
  const [selectedBasemap, setSelectedBasemap] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('map-basemap-preference');
      if (saved && BASEMAP_OPTIONS.find(option => option.id === saved)) {
        return saved;
      }
    }
    return DEFAULT_BASEMAP;
  });

  // Persist basemap selection to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('map-basemap-preference', selectedBasemap);
    }
  }, [selectedBasemap]);

  // Get current basemap configuration
  const currentBasemap = useMemo(() => {
    return BASEMAP_OPTIONS.find(option => option.id === selectedBasemap) || BASEMAP_OPTIONS[0];
  }, [selectedBasemap]);
  
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
    <div className="relative h-full overflow-visible">
      <div
        role="img"
        aria-label={`Interactive map showing ${propertiesWithColors.length} ${propertiesWithColors.length === 1 ? 'property' : 'properties'}`}
        data-testid="map-container"
        className="h-full overflow-visible"
      >
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={propertiesWithColors.length === 1 ? 15 : 10}
          className="w-full h-full rounded-lg border border-gray-600 leaflet-dark-theme"
          style={{ minHeight: '320px' }}
          zoomControl={false}
          ref={mapRef}
        >
        <TileLayer
          key={currentBasemap.id}
          attribution={currentBasemap.attribution}
          url={currentBasemap.url}
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={20}
        />
        
        {/* Drawing control for property selection */}
        {isSelectionMode && (
          <DrawingControl 
            isSelectionMode={isSelectionMode}
            onPropertySelection={onPropertySelection!}
            properties={properties}
            selectedPropertyGeocodes={selectedPropertyGeocodes}
          />
        )}
        
        {/* Render all properties with highlighting */}
        {propertiesWithColors.map((property) => {
          const isSelected = selectedGeocode === property.geocode;
          const isAnySelected = selectedGeocode !== null;
          const shouldBeDimmed = isAnySelected && !isSelected;
          
          // Check if property is in the current selection group
          const isInSelectionGroup = selectedPropertyGeocodes.includes(property.geocode);
          const isSelectionActive = selectedPropertyGeocodes.length > 0;
          const shouldBeDimmedBySelection = isSelectionActive && !isInSelectionGroup;
          
          // Determine colors and opacity based on selection state and group selection
          let polygonColor = PROPERTY_COLOR;
          let polygonOpacity = 1;
          let fillOpacity = 0.1;
          let weight = 2;
          
          if (isSelected) {
            // Individual property selection (from clicking)
            polygonColor = SELECTED_COLOR;
            weight = 3;
            fillOpacity = 0.2;
          } else if (isInSelectionGroup) {
            // Property is in the current selection group
            polygonColor = '#4CAF50'; // Green for group selection
            weight = 3;
            fillOpacity = 0.15;
          } else if (shouldBeDimmed || shouldBeDimmedBySelection) {
            // Dimmed when other properties are selected or when not in selection group
            polygonOpacity = UNSELECTED_OPACITY;
            fillOpacity = 0.05;
          }
          
          // Choose appropriate icon based on selection states
          let markerIcon = unselectedIcon;
          if (isSelected) {
            markerIcon = selectedIcon;
          } else if (isInSelectionGroup) {
            // Create a special icon for group-selected properties
            markerIcon = L.divIcon({
              className: 'custom-marker-group-selected',
              html: `<div style="background-color: #4CAF50; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            });
          } else if (shouldBeDimmed || shouldBeDimmedBySelection) {
            markerIcon = dimmedIcon;
          }
          
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
        
          <MapController properties={propertiesWithColors} />
          <ZoomControls />
        </MapContainer>
      </div>
      
      {/* Basemap controls positioned outside MapContainer for stability */}
      <BasemapControls 
        selectedBasemap={selectedBasemap}
        onBasemapChange={setSelectedBasemap}
      />
    </div>
  );
});

// Set display name for debugging
PropertyMap.displayName = 'PropertyMap';
