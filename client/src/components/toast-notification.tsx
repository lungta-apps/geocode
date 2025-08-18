import { useEffect } from "react";
import { CheckCircle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastNotificationProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

export function ToastNotification({
  message,
  type,
  onClose,
  duration = 5000
}: ToastNotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info
  };

  const colors = {
    success: "bg-green-600 dark:bg-green-700",
    error: "bg-red-600 dark:bg-red-700",
    info: "bg-blue-600 dark:bg-blue-700"
  };

  const Icon = icons[type];

  return (
    <div
      className={cn(
        "flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg text-white animate-in slide-in-from-right-full",
        colors[type]
      )}
      role="alert"
      aria-live="polite"
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-current ml-2"
        aria-label="Dismiss notification"
        data-testid="toast-close"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}
