import React, { useState, useRef } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle, Loader, Info, FileText, FileSpreadsheet, Presentation } from 'lucide-react';
import { RAGConfig } from './ConfigurationPanel';

interface DocumentUploadProps {
  onFilesProcessed: (documents: ProcessedDocument[]) => void;
  onProcessingStart: () => void;
  onStatsUpdate?: (stats: { totalDocuments: number; totalChunks: number }) => void;
  isProcessing: boolean;
  config: RAGConfig | null;
}

export interface ProcessedDocument {
  id: string;
  name: string;
  chunks: DocumentChunk[];
  processingStats?: {
    fileName: string;
    fileType: string;
    fileSize: string;
    status: string;
    chunksCreated: number;
    originalDocuments: number;
    loadingTime: number;
    chunkingTime: number;
    embeddingTime: number;
    insertionTime: number;
    totalTime: number;
    averageTimePerChunk: number;
  };
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
  'application/msword': { ext: 'DOC', icon: FileText, color: 'text-blue-600' },
  'application/vnd.ms-excel': { ext: 'XLS', icon: FileSpreadsheet, color: 'text-emerald-500' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'XLSX', icon: FileSpreadsheet, color: 'text-emerald-600' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: 'PPTX', icon: Presentation, color: 'text-orange-500' }
};

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.pptx'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ 
  onFilesProcessed, 
  onProcessingStart,
  onStatsUpdate,
  isProcessing,
  config 
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFileSupported = (file: File): boolean => {
    const hasValidType = Object.keys(SUPPORTED_FILE_TYPES).includes(file.type);
    const hasValidExtension = ACCEPTED_EXTENSIONS.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    return hasValidType || hasValidExtension;
  };

  const validateFile = (file: File): string | null => {
    if (!isFileSupported(file)) {
      return `Unsupported file type: ${file.name}`;
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${file.name} (${formatFileSize(file.size)}). Maximum size is 100MB.`;
    }
    
    return null;
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
      case 'xls': return { ext: 'XLS', icon: FileSpreadsheet, color: 'text-emerald-500' };
      case 'xlsx': return { ext: 'XLSX', icon: FileSpreadsheet, color: 'text-emerald-600' };
      case 'pptx': return { ext: 'PPTX', icon: Presentation, color: 'text-orange-500' };
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
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    processNewFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      processNewFiles(selectedFiles);
    }
  };

  const processNewFiles = (newFiles: File[]) => {
    const errors: string[] = [];
    const validFiles: File[] = [];

    newFiles.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    setFileErrors(errors);
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }

    // Clear errors after 5 seconds
    if (errors.length > 0) {
      setTimeout(() => setFileErrors([]), 5000);
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
        
        // Display processing statistics
        if (result.processingStats && result.processingStats.length > 0) {
          console.log('📊 Document Processing Statistics:');
          console.log('=====================================');
          
          result.processingStats.forEach((stat, index) => {
            if (stat.status === 'processed') {
              console.log(`\n📄 Document ${index + 1}: ${stat.fileName}`);
              console.log(`   File Type: ${stat.fileType}`);
              console.log(`   File Size: ${stat.fileSize}`);
              console.log(`   Chunks Created: ${stat.chunksCreated}`);
              console.log(`   ⏱️  Timing Breakdown:`);
              console.log(`      • Loading: ${stat.loadingTime}ms`);
              console.log(`      • Chunking: ${stat.chunkingTime}ms`);
              console.log(`      • Embedding: ${stat.embeddingTime}ms`);
              console.log(`      • Insertion: ${stat.insertionTime}ms`);
              console.log(`      • Total: ${stat.totalTime}ms`);
              console.log(`      • Avg per chunk: ${stat.averageTimePerChunk}ms`);
            } else if (stat.status === 'skipped') {
              console.log(`\n⏭️  Skipped: ${stat.fileName} (${stat.reason})`);
            }
          });
          
          if (result.timing) {
            console.log(`\n🎯 Overall Statistics:`);
            console.log(`   Total Processing Time: ${result.timing.overallProcessingTime}ms`);
            console.log(`   Average Time per Document: ${result.timing.averageTimePerDocument}ms`);
            console.log(`   Average Time per Chunk: ${result.timing.averageTimePerChunk}ms`);
          }
          
          console.log('\n=====================================');
        }
        
        // Store processing statistics for visual display
        if (result.processingStats) {
          // Update the documents with processing stats for visual display
          const documentsWithStats = result.documents.map((doc, index) => {
            const stat = result.processingStats.find(s => s.fileName === doc.name);
            return {
              ...doc,
              processingStats: stat
            };
          });
          onFilesProcessed(documentsWithStats);
        } else {
          onFilesProcessed(result.documents);
        }
        
        // Update stats with the latest totals from the server response
        if (onStatsUpdate && result.stats) {
          // Calculate total unique documents by getting unique sources count
          const uniqueDocuments = result.stats.existingChunks > 0 
            ? await getUniqueDocumentCount(config) 
            : result.stats.newDocuments;
          
          onStatsUpdate({
            totalDocuments: uniqueDocuments,
            totalChunks: result.stats.totalChunks
          });
        }
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

  // Helper function to get accurate unique document count from the database
  const getUniqueDocumentCount = async (config: RAGConfig): Promise<number> => {
    try {
      const response = await fetch('/api/get-collection-stats', {
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

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          return result.stats.totalDocuments;
        }
      }
    } catch (error) {
      console.error('Error fetching unique document count:', error);
    }
    
    // Fallback: return 0 if we can't get the count
    return 0;
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

      {/* File Size and Type Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-blue-800 font-semibold mb-2">Supported File Types & Limits</h3>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
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
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span className="text-blue-700">Excel Files (.xls, .xlsx)</span>
              </div>
              <div className="flex items-center gap-2">
                <Presentation className="w-4 h-4 text-orange-500" />
                <span className="text-blue-700">PowerPoint (.pptx)</span>
              </div>
            </div>
            <div className="bg-blue-100 rounded-lg p-3">
              <p className="text-blue-800 font-medium text-sm">
                📁 Maximum file size: <span className="font-bold">100MB per file</span>
              </p>
              <p className="text-blue-700 text-xs mt-1">
                Large files will be automatically split into smaller chunks for optimal processing.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* File Validation Errors */}
      {fileErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-red-800 font-semibold mb-2">File Upload Errors</h3>
              <ul className="text-red-700 text-sm space-y-1">
                {fileErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
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
          accept=".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.pptx,application/pdf,text/plain,text/csv,application/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={handleFileSelect}
          disabled={isDisabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDisabled ? 'text-gray-300' : 'text-gray-400'}`} />
        <p className={`text-lg font-medium mb-2 ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
          Drop files here or click to browse
        </p>
        <p className={`${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
          Support for PDF, TXT, CSV, DOC, DOCX, XLS, XLSX, and PPTX files up to 100MB each
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
              const isLargeFile = file.size > 50 * 1024 * 1024; // 50MB threshold for warning
              
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
                        {isLargeFile && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                            Large File
                          </span>
                        )}
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