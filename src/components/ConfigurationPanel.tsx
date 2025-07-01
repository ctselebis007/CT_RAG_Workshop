import React, { useState } from 'react';
import { Database, Key, User, Eye, EyeOff } from 'lucide-react';

interface ConfigurationPanelProps {
  onConfigSave: (config: RAGConfig) => void;
  config: RAGConfig | null;
}

export interface RAGConfig {
  mongodbUri: string;
  openaiApiKey: string;
  databaseName: string;
  collectionName: string;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ onConfigSave, config }) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onConfigSave(formData);
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

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Save Configuration
        </button>
      </form>
    </div>
  );
};