import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GeocodeService } from "./services/geocode-service";
import { geocodeSearchSchema, apiResponseSchema, batchGeocodeSearchSchema, batchApiResponseSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const geocodeService = new GeocodeService();
  
  // Create HTTP server
  const server = createServer(app);
  
  // Create WebSocket server on distinct path to avoid conflicts with Vite's HMR websocket
  const wss = new WebSocketServer({ server: server, path: '/ws' });
  
  // Store active WebSocket connections by batch ID
  const batchConnections = new Map<string, Set<WebSocket>>();
  
  // WebSocket connection handler
  wss.on('connection', (ws: WebSocket, req) => {
    console.log('WebSocket connection established');
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'subscribe_batch' && message.batchId) {
          // Subscribe to batch progress updates
          if (!batchConnections.has(message.batchId)) {
            batchConnections.set(message.batchId, new Set());
          }
          batchConnections.get(message.batchId)!.add(ws);
          
          console.log(`WebSocket subscribed to batch: ${message.batchId}`);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      // Remove from all batch subscriptions
      for (const [batchId, connections] of Array.from(batchConnections.entries())) {
        connections.delete(ws);
        if (connections.size === 0) {
          batchConnections.delete(batchId);
        }
      }
      console.log('WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  // Helper function to broadcast progress updates
  function broadcastProgress(batchId: string, progressData: any) {
    const connections = batchConnections.get(batchId);
    if (!connections) return;
    
    const message = JSON.stringify({
      type: 'batch_progress',
      batchId,
      ...progressData
    });
    
    for (const ws of Array.from(connections)) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

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
      
      // Send initial progress update
      broadcastProgress(batchId, {
        status: 'started',
        totalGeocodes: geocodes.length,
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        currentGeocode: null,
        estimatedTimeRemaining: null,
        startedAt
      });
      
      // Process with progress updates
      const results = await geocodeService.getPropertiesInfoBatchWithProgress(
        geocodes, 
        batchId,
        (progress) => broadcastProgress(batchId, progress)
      );
      
      const successfulResults = results.filter(r => r.success);
      const failedResults = results.filter(r => !r.success);
      const completedAt = new Date().toISOString();
      
      // Send completion progress update
      broadcastProgress(batchId, {
        status: 'completed',
        totalGeocodes: geocodes.length,
        processedCount: geocodes.length,
        successCount: successfulResults.length,
        failedCount: failedResults.length,
        currentGeocode: null,
        estimatedTimeRemaining: 0,
        completedAt
      });
      
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
      
      // Send error progress update
      broadcastProgress(batchId, {
        status: 'error',
        error: errorMessage
      });
      
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

  return server;
}
