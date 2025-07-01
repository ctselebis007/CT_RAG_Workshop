import React, { useState, useRef } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle, Loader, Info, FileText, FileSpreadsheet } from 'lucide-react';
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

const SUPPORTED_FILE_TYPES = {
  'application/pdf': { ext: 'PDF', icon: FileText, color: 'text-red-500' },
  'text/plain': { ext: 'TXT', icon: FileText, color: 'text-gray-500' },
  'text/csv': { ext: 'CSV', icon: FileSpreadsheet, color: 'text-green-500' },
  'application/csv': { ext: 'CSV', icon: FileSpreadsheet, color: 'text-green-500' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'DOCX', icon: FileText, color: 'text-blue-500' },
  'application/msword': { ext: 'DOC', icon: FileText, color: 'text-blue-600' }
};

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.csv', '.doc', '.docx'];

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ 
  onFilesProcessed, 
  onProcessingStart,
  isProcessing,
  config 
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFileSupported = (file: File): boolean => {
    const hasValidType = Object.keys(SUPPORTED_FILE_TYPES).includes(file.type);
    const hasValidExtension = ACCEPTED_EXTENSIONS.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    return hasValidType || hasValidExtension;
  };

  const getFileIcon = (file: File) => {
    const fileInfo = SUPPORTED_FILE_TYPES[file.type];
    if (fileInfo) return fileInfo;
    
    // Fallback based on extension
    const extension = file.name.toLowerCase().split('.').pop();
    switch (extension) {
      case 'pdf': return { ext: 'PDF', icon: FileText, color: 'text-red-500' };
      case 'txt': return { ext: 'TXT', icon: FileText, color: 'text-gray-500' };
      case 'csv': return { ext: 'CSV', icon: FileSpreadsheet, color: 'text-green-500' };
      case 'docx': return { ext: 'DOCX', icon: FileText, color: 'text-blue-500' };
      case 'doc': return { ext: 'DOC', icon: FileText, color: 'text-blue-600' };
      default: return { ext: 'FILE', icon: FileText, color: 'text-gray-400' };
    }
  };

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
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(isFileSupported);
    
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(isFileSupported);
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
        // Remove the data URL prefix to get just the base64 content
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
    
    try {
      // Convert files to base64
      const filesData = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          type: file.type,
          content: await fileToBase64(file)
        }))
      );

      setProcessingStatus('Processing documents and generating embeddings...');
      
      // Process documents (vector index should already be created during configuration)
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
          <p className="text-gray-600">Upload documents to create embeddings</p>
        </div>
      </div>

      {!config && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-800 font-medium">
            Please configure MongoDB and OpenAI settings first.
          </p>
        </div>
      )}

      {/* Supported File Types Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-blue-800 font-semibold mb-2">Supported File Types</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-500" />
                <span className="text-blue-700">PDF Documents</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-blue-700">Text Files (.txt)</span>
              </div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-green-500" />
                <span className="text-blue-700">CSV Files</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <span className="text-blue-700">Word Documents (.doc, .docx)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
          accept=".pdf,.txt,.csv,.doc,.docx,application/pdf,text/plain,text/csv,application/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileSelect}
          disabled={isDisabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDisabled ? 'text-gray-300' : 'text-gray-400'}`} />
        <p className={`text-lg font-medium mb-2 ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
          Drop files here or click to browse
        </p>
        <p className={`${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
          Support for PDF, TXT, CSV, DOC, and DOCX files up to 10MB each
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Selected Files ({files.length})
          </h3>
          <div className="space-y-2">
            {files.map((file, index) => {
              const fileInfo = getFileIcon(file);
              const IconComponent = fileInfo.icon;
              
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className={`w-5 h-5 ${fileInfo.color}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${fileInfo.color} bg-opacity-10`}>
                          {fileInfo.ext}
                        </span>
                      </div>
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
              );
            })}
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