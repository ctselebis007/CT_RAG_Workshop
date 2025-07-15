import { MongoClient } from 'mongodb';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { CSVLoader } from 'langchain/document_loaders/fs/csv';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { DocxLoader } from 'langchain/document_loaders/fs/docx';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import yauzl from 'yauzl';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to determine embedding field path
async function getEmbeddingFieldPath(collection) {
  // Check for each field type using filtered queries
  const embeddingVectorDoc = await collection.findOne({ embeddingVector: { $exists: true } });
  if (embeddingVectorDoc) {
    return 'embeddingVector';
  }
  
  const embeddingDoc = await collection.findOne({ embedding: { $exists: true } });
  if (embeddingDoc) {
    return 'embedding';
  }
  
  const plotEmbeddingDoc = await collection.findOne({ plot_embedding: { $exists: true } });
  if (plotEmbeddingDoc) {
    return 'plot_embedding';
  }
  
  // Default to 'embedding' if no existing documents or field found
  return 'embedding';
}

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
    const overallStartTime = Date.now();
    const { files, config } = req.body;
    
    // Connect to MongoDB
    const mongoClient = new MongoClient(config.mongodbUri);
    await mongoClient.connect();
    
    const db = mongoClient.db(config.databaseName);
    const collection = db.collection(config.collectionName);
    
    // Determine the embedding field path to use
    const embeddingFieldPath = await getEmbeddingFieldPath(collection);
    console.log(`Using embedding field path: ${embeddingFieldPath}`);
    
    // Get existing document count before processing
    const existingDocumentCount = await collection.countDocuments();
    const existingUniqueSourcesCount = (await collection.distinct('metadata.source')).length;
    
    console.log(`Collection currently has ${existingDocumentCount} chunks from ${existingUniqueSourcesCount} documents`);
    
    // Do NOT clear existing documents - preserve them
    // await collection.deleteMany({}); // REMOVED THIS LINE
    
    const processedDocuments = [];
    const processingStats = [];
    
    for (const file of files) {
      const fileStartTime = Date.now();
      console.log(`Processing ${file.name} (${file.type}) with LangChain...`);
      
      // Check if this document already exists in the collection
      const existingDoc = await collection.findOne({ 'metadata.source': file.name });
      if (existingDoc) {
        console.log(`Document ${file.name} already exists in collection, skipping...`);
        processingStats.push({
          fileName: file.name,
          status: 'skipped',
          reason: 'Document already exists',
          totalTime: 0,
          chunkingTime: 0,
          insertionTime: 0,
          chunksCreated: 0
        });
        continue;
      }
      
      // Create temporary file from base64 content
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${file.name}`);
      const fileBuffer = Buffer.from(file.content, 'base64');
      fs.writeFileSync(tempFilePath, fileBuffer);
      
      try {
        const loadingStartTime = Date.now();
        let docs = [];
        const fileExtension = file.name.toLowerCase().split('.').pop();
        
        // Process different file types
        switch (fileExtension) {
          case 'pdf':
            const pdfLoader = new PDFLoader(tempFilePath, { splitPages: true });
            docs = await pdfLoader.load();
            break;
            
          case 'csv':
            const csvLoader = new CSVLoader(tempFilePath);
            docs = await csvLoader.load();
            break;
            
          case 'txt':
            const txtLoader = new TextLoader(tempFilePath);
            docs = await txtLoader.load();
            break;
            
          case 'docx':
            const docxLoader = new DocxLoader(tempFilePath);
            docs = await docxLoader.load();
            break;
            
          case 'doc':
            // Handle legacy .doc files using mammoth
            const docBuffer = fs.readFileSync(tempFilePath);
            const docResult = await mammoth.extractRawText({ buffer: docBuffer });
            docs = [{
              pageContent: docResult.value,
              metadata: { source: file.name, page: 1 }
            }];
            break;
            
          case 'xls':
          case 'xlsx':
            // Handle Excel files
            const workbook = XLSX.readFile(tempFilePath);
            const sheetNames = workbook.SheetNames;
            
            docs = sheetNames.map((sheetName, index) => {
              const worksheet = workbook.Sheets[sheetName];
              const csvData = XLSX.utils.sheet_to_csv(worksheet);
              
              return {
                pageContent: csvData,
                metadata: { 
                  source: file.name, 
                  sheet: sheetName,
                  page: index + 1
                }
              };
            });
            break;
            
          case 'pptx':
            // Handle PowerPoint files using yauzl to extract XML
            try {
              const pptxText = await extractPowerPointText(tempFilePath);
              docs = [{
                pageContent: pptxText,
                metadata: { 
                  source: file.name, 
                  page: 1
                }
              }];
            } catch (pptxError) {
              console.warn(`Error processing PPTX file ${file.name}:`, pptxError);
              // Fallback: create a single document with basic info
              docs = [{
                pageContent: `PowerPoint presentation: ${file.name}. Content could not be extracted.`,
                metadata: { source: file.name, page: 1 }
              }];
            }
            break;
            
          default:
            throw new Error(`Unsupported file type: ${fileExtension}`);
        }
        
        const loadingEndTime = Date.now();
        const loadingTime = loadingEndTime - loadingStartTime;
        console.log(`Loaded ${docs.length} documents from ${file.name}`);
        
        const chunkingStartTime = Date.now();
        // Split documents into smaller chunks for better retrieval
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
        });
        
        const splitDocs = await textSplitter.splitDocuments(docs);
        const chunkingEndTime = Date.now();
        const chunkingTime = chunkingEndTime - chunkingStartTime;
        console.log(`Split into ${splitDocs.length} chunks`);
        
        const embeddingStartTime = Date.now();
        // Process each document chunk
        const chunksWithEmbeddings = await Promise.all(
          splitDocs.map(async (doc, index) => {
            const embedding = await generateEmbedding(doc.pageContent, config.openaiApiKey);
            
            return {
              text: doc.pageContent,
              [embeddingFieldPath]: embedding,
              metadata: {
                source: file.name,
                fileType: fileExtension.toUpperCase(),
                page: doc.metadata.page || Math.floor(index / Math.max(1, splitDocs.length / docs.length)) + 1,
                sheet: doc.metadata.sheet || undefined,
                slide: doc.metadata.slide || undefined,
                chunk_index: index,
                total_chunks: splitDocs.length,
                original_document_count: docs.length
              }
            };
          })
        );
        const embeddingEndTime = Date.now();
        const embeddingTime = embeddingEndTime - embeddingStartTime;
        
        const insertionStartTime = Date.now();
        // Store in MongoDB (append to existing documents)
        if (chunksWithEmbeddings.length > 0) {
          await collection.insertMany(chunksWithEmbeddings);
          console.log(`Added ${chunksWithEmbeddings.length} new chunks to collection`);
        }
        const insertionEndTime = Date.now();
        const insertionTime = insertionEndTime - insertionStartTime;
        
        const fileEndTime = Date.now();
        const totalFileTime = fileEndTime - fileStartTime;
        
        // Record processing statistics
        processingStats.push({
          fileName: file.name,
          fileType: fileExtension.toUpperCase(),
          fileSize: formatFileSize(fileBuffer.length),
          status: 'processed',
          chunksCreated: chunksWithEmbeddings.length,
          originalDocuments: docs.length,
          loadingTime: loadingTime,
          chunkingTime: chunkingTime,
          embeddingTime: embeddingTime,
          insertionTime: insertionTime,
          totalTime: totalFileTime,
          averageTimePerChunk: Math.round(totalFileTime / chunksWithEmbeddings.length)
        });
        
        console.log(`File processing stats for ${file.name}:`);
        console.log(`  - Loading: ${loadingTime}ms`);
        console.log(`  - Chunking: ${chunkingTime}ms`);
        console.log(`  - Embedding: ${embeddingTime}ms`);
        console.log(`  - Insertion: ${insertionTime}ms`);
        console.log(`  - Total: ${totalFileTime}ms`);
        console.log(`  - Avg per chunk: ${Math.round(totalFileTime / chunksWithEmbeddings.length)}ms`);
        
        processedDocuments.push({
          id: generateId(),
          name: file.name,
          type: fileExtension.toUpperCase(),
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
    
    const overallEndTime = Date.now();
    const overallProcessingTime = overallEndTime - overallStartTime;
    
    // Get final counts
    const finalDocumentCount = existingDocumentCount + processedDocuments.reduce((sum, doc) => sum + doc.chunks.length, 0);
    const newDocumentsCount = processedDocuments.length;
    const totalChunks = processedDocuments.reduce((sum, doc) => sum + doc.chunks.length, 0);
    const fileTypes = [...new Set(processedDocuments.map(doc => doc.type))];
    
    const message = newDocumentsCount > 0 
      ? `Added ${newDocumentsCount} new documents (${fileTypes.join(', ')}) with ${totalChunks} chunks to existing collection. Total collection now has ${finalDocumentCount} chunks.`
      : `No new documents were added. All uploaded files already exist in the collection.`;
    
    res.status(200).json({ 
      success: true, 
      documents: processedDocuments,
      processingStats: processingStats,
      message: message,
      stats: {
        newDocuments: newDocumentsCount,
        newChunks: totalChunks,
        existingChunks: existingDocumentCount,
        totalChunks: finalDocumentCount
      },
      embeddingField: embeddingFieldPath
    });
    
  } catch (error) {
    console.error('Error processing documents with LangChain:', error);
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process documents with LangChain'
    });
  }
}

// Function to extract text from PowerPoint files
async function extractPowerPointText(filePath) {
  return new Promise((resolve, reject) => {
    let extractedText = '';
    
    yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        // Look for slide XML files
        if (entry.fileName.startsWith('ppt/slides/slide') && entry.fileName.endsWith('.xml')) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipfile.readEntry();
              return;
            }
            
            let xmlContent = '';
            readStream.on('data', (chunk) => {
              xmlContent += chunk.toString();
            });
            
            readStream.on('end', () => {
              // Extract text from XML using regex (basic approach)
              const textMatches = xmlContent.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
              if (textMatches) {
                textMatches.forEach(match => {
                  const text = match.replace(/<[^>]*>/g, '').trim();
                  if (text) {
                    extractedText += text + ' ';
                  }
                });
              }
              zipfile.readEntry();
            });
          });
        } else {
          zipfile.readEntry();
        }
      });
      
      zipfile.on('end', () => {
        resolve(extractedText.trim() || 'PowerPoint content could not be extracted');
      });
      
      zipfile.on('error', (err) => {
        reject(err);
      });
    });
  });
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

// Helper function to format file sizes
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}