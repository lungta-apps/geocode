import { z } from "zod";

export const geocodeSearchSchema = z.object({
  geocode: z.string()
    .min(5, "Geocode must be at least 5 characters")
    .regex(/^[0-9\-]+$/, "Geocode must contain only numbers and hyphens")
    .max(25, "Geocode must be less than 25 characters")
});

export const batchGeocodeSearchSchema = z.object({
  geocodes: z.array(z.string()
    .min(5, "Geocode must be at least 5 characters")
    .regex(/^[0-9\-]+$/, "Geocode must contain only numbers and hyphens")
    .max(25, "Geocode must be less than 25 characters"))
    .min(1, "At least one geocode is required")
    .max(10, "Maximum 10 geocodes allowed per batch")
});

// Polygon geometry schema for parcel boundaries
export const polygonGeometrySchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))) // [[[lng, lat], [lng, lat], ...]]
});

export const propertyInfoSchema = z.object({
  geocode: z.string(),
  address: z.string(),
  county: z.string().optional(),
  coordinates: z.string().optional(),
  legalDescription: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  // Add polygon geometry for parcel boundaries
  parcelGeometry: polygonGeometrySchema.optional()
});

export type GeocodeSearch = z.infer<typeof geocodeSearchSchema>;
export type BatchGeocodeSearch = z.infer<typeof batchGeocodeSearchSchema>;
export type PropertyInfo = z.infer<typeof propertyInfoSchema>;

// Individual result in a batch - can be success or error
export const batchPropertyResultSchema = z.object({
  geocode: z.string(),
  success: z.boolean(),
  data: propertyInfoSchema.optional(),
  error: z.string().optional()
});

export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: propertyInfoSchema.optional(),
  error: z.string().optional()
});

// Batch API response schema
export const batchApiResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(batchPropertyResultSchema),
  totalRequested: z.number(),
  totalSuccessful: z.number(),
  totalFailed: z.number(),
  error: z.string().optional() // For overall batch errors
});

export type BatchPropertyResult = z.infer<typeof batchPropertyResultSchema>;
export type ApiResponse = z.infer<typeof apiResponseSchema>;
export type BatchApiResponse = z.infer<typeof batchApiResponseSchema>;
