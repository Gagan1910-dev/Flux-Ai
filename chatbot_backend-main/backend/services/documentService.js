// services/documentService.js
import fs from 'fs';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import Document from '../models/Document.js';
import DocumentChunk from '../models/DocumentChunk.js';

/**
 * 🔹 PROCESS DOCUMENT: Extract Text -> Chunk -> Save to DB
 */
export const processDocument = async (documentId) => {
  console.log(`🚀 Starting processing for document: ${documentId}`);

  try {
    // 1️⃣ Find Document
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Update status to processing
    document.status = 'processing';
    await document.save();

    // 2️⃣ Extract Text
    console.log(`📖 Extracting text from: ${document.filePath}`);
    let fullText = "";

    if (document.fileType === 'pdf') {
      const dataBuffer = fs.readFileSync(document.filePath);
      const data = await pdf(dataBuffer);
      fullText = data.text;
    } else if (document.fileType === 'docx') {
      const result = await mammoth.extractRawText({ path: document.filePath });
      fullText = result.value;
    } else {
      throw new Error(`Unsupported file type: ${document.fileType}`);
    }

    // Check if text was extracted
    if (!fullText || fullText.trim().length === 0) {
      throw new Error("No text content could be extracted from the file.");
    }

    // Normalize text (remove excessive newlines/spaces)
    fullText = fullText.replace(/\s+/g, ' ').trim();
    console.log(`✅ Extracted ${fullText.length} characters.`);

    // 3️⃣ Delete Old Chunks (if re-processing)
    await DocumentChunk.deleteMany({ documentId: document._id });

    // 4️⃣ Chunk Text
    const CHUNK_SIZE = 1000;
    const OVERLAP = 200;
    const chunks = [];

    for (let i = 0; i < fullText.length; i += (CHUNK_SIZE - OVERLAP)) {
      const chunkContent = fullText.slice(i, i + CHUNK_SIZE);
      chunks.push({
        documentId: document._id,
        chunkIndex: chunks.length,
        content: chunkContent,
        metadata: {
          startChar: i,
          endChar: i + chunkContent.length,
        }
      });
    }

    console.log(`🧩 Created ${chunks.length} chunks.`);

    // 5️⃣ Save Chunks in Bulk
    await DocumentChunk.insertMany(chunks);

    // 6️⃣ Update Document Status
    document.status = 'completed';
    document.chunkCount = chunks.length;
    await document.save();

    console.log(`🎉 Document successfully processed!`);

    return {
      success: true,
      message: "Document processed successfully",
      chunkCount: chunks.length
    };

  } catch (error) {
    console.error("❌ Document processing error:", error);

    // Update status to failed
    try {
      await Document.findByIdAndUpdate(documentId, { status: 'failed' });
    } catch (e) {
      console.error("Failed to update status to failed:", e);
    }

    return {
      success: false,
      message: error.message
    };
  }
};
