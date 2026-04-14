import fs from 'fs';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const DocumentChunk = mongoose.model('DocumentChunk', new mongoose.Schema({
  content: String,
  documentId: mongoose.Schema.Types.ObjectId
}, { collection: 'documentchunks' }));

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const chunks = await DocumentChunk.find({ content: { $regex: '226M1A0533', $options: 'i' } });
    
    fs.writeFileSync('chunks.json', JSON.stringify({
      count: chunks.length,
      chunks: chunks.map(c => c.content)
    }, null, 2), 'utf8');

    console.log('Saved to chunks.json');
    mongoose.disconnect();
  } catch (error) {
    console.error(error);
    mongoose.disconnect();
  }
}
test();
