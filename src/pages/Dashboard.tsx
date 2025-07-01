import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useSupabase } from '@/hooks/useSupabase';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { StatusBadge } from '@/components/documents/StatusBadge';
import { Database } from '@/integrations/supabase/types';
import { Grid3X3, List, Upload } from 'lucide-react';
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
  const supabase = useSupabase();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (supabase) {
  const fetchDocuments = async () => {
        setLoading(true);
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

        if (error) {
      console.error('Error fetching documents:', error);
      toast({
            title: "Error fetching documents",
            description: error.message,
        variant: "destructive"
      });
        } else {
          setDocuments(data || []);
        }
      setLoading(false);
  };

    fetchDocuments();
    }
  }, [supabase, user, toast]);

  useEffect(() => {
    if (!user || !supabase) return;

    const channel = supabase
      .channel('document-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents'
        },
        (payload) => {
          console.log('Change received!', payload);
          supabase.from('documents').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
            if (error) {
              console.error('Error re-fetching documents:', error);
            } else {
              setDocuments(data || []);
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

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

  const handleView = async (document: Document) => {
    let filePath = document.file_path;
    if (!filePath) {
      filePath = `${document.user_id}/${document.file_name}`;
    }

    if (!filePath || filePath.trim() === '') {
        alert("Error: File path is empty. Cannot view document.");
        return;
    }

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60); // 60 seconds validity

    if (error || !data?.signedUrl) {
      alert('Could not create a secure link for this document.');
      console.error("Error creating signed URL:", error);
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleDownload = async (document: Document) => {
    let filePath = document.file_path;
    if (!filePath) {
      filePath = `${document.user_id}/${document.file_name}`;
    }

    if (!filePath || filePath.trim() === '') {
        alert("Error: File path is empty. Cannot download document.");
        return;
    }

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60, {
        download: true,
      });

    if (error || !data?.signedUrl) {
      alert('Could not create a secure download link for this document.');
      console.error("Error creating signed URL for download:", error);
      return;
    }

    const link = window.document.createElement('a');
    link.href = data.signedUrl;
    // The 'download' attribute is handled by the signed URL 'download:true' option
    link.click();
  };

  const handleDelete = async (document: Document) => {
    if (!confirm('Are you sure you want to delete this document? This action is irreversible.')) return;

    if (!document.file_path) {
      toast({ title: "Error", description: "File path is missing, cannot delete from storage.", variant: "destructive" });
      return;
    }

    try {
      // Step 1: Delete the file from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.file_path]);

      if (storageError) {
        // Log the error but still attempt to delete the DB record if the file doesn't exist.
        // This handles cases where the storage object was already deleted manually.
        if (storageError.message !== 'The resource was not found') {
          throw new Error(`Storage Error: ${storageError.message}`);
        }
      }

      // Step 2: Delete the record from the database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (dbError) {
        throw new Error(`Database Error: ${dbError.message}`);
      }

      toast({
        title: "Success",
        description: `${document.file_name} has been deleted.`,
      });
      
      // The real-time subscription will handle the UI update automatically.
      // No need to call fetchDocuments() manually.

    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast({
        title: "Deletion Failed",
        description: error.message,
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
          <DocumentUpload onUploadComplete={() => {
            setShowUpload(false);
          }} />
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
        <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
          {filterOptions.map(option => (
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

      {/* Document Display Area */}
      {filteredDocuments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDocuments.map(doc => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onView={handleView}
              onDownload={handleDownload}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900">No documents found.</h3>
          <p className="text-sm text-gray-500 mt-2">
            Click the "Upload Documents" button to get started.
          </p>
        </div>
      )}
    </div>
  );
}
