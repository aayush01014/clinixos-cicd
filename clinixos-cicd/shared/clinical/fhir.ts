/**
 * ClinixOS HL7 FHIR (Fast Healthcare Interoperability Resources) v4 Resource Converters
 * Standards-compliant transformation between ClinixOS internal SQLite schema and FHIR JSON structures.
 */

export interface FhirMeta {
  versionId: string;
  lastUpdated: string;
  source?: string;
  profile?: string[];
}

export interface FhirIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary';
  system: string;
  value: string;
}

export interface FhirCodeableConcept {
  coding: Array<{
    system: string;
    code: string;
    display: string;
  }>;
  text?: string;
}

export interface FhirReference {
  reference: string;
  display?: string;
}

export interface FhirPatient {
  resourceType: 'Patient';
  id: string;
  meta: FhirMeta;
  identifier: FhirIdentifier[];
  active: boolean;
  name: Array<{
    use: 'official' | 'usual';
    family: string;
    given: string[];
  }>;
  telecom: Array<{
    system: 'phone' | 'email';
    value: string;
    use: 'home' | 'work' | 'mobile';
  }>;
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  address?: Array<{
    use: 'home' | 'work';
    line: string[];
    city?: string;
    state?: string;
    postalCode?: string;
  }>;
}

export interface FhirObservation {
  resourceType: 'Observation';
  id: string;
  meta: FhirMeta;
  status: 'registered' | 'preliminary' | 'final' | 'amended';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  effectiveDateTime: string;
  valueQuantity?: {
    value: number;
    unit: string;
    system?: string;
    code?: string;
  };
  valueString?: string;
  interpretation?: FhirCodeableConcept[];
  referenceRange?: Array<{
    low?: { value: number; unit: string };
    high?: { value: number; unit: string };
    text?: string;
  }>;
}

export interface FhirMedicationRequest {
  resourceType: 'MedicationRequest';
  id: string;
  meta: FhirMeta;
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft';
  intent: 'order' | 'proposal' | 'plan';
  medicationCodeableConcept: FhirCodeableConcept;
  subject: FhirReference;
  authoredOn: string;
  requester?: FhirReference;
  dosageInstruction?: Array<{
    text: string;
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: 'd' | 'h' | 'wk';
      };
    };
    doseAndRate?: Array<{
      doseQuantity?: {
        value: number;
        unit: string;
      };
    }>;
  }>;
}

/**
 * Transforms ClinixOS Patient DB record into HL7 FHIR v4 Patient
 */
export function toFhirPatient(patient: {
  id: number;
  mrn?: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth?: string;
  phone?: string;
  email?: string;
  address?: string;
}): FhirPatient {
  const genderMap: Record<string, FhirPatient['gender']> = {
    male: 'male',
    female: 'female',
    m: 'male',
    f: 'female',
    other: 'other'
  };

  return {
    resourceType: 'Patient',
    id: `clinixos-patient-${patient.id}`,
    meta: {
      versionId: '1',
      lastUpdated: new Date().toISOString(),
      source: 'urn:clinixos:hms:emr',
      profile: ['http://hl7.org/fhir/StructureDefinition/Patient']
    },
    identifier: [
      {
        use: 'official',
        system: 'urn:clinixos:mrn',
        value: patient.mrn || `MRN-${patient.id.toString().padStart(6, '0')}`
      }
    ],
    active: true,
    name: [
      {
        use: 'official',
        family: patient.last_name || '',
        given: [patient.first_name || '']
      }
    ],
    telecom: [
      ...(patient.phone ? [{ system: 'phone' as const, value: patient.phone, use: 'mobile' as const }] : []),
      ...(patient.email ? [{ system: 'email' as const, value: patient.email, use: 'home' as const }] : [])
    ],
    gender: genderMap[patient.gender?.toLowerCase()] || 'unknown',
    birthDate: patient.date_of_birth,
    address: patient.address ? [{ use: 'home', line: [patient.address] }] : []
  };
}

/**
 * Transforms ClinixOS Lab Order into HL7 FHIR v4 Observation
 */
export function toFhirObservation(labOrder: {
  id: number;
  patient_id: number;
  test_name: string;
  test_category: string;
  status: string;
  result_value?: string;
  unit?: string;
  reference_range?: string;
  is_abnormal?: number;
  created_at: string;
  resulted_at?: string;
}): FhirObservation {
  const statusMap: Record<string, FhirObservation['status']> = {
    Completed: 'final',
    Processing: 'preliminary',
    Pending: 'registered'
  };

  const isAbnormal = Boolean(labOrder.is_abnormal);

  return {
    resourceType: 'Observation',
    id: `clinixos-lab-${labOrder.id}`,
    meta: {
      versionId: '1',
      lastUpdated: labOrder.resulted_at || labOrder.created_at || new Date().toISOString(),
      source: 'urn:clinixos:hms:lis',
      profile: ['http://hl7.org/fhir/StructureDefinition/Observation']
    },
    status: statusMap[labOrder.status] || 'registered',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory'
          }
        ],
        text: labOrder.test_category
      }
    ],
    code: {
      coding: [
        {
          system: 'urn:clinixos:lab-tests',
          code: labOrder.test_name.toLowerCase().replace(/\s+/g, '-'),
          display: labOrder.test_name
        }
      ],
      text: labOrder.test_name
    },
    subject: {
      reference: `Patient/clinixos-patient-${labOrder.patient_id}`
    },
    effectiveDateTime: labOrder.resulted_at || labOrder.created_at,
    valueString: labOrder.result_value,
    interpretation: isAbnormal
      ? [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                code: 'A',
                display: 'Abnormal'
              }
            ]
          }
        ]
      : [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                code: 'N',
                display: 'Normal'
              }
            ]
          }
        ],
    referenceRange: labOrder.reference_range
      ? [
          {
            text: labOrder.reference_range
          }
        ]
      : []
  };
}

/**
 * Transforms ClinixOS Prescription into HL7 FHIR v4 MedicationRequest
 */
export function toFhirMedicationRequest(rx: {
  id: number;
  patient_id: number;
  doctor_id: number;
  status: string;
  notes?: string;
  created_at: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  quantity: number;
}): FhirMedicationRequest {
  const statusMap: Record<string, FhirMedicationRequest['status']> = {
    Dispensed: 'completed',
    Issued: 'active',
    Cancelled: 'cancelled'
  };

  return {
    resourceType: 'MedicationRequest',
    id: `clinixos-rx-${rx.id}`,
    meta: {
      versionId: '1',
      lastUpdated: rx.created_at || new Date().toISOString(),
      source: 'urn:clinixos:hms:cpoe',
      profile: ['http://hl7.org/fhir/StructureDefinition/MedicationRequest']
    },
    status: statusMap[rx.status] || 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [
        {
          system: 'urn:clinixos:formulary',
          code: rx.medication_name.toLowerCase().replace(/\s+/g, '-'),
          display: rx.medication_name
        }
      ],
      text: rx.medication_name
    },
    subject: {
      reference: `Patient/clinixos-patient-${rx.patient_id}`
    },
    requester: {
      reference: `Practitioner/clinixos-doctor-${rx.doctor_id}`
    },
    authoredOn: rx.created_at,
    dosageInstruction: [
      {
        text: `${rx.dosage} ${rx.frequency} (Total Quantity: ${rx.quantity})`
      }
    ]
  };
}
