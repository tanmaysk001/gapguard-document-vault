
import { Database } from '@/integrations/supabase/types';

type Status = Database['public']['Enums']['document_status'];

interface StatusBadgeProps {
  status: Status;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusConfig = (status: Status) => {
    switch (status) {
      case 'valid':
        return {
          label: 'Valid',
          className: 'bg-green-100 text-green-800 border-green-200'
        };
      case 'expiring_soon':
        return {
          label: 'Expiring Soon',
          className: 'bg-orange-100 text-orange-800 border-orange-200'
        };
      case 'expired':
        return {
          label: 'Expired',
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      case 'processing':
        return {
          label: 'Processing',
          className: 'bg-gray-100 text-gray-800 border-gray-200'
        };
      default:
        return {
          label: 'Unknown',
          className: 'bg-gray-100 text-gray-800 border-gray-200'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
}
