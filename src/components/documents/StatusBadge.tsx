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
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    
    // Set hours to 0 to compare dates only
    now.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    
    if (expiry < now) {
      return {
        label: 'Expired',
        className: 'bg-red-100 text-red-800 border-red-200'
      };
    }
    
    if (expiry <= thirtyDaysFromNow) {
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
