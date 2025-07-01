import { Database } from '@/integrations/supabase/types';
import { StatusBadge } from './StatusBadge';
import { FileText, Image, File, Eye, Download, Trash2, MoreVertical, Calendar, Info } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Document = Database['public']['Tables']['documents']['Row'];

interface DocumentCardProps {
  document: Document;
  onView: (document: Document) => void;
  onDownload: (document: Document) => void;
  onDelete: (document: Document) => void;
}

export function DocumentCard({ document, onView, onDownload, onDelete }: DocumentCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-10 w-10 text-gray-500" />;
    
    const baseClass = "h-10 w-10";
    if (fileType.startsWith('image/')) {
      return <Image className={`${baseClass} text-blue-500`} />;
    }
    if (fileType === 'application/pdf') {
      return <FileText className={`${baseClass} text-red-500`} />;
    }
    return <File className={`${baseClass} text-gray-500`} />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div 
      className="bg-white rounded-xl border border-gray-200/80 p-4 transition-all hover:shadow-lg hover:border-gray-300 flex flex-col justify-between h-full cursor-pointer"
      onClick={() => onView(document)}
    >
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="bg-gray-100 p-3 rounded-lg">
          {getFileIcon(document.file_type)}
            </div>
          <div className="flex-1 min-w-0">
              <h3 className="text-md font-semibold text-gray-800 truncate" title={document.file_name}>
              {document.file_name}
            </h3>
              <p className="text-sm text-gray-500">
              {formatFileSize(document.file_size)}
            </p>
          </div>
        </div>
        
        <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(p => !p);
              }}
              onBlur={() => setTimeout(() => setShowMenu(false), 200)}
          >
              <MoreVertical className="h-5 w-5 text-gray-500" />
            </Button>
          
          {showMenu && (
              <div className="absolute right-0 top-10 w-40 bg-white rounded-lg shadow-xl border border-gray-100 py-1.5 z-10">
                <MenuItem icon={<Eye className="h-4 w-4" />} onClick={(e) => { e.stopPropagation(); onView(document); }}>View</MenuItem>
                <MenuItem icon={<Download className="h-4 w-4" />} onClick={(e) => { e.stopPropagation(); onDownload(document); }}>Download</MenuItem>
                <MenuItem icon={<Trash2 className="h-4 w-4" />} onClick={(e) => { e.stopPropagation(); onDelete(document); }} isDestructive>Delete</MenuItem>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <StatusBadge document={document} />
          
          <div className="flex items-center text-xs text-gray-600 gap-2">
            <Info className="h-3.5 w-3.5" />
            Category: <span className="font-medium capitalize">{document.doc_category?.replace(/_/g, ' ') || 'Unclassified'}</span>
          </div>
          
          {document.expiry_date && (
            <div className="flex items-center text-xs text-gray-600 gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Expires: <span className="font-medium">{formatDate(document.expiry_date)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
         <p className="text-xs text-gray-400 text-center">
          Uploaded: {formatDate(document.created_at)}
        </p>
      </div>
    </div>
  );
}

// Helper component for menu items to reduce repetition
const MenuItem = ({ icon, children, onClick, isDestructive = false }: { icon: React.ReactNode, children: React.ReactNode, onClick: (e: React.MouseEvent) => void, isDestructive?: boolean }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick(e);
    }}
    className={`flex items-center w-full px-3.5 py-2 text-sm text-left gap-2.5 transition-colors ${
      isDestructive 
        ? 'text-red-600 hover:bg-red-50' 
        : 'text-gray-700 hover:bg-gray-100'
    }`}
  >
    {icon}
    {children}
  </button>
);
