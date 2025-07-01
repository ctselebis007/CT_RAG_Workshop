import React, { useState, useRef } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle, Loader, Info } from 'lucide-react';
import { RAGConfig } from './ConfigurationPanel';

interface DocumentUploadProps {
  onFilesProcessed: (documents: ProcessedDocument[]) => void;
  onProcessingStart: () => void;
  isProcessing: boolean;
  config: RAGConfig | null;
}

export interface ProcessedDocument {
  id: string;
  name: string;
  chunks: DocumentChunk[];
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    page: number;
  };
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ 
  onFilesProcessed, 
  onProcessingStart,
  isProcessing,
  config 
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [showPermissionError, setShowPermissionError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        file => file.type === 'application/pdf'
      );
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:application/pdf;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const safeParseJSON = async (response: Response) => {
    try {
      return await response.json();
    } catch (error) {
      // If JSON parsing fails, try to get the response as text for better error reporting
      let responseText = '';
      try {
        responseText = await response.text();
      } catch (textError) {
        responseText = 'Unable to read response';
      }
      
      throw new Error(
        `Server returned invalid JSON (Status: ${response.status}). Response: ${responseText.slice(0, 200)}${responseText.length > 200 ? '...' : ''}`
      );
    }
  };

  const processDocuments = async () => {
    if (files.length === 0 || !config) return;

    onProcessingStart();
    setProcessingStatus('Converting files...');
    setShowPermissionError(false);
    
    try {
      // Convert files to base64
      const filesData = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          content: await fileToBase64(file)
        }))
      );

      setProcessingStatus('Creating vector search index...');
      
      // Create vector search index first
      const indexResponse = await fetch('/api/create-vector-index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mongodbUri: config.mongodbUri,
          databaseName: config.databaseName,
          collectionName: config.collectionName
        }),
      });

      const indexResult = await safeParseJSON(indexResponse);

      if (!indexResponse.ok) {
        // Check if it's a permission error
        if (indexResult.error && (
          indexResult.error.includes('not authorized') ||
          indexResult.error.includes('permission') ||
          indexResult.error.includes('Unauthorized') ||
          indexResult.error.includes('createSearchIndex')
        )) {
          setShowPermissionError(true);
          throw new Error('MongoDB user lacks permissions to create search indexes');
        }
        throw new Error(indexResult.error || 'Failed to create vector search index');
      }

      setProcessingStatus('Processing documents and generating embeddings...');
      
      // Process documents
      const response = await fetch('/api/process-documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: filesData,
          config: config
        }),
      });

      const result = await safeParseJSON(response);

      if (!response.ok) {
        throw new Error(result.error || `Server error (Status: ${response.status})`);
      }
      
      if (result.success) {
        setProcessingStatus('Documents processed successfully!');
        onFilesProcessed(result.documents);
        setFiles([]);
        
        setTimeout(() => setProcessingStatus(''), 3000);
      } else {
        throw new Error(result.error || 'Processing failed');
      }
    } catch (error) {
      setProcessingStatus(`Error: ${error.message}`);
      console.error('Error processing documents:', error);
      setTimeout(() => setProcessingStatus(''), 5000);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isDisabled = !config || isProcessing;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
          <Upload className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Document Upload</h2>
          <p className="text-gray-600">Upload PDF documents to create embeddings</p>
        </div>
      </div>

      {!config && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-800 font-medium">
            Please configure MongoDB and OpenAI settings first.
          </p>
        </div>
      )}

      {/* Permission Error Alert */}
      {showPermissionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-red-800 font-semibold mb-2">MongoDB Permission Error</h3>
              <p className="text-red-700 text-sm mb-3">
                Your MongoDB user doesn't have permission to create search indexes. To fix this:
              </p>
              <ol className="text-red-700 text-sm space-y-1 list-decimal list-inside">
                <li>Go to your MongoDB Atlas dashboard</li>
                <li>Navigate to "Database Access"</li>
                <li>Find your database user and click "Edit"</li>
                <li>Change the role to "Atlas Admin" or create a custom role with "createSearchIndex" privilege</li>
                <li>Save the changes and try again</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-teal-400 bg-teal-50'
            : isDisabled
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf"
          onChange={handleFileSelect}
          disabled={isDisabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDisabled ? 'text-gray-300' : 'text-gray-400'}`} />
        <p className={`text-lg font-medium mb-2 ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
          Drop PDF files here or click to browse
        </p>
        <p className={`${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
          Support for multiple PDF documents up to 10MB each
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Selected Files ({files.length})
          </h3>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <File className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  disabled={isProcessing}
                  className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Process Button */}
      {files.length > 0 && (
        <div className="mt-6">
          <button
            onClick={processDocuments}
            disabled={isDisabled}
            className="w-full bg-gradient-to-r from-teal-600 to-teal-700 text-white py-3 px-6 rounded-lg font-medium hover:from-teal-700 hover:to-teal-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Process Documents
              </>
            )}
          </button>
        </div>
      )}

      {/* Status Message */}
      {processingStatus && (
        <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
          processingStatus.includes('Error') 
            ? 'bg-red-50 text-red-700 border border-red-200'
            : processingStatus.includes('successfully')
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {processingStatus.includes('Error') ? (
            <AlertCircle className="w-5 h-5" />
          ) : processingStatus.includes('successfully') ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <Loader className="w-5 h-5 animate-spin" />
          )}
          <span className="font-medium">{processingStatus}</span>
        </div>
      )}
    </div>
  );
};