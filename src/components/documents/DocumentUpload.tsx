
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image, File } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  error?: string;
}

export function DocumentUpload({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const [filesToUpload, setFilesToUpload] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      progress: 0
    }));
    setFilesToUpload(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  });

  const removeFile = (id: string) => {
    setFilesToUpload(prev => prev.filter(f => f.id !== id));
  };

  const handleUploadFiles = async () => {
    if (!user || filesToUpload.length === 0) return;

    setIsUploading(true);
    
    for (const uploadFile of filesToUpload) {
      try {
        const fileExt = uploadFile.file.name.split('.').pop();
        const fileName = `${uploadFile.file.name}`;
        const filePath = `${user.id}/${fileName}`;

        // Update progress
        setFilesToUpload(prev => 
          prev.map(f => f.id === uploadFile.id ? { ...f, progress: 30 } : f)
        );

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, uploadFile.file);

        if (uploadError) throw uploadError;

        setFilesToUpload(prev => 
          prev.map(f => f.id === uploadFile.id ? { ...f, progress: 60 } : f)
        );

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        // Create document record
        const { error: dbError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            file_name: uploadFile.file.name,
            file_url: publicUrl,
            file_type: uploadFile.file.type,
            file_size: uploadFile.file.size,
            status: 'processing'
          });

        if (dbError) throw dbError;

        setFilesToUpload(prev => 
          prev.map(f => f.id === uploadFile.id ? { ...f, progress: 100 } : f)
        );

      } catch (error) {
        console.error('Upload error:', error);
        setFilesToUpload(prev => 
          prev.map(f => f.id === uploadFile.id ? { 
            ...f, 
            error: error instanceof Error ? error.message : 'Upload failed' 
          } : f)
        );
      }
    }

    setIsUploading(false);
    
    setTimeout(() => {
      setFilesToUpload([]);
      onUploadComplete?.();
      toast({
        title: "Upload Complete",
        description: "Your documents have been uploaded successfully.",
      });
    }, 1000);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (fileType === 'application/pdf') return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-lg font-medium text-gray-900 mb-2">
          {isDragActive ? 'Drop files here' : 'Upload Documents'}
        </p>
        <p className="text-sm text-gray-500">
          Drag and drop files here, or click to select files
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Supports PDF, JPG, PNG, DOCX (max 10MB)
        </p>
      </div>

      {filesToUpload.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">Files to upload</h3>
            <button
              onClick={handleUploadFiles}
              disabled={isUploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isUploading ? 'Uploading...' : 'Upload All'}
            </button>
          </div>

          <div className="space-y-2">
            {filesToUpload.map((uploadFile) => (
              <div key={uploadFile.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3 flex-1">
                  {getFileIcon(uploadFile.file.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {uploadFile.progress > 0 && (
                    <div className="w-20">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadFile.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {uploadFile.error && (
                    <span className="text-xs text-red-600">{uploadFile.error}</span>
                  )}

                  <button
                    onClick={() => removeFile(uploadFile.id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
