/**
 * Radiology & Imaging Report Extractor
 *
 * Extracts structured data from diagnostic imaging reports:
 * - ECG: Heart rate, rhythm, intervals, abnormalities
 * - Echo: EF, chamber sizes, valve function, pericardial fluid
 * - MRI: Sequences, findings, location of pathology
 * - CT: Window settings, findings, measurements
 * - USG: Dimensions, echogenicity, free fluid, flow
 * - X-ray: Projections, fields, findings, measurements
 */

export type ImagingType = 'ECG' | 'ECHO' | 'MRI' | 'CT' | 'USG' | 'XRAY';

export interface Abnormality {
  description: string;
  location?: string;
  measurement?: string;
  severity: 'normal' | 'mild' | 'moderate' | 'severe' | 'critical';
  clinicalSignificance: string;
}

export interface ECGReport {
  reportType: 'ECG';
  reportDate: string | null;
  clinicalHistory: string | null;

  // Basic parameters
  heartRate: number | null;
  rhythm: string | null;
  rhythmRegularity: 'regular' | 'irregular' | null;

  // Intervals (milliseconds)
  prInterval: number | null;
  qrsInterval: number | null;
  qtInterval: number | null;
  qtcInterval: number | null;

  // Axes
  pAxis: string | null;
  qrsAxis: string | null;
  tAxis: string | null;

  // Findings
  abnormalities: Abnormality[];
  interpretation: string | null;
  clinicalImportance: 'normal' | 'abnormal' | 'critical';

  confidence: number;
}

export interface EchoReport {
  reportType: 'ECHO';
  reportDate: string | null;
  studyType: 'TTE' | 'TEE' | 'Stress Echo' | null;

  // Cardiac function
  ejectionFraction: number | null;
  ejectionFractionQuality: 'good' | 'fair' | 'poor' | null;
  cardiacOutput: number | null;

  // Chamber dimensions (mm)
  lvedDimension: number | null;
  lvesDimension: number | null;
  lvWallThickness: number | null;
  laSize: number | null;
  raSize: number | null;
  rvSize: number | null;

  // Valve function
  mitralValve: ValveAssessment | null;
  aorticValve: ValveAssessment | null;
  tricuspidValve: ValveAssessment | null;
  pulmonicValve: ValveAssessment | null;

  // Flow and pressures
  estimatedPAP: number | null;
  pericardialFluid: PericardialFluidAssessment | null;

  // Findings
  findings: Abnormality[];
  conclusion: string | null;

  confidence: number;
}

export interface ValveAssessment {
  stenosis: 'none' | 'trivial' | 'mild' | 'moderate' | 'severe' | null;
  regurgitation: 'none' | 'trivial' | 'mild' | 'moderate' | 'severe' | null;
  morphology: string | null;
}

export interface PericardialFluidAssessment {
  present: boolean;
  severity: 'none' | 'trivial' | 'small' | 'moderate' | 'large' | null;
  location: string[];
  effect: string | null;
}

export interface MRIReport {
  reportType: 'MRI';
  reportDate: string | null;
  bodyPart: string | null;
  fieldStrength: string | null; // 1.5T, 3T, etc.

  // Sequences
  sequences: {
    name: string;
    weighting: string; // T1, T2, FLAIR, etc.
    parameters?: string;
  }[];

  // Findings
  findings: Abnormality[];

  // Pathology
  primaryPathology: string | null;
  measurements: {
    location: string;
    dimension: string;
  }[];

  // Comparisons
  comparisonWithPrior: string | null;
  clinicalCorrelation: string | null;

  confidence: number;
}

export interface CTReport {
  reportType: 'CT';
  reportDate: string | null;
  bodyPart: string | null;
  protocol: string | null; // axial, helical, etc.

  // Technical parameters
  kVp: string | null;
  mA: string | null;
  pitch: string | null;
  sliceThickness: string | null;
  window: string | null; // Window/level used

  // Findings
  findings: Abnormality[];
  primaryPathology: string | null;
  measurements: {
    location: string;
    dimension: string;
  }[];

  // Comparisons
  comparisonWithPrior: string | null;
  recommendations: string[];

  confidence: number;
}

export interface USGReport {
  reportType: 'USG';
  reportDate: string | null;
  bodyPart: string | null;
  transducer: string | null;

  // Findings
  findings: Abnormality[];

  // Measurements (mm)
  measurements: {
    organ: string;
    parameter: string;
    value: number;
    unit: string;
    reference: string;
  }[];

  // Doppler findings
  dopplerFindings: string | null;
  flowCharacteristics: string | null;

  // Free fluid assessment
  freeFluid: FreeFluidAssessment | null;
  recommendations: string[];

  confidence: number;
}

export interface FreeFluidAssessment {
  present: boolean;
  location: string[];
  volume: string | null;
  characteristics: string | null;
}

export interface XRayReport {
  reportType: 'XRAY';
  reportDate: string | null;
  bodyPart: string | null;
  projections: string[]; // AP, PA, Lateral, etc.

  // Technical
  viewingConditions: string | null;

  // Findings
  findings: Abnormality[];
  primaryPathology: string | null;
  measurements: {
    location: string;
    dimension: string;
  }[];

  // Comparisons
  comparisonWithPrior: string | null;
  recommendations: string[];

  confidence: number;
}

export type ImagingReport = ECGReport | EchoReport | MRIReport | CTReport | USGReport | XRayReport;

// ==================== EXTRACTION FUNCTIONS ====================

export async function extractECGReport(reportText: string): Promise<ECGReport> {
  return {
    reportType: 'ECG',
    reportDate: extractDateFromText(reportText),
    clinicalHistory: extractField(reportText, /clinical\s+history[:\s]*([\s\S]+?)(?=\n\n|FINDINGS|findings|$)/i),

    heartRate: extractNumericField(reportText, /heart\s+rate[:\s]*(\d+)/i),
    rhythm: extractField(reportText, /rhythm[:\s]*([^\n]+)/i),
    rhythmRegularity: extractRhythmRegularity(reportText),

    prInterval: extractNumericField(reportText, /PR\s+(?:interval|int)[:\s]*(\d+)/i),
    qrsInterval: extractNumericField(reportText, /QRS\s+(?:interval|int|duration)[:\s]*(\d+)/i),
    qtInterval: extractNumericField(reportText, /QT\s+(?:interval|int)[:\s]*(\d+)/i),
    qtcInterval: extractNumericField(reportText, /QTc[:\s]*(\d+)/i),

    pAxis: extractField(reportText, /P\s+axis[:\s]*([^\n]+)/i),
    qrsAxis: extractField(reportText, /QRS\s+axis[:\s]*([^\n]+)/i),
    tAxis: extractField(reportText, /T\s+axis[:\s]*([^\n]+)/i),

    abnormalities: extractECGAbnormalities(reportText),
    interpretation: extractField(reportText, /interpretation[:\s]*([\s\S]+?)(?=\n\n|clinical|$)/i),
    clinicalImportance: extractClinicalImportance(reportText),

    confidence: 0.85,
  };
}

export async function extractEchoReport(reportText: string): Promise<EchoReport> {
  return {
    reportType: 'ECHO',
    reportDate: extractDateFromText(reportText),
    studyType: extractStudyType(reportText),

    ejectionFraction: extractNumericField(reportText, /(?:EF|ejection\s+fraction)[:\s]*(\d+)/i),
    ejectionFractionQuality: extractQualityField(reportText, /EF\s+(?:quality|assessment)[:\s]*([^\n]+)/i),
    cardiacOutput: extractNumericField(reportText, /cardiac\s+output[:\s]*(\d+(?:\.\d+)?)/i),

    lvedDimension: extractNumericField(reportText, /LVED[:\s]*(\d+(?:\.\d+)?)/i),
    lvesDimension: extractNumericField(reportText, /LVES[:\s]*(\d+(?:\.\d+)?)/i),
    lvWallThickness: extractNumericField(reportText, /LV\s+wall\s+thickness[:\s]*(\d+(?:\.\d+)?)/i),
    laSize: extractNumericField(reportText, /LA\s+size[:\s]*(\d+(?:\.\d+)?)/i),
    raSize: extractNumericField(reportText, /RA\s+size[:\s]*(\d+(?:\.\d+)?)/i),
    rvSize: extractNumericField(reportText, /RV\s+size[:\s]*(\d+(?:\.\d+)?)/i),

    mitralValve: extractValveAssessment(reportText, /mitral/i),
    aorticValve: extractValveAssessment(reportText, /aortic/i),
    tricuspidValve: extractValveAssessment(reportText, /tricuspid/i),
    pulmonicValve: extractValveAssessment(reportText, /pulmonic/i),

    estimatedPAP: extractNumericField(reportText, /estimated\s+PAP[:\s]*(\d+)/i),
    pericardialFluid: extractPericardialFluid(reportText),

    findings: extractEchoAbnormalities(reportText),
    conclusion: extractField(reportText, /conclusion[:\s]*([\s\S]+?)(?=\n\n|recommendations|$)/i),

    confidence: 0.85,
  };
}

export async function extractMRIReport(reportText: string): Promise<MRIReport> {
  return {
    reportType: 'MRI',
    reportDate: extractDateFromText(reportText),
    bodyPart: extractField(reportText, /(?:body part|region|area)[:\s]*([^\n]+)/i),
    fieldStrength: extractField(reportText, /(?:field|strength)[:\s]*(\d+\.?\d*T)/i),

    sequences: extractMRISequences(reportText),
    findings: extractMRIAbnormalities(reportText),

    primaryPathology: extractField(reportText, /(?:primary|main|significant)\s+(?:finding|pathology)[:\s]*([\s\S]+?)(?=\n\n|$)/i),
    measurements: extractMeasurements(reportText),

    comparisonWithPrior: extractField(reportText, /comparison\s+with\s+prior[:\s]*([\s\S]+?)(?=\n\n|$)/i),
    clinicalCorrelation: extractField(reportText, /clinical\s+correlation[:\s]*([\s\S]+?)(?=\n\n|$)/i),

    confidence: 0.85,
  };
}

export async function extractCTReport(reportText: string): Promise<CTReport> {
  return {
    reportType: 'CT',
    reportDate: extractDateFromText(reportText),
    bodyPart: extractField(reportText, /(?:body part|region|area)[:\s]*([^\n]+)/i),
    protocol: extractField(reportText, /protocol[:\s]*([^\n]+)/i),

    kVp: extractField(reportText, /kVp[:\s]*(\d+)/i),
    mA: extractField(reportText, /mA[:\s]*(\d+)/i),
    pitch: extractField(reportText, /pitch[:\s]*([0-9.]+)/i),
    sliceThickness: extractField(reportText, /slice\s+thickness[:\s]*([0-9.]+\s*mm)/i),
    window: extractField(reportText, /window[:\s]*([^\n]+)/i),

    findings: extractCTAbnormalities(reportText),
    primaryPathology: extractField(reportText, /(?:primary|main|significant)\s+(?:finding|pathology)[:\s]*([\s\S]+?)(?=\n\n|$)/i),
    measurements: extractMeasurements(reportText),

    comparisonWithPrior: extractField(reportText, /comparison\s+with\s+prior[:\s]*([\s\S]+?)(?=\n\n|$)/i),
    recommendations: extractRecommendations(reportText),

    confidence: 0.85,
  };
}

export async function extractUSGReport(reportText: string): Promise<USGReport> {
  return {
    reportType: 'USG',
    reportDate: extractDateFromText(reportText),
    bodyPart: extractField(reportText, /(?:body part|region|area)[:\s]*([^\n]+)/i),
    transducer: extractField(reportText, /transducer[:\s]*([^\n]+)/i),

    findings: extractUSGAbnormalities(reportText),
    measurements: extractUSGMeasurements(reportText),

    dopplerFindings: extractField(reportText, /doppler[:\s]*([\s\S]+?)(?=\n\n|free\s+fluid|$)/i),
    flowCharacteristics: extractField(reportText, /flow\s+characteristics[:\s]*([\s\S]+?)(?=\n\n|$)/i),

    freeFluid: extractFreeFluid(reportText),
    recommendations: extractRecommendations(reportText),

    confidence: 0.85,
  };
}

export async function extractXRayReport(reportText: string): Promise<XRayReport> {
  return {
    reportType: 'XRAY',
    reportDate: extractDateFromText(reportText),
    bodyPart: extractField(reportText, /(?:body part|region|area)[:\s]*([^\n]+)/i),
    projections: extractProjections(reportText),

    viewingConditions: extractField(reportText, /viewing\s+conditions[:\s]*([^\n]+)/i),

    findings: extractXRayAbnormalities(reportText),
    primaryPathology: extractField(reportText, /(?:primary|main|significant)\s+(?:finding|pathology)[:\s]*([\s\S]+?)(?=\n\n|$)/i),
    measurements: extractMeasurements(reportText),

    comparisonWithPrior: extractField(reportText, /comparison\s+with\s+prior[:\s]*([\s\S]+?)(?=\n\n|$)/i),
    recommendations: extractRecommendations(reportText),

    confidence: 0.85,
  };
}

// ==================== HELPER EXTRACTION FUNCTIONS ====================

function extractDateFromText(text: string): string | null {
  const datePatterns = [
    /(?:date|Date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extractField(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1]?.trim().replace(/\s+/g, ' ') : null;
}

function extractNumericField(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (match) {
    const num = parseFloat(match[1]);
    return isNaN(num) ? null : num;
  }
  return null;
}

function extractRhythmRegularity(text: string): 'regular' | 'irregular' | null {
  if (text.match(/regular/i)) return 'regular';
  if (text.match(/irregular/i)) return 'irregular';
  return null;
}

function extractClinicalImportance(text: string): 'normal' | 'abnormal' | 'critical' {
  if (text.match(/critical|emergent|urgent/i)) return 'critical';
  if (text.match(/abnormal|abnormality/i)) return 'abnormal';
  return 'normal';
}

function extractStudyType(text: string): 'TTE' | 'TEE' | 'Stress Echo' | null {
  if (text.match(/TTE|transthoracic/i)) return 'TTE';
  if (text.match(/TEE|transesophageal/i)) return 'TEE';
  if (text.match(/stress|dobutamine/i)) return 'Stress Echo';
  return null;
}

function extractQualityField(text: string, pattern: RegExp): 'good' | 'fair' | 'poor' | null {
  const match = text.match(pattern);
  if (match) {
    const value = match[1].toLowerCase();
    if (value.includes('good')) return 'good';
    if (value.includes('fair')) return 'fair';
    if (value.includes('poor')) return 'poor';
  }
  return null;
}

function extractValveAssessment(text: string, pattern: RegExp): ValveAssessment | null {
  const match = text.match(new RegExp(`${pattern.source}[^]*?(?=\\w+\\s+valve|\\n\\n|$)`, 'i'));
  if (!match) return null;

  const section = match[0];
  return {
    stenosis: extractSeverity(section, /stenosis/i),
    regurgitation: extractSeverity(section, /regurgitation|insufficiency/i),
    morphology: extractField(section, /morphology[:\s]*([^\n]+)/i),
  };
}

function extractSeverity(text: string, pattern: RegExp): 'none' | 'trivial' | 'mild' | 'moderate' | 'severe' | null {
  const match = text.match(pattern);
  if (match) {
    const context = text.substring(Math.max(0, match.index! - 50), Math.min(text.length, match.index! + 100)).toLowerCase();
    if (context.includes('severe')) return 'severe';
    if (context.includes('moderate')) return 'moderate';
    if (context.includes('mild')) return 'mild';
    if (context.includes('trivial')) return 'trivial';
    if (context.includes('none')) return 'none';
  }
  return null;
}

function extractPericardialFluid(text: string): PericardialFluidAssessment | null {
  const match = text.match(/pericardial\s+fluid[:\s]*([\s\S]+?)(?=\n\n|findings|$)/i);
  if (!match) return null;

  const section = match[1];
  return {
    present: !section.match(/no\s+pericardial\s+fluid|pericardial\s+fluid\s+absent/i),
    severity: extractSeverity(section, /pericardial/i),
    location: extractLocations(section),
    effect: extractField(section, /effect[:\s]*([^\n]+)/i),
  };
}

function extractMRISequences(text: string): Array<{ name: string; weighting: string; parameters?: string }> {
  const sequences: Array<{ name: string; weighting: string; parameters?: string }> = [];
  const weightings = ['T1', 'T2', 'FLAIR', 'DWI', 'ADC', 'T1C', 'STIR'];

  for (const weighting of weightings) {
    const pattern = new RegExp(`${weighting}[^]*?(?=\\n|${weightings.join('|')}|findings)`, 'gi');
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      sequences.push({
        name: `${weighting} Sequence`,
        weighting,
        parameters: match[0].substring(0, 100),
      });
    }
  }

  return sequences;
}

function extractMeasurements(text: string): Array<{ location: string; dimension: string }> {
  const measurements: Array<{ location: string; dimension: string }> = [];
  const pattern = /([a-zA-Z\s]+)[:\s]*(\d+(?:\.\d+)?\s*(?:mm|cm|x\s*\d+(?:\.\d+)?(?:\s*x\s*\d+(?:\.\d+)?)?)?)/gi;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    measurements.push({
      location: match[1].trim(),
      dimension: match[2].trim(),
    });
  }

  return measurements;
}

function extractProjections(text: string): string[] {
  const projections = new Set<string>();
  const names = ['AP', 'PA', 'Lateral', 'Oblique', 'Axial', 'Coronal', 'Sagittal'];

  for (const name of names) {
    if (text.match(new RegExp(name, 'i'))) {
      projections.add(name);
    }
  }

  return Array.from(projections);
}

function extractLocations(text: string): string[] {
  const locations = new Set<string>();
  const terms = ['apex', 'base', 'anterior', 'posterior', 'lateral', 'medial', 'free wall', 'septum'];

  for (const term of terms) {
    if (text.match(new RegExp(term, 'i'))) {
      locations.add(term);
    }
  }

  return Array.from(locations);
}

function extractRecommendations(text: string): string[] {
  const match = text.match(/recommendations?[:\s]*([\s\S]+?)(?=\n\n|$)/i);
  if (!match) return [];

  return match[1]
    .split(/\n|[•·]/)
    .map(r => r.trim())
    .filter(r => r.length > 0)
    .slice(0, 5);
}

function extractUSGMeasurements(text: string): Array<{ organ: string; parameter: string; value: number; unit: string; reference: string }> {
  const measurements: Array<{ organ: string; parameter: string; value: number; unit: string; reference: string }> = [];
  const pattern = /([a-zA-Z\s]+)[:\s]*(\d+(?:\.\d+)?)\s*(mm|cm)\s*(?:\(ref[:\s]*([^\)]+)\))?/gi;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    measurements.push({
      organ: match[1].trim(),
      parameter: match[1].trim(),
      value: parseFloat(match[2]),
      unit: match[3],
      reference: match[4] || '',
    });
  }

  return measurements;
}

function extractFreeFluid(text: string): FreeFluidAssessment | null {
  const match = text.match(/free\s+fluid[:\s]*([\s\S]+?)(?=\n\n|doppler|$)/i);
  if (!match) return null;

  const section = match[1];
  return {
    present: !section.match(/no\s+free\s+fluid|free\s+fluid\s+absent/i),
    location: extractLocations(section),
    volume: extractField(section, /volume[:\s]*([^\n]+)/i),
    characteristics: extractField(section, /characteristics[:\s]*([^\n]+)/i),
  };
}

// Abnormality extraction functions
function extractECGAbnormalities(text: string): Abnormality[] {
  const abnormalities: Abnormality[] = [];
  const findings = text.match(/findings?[:\s]*([\s\S]+?)(?=interpretation|$)/i);
  if (!findings) return abnormalities;

  const pattern = /(?:•|[-–])\s*([^\n]+)/g;
  let match;
  while ((match = pattern.exec(findings[1])) !== null) {
    abnormalities.push({
      description: match[1],
      severity: extractSeverityFromText(match[1]),
      clinicalSignificance: 'Cardiac abnormality',
    });
  }

  return abnormalities;
}

function extractEchoAbnormalities(text: string): Abnormality[] {
  const abnormalities: Abnormality[] = [];
  const findings = text.match(/findings?[:\s]*([\s\S]+?)(?=conclusion|$)/i);
  if (!findings) return abnormalities;

  const pattern = /(?:•|[-–])\s*([^\n]+)/g;
  let match;
  while ((match = pattern.exec(findings[1])) !== null) {
    abnormalities.push({
      description: match[1],
      severity: extractSeverityFromText(match[1]),
      clinicalSignificance: 'Cardiac abnormality',
    });
  }

  return abnormalities;
}

function extractMRIAbnormalities(text: string): Abnormality[] {
  const abnormalities: Abnormality[] = [];
  const findings = text.match(/findings?[:\s]*([\s\S]+?)(?=comparison|conclusion|$)/i);
  if (!findings) return abnormalities;

  const pattern = /(?:•|[-–]|[0-9]+\.)\s*([^\n]+)/g;
  let match;
  while ((match = pattern.exec(findings[1])) !== null) {
    abnormalities.push({
      description: match[1],
      location: extractLocationFromText(match[1]),
      severity: extractSeverityFromText(match[1]),
      clinicalSignificance: 'MRI finding',
    });
  }

  return abnormalities;
}

function extractCTAbnormalities(text: string): Abnormality[] {
  const abnormalities: Abnormality[] = [];
  const findings = text.match(/findings?[:\s]*([\s\S]+?)(?=comparison|impression|$)/i);
  if (!findings) return abnormalities;

  const pattern = /(?:•|[-–]|[0-9]+\.)\s*([^\n]+)/g;
  let match;
  while ((match = pattern.exec(findings[1])) !== null) {
    abnormalities.push({
      description: match[1],
      location: extractLocationFromText(match[1]),
      measurement: extractMeasurementFromText(match[1]),
      severity: extractSeverityFromText(match[1]),
      clinicalSignificance: 'CT finding',
    });
  }

  return abnormalities;
}

function extractUSGAbnormalities(text: string): Abnormality[] {
  const abnormalities: Abnormality[] = [];
  const findings = text.match(/findings?[:\s]*([\s\S]+?)(?=recommendations|impression|$)/i);
  if (!findings) return abnormalities;

  const pattern = /(?:•|[-–]|[0-9]+\.)\s*([^\n]+)/g;
  let match;
  while ((match = pattern.exec(findings[1])) !== null) {
    abnormalities.push({
      description: match[1],
      location: extractLocationFromText(match[1]),
      severity: extractSeverityFromText(match[1]),
      clinicalSignificance: 'USG finding',
    });
  }

  return abnormalities;
}

function extractXRayAbnormalities(text: string): Abnormality[] {
  const abnormalities: Abnormality[] = [];
  const findings = text.match(/findings?[:\s]*([\s\S]+?)(?=comparison|impression|$)/i);
  if (!findings) return abnormalities;

  const pattern = /(?:•|[-–]|[0-9]+\.)\s*([^\n]+)/g;
  let match;
  while ((match = pattern.exec(findings[1])) !== null) {
    abnormalities.push({
      description: match[1],
      location: extractLocationFromText(match[1]),
      severity: extractSeverityFromText(match[1]),
      clinicalSignificance: 'X-ray finding',
    });
  }

  return abnormalities;
}

function extractSeverityFromText(text: string): 'normal' | 'mild' | 'moderate' | 'severe' | 'critical' {
  const lower = text.toLowerCase();
  if (lower.includes('critical') || lower.includes('emergent')) return 'critical';
  if (lower.includes('severe')) return 'severe';
  if (lower.includes('moderate')) return 'moderate';
  if (lower.includes('mild') || lower.includes('minimal')) return 'mild';
  return 'normal';
}

function extractLocationFromText(text: string): string | undefined {
  const locations = ['apex', 'base', 'anterior', 'posterior', 'lateral', 'medial', 'left', 'right', 'upper', 'lower'];
  for (const loc of locations) {
    if (text.toLowerCase().includes(loc)) return loc;
  }
  return undefined;
}

function extractMeasurementFromText(text: string): string | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:mm|cm|x)/);
  return match ? match[1] + 'mm' : undefined;
}
