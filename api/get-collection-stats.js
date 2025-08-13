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
    const collection = db.collection(collectionName);
    
    // Get collection statistics
    const totalChunks = await collection.countDocuments();
    
    // Get unique document sources
    const uniqueSources = await collection.distinct('metadata.source');
    const totalDocuments = uniqueSources.length;
    
    // Get document breakdown by type
    const documentTypes = await collection.aggregate([
      {
        $group: {
          _id: '$metadata.fileType',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    // Check embedding dimensions to determine the API provider used
    let embeddingDimensions = null;
    let embeddingFieldPath = null;
    
    // Check for different embedding field names and get dimensions
    const sampleDoc = await collection.findOne({
      $or: [
        { embedding: { $exists: true } },
        { embeddingVector: { $exists: true } },
        { plot_embedding: { $exists: true } }
      ]
    });
    
    if (sampleDoc) {
      if (sampleDoc.embedding && Array.isArray(sampleDoc.embedding)) {
        embeddingDimensions = sampleDoc.embedding.length;
        embeddingFieldPath = 'embedding';
      } else if (sampleDoc.embeddingVector && Array.isArray(sampleDoc.embeddingVector)) {
        embeddingDimensions = sampleDoc.embeddingVector.length;
        embeddingFieldPath = 'embeddingVector';
      } else if (sampleDoc.plot_embedding && Array.isArray(sampleDoc.plot_embedding)) {
        embeddingDimensions = sampleDoc.plot_embedding.length;
        embeddingFieldPath = 'plot_embedding';
      }
    }
    
    await mongoClient.close();
    
    res.status(200).json({
      success: true,
      stats: {
        totalDocuments,
        totalChunks,
        uniqueSources,
        embeddingDimensions,
        embeddingFieldPath,
        documentTypes: documentTypes.reduce((acc, type) => {
          acc[type._id || 'UNKNOWN'] = type.count;
          return acc;
        }, {})
      }
    });
    
  } catch (error) {
    console.error('Error getting collection stats:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get collection statistics'
    });
  }
}