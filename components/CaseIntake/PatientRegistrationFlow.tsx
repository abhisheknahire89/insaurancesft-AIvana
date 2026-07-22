import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Case, newCase } from '../../services/caseModel';

// Step components to be created
export interface DocumentRecord {
  id: string;
  name: string;
  status: 'uploading' | 'processing' | 'processed' | 'error';
  ocrText?: string;
  fields?: Record<string, any>;
  error?: string;
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
 * 
 * STATUS: Foundation complete, steps to be implemented
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

  const handleDocumentUpload = async (file: File) => {
    const documentId = `doc-${Date.now()}`;
    updateFormData({
      documents: [
        ...formData.documents,
        { id: documentId, name: file.name, status: 'uploading' },
      ],
    });

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', file);
      const uploadResponse = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formDataToSend,
      });
      if (!uploadResponse.ok) throw new Error('Upload failed');
      const { ocrText } = await uploadResponse.json();

      updateFormData({
        documents: formData.documents.map((doc) =>
          doc.id === documentId
            ? { ...doc, status: 'processing', ocrText }
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
    } catch (err) {
      updateFormData({
        documents: formData.documents.map((doc) =>
          doc.id === documentId
            ? { ...doc, status: 'error', error: 'Upload failed' }
            : doc
        ),
      });
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
        <div className="text-center py-12">
          <p className="text-gray-600">Step components loading...</p>
          <p className="text-sm text-gray-400 mt-2">Phase 1 scaffold complete</p>
        </div>
      </div>
    </div>
  );
}
