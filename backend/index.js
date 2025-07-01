import express from 'express';
import cors from 'cors';
import createVectorIndexHandler from '../api/create-vector-index.js';
import processDocumentsHandler from '../api/process-documents.js';
import queryDocumentsHandler from '../api/query-documents.js';
import getCollectionStatsHandler from '../api/get-collection-stats.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
// Increased limit to 100MB to support larger file uploads
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Convert Vercel-style handlers to Express middleware
const createExpressHandler = (handler) => {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Handler error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          error: error.message || 'Internal server error' 
        });
      }
    }
  };
};

// API Routes
app.post('/api/create-vector-index', createExpressHandler(createVectorIndexHandler));
app.post('/api/process-documents', createExpressHandler(processDocumentsHandler));
app.post('/api/query-documents', createExpressHandler(queryDocumentsHandler));
app.post('/api/get-collection-stats', createExpressHandler(getCollectionStatsHandler));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log('API endpoints available:');
  console.log('  POST /api/create-vector-index');
  console.log('  POST /api/process-documents');
  console.log('  POST /api/query-documents');
  console.log('  POST /api/get-collection-stats');
  console.log('  GET  /api/health');
  console.log('');
  console.log('Configuration:');
  console.log('  Maximum file upload size: 100MB');
  console.log('  Supported file types: PDF, TXT, CSV, DOC, DOCX, XLS, XLSX, PPTX');
});

export default app;