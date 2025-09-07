import type { Express } from "express";
import { createServer, type Server } from "http";
import { GeocodeService } from "./services/geocode-service";
import { geocodeSearchSchema, apiResponseSchema, batchGeocodeSearchSchema, batchApiResponseSchema } from "@shared/schema";

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

  app.post("/api/property/batch-lookup", async (req, res) => {
    const startedAt = new Date().toISOString();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    try {
      const validation = batchGeocodeSearchSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: validation.error.errors.map(e => e.message).join(', ')
        });
      }

      const { geocodes } = validation.data;
      
      const results = await geocodeService.getPropertiesInfoBatch(geocodes);
      
      const successfulResults = results.filter(r => r.success);
      const failedResults = results.filter(r => !r.success);
      const completedAt = new Date().toISOString();
      
      const response = {
        success: true,
        results,
        totalRequested: geocodes.length,
        totalSuccessful: successfulResults.length,
        totalFailed: failedResults.length,
        batchId,
        startedAt,
        completedAt
      };

      console.log(`Batch lookup completed: ${successfulResults.length}/${geocodes.length} successful`);
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      res.status(500).json({
        success: false,
        results: [],
        totalRequested: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        error: errorMessage,
        batchId,
        startedAt,
        completedAt: new Date().toISOString()
      });
    }
  });

  // Debug endpoint for deployment troubleshooting
  app.get("/api/debug/environment", (req, res) => {
    res.json({
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      isDeployment: !!process.env.REPLIT_DEPLOYMENT,
      platform: process.platform,
      cwd: process.cwd(),
      timestamp: new Date().toISOString()
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
