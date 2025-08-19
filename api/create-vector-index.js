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
    const { mongodbUri, databaseName, collectionName, apiProvider = 'voyageai', reset = false } = req.body;
    
    const mongoClient = new MongoClient(mongodbUri);
    await mongoClient.connect();
    
    const db = mongoClient.db(databaseName);
    
    // Determine vector dimensions based on API provider
    const numDimensions = apiProvider === 'openai' ? 1536 : 1024;
    console.log(`🎯 Using ${numDimensions} dimensions for ${apiProvider} embeddings`);
    
    // FIRST: Check for existing embedding field BEFORE any collection operations
    let embeddingFieldPath = 'embedding'; // default
    
    try {
      const collections = await db.listCollections({ name: collectionName }).toArray();
      
      if (collections.length > 0) {
        // Collection exists, check for embedding field
        const collection = db.collection(collectionName);
        // Check for each field type using filtered queries
        const embeddingVectorDoc = await collection.findOne({ embeddingVector: { $exists: true } });
        if (embeddingVectorDoc) {
          embeddingFieldPath = 'embeddingVector';
          console.log('✅ Found documents with embeddingVector field, using that for index');
        } else {
          const embeddingDoc = await collection.findOne({ embedding: { $exists: true } });
          if (embeddingDoc) {
            embeddingFieldPath = 'embedding';
            console.log('✅ Found documents with embedding field, using that for index');
          } else {
            const plotEmbeddingDoc = await collection.findOne({ plot_embedding: { $exists: true } });
            if (plotEmbeddingDoc) {
              embeddingFieldPath = 'plot_embedding';
              console.log('✅ Found documents with plot_embedding field, using that for index');
            } else {
              console.log('⚠️  No embedding fields found in existing documents, using default: embedding');
            }
          }
        }
      } else {
        console.log('ℹ️  Collection does not exist, using default field: embedding');
      }
    } catch (fieldCheckError) {
      console.log('⚠️  Error checking for embedding field, using default:', fieldCheckError.message);
    }
    
    console.log(`🎯 Will create vector index with field path: ${embeddingFieldPath}`);
    if (reset) {
      // Reset mode: Drop the collection if it exists
      try {
        await db.collection(collectionName).drop();
        console.log(`Collection '${collectionName}' dropped successfully`);
      } catch (error) {
        if (error.codeName === 'NamespaceNotFound') {
          console.log(`Collection '${collectionName}' did not exist, proceeding with creation`);
        } else {
          throw error;
        }
      }
    }
    
    // Ensure the collection exists by creating it if it doesn't exist
    const collections = await db.listCollections({ name: collectionName }).toArray();
    
    if (collections.length === 0) {
      // Collection doesn't exist, create it
      await db.createCollection(collectionName);
      console.log(`Collection '${collectionName}' created successfully`);
    } else {
      console.log(`Collection '${collectionName}' already exists`);
    }
    
    const collection = db.collection(collectionName);
    
    
    // Create vector search index
    const indexDefinition = {
      name: 'rag_demo_index',
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: embeddingFieldPath,
            numDimensions: numDimensions,
            similarity: 'cosine'
          }
        ]
      }
    };
    
    try {
      await collection.createSearchIndex(indexDefinition);
      console.log(`🎉 Vector search index created successfully with field path: ${embeddingFieldPath} and ${numDimensions} dimensions`);
    } catch (error) {
      if (error.codeName === 'IndexAlreadyExists') {
        console.log(`ℹ️  Vector search index already exists with field path: ${embeddingFieldPath} and ${numDimensions} dimensions`);
      } else {
        throw error;
      }
    }
    
    await mongoClient.close();
    
    res.status(200).json({ 
      success: true, 
      message: reset 
        ? `Collection reset and vector search index created successfully with field: ${embeddingFieldPath} (${numDimensions}D)`
        : `Collection and vector search index created successfully with field: ${embeddingFieldPath} (${numDimensions}D)`,
      embeddingField: embeddingFieldPath
    });
    
  } catch (error) {
    console.error('Error creating collection and vector index:', error);
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create collection and vector index'
    });
  }
}