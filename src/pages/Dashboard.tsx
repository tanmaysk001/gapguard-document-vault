
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '@/integrations/supabase/client';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { StatusBadge } from '@/components/documents/StatusBadge';
import { Database } from '@/integrations/supabase/types';
import { Grid3X3, List, Filter, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Document = Database['public']['Tables']['documents']['Row'];

const filterOptions = [
  { key: 'all', label: 'All Documents' },
  { key: 'valid', label: 'Valid' },
  { key: 'expiring_soon', label: 'Expiring Soon' },
  { key: 'expired', label: 'Expired' },
  { key: 'processing', label: 'Processing' }
];

export default function Dashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();

  const fetchDocuments = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Set up realtime subscription
    const channel = supabase
      .channel('document-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const filteredDocuments = documents.filter(doc => {
    if (activeFilter === 'all') return true;
    return doc.status === activeFilter;
  });

  const getDocumentStats = () => {
    const total = documents.length;
    const valid = documents.filter(doc => doc.status === 'valid').length;
    const expiring = documents.filter(doc => doc.status === 'expiring_soon').length;
    const expired = documents.filter(doc => doc.status === 'expired').length;
    const processing = documents.filter(doc => doc.status === 'processing').length;
    
    return { total, valid, expiring, expired, processing };
  };

  const stats = getDocumentStats();

  const handleView = (document: Document) => {
    window.open(document.file_url, '_blank');
  };

  const handleDownload = (document: Document) => {
    const link = window.document.createElement('a');
    link.href = document.file_url;
    link.download = document.file_name;
    link.click();
  };

  const handleDelete = async (document: Document) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Document deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Manage your documents and track their status</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Upload className="h-4 w-4" />
          <span>Upload Documents</span>
        </button>
      </div>

      {/* Upload Section */}
      {showUpload && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <DocumentUpload onUploadComplete={() => setShowUpload(false)} />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Documents</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{stats.valid}</div>
          <div className="text-sm text-gray-600">Valid</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-orange-600">{stats.expiring}</div>
          <div className="text-sm text-gray-600">Expiring Soon</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          <div className="text-sm text-gray-600">Expired</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-600">{stats.processing}</div>
          <div className="text-sm text-gray-600">Processing</div>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => setActiveFilter(option.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === option.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${
              viewMode === 'grid' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${
              viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Documents */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
          <p className="text-gray-600 mb-4">
            {activeFilter === 'all' 
              ? "Upload your first document to get started"
              : `No documents with status "${activeFilter}"`
            }
          </p>
          {activeFilter === 'all' && (
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Documents
            </button>
          )}
        </div>
      ) : (
        <div className={`${
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-4'
        }`}>
          {filteredDocuments.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              onView={handleView}
              onDownload={handleDownload}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
