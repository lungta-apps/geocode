import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { geocodeSearchSchema, GeocodeSearch, BatchApiResponse } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, FileText, CheckCircle, XCircle, List, Eye, Download, RefreshCw, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { batchResultsToCSV, downloadCSV, generateCsvFilename, getFailedGeocodes } from "@/lib/csv-utils";
import { BatchProgress } from "@/components/batch-progress";

interface PropertySearchFormProps {
  onSearch: (geocode: string) => void;
  onBatchResults?: (results: BatchApiResponse) => void;
  onPropertySelect?: (geocode: string) => void;
  isLoading: boolean;
  mapMode: 'replace' | 'add';
  onMapModeChange: (mode: 'replace' | 'add') => void;
}

export function PropertySearchForm({ onSearch, onBatchResults, onPropertySelect, isLoading, mapMode, onMapModeChange }: PropertySearchFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidation, setFileValidation] = useState<{ isValid: boolean; message?: string } | null>(null);
  const [batchResults, setBatchResults] = useState<BatchApiResponse | null>(null);
  const [batchInput, setBatchInput] = useState('');
  const [parsedGeocodes, setParsedGeocodes] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [retryingGeocodes, setRetryingGeocodes] = useState<Set<string>>(new Set());
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [showProgressTracker, setShowProgressTracker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<GeocodeSearch>({
    resolver: zodResolver(geocodeSearchSchema),
    defaultValues: {
      geocode: ""
    }
  });

  // Batch upload mutation
  const batchMutation = useMutation({
    mutationFn: async (geocodes: string[]): Promise<BatchApiResponse> => {
      const response = await apiRequest('POST', '/api/property/batch-lookup', { geocodes });
      return response.json();
    },
    onSuccess: (data) => {
      setBatchResults(data);
      setActiveBatchId(null);
      setShowProgressTracker(false);
      if (onBatchResults) {
        onBatchResults(data);
      }
    },
    onError: (error) => {
      console.error('Batch upload failed:', error);
      setActiveBatchId(null);
      setShowProgressTracker(false);
      const errorResult = {
        success: false,
        results: [],
        totalRequested: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
      setBatchResults(errorResult);
      if (onBatchResults) {
        onBatchResults(errorResult);
      }
    }
  });

  // Individual retry mutation
  const retryMutation = useMutation({
    mutationFn: async (geocodes: string[]): Promise<BatchApiResponse> => {
      const response = await apiRequest('POST', '/api/property/batch-lookup', { geocodes });
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (batchResults) {
        // Update the batch results with the new retry results
        const updatedResults = [...batchResults.results];
        data.results.forEach(newResult => {
          const existingIndex = updatedResults.findIndex(r => r.geocode === newResult.geocode);
          if (existingIndex !== -1) {
            updatedResults[existingIndex] = newResult;
          }
        });
        
        const successfulCount = updatedResults.filter(r => r.success).length;
        const failedCount = updatedResults.filter(r => !r.success).length;
        
        const updatedBatchResults: BatchApiResponse = {
          ...batchResults,
          results: updatedResults,
          totalSuccessful: successfulCount,
          totalFailed: failedCount
        };
        
        setBatchResults(updatedBatchResults);
        if (onBatchResults) {
          onBatchResults(updatedBatchResults);
        }
      }
      
      // Clear retry loading state
      setRetryingGeocodes(new Set());
    },
    onError: (error) => {
      console.error('Retry failed:', error);
      setRetryingGeocodes(new Set());
      setActiveBatchId(null);
      setShowProgressTracker(false);
    }
  });

  const handleSubmit = (data: GeocodeSearch) => {
    onSearch(data.geocode);
  };

  const handleInputChange = (value: string) => {
    // Format input to allow only numbers and hyphens
    const formatted = value.replace(/[^0-9\-]/g, '');
    form.setValue('geocode', formatted);
  };

  const parseTextInput = (text: string): string[] => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const geocodes: string[] = [];
    
    for (const line of lines) {
      // Handle both CSV and plain text input
      const values = line.includes(',') 
        ? line.split(',').map(val => val.trim().replace(/"/g, ''))
        : [line];
      
      // Skip header row if it contains non-geocode text
      if (values.some(val => val.toLowerCase().includes('geocode') || val.toLowerCase().includes('property') || val.toLowerCase().includes('code'))) {
        continue;
      }
      
      // Extract geocodes from each value
      for (const value of values) {
        const cleaned = value.trim();
        if (cleaned && /^[0-9\-]+$/.test(cleaned) && cleaned.length >= 5) {
          geocodes.push(cleaned);
          break; // Take only the first valid geocode per line/row
        }
      }
    }
    
    return Array.from(new Set(geocodes)); // Remove duplicates
  };

  // Export functions
  const handleExportCSV = (includeFailedRows: boolean = true) => {
    if (!batchResults) return;
    
    const csvContent = batchResultsToCSV(batchResults, {
      includeFailedRows,
      includeTimestamps: true,
      includeMetadata: true
    });
    
    const filename = generateCsvFilename('montana-property-batch');
    downloadCSV(csvContent, filename);
  };

  // Retry functions
  const handleRetryIndividual = (geocode: string) => {
    setRetryingGeocodes(prev => new Set([...Array.from(prev), geocode]));
    retryMutation.mutate([geocode]);
  };

  const handleRetryAllFailed = () => {
    if (!batchResults) return;
    
    const failedGeocodes = getFailedGeocodes(batchResults);
    if (failedGeocodes.length === 0) return;
    
    // Start progress tracking for retry
    const newBatchId = `retry_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    setActiveBatchId(newBatchId);
    setShowProgressTracker(true);
    
    setRetryingGeocodes(new Set(failedGeocodes));
    retryMutation.mutate(failedGeocodes);
  };

  const validateFile = (file: File): { isValid: boolean; message?: string } => {
    // Check file type
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      return { isValid: false, message: 'Please select a CSV file' };
    }
    
    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return { isValid: false, message: 'File size must be less than 5MB' };
    }
    
    return { isValid: true };
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileValidation(null);
      setBatchResults(null);
      return;
    }

    const validation = validateFile(file);
    setFileValidation(validation);
    
    if (validation.isValid) {
      setSelectedFile(file);
      setBatchResults(null);
    } else {
      setSelectedFile(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    try {
      const text = await selectedFile.text();
      const geocodes = parseTextInput(text);
      
      if (geocodes.length === 0) {
        setFileValidation({ isValid: false, message: 'No valid geocodes found in the file' });
        return;
      }
      
      if (geocodes.length > 25) {
        setFileValidation({ isValid: false, message: 'Maximum 25 geocodes allowed per batch' });
        return;
      }
      
      // Start progress tracking
      const newBatchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      setActiveBatchId(newBatchId);
      setShowProgressTracker(true);
      
      batchMutation.mutate(geocodes);
    } catch (error) {
      setFileValidation({ isValid: false, message: 'Failed to read the file' });
    }
  };

  const handleTextInputChange = (text: string) => {
    setBatchInput(text);
    if (text.trim()) {
      const geocodes = parseTextInput(text);
      setParsedGeocodes(geocodes);
    } else {
      setParsedGeocodes([]);
      setShowPreview(false);
    }
  };

  const handlePreviewToggle = () => {
    setShowPreview(!showPreview);
  };

  const handleTextBatchSubmit = () => {
    if (parsedGeocodes.length === 0) return;
    
    if (parsedGeocodes.length > 25) {
      setFileValidation({ isValid: false, message: 'Maximum 25 geocodes allowed per batch' });
      return;
    }
    
    setFileValidation(null);
    
    // Start progress tracking
    const newBatchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    setActiveBatchId(newBatchId);
    setShowProgressTracker(true);
    
    batchMutation.mutate(parsedGeocodes);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => 
      file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
    );
    
    if (csvFile) {
      const validation = validateFile(csvFile);
      setFileValidation(validation);
      
      if (validation.isValid) {
        setSelectedFile(csvFile);
        setBatchResults(null);
      } else {
        setSelectedFile(null);
      }
    } else {
      setFileValidation({ isValid: false, message: 'Please drop a CSV file' });
    }
  };

  const handleSingleLookupClear = () => {
    form.setValue('geocode', '');
    handleInputChange('');
  };

  const handleBatchUploadClear = () => {
    setBatchInput('');
    setSelectedFile(null);
    setFileValidation(null);
    setBatchResults(null);
    setShowPreview(false);
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
    <Card className="bg-surface border-gray-700 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-on-surface">
          Property Geocode Lookup
        </CardTitle>
        <CardDescription className="text-on-surface-variant">
          Look up Montana property information using individual geocodes or upload a CSV file for batch processing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="single" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" data-testid="tab-single">Single Lookup</TabsTrigger>
            <TabsTrigger value="batch" data-testid="tab-batch">Batch Upload</TabsTrigger>
          </TabsList>
          
          <TabsContent value="single">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" role="search">
                <FormField
                  control={form.control}
                  name="geocode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-on-surface">
                        Montana Property Geocode
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            placeholder="e.g., 03-1032-34-1-08-10-0000"
                            className="w-full px-4 py-3 text-on-surface bg-surface-variant border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-lg"
                            onChange={(e) => {
                              handleInputChange(e.target.value);
                            }}
                            maxLength={25}
                            aria-describedby="geocode-help"
                            data-testid="input-geocode"
                            disabled={isLoading}
                          />
                        </div>
                      </FormControl>
                      <FormDescription id="geocode-help" className="text-sm text-on-surface-variant">
                        Format: Numbers and hyphens only (e.g., 03-1032-34-1-08-10-0000)
                      </FormDescription>
                      <FormMessage className="text-sm text-error" role="alert" aria-live="polite" />
                    </FormItem>
                  )}
                />
                
                {/* Map Mode Toggle for Single Lookup */}
                <div className="flex items-center space-x-3 p-3 bg-surface-variant rounded-lg border border-gray-600">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="map-mode-single"
                      checked={mapMode === 'add'}
                      onCheckedChange={(checked) => onMapModeChange(checked ? 'add' : 'replace')}
                      data-testid="switch-map-mode-single"
                    />
                    <Label htmlFor="map-mode-single" className="text-sm font-medium text-on-surface cursor-pointer">
                      {mapMode === 'add' ? 'Add to Map' : 'Replace Map'}
                    </Label>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {mapMode === 'add' 
                      ? 'New properties will be added to existing map results' 
                      : 'New properties will replace all existing map results'
                    }
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 sm:flex-none bg-primary hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center justify-center space-x-2"
                    data-testid="button-search"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <span>Search Property</span>
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSingleLookupClear}
                    disabled={isLoading || !form.getValues('geocode')}
                    className="flex-1 sm:flex-none px-6 py-3 rounded-lg font-medium transition-all duration-200"
                    data-testid="button-clear-single"
                  >
                    Clear
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="batch" className="space-y-4">
            <div className="space-y-6">
              {/* Map Mode Toggle for Batch Upload */}
              <div className="flex items-center space-x-3 p-3 bg-surface-variant rounded-lg border border-gray-600">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="map-mode-batch"
                    checked={mapMode === 'add'}
                    onCheckedChange={(checked) => onMapModeChange(checked ? 'add' : 'replace')}
                    data-testid="switch-map-mode-batch"
                  />
                  <Label htmlFor="map-mode-batch" className="text-sm font-medium text-on-surface cursor-pointer">
                    {mapMode === 'add' ? 'Add to Map' : 'Replace Map'}
                  </Label>
                </div>
                <p className="text-xs text-on-surface-variant">
                  {mapMode === 'add' 
                    ? 'New properties will be added to existing map results' 
                    : 'New properties will replace all existing map results'
                  }
                </p>
              </div>
              
              {/* Textarea Input Section */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-on-surface">Copy & Paste Geocodes</Label>
                <div className="relative">
                  <Textarea
                    value={batchInput}
                    onChange={(e) => handleTextInputChange(e.target.value)}
                    placeholder="Paste geocodes here, one per line."
                    className="w-full min-h-24 px-3 py-2 text-on-surface bg-surface-variant border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm resize-y"
                    data-testid="textarea-batch-input"
                  />
                  {parsedGeocodes.length > 0 && (
                    <div className="absolute top-2 right-2 flex items-center space-x-2">
                      <Badge variant="secondary" className="bg-blue-800 text-blue-100">
                        {parsedGeocodes.length} found
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handlePreviewToggle}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-200"
                        data-testid="button-preview-toggle"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {showPreview && parsedGeocodes.length > 0 && (
                  <div className="p-3 bg-surface-variant rounded-lg border border-gray-600" data-testid="geocode-preview">
                    <h4 className="text-sm font-medium text-on-surface mb-2 flex items-center">
                      <List className="h-4 w-4 mr-2" />
                      Detected Geocodes ({parsedGeocodes.length})
                    </h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {parsedGeocodes.map((geocode, index) => (
                        <div key={index} className="text-xs font-mono bg-surface p-1 rounded border border-gray-700">
                          {geocode}
                        </div>
                      ))}
                    </div>
                    {parsedGeocodes.length > 25 && (
                      <p className="text-xs text-orange-400 mt-2">
                        ⚠️ Maximum 25 geocodes allowed - please remove {parsedGeocodes.length - 25} extra geocodes
                      </p>
                    )}
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <p className="text-xs text-on-surface-variant">
                    Enter geocodes one per line. Format: 03-1032-34-1-08-10-0000
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBatchUploadClear}
                      disabled={batchMutation.isPending || (parsedGeocodes.length === 0 && !selectedFile && !batchResults)}
                      className="px-4 py-2 text-sm"
                      data-testid="button-clear-batch"
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={handleTextBatchSubmit}
                      disabled={parsedGeocodes.length === 0 || batchMutation.isPending}
                      className="bg-primary hover:bg-blue-700 disabled:bg-gray-600"
                      data-testid="button-batch-submit"
                    >
                      {batchMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>Process {parsedGeocodes.length} Geocodes</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface px-2 text-gray-400">Or</span>
                </div>
              </div>
              
              {/* File Upload Section */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-on-surface">Upload CSV File</Label>
                <div className="mt-2">
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="csv-upload"
                      className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                        dragActive
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-600 bg-surface-variant hover:bg-gray-700'
                      }`}
                      data-testid="label-file-upload"
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className={`w-8 h-8 mb-2 ${dragActive ? 'text-primary' : 'text-gray-400'}`} />
                        <p className="mb-2 text-sm text-gray-400">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">CSV files only (max 5MB)</p>
                      </div>
                      <input
                        id="csv-upload"
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleFileChange}
                        className="hidden"
                        data-testid="input-file-upload"
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Upload a CSV file with geocodes. The file should contain one geocode per row, or you can include column headers.
                  </p>
                </div>
              </div>

              {selectedFile && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 p-3 bg-surface-variant rounded-lg">
                    <FileText className="h-5 w-5 text-blue-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-on-surface">{selectedFile.name}</p>
                      <p className="text-xs text-on-surface-variant">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      onClick={handleFileUpload}
                      disabled={batchMutation.isPending || !fileValidation?.isValid}
                      className="bg-primary hover:bg-blue-700 disabled:bg-gray-600"
                      data-testid="button-upload"
                    >
                      {batchMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Process File
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {fileValidation && !fileValidation.isValid && (
                <Alert className="border-red-600 bg-red-900/20">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-400">
                    {fileValidation.message}
                  </AlertDescription>
                </Alert>
              )}

              {batchResults && (
                <div className="space-y-3" data-testid="batch-results">
                  <Alert className={batchResults.success ? "border-green-600 bg-green-900/20" : "border-red-600 bg-red-900/20"}>
                    {batchResults.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription className={batchResults.success ? "text-green-400" : "text-red-400"}>
                      {batchResults.success ? (
                        <div>
                          <p className="font-medium">Batch processing completed!</p>
                          <div className="flex gap-4 mt-2">
                            <Badge variant="secondary" className="bg-green-800 text-green-100">
                              {batchResults.totalSuccessful} Successful
                            </Badge>
                            {batchResults.totalFailed > 0 && (
                              <Badge variant="secondary" className="bg-red-800 text-red-100">
                                {batchResults.totalFailed} Failed
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p>{batchResults.error || 'Batch processing failed'}</p>
                      )}
                    </AlertDescription>
                  </Alert>

                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
    
    {/* Real-time Progress Tracker */}
    {showProgressTracker && activeBatchId && (
      <BatchProgress
        batchId={activeBatchId!}
        initialTotal={parsedGeocodes.length || (selectedFile ? 1 : 0)}
        onCancel={() => {
          setShowProgressTracker(false);
          setActiveBatchId(null);
        }}
        onComplete={() => {
          setShowProgressTracker(false);
          setActiveBatchId(null);
        }}
      />
    )}
    </>
  );
}
