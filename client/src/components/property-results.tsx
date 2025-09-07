import { PropertyInfo } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PropertyMap } from "./property-map";
import { Copy, ExternalLink, CheckCircle } from "lucide-react";
import { useState } from "react";

interface PropertyResultsProps {
  property: PropertyInfo;
  onCopyAddress: (address: string) => void;
  onOpenInMaps: (address: string) => void;
}

export function PropertyResults({ property, onCopyAddress, onOpenInMaps }: PropertyResultsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(property.address);
      setCopied(true);
      onCopyAddress(property.address);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = property.address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      onCopyAddress(property.address);
    }
  };

  const handleOpenInMaps = () => {
    const encodedAddress = encodeURIComponent(property.address);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    onOpenInMaps(property.address);
  };

  return (
    <section className="fade-in" aria-labelledby="results-heading">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Property Information Card */}
        <Card className="bg-surface border-gray-700 shadow-lg">
          <CardHeader>
            <CardTitle 
              id="results-heading" 
              className="text-xl font-semibold text-on-surface flex items-center space-x-2"
            >
              <span className="w-5 h-5 bg-green-500 rounded-full"></span>
              <span>Property Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-l-4 border-primary pl-4">
              <h4 className="text-sm font-medium text-on-surface-variant uppercase tracking-wide">
                Physical Address
              </h4>
              <p className="text-lg text-on-surface mt-1" data-testid="text-address">
                {property.address}
              </p>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-on-surface-variant uppercase tracking-wide">
                  Geocode
                </h4>
                <p className="text-lg text-on-surface mt-1 font-mono" data-testid="text-geocode">
                  {property.geocode}
                </p>
              </div>
              {property.county && (
                <div>
                  <h4 className="text-sm font-medium text-on-surface-variant uppercase tracking-wide">
                    County
                  </h4>
                  <p className="text-lg text-on-surface mt-1" data-testid="text-county">
                    {property.county}
                  </p>
                </div>
              )}
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {property.coordinates && (
                <div>
                  <h4 className="text-sm font-medium text-on-surface-variant uppercase tracking-wide">
                    Coordinates
                  </h4>
                  <p className="text-sm text-on-surface-variant mt-1 font-mono" data-testid="text-coordinates">
                    {property.coordinates}
                  </p>
                </div>
              )}
              {property.legalDescription && (
                <div>
                  <h4 className="text-sm font-medium text-on-surface-variant uppercase tracking-wide">
                    Legal Description
                  </h4>
                  <p className="text-sm text-on-surface-variant mt-1" data-testid="text-legal-description">
                    {property.legalDescription}
                  </p>
                </div>
              )}
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-700 flex flex-wrap gap-3">
              <Button
                onClick={handleCopyAddress}
                variant="secondary"
                className="bg-surface-variant hover:bg-gray-600 text-on-surface px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center space-x-2"
                data-testid="button-copy-address"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Address</span>
                  </>
                )}
              </Button>
              <Button
                onClick={handleOpenInMaps}
                variant="secondary"
                className="bg-surface-variant hover:bg-gray-600 text-on-surface px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center space-x-2"
                data-testid="button-open-maps"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Open in Maps</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Map Section */}
        <Card className="bg-surface border-gray-700 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-on-surface flex items-center space-x-2">
              <span className="w-5 h-5 bg-primary rounded-full"></span>
              <span>Property Location</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {property.lat && property.lng ? (
              <PropertyMap 
                properties={[property]}
              />
            ) : (
              <div className="w-full h-80 bg-surface-variant rounded-lg border border-gray-600 flex items-center justify-center">
                <p className="text-on-surface-variant text-center">
                  Map unavailable - coordinates not found for this property
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
