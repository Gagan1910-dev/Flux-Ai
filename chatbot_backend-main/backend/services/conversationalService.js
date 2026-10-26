/**
 * conversationalService.js
 * 
 * Lightweight conversational intent detection and response engine for Flux AI.
 * Handles greetings, identity, gratitude, capabilities, and farewells gracefully
 * without running unnecessary semantic vector searches or producing robotic
 * "insufficient evidence" disclaimers for ordinary pleasantries.
 */

const DEFAULT_DOCUMENT_SUGGESTIONS = [
  "How many weeks of paid maternity leave are employees eligible for?",
  "What is the annual leave entitlement for employees?",
  "What is the monthly connectivity allowance for remote work?",
  "What are the standard core office hours?"
];

/**
 * Detects if a message is a pure conversational query (greeting, identity, etc.)
 * versus a substantive organizational document query.
 * 
 * @param {string} message - Raw user input
 * @returns {object|null} Intent object or null if query should proceed to RAG
 */
export const detectConversationalIntent = (message) => {
  if (!message || typeof message !== 'string') return null;

  const trimmed = message.trim();
  if (!trimmed) return null;

  // Normalize: lower case, remove punctuation, collapse whitespace
  const normalized = trimmed
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Substantive domain keywords — if present, MUST proceed to RAG search
  const substantiveKeywords = [
    'policy', 'leave', 'maternity', 'paternity', 'vacation', 'holiday',
    'remote', 'stipend', 'allowance', 'bereavement', 'compensation', 'salary',
    'bonus', 'executive', 'attendance', 'hours', 'relocation', 'transfer',
    'benefit', 'insurance', 'health', 'medical', 'document', 'file', 'upload',
    'faq', 'guideline', 'rule', 'contract', 'agreement', 'hybrid', 'core',
    'eligibility', 'entitlement', 'claim', 'supersede', 'revision'
  ];

  const hasSubstantive = substantiveKeywords.some(kw =>
    new RegExp(`\\b${kw}\\b`, 'i').test(normalized)
  );

  if (hasSubstantive) {
    return null; // Route to RAG pipeline
  }

  // 1. Identity & Name Queries
  if (
    /^(may i|can i|could i)?\s*(know|get|ask)?\s*(your|ur)?\s*name\b/i.test(normalized) ||
    /^(what is|whats|what's)\s*(your|ur)\s*name\b/i.test(normalized) ||
    /^who are you\b/i.test(normalized) ||
    /^what are you\b/i.test(normalized) ||
    /^tell me about yourself\b/i.test(normalized) ||
    /^who created you\b/i.test(normalized) ||
    /^who made you\b/i.test(normalized) ||
    /^what is flux ai\b/i.test(normalized) ||
    /^what is flux\b/i.test(normalized)
  ) {
    return {
      type: 'identity',
      answer: "I'm **Flux AI**, your organizational knowledge assistant. I can help you find and verify information across documents available to you, such as company policies, leave entitlements, and workplace guidelines.",
      suggestedFollowUp: "What is the annual leave allowance?"
    };
  }

  // 2. Greetings
  if (
    /^(hello|hi|hey|heya|howdy|greetings|good morning|good afternoon|good evening|hey there|hi there|yo)(\s+flux|\s+ai)?$/i.test(normalized) ||
    /^(what'?s up|sup)$/i.test(normalized) ||
    /^hello\s*!*$/i.test(normalized) ||
    /^hi\s*!*$/i.test(normalized)
  ) {
    return {
      type: 'greeting',
      answer: "Hi! 👋 How can I help you today? You can ask me about company policies, leave entitlements, remote work guidelines, or any organizational documents available to you.",
      suggestedFollowUp: "How many weeks of paid maternity leave are employees eligible for?"
    };
  }

  // 3. Gratitude & Appreciation
  if (
    /^(thank you|thanks|thank u|thx|ty|thanks a lot|thank you so much|appreciate it|much appreciated)(\s+flux|\s+ai)?$/i.test(normalized) ||
    /^(great|awesome|perfect|excellent|sounds good|got it|cool)(\s+thanks|\s+thank you)?$/i.test(normalized)
  ) {
    return {
      type: 'gratitude',
      answer: "You're welcome! 😊 Let me know if you need help with any other company policies or documents.",
      suggestedFollowUp: "What is the monthly connectivity allowance for remote work?"
    };
  }

  // 4. Capabilities & Help
  if (
    /^(what can you do|how can you help|what do you do|help|how does this work|what are your capabilities|what documents can i ask about)\b/i.test(normalized)
  ) {
    return {
      type: 'capabilities',
      answer: "I help you find accurate, verified answers from your organization's documents. Here is what I can do:\n\n- **Answer Policy Questions**: Look up leave balances, parental benefits, and workplace guidelines.\n- **Verify Evidence**: Show you the exact source document and page number backing every answer.\n- **Flag Policy Conflicts**: Detect contradictory rules between different policy versions.\n- **Preserve Data Integrity**: If information isn't in your documents, I will tell you honestly rather than guessing.\n\nTry asking: *\"What is the annual leave allowance?\"* or *\"What is the maternity leave entitlement?\"*",
      suggestedFollowUp: "What is the annual leave entitlement for employees?"
    };
  }

  // 5. Farewells
  if (
    /^(goodbye|bye|bye bye|see you|see ya|cya|have a good day|have a great day|have a good one|take care)$/i.test(normalized)
  ) {
    return {
      type: 'farewell',
      answer: "Goodbye! Have a great day ahead! 👋 Feel free to return whenever you need document assistance.",
      suggestedFollowUp: null
    };
  }

  return null;
};

/**
 * Builds the verification metadata object for conversational intents.
 */
export const buildConversationalVerification = (intent) => {
  return {
    state: 'conversational',
    statusLabel: 'Conversational',
    confidenceReason: 'Direct conversational response from Flux AI.',
    missingInformation: null,
    suggestedFollowUp: intent.suggestedFollowUp || DEFAULT_DOCUMENT_SUGGESTIONS[0],
    conflictDetails: null,
    sources: [],
    retrievedContext: []
  };
};

export { DEFAULT_DOCUMENT_SUGGESTIONS };
