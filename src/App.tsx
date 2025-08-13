import React, { useState } from 'react';
import { Brain, Github, ExternalLink } from 'lucide-react';
import { ConfigurationPanel, RAGConfig } from './components/ConfigurationPanel';
import { DocumentUpload, ProcessedDocument } from './components/DocumentUpload';
import { QAInterface } from './components/QAInterface';
import { StatusDashboard } from './components/StatusDashboard';

function App() {
  const [config, setConfig] = useState<RAGConfig | null>(null);
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [collectionStats, setCollectionStats] = useState({ totalDocuments: 0, totalChunks: 0 });

  const handleConfigSave = (newConfig: RAGConfig) => {
    setConfig(newConfig);
    // Force stats refresh after config save
    setTimeout(() => {
      // This will trigger the StatusDashboard to fetch fresh stats
      setCollectionStats({ totalDocuments: 0, totalChunks: 0 });
    }, 500);
  };

  const handleConfigReset = () => {
    // Clear all documents when configuration is reset
    setDocuments([]);
    setIsProcessing(false);
    setCollectionStats({ totalDocuments: 0, totalChunks: 0 });
  };

  const handleFilesProcessed = (newDocuments: ProcessedDocument[]) => {
    setDocuments(prev => [...prev, ...newDocuments]);
    setIsProcessing(false);
  };

  const handleProcessingStart = () => {
    setIsProcessing(true);
  };

  const handleStatsUpdate = (stats: { totalDocuments: number; totalChunks: number }) => {
    setCollectionStats(stats);
  };

  // Use collection stats as the primary source of truth, fallback to local stats only if no collection stats
  const totalDocuments = collectionStats.totalDocuments > 0 ? collectionStats.totalDocuments : documents.length;
  const totalChunks = collectionStats.totalChunks > 0 ? collectionStats.totalChunks : documents.reduce((sum, doc) => sum + doc.chunks.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-teal-600 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">RAG Document Q&A</h1>
                <p className="text-sm text-gray-600">MongoDB Atlas + OpenAI + LangChain</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://docs.mongodb.com/atlas/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                MongoDB Docs
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-1">
            <ConfigurationPanel 
              config={config}
              onConfigSave={handleConfigSave}
              onConfigReset={handleConfigReset}
            />
          </div>

          {/* System Status - Below Configuration on lg, separate column on xl */}
          <div className="lg:col-span-1 xl:col-span-1">
            <div className="lg:hidden xl:block">
              <StatusDashboard 
                config={config}
                documents={documents}
                isProcessing={isProcessing}
                onStatsUpdate={handleStatsUpdate}
              />
            </div>
          </div>

          {/* Document Upload */}
          <div className="lg:col-span-1 xl:col-span-1">
            <DocumentUpload 
              onFilesProcessed={handleFilesProcessed}
              onProcessingStart={handleProcessingStart}
              onStatsUpdate={handleStatsUpdate}
              isProcessing={isProcessing}
              config={config}
            />
          </div>

          {/* Q&A Interface */}
          <div className="lg:col-span-1 xl:col-span-1">
            <QAInterface 
              isConfigured={!!config}
              hasDocuments={documents.length > 0}
              config={config}
              totalDocuments={totalDocuments}
              totalChunks={totalChunks}
            />
          </div>
        </div>

        {/* Status Dashboard for lg screens (hidden on xl) */}
        <div className="hidden lg:block xl:hidden mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <StatusDashboard 
                config={config}
                documents={documents}
                isProcessing={isProcessing}
                onStatsUpdate={handleStatsUpdate}
              />
            </div>
            <div className="lg:col-span-2">
              {/* Empty space for balance */}
            </div>
          </div>
        </div>

        {/* Status Dashboard for mobile/tablet (below Configuration) */}
        <div className="block lg:hidden mt-8">
          <StatusDashboard 
            config={config}
            documents={documents}
            isProcessing={isProcessing}
            onStatsUpdate={handleStatsUpdate}
          />
        </div>

        {/* Legacy layout structure for smaller screens */}
        <div className="hidden">
          {/* Left Column - Configuration and Status */}
          <div className="space-y-8">
            <ConfigurationPanel 
              config={config}
              onConfigSave={handleConfigSave}
              onConfigReset={handleConfigReset}
            />
            <StatusDashboard 
              config={config}
              documents={documents}
              isProcessing={isProcessing}
              onStatsUpdate={handleStatsUpdate}
            />
          </div>

          {/* Document Upload */}
          <div>
            <DocumentUpload 
              onFilesProcessed={handleFilesProcessed}
              onProcessingStart={handleProcessingStart}
              onStatsUpdate={handleStatsUpdate}
              isProcessing={isProcessing}
              config={config}
            />
          </div>

          {/* Q&A Interface */}
          <div>
            <QAInterface 
              isConfigured={!!config}
              hasDocuments={documents.length > 0}
              config={config}
              totalDocuments={totalDocuments}
              totalChunks={totalChunks}
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200">
          <div className="text-center text-gray-600">
            <p className="mb-4">
              This RAG system demonstrates document Q&A using MongoDB Atlas Vector Search, OpenAI, and LangChain.
            </p>
            <div className="flex items-center justify-center gap-6 text-sm">
              <a
                href="https://www.mongodb.com/products/platform/atlas-vector-search"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-teal-600 transition-colors"
              >
                Atlas Vector Search
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://openai.com/api/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-teal-600 transition-colors"
              >
                OpenAI API
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://js.langchain.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-teal-600 transition-colors"
              >
                LangChain
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;