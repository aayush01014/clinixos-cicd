/**
 * ClinixOS Comprehensive Clinical Pharmacology & Drug Interaction Matrix
 * Standard hospital formulary classifications, CYP450 pathways, and contraindication screening.
 */

export interface DrugProfile {
  id: string;
  name: string;
  genericName: string;
  atcCode: string;
  therapeuticClass: string;
  subClass: string;
  cypMetabolism: string[]; // e.g. ['CYP3A4', 'CYP2C9']
  cypInhibition: string[];
  cypInduction: string[];
  blackBoxWarning?: string;
  renalAdjustmentThresholdCrCl?: number; // mL/min below which dose must be reduced
  pregnancyCategory: 'A' | 'B' | 'C' | 'D' | 'X';
  maxDailyDoseMg: number;
}

export interface DrugInteraction {
  drugA: string;
  drugB: string;
  severity: 'Contraindicated' | 'Major' | 'Moderate' | 'Minor';
  mechanism: string;
  clinicalManagement: string;
}

export const DRUG_FORMULARY_DATABASE: Record<string, DrugProfile> = {
  WARFARIN: {
    id: 'WARFARIN',
    name: 'Coumadin',
    genericName: 'Warfarin Sodium',
    atcCode: 'B01AA03',
    therapeuticClass: 'Antithrombotic Agents',
    subClass: 'Vitamin K Antagonists',
    cypMetabolism: ['CYP2C9', 'CYP3A4', 'CYP1A2'],
    cypInhibition: [],
    cypInduction: [],
    blackBoxWarning: 'Major or fatal bleeding. Regular INR monitoring required.',
    pregnancyCategory: 'X',
    maxDailyDoseMg: 15
  },
  ASPIRIN: {
    id: 'ASPIRIN',
    name: 'Bayer Aspirin',
    genericName: 'Acetylsalicylic Acid',
    atcCode: 'B01AC06',
    therapeuticClass: 'Platelet Aggregation Inhibitors',
    subClass: 'Salicylic Acid Derivatives',
    cypMetabolism: [],
    cypInhibition: ['COX-1', 'COX-2'],
    cypInduction: [],
    blackBoxWarning: 'Reye syndrome in children and teenagers recovering from viral infections.',
    pregnancyCategory: 'D',
    maxDailyDoseMg: 4000
  },
  CLOPIDOGREL: {
    id: 'CLOPIDOGREL',
    name: 'Plavix',
    genericName: 'Clopidogrel Bisulfate',
    atcCode: 'B01AC04',
    therapeuticClass: 'Platelet Aggregation Inhibitors',
    subClass: 'Thienopyridines',
    cypMetabolism: ['CYP2C19', 'CYP3A4'],
    cypInhibition: [],
    cypInduction: [],
    blackBoxWarning: 'Diminished antiplatelet effect in CYP2C19 poor metabolizers.',
    pregnancyCategory: 'B',
    maxDailyDoseMg: 75
  },
  OMEPRAZOLE: {
    id: 'OMEPRAZOLE',
    name: 'Prilosec',
    genericName: 'Omeprazole Magnesium',
    atcCode: 'A02BC01',
    therapeuticClass: 'Proton Pump Inhibitors',
    subClass: 'Substituted Benzimidazoles',
    cypMetabolism: ['CYP2C19', 'CYP3A4'],
    cypInhibition: ['CYP2C19'],
    cypInduction: ['CYP1A2'],
    pregnancyCategory: 'C',
    maxDailyDoseMg: 80
  },
  SIMVASTATIN: {
    id: 'SIMVASTATIN',
    name: 'Zocor',
    genericName: 'Simvastatin',
    atcCode: 'C10AA01',
    therapeuticClass: 'Lipid Modifying Agents',
    subClass: 'HMG-CoA Reductase Inhibitors',
    cypMetabolism: ['CYP3A4'],
    cypInhibition: [],
    cypInduction: [],
    blackBoxWarning: 'Myopathy and rhabdomyolysis risk with CYP3A4 inhibitors.',
    renalAdjustmentThresholdCrCl: 30,
    pregnancyCategory: 'X',
    maxDailyDoseMg: 40
  },
  AMIODARONE: {
    id: 'AMIODARONE',
    name: 'Cordarone',
    genericName: 'Amiodarone Hydrochloride',
    atcCode: 'C01BD01',
    therapeuticClass: 'Cardiac Therapy',
    subClass: 'Antiarrhythmics, Class III',
    cypMetabolism: ['CYP3A4', 'CYP2C8'],
    cypInhibition: ['CYP3A4', 'CYP2C9', 'CYP2D6', 'P-gp'],
    cypInduction: [],
    blackBoxWarning: 'Pulmonary toxicity, hepatotoxicity, and proarrhythmic effects.',
    pregnancyCategory: 'D',
    maxDailyDoseMg: 1200
  },
  DIGOXIN: {
    id: 'DIGOXIN',
    name: 'Lanoxin',
    genericName: 'Digoxin',
    atcCode: 'C01AA05',
    therapeuticClass: 'Cardiac Therapy',
    subClass: 'Digitalis Glycosides',
    cypMetabolism: [],
    cypInhibition: [],
    cypInduction: [],
    renalAdjustmentThresholdCrCl: 50,
    pregnancyCategory: 'C',
    maxDailyDoseMg: 0.25
  },
  CIPROFLOXACIN: {
    id: 'CIPROFLOXACIN',
    name: 'Cipro',
    genericName: 'Ciprofloxacin Hydrochloride',
    atcCode: 'J01MA02',
    therapeuticClass: 'Antibacterials for Systemic Use',
    subClass: 'Fluoroquinolones',
    cypMetabolism: [],
    cypInhibition: ['CYP1A2'],
    cypInduction: [],
    blackBoxWarning: 'Tendinitis, tendon rupture, peripheral neuropathy, and CNS effects.',
    renalAdjustmentThresholdCrCl: 50,
    pregnancyCategory: 'C',
    maxDailyDoseMg: 1500
  },
  THEOPHYLLINE: {
    id: 'THEOPHYLLINE',
    name: 'Theo-24',
    genericName: 'Theophylline Anhydrous',
    atcCode: 'R03DA04',
    therapeuticClass: 'Drugs for Obstructive Airway Diseases',
    subClass: 'Xanthines',
    cypMetabolism: ['CYP1A2', 'CYP2E1', 'CYP3A4'],
    cypInhibition: [],
    cypInduction: [],
    pregnancyCategory: 'C',
    maxDailyDoseMg: 800
  },
  METFORMIN: {
    id: 'METFORMIN',
    name: 'Glucophage',
    genericName: 'Metformin Hydrochloride',
    atcCode: 'A10BA02',
    therapeuticClass: 'Drugs Used in Diabetes',
    subClass: 'Biguanides',
    cypMetabolism: [],
    cypInhibition: [],
    cypInduction: [],
    blackBoxWarning: 'Lactic acidosis risk especially with renal impairment, contrast dyes, or sepsis.',
    renalAdjustmentThresholdCrCl: 45,
    pregnancyCategory: 'B',
    maxDailyDoseMg: 2550
  },
  LISINOPRIL: {
    id: 'LISINOPRIL',
    name: 'Zestril',
    genericName: 'Lisinopril',
    atcCode: 'C09AA03',
    therapeuticClass: 'Agents Acting on the Renin-Angiotensin System',
    subClass: 'ACE Inhibitors',
    cypMetabolism: [],
    cypInhibition: [],
    cypInduction: [],
    blackBoxWarning: 'Fetal toxicity; discontinue immediately if pregnancy detected.',
    renalAdjustmentThresholdCrCl: 30,
    pregnancyCategory: 'D',
    maxDailyDoseMg: 80
  },
  SPIRONOLACTONE: {
    id: 'SPIRONOLACTONE',
    name: 'Aldactone',
    genericName: 'Spironolactone',
    atcCode: 'C03DA01',
    therapeuticClass: 'Diuretics',
    subClass: 'Aldosterone Antagonists',
    cypMetabolism: ['CYP3A4'],
    cypInhibition: [],
    cypInduction: [],
    renalAdjustmentThresholdCrCl: 30,
    pregnancyCategory: 'C',
    maxDailyDoseMg: 200
  },
  VANCOMYCIN: {
    id: 'VANCOMYCIN',
    name: 'Vancocin',
    genericName: 'Vancomycin Hydrochloride',
    atcCode: 'J01XA01',
    therapeuticClass: 'Antibacterials for Systemic Use',
    subClass: 'Glycopeptide Antibacterials',
    cypMetabolism: [],
    cypInhibition: [],
    cypInduction: [],
    renalAdjustmentThresholdCrCl: 50,
    pregnancyCategory: 'C',
    maxDailyDoseMg: 4000
  },
  GENTAMICIN: {
    id: 'GENTAMICIN',
    name: 'Garamycin',
    genericName: 'Gentamicin Sulfate',
    atcCode: 'J01GB03',
    therapeuticClass: 'Antibacterials for Systemic Use',
    subClass: 'Aminoglycosides',
    cypMetabolism: [],
    cypInhibition: [],
    cypInduction: [],
    blackBoxWarning: 'Nephrotoxicity, neurotoxicity, and irreversible ototoxicity.',
    renalAdjustmentThresholdCrCl: 50,
    pregnancyCategory: 'D',
    maxDailyDoseMg: 500
  }
};

export const CLINICAL_INTERACTION_RULES: DrugInteraction[] = [
  {
    drugA: 'WARFARIN',
    drugB: 'AMIODARONE',
    severity: 'Major',
    mechanism: 'Amiodarone inhibits CYP2C9 and CYP3A4, dramatically impairing warfarin metabolism.',
    clinicalManagement: 'Reduce baseline warfarin dose by 30% to 50% upon starting amiodarone. Monitor INR every 2 to 3 days.'
  },
  {
    drugA: 'WARFARIN',
    drugB: 'ASPIRIN',
    severity: 'Major',
    mechanism: 'Synergistic bleeding risk via concurrent platelet inhibition and factor synthesis depression.',
    clinicalManagement: 'Avoid combination unless indicated for acute coronary stenting. Co-prescribe gastroprotection (PPI).'
  },
  {
    drugA: 'CLOPIDOGREL',
    drugB: 'OMEPRAZOLE',
    severity: 'Major',
    mechanism: 'Omeprazole competitively inhibits CYP2C19, preventing metabolic activation of clopidogrel prodrug.',
    clinicalManagement: 'Substitute omeprazole with pantoprazole or famotidine, which exert significantly weaker CYP2C19 inhibition.'
  },
  {
    drugA: 'SIMVASTATIN',
    drugB: 'AMIODARONE',
    severity: 'Major',
    mechanism: 'Amiodarone CYP3A4 inhibition elevates simvastatin AUC up to 2-fold, precipitating rhabdomyolysis.',
    clinicalManagement: 'Do not exceed simvastatin 20mg daily in patients taking amiodarone, or switch to rosuvastatin.'
  },
  {
    drugA: 'DIGOXIN',
    drugB: 'AMIODARONE',
    severity: 'Major',
    mechanism: 'Amiodarone inhibits P-glycoprotein renal and non-renal efflux, increasing digoxin plasma concentration by 70-100%.',
    clinicalManagement: 'Reduce digoxin dose by 50% and monitor serum levels and ECG for heart block.'
  },
  {
    drugA: 'CIPROFLOXACIN',
    drugB: 'THEOPHYLLINE',
    severity: 'Contraindicated',
    mechanism: 'Ciprofloxacin potent CYP1A2 inhibition elevates theophylline levels up to 300%, risking fatal seizures and arrhythmias.',
    clinicalManagement: 'Do not co-administer. Select alternative antimicrobial or monitor theophylline levels twice daily.'
  },
  {
    drugA: 'LISINOPRIL',
    drugB: 'SPIRONOLACTONE',
    severity: 'Moderate',
    mechanism: 'Dual blockade of renin-angiotensin-aldosterone axis causes severe hyperkalemia.',
    clinicalManagement: 'Monitor serum potassium and renal function within 1 week of combination. Hold if K+ > 5.5 mEq/L.'
  },
  {
    drugA: 'VANCOMYCIN',
    drugB: 'GENTAMICIN',
    severity: 'Major',
    mechanism: 'Synergistic nephrotoxicity and ototoxicity from combined proximal tubule accumulation.',
    clinicalManagement: 'Obtain daily trough levels. Target vancomycin AUC/MIC 400-600. Avoid prolonged co-therapy > 48h.'
  }
];

export interface InteractionAlert {
  drugA: string;
  drugB: string;
  severity: 'Contraindicated' | 'Major' | 'Moderate' | 'Minor';
  mechanism: string;
  clinicalManagement: string;
}

/**
 * Checks a list of medication names or IDs for adverse interactions
 */
export function screenPrescriptionInteractions(medicationNamesOrIds: string[]): InteractionAlert[] {
  const normalized = medicationNamesOrIds.map((m) => m.toUpperCase().trim());
  const alerts: InteractionAlert[] = [];

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const medA = normalized[i];
      const medB = normalized[j];

      // Direct ID or substring match against rules
      const match = CLINICAL_INTERACTION_RULES.find(
        (rule) =>
          (medA.includes(rule.drugA) && medB.includes(rule.drugB)) ||
          (medA.includes(rule.drugB) && medB.includes(rule.drugA))
      );

      if (match) {
        alerts.push({
          drugA: medA,
          drugB: medB,
          severity: match.severity,
          mechanism: match.mechanism,
          clinicalManagement: match.clinicalManagement
        });
      }
    }
  }

  return alerts;
}
