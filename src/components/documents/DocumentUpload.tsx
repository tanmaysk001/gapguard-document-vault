import { useState, useCallback } from 'react';
import { useAuth, useUser } from "@clerk/clerk-react";
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/use-toast';
import { Toaster } from "@/components/ui/toaster"
import { Upload, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSupabase } from '@/hooks/useSupabase';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, File as FileIcon } from 'lucide-react';

interface DocumentUploadProps {
  onUploadComplete?: () => void;
}

// Define a type that includes the file and its upload status
type UploadableFile = {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
};

// Helper to call the Edge Function after upload
const processDocument = async ({
  record,
  token
}: {
  record: {
    path: string;
    bucket_id: string;
  },
  token: string
}) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/process_document`;

  return fetch(edgeFunctionUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ record })
  });
};

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const { user } = useUser();
  const supabase = useSupabase();
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadableFile[] = acceptedFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
  });

  const { getToken } = useAuth();

  const handleUpload = async () => {
    if (uploading || !user || !supabase) {
      return;
    }
    setUploading(true);

    const uploadPromises = files.map(async (uploadableFile, index) => {
      if (uploadableFile.status !== 'pending') return;

      setFiles(prev => {
        const newFiles = [...prev];
        newFiles[index].status = 'uploading';
        return newFiles;
      });
      
      const { file } = uploadableFile;
      const filePath = `${user.id}/${file.name}`;

      try {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);
        
        // 2. Create a SIGNED URL to securely access the file in the Edge Function
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(uploadData.path, 300); // URL is valid for 5 minutes

        if (signedUrlError) {
          throw new Error(`Signed URL Error: ${signedUrlError.message}`);
        }

        // 3. Invoke the 'process_document' Edge Function with the secure URL
        const { error: functionError } = await supabase.functions.invoke('process_document', {
          body: { fileUrl: signedUrlData.signedUrl, filePath: uploadData.path, fileName: file.name, fileType: file.type, fileSize: file.size },
        });

        if (functionError) {
          // Attempt to clean up the orphaned file in storage if the function fails
          await supabase.storage.from('documents').remove([uploadData.path]);
          throw new Error(`Function Invoke Error: ${functionError.message}`);
        }

        setFiles(prev => {
          const newFiles = [...prev];
          newFiles[index].status = 'success';
          newFiles[index].progress = 100;
          return newFiles;
        });

      } catch (error: any) {
        setFiles(prev => {
          const newFiles = [...prev];
          newFiles[index].status = 'error';
          newFiles[index].error = error.message;
          return newFiles;
        });
        toast({ title: 'Upload Error', description: error.message, variant: 'destructive' });
      }
    });

      await Promise.all(uploadPromises);
    setUploading(false);
    toast({ title: "Uploads Complete", description: "All files have been processed." });
    if (onUploadComplete) {
    onUploadComplete();
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Documents</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div {...getRootProps()} className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer ${isDragActive ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}>
            <input {...getInputProps()} />
            <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">Drag & drop files here, or click to select files</p>
            <p className="mt-1 text-xs text-gray-500">Supported formats: PDF, DOCX, PNG, JPG</p>
          </div>

          <div className="space-y-2">
            {files.map((uploadableFile, index) => (
              <div key={index} className="flex items-center space-x-2 bg-gray-50 p-2 rounded-md">
                <FileIcon className="h-5 w-5 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium truncate">{uploadableFile.file.name}</p>
                  {uploadableFile.status === 'uploading' && <Progress value={uploadableFile.progress} className="h-2" />}
                  {uploadableFile.status === 'error' && <p className="text-xs text-red-500">{uploadableFile.error}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeFile(index)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onUploadComplete}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || files.length === 0 || files.every(f => f.status !== 'pending')}>
              {uploading ? 'Uploading...' : `Upload ${files.length} File(s)`}
            </Button>
          </div>
        </div>
        <Toaster />
      </CardContent>
    </Card>
  );
}
