import React from 'react';
import { Database, FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { RAGConfig } from './ConfigurationPanel';
import { ProcessedDocument } from './DocumentUpload';

interface StatusDashboardProps {
  config: RAGConfig | null;
  documents: ProcessedDocument[];
  isProcessing: boolean;
}

export const StatusDashboard: React.FC<StatusDashboardProps> = ({ 
  config, 
  documents, 
  isProcessing 
}) => {
  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunks.length, 0);
  
  const getStatusColor = () => {
    if (!config) return 'text-red-500 bg-red-50 border-red-200';
    if (isProcessing) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (documents.length > 0) return 'text-green-600 bg-green-50 border-green-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const getStatusIcon = () => {
    if (!config) return <AlertCircle className="w-5 h-5" />;
    if (isProcessing) return <Clock className="w-5 h-5" />;
    if (documents.length > 0) return <CheckCircle className="w-5 h-5" />;
    return <Database className="w-5 h-5" />;
  };

  const getStatusText = () => {
    if (!config) return 'Configuration Required';
    if (isProcessing) return 'Processing Documents...';
    if (documents.length > 0) return 'Ready for Questions';
    return 'Waiting for Documents';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
      
      {/* Current Status */}
      <div className={`flex items-center gap-3 p-4 rounded-lg border ${getStatusColor()} mb-6`}>
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <Database className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
          <p className="text-sm text-gray-600">Documents</p>
        </div>
        
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <FileText className="w-6 h-6 text-teal-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{totalChunks}</p>
          <p className="text-sm text-gray-600">Text Chunks</p>
        </div>
      </div>

      {/* Configuration Status */}
      {config && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Configuration</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">MongoDB</span>
              <span className="text-green-600 font-medium">Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">OpenAI</span>
              <span className="text-green-600 font-medium">API Key Set</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Database</span>
              <span className="text-gray-900 font-mono text-xs">{config.databaseName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Collection</span>
              <span className="text-gray-900 font-mono text-xs">{config.collectionName}</span>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      {documents.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Processed Documents</h3>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 truncate">{doc.name}</span>
                <span className="text-gray-400">{doc.chunks.length} chunks</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};