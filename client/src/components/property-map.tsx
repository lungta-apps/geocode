import { useEffect, useRef, useMemo, memo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import "leaflet-draw";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus, MousePointer, Circle, Map, Trash2, Palette, Tag, Home, Building, MapPin, Flag, Star, Heart } from "lucide-react";
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
  onDeleteProperty?: (geocode: string) => void;
}

interface PropertyWithColor {
  geocode: string;
  address: string;
  county?: string;
  coordinates?: string;
  legalDescription?: string;
  lat?: number;
  lng?: number;
  parcelGeometry?: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
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

// Marker formatting options
interface MarkerFormat {
  icon?: string;
  color?: string;
  label?: string;
}

// Available icon options
const ICON_OPTIONS = [
  { id: 'default', name: 'Default', icon: MapPin },
  { id: 'home', name: 'Home', icon: Home },
  { id: 'building', name: 'Building', icon: Building },
  { id: 'flag', name: 'Flag', icon: Flag },
  { id: 'star', name: 'Star', icon: Star },
  { id: 'heart', name: 'Heart', icon: Heart },
];

// Available color options
const COLOR_OPTIONS = [
  { id: 'blue', name: 'Blue', value: '#2196F3' },
  { id: 'red', name: 'Red', value: '#F44336' },
  { id: 'green', name: 'Green', value: '#4CAF50' },
  { id: 'orange', name: 'Orange', value: '#FF9800' },
  { id: 'purple', name: 'Purple', value: '#9C27B0' },
  { id: 'pink', name: 'Pink', value: '#E91E63' },
  { id: 'teal', name: 'Teal', value: '#009688' },
  { id: 'yellow', name: 'Yellow', value: '#FFC107' },
];

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

// Formatting Toolbar Component
interface FormattingToolbarProps {
  geocode: string;
  currentFormat: MarkerFormat;
  onFormatChange: (geocode: string, format: MarkerFormat) => void;
}

function FormattingToolbar({ geocode, currentFormat, onFormatChange }: FormattingToolbarProps) {
  const [activePanel, setActivePanel] = useState<'icon' | 'color' | 'label' | null>(null);
  const [labelDraft, setLabelDraft] = useState(currentFormat.label || '');

  // Initialize draft from current marker label when opening label panel
  useEffect(() => {
    if (activePanel === 'label') {
      setLabelDraft(currentFormat.label || '');
    }
  }, [activePanel, currentFormat.label]);

  const handleIconSelect = (iconId: string) => {
    onFormatChange(geocode, { ...currentFormat, icon: iconId });
    setActivePanel(null);
  };

  const handleColorSelect = (colorValue: string) => {
    onFormatChange(geocode, { ...currentFormat, color: colorValue });
    setActivePanel(null);
  };

  const saveLabelChange = () => {
    onFormatChange(geocode, { ...currentFormat, label: labelDraft });
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveLabelChange();
      e.currentTarget.blur();
    }
  };

  const togglePanel = (panel: 'icon' | 'color' | 'label') => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  return (
    <div className="mt-2 mb-2 border-t border-b border-gray-300 py-2">
      {/* Toolbar Buttons */}
      <div className="flex gap-1 mb-2">
        <Button
          onClick={() => togglePanel('icon')}
          variant={activePanel === 'icon' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 text-xs"
          data-testid={`button-icon-picker-${geocode}`}
        >
          <MapPin className="h-3 w-3 mr-1" />
          Icon
        </Button>
        <Button
          onClick={() => togglePanel('color')}
          variant={activePanel === 'color' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 text-xs"
          data-testid={`button-color-picker-${geocode}`}
        >
          <Palette className="h-3 w-3 mr-1" />
          Color
        </Button>
        <Button
          onClick={() => togglePanel('label')}
          variant={activePanel === 'label' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 text-xs"
          data-testid={`button-label-editor-${geocode}`}
        >
          <Tag className="h-3 w-3 mr-1" />
          Label
        </Button>
      </div>

      {/* Icon Picker Panel */}
      {activePanel === 'icon' && (
        <div className="grid grid-cols-3 gap-1 p-2 bg-gray-50 rounded" data-testid={`panel-icon-picker-${geocode}`}>
          {ICON_OPTIONS.map((iconOption) => {
            const IconComponent = iconOption.icon;
            const isSelected = currentFormat.icon === iconOption.id;
            return (
              <button
                key={iconOption.id}
                onClick={() => handleIconSelect(iconOption.id)}
                className={`p-2 rounded border text-center transition-colors ${
                  isSelected 
                    ? 'bg-primary text-white border-primary' 
                    : 'bg-white border-gray-300 hover:bg-gray-100'
                }`}
                data-testid={`icon-option-${iconOption.id}-${geocode}`}
              >
                <IconComponent className="h-4 w-4 mx-auto" />
                <div className="text-xs mt-1">{iconOption.name}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Color Picker Panel */}
      {activePanel === 'color' && (
        <div className="flex gap-1 p-2 bg-gray-50 rounded flex-wrap" data-testid={`panel-color-picker-${geocode}`}>
          {COLOR_OPTIONS.map((colorOption) => {
            const isSelected = currentFormat.color === colorOption.value;
            return (
              <button
                key={colorOption.id}
                onClick={() => handleColorSelect(colorOption.value)}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                  isSelected ? 'border-gray-900 scale-110' : 'border-gray-300'
                }`}
                style={{ backgroundColor: colorOption.value }}
                title={colorOption.name}
                data-testid={`color-option-${colorOption.id}-${geocode}`}
              />
            );
          })}
        </div>
      )}

      {/* Label Editor Panel */}
      {activePanel === 'label' && (
        <div 
          className="p-2 bg-gray-50 rounded" 
          data-testid={`panel-label-editor-${geocode}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Input
            type="text"
            placeholder="Enter custom label..."
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={saveLabelChange}
            onKeyDown={handleLabelKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="text-sm"
            data-testid={`input-label-${geocode}`}
            autoFocus
          />
        </div>
      )}
    </div>
  );
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
        className="z-[10000] bg-surface border-gray-600 text-on-surface min-w-48"
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

function ZoomControls({ mapRef }: { mapRef: React.RefObject<L.Map | null> }) {
  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  return (
    <div 
      className="absolute top-[72px] right-4 flex flex-col space-y-2 z-[9999]"
      style={{ position: 'absolute', top: '72px', right: '16px', zIndex: 9999 }}
    >
      <Button
        onClick={handleZoomIn}
        className="bg-surface hover:bg-surface-variant text-on-surface p-2 rounded-lg shadow-lg border border-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary w-10 h-10"
        aria-label="Zoom in"
        data-testid="button-zoom-in"
        size="sm"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        onClick={handleZoomOut}
        className="bg-surface hover:bg-surface-variant text-on-surface p-2 rounded-lg shadow-lg border border-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary w-10 h-10"
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

// LocalStorage key for marker formats
const MARKER_FORMATS_STORAGE_KEY = 'map-marker-formats';

// Helper to load marker formats from localStorage
const loadMarkerFormatsFromStorage = (): Record<string, MarkerFormat> => {
  if (typeof window === 'undefined') return {};
  
  try {
    const saved = localStorage.getItem(MARKER_FORMATS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load marker formats from localStorage:', error);
  }
  return {};
};

// Helper to save marker formats to localStorage
const saveMarkerFormatsToStorage = (formats: Record<string, MarkerFormat>) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(MARKER_FORMATS_STORAGE_KEY, JSON.stringify(formats));
  } catch (error) {
    console.error('Failed to save marker formats to localStorage:', error);
  }
};

export const PropertyMap = memo(function PropertyMap({ 
  properties, 
  selectedGeocode,
  isSelectionMode = false,
  onPropertySelection,
  selectedPropertyGeocodes = [],
  onDeleteProperty
}: PropertyMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  
  // Marker formatting state - stores custom icon, color, and label per geocode
  // Initialize from localStorage to persist across map size toggles and page reloads
  const [markerFormats, setMarkerFormats] = useState<Record<string, MarkerFormat>>(() => {
    return loadMarkerFormatsFromStorage();
  });
  
  // Persist marker formats to localStorage whenever they change
  useEffect(() => {
    saveMarkerFormatsToStorage(markerFormats);
  }, [markerFormats]);
  
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

  // Handler to update marker formatting
  const handleFormatChange = (geocode: string, format: MarkerFormat) => {
    setMarkerFormats(prev => {
      const updated = {
        ...prev,
        [geocode]: format
      };
      // Save to localStorage immediately for real-time persistence
      saveMarkerFormatsToStorage(updated);
      return updated;
    });
  };

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

  // Helper function to get icon shape based on selected icon type
  const getIconShape = (iconId?: string) => {
    switch (iconId) {
      case 'home':
        return 'polygon(50% 0%, 100% 38%, 82% 38%, 82% 100%, 18% 100%, 18% 38%, 0% 38%)'; // House shape
      case 'building':
        return 'rect'; // Square
      case 'flag':
        return 'polygon(20% 20%, 80% 35%, 20% 50%, 20% 80%, 30% 80%, 30% 20%)'; // Flag shape
      case 'star':
        return 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'; // Star
      case 'heart':
        return 'polygon(50% 80%, 100% 40%, 100% 20%, 80% 0%, 50% 20%, 20% 0%, 0% 20%, 0% 40%)'; // Heart approximation
      default:
        return '50%'; // Circle (border-radius)
    }
  };

  // Helper function to create custom marker icon with formatting
  const createCustomIcon = (
    geocode: string, 
    baseColor: string, 
    size: number, 
    isSelected: boolean, 
    isDimmed: boolean
  ) => {
    const format = markerFormats[geocode] || {};
    const markerColor = format.color || baseColor;
    const opacity = isDimmed ? UNSELECTED_OPACITY : 1;
    const animation = isSelected ? 'animation: pulse 2s infinite;' : '';
    const iconShape = getIconShape(format.icon);
    
    // Determine if it's a polygon shape or border-radius
    const isPolygonShape = iconShape !== '50%' && iconShape !== 'rect';
    const isRect = iconShape === 'rect';
    
    let markerStyle = '';
    if (isPolygonShape) {
      // Use clip-path for complex shapes - use filter drop-shadow instead of border
      markerStyle = `background-color: ${markerColor}; width: ${size}px; height: ${size}px; clip-path: ${iconShape}; filter: drop-shadow(0 0 2px white) drop-shadow(0 3px 6px rgba(0,0,0,0.4)); opacity: ${opacity}; ${animation}`;
    } else if (isRect) {
      // Square shape
      markerStyle = `background-color: ${markerColor}; width: ${size}px; height: ${size}px; border-radius: 15%; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4); opacity: ${opacity}; ${animation}`;
    } else {
      // Default circle
      markerStyle = `background-color: ${markerColor}; width: ${size}px; height: ${size}px; border-radius: ${iconShape}; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4); opacity: ${opacity}; ${animation}`;
    }
    
    return L.divIcon({
      className: `custom-marker-${geocode}`,
      html: `<div style="${markerStyle}"></div>`,
      iconSize: [size + 6, size + 6],
      iconAnchor: [(size + 6) / 2, (size + 6) / 2]
    });
  };
  
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
          
          // Get custom color from formatting if available
          const customFormat = markerFormats[property.geocode] || {};
          const customColor = customFormat.color;
          
          // Determine colors and opacity based on selection state and group selection
          let polygonColor = customColor || PROPERTY_COLOR;
          let polygonOpacity = 1;
          let fillOpacity = 0.1;
          let weight = 2;
          
          if (isSelected) {
            // Individual property selection (from clicking)
            polygonColor = customColor || SELECTED_COLOR;
            weight = 3;
            fillOpacity = 0.2;
          } else if (isInSelectionGroup) {
            // Property is in the current selection group
            polygonColor = customColor || '#4CAF50'; // Green for group selection
            weight = 3;
            fillOpacity = 0.15;
          } else if (shouldBeDimmed || shouldBeDimmedBySelection) {
            // Dimmed when other properties are selected or when not in selection group
            polygonOpacity = UNSELECTED_OPACITY;
            fillOpacity = 0.05;
          }
          
          // Choose appropriate icon based on selection states
          let markerIcon;
          let iconSize = 20;
          let iconBaseColor = PROPERTY_COLOR;
          
          if (isSelected) {
            iconSize = 24;
            iconBaseColor = SELECTED_COLOR;
            markerIcon = createCustomIcon(property.geocode, iconBaseColor, iconSize, true, false);
          } else if (isInSelectionGroup) {
            iconSize = 22;
            iconBaseColor = '#4CAF50';
            markerIcon = createCustomIcon(property.geocode, iconBaseColor, iconSize, false, false);
          } else if (shouldBeDimmed || shouldBeDimmedBySelection) {
            iconSize = 16;
            markerIcon = createCustomIcon(property.geocode, iconBaseColor, iconSize, false, true);
          } else {
            markerIcon = createCustomIcon(property.geocode, iconBaseColor, iconSize, false, false);
          }
          
          // Include format in key to force re-render when format changes
          const formatKey = markerFormats[property.geocode] 
            ? `${markerFormats[property.geocode].icon || 'default'}-${markerFormats[property.geocode].color || 'default'}-${markerFormats[property.geocode].label || 'none'}`
            : 'no-format';
          
          return (
            <div key={`property-${property.geocode}-${property.colorIndex}-${formatKey}`}>
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
                      {markerFormats[property.geocode]?.label && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                          <strong>Label:</strong> {markerFormats[property.geocode].label}
                        </div>
                      )}
                      
                      {/* Formatting Toolbar */}
                      <FormattingToolbar
                        geocode={property.geocode}
                        currentFormat={markerFormats[property.geocode] || {}}
                        onFormatChange={handleFormatChange}
                      />
                      
                      {onDeleteProperty && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProperty(property.geocode);
                          }}
                          variant="destructive"
                          size="sm"
                          className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white"
                          data-testid={`button-delete-${property.geocode}`}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete Marker
                        </Button>
                      )}
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
                      {markerFormats[property.geocode]?.label && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                          <strong>Label:</strong> {markerFormats[property.geocode].label}
                        </div>
                      )}
                      
                      {/* Formatting Toolbar */}
                      <FormattingToolbar
                        geocode={property.geocode}
                        currentFormat={markerFormats[property.geocode] || {}}
                        onFormatChange={handleFormatChange}
                      />
                      
                      {onDeleteProperty && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProperty(property.geocode);
                          }}
                          variant="destructive"
                          size="sm"
                          className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white"
                          data-testid={`button-delete-${property.geocode}`}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete Marker
                        </Button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}
            </div>
          );
        })}
        
          <MapController properties={propertiesWithColors} />
        </MapContainer>
      </div>
      
      {/* Basemap controls positioned outside MapContainer for stability */}
      <BasemapControls 
        selectedBasemap={selectedBasemap}
        onBasemapChange={setSelectedBasemap}
      />
      
      {/* Zoom controls positioned outside MapContainer for visibility */}
      <ZoomControls mapRef={mapRef} />
    </div>
  );
});

// Set display name for debugging
PropertyMap.displayName = 'PropertyMap';
