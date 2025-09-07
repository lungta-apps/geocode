import { BatchApiResponse, BatchPropertyResult } from "@shared/schema";

export interface CsvExportOptions {
  includeFailedRows?: boolean;
  includeTimestamps?: boolean;
  includeMetadata?: boolean;
}

/**
 * Convert batch results to CSV format
 */
export function batchResultsToCSV(
  batchResponse: BatchApiResponse, 
  options: CsvExportOptions = {}
): string {
  const { includeFailedRows = true, includeTimestamps = true, includeMetadata = true } = options;
  
  const rows: string[] = [];
  
  // Build header row
  const headers = [
    'Geocode',
    'Status',
    'Address',
    'County',
    'Coordinates',
    'Legal Description',
    'Latitude', 
    'Longitude',
  ];
  
  if (includeTimestamps) {
    headers.push('Processed At');
  }
  
  if (includeFailedRows) {
    headers.push('Error Message');
  }
  
  rows.push(headers.join(','));
  
  // Add data rows
  const resultsToInclude = includeFailedRows 
    ? batchResponse.results 
    : batchResponse.results.filter(r => r.success);
    
  for (const result of resultsToInclude) {
    const row = [
      escapeCsvValue(result.geocode),
      result.success ? 'Success' : 'Failed',
      escapeCsvValue(result.data?.address || ''),
      escapeCsvValue(result.data?.county || ''),
      escapeCsvValue(result.data?.coordinates || ''),
      escapeCsvValue(result.data?.legalDescription || ''),
      result.data?.lat ? result.data.lat.toString() : '',
      result.data?.lng ? result.data.lng.toString() : '',
    ];
    
    if (includeTimestamps) {
      row.push(result.processedAt || '');
    }
    
    if (includeFailedRows) {
      row.push(escapeCsvValue(result.error || ''));
    }
    
    rows.push(row.join(','));
  }
  
  // Add metadata at the bottom if requested
  if (includeMetadata && batchResponse.startedAt) {
    rows.push(''); // Empty row separator
    rows.push('# Batch Processing Metadata');
    rows.push(`# Batch ID,${batchResponse.batchId || 'N/A'}`);
    rows.push(`# Started At,${batchResponse.startedAt}`);
    rows.push(`# Completed At,${batchResponse.completedAt || 'N/A'}`);
    rows.push(`# Total Requested,${batchResponse.totalRequested}`);
    rows.push(`# Total Successful,${batchResponse.totalSuccessful}`);
    rows.push(`# Total Failed,${batchResponse.totalFailed}`);
    rows.push(`# Success Rate,${Math.round((batchResponse.totalSuccessful / batchResponse.totalRequested) * 100)}%`);
  }
  
  return rows.join('\n');
}

/**
 * Escape CSV values that contain commas, quotes, or newlines
 */
function escapeCsvValue(value: string): string {
  if (!value) return '';
  
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  
  return value;
}

/**
 * Download CSV file to user's device
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Generate a filename for CSV export with timestamp
 */
export function generateCsvFilename(prefix: string = 'montana-property-lookup'): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  return `${prefix}-${timestamp}.csv`;
}

/**
 * Extract failed geocodes from batch results for retry
 */
export function getFailedGeocodes(batchResponse: BatchApiResponse): string[] {
  return batchResponse.results
    .filter(result => !result.success)
    .map(result => result.geocode);
}