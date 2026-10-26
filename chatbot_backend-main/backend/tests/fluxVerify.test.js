import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

import { parseVerificationResponse, buildContextualPrompt } from '../services/ragService.js';

describe('FLUX VERIFY — Signature Innovation Engine Test Suite', () => {

  // ─────────────────────────────────────────────────────────────
  // 1. Supported Evidence Grounding
  // ─────────────────────────────────────────────────────────────
  describe('1. Supported Evidence Grounding', () => {
    it('should correctly format supported answers with genuine chunk metadata and page numbers', () => {
      const mockChunks = [
        {
          _id: 'chunk_123',
          chunkIndex: 0,
          content: 'Full-time employees receive 22 days of paid annual leave per calendar year.',
          similarityScore: 0.89,
          metadata: { pageNumber: 4 },
          documentId: {
            _id: 'doc_123',
            title: 'Employee Handbook 2024',
            originalName: 'Employee_Handbook_2024.docx',
          },
        },
      ];

      const rawLlmResponse = JSON.stringify({
        verificationState: 'supported',
        answer: 'Employees are entitled to **22 days of paid annual leave**.',
        confidenceReason: 'The employee handbook explicitly defines the 22-day entitlement.',
        missingInformation: null,
        suggestedFollowUp: null,
        conflictDetails: null,
      });

      const result = parseVerificationResponse(rawLlmResponse, mockChunks, []);

      assert.equal(result.verification.state, 'supported');
      assert.equal(result.verification.statusLabel, 'Supported by sources');
      assert.equal(result.verification.sources.length, 1);
      assert.equal(result.verification.sources[0].title, 'Employee Handbook 2024');
      assert.equal(result.verification.sources[0].pageNumber, 4, 'Must accurately reflect genuine page number');
      assert.equal(result.verification.sources[0].relevanceScore, 89);
      assert.match(result.verification.sources[0].passage, /22 days of paid annual leave/);
    });

    it('should omit page numbers when metadata.pageNumber is null or undefined (no fabrication)', () => {
      const mockChunks = [
        {
          _id: 'chunk_456',
          chunkIndex: 2,
          content: 'Core office hours are 9:00 AM to 5:00 PM EST.',
          similarityScore: 0.82,
          metadata: {}, // No pageNumber
          documentId: {
            _id: 'doc_456',
            originalName: 'Workplace_Flexibility_Policy_2022.docx',
          },
        },
      ];

      const rawLlm = JSON.stringify({
        verificationState: 'supported',
        answer: 'Core office hours are 9 AM to 5 PM.',
        confidenceReason: 'Document states core hours directly.',
      });

      const result = parseVerificationResponse(rawLlm, mockChunks, []);
      assert.equal(result.verification.sources[0].pageNumber, null, 'Must NOT fabricate page numbers');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Insufficient Evidence Detection
  // ─────────────────────────────────────────────────────────────
  describe('2. Insufficient Evidence Detection', () => {
    it('should force insufficient state when no matching chunks are available for the user role', () => {
      const rawLlmHallucination = JSON.stringify({
        verificationState: 'supported', // LLM mistakenly claimed supported
        answer: 'The company provides 100% pet relocation reimbursement.',
      });

      // No chunks available (empty retrieval)
      const result = parseVerificationResponse(rawLlmHallucination, [], []);

      assert.equal(result.verification.state, 'insufficient', 'Backend must enforce insufficient state when chunk count is zero');
      assert.equal(result.verification.statusLabel, 'Insufficient evidence');
      assert.ok(result.verification.missingInformation, 'Must provide missing information note');
      assert.equal(result.verification.sources.length, 0, 'No sources should be fabricated');
    });

    it('should preserve missing information explanation and suggested follow-ups', () => {
      const rawLlm = JSON.stringify({
        verificationState: 'insufficient',
        answer: 'The provided documents do not contain information on pet relocation assistance.',
        confidenceReason: 'Only HR leave policies were retrieved.',
        missingInformation: 'Pet relocation policies and international travel reimbursement guidelines are not covered.',
        suggestedFollowUp: 'Would you like to review the standard annual leave or remote work policies instead?',
        conflictDetails: null,
      });

      const result = parseVerificationResponse(rawLlm, [], []);
      assert.equal(result.verification.state, 'insufficient');
      assert.match(result.verification.missingInformation, /Pet relocation policies/i);
      assert.match(result.verification.suggestedFollowUp, /annual leave/i);
    });

    it('should ensure sources is empty for insufficient answers even when candidate chunks exist, preserving retrievedContext as non-proof audit context', () => {
      const unrelatedChunks = [
        {
          _id: 'chunk_stipend',
          content: 'Employees receive $50 USD monthly connectivity stipend for remote work broadband.',
          similarityScore: 0.35,
          documentId: { title: 'HR Leave and Benefits Policy 2024' },
        },
      ];

      const rawLlm = JSON.stringify({
        verificationState: 'insufficient',
        answer: 'The reference context does not cover international pet relocation.',
        confidenceReason: 'Only remote work stipend was retrieved.',
        missingInformation: 'Pet relocation policies are absent.',
        suggestedFollowUp: 'Ask about remote work stipend instead.',
        sourcesUsed: [],
      });

      const result = parseVerificationResponse(rawLlm, unrelatedChunks, []);
      assert.equal(result.verification.state, 'insufficient');
      assert.equal(result.verification.sources.length, 0, 'Sources must be empty for insufficient answers - never show unrelated passages as proof!');
      assert.equal(result.verification.retrievedContext.length, 1, 'retrievedContext must preserve candidates for inspection');
      assert.equal(result.verification.retrievedContext[0].title, 'HR Leave and Benefits Policy 2024');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Conflicting Documents Detection
  // ─────────────────────────────────────────────────────────────
  describe('3. Conflicting Documents Detection', () => {
    it('should correctly format and surface contradictory source claims', () => {
      const mockChunks = [
        {
          _id: 'chunk_a',
          content: 'Full-time staff receive 15 days of paid annual leave per year.',
          similarityScore: 0.85,
          documentId: { title: 'Workplace Flexibility Policy 2022' },
        },
        {
          _id: 'chunk_b',
          content: 'All full-time employees are entitled to 22 days of paid annual leave per year.',
          similarityScore: 0.87,
          documentId: { title: 'HR Leave and Benefits Policy 2024' },
        },
      ];

      const rawLlm = JSON.stringify({
        verificationState: 'conflicting',
        answer: 'The retrieved documents contain conflicting policies regarding annual leave entitlement.',
        confidenceReason: 'Different policy documents specify incompatible leave day allowances.',
        missingInformation: null,
        suggestedFollowUp: null,
        conflictDetails: {
          summary: 'The 2022 policy states 15 days, whereas the 2024 policy specifies 22 days.',
          claimA: {
            source: 'Workplace Flexibility Policy 2022',
            claim: 'Full-time staff receive 15 days of paid leave.',
            dateOrVersion: '2022',
          },
          claimB: {
            source: 'HR Leave and Benefits Policy 2024',
            claim: 'All full-time employees are entitled to 22 days of paid leave.',
            dateOrVersion: '2024',
          },
        },
      });

      const result = parseVerificationResponse(rawLlm, mockChunks, []);

      assert.equal(result.verification.state, 'conflicting');
      assert.equal(result.verification.statusLabel, 'Conflicting sources detected');
      assert.ok(result.verification.conflictDetails, 'Conflict details must be present');
      assert.equal(result.verification.conflictDetails.claimA.source, 'Workplace Flexibility Policy 2022');
      assert.equal(result.verification.conflictDetails.claimB.source, 'HR Leave and Benefits Policy 2024');
      assert.equal(result.verification.sources.length, 2);
    });
  });
});
