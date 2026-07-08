import { extractFromDocument } from '../services/documentExtractionService';

class MockFile {
  name: string;
  type: string;
  content: string;
  metadata: any;
  constructor(name: string, type: string, content: string, metadata?: any) {
    this.name = name;
    this.type = type;
    this.content = content;
    this.metadata = metadata;
  }
  async arrayBuffer() {
    return Buffer.from(this.content, 'utf-8');
  }
}

async function run() {
  console.log('Testing extraction override for Case 23593...');
  const docText1 = "PATIENT: Kamala Devi, Age: 62, Gender: Female. Policy Number: REL-CKD-112, Insurer: Reliance General, TPA: MDIndia. Clinical Notes: ESRD on maintenance hemodialysis.";
  const file1 = new MockFile('kamala_devi.txt', 'text/plain', docText1) as any;

  try {
    const res1 = await extractFromDocument(file1);
    console.log('Case 23593 Result:', JSON.stringify(res1.insurance, null, 2));
  } catch (err: any) {
    console.error('Case 23593 failed:', err.message);
  }

  console.log('\nTesting extraction override for Case 19860...');
  const docText2 = "PATIENT: Ahmed Khan, Age: 50, Gender: Male. Policy Number: REL-CKD-990, Insurer: Reliance General, TPA: Internal. Clinical Notes: CKD Stage 5 on MHD.";
  const file2 = new MockFile('ahmed_khan.txt', 'text/plain', docText2) as any;

  try {
    const res2 = await extractFromDocument(file2);
    console.log('Case 19860 Result:', JSON.stringify(res2.insurance, null, 2));
  } catch (err: any) {
    console.error('Case 19860 failed:', err.message);
  }
}

run();
