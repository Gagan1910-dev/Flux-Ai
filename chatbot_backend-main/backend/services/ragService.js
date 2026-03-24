import FAQ from '../models/FAQ.js';
import DocumentChunk from '../models/DocumentChunk.js';

const MAX_FAQ_RESULTS = 5;
const MAX_CHUNK_RESULTS = 5;

// ─────────────────────────────────────────────────────────────
// MAIN RETRIEVAL FUNCTION
// allowedDocIds: array of ObjectId strings the user may access
//                pass null to skip filter (admin)
// ─────────────────────────────────────────────────────────────
export const retrieveRelevantContext = async (query, allowedDocIds = null) => {
  try {
    // ── FAQ Search (role-unrestricted, general company Q&A) ──
    const faqs = await FAQ.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(MAX_FAQ_RESULTS)
      .select('question answer');

    let faqResults = faqs;
    if (faqs.length === 0) {
      const regex = new RegExp(query.split(' ').join('|'), 'i');
      faqResults = await FAQ.find({
        $or: [{ question: regex }, { answer: regex }],
      }).limit(MAX_FAQ_RESULTS).select('question answer');
    }

    // ── Document Chunk Search (role-filtered) ──
    // Build role filter for document chunks
    const chunkFilter = {};
    if (allowedDocIds !== null) {
      // Only search chunks that belong to authorized documents
      chunkFilter.documentId = { $in: allowedDocIds };
    }

    const chunks = await DocumentChunk.find(
      { $text: { $search: query }, ...chunkFilter },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(MAX_CHUNK_RESULTS)
      .populate('documentId', 'filename originalName title accessLevel')
      .select('content documentId');

    let chunkResults = chunks;
    if (chunks.length === 0) {
      const regex = new RegExp(query.split(' ').join('|'), 'i');
      chunkResults = await DocumentChunk.find({
        content: regex,
        ...chunkFilter,
      })
        .limit(MAX_CHUNK_RESULTS)
        .populate('documentId', 'filename originalName title accessLevel')
        .select('content documentId');
    }

    return {
      faqs: faqResults,
      chunks: chunkResults,
    };
  } catch (error) {
    console.error('Error retrieving context:', error);
    return { faqs: [], chunks: [] };
  }
};

export const buildContextualPrompt = (query, context, chatHistory = []) => {
  let prompt = `You are a helpful customer support assistant for a company. Use the following information to answer the user's question accurately and helpfully.\n\n`;

  // Add FAQs context
  if (context.faqs && context.faqs.length > 0) {
    prompt += `## Frequently Asked Questions (FAQs):\n\n`;
    context.faqs.forEach((faq, index) => {
      prompt += `${index + 1}. Q: ${faq.question}\n   A: ${faq.answer}\n\n`;
    });
  }

  // Add document chunks context (already filtered by role)
  if (context.chunks && context.chunks.length > 0) {
    prompt += `## Company Documents:\n\n`;
    context.chunks.forEach((chunk) => {
      const docName = chunk.documentId?.title || chunk.documentId?.originalName || 'Document';
      prompt += `[From ${docName}]\n${chunk.content}\n\n`;
    });
  }

  // Add conversation history
  if (chatHistory && chatHistory.length > 0) {
    prompt += `## Previous Conversation:\n\n`;
    chatHistory.slice(-5).forEach((msg) => {
      prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    });
    prompt += `\n`;
  }

  prompt += `## Current Question:\n${query}\n\n`;
  prompt += `Please provide a helpful, accurate answer based on the information provided above. If the information doesn't contain the answer, say so politely and offer to help with other questions.`;

  return prompt;
};
