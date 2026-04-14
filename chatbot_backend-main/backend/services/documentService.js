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
  // 1. Initial split by double newlines (paragraphs/sections)
  // Instead of destroying all newlines, we preserve them and split by empty lines
  const blocks = text.split(/\n\s*\n/);
  const chunks = [];
  const maxChunkSize = 800;

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;

    // Basic heuristic for tabular/row data: Replace excessive multiple spaces/tabs with commas for readable rows
    // This turns "101   Alice   94   A" into "101, Alice, 94, A"
    if (block.includes('  ') || block.includes('\t')) {
      block = block.replace(/[ \t]{2,}/g, ', ');
    }

    if (block.length <= maxChunkSize) {
      chunks.push(block);
    } else {
      // 2. If block is too large, split by single newlines (rows/sentences)
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
 * This accepts a pre-loaded Buffer so we never need to re-download from Cloudinary.
 */
export const processDocumentFromBuffer = async (documentId, dataBuffer, fileType) => {
  const document = await Document.findById(documentId);
  if (!document) throw new Error(`Document not found: ${documentId}`);

  document.status = 'processing';
  await document.save();

  let fullText = '';
  
  if (fileType === 'pdf') {
    // 🔥 LLAMAPARSE INTEGRATION FOR UNIVERSAL PDF HANDLING 🔥
    const apiKey = process.env.LLAMAPARSE_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error("LlamaParse API Key is missing. Please check your .env file.");
    }
    
    console.log(`🤖 Sending PDF to LlamaParse API for Universal Markdown Conversion...`);
    const formData = new FormData();
    const blob = new Blob([dataBuffer], { type: 'application/pdf' });
    formData.append('file', blob, document.originalName || 'file.pdf');

    // 1. Upload File
    const uploadRes = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });
    
    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`LlamaParse Upload Failed: ${uploadRes.status} ${err}`);
    }
    
    const { id: jobId } = await uploadRes.json();
    console.log(`⏳ LlamaParse Job [${jobId}] created. Analyzing complex layout and tables...`);

    // 2. Poll for Status
    let status = 'PENDING';
    while (status === 'PENDING' || status === 'IN_PROGRESS') {
      await new Promise(res => setTimeout(res, 2000));
      const statusRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      const statusData = await statusRes.json();
      status = statusData.status;

      if (status === 'ERROR') {
        throw new Error('LlamaParse failed to interpret the document.');
      }
    }

    // 3. Fetch Markdown
    const markdownRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    if (!markdownRes.ok) throw new Error('Failed to retrieve Markdown output from LlamaParse.');
    
    const markdownData = await markdownRes.json();
    fullText = markdownData.markdown;
    console.log(`✅ LlamaParse successfully converted PDF into intelligent Markdown!`);

  } else if (fileType === 'docx') {
    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    fullText = result.value;
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  if (!fullText || fullText.trim().length === 0)
    throw new Error('No text content could be extracted from the file.');

  fullText = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  console.log(`✅ Extracted ${fullText.length} characters.`);

  await DocumentChunk.deleteMany({ documentId: document._id });

  const textChunks = semanticChunking(fullText);
  console.log(`🧩 Created ${textChunks.length} semantic chunks. Generating embeddings...`);

  const chunks = [];
  for (let i = 0; i < textChunks.length; i++) {
    const chunkText = textChunks[i];
    if (i % 10 === 0) console.log(`🧠 Embedding chunk ${i + 1}/${textChunks.length}...`);
    const embedding = await EmbeddingService.generateEmbedding(chunkText);
    chunks.push({
      documentId: document._id,
      chunkIndex: i,
      content: chunkText,
      embedding,
      metadata: { length: chunkText.length }
    });
  }

  await DocumentChunk.insertMany(chunks);
  document.status = 'completed';
  document.chunkCount = chunks.length;
  await document.save();
  console.log(`🎉 Document successfully embedded and processed!`);
  return { success: true, message: 'Document processed successfully', chunkCount: chunks.length };
};

/**
 * 🔹 PROCESS DOCUMENT: Re-ingestion trigger (admin endpoint).
 * For local files: reads from disk and processes.
 * For Cloudinary URLs: cannot re-download (CDN restriction) — admin must delete & re-upload.
 */
export const processDocument = async (documentId) => {
  console.log(`🚀 Starting processing for document: ${documentId}`);

  try {
    const document = await Document.findById(documentId);
    if (!document) throw new Error(`Document not found: ${documentId}`);

    if (document.filePath.startsWith('http')) {
      // Cloudinary files cannot be downloaded back due to strict CDN access controls.
      // The correct flow is: delete this document and re-upload it — processing now
      // happens in-memory at upload time and does not require downloading from Cloudinary.
      throw new Error(
        'This document was uploaded before the buffer-processing update was applied. ' +
        'Please delete it from the admin panel and re-upload — it will be processed automatically.'
      );
    }

    // Local file: read from disk and process
    const dataBuffer = fs.readFileSync(document.filePath);
    return await processDocumentFromBuffer(documentId, dataBuffer, document.fileType);

  } catch (error) {
    console.error('❌ Document processing error:', error.message);
    try {
      await Document.findByIdAndUpdate(documentId, { status: 'failed' });
    } catch (_) {}
    return { success: false, message: error.message };
  }
};
