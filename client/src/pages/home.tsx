import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PropertySearchForm } from "@/components/property-search-form";
import { PropertyResults } from "@/components/property-results";
import { ToastNotification } from "@/components/toast-notification";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { lookupProperty } from "@/lib/geocoding";
import { PropertyInfo, ApiResponse } from "@shared/schema";
import { AlertCircle, RotateCcw, HelpCircle } from "lucide-react";

interface ToastState {
  show: boolean;
  message: string;
  type: "success" | "error" | "info";
}

export default function Home() {
  const [propertyData, setPropertyData] = useState<PropertyInfo | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "info" });

  const searchMutation = useMutation({
    mutationFn: lookupProperty,
    onSuccess: (response: ApiResponse) => {
      console.log('API Response received:', response);
      if (response.success && response.data) {
        console.log('Setting property data:', response.data);
        setPropertyData(response.data);
        setErrorState(null);
        showToast("Property information loaded successfully!", "success");
      } else {
        setPropertyData(null);
        setErrorState(response.error || "Failed to load property information");
      }
    },
    onError: (error: Error) => {
      setPropertyData(null);
      setErrorState(error.message);
    }
  });

  const showToast = (message: string, type: ToastState["type"]) => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast({ show: false, message: "", type: "info" });
  };

  const handleSearch = (geocode: string) => {
    searchMutation.mutate(geocode);
  };

  const handleCopyAddress = (address: string) => {
    showToast("Address copied to clipboard!", "success");
  };

  const handleOpenInMaps = (address: string) => {
    showToast("Opening location in maps...", "info");
  };

  const handleTryAgain = () => {
    setErrorState(null);
    setPropertyData(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-on-surface font-sans">
      {/* Header */}
      <header className="bg-surface border-b border-gray-700" role="banner">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">MT</span>
              </div>
              <h1 className="text-xl font-semibold text-on-surface">
                Montana Property Lookup
              </h1>
            </div>
            <nav role="navigation" aria-label="Main navigation">
              <Button 
                variant="ghost"
                className="text-on-surface-variant hover:text-on-surface transition-colors duration-200 px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-900"
                aria-label="Help and information"
                data-testid="button-help"
              >
                Help
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" role="main">
        {/* Search Section */}
        <div className="mb-8">
          <PropertySearchForm 
            onSearch={handleSearch} 
            isLoading={searchMutation.isPending}
          />
        </div>

        {/* Results Section */}
        {propertyData && !errorState && (
          <PropertyResults 
            property={propertyData}
            onCopyAddress={handleCopyAddress}
            onOpenInMaps={handleOpenInMaps}
          />
        )}

        {/* Error State */}
        {errorState && (
          <section className="fade-in mb-8" role="alert" aria-labelledby="error-heading">
            <Card className="bg-red-900/20 border-red-700">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5">
                    <AlertCircle className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 id="error-heading" className="text-lg font-semibold text-red-300 mb-2">
                      Property Not Found
                    </h3>
                    <p className="text-red-200 mb-4" data-testid="text-error-message">
                      {errorState}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={handleTryAgain}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center space-x-2"
                        data-testid="button-try-again"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Try Again</span>
                      </Button>
                      <Button
                        variant="secondary"
                        className="bg-red-900/40 hover:bg-red-800/40 text-red-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center space-x-2"
                        data-testid="button-get-help"
                      >
                        <HelpCircle className="h-4 w-4" />
                        <span>Get Help</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Help Section */}
        <section className="mt-12 bg-surface rounded-xl p-6 shadow-lg border border-gray-700" aria-labelledby="help-heading">
          <h3 id="help-heading" className="text-lg font-semibold text-on-surface mb-4">
            How to Use This Tool
          </h3>
          <div className="space-y-4 text-on-surface-variant">
            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">1</span>
              <p>Enter a valid Montana property geocode in the search field above. Geocodes typically contain numbers and hyphens.</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">2</span>
              <p>Click "Search Property" to retrieve the physical address and location information from the Montana cadastral database.</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">3</span>
              <p>View the property details and explore the interactive map to see the exact location of the property.</p>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-700">
            <h4 className="text-sm font-semibold text-on-surface mb-2">Need Help Finding a Geocode?</h4>
            <p className="text-sm text-on-surface-variant">
              Montana property geocodes can typically be found on property tax statements, deed documents, or by contacting your local county assessor's office.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-gray-700 mt-12" role="contentinfo">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <p className="text-sm text-on-surface-variant">
              Data provided by the Montana State Library Cadastral Mapping Service
            </p>
            <div className="flex space-x-6 text-sm">
              <Button 
                variant="ghost"
                className="text-on-surface-variant hover:text-on-surface transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-900"
                data-testid="button-privacy"
              >
                Privacy
              </Button>
              <Button 
                variant="ghost"
                className="text-on-surface-variant hover:text-on-surface transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-900"
                data-testid="button-terms"
              >
                Terms
              </Button>
              <Button 
                variant="ghost"
                className="text-on-surface-variant hover:text-on-surface transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-900"
                data-testid="button-contact"
              >
                Contact
              </Button>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Notifications */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50" aria-live="polite">
          <ToastNotification
            message={toast.message}
            type={toast.type}
            onClose={hideToast}
          />
        </div>
      )}
    </div>
  );
}
