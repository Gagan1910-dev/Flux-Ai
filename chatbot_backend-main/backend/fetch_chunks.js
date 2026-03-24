import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
  .then(async () => {
    const chunkSchema = new mongoose.Schema({
      content: String,
      documentId: mongoose.Schema.Types.ObjectId,
      chunkIndex: Number,
      metadata: Object
    }, { collection: 'documentchunks' });
    const Chunk = mongoose.model('Chunk', chunkSchema);

    const docSchema = new mongoose.Schema({
      filename: String,
      originalName: String
    }, { collection: 'documents' });
    const Doc = mongoose.model('Doc', docSchema);

    const chunks = await Chunk.find().limit(2).lean();
    for (const c of chunks) {
      const doc = await Doc.findById(c.documentId);
      console.log(`-- CHUNK ${c.chunkIndex} FROM ${doc?.originalName || 'Unknown'} --`);
      console.log(c.content.substring(0, 1500));
      console.log('-----------------------------------');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
