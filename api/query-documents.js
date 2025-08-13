import { MongoClient } from 'mongodb';

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
    const { question, config } = req.body;
    
    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question, config);
    
    // Connect to MongoDB and perform vector search
    const mongoClient = new MongoClient(config.mongodbUri);
    await mongoClient.connect();
    
    const db = mongoClient.db(config.databaseName);
    const collection = db.collection(config.collectionName);
    
    // Determine the embedding field path to use
    const embeddingFieldPath = await getEmbeddingFieldPath(collection);
    console.log(`Using embedding field path for search: ${embeddingFieldPath}`);
    
    // Perform vector search to find the most relevant chunks
    const searchResults = await collection.aggregate([
      {
        $vectorSearch: {
          index: 'rag_demo_index',
          path: embeddingFieldPath,
          queryVector: questionEmbedding,
          numCandidates: 100,
          limit: 3 // Get top 3 most relevant chunks
        }
      }
    ]).toArray();
    
    await mongoClient.close();
    
    let retrievedContext = '';
    let contextSources = [];
    
    if (searchResults.length > 0) {
      // Combine multiple relevant chunks for better context
      retrievedContext = searchResults.map((result, index) => {
        const metadata = result.metadata || {};
        const fileType = metadata.fileType || 'UNKNOWN';
        const source = `[Source ${index + 1}: ${metadata.source || 'Unknown'} (${fileType}), Page ${metadata.page || 1}]`;
        contextSources.push(source);
        return `${source}\n${result.text}`;
      }).join('\n\n---\n\n');
    } else {
      retrievedContext = 'No relevant documents found.';
    }
    
    // Generate response using OpenAI with standard prompt only
    const llmResponse = await generateLLMResponse(question, retrievedContext, config);
    
    res.status(200).json({
      success: true,
      vectorSearchResult: retrievedContext,
      llmResponse: llmResponse,
      isCustomPrompt: false,
      sources: contextSources,
      numRetrievedChunks: searchResults.length
    });
    
  } catch (error) {
    console.error('Error querying documents:', error);
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to query documents'
    });
  }
}

async function generateEmbedding(text, config) {
  try {
    if (config.apiProvider === 'voyageai') {
      // VoyageAI API call
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.voyageaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.embeddingModel,
          input: [text],
        }),
      });
      
      if (!response.ok) {
        throw new Error(`VoyageAI API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data[0].embedding;
    } else {
      // OpenAI API call (default)
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.embeddingModel,
          input: text,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data[0].embedding;
    }
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

async function generateLLMResponse(question, context, config) {
  // Use only standard prompt
  const prompt = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

Context: ${context}

Question: ${question}

Helpful Answer:`;
  
  // Always use OpenAI for LLM response generation
  const response = await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo-instruct',
      prompt: prompt,
      max_tokens: 500,
      temperature: 0,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].text.trim();
}