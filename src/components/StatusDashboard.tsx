import React, { useState, useEffect } from 'react';
import { Database, FileText, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { RAGConfig } from './ConfigurationPanel';
import { ProcessedDocument } from './DocumentUpload';

interface StatusDashboardProps {
  config: RAGConfig | null;
  documents: ProcessedDocument[];
  isProcessing: boolean;
  onStatsUpdate?: (stats: { totalDocuments: number; totalChunks: number }) => void;
}

interface CollectionStats {
  totalDocuments: number;
  totalChunks: number;
  uniqueSources: string[];
  documentTypes: Record<string, number>;
}

interface ProcessingStats {
  fileName: string;
  fileType: string;
  fileSize: string;
  status: string;
  chunksCreated: number;
  totalTime: number;
  averageTimePerChunk: number;
  loadingTime: number;
  chunkingTime: number;
  embeddingTime: number;
  insertionTime: number;
}

export const StatusDashboard: React.FC<StatusDashboardProps> = ({ 
  config, 
  documents, 
  isProcessing,
  onStatsUpdate
}) => {
  const [collectionStats, setCollectionStats] = useState<CollectionStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [recentProcessingStats, setRecentProcessingStats] = useState<ProcessingStats[]>([]);

  // Calculate local stats from documents prop
  const localTotalChunks = documents.reduce((sum, doc) => sum + doc.chunks.length, 0);
  const localTotalDocuments = documents.length;

  const fetchCollectionStats = async () => {
    if (!config) return;

    setIsLoadingStats(true);
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
          setCollectionStats(result.stats);
          setLastRefresh(new Date());
          
          // Always notify parent component of stats update when we get fresh data from DB
          if (onStatsUpdate) {
            onStatsUpdate({
              totalDocuments: result.stats.totalDocuments,
              totalChunks: result.stats.totalChunks
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching collection stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Fetch stats when config changes or component mounts
  useEffect(() => {
    if (config) {
      fetchCollectionStats();
    } else {
      setCollectionStats(null);
      if (onStatsUpdate) {
        onStatsUpdate({ totalDocuments: 0, totalChunks: 0 });
      }
    }
  }, [config]);

  // Update parent when local documents change (but only if we don't have collection stats)
  useEffect(() => {
    if (onStatsUpdate && (!collectionStats || (collectionStats.totalDocuments === 0 && collectionStats.totalChunks === 0))) {
      onStatsUpdate({
        totalDocuments: localTotalDocuments,
        totalChunks: localTotalChunks
      });
    }
  }, [localTotalDocuments, localTotalChunks, collectionStats, onStatsUpdate]);

  // Use collection stats if available, otherwise fall back to local stats
  const displayTotalDocuments = (collectionStats?.totalDocuments && collectionStats.totalDocuments > 0) ? collectionStats.totalDocuments : localTotalDocuments;
  const displayTotalChunks = (collectionStats?.totalChunks && collectionStats.totalChunks > 0) ? collectionStats.totalChunks : localTotalChunks;
  
  // Update recent processing stats when documents change
  useEffect(() => {
    const newStats: ProcessingStats[] = documents
      .filter(doc => doc.processingStats)
      .map(doc => doc.processingStats!)
      .filter(stat => stat.status === 'processed') // Only show successfully processed documents
      .slice(-3); // Keep only the last 3 processed documents
    
    setRecentProcessingStats(newStats);
  }, [documents]);
  
  const getStatusColor = () => {
    if (!config) return 'text-red-500 bg-red-50 border-red-200';
    if (isProcessing) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (displayTotalDocuments > 0) return 'text-green-600 bg-green-50 border-green-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const getStatusIcon = () => {
    if (!config) return <AlertCircle className="w-5 h-5" />;
    if (isProcessing) return <Clock className="w-5 h-5" />;
    if (displayTotalDocuments > 0) return <CheckCircle className="w-5 h-5" />;
    return <Database className="w-5 h-5" />;
  };

  const getStatusText = () => {
    if (!config) return 'Configuration Required';
    if (isProcessing) return 'Processing Documents...';
    if (displayTotalDocuments > 0) return 'Ready for Questions';
    return 'Waiting for Documents';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
        {config && (
          <button
            onClick={fetchCollectionStats}
            disabled={isLoadingStats}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="Refresh collection statistics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingStats ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
      
      {/* Current Status */}
      <div className={`flex items-center gap-3 p-4 rounded-lg border ${getStatusColor()} mb-6`}>
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <Database className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{displayTotalDocuments}</p>
          <p className="text-sm text-gray-600">Documents</p>
          {collectionStats && (
            <p className="text-xs text-gray-400 mt-1">
              {collectionStats.totalDocuments !== localTotalDocuments ? 'From DB' : 'Local'}
            </p>
          )}
        </div>
        
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <FileText className="w-6 h-6 text-teal-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{displayTotalChunks}</p>
          <p className="text-sm text-gray-600">Text Chunks</p>
          {collectionStats && (
            <p className="text-xs text-gray-400 mt-1">
              {collectionStats.totalChunks !== localTotalChunks ? 'From DB' : 'Local'}
            </p>
          )}
        </div>
      </div>

      {/* Last Refresh Time */}
      {lastRefresh && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
      )}

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
              <span className="text-gray-600">{config.apiProvider === 'voyageai' ? 'VoyageAI' : 'OpenAI'}</span>
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

      {/* Document Types Breakdown */}
      {collectionStats && collectionStats.documentTypes && Object.keys(collectionStats.documentTypes).length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Document Types</h3>
          <div className="space-y-2">
            {Object.entries(collectionStats.documentTypes).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{type}</span>
                <span className="text-gray-900 font-medium">{count} chunks</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Documents List (from local state) */}
      {documents.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Documents</h3>
          <div className="space-y-2">
            {documents
              .reduce((unique, doc) => {
                // Only keep the latest version of each document (by name)
                const existingIndex = unique.findIndex(d => d.name === doc.name);
                if (existingIndex >= 0) {
                  unique[existingIndex] = doc; // Replace with newer version
                } else {
                  unique.push(doc);
                }
                return unique;
              }, [] as ProcessedDocument[])
              .slice(-5)
              .map((doc) => (
              <div key={`${doc.name}-${doc.id}`} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 truncate">{doc.name}</span>
                <span className="text-gray-400">{doc.chunks.length} chunks</span>
              </div>
            ))}
            {documents
              .reduce((unique, doc) => {
                const existingIndex = unique.findIndex(d => d.name === doc.name);
                if (existingIndex >= 0) {
                  unique[existingIndex] = doc;
                } else {
                  unique.push(doc);
                }
                return unique;
              }, [] as ProcessedDocument[]).length > 5 && (
              <p className="text-xs text-gray-400 text-center pt-2">
                Showing 5 most recent documents
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recent Processing Performance */}
      {recentProcessingStats.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">📊 Recent Processing Performance</h3>
          <div className="space-y-3">
            {recentProcessingStats.map((stat, index) => (
              <div key={index} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-blue-900 truncate max-w-[200px]" title={stat.fileName}>
                    📄 {stat.fileName}
                  </span>
                  <span className="text-xs text-blue-700 bg-blue-200 px-2 py-1 rounded font-medium">
                    {stat.fileType}
                  </span>
                </div>
                
                {/* File Info Row */}
                <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-blue-600">📁 Size:</span>
                    <span className="font-semibold text-blue-800">{stat.fileSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">🧩 Chunks:</span>
                    <span className="font-semibold text-blue-800">{stat.chunksCreated}</span>
                  </div>
                </div>
                
                {/* Timing Breakdown */}
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="text-xs font-medium text-blue-700 mb-2">⏱️ Timing Breakdown:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">• Loading:</span>
                      <span className="font-medium text-gray-800">{stat.loadingTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">• Chunking:</span>
                      <span className="font-medium text-gray-800">{stat.chunkingTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">• Embedding:</span>
                      <span className="font-medium text-gray-800">{stat.embeddingTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">• Insertion:</span>
                      <span className="font-medium text-gray-800">{stat.insertionTime}ms</span>
                    </div>
                  </div>
                </div>
                
                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-indigo-600 font-medium">🎯 Total Time:</span>
                    <span className="font-bold text-indigo-800">{(stat.totalTime / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-600 font-medium">⚡ Per Chunk:</span>
                    <span className="font-bold text-indigo-800">{stat.averageTimePerChunk}ms</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-600 font-medium">
              📈 Showing detailed performance metrics for the last {recentProcessingStats.length} processed document{recentProcessingStats.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}
      
      {/* Overall Processing Statistics (if available from last batch) */}
      {recentProcessingStats.length > 1 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">🎯 Batch Processing Summary</h3>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">📊 Documents Processed:</span>
                <span className="font-bold text-green-800">{recentProcessingStats.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">🧩 Total Chunks Created:</span>
                <span className="font-bold text-green-800">
                  {recentProcessingStats.reduce((sum, stat) => sum + stat.chunksCreated, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">⏱️ Total Processing Time:</span>
                <span className="font-bold text-green-800">
                  {(recentProcessingStats.reduce((sum, stat) => sum + stat.totalTime, 0) / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">⚡ Avg Time per Document:</span>
                <span className="font-bold text-green-800">
                  {(recentProcessingStats.reduce((sum, stat) => sum + stat.totalTime, 0) / recentProcessingStats.length / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};