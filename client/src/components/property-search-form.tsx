import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { geocodeSearchSchema, GeocodeSearch, BatchApiResponse } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, FileText, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PropertySearchFormProps {
  onSearch: (geocode: string) => void;
  isLoading: boolean;
}

export function PropertySearchForm({ onSearch, isLoading }: PropertySearchFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidation, setFileValidation] = useState<{ isValid: boolean; message?: string } | null>(null);
  const [batchResults, setBatchResults] = useState<BatchApiResponse | null>(null);
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
    },
    onError: (error) => {
      console.error('Batch upload failed:', error);
      setBatchResults({
        success: false,
        results: [],
        totalRequested: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        error: error instanceof Error ? error.message : 'Upload failed'
      });
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

  const parseCSV = (text: string): string[] => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const geocodes: string[] = [];
    
    for (const line of lines) {
      // Handle CSV with or without headers
      const values = line.split(',').map(val => val.trim().replace(/"/g, ''));
      
      // Skip header row if it contains non-geocode text
      if (values.some(val => val.toLowerCase().includes('geocode') || val.toLowerCase().includes('property') || val.toLowerCase().includes('code'))) {
        continue;
      }
      
      // Extract geocodes from each row (take first column that looks like a geocode)
      for (const value of values) {
        if (value && /^[0-9\-]+$/.test(value) && value.length >= 5) {
          geocodes.push(value);
          break; // Take only the first valid geocode per row
        }
      }
    }
    
    return Array.from(new Set(geocodes)); // Remove duplicates
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
      const geocodes = parseCSV(text);
      
      if (geocodes.length === 0) {
        setFileValidation({ isValid: false, message: 'No valid geocodes found in the file' });
        return;
      }
      
      if (geocodes.length > 10) {
        setFileValidation({ isValid: false, message: 'Maximum 10 geocodes allowed per batch' });
        return;
      }
      
      batchMutation.mutate(geocodes);
    } catch (error) {
      setFileValidation({ isValid: false, message: 'Failed to read the file' });
    }
  };

  return (
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
                
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-auto bg-primary hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center justify-center space-x-2"
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
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="batch" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-on-surface">Upload CSV File</Label>
                <div className="mt-2">
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="csv-upload"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-surface-variant hover:bg-gray-700 transition-colors"
                      data-testid="label-file-upload"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-gray-400" />
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

                  {batchResults.success && batchResults.results.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-on-surface">Results Summary:</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {batchResults.results.map((result, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-surface-variant rounded text-xs">
                            <span className="font-mono">{result.geocode}</span>
                            {result.success ? (
                              <div className="flex items-center space-x-1">
                                <CheckCircle className="h-3 w-3 text-green-400" />
                                <span className="text-green-400">Found</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <XCircle className="h-3 w-3 text-red-400" />
                                <span className="text-red-400">Error</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
