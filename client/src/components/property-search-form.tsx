import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { geocodeSearchSchema, GeocodeSearch } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";

interface PropertySearchFormProps {
  onSearch: (geocode: string) => void;
  isLoading: boolean;
}

export function PropertySearchForm({ onSearch, isLoading }: PropertySearchFormProps) {
  const form = useForm<GeocodeSearch>({
    resolver: zodResolver(geocodeSearchSchema),
    defaultValues: {
      geocode: ""
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

  return (
    <Card className="bg-surface border-gray-700 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-on-surface">
          Property Geocode Lookup
        </CardTitle>
        <CardDescription className="text-on-surface-variant">
          Enter a Montana property geocode to retrieve address information and location details.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                        placeholder="e.g., 12345-67890-12345"
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
                    Format: Numbers and hyphens only (e.g., 12345-67890-12345)
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
      </CardContent>
    </Card>
  );
}
