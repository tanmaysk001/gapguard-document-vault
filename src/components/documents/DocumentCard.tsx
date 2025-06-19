import { Database } from '@/integrations/supabase/types';
import { StatusBadge } from './StatusBadge';
import { FileText, Image, File, Eye, Download, Trash2, MoreVertical } from 'lucide-react';
import { useState } from 'react';

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
    if (!fileType) return <File className="h-8 w-8 text-gray-400" />;
    
    if (fileType.startsWith('image/')) {
      return <Image className="h-8 w-8 text-blue-500" />;
    }
    if (fileType === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    return <File className="h-8 w-8 text-gray-400" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getFileIcon(document.file_type)}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {document.file_name}
            </h3>
            <p className="text-xs text-gray-500">
              {formatFileSize(document.file_size)}
            </p>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg hover:bg-gray-100"
          >
            <MoreVertical className="h-4 w-4 text-gray-500" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-8 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={() => {
                  onView(document);
                  setShowMenu(false);
                }}
                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </button>
              <button
                onClick={() => {
                  onDownload(document);
                  setShowMenu(false);
                }}
                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </button>
              <button
                onClick={() => {
                  onDelete(document);
                  setShowMenu(false);
                }}
                className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <StatusBadge document={document} />
        
        {document.doc_category && (
          <p className="text-xs text-gray-600">
            Category: {document.doc_category}
          </p>
        )}
        
        {document.expiry_date && (
          <p className="text-xs text-gray-600">
            Expires: {formatDate(document.expiry_date)}
          </p>
        )}
        
        <p className="text-xs text-gray-500">
          Uploaded: {formatDate(document.created_at)}
        </p>
      </div>
    </div>
  );
}
