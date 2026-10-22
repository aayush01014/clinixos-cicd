/**
 * ClinixOS Medical Clinical Engine & Interoperability Automated Test Suite
 * Validating physiological scoring engines, drug-drug interaction matrix, and HL7 FHIR v4 transformations.
 */

import {
  calculateApacheII,
  calculateSofa,
  calculateCurb65,
  calculateCha2Ds2Vasc,
  calculateCockcroftGault
} from '../shared/clinical/calculators.ts';

import {
  screenPrescriptionInteractions,
  DRUG_FORMULARY_DATABASE
} from '../shared/clinical/pharmacology.ts';

import {
  toFhirPatient,
  toFhirObservation,
  toFhirMedicationRequest
} from '../shared/clinical/fhir.ts';

async function runClinicalEngineTests() {
  console.log('========================================================');
  console.log(' ClinixOS Clinical Engine & Interoperability Tests');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. APACHE II Score Test Cases
  console.log('--- Clinical Decision Support: APACHE II Engine ---');
  const apacheLow = calculateApacheII({
    temperature: 37.2,
    meanArterialPressure: 88,
    heartRate: 78,
    respiratoryRate: 16,
    oxygenationPaO2: 95,
    fio2: 0.21,
    arterialPH: 7.40,
    serumSodium: 140,
    serumPotassium: 4.1,
    serumCreatinine: 0.9,
    acuteRenalFailure: false,
    hematocrit: 42,
    whiteBloodCount: 7.5,
    glasgowComaScale: 15,
    age: 35,
    chronicHealthStatus: 'none'
  });
  assert('APACHE II: Normal physiological parameters yields Low risk score (<15)', apacheLow.score < 15 && apacheLow.riskCategory === 'Low');

  const apacheSevere = calculateApacheII({
    temperature: 39.5,
    meanArterialPressure: 45,
    heartRate: 145,
    respiratoryRate: 36,
    oxygenationPaO2: 52,
    fio2: 0.21,
    arterialPH: 7.18,
    serumSodium: 162,
    serumPotassium: 6.2,
    serumCreatinine: 3.8,
    acuteRenalFailure: true,
    hematocrit: 24,
    whiteBloodCount: 28.5,
    glasgowComaScale: 8,
    age: 78,
    chronicHealthStatus: 'emergency_postop_or_nonop_with_hx'
  });
  assert('APACHE II: Severe septic shock yields Extremely High risk score (>=35)', apacheSevere.score >= 35 && apacheSevere.riskCategory === 'Extremely High');

  // 2. SOFA Score Test Cases
  console.log('\n--- Clinical Decision Support: SOFA Organ Failure Assessment ---');
  const sofaCrit = calculateSofa({
    pao2Fio2Ratio: 90,
    isMechanicallyVentilated: true,
    platelets: 18,
    bilirubin: 13.5,
    cardiovascular: 'dopamine_high_or_norepi_high',
    glasgowComaScale: 5,
    creatinine: 5.5,
    urineOutputMlPerDay: 150
  });
  assert('SOFA: Quad-organ failure reaches maximum SOFA score tier (>=15) with >80% mortality', sofaCrit.totalScore >= 15 && sofaCrit.mortalityRateEstimate === '> 80%');

  // 3. CURB-65 Pneumonia Scoring
  console.log('\n--- Clinical Decision Support: CURB-65 Pneumonia Stratification ---');
  const curbHigh = calculateCurb65({
    confusion: true,
    bunMgDl: 28,
    respiratoryRate: 34,
    systolicBp: 82,
    diastolicBp: 50,
    age: 72
  });
  assert('CURB-65: 5 risk factors triggers Emergent ICU admission requirement', curbHigh.score === 5 && curbHigh.recommendation.includes('ICU'));

  // 4. CHA2DS2-VASc
  console.log('\n--- Clinical Decision Support: CHA2DS2-VASc Anticoagulation ---');
  const cha2 = calculateCha2Ds2Vasc({
    congestiveHeartFailure: true,
    hypertension: true,
    age: 76, // +2
    diabetesMellitus: true,
    priorStrokeOrTiaOrThromboembolism: true, // +2
    vascularDisease: true,
    sexCategory: 'female' // +1
  });
  assert('CHA2DS2-VASc: High thromboembolic risk score (>=2) prompts oral anticoagulation recommendation', cha2.score >= 6 && cha2.anticoagulationRecommendation.includes('anticoagulation'));

  // 5. Cockcroft-Gault eGFR
  console.log('\n--- Clinical Decision Support: Cockcroft-Gault Renal Dosing ---');
  const ckd = calculateCockcroftGault({
    age: 82,
    weightKg: 55,
    serumCreatinineMgDl: 2.8,
    isFemale: true
  });
  assert('Cockcroft-Gault: Elevated creatinine in geriatric patient detects severe CKD and flags dose reduction', ckd.dosageAdjustmentRequired && ckd.creatinineClearanceMlPerMin < 30);

  // 6. Pharmacology & DDI Interaction Matrix
  console.log('\n--- Pharmacology: Drug-Drug Interaction (DDI) Screener ---');
  const ddiAlerts = screenPrescriptionInteractions(['Warfarin 5mg', 'Amiodarone 200mg', 'Metformin 500mg']);
  assert('DDI: Detects Major interaction between Warfarin and Amiodarone', ddiAlerts.length >= 1 && ddiAlerts[0].severity === 'Major');

  const ciproTheoAlerts = screenPrescriptionInteractions(['Ciprofloxacin 500mg', 'Theophylline 300mg']);
  assert('DDI: Detects Contraindicated combination of Ciprofloxacin + Theophylline', ciproTheoAlerts.some((a) => a.severity === 'Contraindicated'));

  assert('Formulary: Formulary database contains core emergency and critical care medications', Object.keys(DRUG_FORMULARY_DATABASE).length >= 10);

  // 7. HL7 FHIR v4 Resource Converters
  console.log('\n--- Interoperability: HL7 FHIR v4 Resource Transformations ---');
  const fhirPat = toFhirPatient({
    id: 104,
    mrn: 'MRN-000104',
    first_name: 'Placeholder-First',
    last_name: 'Placeholder-Last',
    gender: 'Female',
    date_of_birth: '1988-04-12',
    phone: '+1-555-0199',
    email: 'patient104@placeholder.com',
    address: '100 Medical Center Blvd'
  });
  assert('FHIR: Patient resource conforms to FHIR v4 schema with official MRN identifier', fhirPat.resourceType === 'Patient' && fhirPat.identifier[0].value === 'MRN-000104' && fhirPat.gender === 'female');

  const fhirObs = toFhirObservation({
    id: 42,
    patient_id: 104,
    test_name: 'Cardiac Troponin I',
    test_category: 'Cardiac Markers',
    status: 'Completed',
    result_value: '0.45 ng/mL',
    reference_range: '< 0.04 ng/mL',
    is_abnormal: 1,
    created_at: '2026-10-14T10:00:00Z',
    resulted_at: '2026-10-14T10:45:00Z'
  });
  assert('FHIR: Observation resource captures abnormal cardiac biomarker result with LOINC/laboratory category', fhirObs.resourceType === 'Observation' && fhirObs.status === 'final' && fhirObs.interpretation?.[0].coding[0].code === 'A');

  const fhirRx = toFhirMedicationRequest({
    id: 88,
    patient_id: 104,
    doctor_id: 7,
    status: 'Issued',
    created_at: '2026-10-14T11:00:00Z',
    medication_name: 'Atorvastatin 40mg',
    dosage: '40mg',
    frequency: 'Once Daily at Bedtime',
    quantity: 30
  });
  assert('FHIR: MedicationRequest resource maps active CPOE prescription to FHIR structure', fhirRx.resourceType === 'MedicationRequest' && fhirRx.status === 'active');

  console.log('\n========================================================');
  console.log(` Test Execution Finished: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runClinicalEngineTests().catch((err) => {
  console.error('[Clinical Tests Fatal Error]', err);
  process.exit(1);
});
