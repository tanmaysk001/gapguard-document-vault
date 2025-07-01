import { useState, useEffect } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { Database } from '@/integrations/supabase/types';
import { Folder, File, FileText, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DocumentCard } from '@/components/documents/DocumentCard';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Document = Database['public']['Tables']['documents']['Row'];

export default function DocumentsPage() {
  const supabase = useSupabase();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const fetchDocuments = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('documents').select('*');
      if (error) {
        toast({ title: "Error fetching documents", description: error.message, variant: "destructive" });
      } else {
        setDocuments(data || []);
      }
      setLoading(false);
    };
    fetchDocuments();
  }, [supabase, toast]);
  
  const handleSuggestRules = async () => {
    if (!supabase) return;
    setIsSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest_rules', {
        method: 'POST',
      });

      if (error) throw error;
      
      toast({
        title: "Suggestions Generated",
        description: data.message || "AI-powered rule suggestions have been added for your review.",
      });

    } catch (error: any) {
      toast({
        title: "Error Generating Suggestions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSuggesting(false);
    }
  };
  
  const handleDelete = async (document: Document): Promise<void> => {
    if (!supabase) return;
    if (!document.file_path) {
      toast({ title: "Error", description: "File path is missing, cannot delete from storage.", variant: "destructive" });
      return;
    }

    // Step 1: Delete the record from the database
    const { error: dbError } = await supabase.from('documents').delete().eq('id', document.id);
    if (dbError) {
      toast({ title: "Database Error", description: dbError.message, variant: "destructive" });
      return;
    }

    // Step 2: Delete the file from Supabase Storage
    const { error: storageError } = await supabase.storage.from('documents').remove([document.file_path]);
    if (storageError && storageError.message !== 'The resource was not found') {
      // Log the error but don't rollback DB deletion
      console.error('Storage deletion failed after DB delete:', storageError);
      toast({ title: "Warning", description: "Database record deleted, but failed to remove file from storage.", variant: "destructive" });
    }

    setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== document.id));
    toast({ title: "Success", description: `${document.file_name} deleted.` });
  };
  
  const handleView = async (document: Document): Promise<void> => {
    if (!supabase) return;
    if (!document.file_path) {
      toast({ title: "Error", description: "File path is missing, cannot view document.", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.file_path, 60);

    if (error || !data?.signedUrl) {
      toast({ title: "Error", description: "Could not create a secure link.", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleDownload = async (document: Document): Promise<void> => {
    if (!supabase) return;
    if (!document.file_path) {
      toast({ title: "Error", description: "File path is missing, cannot download document.", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.file_path, 60, { download: true });

    if (error || !data?.signedUrl) {
      toast({ title: "Error", description: "Could not create a download link.", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(searchQuery);
  };

  const filteredDocuments = documents.filter(doc => 
    doc.file_name?.toLowerCase().includes(submittedQuery.toLowerCase())
  );

  const groupedDocuments = filteredDocuments.reduce((acc, doc) => {
    const docCategory = doc.doc_category || 'Unclassified';
    if (!acc[docCategory]) {
      acc[docCategory] = [];
    }
    acc[docCategory].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  const handleFolderClick = (folderName: string) => {
    setSelectedFolder(folderName);
  };

  const handleBackToFolders = () => {
    setSelectedFolder(null);
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
      <div className="flex justify-between items-center">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#" onClick={handleBackToFolders} className={selectedFolder ? 'cursor-pointer' : ''}>
              Documents
            </BreadcrumbLink>
          </BreadcrumbItem>
          {selectedFolder && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="capitalize">{selectedFolder.replace(/_/g, ' ')}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
        <Button onClick={handleSuggestRules} disabled={isSuggesting}>
          {isSuggesting ? 'Generating...' : 'Suggest Rules'}
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex items-center gap-2 mb-4">
        <Input 
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-grow"
        />
        <Button type="submit">Search</Button>
      </form>
      
      {!selectedFolder ? (
        // Folder View
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {Object.entries(groupedDocuments).map(([docType, docs]) => (
            <div
              key={docType}
              className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border border-gray-200 hover:shadow-lg hover:border-blue-500 cursor-pointer transition-all"
              onClick={() => handleFolderClick(docType)}
            >
              <Folder className="h-16 w-16 text-blue-500 mb-2" />
              <span className="font-medium text-center text-sm capitalize">{docType.replace(/_/g, ' ')}</span>
              <span className="text-xs text-gray-500">{docs.length} item(s)</span>
            </div>
          ))}
        </div>
      ) : (
        // Document View inside a folder
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(groupedDocuments[selectedFolder] || []).map(doc => (
              <DocumentCard key={doc.id} document={doc} onView={handleView} onDownload={handleDownload} onDelete={handleDelete} />
            ))}
          </div>
          {submittedQuery && filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">No documents found for "{submittedQuery}".</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 