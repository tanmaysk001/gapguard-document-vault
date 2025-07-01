import { Database } from '@/integrations/supabase/types';

type Document = Database['public']['Tables']['documents']['Row'];

interface StatusBadgeProps {
  document: Document;
}

export function StatusBadge({ document }: StatusBadgeProps) {
  const getStatusConfig = (doc: Document) => {
    // If the document is still processing, that's the highest priority status.
    if (doc.status === 'processing') {
      return {
        label: 'Processing',
        className: 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse'
      };
    }

    const { expiry_date } = doc;
    if (!expiry_date) {
      return {
        label: 'Valid',
        className: 'bg-green-100 text-green-800 border-green-200'
      };
    }

    const now = new Date();
    const expiry = new Date(expiry_date);

    // Create new Date objects for the start of the day to avoid mutation
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfExpiry = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    
    const thirtyDaysFromNow = new Date(startOfToday);
    thirtyDaysFromNow.setDate(startOfToday.getDate() + 30);
    
    if (startOfExpiry < startOfToday) {
      return {
        label: 'Expired',
        className: 'bg-red-100 text-red-800 border-red-200'
      };
    }
    
    if (startOfExpiry <= thirtyDaysFromNow) {
      return {
        label: 'Expiring Soon',
        className: 'bg-orange-100 text-orange-800 border-orange-200'
      };
    }
    
    return {
      label: 'Valid',
      className: 'bg-green-100 text-green-800 border-green-200'
    };
  };

  const config = getStatusConfig(document);

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
}
