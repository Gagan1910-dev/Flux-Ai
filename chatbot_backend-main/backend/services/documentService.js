import fs from 'fs';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import Document from '../models/Document.js';
import DocumentChunk from '../models/DocumentChunk.js';
import EmbeddingService from './embeddingService.js';

/**
 * 🔹 SEMANTIC CHUNKING HELPER
 */
const semanticChunking = (text) => {
  const blocks = text.split(/\n\s*\n/);
  const chunks = [];
  const maxChunkSize = 800;

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;

    if (block.includes('  ') || block.includes('\t')) {
      block = block.replace(/[ \t]{2,}/g, ', ');
    }

    if (block.length <= maxChunkSize) {
      chunks.push(block);
    } else {
      const subBlocks = block.split('\n');
      let currentSubChunk = '';

      for (const sub of subBlocks) {
        if (currentSubChunk.length + sub.length > maxChunkSize) {
          if (currentSubChunk) chunks.push(currentSubChunk.trim());
          currentSubChunk = sub;
        } else {
          currentSubChunk += (currentSubChunk ? '\n' : '') + sub;
        }
      }
      if (currentSubChunk) chunks.push(currentSubChunk.trim());
    }
  }
  return chunks;
};

/**
 * 🔹 CORE: Extract text from buffer and embed into DB
 */
export const processDocumentFromBuffer = async (documentId, dataBuffer, fileType) => {
  const document = await Document.findById(documentId);
  if (!document) throw new Error(`Document not found: ${documentId}`);

  document.status = 'processing';
  await document.save();

  try {
    let fullText = '';

    if (fileType === 'pdf') {
      const apiKey = process.env.LLAMAPARSE_API_KEY;

      // Primary strategy: LlamaParse if key is provided
      if (apiKey && apiKey.trim() !== '') {
        try {
          console.log(`🤖 Sending PDF to LlamaParse API...`);
          const formData = new FormData();
          const blob = new Blob([dataBuffer], { type: 'application/pdf' });
          formData.append('file', blob, document.originalName || 'file.pdf');

          const uploadRes = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData,
          });

          if (!uploadRes.ok) {
            throw new Error(`Upload returned status ${uploadRes.status}`);
          }

          const { id: jobId } = await uploadRes.json();
          let status = 'PENDING';
          let attempts = 0;
          const maxAttempts = 20; // 40-second timeout

          while ((status === 'PENDING' || status === 'IN_PROGRESS') && attempts < maxAttempts) {
            await new Promise(res => setTimeout(res, 2000));
            attempts++;
            const statusRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              status = statusData.status;
            }
          }

          if (status === 'SUCCESS') {
            const markdownRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (markdownRes.ok) {
              const markdownData = await markdownRes.json();
              fullText = markdownData.markdown;
              console.log(`✅ LlamaParse successfully parsed PDF.`);
            }
          }
        } catch (llamaErr) {
          console.warn(`⚠️ LlamaParse unavailable (${llamaErr.message}). Falling back to local pdf-parse...`);
        }
      }

      // Safe local fallback with pdf-parse if LlamaParse is disabled, timed out, or failed
      if (!fullText || fullText.trim().length === 0) {
        console.log(`📄 Parsing PDF using local pdf-parse engine...`);
        const parsed = await pdf(dataBuffer);
        fullText = parsed.text;
      }

    } else if (fileType === 'docx') {
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      fullText = result.value;
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    if (!fullText || fullText.trim().length === 0) {
      throw new Error('No readable text content could be extracted from the file.');
    }

    fullText = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Purge old chunks for this document before inserting new ones
    await DocumentChunk.deleteMany({ documentId: document._id });

    const textChunks = semanticChunking(fullText);
    const chunks = [];

    for (let i = 0; i < textChunks.length; i++) {
      const chunkText = textChunks[i];
      const embedding = await EmbeddingService.generateEmbedding(chunkText);
      chunks.push({
        documentId: document._id,
        chunkIndex: i,
        content: chunkText,
        embedding,
        metadata: { length: chunkText.length },
      });
    }

    await DocumentChunk.insertMany(chunks);

    document.status = 'completed';
    document.chunkCount = chunks.length;
    await document.save();

    console.log(`🎉 Document ${document._id} successfully embedded (${chunks.length} chunks).`);
    return { success: true, chunkCount: chunks.length };
  } catch (err) {
    console.error(`❌ Ingestion failed for document ${documentId}:`, err.message);
    document.status = 'failed';
    await document.save();
    // Clean up partial chunks on failure to prevent corrupted retrieval state
    await DocumentChunk.deleteMany({ documentId: document._id }).catch(() => {});
    throw err;
  }
};

/**
 * 🔹 PROCESS DOCUMENT: Re-ingestion trigger (admin endpoint).
 */
export const processDocument = async (documentId) => {
  try {
    const document = await Document.findById(documentId);
    if (!document) throw new Error(`Document not found: ${documentId}`);

    if (document.filePath.startsWith('http')) {
      throw new Error('Cloud storage files must be re-uploaded to reprocess.');
    }

    if (!fs.existsSync(document.filePath)) {
      throw new Error('Local source file does not exist on disk.');
    }

    const dataBuffer = fs.readFileSync(document.filePath);
    return await processDocumentFromBuffer(documentId, dataBuffer, document.fileType);
  } catch (error) {
    await Document.findByIdAndUpdate(documentId, { status: 'failed' }).catch(() => {});
    return { success: false, message: error.message };
  }
};
