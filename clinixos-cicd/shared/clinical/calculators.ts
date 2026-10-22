/**
 * ClinixOS Medical Clinical Decision Support (CDS) Rules Engine
 * Clinically validated medical algorithms, physiological scoring systems, and diagnostic risk indices.
 */

export interface ApacheIIParameters {
  temperature: number; // Celsius (e.g. 38.5)
  meanArterialPressure: number; // mmHg (e.g. 90)
  heartRate: number; // bpm (e.g. 110)
  respiratoryRate: number; // breaths/min (e.g. 24)
  oxygenationPaO2: number; // mmHg (if FiO2 < 0.5) or A-a gradient (if FiO2 >= 0.5)
  fio2: number; // fraction 0.21 - 1.0
  arterialPH: number; // e.g. 7.35
  serumSodium: number; // mEq/L e.g. 138
  serumPotassium: number; // mEq/L e.g. 4.2
  serumCreatinine: number; // mg/dL e.g. 1.2
  acuteRenalFailure: boolean;
  hematocrit: number; // % e.g. 38
  whiteBloodCount: number; // 10^3/mm3 e.g. 12.5
  glasgowComaScale: number; // 3 to 15
  age: number; // years
  chronicHealthStatus: 'none' | 'elective_postop_with_hx' | 'emergency_postop_or_nonop_with_hx';
}

export interface ApacheIIResult {
  score: number;
  acutePhysiologyScore: number;
  agePoints: number;
  chronicHealthPoints: number;
  estimatedHospitalMortalityPercent: number;
  riskCategory: 'Low' | 'Moderate' | 'High' | 'Extremely High';
}

/**
 * Calculates Acute Physiology and Chronic Health Evaluation II (APACHE II)
 */
export function calculateApacheII(params: ApacheIIParameters): ApacheIIResult {
  let aps = 0;

  // 1. Temperature (rectal C)
  const t = params.temperature;
  if (t >= 41.0 || t <= 29.9) aps += 4;
  else if (t >= 39.0 || (t >= 30.0 && t <= 31.9)) aps += 3;
  else if (t <= 33.9) aps += 2;
  else if (t >= 38.5 || (t >= 34.0 && t <= 35.9)) aps += 1;

  // 2. Mean Arterial Pressure (mmHg)
  const map = params.meanArterialPressure;
  if (map >= 160 || map <= 49) aps += 4;
  else if (map >= 130 || (map >= 50 && map <= 69)) aps += 2;
  else if (map >= 110) aps += 1;

  // 3. Heart Rate
  const hr = params.heartRate;
  if (hr >= 180 || hr <= 39) aps += 4;
  else if (hr >= 140 || (hr >= 40 && hr <= 54)) aps += 3;
  else if (hr >= 110 || (hr >= 55 && hr <= 69)) aps += 2;

  // 4. Respiratory Rate
  const rr = params.respiratoryRate;
  if (rr >= 50 || rr <= 5) aps += 4;
  else if (rr >= 35) aps += 3;
  else if (rr <= 9) aps += 2;
  else if (rr >= 25) aps += 1;

  // 5. Oxygenation
  if (params.fio2 >= 0.5) {
    const aado2 = (params.fio2 * (760 - 47) - (40 / 0.8)) - params.oxygenationPaO2;
    if (aado2 >= 500) aps += 4;
    else if (aado2 >= 350) aps += 3;
    else if (aado2 >= 200) aps += 2;
  } else {
    const pao2 = params.oxygenationPaO2;
    if (pao2 < 55) aps += 4;
    else if (pao2 <= 60) aps += 3;
    else if (pao2 <= 70) aps += 1;
  }

  // 6. Arterial pH
  const ph = params.arterialPH;
  if (ph >= 7.70 || ph < 7.15) aps += 4;
  else if (ph >= 7.60 || (ph >= 7.15 && ph <= 7.24)) aps += 3;
  else if (ph <= 7.32) aps += 2;
  else if (ph >= 7.50) aps += 1;

  // 7. Serum Sodium (mEq/L)
  const na = params.serumSodium;
  if (na >= 180 || na <= 110) aps += 4;
  else if (na >= 160 || (na >= 111 && na <= 119)) aps += 3;
  else if (na >= 155 || (na >= 120 && na <= 129)) aps += 2;
  else if (na >= 150) aps += 1;

  // 8. Serum Potassium (mEq/L)
  const k = params.serumPotassium;
  if (k >= 7.0 || k < 2.5) aps += 4;
  else if (k >= 6.0 || (k >= 2.5 && k <= 2.9)) aps += 2;
  else if (k >= 5.5 || (k >= 3.0 && k <= 3.4)) aps += 1;

  // 9. Serum Creatinine (mg/dL) - doubled in acute renal failure
  const crMultiplier = params.acuteRenalFailure ? 2 : 1;
  const cr = params.serumCreatinine;
  if (cr >= 3.5) aps += 4 * crMultiplier;
  else if (cr >= 2.0) aps += 3 * crMultiplier;
  else if (cr >= 1.5 || cr < 0.6) aps += 2 * crMultiplier;

  // 10. Hematocrit (%)
  const hct = params.hematocrit;
  if (hct >= 60 || hct < 20) aps += 4;
  else if (hct >= 50 || (hct >= 20 && hct <= 29.9)) aps += 2;
  else if (hct >= 46) aps += 1;

  // 11. White Blood Count (10^3/mm3)
  const wbc = params.whiteBloodCount;
  if (wbc >= 40 || wbc < 1.0) aps += 4;
  else if (wbc >= 20 || (wbc >= 1.0 && wbc <= 2.9)) aps += 2;
  else if (wbc >= 15) aps += 1;

  // 12. Glasgow Coma Scale points = 15 - actual GCS
  const gcsPoints = 15 - Math.max(3, Math.min(15, params.glasgowComaScale));
  aps += gcsPoints;

  // Age Points
  let agePoints = 0;
  if (params.age >= 75) agePoints = 6;
  else if (params.age >= 65) agePoints = 5;
  else if (params.age >= 55) agePoints = 3;
  else if (params.age >= 45) agePoints = 2;

  // Chronic Health Points
  let chronicPoints = 0;
  if (params.chronicHealthStatus === 'emergency_postop_or_nonop_with_hx') chronicPoints = 5;
  else if (params.chronicHealthStatus === 'elective_postop_with_hx') chronicPoints = 2;

  const totalScore = aps + agePoints + chronicPoints;

  // Estimated non-operative ICU mortality logistic regression
  const logit = -3.517 + (totalScore * 0.146);
  const mortality = Math.round((Math.exp(logit) / (1 + Math.exp(logit))) * 100);

  let riskCategory: ApacheIIResult['riskCategory'] = 'Low';
  if (totalScore >= 35) riskCategory = 'Extremely High';
  else if (totalScore >= 25) riskCategory = 'High';
  else if (totalScore >= 15) riskCategory = 'Moderate';

  return {
    score: totalScore,
    acutePhysiologyScore: aps,
    agePoints,
    chronicHealthPoints: chronicPoints,
    estimatedHospitalMortalityPercent: Math.min(99, Math.max(1, mortality)),
    riskCategory
  };
}

/**
 * Sequential Organ Failure Assessment (SOFA) Score
 */
export interface SofaParameters {
  pao2Fio2Ratio: number; // mmHg (e.g. 350)
  isMechanicallyVentilated: boolean;
  platelets: number; // x10^3/uL (e.g. 150)
  bilirubin: number; // mg/dL (e.g. 1.1)
  cardiovascular: 'none' | 'map_under_70' | 'dopamine_low' | 'dopamine_med_or_norepi_low' | 'dopamine_high_or_norepi_high';
  glasgowComaScale: number; // 3 to 15
  creatinine: number; // mg/dL or urine output
  urineOutputMlPerDay?: number;
}

export interface SofaResult {
  totalScore: number;
  respiratoryScore: number;
  coagulationScore: number;
  liverScore: number;
  cardiovascularScore: number;
  cnsScore: number;
  renalScore: number;
  mortalityRateEstimate: string;
}

export function calculateSofa(params: SofaParameters): SofaResult {
  // 1. Respiration
  let resp = 0;
  if (params.pao2Fio2Ratio < 100 && params.isMechanicallyVentilated) resp = 4;
  else if (params.pao2Fio2Ratio < 200 && params.isMechanicallyVentilated) resp = 3;
  else if (params.pao2Fio2Ratio < 300) resp = 2;
  else if (params.pao2Fio2Ratio < 400) resp = 1;

  // 2. Coagulation (Platelets)
  let coag = 0;
  if (params.platelets < 20) coag = 4;
  else if (params.platelets < 50) coag = 3;
  else if (params.platelets < 100) coag = 2;
  else if (params.platelets < 150) coag = 1;

  // 3. Liver (Bilirubin)
  let liver = 0;
  if (params.bilirubin >= 12.0) liver = 4;
  else if (params.bilirubin >= 6.0) liver = 3;
  else if (params.bilirubin >= 2.0) liver = 2;
  else if (params.bilirubin >= 1.2) liver = 1;

  // 4. Cardiovascular
  let cv = 0;
  switch (params.cardiovascular) {
    case 'dopamine_high_or_norepi_high': cv = 4; break;
    case 'dopamine_med_or_norepi_low': cv = 3; break;
    case 'dopamine_low': cv = 2; break;
    case 'map_under_70': cv = 1; break;
    default: cv = 0;
  }

  // 5. CNS (Glasgow Coma Scale)
  let cns = 0;
  if (params.glasgowComaScale < 6) cns = 4;
  else if (params.glasgowComaScale <= 9) cns = 3;
  else if (params.glasgowComaScale <= 12) cns = 2;
  else if (params.glasgowComaScale <= 14) cns = 1;

  // 6. Renal (Creatinine or Urine Output)
  let renal = 0;
  if (params.creatinine >= 5.0 || (params.urineOutputMlPerDay !== undefined && params.urineOutputMlPerDay < 200)) renal = 4;
  else if (params.creatinine >= 3.5 || (params.urineOutputMlPerDay !== undefined && params.urineOutputMlPerDay < 500)) renal = 3;
  else if (params.creatinine >= 2.0) renal = 2;
  else if (params.creatinine >= 1.2) renal = 1;

  const total = resp + coag + liver + cv + cns + renal;

  let mortality = '< 10%';
  if (total >= 15) mortality = '> 80%';
  else if (total >= 12) mortality = '40% - 50%';
  else if (total >= 9) mortality = '25% - 35%';
  else if (total >= 6) mortality = '15% - 20%';

  return {
    totalScore: total,
    respiratoryScore: resp,
    coagulationScore: coag,
    liverScore: liver,
    cardiovascularScore: cv,
    cnsScore: cns,
    renalScore: renal,
    mortalityRateEstimate: mortality
  };
}

/**
 * CURB-65 Score for Pneumonia Severity
 */
export interface Curb65Parameters {
  confusion: boolean;
  bunMgDl: number; // Blood urea nitrogen > 19 mg/dL
  respiratoryRate: number; // >= 30 breaths/min
  systolicBp: number; // < 90 mmHg
  diastolicBp: number; // <= 60 mmHg
  age: number; // >= 65 years
}

export function calculateCurb65(params: Curb65Parameters): {
  score: number;
  recommendation: string;
  mortalityRisk: string;
} {
  let score = 0;
  if (params.confusion) score += 1;
  if (params.bunMgDl > 19) score += 1;
  if (params.respiratoryRate >= 30) score += 1;
  if (params.systolicBp < 90 || params.diastolicBp <= 60) score += 1;
  if (params.age >= 65) score += 1;

  let recommendation = 'Outpatient treatment feasible.';
  let mortalityRisk = 'Low (< 1.5%)';

  if (score >= 4) {
    recommendation = 'Emergent ICU admission required. High severity community-acquired pneumonia.';
    mortalityRisk = 'Very High (20% - 30%)';
  } else if (score === 3) {
    recommendation = 'Inpatient hospitalization required; consider ICU evaluation.';
    mortalityRisk = 'High (14%)';
  } else if (score === 2) {
    recommendation = 'Short inpatient hospitalization or supervised outpatient treatment.';
    mortalityRisk = 'Moderate (6.8%)';
  }

  return { score, recommendation, mortalityRisk };
}

/**
 * CHA2DS2-VASc Score for Atrial Fibrillation Stroke Risk
 */
export interface Cha2Ds2VascParameters {
  congestiveHeartFailure: boolean;
  hypertension: boolean;
  age: number;
  diabetesMellitus: boolean;
  priorStrokeOrTiaOrThromboembolism: boolean;
  vascularDisease: boolean; // prior MI, PAD, or aortic plaque
  sexCategory: 'male' | 'female';
}

export function calculateCha2Ds2Vasc(params: Cha2Ds2VascParameters): {
  score: number;
  annualStrokeRiskPercent: number;
  anticoagulationRecommendation: string;
} {
  let score = 0;
  if (params.congestiveHeartFailure) score += 1;
  if (params.hypertension) score += 1;
  if (params.age >= 75) score += 2;
  else if (params.age >= 65) score += 1;
  if (params.diabetesMellitus) score += 1;
  if (params.priorStrokeOrTiaOrThromboembolism) score += 2;
  if (params.vascularDisease) score += 1;
  if (params.sexCategory === 'female') score += 1;

  const riskTable: Record<number, number> = {
    0: 0.2, 1: 0.6, 2: 2.2, 3: 3.2, 4: 4.8, 5: 7.2, 6: 9.7, 7: 11.2, 8: 12.5, 9: 15.2
  };

  const annualRisk = riskTable[score] || 15.2;

  let recommendation = 'No antithrombotic therapy recommended.';
  const effectiveScore = params.sexCategory === 'female' ? score - 1 : score;

  if (effectiveScore >= 2) {
    recommendation = 'Oral anticoagulation strongly indicated (DOAC e.g. Apixaban or Warfarin INR 2-3).';
  } else if (effectiveScore === 1) {
    recommendation = 'Oral anticoagulation should be considered based on individual bleeding risk vs benefit.';
  }

  return { score, annualStrokeRiskPercent: annualRisk, anticoagulationRecommendation: recommendation };
}

/**
 * Cockcroft-Gault Creatinine Clearance (eGFR estimate)
 */
export function calculateCockcroftGault(params: {
  age: number;
  weightKg: number;
  serumCreatinineMgDl: number;
  isFemale: boolean;
}): {
  creatinineClearanceMlPerMin: number;
  ckdStage: string;
  dosageAdjustmentRequired: boolean;
} {
  const { age, weightKg, serumCreatinineMgDl, isFemale } = params;
  if (serumCreatinineMgDl <= 0) return { creatinineClearanceMlPerMin: 120, ckdStage: 'Normal', dosageAdjustmentRequired: false };

  let crCl = ((140 - age) * weightKg) / (72 * serumCreatinineMgDl);
  if (isFemale) crCl *= 0.85;

  crCl = Math.round(crCl * 10) / 10;

  let ckdStage = 'Stage 1 (Normal or High: >= 90 mL/min)';
  let dosageAdjustmentRequired = false;

  if (crCl < 15) {
    ckdStage = 'Stage 5 (Kidney Failure: < 15 mL/min)';
    dosageAdjustmentRequired = true;
  } else if (crCl < 30) {
    ckdStage = 'Stage 4 (Severe Reduction: 15-29 mL/min)';
    dosageAdjustmentRequired = true;
  } else if (crCl < 60) {
    ckdStage = 'Stage 3 (Moderate Reduction: 30-59 mL/min)';
    dosageAdjustmentRequired = true;
  } else if (crCl < 90) {
    ckdStage = 'Stage 2 (Mild Reduction: 60-89 mL/min)';
  }

  return { creatinineClearanceMlPerMin: crCl, ckdStage, dosageAdjustmentRequired };
}
