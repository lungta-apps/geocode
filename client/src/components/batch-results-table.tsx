import { useState, useMemo } from "react";
import { BatchApiResponse, BatchPropertyResult } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, ArrowUpDown, Filter, Info } from "lucide-react";

interface BatchResultsTableProps {
  results: BatchApiResponse;
  onPropertySelect?: (property: BatchPropertyResult) => void;
}

type SortField = 'geocode' | 'address' | 'county' | 'status';
type SortDirection = 'asc' | 'desc';
type FilterStatus = 'all' | 'success' | 'failed';

export function BatchResultsTable({ results, onPropertySelect }: BatchResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>('geocode');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSortedResults = useMemo(() => {
    let filtered = results.results;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(result => 
        filterStatus === 'success' ? result.success : !result.success
      );
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(result =>
        result.geocode.toLowerCase().includes(query) ||
        (result.data?.address?.toLowerCase().includes(query)) ||
        (result.data?.county?.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let valueA: string | number;
      let valueB: string | number;

      switch (sortField) {
        case 'geocode':
          valueA = a.geocode;
          valueB = b.geocode;
          break;
        case 'address':
          valueA = a.data?.address || '';
          valueB = b.data?.address || '';
          break;
        case 'county':
          valueA = a.data?.county || '';
          valueB = b.data?.county || '';
          break;
        case 'status':
          valueA = a.success ? 1 : 0;
          valueB = b.success ? 1 : 0;
          break;
        default:
          valueA = a.geocode;
          valueB = b.geocode;
      }

      if (sortDirection === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });

    return sorted;
  }, [results.results, sortField, sortDirection, filterStatus, searchQuery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUpDown className="h-4 w-4 text-primary rotate-180" /> : 
      <ArrowUpDown className="h-4 w-4 text-primary" />;
  };

  if (!results.success && results.error) {
    return (
      <Alert className="border-red-600 bg-red-900/20">
        <XCircle className="h-4 w-4" />
        <AlertDescription className="text-red-400">
          Batch processing failed: {results.error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="bg-surface border-gray-700 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-on-surface flex items-center space-x-2">
          <span>Batch Processing Results</span>
        </CardTitle>
        <CardDescription className="text-on-surface-variant">
          Detailed results for all processed geocodes with sorting and filtering options.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="flex flex-wrap gap-4 p-4 bg-surface-variant rounded-lg">
          <div className="flex items-center space-x-2">
            <Info className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-on-surface">Total: {results.totalRequested}</span>
          </div>
          <Badge variant="secondary" className="bg-green-800 text-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            {results.totalSuccessful} Successful
          </Badge>
          {results.totalFailed > 0 && (
            <Badge variant="secondary" className="bg-red-800 text-red-100">
              <XCircle className="h-3 w-3 mr-1" />
              {results.totalFailed} Failed
            </Badge>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search geocodes, addresses, or counties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-variant border-gray-600 text-on-surface"
              data-testid="input-search-results"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={filterStatus} onValueChange={(value: FilterStatus) => setFilterStatus(value)}>
              <SelectTrigger className="w-32 bg-surface-variant border-gray-600" data-testid="select-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="success">Successful</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Table */}
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-variant hover:bg-surface-variant">
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => handleSort('geocode')}
                    data-testid="header-geocode"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Geocode</span>
                      {getSortIcon('geocode')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => handleSort('address')}
                    data-testid="header-address"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Address</span>
                      {getSortIcon('address')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => handleSort('county')}
                    data-testid="header-county"
                  >
                    <div className="flex items-center space-x-1">
                      <span>County</span>
                      {getSortIcon('county')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => handleSort('status')}
                    data-testid="header-status"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Status</span>
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-on-surface-variant">
                      No results match your current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedResults.map((result, index) => (
                    <TableRow 
                      key={result.geocode} 
                      className="hover:bg-surface-variant transition-colors"
                      data-testid={`row-result-${index}`}
                    >
                      <TableCell className="font-mono text-sm" data-testid={`cell-geocode-${index}`}>
                        {result.geocode}
                      </TableCell>
                      <TableCell data-testid={`cell-address-${index}`}>
                        {result.success && result.data?.address ? (
                          <span className="text-on-surface">{result.data.address}</span>
                        ) : (
                          <span className="text-on-surface-variant italic">Not available</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`cell-county-${index}`}>
                        {result.success && result.data?.county ? (
                          <span className="text-on-surface">{result.data.county}</span>
                        ) : (
                          <span className="text-on-surface-variant italic">Not available</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`cell-status-${index}`}>
                        {result.success ? (
                          <Badge variant="secondary" className="bg-green-800 text-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="secondary" className="bg-red-800 text-red-100">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                            {result.error && (
                              <p className="text-xs text-red-400 max-w-xs break-words">
                                {result.error}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {result.success && result.data && onPropertySelect && (
                          <Button
                            onClick={() => onPropertySelect(result)}
                            variant="outline"
                            size="sm"
                            className="border-gray-600 hover:bg-gray-700"
                            data-testid={`button-select-${index}`}
                          >
                            View on Map
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Filtered Results Count */}
        {filteredAndSortedResults.length !== results.results.length && (
          <p className="text-sm text-on-surface-variant text-center">
            Showing {filteredAndSortedResults.length} of {results.results.length} results
          </p>
        )}
      </CardContent>
    </Card>
  );
}