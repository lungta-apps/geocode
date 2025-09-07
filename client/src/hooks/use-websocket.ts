import { useEffect, useRef, useState, useCallback } from 'react';

export interface BatchProgress {
  type: 'batch_progress';
  batchId: string;
  status: 'started' | 'processing' | 'completed' | 'error';
  totalGeocodes?: number;
  processedCount?: number;
  successCount?: number;
  failedCount?: number;
  currentGeocode?: string | null;
  estimatedTimeRemaining?: number | null;
  processingRate?: number;
  elapsedTime?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface UseWebSocketOptions {
  onMessage?: (data: BatchProgress) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onMessage, onConnect, onDisconnect, onError } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }
    
    if (isConnecting) {
      return; // Already attempting to connect
    }
    
    setIsConnecting(true);
    
    try {
      // Use correct protocol and path as per blueprint guidelines
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttempts.current = 0;
        onConnect?.();
      };
      
      ws.onmessage = (event) => {
        try {
          const data: BatchProgress = JSON.parse(event.data);
          onMessage?.(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        onDisconnect?.();
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnecting(false);
        onError?.(error);
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnecting(false);
    }
  }, [onMessage, onConnect, onDisconnect, onError, isConnecting]);
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    reconnectAttempts.current = maxReconnectAttempts; // Prevent automatic reconnection
  }, []);
  
  const subscribeToBatch = useCallback((batchId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'subscribe_batch',
        batchId
      };
      wsRef.current.send(JSON.stringify(message));
      console.log(`Subscribed to batch progress: ${batchId}`);
    } else {
      console.warn('WebSocket not connected, cannot subscribe to batch');
    }
  }, []);
  
  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    subscribeToBatch
  };
}