import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'http://localhost:5000/api';

async function runScenarioTests() {
  console.log('🚀 Testing Flux Verify Live Scenarios against', API_BASE);

  // 1. Get Guest Session
  const guestSession = await (await fetch(`${API_BASE}/auth/guest-session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
  const guestHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${guestSession.token}` };

  // Helper to ask a question
  const ask = async (question, headers = guestHeaders) => {
    const res = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: question, sessionId: `test-session-${Date.now()}` }),
    });
    return await res.json();
  };

  console.log('\n======================================================');
  console.log('SCENARIO 1: Direct Question');
  console.log('Query: "What is the maternity leave entitlement for female employees?"');
  const s1 = await ask('What is the maternity leave entitlement for female employees?');
  console.log('State:', s1.verification?.state, '| Label:', s1.verification?.statusLabel);
  console.log('Answer:', s1.message);
  console.log('Sources cited count:', s1.verification?.sources?.length);
  if (s1.verification?.sources?.length > 0) {
    const s = s1.verification.sources[0];
    console.log(`Source 1: "${s.title}" (Page: ${s.pageNumber}, Score: ${s.relevanceScore}%)`);
  }

  console.log('\n======================================================');
  console.log('SCENARIO 2: Cross-Document Question');
  console.log('Query: "What are the core operating office hours and the monthly remote work connectivity stipend?"');
  const s2 = await ask('What are the core operating office hours and the monthly remote work connectivity stipend?');
  console.log('State:', s2.verification?.state, '| Label:', s2.verification?.statusLabel);
  console.log('Answer:', s2.message);
  console.log('Distinct source documents cited:', [...new Set(s2.verification?.sources?.map(s => s.title))]);

  console.log('\n======================================================');
  console.log('SCENARIO 3: Conflicting Policies');
  console.log('Query: "How many days of paid annual leave are full-time employees entitled to per year?"');
  const s3 = await ask('How many days of paid annual leave are full-time employees entitled to per year?');
  console.log('State:', s3.verification?.state, '| Label:', s3.verification?.statusLabel);
  console.log('Answer:', s3.message);
  if (s3.verification?.conflictDetails) {
    console.log('Conflict Summary:', s3.verification.conflictDetails.summary);
    console.log('Claim A:', s3.verification.conflictDetails.claimA);
    console.log('Claim B:', s3.verification.conflictDetails.claimB);
  }

  console.log('\n======================================================');
  console.log('SCENARIO 4: Missing Information');
  console.log('Query: "What is the company policy on pet relocation assistance for international office transfers?"');
  const s4 = await ask('What is the company policy on pet relocation assistance for international office transfers?');
  console.log('State:', s4.verification?.state, '| Label:', s4.verification?.statusLabel);
  console.log('Answer:', s4.message);
  console.log('Missing Info Note:', s4.verification?.missingInformation);
  console.log('Suggested Follow-up:', s4.verification?.suggestedFollowUp);

  console.log('\n======================================================');
  console.log('SCENARIO 5: Access Control Enforcement');
  console.log('Query as Public/Guest: "What is the approved acquisition budget for Project Titan and CloudScale AI?"');
  const s5Guest = await ask('What is the approved acquisition budget for Project Titan and CloudScale AI?');
  console.log('Guest Query Result State:', s5Guest.verification?.state);
  console.log('Guest Answer:', s5Guest.message);
  console.log('Confidential Documents Leaked to Guest:', s5Guest.verification?.sources?.some(s => s.title.includes('Executive')));

  console.log('\n✨ Live Scenario Verification Complete!');
}

runScenarioTests().catch(console.error);
