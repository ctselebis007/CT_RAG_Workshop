import { MongoClient } from 'mongodb';

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
      console.log(`Processing ${file.name}...`);
      
      // Decode base64 PDF content
      const pdfBuffer = Buffer.from(file.content, 'base64');
      
      // Extract text from PDF and create chunks
      const chunks = await extractAndChunkPDF(pdfBuffer, file.name);
      
      // Generate embeddings for each chunk
      const chunksWithEmbeddings = await Promise.all(
        chunks.map(async (chunk) => {
          const embedding = await generateEmbedding(chunk.content, config.openaiApiKey);
          return {
            text: chunk.content,
            embedding: embedding,
            metadata: {
              source: chunk.metadata.source,
              page: chunk.metadata.page
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
        chunks: chunks
      });
    }
    
    await mongoClient.close();
    
    res.status(200).json({ 
      success: true, 
      documents: processedDocuments,
      message: `Processed ${processedDocuments.length} documents successfully`
    });
    
  } catch (error) {
    console.error('Error processing documents:', error);
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process documents'
    });
  }
}

async function extractAndChunkPDF(pdfBuffer, filename) {
  try {
    // Simple PDF text extraction (in production, you'd use a proper PDF parser)
    // This is a simplified version - you might want to use pdf-parse or similar
    const text = await extractTextFromPDF(pdfBuffer);
    
    // Split into pages (simplified chunking strategy)
    const pages = text.split('\f'); // Form feed character typically separates pages
    
    const chunks = [];
    
    pages.forEach((pageContent, index) => {
      if (pageContent.trim()) {
        chunks.push({
          id: generateId(),
          content: pageContent.trim(),
          metadata: {
            source: filename,
            page: index + 1
          }
        });
      }
    });
    
    return chunks;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    // Fallback: create a single chunk with placeholder content
    return [{
      id: generateId(),
      content: `Content from ${filename} - PDF processing not fully implemented in this demo`,
      metadata: {
        source: filename,
        page: 1
      }
    }];
  }
}

async function extractTextFromPDF(pdfBuffer) {
  // This is a simplified implementation
  // In a real application, you would use a proper PDF parsing library
  // For now, we'll return placeholder text
  return "Sample extracted text from PDF. In a production environment, this would contain the actual PDF content extracted using a proper PDF parsing library like pdf-parse or similar.";
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