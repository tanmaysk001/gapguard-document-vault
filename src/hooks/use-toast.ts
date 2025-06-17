
import { toast as sonnerToast } from "sonner";

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export const useToast = () => {
  const toast = ({ title, description, variant = "default" }: ToastProps) => {
    if (variant === "destructive") {
      sonnerToast.error(title || "Error", {
        description,
      });
    } else {
      sonnerToast.success(title || "Success", {
        description,
      });
    }
  };

  // Return empty toasts array since we're using sonner directly
  return { 
    toast,
    toasts: [] // Empty array to satisfy the Toaster component
  };
};

// Export the toast function directly as well
export const toast = ({ title, description, variant = "default" }: ToastProps) => {
  if (variant === "destructive") {
    sonnerToast.error(title || "Error", {
      description,
    });
  } else {
    sonnerToast.success(title || "Success", {
      description,
    });
  }
};
