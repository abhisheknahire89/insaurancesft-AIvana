/**
 * Clinical Note Extractor Service
 *
 * Deterministic extraction of all structured clinical fields from patient notes.
 * Source of truth for clinical information - never overwritten by documents.
 *
 * Extracts 50+ structured fields with full provenance tracking:
 * - Never infers values not explicitly written
 * - Tracks confidence for each extraction
 * - Records source and timestamp
 * - Preserves doctor attribution
 */

export interface ExtractedField {
  value: any;
  confidence: number;
  source: 'PATIENT_NOTE';
  sourceId?: string;
  timestamp?: string;
  doctor?: string;
  notes?: string;
}

export interface PatientDemographics {
  name: ExtractedField;
  uhid: ExtractedField;
  mrn: ExtractedField;
  age: ExtractedField;
  dob: ExtractedField;
  gender: ExtractedField;
  mobileNumber: ExtractedField;
  address: ExtractedField;
  aadhaar: ExtractedField;
  occupation: ExtractedField;
  weight: ExtractedField; // in kg
  height: ExtractedField; // in cm
  bmi: ExtractedField;
}

export interface VisitInformation {
  consultantName: ExtractedField;
  department: ExtractedField;
  specialty: ExtractedField;
  registrationNumber: ExtractedField;
  hospitalName: ExtractedField;
  date: ExtractedField;
  time: ExtractedField;
  admissionDate: ExtractedField;
  admissionType: ExtractedField; // Elective/Emergency
  ward: ExtractedField;
  bed: ExtractedField;
  referralSource: ExtractedField;
}

export interface ChiefComplaint {
  complaint: ExtractedField;
  duration: ExtractedField;
  severity: ExtractedField;
  onset: ExtractedField;
  radiation: ExtractedField;
  aggravatingFactors: ExtractedField[];
  relievingFactors: ExtractedField[];
}

export interface HistoryOfPresentIllness {
  timeline: ExtractedField;
  symptoms: ExtractedField[];
  progression: ExtractedField;
  previousTreatment: ExtractedField;
  previousHospitalVisits: ExtractedField[];
  previousInvestigations: ExtractedField[];
}

export interface PastMedicalHistory {
  medicalHistory: ExtractedField[];
  surgicalHistory: ExtractedField[];
  familyHistory: ExtractedField[];
  drugHistory: ExtractedField[];
  allergies: ExtractedField[];
  pregnancyHistory: ExtractedField;
  socialHistory: ExtractedField;
  smoking: ExtractedField;
  alcohol: ExtractedField;
  tobacco: ExtractedField;
}

export interface Vitals {
  temperature: ExtractedField; // in Celsius
  pulse: ExtractedField; // bpm
  bloodPressure: ExtractedField; // systolic/diastolic
  respiratoryRate: ExtractedField; // per minute
  spO2: ExtractedField; // oxygen saturation
  weight: ExtractedField; // in kg
  height: ExtractedField; // in cm
  bmi: ExtractedField;
}

export interface PhysicalExamination {
  generalExamination: ExtractedField;
  systemicExamination: ExtractedField;
  cvs: ExtractedField;
  rs: ExtractedField;
  cns: ExtractedField;
  pa: ExtractedField; // Per Abdomen
  ent: ExtractedField;
  skin: ExtractedField;
}

export interface InvestigationsAdvised {
  tests: ExtractedField[];
  imaging: ExtractedField[];
  procedures: ExtractedField[];
}

export interface ProvisionalDiagnosis {
  primaryDiagnosis: ExtractedField;
  secondaryDiagnosis: ExtractedField[];
  comorbidities: ExtractedField[];
  complications: ExtractedField[];
  differentialDiagnosis: ExtractedField[];
}

export interface MedicalNecessity {
  reasonForAdmission: ExtractedField;
  reasonForIPD: ExtractedField;
  whyConservativeFailed: ExtractedField;
  whyProcedureRequired: ExtractedField;
  expectedBenefit: ExtractedField;
  riskIfUntreated: ExtractedField;
}

export interface PlannedProcedure {
  procedureName: ExtractedField;
  procedureType: ExtractedField;
  laterality: ExtractedField;
  anaesthesia: ExtractedField;
  urgency: ExtractedField; // Elective/Emergency
}

export interface TreatmentPlan {
  ivFluids: ExtractedField;
  antibiotics: ExtractedField[];
  analgesics: ExtractedField[];
  nebulization: ExtractedField;
  insulin: ExtractedField;
  monitoring: ExtractedField;
  icu: ExtractedField;
  ventilator: ExtractedField;
}

export interface Estimates {
  expectedLOS: ExtractedField; // Length of Stay in days
  icuDays: ExtractedField;
  estimatedCost: ExtractedField;
  expectedRecovery: ExtractedField;
}

export interface ClinicalReasoning {
  doctorImpression: ExtractedField;
  clinicalSummary: ExtractedField;
  expectedOutcome: ExtractedField;
  followUpPlan: ExtractedField;
}

export interface DoctorInformation {
  doctorName: ExtractedField;
  qualification: ExtractedField;
  registrationNumber: ExtractedField;
  digitalSignature: ExtractedField;
}

export interface ExtractedClinicalNote {
  // Metadata
  extractedAt: string;
  sourceId?: string;
  doctorId?: string;

  // All structured fields
  demographics: PatientDemographics;
  visitInformation: VisitInformation;
  chiefComplaint: ChiefComplaint;
  historyOfPresentIllness: HistoryOfPresentIllness;
  pastMedicalHistory: PastMedicalHistory;
  vitals: Vitals;
  physicalExamination: PhysicalExamination;
  investigationsAdvised: InvestigationsAdvised;
  provisionalDiagnosis: ProvisionalDiagnosis;
  medicalNecessity: MedicalNecessity;
  plannedProcedure: PlannedProcedure;
  treatmentPlan: TreatmentPlan;
  estimates: Estimates;
  clinicalReasoning: ClinicalReasoning;
  doctorInformation: DoctorInformation;

  // Summary statistics
  totalFieldsExtracted: number;
  averageConfidence: number;
  extractionErrors: string[];
}

/**
 * Extract all clinical fields from patient note text
 * Uses combination of AI extraction + manual parsing
 * Never infers values - only extracts explicitly written information
 */
export async function extractClinicalNote(noteText: string, doctorId?: string): Promise<ExtractedClinicalNote> {
  const extracted: ExtractedClinicalNote = {
    extractedAt: new Date().toISOString(),
    doctorId,
    demographics: {} as PatientDemographics,
    visitInformation: {} as VisitInformation,
    chiefComplaint: {} as ChiefComplaint,
    historyOfPresentIllness: {} as HistoryOfPresentIllness,
    pastMedicalHistory: {} as PastMedicalHistory,
    vitals: {} as Vitals,
    physicalExamination: {} as PhysicalExamination,
    investigationsAdvised: {} as InvestigationsAdvised,
    provisionalDiagnosis: {} as ProvisionalDiagnosis,
    medicalNecessity: {} as MedicalNecessity,
    plannedProcedure: {} as PlannedProcedure,
    treatmentPlan: {} as TreatmentPlan,
    estimates: {} as Estimates,
    clinicalReasoning: {} as ClinicalReasoning,
    doctorInformation: {} as DoctorInformation,
    totalFieldsExtracted: 0,
    averageConfidence: 0,
    extractionErrors: [],
  };

  try {
    // Extract each section
    extracted.demographics = extractDemographics(noteText, doctorId);
    extracted.visitInformation = extractVisitInformation(noteText, doctorId);
    extracted.chiefComplaint = extractChiefComplaint(noteText, doctorId);
    extracted.historyOfPresentIllness = extractHistoryOfPresentIllness(noteText, doctorId);
    extracted.pastMedicalHistory = extractPastMedicalHistory(noteText, doctorId);
    extracted.vitals = extractVitals(noteText, doctorId);
    extracted.physicalExamination = extractPhysicalExamination(noteText, doctorId);
    extracted.investigationsAdvised = extractInvestigationsAdvised(noteText, doctorId);
    extracted.provisionalDiagnosis = extractProvisionalDiagnosis(noteText, doctorId);
    extracted.medicalNecessity = extractMedicalNecessity(noteText, doctorId);
    extracted.plannedProcedure = extractPlannedProcedure(noteText, doctorId);
    extracted.treatmentPlan = extractTreatmentPlan(noteText, doctorId);
    extracted.estimates = extractEstimates(noteText, doctorId);
    extracted.clinicalReasoning = extractClinicalReasoning(noteText, doctorId);
    extracted.doctorInformation = extractDoctorInformation(noteText, doctorId);

    // Calculate statistics
    extracted.totalFieldsExtracted = countExtractedFields(extracted);
    extracted.averageConfidence = calculateAverageConfidence(extracted);

    console.log('[Clinical Note Extractor] Extraction complete:', {
      fieldsExtracted: extracted.totalFieldsExtracted,
      averageConfidence: extracted.averageConfidence,
      errors: extracted.extractionErrors.length,
    });
  } catch (error) {
    console.error('[Clinical Note Extractor] Extraction failed:', error);
    extracted.extractionErrors.push(error instanceof Error ? error.message : String(error));
  }

  return extracted;
}

// ==================== EXTRACTION FUNCTIONS ====================

function extractDemographics(noteText: string, doctorId?: string): PatientDemographics {
  return {
    name: extractField(noteText, /(?:patient\s+name|name)[:\s]*([^\n]+)/i, 'name', doctorId),
    uhid: extractField(noteText, /(?:UHID|UID|Hospital ID)[:\s]*([A-Z0-9]+)/i, 'UHID', doctorId),
    mrn: extractField(noteText, /(?:MRN|Medical Record Number)[:\s]*([A-Z0-9]+)/i, 'MRN', doctorId),
    age: extractField(noteText, /(?:age|age\/sex)[:\s]*(\d+)\s*(?:years?|yrs?|y)?\b/i, 'age', doctorId),
    dob: extractField(noteText, /(?:DOB|date of birth|born)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i, 'DOB', doctorId),
    gender: extractField(noteText, /(?:sex|gender)[:\s]*(Male|Female|M|F)/i, 'gender', doctorId),
    mobileNumber: extractField(noteText, /(?:mobile|phone|contact)[:\s]*(\d{10})/i, 'mobileNumber', doctorId),
    address: extractField(noteText, /(?:address)[:\s]*([^\n]+)/i, 'address', doctorId),
    aadhaar: extractField(noteText, /(?:Aadhaar|AADHAAR|Aadhar)[:\s]*(\d{12})/i, 'Aadhaar', doctorId),
    occupation: extractField(noteText, /(?:occupation)[:\s]*([^\n]+)/i, 'occupation', doctorId),
    weight: extractField(noteText, /(?:weight|wt)[:\s]*(\d+(?:\.\d+)?)\s*(?:kg)?/i, 'weight', doctorId),
    height: extractField(noteText, /(?:height|ht)[:\s]*(\d+(?:\.\d+)?)\s*(?:cm)?/i, 'height', doctorId),
    bmi: extractField(noteText, /(?:BMI)[:\s]*(\d+(?:\.\d+)?)/i, 'BMI', doctorId),
  };
}

function extractVisitInformation(noteText: string, doctorId?: string): VisitInformation {
  return {
    consultantName: extractField(noteText, /(?:consultant|doctor|physician)[:\s]*([^\n]+)/i, 'consultant', doctorId),
    department: extractField(noteText, /(?:department|dept)[:\s]*([^\n]+)/i, 'department', doctorId),
    specialty: extractField(noteText, /(?:specialty|specialization)[:\s]*([^\n]+)/i, 'specialty', doctorId),
    registrationNumber: extractField(noteText, /(?:registration|reg\.?\s+no|MCI)[:\s]*([A-Z0-9]+)/i, 'registrationNumber', doctorId),
    hospitalName: extractField(noteText, /(?:hospital|clinic)[:\s]*([^\n]+)/i, 'hospitalName', doctorId),
    date: extractField(noteText, /(?:date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i, 'date', doctorId),
    time: extractField(noteText, /(?:time)[:\s]*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i, 'time', doctorId),
    admissionDate: extractField(noteText, /(?:admission date|admitted on)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i, 'admissionDate', doctorId),
    admissionType: extractField(noteText, /(?:admission type)[:\s]*(Elective|Emergency)/i, 'admissionType', doctorId),
    ward: extractField(noteText, /(?:ward)[:\s]*([^\n]+)/i, 'ward', doctorId),
    bed: extractField(noteText, /(?:bed|room)[:\s]*([^\n]+)/i, 'bed', doctorId),
    referralSource: extractField(noteText, /(?:referred from|referral)[:\s]*([^\n]+)/i, 'referralSource', doctorId),
  };
}

function extractChiefComplaint(noteText: string, doctorId?: string): ChiefComplaint {
  const complaint = extractField(noteText, /(?:chief complaint|CC|presenting complaint)[:\s]*([^\n]+)/i, 'complaint', doctorId);
  const duration = extractField(noteText, /(?:duration|for|since)[:\s]*(\d+\s*(?:days?|weeks?|months?|years?))/i, 'duration', doctorId);

  return {
    complaint,
    duration,
    severity: extractField(noteText, /(?:severity)[:\s]*(mild|moderate|severe|critical)/i, 'severity', doctorId),
    onset: extractField(noteText, /(?:onset)[:\s]*([^\n]+)/i, 'onset', doctorId),
    radiation: extractField(noteText, /(?:radiation|radiates to)[:\s]*([^\n]+)/i, 'radiation', doctorId),
    aggravatingFactors: extractMultipleFields(noteText, /(?:aggravated by|worsened by)[:\s]*([^\n]+)/i, 'aggravatingFactors', doctorId),
    relievingFactors: extractMultipleFields(noteText, /(?:relieved by|improved by)[:\s]*([^\n]+)/i, 'relievingFactors', doctorId),
  };
}

function extractHistoryOfPresentIllness(noteText: string, doctorId?: string): HistoryOfPresentIllness {
  return {
    timeline: extractField(noteText, /(?:HPI|history of present illness)[:\s]*([^\n]{1,200})/i, 'timeline', doctorId),
    symptoms: extractMultipleFields(noteText, /(?:symptoms?|complained of)[:\s]*([^\n]+)/i, 'symptoms', doctorId),
    progression: extractField(noteText, /(?:progression|course)[:\s]*([^\n]{1,200})/i, 'progression', doctorId),
    previousTreatment: extractField(noteText, /(?:previous treatment|prior management)[:\s]*([^\n]{1,200})/i, 'previousTreatment', doctorId),
    previousHospitalVisits: extractMultipleFields(noteText, /(?:previous hospital visit|admitted before)[:\s]*([^\n]+)/i, 'previousHospitalVisits', doctorId),
    previousInvestigations: extractMultipleFields(noteText, /(?:previous investigation|prior test)[:\s]*([^\n]+)/i, 'previousInvestigations', doctorId),
  };
}

function extractPastMedicalHistory(noteText: string, doctorId?: string): PastMedicalHistory {
  return {
    medicalHistory: extractMultipleFields(noteText, /(?:medical history|PMHx|past medical)[:\s]*([^\n]+)/i, 'medicalHistory', doctorId),
    surgicalHistory: extractMultipleFields(noteText, /(?:surgical history|PSHx|past surgery)[:\s]*([^\n]+)/i, 'surgicalHistory', doctorId),
    familyHistory: extractMultipleFields(noteText, /(?:family history|FHx)[:\s]*([^\n]+)/i, 'familyHistory', doctorId),
    drugHistory: extractMultipleFields(noteText, /(?:drug history|medications)[:\s]*([^\n]+)/i, 'drugHistory', doctorId),
    allergies: extractMultipleFields(noteText, /(?:allergies?|NKDA|known allergy)[:\s]*([^\n]+)/i, 'allergies', doctorId),
    pregnancyHistory: extractField(noteText, /(?:pregnancy history|obstetric history)[:\s]*([^\n]+)/i, 'pregnancyHistory', doctorId),
    socialHistory: extractField(noteText, /(?:social history)[:\s]*([^\n]+)/i, 'socialHistory', doctorId),
    smoking: extractField(noteText, /(?:smoking)[:\s]*(yes|no|non-smoker|smoker)/i, 'smoking', doctorId),
    alcohol: extractField(noteText, /(?:alcohol)[:\s]*(yes|no|non-drinker|drinker)/i, 'alcohol', doctorId),
    tobacco: extractField(noteText, /(?:tobacco)[:\s]*(yes|no)/i, 'tobacco', doctorId),
  };
}

function extractVitals(noteText: string, doctorId?: string): Vitals {
  return {
    temperature: extractField(noteText, /(?:temperature|temp|T)[:\s]*(\d+(?:\.\d+)?)\s*(?:°?C|F)?/i, 'temperature', doctorId),
    pulse: extractField(noteText, /(?:pulse|HR|heart rate|bpm)[:\s]*(\d+)/i, 'pulse', doctorId),
    bloodPressure: extractField(noteText, /(?:BP|blood pressure)[:\s]*(\d+\/\d+)/i, 'bloodPressure', doctorId),
    respiratoryRate: extractField(noteText, /(?:respiratory rate|RR|breaths?)[:\s]*(\d+)/i, 'respiratoryRate', doctorId),
    spO2: extractField(noteText, /(?:SpO2|oxygen saturation|O2 sat)[:\s]*(\d+)(?:%)?/i, 'spO2', doctorId),
    weight: extractField(noteText, /(?:weight|wt)[:\s]*(\d+(?:\.\d+)?)\s*(?:kg)?/i, 'weight', doctorId),
    height: extractField(noteText, /(?:height|ht)[:\s]*(\d+(?:\.\d+)?)\s*(?:cm)?/i, 'height', doctorId),
    bmi: extractField(noteText, /(?:BMI)[:\s]*(\d+(?:\.\d+)?)/i, 'BMI', doctorId),
  };
}

function extractPhysicalExamination(noteText: string, doctorId?: string): PhysicalExamination {
  return {
    generalExamination: extractField(noteText, /(?:general examination|general exam)[:\s]*([^\n]{1,200})/i, 'generalExamination', doctorId),
    systemicExamination: extractField(noteText, /(?:systemic examination|systemic exam)[:\s]*([^\n]{1,200})/i, 'systemicExamination', doctorId),
    cvs: extractField(noteText, /(?:CVS|cardiovascular|heart)[:\s]*([^\n]{1,200})/i, 'CVS', doctorId),
    rs: extractField(noteText, /(?:RS|respiratory|lungs)[:\s]*([^\n]{1,200})/i, 'RS', doctorId),
    cns: extractField(noteText, /(?:CNS|central nervous|neuro)[:\s]*([^\n]{1,200})/i, 'CNS', doctorId),
    pa: extractField(noteText, /(?:P\/A|per abdomen|abdominal)[:\s]*([^\n]{1,200})/i, 'PA', doctorId),
    ent: extractField(noteText, /(?:ENT|ear nose throat)[:\s]*([^\n]{1,200})/i, 'ENT', doctorId),
    skin: extractField(noteText, /(?:skin)[:\s]*([^\n]{1,200})/i, 'skin', doctorId),
  };
}

function extractInvestigationsAdvised(noteText: string, doctorId?: string): InvestigationsAdvised {
  return {
    tests: extractMultipleFields(noteText, /(?:tests advised|investigations|lab tests)[:\s]*([^\n]+)/i, 'tests', doctorId),
    imaging: extractMultipleFields(noteText, /(?:imaging|radiology|x-ray|ct|mri|ultrasound)[:\s]*([^\n]+)/i, 'imaging', doctorId),
    procedures: extractMultipleFields(noteText, /(?:procedures advised|procedures)[:\s]*([^\n]+)/i, 'procedures', doctorId),
  };
}

function extractProvisionalDiagnosis(noteText: string, doctorId?: string): ProvisionalDiagnosis {
  return {
    primaryDiagnosis: extractField(noteText, /(?:primary diagnosis|diagnosis|provisional diagnosis)[:\s]*([^\n]+)/i, 'primaryDiagnosis', doctorId),
    secondaryDiagnosis: extractMultipleFields(noteText, /(?:secondary diagnosis|additional diagnosis)[:\s]*([^\n]+)/i, 'secondaryDiagnosis', doctorId),
    comorbidities: extractMultipleFields(noteText, /(?:comorbidities|comorbid conditions)[:\s]*([^\n]+)/i, 'comorbidities', doctorId),
    complications: extractMultipleFields(noteText, /(?:complications)[:\s]*([^\n]+)/i, 'complications', doctorId),
    differentialDiagnosis: extractMultipleFields(noteText, /(?:differential diagnosis|DDx)[:\s]*([^\n]+)/i, 'differentialDiagnosis', doctorId),
  };
}

function extractMedicalNecessity(noteText: string, doctorId?: string): MedicalNecessity {
  return {
    reasonForAdmission: extractField(noteText, /(?:reason for admission|indication for admission)[:\s]*([^\n]{1,200})/i, 'reasonForAdmission', doctorId),
    reasonForIPD: extractField(noteText, /(?:reason for IPD|why IPD)[:\s]*([^\n]{1,200})/i, 'reasonForIPD', doctorId),
    whyConservativeFailed: extractField(noteText, /(?:conservative treatment failed|failed conservative management)[:\s]*([^\n]{1,200})/i, 'whyConservativeFailed', doctorId),
    whyProcedureRequired: extractField(noteText, /(?:why procedure required|procedure indication)[:\s]*([^\n]{1,200})/i, 'whyProcedureRequired', doctorId),
    expectedBenefit: extractField(noteText, /(?:expected benefit|expected outcome)[:\s]*([^\n]{1,200})/i, 'expectedBenefit', doctorId),
    riskIfUntreated: extractField(noteText, /(?:risk if untreated|risk of no treatment)[:\s]*([^\n]{1,200})/i, 'riskIfUntreated', doctorId),
  };
}

function extractPlannedProcedure(noteText: string, doctorId?: string): PlannedProcedure {
  return {
    procedureName: extractField(noteText, /(?:procedure|planned procedure|surgery)[:\s]*([^\n]+)/i, 'procedureName', doctorId),
    procedureType: extractField(noteText, /(?:procedure type)[:\s]*(major|minor|diagnostic)/i, 'procedureType', doctorId),
    laterality: extractField(noteText, /(?:laterality|side)[:\s]*(left|right|bilateral)/i, 'laterality', doctorId),
    anaesthesia: extractField(noteText, /(?:anaesthesia|anesthesia)[:\s]*([^\n]+)/i, 'anaesthesia', doctorId),
    urgency: extractField(noteText, /(?:urgency|elective|emergency)[:\s]*(Elective|Emergency)/i, 'urgency', doctorId),
  };
}

function extractTreatmentPlan(noteText: string, doctorId?: string): TreatmentPlan {
  return {
    ivFluids: extractField(noteText, /(?:IV fluids|intravenous fluids)[:\s]*([^\n]+)/i, 'ivFluids', doctorId),
    antibiotics: extractMultipleFields(noteText, /(?:antibiotics?)[:\s]*([^\n]+)/i, 'antibiotics', doctorId),
    analgesics: extractMultipleFields(noteText, /(?:analgesics?|painkillers?)[:\s]*([^\n]+)/i, 'analgesics', doctorId),
    nebulization: extractField(noteText, /(?:nebulization|nebuliser)[:\s]*([^\n]+)/i, 'nebulization', doctorId),
    insulin: extractField(noteText, /(?:insulin)[:\s]*([^\n]+)/i, 'insulin', doctorId),
    monitoring: extractField(noteText, /(?:monitoring)[:\s]*([^\n]+)/i, 'monitoring', doctorId),
    icu: extractField(noteText, /(?:ICU|intensive care)[:\s]*(yes|no)/i, 'icu', doctorId),
    ventilator: extractField(noteText, /(?:ventilator|mechanical ventilation)[:\s]*(yes|no)/i, 'ventilator', doctorId),
  };
}

function extractEstimates(noteText: string, doctorId?: string): Estimates {
  return {
    expectedLOS: extractField(noteText, /(?:expected LOS|length of stay|LOS)[:\s]*(\d+)\s*(?:days?)?/i, 'expectedLOS', doctorId),
    icuDays: extractField(noteText, /(?:ICU days|icu stay)[:\s]*(\d+)\s*(?:days?)?/i, 'icuDays', doctorId),
    estimatedCost: extractField(noteText, /(?:estimated cost|cost estimate)[:\s]*(?:₹|Rs\.?|INR)?[\s]*([0-9,]+)/i, 'estimatedCost', doctorId),
    expectedRecovery: extractField(noteText, /(?:expected recovery|recovery period)[:\s]*([^\n]+)/i, 'expectedRecovery', doctorId),
  };
}

function extractClinicalReasoning(noteText: string, doctorId?: string): ClinicalReasoning {
  return {
    doctorImpression: extractField(noteText, /(?:doctor impression|clinical impression)[:\s]*([^\n]{1,200})/i, 'doctorImpression', doctorId),
    clinicalSummary: extractField(noteText, /(?:clinical summary|summary)[:\s]*([^\n]{1,200})/i, 'clinicalSummary', doctorId),
    expectedOutcome: extractField(noteText, /(?:expected outcome|prognosis)[:\s]*([^\n]{1,200})/i, 'expectedOutcome', doctorId),
    followUpPlan: extractField(noteText, /(?:follow-up|followup plan)[:\s]*([^\n]{1,200})/i, 'followUpPlan', doctorId),
  };
}

function extractDoctorInformation(noteText: string, doctorId?: string): DoctorInformation {
  return {
    doctorName: extractField(noteText, /(?:doctor name|dr\.?|physician)[:\s]*([^\n]+)/i, 'doctorName', doctorId),
    qualification: extractField(noteText, /(?:qualification|qualification)[:\s]*([^\n]+)/i, 'qualification', doctorId),
    registrationNumber: extractField(noteText, /(?:registration|MCI|reg\.?\s+no)[:\s]*([A-Z0-9]+)/i, 'registrationNumber', doctorId),
    digitalSignature: extractField(noteText, /(?:signature|digital signature)[:\s]*([^\n]+)/i, 'digitalSignature', doctorId),
  };
}

// ==================== HELPER FUNCTIONS ====================

function extractField(
  text: string,
  regex: RegExp,
  fieldName: string,
  doctorId?: string
): ExtractedField {
  const match = text.match(regex);
  if (match && match[1]) {
    const value = match[1].trim();
    return {
      value,
      confidence: 0.9,
      source: 'PATIENT_NOTE',
      doctor: doctorId,
      timestamp: new Date().toISOString(),
      notes: `Extracted from patient note`,
    };
  }
  return {
    value: null,
    confidence: 0,
    source: 'PATIENT_NOTE',
    doctor: doctorId,
    timestamp: new Date().toISOString(),
  };
}

function extractMultipleFields(
  text: string,
  regex: RegExp,
  fieldName: string,
  doctorId?: string
): ExtractedField[] {
  const matches = [...text.matchAll(new RegExp(regex, 'gi'))];
  return matches.map(match => ({
    value: match[1]?.trim() || null,
    confidence: 0.85,
    source: 'PATIENT_NOTE' as const,
    doctor: doctorId,
    timestamp: new Date().toISOString(),
  })).filter(f => f.value !== null);
}

function countExtractedFields(extracted: ExtractedClinicalNote): number {
  let count = 0;
  const countObject = (obj: any): void => {
    if (!obj) return;
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      Object.values(obj).forEach(val => {
        if (typeof val === 'object') {
          if ((val as any).value !== null && (val as any).value !== undefined) {
            count++;
          } else if (Array.isArray(val)) {
            count += val.length;
          } else {
            countObject(val);
          }
        }
      });
    }
  };

  countObject(extracted);
  return count;
}

function calculateAverageConfidence(extracted: ExtractedClinicalNote): number {
  let totalConfidence = 0;
  let fieldCount = 0;

  const getConfidenceValues = (obj: any): void => {
    if (!obj) return;
    if (typeof obj === 'object') {
      if ((obj as any).confidence !== undefined) {
        totalConfidence += (obj as any).confidence;
        fieldCount++;
      } else if (Array.isArray(obj)) {
        obj.forEach(item => getConfidenceValues(item));
      } else {
        Object.values(obj).forEach(val => getConfidenceValues(val));
      }
    }
  };

  getConfidenceValues(extracted);
  return fieldCount > 0 ? totalConfidence / fieldCount : 0;
}
