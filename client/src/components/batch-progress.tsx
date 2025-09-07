import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, Zap, X, Loader2 } from 'lucide-react';
import { BatchProgress as BatchProgressType, useWebSocket } from '@/hooks/use-websocket';

interface BatchProgressProps {
  batchId: string;
  initialTotal?: number;
  onCancel?: () => void;
  onComplete?: () => void;
  className?: string;
}

export function BatchProgress({ 
  batchId, 
  initialTotal = 0, 
  onCancel, 
  onComplete,
  className = ""
}: BatchProgressProps) {
  const [progress, setProgress] = useState<BatchProgressType | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [animationClass, setAnimationClass] = useState('animate-in');

  const { isConnected, subscribeToBatch } = useWebSocket({
    onMessage: (data) => {
      if (data.batchId === batchId) {
        setProgress(data);
        
        if (data.status === 'completed' || data.status === 'error') {
          setTimeout(() => {
            onComplete?.();
          }, 2000); // Auto-dismiss after 2 seconds
        }
      }
    },
    onConnect: () => {
      subscribeToBatch(batchId);
    }
  });

  useEffect(() => {
    if (isConnected) {
      subscribeToBatch(batchId);
    }
  }, [isConnected, batchId, subscribeToBatch]);

  const handleClose = () => {
    setAnimationClass('animate-out');
    setTimeout(() => {
      setIsVisible(false);
      onCancel?.();
    }, 300);
  };

  if (!isVisible) return null;

  const totalGeocodes = progress?.totalGeocodes || initialTotal;
  const processedCount = progress?.processedCount || 0;
  const successCount = progress?.successCount || 0;
  const failedCount = progress?.failedCount || 0;
  const progressPercentage = totalGeocodes > 0 ? (processedCount / totalGeocodes) * 100 : 0;
  
  const formatTime = (seconds: number | null | undefined) => {
    if (!seconds || seconds <= 0) return 'Calculating...';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusColor = () => {
    switch (progress?.status) {
      case 'completed': return 'bg-green-600';
      case 'error': return 'bg-red-600';
      case 'processing': return 'bg-blue-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusText = () => {
    switch (progress?.status) {
      case 'started': return 'Initializing batch processing...';
      case 'processing': return `Processing ${progress.currentGeocode || 'geocodes'}...`;
      case 'completed': return 'Batch processing completed!';
      case 'error': return `Error: ${progress.error || 'Processing failed'}`;
      default: return 'Connecting...';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 w-96 transition-all duration-300 ${animationClass} ${className}`}>
      <Card className="bg-surface border-gray-700 shadow-xl backdrop-blur-sm bg-opacity-95">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-on-surface flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${progress?.status === 'processing' ? 'animate-pulse' : ''}`} />
              <span>Batch Progress</span>
            </CardTitle>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-gray-700"
              data-testid="button-close-progress"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Status Message */}
          <div className="text-sm text-on-surface-variant">
            {getStatusText()}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-on-surface-variant">
              <span>{processedCount} of {totalGeocodes} processed</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress 
              value={progressPercentage} 
              className="h-2 bg-surface-variant"
              data-testid="progress-bar"
            />
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between p-2 bg-surface-variant rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-xs text-on-surface">Success</span>
              </div>
              <Badge variant="secondary" className="bg-green-800 text-green-100">
                {successCount}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-surface-variant rounded-lg">
              <div className="flex items-center space-x-2">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-xs text-on-surface">Failed</span>
              </div>
              <Badge variant="secondary" className="bg-red-800 text-red-100">
                {failedCount}
              </Badge>
            </div>
          </div>

          {/* Timing Information */}
          {progress?.status === 'processing' && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-2 p-2 bg-surface-variant rounded-lg">
                <Clock className="h-3 w-3 text-blue-400" />
                <div>
                  <div className="text-on-surface-variant">ETA</div>
                  <div className="text-on-surface font-medium">
                    {formatTime(progress.estimatedTimeRemaining)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 p-2 bg-surface-variant rounded-lg">
                <Zap className="h-3 w-3 text-yellow-400" />
                <div>
                  <div className="text-on-surface-variant">Rate</div>
                  <div className="text-on-surface font-medium">
                    {progress.processingRate || 0}/min
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connection Status */}
          <div className="flex items-center justify-between text-xs text-on-surface-variant border-t border-gray-600 pt-2">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            {progress?.elapsedTime && (
              <span>Elapsed: {formatTime(progress.elapsedTime)}</span>
            )}
          </div>

          {/* Action Buttons */}
          {(progress?.status === 'error' || progress?.status === 'completed') && (
            <div className="flex justify-end space-x-2 pt-2">
              <Button
                onClick={handleClose}
                variant="secondary"
                size="sm"
                className="bg-surface-variant hover:bg-gray-600"
                data-testid="button-dismiss"
              >
                Dismiss
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// CSS for animations (add to index.css)
export const progressAnimationStyles = `
  .animate-in {
    animation: slideInRight 0.3s ease-out forwards;
  }
  
  .animate-out {
    animation: slideOutRight 0.3s ease-in forwards;
  }
  
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;