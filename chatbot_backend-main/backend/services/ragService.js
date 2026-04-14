import FAQ from '../models/FAQ.js';
import DocumentChunk from '../models/DocumentChunk.js';
import EmbeddingService from './embeddingService.js';

const MAX_FAQ_RESULTS = 3;
const MAX_CHUNK_RESULTS = 5;

// ─────────────────────────────────────────────────────────────
// MAIN RETRIEVAL FUNCTION
// allowedDocIds: array of ObjectId strings the user may access
//                pass null to skip filter (admin)
// ─────────────────────────────────────────────────────────────
export const retrieveRelevantContext = async (query, allowedDocIds = null) => {
  try {
    // 1️⃣ Generate embedding for the incoming query
    const queryEmbedding = await EmbeddingService.generateEmbedding(query);

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

    // ── Semantic Document Chunk Search (role-filtered) ──
    let chunkResults = [];

    if (queryEmbedding && queryEmbedding.length > 0) {
      // Build role filter for document chunks
      const chunkFilter = { embedding: { $ne: null } };
      if (allowedDocIds !== null) {
        // Only search chunks that belong to authorized documents
        chunkFilter.documentId = { $in: allowedDocIds };
      }

      // Fetch all candidate chunks with embeddings for the authorized docs
      // (For pure local Node.js offline similarity calculation)
      const candidateChunks = await DocumentChunk.find(chunkFilter)
        .populate('documentId', 'filename originalName title accessLevel')
        .select('content documentId embedding')
        .lean(); // Use lean() for raw speed and memory performance

      if (candidateChunks.length > 0) {
        // 🔹 HYBRID SEARCH LOGIC: Semantic + Exact Keyword Match
        // Find potential exact IDs (alphanumeric, longer than 5 chars, e.g., '226M1A0533')
        const exactKeywords = query.split(/\s+/).filter(word => /^[A-Za-z0-9]{6,}$/.test(word));
        
        for (const chunk of candidateChunks) {
          chunk.similarityScore = EmbeddingService.cosineSimilarity(queryEmbedding, chunk.embedding);
          
          // Boost score massively if it contains the exact keyword (Roll Number)
          if (exactKeywords.length > 0) {
             for (const keyword of exactKeywords) {
                if (chunk.content.includes(keyword) || chunk.content.includes(keyword.toUpperCase())) {
                   chunk.similarityScore += 2.0; // Artificial massive boost to put exact matches at the top #1 spot
                }
             }
          }
          
          delete chunk.embedding; // free heavy array instantly from memory
        }

        // Sort descending by highest semantic (and keyword boosted) similarity
        candidateChunks.sort((a, b) => b.similarityScore - a.similarityScore);
        
        // Take top K semantically matching results
        chunkResults = candidateChunks.slice(0, MAX_CHUNK_RESULTS);
      }
    } else {
      console.warn("Query embedding failed. Falling back to empty chunk results.");
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
  // We build a STRICT SYSTEM INSTRUCTION PROMPT
  let systemPrompt = `You are a helpful, professional customer support and corporate assistant.
## CORE RULES:
1. You MUST answer the user's question ONLY using the factual context provided below.
2. If the context does not contain the answer, politely respond: "I cannot find the answer to that in the provided documents." DO NOT GUESS.
3. If tabular data is provided (especially in Markdown formats or comma-separated rows), read it row-by-row carefully and match the exact columns requested by the user.
4. Keep answers concise, factual, and strictly based on the provided documents.

## PROVIDED KNOWLEDGE / CONTEXT:\n\n`;

  // Add FAQs context
  if (context.faqs && context.faqs.length > 0) {
    systemPrompt += `### Frequently Asked Questions:\n`;
    context.faqs.forEach((faq, index) => {
      systemPrompt += `${index + 1}. Q: ${faq.question}\n   A: ${faq.answer}\n\n`;
    });
  }

  // Add semantic document chunks context
  if (context.chunks && context.chunks.length > 0) {
    systemPrompt += `### Internal Company Documents:\n`;
    context.chunks.forEach((chunk) => {
      const docName = chunk.documentId?.title || chunk.documentId?.originalName || 'Document';
      systemPrompt += `[Source: ${docName} | Relevance Score: ${(chunk.similarityScore || 0).toFixed(2)}]\n${chunk.content}\n\n`;
    });
  }

  if ((!context.faqs || context.faqs.length === 0) && (!context.chunks || context.chunks.length === 0)) {
    systemPrompt += `[SYSTEM NOTE: No relevant documents found. You must politely decline to answer domain-specific questions.]\n\n`;
  }

  // Construct structured message array for proper role injection
  const messages = [
    { role: "system", content: systemPrompt }
  ];

  // Inject History natively
  if (chatHistory && chatHistory.length > 0) {
    chatHistory.slice(-5).forEach((msg) => {
      messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
    });
  }

  // Push actual incoming question
  messages.push({ role: "user", content: query });

  return messages;
};
