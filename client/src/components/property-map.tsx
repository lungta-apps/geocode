import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface PropertyMapProps {
  lat: number;
  lng: number;
  address: string;
}

function MapController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView([lat, lng], 15);
  }, [map, lat, lng]);

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

export function PropertyMap({ lat, lng, address }: PropertyMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  // Custom marker icon for better visibility on dark theme
  const customIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div style="background-color: #F44336; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });

  return (
    <div className="relative">
      <div
        role="img"
        aria-label="Interactive map showing property location"
        data-testid="map-container"
      >
        <MapContainer
          center={[lat, lng]}
          zoom={15}
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
        <Marker position={[lat, lng]} icon={customIcon}>
          <Popup className="dark-popup">
            <div className="text-gray-900 font-sans">
              <strong className="text-primary block mb-1">Property Location</strong>
              <span className="text-sm">{address}</span>
            </div>
          </Popup>
        </Marker>
          <MapController lat={lat} lng={lng} />
          <ZoomControls />
        </MapContainer>
      </div>
      
      {/* Map Legend */}
      <div className="mt-4 flex items-center space-x-4 text-sm text-on-surface-variant">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full border border-white"></div>
          <span>Property Location</span>
        </div>
      </div>
    </div>
  );
}
