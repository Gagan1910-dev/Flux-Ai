import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import fs from 'fs';
import EmbeddingService from './services/embeddingService.js';
import DocumentChunk from './models/DocumentChunk.js';
dotenv.config();

async function testRAG() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const query = "what are the results of 226M1A0533";
    const queryEmbedding = await EmbeddingService.generateEmbedding(query);
    
    const output = {
        queryHasEmbedding: !!queryEmbedding,
        queryEmbeddingLen: queryEmbedding ? queryEmbedding.length : 0,
        candidateChunksFound: 0,
        chunksPreview: []
    };

    if (queryEmbedding && queryEmbedding.length > 0) {
        const candidateChunks = await DocumentChunk.find({ embedding: { $ne: null } })
            .select('content embedding')
            .lean();
            
        output.candidateChunksFound = candidateChunks.length;
        
        if (candidateChunks.length > 0) {
            for (const chunk of candidateChunks) {
                chunk.similarityScore = EmbeddingService.cosineSimilarity(queryEmbedding, chunk.embedding);
            }
            candidateChunks.sort((a, b) => b.similarityScore - a.similarityScore);
            output.chunksPreview = candidateChunks.slice(0, 5).map(c => ({ score: c.similarityScore, content: c.content }));
        }
    }
    
    fs.writeFileSync('test_query_output.json', JSON.stringify(output, null, 2), 'utf8');
    
    mongoose.disconnect();
  } catch (error) {
    fs.writeFileSync('test_query_output.json', JSON.stringify({ error: error.message }), 'utf8');
    mongoose.disconnect();
  }
}
testRAG();
