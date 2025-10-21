import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { PropertySearchForm } from "@/components/property-search-form";
import { PropertyResults } from "@/components/property-results";
import { PropertyMap } from "@/components/property-map";
import { ToastNotification } from "@/components/toast-notification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { lookupProperty } from "@/lib/geocoding";
import {
  PropertyInfo,
  ApiResponse,
  BatchApiResponse,
  BatchPropertyResult,
} from "@shared/schema";

// Enhanced types for master property collection
interface PropertyCollectionItem {
  property: PropertyInfo;
  source: {
    type: "single" | "batch";
    batchId?: string;
    timestamp: string;
    sourceGeocodes?: string[]; // For batch, list of all geocodes in that batch
  };
}

interface MasterPropertyCollection {
  properties: PropertyCollectionItem[];
  totalCount: number;
  lastUpdated: string;
}
import {
  AlertCircle,
  RotateCcw,
  HelpCircle,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  Loader2,
  Maximize2,
  X,
  Circle,
  Edit2,
} from "lucide-react";
import {
  batchResultsToCSV,
  downloadCSV,
  generateCsvFilename,
  getFailedGeocodes,
} from "@/lib/csv-utils";
import { apiRequest } from "@/lib/queryClient";

interface ToastState {
  show: boolean;
  message: string;
  type: "success" | "error" | "info";
}

export default function Home() {
  // Legacy state (keeping for backward compatibility during transition)
  const [propertyData, setPropertyData] = useState<PropertyInfo | null>(null);
  const [batchPropertyData, setBatchPropertyData] = useState<PropertyInfo[]>(
    [],
  );
  const [batchResults, setBatchResults] = useState<BatchApiResponse | null>(
    null,
  );

  // Master property collection state
  const [masterPropertyCollection, setMasterPropertyCollection] =
    useState<MasterPropertyCollection>({
      properties: [],
      totalCount: 0,
      lastUpdated: new Date().toISOString(),
    });

  // Map mode toggle state - "replace" is the default
  const [mapMode, setMapMode] = useState<"replace" | "add">("replace");

  // Other existing state
  const [errorState, setErrorState] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "info",
  });
  const [isShowingBatch, setIsShowingBatch] = useState(false);
  const [selectedGeocodes, setSelectedGeocodes] = useState<string[]>([]);
  const [retryingGeocodes, setRetryingGeocodes] = useState<Set<string>>(
    new Set(),
  );
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // Selection state for property grouping feature
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPropertyGeocodes, setSelectedPropertyGeocodes] = useState<
    string[]
  >([]);
  const [isGroupToolbarOpen, setIsGroupToolbarOpen] = useState(false);

  // Auto-close Group Toolbar when selection becomes empty
  useEffect(() => {
    if (selectedPropertyGeocodes.length === 0 && isGroupToolbarOpen) {
      setIsGroupToolbarOpen(false);
    }
  }, [selectedPropertyGeocodes.length, isGroupToolbarOpen]);

  // Helper functions for master property collection
  const addToMasterCollection = (
    properties: PropertyInfo[],
    source: PropertyCollectionItem["source"],
  ) => {
    const newItems: PropertyCollectionItem[] = properties.map((property) => ({
      property,
      source,
    }));

    setMasterPropertyCollection((prev) => ({
      properties:
        mapMode === "replace" ? newItems : [...prev.properties, ...newItems],
      totalCount:
        mapMode === "replace"
          ? newItems.length
          : prev.totalCount + newItems.length,
      lastUpdated: new Date().toISOString(),
    }));
  };

  const clearMasterCollection = () => {
    setMasterPropertyCollection({
      properties: [],
      totalCount: 0,
      lastUpdated: new Date().toISOString(),
    });
    setPropertyData(null);
    setBatchResults(null);
    setIsShowingBatch(false);
    setSelectedPropertyGeocodes([]);
    setIsSelectionMode(false);
    setErrorState(null);
  };

  // Derive map data from master collection
  const mapPropertyData = masterPropertyCollection.properties.map(
    (item) => item.property,
  );

  // Filter properties based on selection
  const filteredMapData =
    selectedPropertyGeocodes.length > 0
      ? mapPropertyData.filter((property) =>
          selectedPropertyGeocodes.includes(property.geocode),
        )
      : mapPropertyData;

  // Filter batch results based on selection
  const filteredBatchResults =
    selectedPropertyGeocodes.length > 0 && batchResults
      ? {
          ...batchResults,
          results: batchResults.results.filter((result) =>
            selectedPropertyGeocodes.includes(result.geocode),
          ),
        }
      : batchResults;

  const searchMutation = useMutation({
    mutationFn: lookupProperty,
    onSuccess: (response: ApiResponse) => {
      if (response.success && response.data) {
        setPropertyData(response.data);
        setErrorState(null);

        // Add to master collection
        addToMasterCollection([response.data], {
          type: "single",
          timestamp: new Date().toISOString(),
        });

        showToast("Property information loaded successfully!", "success");
      } else {
        setPropertyData(null);
        setErrorState(response.error || "Failed to load property information");
      }
    },
    onError: (error: Error) => {
      setPropertyData(null);
      setErrorState(error.message);
    },
  });

  const showToast = (message: string, type: ToastState["type"]) => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast({ show: false, message: "", type: "info" });
  };

  const handleSearch = (geocode: string) => {
    // Clear batch results when doing single search (legacy state)
    setBatchPropertyData([]);
    setIsShowingBatch(false);
    searchMutation.mutate(geocode);
  };

  const handleBatchResults = (newBatchResults: BatchApiResponse) => {
    // Merge or replace batch results based on mapMode
    setBatchResults((prev) => {
      if (mapMode === "add" && prev && prev.success) {
        // Merge new results with existing ones
        return {
          ...newBatchResults,
          results: [...prev.results, ...newBatchResults.results],
          totalRequested: prev.totalRequested + newBatchResults.totalRequested,
          totalSuccessful:
            prev.totalSuccessful + newBatchResults.totalSuccessful,
          totalFailed: prev.totalFailed + newBatchResults.totalFailed,
        };
      }
      // Replace mode or no previous results
      return newBatchResults;
    });

    if (newBatchResults.success && newBatchResults.results.length > 0) {
      // Extract successful property data from batch results
      const successfulProperties = newBatchResults.results
        .filter((result) => result.success && result.data)
        .map((result) => result.data!);

      if (successfulProperties.length > 0) {
        setBatchPropertyData(successfulProperties);
        setPropertyData(null); // Clear single property data
        setIsShowingBatch(true);
        setErrorState(null);
        setSelectedGeocodes([]); // Clear selection when new batch loads

        // Add to master collection
        const batchId = newBatchResults.batchId || `batch_${Date.now()}`;
        const requestedGeocodes = newBatchResults.results.map((r) => r.geocode);
        addToMasterCollection(successfulProperties, {
          type: "batch",
          batchId,
          timestamp: new Date().toISOString(),
          sourceGeocodes: requestedGeocodes,
        });

        const total = newBatchResults.totalRequested;
        const successful = newBatchResults.totalSuccessful;
        const failed = newBatchResults.totalFailed;

        if (failed > 0) {
          showToast(
            `Batch completed: ${successful}/${total} properties found successfully`,
            "info",
          );
        } else {
          showToast(
            `All ${successful} properties loaded successfully!`,
            "success",
          );
        }
      } else {
        setBatchPropertyData([]);
        setIsShowingBatch(false);
        setErrorState("No properties found in the batch lookup");
      }
    } else {
      setBatchPropertyData([]);
      setIsShowingBatch(false);
      setErrorState(newBatchResults.error || "Batch lookup failed");
      setSelectedGeocodes([]);
    }
  };

  // Retry mutation for failed geocodes
  const retryMutation = useMutation({
    mutationFn: async (geocodes: string[]): Promise<BatchApiResponse> => {
      const response = await apiRequest("POST", "/api/property/batch-lookup", {
        geocodes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      handleBatchResults(data);
      setRetryingGeocodes(new Set());
    },
    onError: () => {
      setRetryingGeocodes(new Set());
      showToast("Failed to retry geocodes", "error");
    },
  });

  const handleExportCSV = (includeAll: boolean) => {
    if (!batchResults) return;

    // Use filtered results if in selection mode, otherwise use original batch results
    const batchToExport =
      selectedPropertyGeocodes.length > 0
        ? filteredBatchResults!
        : batchResults;

    const resultsToExport = includeAll
      ? batchToExport.results
      : batchToExport.results.filter((result) => result.success);

    const csvContent = batchResultsToCSV(batchToExport, {
      includeMetadata: true,
      includeFailedRows: includeAll,
    });

    const filename = generateCsvFilename(includeAll ? "all" : "successful");
    downloadCSV(csvContent, filename);

    const count = resultsToExport.length;
    showToast(
      `Exported ${count} ${includeAll ? "results" : "successful results"} to CSV`,
      "success",
    );
  };

  const handleRetryIndividual = (geocode: string) => {
    setRetryingGeocodes((prev) => new Set([...Array.from(prev), geocode]));
    retryMutation.mutate([geocode]);
  };

  const handleRetryAllFailed = () => {
    if (!batchResults) return;

    const failedGeocodes = getFailedGeocodes(batchResults);
    setRetryingGeocodes(new Set(failedGeocodes));
    retryMutation.mutate(failedGeocodes);
  };

  const handlePropertySelect = (geocode: string) => {
    setSelectedGeocodes((prev) => {
      // Toggle: if already selected, remove it; otherwise add it
      if (prev.includes(geocode)) {
        return prev.filter((g) => g !== geocode);
      } else {
        return [...prev, geocode];
      }
    });
  };

  // Selection mode handlers
  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      // Clear both group selection and individual multi-selection when exiting selection mode
      setSelectedPropertyGeocodes([]);
      setSelectedGeocodes([]);
    }
  };

  const handlePropertySelection = (geocodes: string[]) => {
    setSelectedPropertyGeocodes(geocodes);
    if (geocodes.length > 0) {
      const count = geocodes.length;
      showToast(
        `Selected ${count} ${count === 1 ? "property" : "properties"} for focused view`,
        "success",
      );
    }
  };

  const handleDeleteProperty = (geocode: string) => {
    // Remove property from master collection
    setMasterPropertyCollection((prev) => {
      const newProperties = prev.properties.filter(
        (item) => item.property.geocode !== geocode,
      );
      return {
        properties: newProperties,
        totalCount: newProperties.length,
        lastUpdated: new Date().toISOString(),
      };
    });

    // Update batch results if applicable
    if (batchResults) {
      setBatchResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          results: prev.results.filter((r) => r.geocode !== geocode),
          totalRequested: prev.totalRequested - 1,
          totalSuccessful: prev.results.find((r) => r.geocode === geocode)
            ?.success
            ? prev.totalSuccessful - 1
            : prev.totalSuccessful,
          totalFailed:
            prev.results.find((r) => r.geocode === geocode)?.success === false
              ? prev.totalFailed - 1
              : prev.totalFailed,
        };
      });
    }

    // Update batch property data
    setBatchPropertyData((prev) => prev.filter((p) => p.geocode !== geocode));

    // Remove from multi-selection if the deleted property was selected
    if (selectedGeocodes.includes(geocode)) {
      setSelectedGeocodes((prev) => prev.filter((g) => g !== geocode));
    }

    // Remove from group selection if applicable
    if (selectedPropertyGeocodes.includes(geocode)) {
      setSelectedPropertyGeocodes((prev) => prev.filter((g) => g !== geocode));
    }

    showToast("Property marker deleted from map", "success");
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
    setBatchPropertyData([]);
    setIsShowingBatch(false);
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
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" role="main">
        {/* Search Section */}
        <div className="mb-8">
          <PropertySearchForm
            onSearch={handleSearch}
            onBatchResults={handleBatchResults}
            onPropertySelect={handlePropertySelect}
            isLoading={searchMutation.isPending}
            mapMode={mapMode}
            onMapModeChange={setMapMode}
          />

          {/* Clear Map Button - only show when there are properties to clear */}
          {masterPropertyCollection.properties.length > 0 && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={clearMasterCollection}
                className="text-on-surface border-gray-600 hover:bg-surface-variant"
                data-testid="button-clear-map"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Clear Results ({masterPropertyCollection.properties.length}{" "}
                {masterPropertyCollection.properties.length === 1
                  ? "property"
                  : "properties"}
                )
              </Button>
            </div>
          )}
        </div>

        {/* Results Section */}
        {!errorState && (
          <>
            {/* Accumulated Map - Always show when properties exist */}
            {mapPropertyData.length > 0 && (
              <section
                className="mb-8 fade-in overflow-visible"
                aria-labelledby="map-section-heading"
              >
                <Card className="bg-surface border-gray-700 shadow-lg overflow-visible">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle
                          id="map-section-heading"
                          className="text-xl font-semibold text-on-surface flex items-center space-x-2"
                        >
                          <span className="w-5 h-5 bg-blue-500 rounded-full"></span>
                          <span>Map View</span>
                        </CardTitle>
                        <p className="text-on-surface-variant mt-1">
                          Showing {mapPropertyData.length}{" "}
                          {mapPropertyData.length === 1
                            ? "property"
                            : "properties"}{" "}
                          on the map
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {/* Selection Mode Controls */}
                        {mapPropertyData.length > 1 && (
                          <div className="flex items-center space-x-2 mr-2">
                            <Button
                              onClick={handleToggleSelectionMode}
                              variant={isSelectionMode ? "default" : "outline"}
                              size="sm"
                              className={
                                isSelectionMode
                                  ? "bg-green-600 hover:bg-green-700 text-white"
                                  : "border-gray-600 hover:bg-gray-700 text-gray-300 hover:text-white"
                              }
                              title="Toggle property selection mode"
                              data-testid="button-toggle-selection"
                            >
                              <Circle className="h-4 w-4 mr-1" />
                              {isSelectionMode
                                ? "Exit Selection"
                                : "Select Group"}
                            </Button>

                            {selectedPropertyGeocodes.length > 0 && (
                              <>
                                <Button
                                  onClick={() =>
                                    setIsGroupToolbarOpen(!isGroupToolbarOpen)
                                  }
                                  variant={
                                    isGroupToolbarOpen ? "default" : "outline"
                                  }
                                  size="sm"
                                  className={
                                    isGroupToolbarOpen
                                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                                      : "border-blue-600 hover:bg-blue-700 text-blue-300 hover:text-white"
                                  }
                                  title="Format selected properties"
                                  data-testid="button-edit-group"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Badge
                                  variant="secondary"
                                  className="bg-green-800 text-green-100"
                                >
                                  {selectedPropertyGeocodes.length} Selected
                                </Badge>
                              </>
                            )}
                          </div>
                        )}

                        <Button
                          onClick={() => setIsMapExpanded(true)}
                          variant="outline"
                          size="sm"
                          className="border-gray-600 hover:bg-gray-700 text-gray-300 hover:text-white"
                          title="Expand map to full screen"
                          data-testid="button-expand-map"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                        <Badge
                          variant="secondary"
                          className="bg-blue-800 text-blue-100"
                        >
                          {selectedPropertyGeocodes.length > 0
                            ? filteredMapData.length
                            : mapPropertyData.length}{" "}
                          {selectedPropertyGeocodes.length > 0
                            ? "Selected"
                            : ""}{" "}
                          {(selectedPropertyGeocodes.length > 0
                            ? filteredMapData.length
                            : mapPropertyData.length) === 1
                            ? "Property"
                            : "Properties"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="overflow-visible">
                    {!isMapExpanded && (
                      <div
                        className="w-full overflow-visible"
                        style={{ height: "320px" }}
                      >
                        <PropertyMap
                          key="accumulated-map"
                          properties={
                            isSelectionMode ? mapPropertyData : filteredMapData
                          }
                          selectedGeocodes={selectedGeocodes}
                          isSelectionMode={isSelectionMode}
                          onPropertySelection={handlePropertySelection}
                          selectedPropertyGeocodes={selectedPropertyGeocodes}
                          onDeleteProperty={handleDeleteProperty}
                          isGroupToolbarOpen={isGroupToolbarOpen}
                          onCloseGroupToolbar={() =>
                            setIsGroupToolbarOpen(false)
                          }
                          onMarkerClick={handlePropertySelect}
                        />
                      </div>
                    )}
                    {isMapExpanded && (
                      <div
                        className="w-full bg-surface-variant rounded-lg border border-gray-600 flex items-center justify-center"
                        style={{ height: "320px" }}
                      >
                        <p className="text-on-surface-variant">
                          Map expanded to full screen view
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
            )}

            {/* Single Property Results */}
            {propertyData && !isShowingBatch && (
              <PropertyResults
                property={propertyData}
                onCopyAddress={handleCopyAddress}
                onOpenInMaps={handleOpenInMaps}
              />
            )}

            {/* Batch Property Results */}
            {batchPropertyData.length > 0 && isShowingBatch && (
              <section
                className="fade-in"
                aria-labelledby="batch-results-heading"
              >
                <div className="grid lg:grid-cols-1 gap-8">
                  {/* Batch Summary Card */}
                  <Card className="bg-surface border-gray-700 shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle
                            id="batch-results-heading"
                            className="text-xl font-semibold text-on-surface flex items-center space-x-2"
                          >
                            <span className="w-5 h-5 bg-green-500 rounded-full"></span>
                            <span>Batch Lookup Results</span>
                          </CardTitle>
                          <div className="text-on-surface-variant mt-1">
                            <p>
                              {mapPropertyData.length}{" "}
                              {mapPropertyData.length === 1
                                ? "property"
                                : "properties"}{" "}
                              found and displayed on the map
                            </p>
                            {selectedPropertyGeocodes.length > 0 && (
                              <p className="text-green-400">
                                {selectedPropertyGeocodes.length}{" "}
                                {selectedPropertyGeocodes.length === 1
                                  ? "property"
                                  : "properties"}{" "}
                                selected
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            onClick={() => setIsMapExpanded(true)}
                            variant="outline"
                            size="sm"
                            className="border-gray-600 hover:bg-gray-700 text-gray-300 hover:text-white"
                            title="Expand map to full screen"
                            data-testid="button-expand-map"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </Button>
                          <Badge
                            variant="secondary"
                            className="bg-blue-800 text-blue-100"
                          >
                            {mapPropertyData.length} Properties
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Results Summary and Export Actions */}
                      {filteredBatchResults &&
                        filteredBatchResults.success &&
                        filteredBatchResults.results.length > 0 && (
                          <div className="mt-6 space-y-4">
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-on-surface">
                                {selectedPropertyGeocodes.length > 0
                                  ? "Selected Properties:"
                                  : "Results Summary:"}
                              </h4>
                              <div className="max-h-40 overflow-y-auto space-y-1">
                                {filteredBatchResults.results.map(
                                  (result, index) => {
                                    const isSelected =
                                      selectedGeocodes.includes(result.geocode);
                                    return (
                                      <div
                                        key={index}
                                        onClick={() =>
                                          result.success &&
                                          handlePropertySelect(result.geocode)
                                        }
                                        onKeyDown={(e) => {
                                          if (
                                            (e.key === "Enter" ||
                                              e.key === " ") &&
                                            result.success
                                          ) {
                                            e.preventDefault();
                                            handlePropertySelect(
                                              result.geocode,
                                            );
                                          }
                                        }}
                                        tabIndex={result.success ? 0 : -1}
                                        role={
                                          result.success ? "button" : undefined
                                        }
                                        aria-label={
                                          result.success && result.data?.address
                                            ? `Select property ${result.data.address}`
                                            : undefined
                                        }
                                        className={`flex items-center justify-between p-2 rounded text-xs transition-all duration-200 ${
                                          isSelected
                                            ? "bg-orange-900/40 border-2 border-orange-500"
                                            : "bg-surface-variant border-2 border-transparent"
                                        } ${result.success ? "cursor-pointer hover:bg-gray-700/50" : ""}`}
                                      >
                                        <div className="flex items-center space-x-2 flex-1 pointer-events-none">
                                          <span className="font-mono">
                                            {result.geocode}
                                          </span>
                                          {result.success &&
                                            result.data?.address && (
                                              <span
                                                className="text-blue-400 truncate flex-1 text-left"
                                                title={result.data.address}
                                                data-testid={`address-link-${result.geocode}`}
                                              >
                                                {result.data.address}
                                              </span>
                                            )}
                                          {result.processedAt && (
                                            <span className="text-gray-500 text-xs">
                                              {new Date(
                                                result.processedAt,
                                              ).toLocaleTimeString()}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-2 pointer-events-auto">
                                          {result.success ? (
                                            <div className="flex items-center space-x-1 pointer-events-none">
                                              <CheckCircle className="h-3 w-3 text-green-400" />
                                              <span className="text-green-400">
                                                Found
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="flex items-center space-x-2">
                                              <div className="flex items-center space-x-1 pointer-events-none">
                                                <XCircle className="h-3 w-3 text-red-400" />
                                                <span
                                                  className="text-red-400"
                                                  title={result.error}
                                                >
                                                  {result.error &&
                                                  result.error.length > 20
                                                    ? result.error.substring(
                                                        0,
                                                        20,
                                                      ) + "..."
                                                    : result.error || "Error"}
                                                </span>
                                              </div>
                                              <Button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleRetryIndividual(
                                                    result.geocode,
                                                  );
                                                }}
                                                variant="ghost"
                                                size="sm"
                                                disabled={retryingGeocodes.has(
                                                  result.geocode,
                                                )}
                                                className="h-6 w-6 p-0 hover:bg-orange-800/20"
                                                data-testid={`button-retry-${result.geocode}`}
                                                title="Retry this geocode"
                                              >
                                                {retryingGeocodes.has(
                                                  result.geocode,
                                                ) ? (
                                                  <Loader2 className="h-3 w-3 animate-spin text-orange-400" />
                                                ) : (
                                                  <RefreshCw className="h-3 w-3 text-orange-400" />
                                                )}
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>

                            {/* Export and Retry Actions */}
                            <div className="flex flex-wrap gap-2 p-3 bg-surface-variant rounded-lg">
                              <Button
                                onClick={() => handleExportCSV(true)}
                                variant="secondary"
                                size="sm"
                                className="bg-blue-800 hover:bg-blue-700 text-blue-100"
                                data-testid="button-export-all"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Export All Results
                              </Button>

                              <Button
                                onClick={() => handleExportCSV(false)}
                                variant="secondary"
                                size="sm"
                                className="bg-green-800 hover:bg-green-700 text-green-100"
                                data-testid="button-export-successful"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Export Successful Only
                              </Button>

                              {filteredBatchResults.totalFailed > 0 && (
                                <Button
                                  onClick={handleRetryAllFailed}
                                  variant="secondary"
                                  size="sm"
                                  disabled={retryMutation.isPending}
                                  className="bg-orange-800 hover:bg-orange-700 text-orange-100 disabled:bg-gray-600"
                                  data-testid="button-retry-all-failed"
                                >
                                  {retryMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                  )}
                                  Retry All Failed (
                                  {filteredBatchResults.totalFailed})
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                    </CardContent>
                  </Card>
                </div>
              </section>
            )}
          </>
        )}

        {/* Full-Screen Map Modal */}
        {isMapExpanded && mapPropertyData.length > 0 && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
            <div className="w-full h-full max-w-7xl bg-surface rounded-lg border border-gray-700 flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center space-x-2">
                  <span className="w-4 h-4 bg-green-500 rounded-full"></span>
                  <h2 className="text-lg font-semibold text-on-surface">
                    Map View -{" "}
                    {selectedPropertyGeocodes.length > 0
                      ? filteredMapData.length
                      : mapPropertyData.length}{" "}
                    {selectedPropertyGeocodes.length > 0 ? "Selected" : ""}{" "}
                    Properties
                  </h2>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Selection Mode Controls for Expanded View */}
                  {mapPropertyData.length > 1 && (
                    <div className="flex items-center space-x-2 mr-2">
                      <Button
                        onClick={handleToggleSelectionMode}
                        variant={isSelectionMode ? "default" : "outline"}
                        size="sm"
                        className={
                          isSelectionMode
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "border-gray-600 hover:bg-gray-700 text-gray-300 hover:text-white"
                        }
                        title="Toggle property selection mode"
                        data-testid="button-toggle-selection-expanded"
                      >
                        <Circle className="h-4 w-4 mr-1" />
                        {isSelectionMode ? "Exit Selection" : "Select Group"}
                      </Button>

                      {selectedPropertyGeocodes.length > 0 && (
                        <>
                          <Button
                            onClick={() =>
                              setIsGroupToolbarOpen(!isGroupToolbarOpen)
                            }
                            variant={isGroupToolbarOpen ? "default" : "outline"}
                            size="sm"
                            className={
                              isGroupToolbarOpen
                                ? "bg-blue-600 hover:bg-blue-700 text-white"
                                : "border-blue-600 hover:bg-blue-700 text-blue-300 hover:text-white"
                            }
                            title="Format selected properties"
                            data-testid="button-edit-group-expanded"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Badge
                            variant="secondary"
                            className="bg-green-800 text-green-100"
                          >
                            {selectedPropertyGeocodes.length} Selected
                          </Badge>
                        </>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={() => setIsMapExpanded(false)}
                    variant="ghost"
                    size="sm"
                    className="hover:bg-gray-700 text-gray-400 hover:text-white"
                    title="Close full screen view"
                    data-testid="button-close-expanded-map"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Expanded Map Container */}
              <div className="flex-1 p-4 overflow-hidden flex flex-col">
                <div className="w-full flex-1 rounded-lg overflow-hidden">
                  <PropertyMap
                    key={`expanded-map-${isMapExpanded}-${mapPropertyData.length}`}
                    properties={
                      isSelectionMode ? mapPropertyData : filteredMapData
                    }
                    selectedGeocodes={selectedGeocodes}
                    isSelectionMode={isSelectionMode}
                    onPropertySelection={handlePropertySelection}
                    selectedPropertyGeocodes={selectedPropertyGeocodes}
                    onDeleteProperty={handleDeleteProperty}
                    isGroupToolbarOpen={isGroupToolbarOpen}
                    onCloseGroupToolbar={() => setIsGroupToolbarOpen(false)}
                    onMarkerClick={handlePropertySelect}
                  />
                </div>
              </div>

              {/* Results Summary in Modal */}
              {filteredBatchResults &&
                filteredBatchResults.success &&
                filteredBatchResults.results.length > 0 && (
                  <div className="border-t border-gray-700 p-4 max-h-48 overflow-y-auto">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-on-surface mb-2">
                        {selectedPropertyGeocodes.length > 0
                          ? "Selected Properties - Click to highlight:"
                          : "Click addresses to highlight on map:"}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {filteredBatchResults.results
                          .filter(
                            (result) => result.success && result.data?.address,
                          )
                          .map((result, index) => (
                            <button
                              key={result.geocode}
                              onClick={() =>
                                handlePropertySelect(result.geocode)
                              }
                              className={`p-2 rounded text-left transition-colors duration-200 text-sm ${
                                selectedGeocodes.includes(result.geocode)
                                  ? "bg-orange-800/30 border border-orange-500 text-orange-300"
                                  : "bg-surface-variant hover:bg-surface-variant/80 text-blue-400 hover:text-blue-300"
                              }`}
                              title="Click to highlight on map"
                              data-testid={`modal-address-link-${result.geocode}`}
                            >
                              <div className="font-mono text-xs text-gray-400">
                                {result.geocode}
                              </div>
                              <div className="truncate">
                                {result.data?.address}
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Error State */}
        {errorState && (
          <section
            className="fade-in mb-8"
            role="alert"
            aria-labelledby="error-heading"
          >
            <Card className="bg-red-900/20 border-red-700">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5">
                    <AlertCircle className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3
                      id="error-heading"
                      className="text-lg font-semibold text-red-300 mb-2"
                    >
                      Property Not Found
                    </h3>
                    <p
                      className="text-red-200 mb-4"
                      data-testid="text-error-message"
                    >
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
        <section
          className="mt-12 rounded-xl p-6 shadow-lg border border-gray-700 bg-[#171717]"
          aria-labelledby="help-heading"
        >
          <h3
            id="help-heading"
            className="text-lg font-semibold text-on-surface mb-4"
          >
            How to Use This Tool
          </h3>
          <div className="space-y-4 text-on-surface-variant">
            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                1
              </span>
              <p>
                <strong>Single Lookup:</strong> Enter a Montana property geocode
                in the search field, or <strong>Batch Lookup:</strong>{" "}
                copy/paste multiple geocodes or upload a CSV file.
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                2
              </span>
              <p>
                Click "Search Property" or "Process Geocodes" to retrieve
                property information from the Montana cadastral database.
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                3
              </span>
              <p>
                View property details and explore the interactive map. Multiple
                properties will show with different colored markers and
                boundaries.
              </p>
            </div>
          </div>
        </section>
      </main>
      {/* Footer */}
      <footer
        className="bg-surface border-t border-gray-700 mt-8"
        role="contentinfo"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <p className="text-sm text-on-surface-variant">
              Data provided by the Montana State Library Cadastral Mapping
              Service
            </p>
            <p className="text-sm text-on-surface-variant">
              Copyright © 2025 | Bobbi Johnson
            </p>
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
