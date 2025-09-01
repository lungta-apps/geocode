import { z } from "zod";

export const geocodeSearchSchema = z.object({
  geocode: z.string()
    .min(5, "Geocode must be at least 5 characters")
    .regex(/^[0-9\-]+$/, "Geocode must contain only numbers and hyphens")
    .max(25, "Geocode must be less than 25 characters")
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
export type PropertyInfo = z.infer<typeof propertyInfoSchema>;

export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: propertyInfoSchema.optional(),
  error: z.string().optional()
});

export type ApiResponse = z.infer<typeof apiResponseSchema>;
