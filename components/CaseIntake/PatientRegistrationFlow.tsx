import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Case, newCase } from '../../services/caseModel';
import { Step1Welcome } from './steps/Step1Welcome';
import { Step2PatientEssentials } from './steps/Step2PatientEssentials';
import { Step3InsuranceDetails } from './steps/Step3InsuranceDetails';
import { Step4Documents } from './steps/Step4Documents';
import { Step5Review } from './steps/Step5Review';

export interface DocumentRecord {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
  status: 'uploading' | 'processing' | 'processed' | 'error' | 'retrying' | 'pending';
  progress?: number;
  ocrText?: string;
  fields?: Record<string, any>;
  error?: string;
  retryCount?: number;
  detectedType?: string;
  extractedFieldCount?: number;
}

export interface PatientRegistrationFormData {
  patientName: string;
  mobile: string;
  dateOfBirth: string;
  gender: 'M' | 'F' | 'O' | '';
  tpaName: string;
  policyNumber: string;
  corporateType: 'corporate' | 'retail';
  documents: DocumentRecord[];
}

interface PatientRegistrationFlowProps {
  onCaseCreated: (caseRecord: Case) => void;
  onCancel: () => void;
}

/**
 * PatientRegistrationFlow - PHASE 1
 * 5-step patient registration with complete data lineage
 *
 * DATA LINEAGE:
 * User Input → React State → Form Data → API Call → Backend → Database → Response → onCaseCreated
 *
 * STEPS:
 * 1. Welcome (patient name)
 * 2. Patient Essentials (mobile, DOB, gender)
 * 3. Insurance Details (TPA, policy)
 * 4. Documents (real OCR, real extraction)
 * 5. Review & Create
 */
export function PatientRegistrationFlow({
  onCaseCreated,
  onCancel,
}: PatientRegistrationFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PatientRegistrationFormData>({
    patientName: '',
    mobile: '',
    dateOfBirth: '',
    gender: '',
    tpaName: '',
    policyNumber: '',
    corporateType: 'corporate',
    documents: [],
  });

  const updateFormData = (updates: Partial<PatientRegistrationFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setError(null);
  };

  /**
   * Exponential backoff delays: 2s, 5s, 10s for retries 1, 2, 3
   */
  const getRetryDelay = (retryCount: number): number => {
    const delays = [0, 2000, 5000, 10000];
    return delays[Math.min(retryCount, delays.length - 1)];
  };

  const handleDocumentUpload = async (file: File, existingDocId?: string, retryCount: number = 0) => {
    const documentId = existingDocId || `doc-${Date.now()}`;
    const isRetry = retryCount > 0;

    if (!isRetry) {
      updateFormData({
        documents: [
          ...formData.documents,
          {
            id: documentId,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            status: 'uploading',
            retryCount: 0,
            uploadedAt: new Date().toISOString(),
          },
        ],
      });
    } else {
      updateFormData({
        documents: formData.documents.map((doc) =>
          doc.id === documentId
            ? { ...doc, status: 'retrying', retryCount }
            : doc
        ),
      });
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', file);
      const uploadResponse = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formDataToSend,
      });

      if (!uploadResponse.ok) throw new Error('Upload failed');
      const { ocrText, detectedType, fieldCount } = await uploadResponse.json();

      updateFormData({
        documents: formData.documents.map((doc) =>
          doc.id === documentId
            ? {
                ...doc,
                status: 'processing',
                ocrText,
                detectedType,
                extractedFieldCount: fieldCount,
              }
            : doc
        ),
      });

      const extractResponse = await fetch('/api/extraction/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocrText }),
      });

      if (extractResponse.ok) {
        const extracted = await extractResponse.json();
        updateFormData({
          documents: formData.documents.map((doc) =>
            doc.id === documentId
              ? { ...doc, status: 'processed', fields: extracted }
              : doc
          ),
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Upload failed';

      if (retryCount < 3) {
        const delay = getRetryDelay(retryCount + 1);
        updateFormData({
          documents: formData.documents.map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  status: 'error',
                  error: `${errorMessage}. Retrying in ${delay / 1000}s...`,
                  retryCount,
                }
              : doc
          ),
        });

        setTimeout(() => {
          handleDocumentUpload(file, documentId, retryCount + 1);
        }, delay);
      } else {
        updateFormData({
          documents: formData.documents.map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  status: 'error',
                  error: `${errorMessage}. Max retries (3) exceeded. Please contact support or remove this file.`,
                  retryCount,
                }
              : doc
          ),
        });
      }
    }
  };

  const handleCreateCase = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const newCaseData = newCase({
        patient: {
          name: formData.patientName,
          mobile: formData.mobile,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
        },
        insurance: {
          tpaName: formData.tpaName,
          policyNumber: formData.policyNumber,
          corporateType: formData.corporateType,
        },
        documents: formData.documents.map((doc) => ({
          id: doc.id,
          name: doc.name,
          ocrText: doc.ocrText || '',
        })),
        status: 'patient_registered',
      });

      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCaseData),
      });

      if (!response.ok) throw new Error('Case creation failed');
      const { id } = await response.json();
      onCaseCreated({ ...newCaseData, id } as Case);
    } catch (err) {
      setError('Failed to create case');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold">AIVANA Pre-Authorization</h1>
            <button onClick={onCancel} className="text-gray-500">✕</button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {currentStep === 1 && (
          <Step1Welcome
            patientName={formData.patientName}
            onNameChange={(name) => updateFormData({ patientName: name })}
            onNext={() => setCurrentStep(2)}
            onCancel={onCancel}
          />
        )}

        {currentStep === 2 && (
          <Step2PatientEssentials
            mobile={formData.mobile}
            dateOfBirth={formData.dateOfBirth}
            gender={formData.gender}
            onMobileChange={(mobile) => updateFormData({ mobile })}
            onDateOfBirthChange={(dob) => updateFormData({ dateOfBirth: dob })}
            onGenderChange={(gender) => updateFormData({ gender: gender as 'M' | 'F' | 'O' })}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <Step3InsuranceDetails
            tpaName={formData.tpaName}
            policyNumber={formData.policyNumber}
            corporateType={formData.corporateType}
            onTpaNameChange={(tpa) => updateFormData({ tpaName: tpa })}
            onPolicyNumberChange={(policy) => updateFormData({ policyNumber: policy })}
            onCorporateTypeChange={(type) => updateFormData({ corporateType: type })}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <Step4Documents
            documents={formData.documents}
            onDocumentUpload={handleDocumentUpload}
            onNext={() => setCurrentStep(5)}
            onBack={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 5 && (
          <Step5Review
            formData={formData}
            onCreate={handleCreateCase}
            onBack={() => setCurrentStep(4)}
            isCreating={isCreating}
          />
        )}
      </div>
    </div>
  );
}
