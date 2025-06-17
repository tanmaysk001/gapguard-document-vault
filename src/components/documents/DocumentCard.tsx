
import { MoreVertical, Download, Trash2, Eye, FileText, Image, File } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { Database } from '@/integrations/supabase/types';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Document = Database['public']['Tables']['documents']['Row'];

interface DocumentCardProps {
  document: Document;
  onView?: (document: Document) => void;
  onDownload?: (document: Document) => void;
  onDelete?: (document: Document) => void;
}

export function DocumentCard({ document, onView, onDownload, onDelete }: DocumentCardProps) {
  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-8 w-8 text-gray-400" />;
    if (fileType.startsWith('image/')) return <Image className="h-8 w-8 text-blue-500" />;
    if (fileType === 'application/pdf') return <FileText className="h-8 w-8 text-red-500" />;
    return <File className="h-8 w-8 text-gray-400" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {getFileIcon(document.file_type)}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {document.file_name}
            </h3>
            <p className="text-xs text-gray-500">
              {document.doc_category && (
                <span className="capitalize">{document.doc_category} • </span>
              )}
              {formatFileSize(document.file_size)}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView?.(document)}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload?.(document)}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete?.(document)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        <StatusBadge status={document.status || 'processing'} />
        
        <div className="text-xs text-gray-500">
          <div>Uploaded: {format(new Date(document.created_at || ''), 'MMM dd, yyyy')}</div>
          {document.expiry_date && (
            <div>Expires: {format(new Date(document.expiry_date), 'MMM dd, yyyy')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
