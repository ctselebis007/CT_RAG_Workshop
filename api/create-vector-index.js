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
    const { mongodbUri, databaseName, collectionName, reset = false } = req.body;
    
    const mongoClient = new MongoClient(mongodbUri);
    await mongoClient.connect();
    
    const db = mongoClient.db(databaseName);
    
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
    
    // Check for existing embedding field in the collection
    let embeddingFieldPath = 'embedding'; // default
    
    if (!reset) {
      // Only check existing documents if not resetting
      const sampleDoc = await collection.findOne({});
      if (sampleDoc) {
        if (sampleDoc.embeddingVector) {
          embeddingFieldPath = 'embeddingVector';
          console.log('Found existing embeddingVector field, using that for index');
        } else if (sampleDoc.embedding) {
          embeddingFieldPath = 'embedding';
          console.log('Found existing embedding field, using that for index');
        } else if (sampleDoc.plot_embedding) {
          embeddingFieldPath = 'plot_embedding';
          console.log('Found existing plot_embedding field, using that for index');
        }
      }
    }
    
    // Create vector search index
    const indexDefinition = {
      name: 'rag_demo_index',
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: embeddingFieldPath,
            numDimensions: 1536,
            similarity: 'cosine'
          }
        ]
      }
    };
    
    try {
      await collection.createSearchIndex(indexDefinition);
      console.log(`Vector search index created successfully with field path: ${embeddingFieldPath}`);
    } catch (error) {
      if (error.codeName === 'IndexAlreadyExists') {
        console.log(`Vector search index already exists with field path: ${embeddingFieldPath}`);
      } else {
        throw error;
      }
    }
    
    await mongoClient.close();
    
    res.status(200).json({ 
      success: true, 
      message: reset 
        ? `Collection reset and vector search index created successfully with field: ${embeddingFieldPath}`
        : `Collection and vector search index created successfully with field: ${embeddingFieldPath}`,
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