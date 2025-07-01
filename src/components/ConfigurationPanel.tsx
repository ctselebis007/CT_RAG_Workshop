import React, { useState } from 'react';
import { Database, Key, User, Eye, EyeOff, CheckCircle, Loader, AlertCircle, RotateCcw } from 'lucide-react';

interface ConfigurationPanelProps {
  onConfigSave: (config: RAGConfig) => void;
  onConfigReset: () => void;
  config: RAGConfig | null;
}

export interface RAGConfig {
  mongodbUri: string;
  openaiApiKey: string;
  databaseName: string;
  collectionName: string;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ onConfigSave, onConfigReset, config }) => {
  const [formData, setFormData] = useState<RAGConfig>({
    mongodbUri: config?.mongodbUri || '',
    openaiApiKey: config?.openaiApiKey || '',
    databaseName: config?.databaseName || 'rag_demo',
    collectionName: config?.collectionName || ''
  });
  const [showKeys, setShowKeys] = useState({
    mongodb: false,
    openai: false
  });
  const [errors, setErrors] = useState<Partial<RAGConfig>>({});
  const [isCreatingIndex, setIsCreatingIndex] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [indexStatus, setIndexStatus] = useState<string>('');

  const validateForm = (): boolean => {
    const newErrors: Partial<RAGConfig> = {};
    
    if (!formData.mongodbUri.trim()) {
      newErrors.mongodbUri = 'MongoDB URI is required';
    } else if (!formData.mongodbUri.startsWith('mongodb')) {
      newErrors.mongodbUri = 'Invalid MongoDB URI format';
    }
    
    if (!formData.openaiApiKey.trim()) {
      newErrors.openaiApiKey = 'OpenAI API key is required';
    } else if (!formData.openaiApiKey.startsWith('sk-')) {
      newErrors.openaiApiKey = 'Invalid OpenAI API key format';
    }
    
    if (!formData.databaseName.trim()) {
      newErrors.databaseName = 'Database name is required';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.databaseName)) {
      newErrors.databaseName = 'Database name must contain only letters, numbers, and underscores';
    }
    
    if (!formData.collectionName.trim()) {
      newErrors.collectionName = 'Collection name is required';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.collectionName)) {
      newErrors.collectionName = 'Collection name must contain only letters, numbers, and underscores';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createCollectionAndIndex = async (configData: RAGConfig, reset: boolean = false): Promise<boolean> => {
    try {
      setIndexStatus(reset ? 'Resetting collection and creating vector search index...' : 'Creating collection and vector search index...');
      
      const response = await fetch('/api/create-vector-index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mongodbUri: configData.mongodbUri,
          databaseName: configData.databaseName,
          collectionName: configData.collectionName,
          reset: reset
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Check if it's a permission error
        if (result.error && (
          result.error.includes('not authorized') ||
          result.error.includes('permission') ||
          result.error.includes('Unauthorized') ||
          result.error.includes('createSearchIndex')
        )) {
          setIndexStatus('Permission error: MongoDB user lacks search index creation permissions');
          return false;
        }
        throw new Error(result.error || 'Failed to create collection and vector search index');
      }

      setIndexStatus(reset ? 'Collection reset and vector search index created successfully!' : 'Collection and vector search index created successfully!');
      return true;
    } catch (error) {
      console.error('Error creating collection and vector index:', error);
      setIndexStatus(`Error creating collection and index: ${error.message}`);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsCreatingIndex(true);
    setIndexStatus('');

    try {
      // Create the collection and vector search index (preserve existing data)
      const indexCreated = await createCollectionAndIndex(formData, false);
      
      if (indexCreated) {
        // If index creation was successful, save the configuration
        onConfigSave(formData);
        setTimeout(() => setIndexStatus(''), 3000);
      } else {
        // Even if index creation failed due to permissions, still save config
        // so users can proceed with document upload (they might have the index already)
        onConfigSave(formData);
        setTimeout(() => setIndexStatus(''), 5000);
      }
    } catch (error) {
      setIndexStatus(`Configuration error: ${error.message}`);
      setTimeout(() => setIndexStatus(''), 5000);
    } finally {
      setIsCreatingIndex(false);
    }
  };

  const handleReset = async () => {
    if (!validateForm()) return;

    setIsResetting(true);
    setIndexStatus('');

    try {
      // Reset the collection and create vector search index (delete existing data)
      const indexCreated = await createCollectionAndIndex(formData, true);
      
      if (indexCreated) {
        // If reset was successful, save the configuration and notify parent to reset documents
        onConfigSave(formData);
        onConfigReset(); // This will clear the documents state in the parent component
        setTimeout(() => setIndexStatus(''), 3000);
      } else {
        setTimeout(() => setIndexStatus(''), 5000);
      }
    } catch (error) {
      setIndexStatus(`Reset error: ${error.message}`);
      setTimeout(() => setIndexStatus(''), 5000);
    } finally {
      setIsResetting(false);
    }
  };

  const handleInputChange = (field: keyof RAGConfig, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
          <Database className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Configuration</h2>
          <p className="text-gray-600">Setup MongoDB Atlas and OpenAI credentials</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* MongoDB URI */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            MongoDB Atlas URI
          </label>
          <div className="relative">
            <Database className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showKeys.mongodb ? 'text' : 'password'}
              value={formData.mongodbUri}
              onChange={(e) => handleInputChange('mongodbUri', e.target.value)}
              className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.mongodbUri ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="mongodb+srv://username:password@cluster.mongodb.net/"
            />
            <button
              type="button"
              onClick={() => setShowKeys(prev => ({ ...prev, mongodb: !prev.mongodb }))}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showKeys.mongodb ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.mongodbUri && (
            <p className="text-red-500 text-sm mt-1">{errors.mongodbUri}</p>
          )}
        </div>

        {/* OpenAI API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            OpenAI API Key
          </label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showKeys.openai ? 'text' : 'password'}
              value={formData.openaiApiKey}
              onChange={(e) => handleInputChange('openaiApiKey', e.target.value)}
              className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.openaiApiKey ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="sk-..."
            />
            <button
              type="button"
              onClick={() => setShowKeys(prev => ({ ...prev, openai: !prev.openai }))}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showKeys.openai ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.openaiApiKey && (
            <p className="text-red-500 text-sm mt-1">{errors.openaiApiKey}</p>
          )}
        </div>

        {/* Database Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Database Name
          </label>
          <div className="relative">
            <Database className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formData.databaseName}
              onChange={(e) => handleInputChange('databaseName', e.target.value)}
              className={`w-full pl-10 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.databaseName ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="rag_demo"
            />
          </div>
          {errors.databaseName && (
            <p className="text-red-500 text-sm mt-1">{errors.databaseName}</p>
          )}
          <p className="text-gray-500 text-sm mt-1">
            The MongoDB database where your documents will be stored.
          </p>
        </div>

        {/* Collection Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Collection Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formData.collectionName}
              onChange={(e) => handleInputChange('collectionName', e.target.value)}
              className={`w-full pl-10 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.collectionName ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="my_documents"
            />
          </div>
          {errors.collectionName && (
            <p className="text-red-500 text-sm mt-1">{errors.collectionName}</p>
          )}
          <p className="text-gray-500 text-sm mt-1">
            The MongoDB collection name for your document chunks and embeddings.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            type="submit"
            disabled={isCreatingIndex || isResetting}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreatingIndex ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Setting up configuration...
              </>
            ) : (
              'Save Configuration & Create Index'
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isCreatingIndex || isResetting}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3 px-6 rounded-lg font-medium hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isResetting ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Resetting configuration...
              </>
            ) : (
              <>
                <RotateCcw className="w-5 h-5" />
                Reset Configuration & Create Index
              </>
            )}
          </button>
        </div>
      </form>

      {/* Index Status Message */}
      {indexStatus && (
        <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
          indexStatus.includes('Error') || indexStatus.includes('Permission error')
            ? 'bg-red-50 text-red-700 border border-red-200'
            : indexStatus.includes('successfully')
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {indexStatus.includes('Error') || indexStatus.includes('Permission error') ? (
            <AlertCircle className="w-5 h-5" />
          ) : indexStatus.includes('successfully') ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <Loader className="w-5 h-5 animate-spin" />
          )}
          <span className="font-medium">{indexStatus}</span>
        </div>
      )}

      {/* Permission Help */}
      {indexStatus.includes('Permission error') && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-amber-800 font-semibold mb-2">How to fix MongoDB permissions:</h3>
              <ol className="text-amber-700 text-sm space-y-1 list-decimal list-inside">
                <li>Go to your MongoDB Atlas dashboard</li>
                <li>Navigate to "Database Access"</li>
                <li>Find your database user and click "Edit"</li>
                <li>Change the role to "Atlas Admin" or add "createSearchIndex" privilege</li>
                <li>Save changes and try again</li>
              </ol>
              <p className="text-amber-700 text-sm mt-2">
                Note: You can still proceed with document upload if the index already exists.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reset Warning */}
      <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-red-800 font-semibold mb-2">Reset Configuration Warning</h3>
            <p className="text-red-700 text-sm">
              The "Reset Configuration & Create Index" button will permanently delete all existing documents and embeddings in the collection. This action cannot be undone. Use this option only when you want to start fresh with a clean collection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};