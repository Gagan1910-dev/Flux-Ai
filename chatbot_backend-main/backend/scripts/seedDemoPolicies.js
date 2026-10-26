import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Document from '../models/Document.js';
import DocumentChunk from '../models/DocumentChunk.js';
import User from '../models/User.js';
import EmbeddingService from '../services/embeddingService.js';

const demoDocs = [
  {
    title: 'HR Leave and Benefits Policy 2024',
    originalName: 'HR_Leave_and_Benefits_Policy_2024.docx',
    filename: 'demo_hr_leave_2024.docx',
    filePath: 'uploads/demo_hr_leave_2024.docx',
    fileType: 'docx',
    fileSize: 24500,
    accessLevel: 'public', // Accessible to all users including guests and employees
    status: 'completed',
    chunks: [
      {
        chunkIndex: 0,
        content: 'Apex Global Technologies — HR Leave and Benefits Policy (Effective January 2024, Revision 4.2). 1. Annual Leave Entitlement: All permanent full-time employees are entitled to 22 days of paid annual leave per calendar year. Annual leave accrues at 1.83 days per completed month of service. Employees may carry forward up to 5 unused leave days into the next calendar year.',
        metadata: { pageNumber: 3, startChar: 0, endChar: 360 },
      },
      {
        chunkIndex: 1,
        content: '2. Parental and Maternity Benefits: Female employees are eligible for 26 weeks of fully paid maternity leave. Primary caregivers are supported with a staggered return-to-work program. In addition, secondary caregivers receive 4 weeks of paid paternity leave upon birth or adoption of a child.',
        metadata: { pageNumber: 5, startChar: 361, endChar: 650 },
      },
      {
        chunkIndex: 2,
        content: '3. Remote Work and Connectivity Stipend: Employees participating in the flexible work program receive a monthly connectivity allowance of $50 USD to offset home broadband and high-speed data expenses. Reimbursement is processed automatically on the 25th of each month through payroll.',
        metadata: { pageNumber: 8, startChar: 651, endChar: 950 },
      },
    ],
  },
  {
    title: 'Workplace Flexibility Policy 2022',
    originalName: 'Workplace_Flexibility_Policy_2022.docx',
    filename: 'demo_workplace_flex_2022.docx',
    filePath: 'uploads/demo_workplace_flex_2022.docx',
    fileType: 'docx',
    fileSize: 18200,
    accessLevel: 'public', // Accessible to all users
    status: 'completed',
    chunks: [
      {
        chunkIndex: 0,
        content: 'Apex Global Technologies — Workplace Flexibility and Attendance Policy (Published March 2022, Version 2.0). 1. Office Attendance Hours: Standard core operating office hours are 9:00 AM to 5:00 PM EST, Monday through Friday. All team members are expected to be available for synchronous communication during core office hours.',
        metadata: { pageNumber: 2, startChar: 0, endChar: 320 },
      },
      {
        chunkIndex: 1,
        content: '2. Paid Leave Allowance: All regular full-time staff receive 15 days of paid annual leave per year. Unused leave expires at the end of the calendar year and cannot be carried over under any circumstances.',
        metadata: { pageNumber: 4, startChar: 321, endChar: 530 },
      },
      {
        chunkIndex: 2,
        content: '3. Remote Work Frequency: Team members may request remote work for up to a maximum of 1 day per week subject to direct managerial pre-approval.',
        metadata: { pageNumber: 6, startChar: 531, endChar: 690 },
      },
    ],
  },
  {
    title: 'Executive Compensation and Acquisition Strategy',
    originalName: 'Executive_Compensation_and_Acquisition_Strategy.docx',
    filename: 'demo_exec_compensation.docx',
    filePath: 'uploads/demo_exec_compensation.docx',
    fileType: 'docx',
    fileSize: 31000,
    accessLevel: 'manager', // RESTRICTED: accessible ONLY to managers and admins
    status: 'completed',
    chunks: [
      {
        chunkIndex: 0,
        content: 'Confidential Corporate Strategy — Project Titan Acquisition Blueprint (Strictly Confidential - Restricted to Executive Management & Board of Directors). Apex Global Technologies has allocated an approved acquisition war chest of $12,000,000 USD for the strategic acquisition of CloudScale AI scheduled for closure in Q3 2025.',
        metadata: { pageNumber: 1, startChar: 0, endChar: 330 },
      },
      {
        chunkIndex: 1,
        content: 'Executive Discretionary Retention Pool: Key engineering leads and executives in the target organization will be eligible for a retention bonus pool equal to 25% of annual base compensation, vesting quarterly over a 24-month horizon post-acquisition.',
        metadata: { pageNumber: 3, startChar: 331, endChar: 580 },
      },
    ],
  },
];

async function seed() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB Atlas');

  const adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    console.error('❌ Admin user not found. Run seedAdmin.js first.');
    process.exit(1);
  }

  console.log('📦 Pre-warming Xenova embedding pipeline...');
  await EmbeddingService.getInstance();

  for (const docData of demoDocs) {
    let existingDoc = await Document.findOne({ originalName: docData.originalName });
    if (existingDoc) {
      console.log(`ℹ️ Document "${docData.title}" already exists (${existingDoc._id}). Refreshing chunks...`);
      await DocumentChunk.deleteMany({ documentId: existingDoc._id });
    } else {
      existingDoc = new Document({
        title: docData.title,
        originalName: docData.originalName,
        filename: docData.filename,
        filePath: docData.filePath,
        fileType: docData.fileType,
        fileSize: docData.fileSize,
        accessLevel: docData.accessLevel,
        uploadedBy: adminUser._id,
        status: docData.status,
        chunkCount: docData.chunks.length,
        isDemo: true,
      });
      await existingDoc.save();
      console.log(`✅ Created Document: "${docData.title}" [Access: ${docData.accessLevel}]`);
    }

    // Generate embeddings for each chunk and persist
    for (const chunkData of docData.chunks) {
      console.log(`   ⚡ Generating embedding for Chunk ${chunkData.chunkIndex}...`);
      const embedding = await EmbeddingService.generateEmbedding(chunkData.content);

      await DocumentChunk.create({
        documentId: existingDoc._id,
        chunkIndex: chunkData.chunkIndex,
        content: chunkData.content,
        embedding: embedding,
        metadata: chunkData.metadata,
      });
    }

    existingDoc.chunkCount = docData.chunks.length;
    existingDoc.isDemo = true;
    existingDoc.status = 'completed';
    await existingDoc.save();
    console.log(`   🎉 Persisted ${docData.chunks.length} chunks with embeddings for "${docData.title}".`);
  }

  console.log('\n✨ Demo policy documents seeded successfully for Flux Verify demonstration!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
