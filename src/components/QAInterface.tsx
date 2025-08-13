import React, { useState } from 'react';
import { MessageSquare, Send, Brain, Loader, FileText, AlertTriangle, Database } from 'lucide-react';
import { RAGConfig } from './ConfigurationPanel';

interface QAInterfaceProps {
  isConfigured: boolean;
  hasDocuments: boolean;
  config: RAGConfig | null;
  totalDocuments: number;
  totalChunks: number;
}

interface QAResponse {
  vectorSearchResult: string;
  llmResponse: string;
  sources?: string[];
  numRetrievedChunks?: number;
  question: string;
}

export const QAInterface: React.FC<QAInterfaceProps> = ({ 
  isConfigured, 
  hasDocuments, 
  config,
  totalDocuments,
  totalChunks
}) => {
  const [question, setQuestion] = useState('');
  const [responses, setResponses] = useState<QAResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!question.trim() || !isConfigured || !config) return;

    const currentQuestion = question.trim();
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/query-documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: currentQuestion,
          config: config,
          useCustomPrompt: false // Always use standard prompt
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to query documents');
      }

      const result = await response.json();
      
      if (result.success) {
        const newResponse: QAResponse = {
          question: currentQuestion,
          vectorSearchResult: result.vectorSearchResult,
          llmResponse: result.llmResponse,
          sources: result.sources || [],
          numRetrievedChunks: result.numRetrievedChunks || 0
        };
        
        // Keep only the last 3 responses (including the new one)
        setResponses(prev => [newResponse, ...prev].slice(0, 3));
        setQuestion('');
      } else {
        throw new Error(result.error || 'Query failed');
      }
    } catch (error) {
      console.error('Error querying documents:', error);
      
      // Show error response
      const errorResponse: QAResponse = {
        question: currentQuestion,
        vectorSearchResult: 'Error retrieving documents',
        llmResponse: `Sorry, I encountered an error: ${error.message}`,
        sources: [],
        numRetrievedChunks: 0
      };
      
      // Keep only the last 3 responses (including the new error response)
      setResponses(prev => [errorResponse, ...prev].slice(0, 3));
    } finally {
      setIsLoading(false);
    }
  };

  // Check if system is ready for questions - use totalChunks as the primary indicator
  const isSystemReady = isConfigured && totalChunks > 0;
  
  // Debug logging to help troubleshoot
  console.log('QA Interface Status:', {
    isConfigured,
    totalDocuments,
    totalChunks,
    isSystemReady,
    hasDocuments
  });
  
  const isDisabled = !isSystemReady || isLoading;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Q&A Interface</h2>
          <p className="text-gray-600">Ask questions about your uploaded documents</p>
        </div>
      </div>

      {/* Status Messages */}
      {!isConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <p className="text-amber-800 font-medium">
              Please configure MongoDB and OpenAI settings first.
            </p>
          </div>
        </div>
      )}

      {isConfigured && totalChunks === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-blue-800 font-medium">
                Upload and process some documents before asking questions.
              </p>
              <p className="text-blue-700 text-sm mt-1">
                The system will be ready once documents are processed and stored in the database.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dimension Mismatch Warning */}
      {dimensionMismatch?.show && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="text-red-800 font-semibold mb-2">🚫 Cannot Query - Dimension Mismatch</h3>
              <div className="text-red-700 text-sm space-y-2">
                <p>
                  Your collection has <strong>{dimensionMismatch.currentDimensions}D embeddings</strong>, 
                  but you're using <strong>{dimensionMismatch.currentProvider === 'openai' ? 'OpenAI' : 'VoyageAI'}</strong> 
                  which generates <strong>{dimensionMismatch.expectedDimensions}D embeddings</strong>.
                </p>
                <p className="font-medium">
                  📝 Please go to Configuration and either:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Switch to the correct API provider</li>
                  <li>Reset the collection to start fresh</li>
                  <li>Use a different collection name</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Ready Indicator with Real-time Stats */}
      {isSystemReady && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <p className="text-green-800 font-medium">
                System Ready! You can now ask questions.
              </p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-green-600" />
                  <span className="text-green-700 text-sm font-medium">
                    {totalDocuments} document{totalDocuments !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="text-green-700 text-sm font-medium">
                    {totalChunks} text chunk{totalChunks !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-800">{totalChunks}</div>
              <div className="text-xs text-green-600">chunks ready</div>
            </div>
          </div>
        </div>
      )}

      {/* Question Input */}
      <div className="space-y-4 mb-6">
        <div className="relative">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isDisabled && handleSubmit()}
            placeholder={
              isSystemReady 
                ? `Ask a question about your ${totalDocuments} document${totalDocuments !== 1 ? 's' : ''}...` 
                : "Configure system and upload documents to start asking questions..."
            }
            disabled={isDisabled}
            className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
          <button
            onClick={handleSubmit}
            disabled={isDisabled || !question.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* AI Response Mode Indicator with Live Stats */}
        {isSystemReady && (
          <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Standard AI Response Mode</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-amber-700">
              <div className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                <span>{totalDocuments} docs</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span>{totalChunks} chunks</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Responses */}
      {responses.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Questions & Answers
              <span className="text-sm font-normal text-gray-500 ml-2">
                (Last {responses.length} of 3 max)
              </span>
            </h3>
            {isSystemReady && (
              <div className="text-sm text-gray-500">
                Searching across {totalChunks} text chunks
              </div>
            )}
          </div>
          {responses.map((response, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-6 space-y-4">
              {/* Question */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Your Question</span>
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    #{responses.length - index}
                  </span>
                </div>
                <p className="text-blue-900 font-medium">{response.question}</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <Brain className="w-3 h-3" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">AI Response</span>
                </div>
                {response.numRetrievedChunks && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {response.numRetrievedChunks} of {totalChunks} chunks retrieved
                  </span>
                )}
              </div>
              
              {/* Vector Search Result */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Retrieved Context</span>
                </div>
                <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {response.vectorSearchResult}
                </div>
                {response.sources && response.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <span className="text-xs font-medium text-gray-500 mb-2 block">Sources:</span>
                    <div className="flex flex-wrap gap-1">
                      {response.sources.map((source, idx) => (
                        <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {source}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* LLM Response */}
              <div className="bg-amber-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">AI Answer</span>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{response.llmResponse}</p>
              </div>
            </div>
          ))}
          
          {/* Note about response limit */}
          <div className="text-center py-2">
            <p className="text-xs text-gray-400">
              Only the last 3 questions and answers are shown to keep the interface clean.
            </p>
          </div>
        </div>
      )}

      {responses.length === 0 && isSystemReady && (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">
            Ask your first question to get started with your documents.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-400 mb-2">
            <div className="flex items-center gap-1">
              <Database className="w-4 h-4" />
              <span>{totalDocuments} documents ready</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>{totalChunks} chunks indexed</span>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            Now supports PDF, TXT, CSV, DOC, DOCX, XLS, XLSX, and PPTX files!
          </p>
        </div>
      )}

      {responses.length === 0 && !isSystemReady && isConfigured && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">
            Upload documents to enable the Q&A interface.
          </p>
          <p className="text-sm text-gray-400 mb-4">
            The system will automatically detect when documents are available.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 inline-block">
            <div className="flex items-center gap-2 text-blue-700">
              <Database className="w-4 h-4" />
              <span className="text-sm">
                Current: {totalDocuments} documents, {totalChunks} chunks
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};