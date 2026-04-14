import fs from 'fs';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const DocumentSchema = new mongoose.Schema({}, { strict: false, collection: 'documents' });
const Document = mongoose.model('Document', DocumentSchema);

async function checkLatestDocument() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Fetch latest 3 documents
    const latestDocs = await Document.find().sort({ createdAt: -1 }).limit(3);
    
    const output = latestDocs.map((doc, i) => ({
      index: i + 1,
      title: doc.title,
      id: doc._id,
      fileType: doc.fileType,
      url: doc.url || doc.path,
      status: doc.status,
      createdAt: doc.createdAt || doc.uploadDate
    }));
    
    fs.writeFileSync('docs_output.json', JSON.stringify(output, null, 2), 'utf-8');
    
    mongoose.disconnect();
  } catch (error) {
    fs.writeFileSync('docs_output.json', JSON.stringify({ error: error.message }), 'utf-8');
    mongoose.disconnect();
  }
}

checkLatestDocument();
