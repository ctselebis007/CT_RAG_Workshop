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
    const { mongodbUri, databaseName, collectionName } = req.body;
    
    const mongoClient = new MongoClient(mongodbUri);
    await mongoClient.connect();
    
    const db = mongoClient.db(databaseName);
    
    // First, ensure the collection exists by creating it if it doesn't exist
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
      definition: {
        mappings: {
          dynamic: true,
          fields: {
            embedding: {
              type: 'knnVector',
              dimensions: 1536,
              similarity: 'cosine'
            }
          }
        }
      }
    };
    
    try {
      await collection.createSearchIndex(indexDefinition);
      console.log('Vector search index created successfully');
    } catch (error) {
      if (error.codeName === 'IndexAlreadyExists') {
        console.log('Vector search index already exists');
      } else {
        throw error;
      }
    }
    
    await mongoClient.close();
    
    res.status(200).json({ 
      success: true, 
      message: 'Collection and vector search index created successfully'
    });
    
  } catch (error) {
    console.error('Error creating collection and vector index:', error);
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create collection and vector index'
    });
  }
}