import { Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useRef, useMemo, memo, useState } from "react";
import { renderToString } from "react-dom/server";
import { createPortal } from "react-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import "leaflet-draw";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Minus,
  Circle,
  Map,
  Trash2,
  Palette,
  Tag,
  Home,
  Building,
  MapPin,
  Flag,
  Star,
  Heart,
  type LucideIcon,
} from "lucide-react";
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
    id: "dark",
    name: "Dark Matter",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    description: "Dark theme ideal for highlighting data",
  },
  {
    id: "light",
    name: "Positron",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    description: "Clean light theme",
  },
  {
    id: "voyager",
    name: "Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    description: "Balanced neutral theme",
  },
];

const DEFAULT_BASEMAP = "dark";

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface PropertyMapProps {
  properties: PropertyInfo[];
  selectedGeocodes?: string[];
  isSelectionMode?: boolean;
  onPropertySelection?: (geocodes: string[]) => void;
  selectedPropertyGeocodes?: string[];
  onDeleteProperty?: (geocode: string) => void;
  isGroupToolbarOpen?: boolean;
  onCloseGroupToolbar?: () => void;
  onMarkerClick?: (geocode: string) => void;
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
const PROPERTY_COLOR = "#2196f3"; // Nice blue for unselected
const SELECTED_COLOR = "#FF6B35"; // Orange for selected/highlighted property
const UNSELECTED_OPACITY = 0.4; // Dimmed when another property is selected

// Performance constants
const MAX_VISIBLE_PROPERTIES = 200;
const POLYGON_SIMPLIFICATION_TOLERANCE = 0.0001;

// Marker formatting options
interface MarkerFormat {
  icon?: string;
  color?: string;
  note?: string;
}

// Map label interface for draggable text annotations
interface MapLabel {
  id: string;
  text: string;
  lat: number;
  lng: number;
  color?: string;
  size?: "sm" | "md" | "lg";
}

// Available icon options
const ICON_OPTIONS = [
  { id: "default", name: "Default", icon: Circle },
  { id: "home", name: "Home", icon: Home },
  { id: "building", name: "Building", icon: Building },
  { id: "flag", name: "Flag", icon: Flag },
  { id: "star", name: "Star", icon: Star },
  { id: "heart", name: "Heart", icon: Heart },
];

// Available color options
const COLOR_OPTIONS = [
  { id: "blue", name: "Blue", value: "#2196F3" },
  { id: "red", name: "Red", value: "#F44336" },
  { id: "green", name: "Green", value: "#4CAF50" },
  { id: "orange", name: "Orange", value: "#FF9800" },
  { id: "purple", name: "Purple", value: "#9C27B0" },
  { id: "pink", name: "Pink", value: "#E91E63" },
  { id: "teal", name: "Teal", value: "#009688" },
  { id: "yellow", name: "Yellow", value: "#FFC107" },
];

function MapController({ properties }: { properties: PropertyInfo[] }) {
  const map = useMap();
  const previousCountRef = useRef<number>(0);

  useEffect(() => {
    if (properties.length === 0) return;

    // Only auto-zoom when properties count increases (new properties added)
    // This prevents auto-zoom when toggling selection mode (which just filters existing properties)
    if (properties.length <= previousCountRef.current) {
      // Update the count but don't zoom - this is likely just filtering
      previousCountRef.current = properties.length;
      return;
    }

    // Update the previous count
    previousCountRef.current = properties.length;

    // Collect all coordinates for bounds calculation
    const allCoordinates: [number, number][] = [];

    properties.forEach((property) => {
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

function DrawingControl({
  isSelectionMode,
  onPropertySelection,
  properties,
  selectedPropertyGeocodes,
}: DrawingControlProps) {
  const map = useMap();
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const polygonDrawerRef = useRef<L.Draw.Polygon | null>(null);

  useEffect(() => {
    if (!isSelectionMode) {
      // Clean up when not in selection mode
      if (polygonDrawerRef.current) {
        polygonDrawerRef.current.disable();
        polygonDrawerRef.current = null;
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

    // Create polygon drawer programmatically (no UI toolbar)
    const polygonDrawer = new L.Draw.Polygon(map, {
      shapeOptions: {
        color: '#FF6B35',
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.2,
      },
      showArea: true,
      metric: true,
    });
    polygonDrawerRef.current = polygonDrawer;

    // Auto-start polygon drawing immediately
    polygonDrawer.enable();

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

      // Exit drawing mode after polygon completion
      // User can now interact with the selected properties while staying in selection mode
      if (polygonDrawerRef.current) {
        polygonDrawerRef.current.disable();
        polygonDrawerRef.current = null;
      }
    };

    map.on(L.Draw.Event.CREATED, handleDrawCreated);

    return () => {
      map.off(L.Draw.Event.CREATED, handleDrawCreated);

      if (polygonDrawerRef.current) {
        polygonDrawerRef.current.disable();
        polygonDrawerRef.current = null;
      }
      if (drawnItemsRef.current) {
        map.removeLayer(drawnItemsRef.current);
        drawnItemsRef.current = null;
      }
    };
  }, [isSelectionMode, map, onPropertySelection, properties]);

  return null;
}

// Function to find properties within a drawn shape
function findPropertiesInShape(
  layer: L.Layer,
  properties: PropertyInfo[],
): string[] {
  const selectedGeocodes: string[] = [];

  properties.forEach((property) => {
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

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

// Group Formatting Toolbar Component
interface GroupToolbarProps {
  selectedGeocodes: string[];
  markerFormats: Record<string, MarkerFormat>;
  onBatchFormatChange: (
    geocodes: string[],
    formatUpdates: Partial<MarkerFormat>,
  ) => void;
  onCreateGroupLabel: (lat: number, lng: number) => void;
  properties: PropertyInfo[];
  onClose: () => void;
}

function GroupToolbar({
  selectedGeocodes,
  markerFormats,
  onBatchFormatChange,
  onCreateGroupLabel,
  properties,
  onClose,
}: GroupToolbarProps) {
  const [activePanel, setActivePanel] = useState<
    "icon" | "color" | "note" | null
  >(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const toolbarStartPos = useRef<{ x: number; y: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Load position from localStorage or calculate initial center
  useEffect(() => {
    const savedPos = localStorage.getItem("groupToolbarPos");
    if (savedPos) {
      try {
        const parsed = JSON.parse(savedPos);
        // Validate position is within viewport
        if (
          parsed.x >= 0 &&
          parsed.y >= 0 &&
          parsed.x < window.innerWidth - 100 &&
          parsed.y < window.innerHeight - 100
        ) {
          setPosition(parsed);
          return;
        }
      } catch (e) {
        // Invalid saved position, fall through to calculate center
      }
    }

    // Calculate initial center position over map container
    const mapContainer = document.querySelector(".leaflet-container");
    if (mapContainer) {
      const rect = mapContainer.getBoundingClientRect();
      const toolbarWidth = 288; // w-72 = 18rem = 288px
      const toolbarHeight = 300; // Approximate height
      setPosition({
        x: rect.left + (rect.width - toolbarWidth) / 2,
        y: rect.top + (rect.height - toolbarHeight) / 2,
      });
    } else {
      // Fallback to window center
      setPosition({
        x: (window.innerWidth - 288) / 2,
        y: (window.innerHeight - 300) / 2,
      });
    }
  }, []);

  // Save position to localStorage whenever it changes
  useEffect(() => {
    if (position) {
      localStorage.setItem("groupToolbarPos", JSON.stringify(position));
    }
  }, [position]);

  // Calculate centroid of selected markers
  const calculateCentroid = () => {
    const selectedProperties = properties.filter((p) =>
      selectedGeocodes.includes(p.geocode),
    );
    if (selectedProperties.length === 0) return { lat: 0, lng: 0 };

    const avgLat =
      selectedProperties.reduce((sum, p) => sum + (p.lat || 0), 0) /
      selectedProperties.length;
    const avgLng =
      selectedProperties.reduce((sum, p) => sum + (p.lng || 0), 0) /
      selectedProperties.length;

    return { lat: avgLat, lng: avgLng };
  };

  const handleIconSelect = (iconId: string) => {
    onBatchFormatChange(selectedGeocodes, { icon: iconId });
    setActivePanel(null);
  };

  const handleColorSelect = (colorValue: string) => {
    onBatchFormatChange(selectedGeocodes, { color: colorValue });
    setActivePanel(null);
  };

  const saveNoteChange = () => {
    if (noteDraft.trim()) {
      onBatchFormatChange(selectedGeocodes, { note: noteDraft.trim() });
      setNoteDraft("");
      setActivePanel(null);
    }
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveNoteChange();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setNoteDraft("");
      setActivePanel(null);
    }
  };

  const handleCreateGroupLabel = () => {
    const centroid = calculateCentroid();
    onCreateGroupLabel(centroid.lat, centroid.lng);
  };

  const togglePanel = (panel: "icon" | "color" | "note") => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  // Dragging handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag from header, not from buttons
    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.closest("button") ||
      target.tagName === "TEXTAREA" ||
      target.closest("textarea")
    ) {
      return;
    }

    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    toolbarStartPos.current = position || { x: 0, y: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartPos.current || !toolbarStartPos.current)
      return;

    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;

    const newX = toolbarStartPos.current.x + dx;
    const newY = toolbarStartPos.current.y + dy;

    // Constrain within viewport (with some margin)
    const toolbarWidth = toolbarRef.current?.offsetWidth || 288;
    const toolbarHeight = toolbarRef.current?.offsetHeight || 300;
    const margin = 20;

    const constrainedX = Math.max(
      margin,
      Math.min(newX, window.innerWidth - toolbarWidth - margin),
    );
    const constrainedY = Math.max(
      margin,
      Math.min(newY, window.innerHeight - toolbarHeight - margin),
    );

    setPosition({ x: constrainedX, y: constrainedY });
    e.stopPropagation();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    dragStartPos.current = null;
    toolbarStartPos.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    e.stopPropagation();
  };

  // Close toolbar on Esc key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activePanel === null) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [activePanel, onClose]);

  if (!position) return null;

  const toolbarContent = (
    <div
      ref={toolbarRef}
      className="fixed z-[9999] w-72 bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-3"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? "grabbing" : "default",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      data-testid="group-toolbar"
    >
      {/* Header - Drag Handle */}
      <div
        className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700 cursor-grab active:cursor-grabbing"
        aria-grabbed={isDragging}
      >
        <Edit2 className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-semibold text-white">Group Format</span>
        <Badge
          variant="secondary"
          className="bg-green-800 text-green-100 text-xs"
        >
          {selectedGeocodes.length} Selected
        </Badge>
      </div>

      {/* Toolbar Buttons */}
      <div className="flex gap-1 mb-2">
        <Button
          onClick={() => togglePanel("icon")}
          variant={activePanel === "icon" ? "default" : "outline"}
          size="sm"
          className="flex-1 text-xs"
          data-testid="button-group-icon-picker"
        >
          <MapPin className="h-3 w-3 mr-1" />
          Icon
        </Button>
        <Button
          onClick={() => togglePanel("color")}
          variant={activePanel === "color" ? "default" : "outline"}
          size="sm"
          className="flex-1 text-xs"
          data-testid="button-group-color-picker"
        >
          <Palette className="h-3 w-3 mr-1" />
          Color
        </Button>
        <Button
          onClick={() => togglePanel("note")}
          variant={activePanel === "note" ? "default" : "outline"}
          size="sm"
          className="flex-1 text-xs"
          data-testid="button-group-note-editor"
        >
          <Tag className="h-3 w-3 mr-1" />
          Note
        </Button>
      </div>

      {/* Create Group Label Button */}
      <div className="mb-2">
        <Button
          onClick={handleCreateGroupLabel}
          variant="secondary"
          size="sm"
          className="w-full text-xs"
          data-testid="button-create-group-label"
        >
          <Tag className="h-3 w-3 mr-1" />
          Create Label
        </Button>
      </div>

      {/* Icon Picker Panel */}
      {activePanel === "icon" && (
        <div
          className="grid grid-cols-3 gap-1 p-2 bg-gray-800 rounded border border-gray-600 mb-2"
          data-testid="panel-group-icon-picker"
        >
          {ICON_OPTIONS.map((iconOption) => {
            const IconComponent = iconOption.icon;
            return (
              <button
                key={iconOption.id}
                onClick={() => handleIconSelect(iconOption.id)}
                className="p-2 rounded border bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200 text-center transition-colors"
                data-testid={`group-icon-option-${iconOption.id}`}
              >
                <IconComponent className="h-4 w-4 mx-auto" />
                <div className="text-xs mt-1">{iconOption.name}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Color Picker Panel */}
      {activePanel === "color" && (
        <div
          className="flex gap-1 p-2 bg-gray-800 rounded flex-wrap border border-gray-600 mb-2"
          data-testid="panel-group-color-picker"
        >
          {COLOR_OPTIONS.map((colorOption) => (
            <button
              key={colorOption.id}
              onClick={() => handleColorSelect(colorOption.value)}
              className="w-8 h-8 rounded-full border-2 border-gray-500 transition-transform hover:scale-110"
              style={{ backgroundColor: colorOption.value }}
              title={colorOption.name}
              data-testid={`group-color-option-${colorOption.id}`}
            />
          ))}
        </div>
      )}

      {/* Note Editor Panel */}
      {activePanel === "note" && (
        <div
          className="p-2 bg-gray-800 rounded border border-gray-600"
          data-testid="panel-group-note-editor"
        >
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={handleNoteKeyDown}
            placeholder="Enter note for all selected markers..."
            className="w-full text-sm bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:ring-primary focus:border-primary rounded px-2 py-1 min-h-[60px] resize-none"
            data-testid="textarea-group-note"
            autoFocus
          />
          <div className="flex gap-1 mt-2">
            <Button
              onClick={saveNoteChange}
              size="sm"
              className="flex-1 text-xs"
              data-testid="button-apply-group-note"
            >
              Apply
            </Button>
            <Button
              onClick={() => {
                setNoteDraft("");
                setActivePanel(null);
              }}
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              data-testid="button-cancel-group-note"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // Render via portal at end of body for proper z-index layering
  return createPortal(toolbarContent, document.body);
}

// Formatting Toolbar Component
interface FormattingToolbarProps {
  geocode: string;
  currentFormat: MarkerFormat;
  onFormatChange: (geocode: string, format: MarkerFormat) => void;
  lat: number;
  lng: number;
  onCreateLabel?: (lat: number, lng: number) => void;
}

function FormattingToolbar({
  geocode,
  currentFormat,
  onFormatChange,
  lat,
  lng,
  onCreateLabel,
}: FormattingToolbarProps) {
  const [activePanel, setActivePanel] = useState<
    "icon" | "color" | "note" | null
  >(null);
  const [noteDraft, setNoteDraft] = useState(currentFormat.note || "");

  // Initialize draft from current marker note when opening note panel
  useEffect(() => {
    if (activePanel === "note") {
      setNoteDraft(currentFormat.note || "");
    }
  }, [activePanel, currentFormat.note]);

  const handleIconSelect = (iconId: string) => {
    onFormatChange(geocode, { ...currentFormat, icon: iconId });
    setActivePanel(null);
  };

  const handleColorSelect = (colorValue: string) => {
    onFormatChange(geocode, { ...currentFormat, color: colorValue });
    setActivePanel(null);
  };

  const saveNoteChange = () => {
    onFormatChange(geocode, { ...currentFormat, note: noteDraft });
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      saveNoteChange();
      e.currentTarget.blur();
    }
  };

  const togglePanel = (panel: "icon" | "color" | "note") => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  return (
    <div className="mt-2 mb-2 border-t border-b border-gray-600 py-2">
      {/* Toolbar Buttons */}
      <div className="flex gap-1 mb-2">
        <Button
          onClick={() => togglePanel("icon")}
          variant={activePanel === "icon" ? "default" : "outline"}
          size="sm"
          className="flex-1 text-xs"
          data-testid={`button-icon-picker-${geocode}`}
        >
          <MapPin className="h-3 w-3 mr-1" />
          Icon
        </Button>
        <Button
          onClick={() => togglePanel("color")}
          variant={activePanel === "color" ? "default" : "outline"}
          size="sm"
          className="flex-1 text-xs"
          data-testid={`button-color-picker-${geocode}`}
        >
          <Palette className="h-3 w-3 mr-1" />
          Color
        </Button>
        <Button
          onClick={() => togglePanel("note")}
          variant={activePanel === "note" ? "default" : "outline"}
          size="sm"
          className="flex-1 text-xs"
          data-testid={`button-note-editor-${geocode}`}
        >
          <Tag className="h-3 w-3 mr-1" />
          Note
        </Button>
      </div>

      {/* Create Label Button */}
      {onCreateLabel && (
        <div className="mt-2">
          <Button
            onClick={() => {
              onCreateLabel(lat, lng);
              setActivePanel(null);
            }}
            variant="secondary"
            size="sm"
            className="w-full text-xs"
            data-testid={`button-create-label-${geocode}`}
          >
            <Tag className="h-3 w-3 mr-1" />
            Create Label
          </Button>
        </div>
      )}

      {/* Icon Picker Panel */}
      {activePanel === "icon" && (
        <div
          className="grid grid-cols-3 gap-1 p-2 bg-gray-800 rounded border border-gray-600"
          data-testid={`panel-icon-picker-${geocode}`}
        >
          {ICON_OPTIONS.map((iconOption) => {
            const IconComponent = iconOption.icon;
            const isSelected = currentFormat.icon === iconOption.id;
            return (
              <button
                key={iconOption.id}
                onClick={() => handleIconSelect(iconOption.id)}
                className={`p-2 rounded border text-center transition-colors ${
                  isSelected
                    ? "bg-primary text-white border-primary"
                    : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200"
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
      {activePanel === "color" && (
        <div
          className="flex gap-1 p-2 bg-gray-800 rounded flex-wrap border border-gray-600"
          data-testid={`panel-color-picker-${geocode}`}
        >
          {COLOR_OPTIONS.map((colorOption) => {
            const isSelected = currentFormat.color === colorOption.value;
            return (
              <button
                key={colorOption.id}
                onClick={() => handleColorSelect(colorOption.value)}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                  isSelected ? "border-white scale-110" : "border-gray-500"
                }`}
                style={{ backgroundColor: colorOption.value }}
                title={colorOption.name}
                data-testid={`color-option-${colorOption.id}-${geocode}`}
              />
            );
          })}
        </div>
      )}

      {/* Note Editor Panel */}
      {activePanel === "note" && (
        <div
          className="p-2 bg-gray-800 rounded border border-gray-600"
          data-testid={`panel-note-editor-${geocode}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Input
            type="text"
            placeholder="Enter note..."
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={saveNoteChange}
            onKeyDown={handleNoteKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="text-sm bg-gray-900 border-gray-600 text-white placeholder:text-gray-400 focus:ring-primary focus:border-primary"
            data-testid={`input-note-${geocode}`}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

// Draggable Label Component for Map Annotations
interface DraggableLabelProps {
  label: MapLabel;
  onUpdate: (id: string, updates: Partial<MapLabel>) => void;
  onDelete: (id: string) => void;
}

function DraggableLabel({ label, onUpdate, onDelete }: DraggableLabelProps) {
  const map = useMap();
  const [isEditing, setIsEditing] = useState(label.text === "");
  const [textDraft, setTextDraft] = useState(label.text);
  const [position, setPosition] = useState<L.Point | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const labelStartLatLng = useRef<{ lat: number; lng: number } | null>(null);

  // Convert lat/lng to pixel position for rendering
  useEffect(() => {
    if (!map) return;

    const updatePosition = () => {
      const point = map.latLngToContainerPoint([label.lat, label.lng]);
      setPosition(point);
    };

    updatePosition();
    map.on("move", updatePosition);
    map.on("zoom", updatePosition);

    return () => {
      map.off("move", updatePosition);
      map.off("zoom", updatePosition);
    };
  }, [map, label.lat, label.lng]);

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setTextDraft(label.text);
    }
  }, [isEditing, label.text]);

  const handleSave = () => {
    if (textDraft.trim()) {
      onUpdate(label.id, { text: textDraft.trim() });
      setIsEditing(false);
    } else {
      // Delete empty labels
      onDelete(label.id);
    }
  };

  const handleCancel = () => {
    if (label.text === "") {
      // Delete if it was never saved
      onDelete(label.id);
    } else {
      setTextDraft(label.text);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  // Custom drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;

    e.stopPropagation();
    e.preventDefault();

    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    labelStartLatLng.current = { lat: label.lat, lng: label.lng };
  };

  useEffect(() => {
    if (!isDragging || !map) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartPos.current || !labelStartLatLng.current) return;

      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;

      // Convert original lat/lng to container point
      const startPoint = map.latLngToContainerPoint([
        labelStartLatLng.current.lat,
        labelStartLatLng.current.lng,
      ]);

      // Add delta to get new container point
      const newPoint = new L.Point(
        startPoint.x + deltaX,
        startPoint.y + deltaY,
      );

      // Convert back to lat/lng
      const newLatLng = map.containerPointToLatLng(newPoint);

      // Update label position
      onUpdate(label.id, { lat: newLatLng.lat, lng: newLatLng.lng });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartPos.current = null;
      labelStartLatLng.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, map, label.id, onUpdate]);

  if (!position) return null;

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
  };

  const sizeClass = sizeClasses[label.size || "md"];
  const color = label.color || "#ffffff";

  return (
    <>
      {/* Visual label overlay - absolutely positioned and draggable */}
      <div
        style={{
          position: "absolute",
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: "translate(-50%, -50%)",
          zIndex: 1000,
          pointerEvents: "auto",
        }}
        className="label-overlay-container"
        data-testid={`map-label-${label.id}`}
      >
        {isEditing ? (
          <div
            className={`flex items-center gap-1 bg-gray-900 border border-gray-600 rounded shadow-lg ${sizeClass}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              type="text"
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              placeholder="Enter label..."
              className="text-sm bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-primary focus:border-primary min-w-[120px]"
              data-testid={`input-label-text-${label.id}`}
              autoFocus
            />
          </div>
        ) : (
          <div
            className={`group relative flex items-center gap-1 rounded shadow-lg ${isDragging ? "cursor-grabbing" : "cursor-grab"} ${sizeClass} bg-gray-900 border border-gray-600 select-none`}
            style={{ color }}
            onClick={(e) => {
              e.stopPropagation();
              if (e.detail === 2 && !isDragging) {
                // Double-click to edit
                setIsEditing(true);
              }
            }}
            onMouseDown={handleMouseDown}
            data-testid={`label-display-${label.id}`}
          >
            <span className="font-medium" style={{ color }}>
              {label.text}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete(label.id);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-gray-400 hover:text-red-400"
              aria-label="Delete label"
              data-testid={`button-delete-label-${label.id}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function BasemapSelector({
  selectedBasemap,
  onBasemapChange,
}: {
  selectedBasemap: string;
  onBasemapChange: (basemapId: string) => void;
}) {
  const currentBasemap =
    BASEMAP_OPTIONS.find((option) => option.id === selectedBasemap) ||
    BASEMAP_OPTIONS[0];

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
                      ? "bg-primary border-primary"
                      : "border-gray-400"
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
      style={{ position: "absolute", top: "72px", right: "16px", zIndex: 9999 }}
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
  onBasemapChange,
}: {
  selectedBasemap: string;
  onBasemapChange: (basemapId: string) => void;
}) {
  return (
    <div
      className="absolute top-4 right-4 z-[9999]"
      style={{ position: "absolute", top: "16px", right: "16px", zIndex: 9999 }}
    >
      <BasemapSelector
        selectedBasemap={selectedBasemap}
        onBasemapChange={onBasemapChange}
      />
    </div>
  );
}

// LocalStorage key for marker formats
const MARKER_FORMATS_STORAGE_KEY = "map-marker-formats";
const MAP_LABELS_STORAGE_KEY = "map-labels";

// Helper to load marker formats from localStorage
const loadMarkerFormatsFromStorage = (): Record<string, MarkerFormat> => {
  if (typeof window === "undefined") return {};

  try {
    const saved = localStorage.getItem(MARKER_FORMATS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Failed to load marker formats from localStorage:", error);
  }
  return {};
};

// Helper to save marker formats to localStorage
const saveMarkerFormatsToStorage = (formats: Record<string, MarkerFormat>) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(MARKER_FORMATS_STORAGE_KEY, JSON.stringify(formats));
  } catch (error) {
    console.error("Failed to save marker formats to localStorage:", error);
  }
};

// Helper to load labels from localStorage
const loadLabelsFromStorage = (): MapLabel[] => {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem(MAP_LABELS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Failed to load map labels from localStorage:", error);
  }
  return [];
};

// Helper to save labels to localStorage
const saveLabelsToStorage = (labels: MapLabel[]) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(MAP_LABELS_STORAGE_KEY, JSON.stringify(labels));
  } catch (error) {
    console.error("Failed to save map labels to localStorage:", error);
  }
};

export const PropertyMap = memo(function PropertyMap({
  properties,
  selectedGeocodes = [],
  isSelectionMode = false,
  onPropertySelection,
  selectedPropertyGeocodes = [],
  onDeleteProperty,
  isGroupToolbarOpen = false,
  onCloseGroupToolbar,
  onMarkerClick,
}: PropertyMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  // Marker formatting state - stores custom icon, color, and note per geocode
  // Initialize from localStorage to persist across map size toggles and page reloads
  const [markerFormats, setMarkerFormats] = useState<
    Record<string, MarkerFormat>
  >(() => {
    return loadMarkerFormatsFromStorage();
  });

  // Persist marker formats to localStorage whenever they change
  useEffect(() => {
    saveMarkerFormatsToStorage(markerFormats);
  }, [markerFormats]);

  // Map labels state - stores draggable text annotations
  const [mapLabels, setMapLabels] = useState<MapLabel[]>(() => {
    return loadLabelsFromStorage();
  });

  // Persist labels to localStorage whenever they change
  useEffect(() => {
    saveLabelsToStorage(mapLabels);
  }, [mapLabels]);

  // Basemap state management with localStorage persistence
  const [selectedBasemap, setSelectedBasemap] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("map-basemap-preference");
      if (saved && BASEMAP_OPTIONS.find((option) => option.id === saved)) {
        return saved;
      }
    }
    return DEFAULT_BASEMAP;
  });

  // Handler to update marker formatting
  const handleFormatChange = (geocode: string, format: MarkerFormat) => {
    setMarkerFormats((prev) => {
      const updated = {
        ...prev,
        [geocode]: format,
      };
      // Save to localStorage immediately for real-time persistence
      saveMarkerFormatsToStorage(updated);
      return updated;
    });
  };

  // Handler for batch formatting (group edit)
  const handleBatchFormatChange = (
    geocodes: string[],
    formatUpdates: Partial<MarkerFormat>,
  ) => {
    setMarkerFormats((prev) => {
      const updated = { ...prev };
      geocodes.forEach((geocode) => {
        updated[geocode] = {
          ...updated[geocode],
          ...formatUpdates,
        };
      });
      // Save to localStorage immediately for real-time persistence
      saveMarkerFormatsToStorage(updated);
      return updated;
    });
  };

  // Handler to create a new label
  const handleCreateLabel = (lat: number, lng: number) => {
    const newLabel: MapLabel = {
      id: `label-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: "",
      lat,
      lng,
      size: "md",
    };
    setMapLabels((prev) => [...prev, newLabel]);
  };

  // Handler to update a label
  const handleUpdateLabel = (id: string, updates: Partial<MapLabel>) => {
    setMapLabels((prev) =>
      prev.map((label) => (label.id === id ? { ...label, ...updates } : label)),
    );
  };

  // Handler to delete a label
  const handleDeleteLabel = (id: string) => {
    setMapLabels((prev) => prev.filter((label) => label.id !== id));
  };

  // Persist basemap selection to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("map-basemap-preference", selectedBasemap);
    }
  }, [selectedBasemap]);

  // Get current basemap configuration
  const currentBasemap = useMemo(() => {
    return (
      BASEMAP_OPTIONS.find((option) => option.id === selectedBasemap) ||
      BASEMAP_OPTIONS[0]
    );
  }, [selectedBasemap]);

  // Memoized processing of properties with single color and performance optimizations
  const propertiesWithColors: PropertyWithColor[] = useMemo(() => {
    const validProperties = properties.filter((p) => p.lat && p.lng);

    // Limit visible properties for performance
    const limitedProperties = validProperties.slice(0, MAX_VISIBLE_PROPERTIES);

    return limitedProperties.map((property, index) => ({
      ...property,
      color: PROPERTY_COLOR, // All properties use the same blue color
      colorIndex: index,
    }));
  }, [properties]);

  // Helper function to get Lucide icon component based on selected icon type
  const getLucideIcon = (iconId?: string): LucideIcon => {
    switch (iconId) {
      case "home":
        return Home;
      case "building":
        return Building;
      case "flag":
        return Flag;
      case "star":
        return Star;
      case "heart":
        return Heart;
      default:
        return Circle; // Default to Circle
    }
  };

  // Helper function to create custom marker icon with Lucide icons
  const createCustomIcon = (
    geocode: string,
    baseColor: string,
    size: number,
    isSelected: boolean,
    isDimmed: boolean,
  ) => {
    const format = markerFormats[geocode] || {};
    const markerColor = isSelected ? SELECTED_COLOR : format.color || baseColor;
    const opacity = isDimmed ? UNSELECTED_OPACITY : 1;

    // Get the appropriate Lucide icon component
    const IconComponent = getLucideIcon(format.icon);

    // Render the Lucide icon to SVG string
    const iconSvg = renderToString(
      <IconComponent
        size={size}
        color={markerColor}
        fill={markerColor}
        strokeWidth={2.5}
        style={{
          filter:
            "drop-shadow(0 0 2px white) drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
          opacity: opacity,
        }}
      />,
    );

    // Add pulse animation for selected markers
    const animationClass = "";

    return L.divIcon({
      className: `custom-marker-${geocode} ${animationClass}`,
      html: `
        <div style="display: flex; align-items: center; justify-content: center;">
          ${iconSvg}
        </div>
      `,
      iconSize: [size + 10, size + 10],
      iconAnchor: [(size + 10) / 2, (size + 10) / 2],
    });
  };

  // Memoized center point calculation for initial map positioning
  const { centerLat, centerLng } = useMemo(() => {
    if (propertiesWithColors.length === 0) {
      return { centerLat: 45.7833, centerLng: -110.5 }; // Montana center as fallback
    }

    const totalLat = propertiesWithColors.reduce(
      (sum, p) => sum + (p.lat || 0),
      0,
    );
    const totalLng = propertiesWithColors.reduce(
      (sum, p) => sum + (p.lng || 0),
      0,
    );

    return {
      centerLat: totalLat / propertiesWithColors.length,
      centerLng: totalLng / propertiesWithColors.length,
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
        aria-label={`Interactive map showing ${propertiesWithColors.length} ${propertiesWithColors.length === 1 ? "property" : "properties"}`}
        data-testid="map-container"
        className="h-full overflow-visible"
      >
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={propertiesWithColors.length === 1 ? 15 : 10}
          className="w-full h-full rounded-lg border border-gray-600 leaflet-dark-theme"
          style={{ minHeight: "320px" }}
          zoomControl={false}
          ref={mapRef}
        >
          <TileLayer
            key={currentBasemap.id}
            attribution={currentBasemap.attribution}
            url={currentBasemap.url}
            subdomains={["a", "b", "c", "d"]}
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
            const isSelected = selectedGeocodes.includes(property.geocode);
            const isAnySelected = selectedGeocodes.length > 0;
            const shouldBeDimmed = isAnySelected && !isSelected;

            // Check if property is in the current selection group
            const isInSelectionGroup = selectedPropertyGeocodes.includes(
              property.geocode,
            );
            const isSelectionActive = selectedPropertyGeocodes.length > 0;
            const shouldBeDimmedBySelection =
              isSelectionActive && !isInSelectionGroup;

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
              polygonColor = SELECTED_COLOR;
              weight = 3;
              fillOpacity = 0.2;
            } else if (isInSelectionGroup) {
              // Property is in the current selection group
              polygonColor = SELECTED_COLOR;
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
              markerIcon = createCustomIcon(
                property.geocode,
                SELECTED_COLOR,
                20,
                true,
                false,
              );
            } else if (isInSelectionGroup) {
              iconSize = 22;
              iconBaseColor = "#4CAF50";
              markerIcon = createCustomIcon(
                property.geocode,
                iconBaseColor,
                iconSize,
                true,
                false,
              );
            } else if (shouldBeDimmed || shouldBeDimmedBySelection) {
              iconSize = 16;
              markerIcon = createCustomIcon(
                property.geocode,
                iconBaseColor,
                iconSize,
                false,
                true,
              );
            } else {
              markerIcon = createCustomIcon(
                property.geocode,
                iconBaseColor,
                iconSize,
                false,
                false,
              );
            }

            // Include format in key to force re-render when format changes
            const formatKey = markerFormats[property.geocode]
              ? `${markerFormats[property.geocode].icon || "default"}-${markerFormats[property.geocode].color || "default"}-${markerFormats[property.geocode].note || "none"}`
              : "no-format";

            return (
              <div
                key={`property-${property.geocode}-${property.colorIndex}-${formatKey}`}
              >
                {/* Render parcel polygon if geometry is available */}
                {property.parcelGeometry?.coordinates && (
                  <Polygon
                    positions={property.parcelGeometry.coordinates[0].map(
                      ([lng, lat]) => [lat, lng] as [number, number],
                    )}
                    pathOptions={{
                      color: polygonColor,
                      weight: weight,
                      opacity: polygonOpacity,
                      fillColor: polygonColor,
                      fillOpacity: fillOpacity,
                    }}
                  >
                    <Popup className="dark-popup">
                      <div className="text-on-surface font-sans">
                        <strong className="text-primary block mb-1">
                          {isSelected
                            ? "📍 Selected Property Parcel"
                            : "Property Parcel"}
                        </strong>
                        <div className="text-sm font-medium mb-1">
                          {property.geocode}
                        </div>
                        <span className="text-sm text-on-surface-variant">
                          {property.address}
                        </span>
                        {markerFormats[property.geocode]?.note && (
                          <div className="mt-2 p-2 bg-gray-800 border border-gray-600 rounded text-sm">
                            <strong className="text-white">Note:</strong>{" "}
                            <span className="text-gray-200">
                              {markerFormats[property.geocode].note}
                            </span>
                          </div>
                        )}

                        {/* Formatting Toolbar */}
                        <FormattingToolbar
                          geocode={property.geocode}
                          currentFormat={markerFormats[property.geocode] || {}}
                          onFormatChange={handleFormatChange}
                          lat={property.lat || 0}
                          lng={property.lng || 0}
                          onCreateLabel={handleCreateLabel}
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
                    eventHandlers={{
                      click: () => {
                        if (onMarkerClick) {
                          onMarkerClick(property.geocode);
                        }
                      },
                    }}
                  >
                    <Popup className="dark-popup">
                      <div className="text-on-surface font-sans">
                        <strong className="text-primary block mb-1">
                          {isSelected
                            ? "📍 Selected Property Center"
                            : "Property Center"}
                        </strong>
                        <div className="text-sm font-medium mb-1">
                          {property.geocode}
                        </div>
                        <span className="text-sm text-on-surface-variant">
                          {property.address}
                        </span>
                        {markerFormats[property.geocode]?.note && (
                          <div className="mt-2 p-2 bg-gray-800 border border-gray-600 rounded text-sm">
                            <strong className="text-white">Note:</strong>{" "}
                            <span className="text-gray-200">
                              {markerFormats[property.geocode].note}
                            </span>
                          </div>
                        )}

                        {/* Formatting Toolbar */}
                        <FormattingToolbar
                          geocode={property.geocode}
                          currentFormat={markerFormats[property.geocode] || {}}
                          onFormatChange={handleFormatChange}
                          lat={property.lat || 0}
                          lng={property.lng || 0}
                          onCreateLabel={handleCreateLabel}
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

          {/* Render map labels */}
          {mapLabels.map((label) => (
            <DraggableLabel
              key={label.id}
              label={label}
              onUpdate={handleUpdateLabel}
              onDelete={handleDeleteLabel}
            />
          ))}

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

      {/* Group Toolbar for batch formatting */}
      {isGroupToolbarOpen &&
        selectedPropertyGeocodes.length > 0 &&
        onCloseGroupToolbar && (
          <GroupToolbar
            selectedGeocodes={selectedPropertyGeocodes}
            markerFormats={markerFormats}
            onBatchFormatChange={handleBatchFormatChange}
            onCreateGroupLabel={handleCreateLabel}
            properties={properties}
            onClose={onCloseGroupToolbar}
          />
        )}
    </div>
  );
});

// Set display name for debugging
PropertyMap.displayName = "PropertyMap";
