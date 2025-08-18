import type { Express } from "express";
import { createServer, type Server } from "http";
import { GeocodeService } from "./services/geocode-service";
import { geocodeSearchSchema, apiResponseSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const geocodeService = new GeocodeService();

  app.post("/api/property/lookup", async (req, res) => {
    try {
      const validation = geocodeSearchSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: validation.error.errors.map(e => e.message).join(', ')
        });
      }

      const { geocode } = validation.data;
      
      const propertyInfo = await geocodeService.getPropertyInfo(geocode);
      
      const response = {
        success: true,
        data: propertyInfo
      };

      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
