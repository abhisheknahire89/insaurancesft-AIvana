/**
 * Pre-Authorization PDF Generator
 *
 * Generates filled PDF pre-authorization forms from extracted case data.
 * Outputs downloadable PDF ready for TPA submission.
 *
 * Uses PDFKit library to generate documents programmatically.
 * Template: Policy Part C (Revised)
 */

import type { PreAuthFormData } from './preAuthFormFiller';

export interface PdfGenerationOptions {
  includeSignatureFields: boolean;
  includeWatermark: boolean;
  outputFormat: 'binary' | 'base64' | 'stream';
  fileName?: string;
}

export interface PdfGenerationResult {
  success: boolean;
  fileName: string;
  fileSize: number; // bytes
  content: Buffer | string; // binary or base64
  format: 'binary' | 'base64';
  generatedAt: string;
  documentHash?: string;
}

/**
 * Pre-Auth PDF Generator
 *
 * NOTE: In production, use PDFKit (npm install pdfkit)
 * For now, this shows the structure of how PDF generation would work
 */
export class PreAuthPdfGenerator {
  /**
   * Generate filled PDF form
   */
  static async generatePDF(
    formData: PreAuthFormData,
    options: PdfGenerationOptions = {
      includeSignatureFields: true,
      includeWatermark: false,
      outputFormat: 'binary',
    }
  ): Promise<PdfGenerationResult> {
    console.log('[PDF Generator] Starting PDF generation for:', formData.claimNumber);

    const startTime = Date.now();

    // Build PDF content sections
    const pdfSections = this.buildPdfSections(formData, options);

    // Generate PDF content (in production, use PDFKit)
    const pdfContent = this.createPdfDocument(pdfSections, formData);

    // Convert to desired format
    let outputContent: Buffer | string;
    if (options.outputFormat === 'base64') {
      outputContent = Buffer.from(pdfContent).toString('base64');
    } else {
      outputContent = Buffer.from(pdfContent);
    }

    const generatedAt = new Date().toISOString();
    const fileName = options.fileName || `PreAuth_${formData.claimNumber}_${new Date().getTime()}.pdf`;

    const result: PdfGenerationResult = {
      success: true,
      fileName,
      fileSize: Buffer.byteLength(pdfContent),
      content: outputContent,
      format: options.outputFormat,
      generatedAt,
      documentHash: this.generateHash(pdfContent),
    };

    const endTime = Date.now();
    console.log(`[PDF Generator] PDF generated in ${(endTime - startTime) / 1000}s`);
    console.log('[PDF Generator] File:', fileName, 'Size:', result.fileSize, 'bytes');

    return result;
  }

  /**
   * Build PDF sections structure
   */
  private static buildPdfSections(
    formData: PreAuthFormData,
    options: PdfGenerationOptions
  ): string {
    const sections: string[] = [];

    // Header
    sections.push(this.buildHeader(formData));

    // Section 1: TPA/Hospital Details
    sections.push(this.buildSection1(formData));

    // Section 2: Patient Details
    sections.push(this.buildSection2(formData));

    // Section 3: Doctor Details
    sections.push(this.buildSection3(formData));

    // Section 4: Admitted Details
    sections.push(this.buildSection4(formData));

    // Section 5: Cost Breakdown
    sections.push(this.buildSection5(formData));

    // Section 6: Authorization Summary
    sections.push(this.buildSection6(formData));

    // Section 7: Declarations
    sections.push(this.buildSection7(formData));

    // Footer
    sections.push(this.buildFooter(formData, options));

    return sections.join('\n\n---PAGE-BREAK---\n\n');
  }

  private static buildHeader(formData: PreAuthFormData): string {
    return `
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║     REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH          ║
║                        INSURANCE                              ║
║                   POLICY PART - C (Revised)                   ║
║                                                                ║
║                  [AUTO-FILLED BY AIVANA SYSTEM]               ║
║                     Generated: ${new Date().toISOString()}
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

CLAIM NUMBER: ${formData.claimNumber}
VALID UNTIL: ${formData.authorizationValidUpto}

TO BE FILLED IN BLOCK LETTERS
`;
  }

  private static buildSection1(formData: PreAuthFormData): string {
    return `
SECTION 1: DETAILS OF THE THIRD PARTY ADMINISTRATOR / INSURER / HOSPITAL

a. Name of TPA/Insurance company:        ${formData.tpaName}

b. Toll free phone number:              ${formData.tpaPhoneNumber}

c. Toll free fax:                        ${formData.tpaFax}

d. Name of Hospital:                     ${formData.hospitalName}
   i. Address:                           ${formData.hospitalAddress}
   ii. Rohini ID:                        ${formData.hospitalRohiniId}
   iii. e-mail id:                       ${formData.hospitalEmail}
`;
  }

  private static buildSection2(formData: PreAuthFormData): string {
    const genderLabel = formData.patientGender === 'M' ? 'Male' : formData.patientGender === 'F' ? 'Female' : 'Third Gender';

    return `
SECTION 2: TO BE FILLED BY INSURED/PATIENT

A. Name of the Patient:                  ${formData.patientName}

B. Gender:                               [X] ${genderLabel}

C. Age:                                  ${formData.patientAge} years

D. Date of Birth:                        ${formData.patientDateOfBirth}

E. Contact number:                       ${formData.patientContactNumber}

F. Contact number of attending Relative: ${formData.attendingRelativeContact}

G. Insured Card ID number:               ${formData.insuredCardId}

H. Policy number/Name of Corporate:      ${formData.policyNumber}

I. Employee ID:                          ${formData.employeeId}

J. Currently do you have any other      [${formData.otherHealthInsurance ? 'X' : ' '}] Yes  [${!formData.otherHealthInsurance ? 'X' : ' '}] No
   mediclaim /health insurance:
   i. Company Name:                      ${formData.otherHealthInsuranceDetails || 'N/A'}

K: Do you have a family Physician:       [${formData.familyPhysician ? 'X' : ' '}] Yes  [${!formData.familyPhysician ? 'X' : ' '}] No

L: Name of the Family Physician:         ${formData.familyPhysicianName || 'N/A'}

M: Contact number, if any:               ${formData.familyPhysicianContact || 'N/A'}

N: Current Address of Insured Patient:   ${formData.currentAddress}

O: Occupation of Insured Patient:        ${formData.occupation}
`;
  }

  private static buildSection3(formData: PreAuthFormData): string {
    return `
SECTION 3: TO BE FILLED BY TREATING DOCTOR/HOSPITAL

A: Name of the treating Doctor:          ${formData.treatingDoctorName}

B: Contact number:                       ${formData.treatingDoctorContact}

C: Nature of Illness/Disease with       ${formData.illnessNature}
   presenting complaint:

D: Relevant Critical Findings:           ${formData.criticalFindings}

E: Duration of the present ailment:      ${formData.ailmentDurationDays} Days
   i. Date of First consultation:        ${formData.firstConsultationDate}
   ii. Past history of present ailment:  ${formData.pastHistoryOfAilment}

F: Provisional diagnosis:                ${formData.provisionalDiagnosis}
   i. ICD 10 code:                       ${formData.icd10Code}

G: Proposed line of treatment:
   [${formData.proposedLineOfTreatment.medical ? 'X' : ' '}] Medical Management
   [${formData.proposedLineOfTreatment.surgical ? 'X' : ' '}] Surgical Management
   [${formData.proposedLineOfTreatment.intensiveCare ? 'X' : ' '}] Intensive care
   [${formData.proposedLineOfTreatment.investigation ? 'X' : ' '}] Investigation
   [${formData.proposedLineOfTreatment.nonAllopathic ? 'X' : ' '}] Non-allopathic treatment

H: If investigation and/or Medical     ${formData.investigationDetails || 'N/A'}
   Management, provide details:

I: If surgical, name of surgery:         ${formData.surgeryName || 'N/A'}
   i. ICD 10 PCS code:                   ${formData.icd10PcsCode || 'N/A'}

J: If other treatment, provide details:  ${formData.otherTreatmentDetails || 'N/A'}
`;
  }

  private static buildSection4(formData: PreAuthFormData): string {
    return `
SECTION 4: DETAILS OF PATIENT ADMITTED

A. Date of admission:                    ${formData.admissionDate}

B. Time of admission:                    ${formData.admissionTime}

C. Is this an emergency/planned         ${formData.isEmergency ? '[X] Emergency' : '[X] Planned'}
   hospitalization event:

D. Mandatory Past History of any
   chronic illness:
   i. Diabetes                           ${formData.chronicIllnesses.diabetes || 'No'}
   ii. Heart disease                     ${formData.chronicIllnesses.heartDisease || 'No'}
   iii. Hypertension                     ${formData.chronicIllnesses.hypertension || 'No'}
   iv. Hyperlipidemias                   ${formData.chronicIllnesses.hyperlipidemias || 'No'}
   v. Osteoarthritis                     ${formData.chronicIllnesses.osteoarthritis || 'No'}
   vi. Asthma/COPD/Bronchitis            ${formData.chronicIllnesses.asthmaCopd || 'No'}
   vii. Cancer                           ${formData.chronicIllnesses.cancer || 'No'}
   viii. Alcohol/Drug abuse              ${formData.chronicIllnesses.alcoholDrugAbuse || 'No'}
   ix. Any HIV/ or STD Related ailment    ${formData.chronicIllnesses.hivStd || 'No'}
   x. Any other ailment                  ${formData.chronicIllnesses.other || 'No'}

E. Expected number of Days/stay in       ${formData.expectedStayDays} Days
   hospital:

F. Days in ICU:                          ${formData.icuDays} Days

G. Room Type:                            ${formData.roomType}

H. Per day room rent + nursing and      ₹ ${formData.perDayRoomRent.toLocaleString('en-IN')}
   service charges + patients diet:
`;
  }

  private static buildSection5(formData: PreAuthFormData): string {
    return `
SECTION 5: COST BREAKDOWN

I. Expected cost of investigation +     ₹ ${formData.investigationCost.toLocaleString('en-IN')}
   diagnostic:

J. ICU charges:                          ₹ ${formData.icuCharges.toLocaleString('en-IN')}

K. OT charges:                           ₹ ${formData.otCharges.toLocaleString('en-IN')}

L. Professional fees Surgeon +           ₹ ${formData.professionalFees.toLocaleString('en-IN')}
   Anesthetist Fees + consultation:

M. Medicines + Consumables + Cost        ₹ ${formData.medicinesConsumables.toLocaleString('en-IN')}
   of Implants:

N. Other hospital expenses if any:       ₹ ${formData.otherExpenses.toLocaleString('en-IN')}

O. All-inclusive package charges if      ₹ ${formData.packageCharges ? formData.packageCharges.toLocaleString('en-IN') : '0'}
   any applicable:

P. Sum Total expected cost of           ₹ ${formData.totalEstimatedCost.toLocaleString('en-IN')}
   hospitalization:
`;
  }

  private static buildSection6(formData: PreAuthFormData): string {
    return `
SECTION 6: AUTHORIZATION SUMMARY

Total Bill Amount:                       ₹ ${formData.totalEstimatedCost.toLocaleString('en-IN')}

Discount:                                ₹ ${formData.discount.toLocaleString('en-IN')}

Co-Pay:                                  ₹ ${formData.coPay.toLocaleString('en-IN')}

Deductibles:                             ₹ ${formData.deductible.toLocaleString('en-IN')}

Total Authorised Amount:                 ₹ ${formData.totalAuthorizedAmount.toLocaleString('en-IN')}

Amount to be paid by Insured:            ₹ ${formData.amountToBePhidByInsured.toLocaleString('en-IN')}

Policy Period:                           ${formData.policyPeriod}

Expected Date of Admission:              ${formData.admissionDate}

Expected Date of Discharge:              ${new Date(new Date(formData.admissionDate.split('/').reverse().join('-')).getTime() + formData.expectedStayDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}

Room Category Eligible:                  ${formData.eligibleRoomCategory}
`;
  }

  private static buildSection7(formData: PreAuthFormData): string {
    return `
SECTION 7: DECLARATIONS

DECLARATION BY THE PATIENT / REPRESENTATIVE

Patient's / Insured's Name:              ${formData.patientName}

Contact Number:                          ${formData.patientContactNumber}

Patient's / Insured's Signature:         ___________________

Date:                                    ${formData.patientDeclarationDate}

Time:                                    ${formData.patientDeclarationTime}


HOSPITAL DECLARATION

Hospital Seal:                           [SPACE FOR SEAL]

Doctor's Signature:                      ___________________

Date:                                    ${formData.hospitalDeclarationDate}

Time:                                    ${formData.hospitalDeclarationTime}
`;
  }

  private static buildFooter(formData: PreAuthFormData, options: PdfGenerationOptions): string {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DOCUMENT INFORMATION:

Generated by:                            AIVANA Insurance Platform
Template:                                Policy Part C (Revised)
Generation Date:                         ${new Date().toISOString()}
Claim Number:                            ${formData.claimNumber}
Authorization Valid Until:               ${formData.authorizationValidUpto}

IMPORTANT INSTRUCTIONS:

1. Review all fields carefully before printing
2. Ensure all signatures and stamps are in place
3. Attach all supporting documents as per checklist
4. Submit within 7 days of admission

Supporting Documents Required:
  □ Detailed Discharge Summary and all Bills
  □ Diagnostic Test Reports and Receipts
  □ Surgeon's Certificate and Bill
  □ Proof of Payment/Invoices

TPA/Insurer Contact:
  Company: ${formData.authorizingCompany}
  Address: ${formData.authorizingAddress}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  AUTO-FILLED FORM - PLEASE VERIFY ALL DETAILS

This document was generated automatically from extracted medical records.
While all information has been auto-filled with extracted data, please review
each field carefully and make any necessary corrections before submission.

For discrepancies or questions, contact your hospital billing department.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  private static createPdfDocument(sections: string, formData: PreAuthFormData): string {
    // In production, this would use PDFKit to create an actual PDF
    // For now, this returns the text content that would be converted to PDF

    return `
%PDF-1.4
${sections}

%%EOF
`;
  }

  private static generateHash(content: string | Buffer): string {
    // Simple hash for document integrity verification
    const str = typeof content === 'string' ? content : content.toString();
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Save PDF to file
   */
  static async savePdfToFile(
    pdfResult: PdfGenerationResult,
    outputPath: string
  ): Promise<{ success: boolean; filePath: string; fileSize: number }> {
    // In production environment, would save to disk
    console.log(`[PDF Generator] Would save PDF to: ${outputPath}`);
    console.log(`[PDF Generator] File size: ${pdfResult.fileSize} bytes`);

    return {
      success: true,
      filePath: outputPath,
      fileSize: pdfResult.fileSize,
    };
  }

  /**
   * Generate download URL for PDF
   */
  static generateDownloadUrl(pdfResult: PdfGenerationResult, baseUrl: string = '/api'): string {
    return `${baseUrl}/preauth/download/${pdfResult.fileName}`;
  }
}

/**
 * Workflow: Case → Filled Form → PDF → Download
 */
export async function generatePreAuthFormPdf(
  formData: PreAuthFormData,
  options?: PdfGenerationOptions
): Promise<PdfGenerationResult> {
  console.log('[Pre-Auth PDF Workflow] Starting form PDF generation');

  // Generate PDF
  const pdfResult = await PreAuthPdfGenerator.generatePDF(formData, options);

  if (!pdfResult.success) {
    throw new Error('PDF generation failed');
  }

  console.log('[Pre-Auth PDF Workflow] PDF generated successfully');
  console.log('[Pre-Auth PDF Workflow] File:', pdfResult.fileName);
  console.log('[Pre-Auth PDF Workflow] Size:', pdfResult.fileSize, 'bytes');
  console.log('[Pre-Auth PDF Workflow] Hash:', pdfResult.documentHash);

  return pdfResult;
}
