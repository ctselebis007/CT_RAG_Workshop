import React, { useState } from 'react';
import { MessageSquare, Send, Brain, Zap, Loader, FileText } from 'lucide-react';
import { RAGConfig } from './ConfigurationPanel';

interface QAInterfaceProps {
  isConfigured: boolean;
  hasDocuments: boolean;
  config: RAGConfig | null;
}

interface QAResponse {
  vectorSearchResult: string;
  llmResponse: string;
  isCustomPrompt: boolean;
}

export const QAInterface: React.FC<QAInterfaceProps> = ({ 
  isConfigured, 
  hasDocuments, 
  config 
}) => {
  const [question, setQuestion] = useState('');
  const [responses, setResponses] = useState<QAResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'standard' | 'custom'>('standard');

  const handleSubmit = async (useCustomPrompt: boolean = false) => {
    if (!question.trim() || !isConfigured || !hasDocuments || !config) return;

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/query-documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question.trim(),
          config: config,
          useCustomPrompt: useCustomPrompt
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to query documents');
      }

      const result = await response.json();
      
      if (result.success) {
        const newResponse: QAResponse = {
          vectorSearchResult: result.vectorSearchResult,
          llmResponse: result.llmResponse,
          isCustomPrompt: result.isCustomPrompt
        };
        
        setResponses(prev => [newResponse, ...prev]);
        setQuestion('');
      } else {
        throw new Error(result.error || 'Query failed');
      }
    } catch (error) {
      console.error('Error querying documents:', error);
      
      // Show error response
      const errorResponse: QAResponse = {
        vectorSearchResult: 'Error retrieving documents',
        llmResponse: `Sorry, I encountered an error: ${error.message}`,
        isCustomPrompt: useCustomPrompt
      };
      
      setResponses(prev => [errorResponse, ...prev]);
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = !isConfigured || !hasDocuments || isLoading;

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

      {!isConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-800 font-medium">
            Please configure MongoDB and OpenAI settings first.
          </p>
        </div>
      )}

      {isConfigured && !hasDocuments && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 font-medium">
            Upload and process some PDF documents before asking questions.
          </p>
        </div>
      )}

      {/* Question Input */}
      <div className="space-y-4 mb-6">
        <div className="relative">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isDisabled && handleSubmit(activeTab === 'custom')}
            placeholder="Ask a question about your documents..."
            disabled={isDisabled}
            className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => handleSubmit(activeTab === 'custom')}
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

        {/* Prompt Mode Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('standard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'standard'
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Brain className="w-4 h-4" />
            Standard Prompt
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'custom'
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            Rap Song Mode
          </button>
        </div>
      </div>

      {/* Responses */}
      {responses.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Recent Questions</h3>
          {responses.map((response, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  response.isCustomPrompt 
                    ? 'bg-purple-100 text-purple-600' 
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  {response.isCustomPrompt ? <Zap className="w-3 h-3" /> : <Brain className="w-3 h-3" />}
                </div>
                <span className="text-sm font-medium text-gray-600">
                  {response.isCustomPrompt ? 'Rap Song Mode' : 'Standard Response'}
                </span>
              </div>
              
              {/* Vector Search Result */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Retrieved Context</span>
                </div>
                <p className="text-sm text-gray-600">{response.vectorSearchResult}</p>
              </div>
              
              {/* LLM Response */}
              <div className="bg-amber-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">AI Response</span>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{response.llmResponse}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {responses.length === 0 && isConfigured && hasDocuments && (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            Ask your first question to get started with your documents.
          </p>
        </div>
      )}
    </div>
  );
};