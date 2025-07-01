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
    const { question, config } = req.body;
    
    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question, config.openaiApiKey);
    
    // Connect to MongoDB and perform vector search
    const mongoClient = new MongoClient(config.mongodbUri);
    await mongoClient.connect();
    
    const db = mongoClient.db(config.databaseName);
    const collection = db.collection(config.collectionName);
    
    // Perform vector search to find the most relevant chunks
    const searchResults = await collection.aggregate([
      {
        $vectorSearch: {
          index: 'rag_demo_index',
          path: 'embedding',
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
        const fileType = result.metadata.fileType || 'UNKNOWN';
        const source = `[Source ${index + 1}: ${result.metadata.source} (${fileType}), Page ${result.metadata.page}]`;
        contextSources.push(source);
        return `${source}\n${result.text}`;
      }).join('\n\n---\n\n');
    } else {
      retrievedContext = 'No relevant documents found.';
    }
    
    // Generate response using OpenAI with standard prompt only
    const llmResponse = await generateLLMResponse(question, retrievedContext, config.openaiApiKey);
    
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

async function generateEmbedding(text, apiKey) {
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
}

async function generateLLMResponse(question, context, apiKey) {
  // Use only standard prompt
  const prompt = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

Context: ${context}

Question: ${question}

Helpful Answer:`;
  
  const response = await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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