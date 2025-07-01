import { MongoClient } from 'mongodb';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { files, config } = req.body;
    
    // Connect to MongoDB
    const mongoClient = new MongoClient(config.mongodbUri);
    await mongoClient.connect();
    
    const db = mongoClient.db(config.databaseName);
    const collection = db.collection(config.collectionName);
    
    // Clear existing documents for this collection
    await collection.deleteMany({});
    
    const processedDocuments = [];
    
    for (const file of files) {
      console.log(`Processing ${file.name} with LangChain PyPDFLoader...`);
      
      // Create temporary file from base64 content
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${file.name}`);
      const pdfBuffer = Buffer.from(file.content, 'base64');
      fs.writeFileSync(tempFilePath, pdfBuffer);
      
      try {
        // Use LangChain PDFLoader to load and split by pages
        const loader = new PDFLoader(tempFilePath, {
          splitPages: true, // This creates one document per page
        });
        
        const docs = await loader.load();
        console.log(`Loaded ${docs.length} pages from ${file.name}`);
        
        // Optional: Further split large pages into smaller chunks
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
        });
        
        const splitDocs = await textSplitter.splitDocuments(docs);
        console.log(`Split into ${splitDocs.length} chunks`);
        
        // Process each document chunk
        const chunksWithEmbeddings = await Promise.all(
          splitDocs.map(async (doc, index) => {
            const embedding = await generateEmbedding(doc.pageContent, config.openaiApiKey);
            
            return {
              text: doc.pageContent,
              embedding: embedding,
              metadata: {
                source: file.name,
                page: doc.metadata.page || Math.floor(index / (splitDocs.length / docs.length)) + 1,
                chunk_index: index,
                total_chunks: splitDocs.length,
                original_page_count: docs.length
              }
            };
          })
        );
        
        // Store in MongoDB
        if (chunksWithEmbeddings.length > 0) {
          await collection.insertMany(chunksWithEmbeddings);
        }
        
        processedDocuments.push({
          id: generateId(),
          name: file.name,
          chunks: chunksWithEmbeddings.map((chunk, index) => ({
            id: generateId(),
            content: chunk.text,
            metadata: chunk.metadata
          }))
        });
        
      } finally {
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }
    
    await mongoClient.close();
    
    res.status(200).json({ 
      success: true, 
      documents: processedDocuments,
      message: `Processed ${processedDocuments.length} documents successfully using LangChain PyPDFLoader`
    });
    
  } catch (error) {
    console.error('Error processing documents with LangChain:', error);
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process documents with LangChain'
    });
  }
}

async function generateEmbedding(text, apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}