export interface ICD10Entry {
  code: string;
  category: string;
  description: string;
  severity: 'Mild' | 'Moderate' | 'Critical' | 'Severe';
}

export const ICD10_CATALOG: ICD10Entry[] = [
  // Infectious & Parasitic Diseases
  { code: 'A00.0', category: 'Infectious', description: 'Cholera due to Vibrio cholerae 01, biovar cholerae', severity: 'Critical' },
  { code: 'A01.0', category: 'Infectious', description: 'Typhoid fever, unspecified', severity: 'Severe' },
  { code: 'A02.0', category: 'Infectious', description: 'Salmonella enteritis', severity: 'Moderate' },
  { code: 'A04.7', category: 'Infectious', description: 'Enterocolitis due to Clostridium difficile', severity: 'Severe' },
  { code: 'A08.4', category: 'Infectious', description: 'Viral intestinal infection, unspecified', severity: 'Mild' },
  { code: 'A09.0', category: 'Infectious', description: 'Other and unspecified gastroenteritis and colitis of infectious origin', severity: 'Moderate' },
  { code: 'A15.0', category: 'Infectious', description: 'Tuberculosis of lung, confirmed by sputum microscopy with or without culture', severity: 'Critical' },
  { code: 'A38.9', category: 'Infectious', description: 'Scarlet fever, uncomplicated', severity: 'Moderate' },
  { code: 'A41.9', category: 'Infectious', description: 'Sepsis, unspecified organism', severity: 'Critical' },
  { code: 'A49.0', category: 'Infectious', description: 'Staphylococcal infection, unspecified site', severity: 'Moderate' },
  { code: 'B00.9', category: 'Infectious', description: 'Herpesviral infection, unspecified', severity: 'Mild' },
  { code: 'B01.9', category: 'Infectious', description: 'Varicella without complication', severity: 'Mild' },
  { code: 'B02.9', category: 'Infectious', description: 'Zoster without complications', severity: 'Moderate' },
  { code: 'B18.2', category: 'Infectious', description: 'Chronic viral hepatitis C', severity: 'Severe' },
  { code: 'B20.0', category: 'Infectious', description: 'Human immunodeficiency virus [HIV] disease resulting in infectious diseases', severity: 'Critical' },
  { code: 'B34.2', category: 'Infectious', description: 'Coronavirus infection, unspecified site', severity: 'Moderate' },
  { code: 'B34.9', category: 'Infectious', description: 'Viral infection, unspecified', severity: 'Mild' },
  { code: 'B37.0', category: 'Infectious', description: 'Candidal stomatitis', severity: 'Mild' },
  { code: 'B50.9', category: 'Infectious', description: 'Plasmodium falciparum malaria, unspecified', severity: 'Critical' },

  // Endocrine, Nutritional & Metabolic Diseases
  { code: 'E03.9', category: 'Endocrine', description: 'Hypothyroidism, unspecified', severity: 'Mild' },
  { code: 'E05.90', category: 'Endocrine', description: 'Thyrotoxicosis without thyrotoxic crisis or storm', severity: 'Moderate' },
  { code: 'E10.9', category: 'Endocrine', description: 'Type 1 diabetes mellitus without complications', severity: 'Moderate' },
  { code: 'E10.65', category: 'Endocrine', description: 'Type 1 diabetes mellitus with hyperglycemia', severity: 'Severe' },
  { code: 'E11.65', category: 'Endocrine', description: 'Type 2 diabetes mellitus with hyperglycemia', severity: 'Severe' },
  { code: 'E11.9', category: 'Endocrine', description: 'Type 2 diabetes mellitus without complications', severity: 'Mild' },
  { code: 'E11.21', category: 'Endocrine', description: 'Type 2 diabetes mellitus with diabetic nephropathy', severity: 'Severe' },
  { code: 'E11.319', category: 'Endocrine', description: 'Type 2 diabetes mellitus with unspecified diabetic retinopathy', severity: 'Moderate' },
  { code: 'E66.01', category: 'Endocrine', description: 'Morbid (severe) obesity due to excess calories', severity: 'Moderate' },
  { code: 'E78.5', category: 'Endocrine', description: 'Hyperlipidemia, unspecified', severity: 'Mild' },
  { code: 'E86.0', category: 'Endocrine', description: 'Dehydration', severity: 'Moderate' },
  { code: 'E87.1', category: 'Endocrine', description: 'Hypo-osmolality and hyponatremia', severity: 'Severe' },
  { code: 'E87.6', category: 'Endocrine', description: 'Hypokalemia', severity: 'Severe' },

  // Circulatory & Cardiovascular Diseases
  { code: 'I10', category: 'Cardiovascular', description: 'Essential (primary) hypertension', severity: 'Moderate' },
  { code: 'I11.0', category: 'Cardiovascular', description: 'Hypertensive heart disease with heart failure', severity: 'Critical' },
  { code: 'I20.0', category: 'Cardiovascular', description: 'Unstable angina', severity: 'Critical' },
  { code: 'I20.9', category: 'Cardiovascular', description: 'Angina pectoris, unspecified', severity: 'Moderate' },
  { code: 'I21.0', category: 'Cardiovascular', description: 'ST elevation (STEMI) myocardial infarction of anterior wall', severity: 'Critical' },
  { code: 'I21.4', category: 'Cardiovascular', description: 'Non-ST elevation (NSTEMI) myocardial infarction', severity: 'Critical' },
  { code: 'I25.10', category: 'Cardiovascular', description: 'Atherosclerotic heart disease of native coronary artery', severity: 'Severe' },
  { code: 'I42.0', category: 'Cardiovascular', description: 'Dilated cardiomyopathy', severity: 'Severe' },
  { code: 'I47.1', category: 'Cardiovascular', description: 'Supraventricular tachycardia', severity: 'Severe' },
  { code: 'I48.0', category: 'Cardiovascular', description: 'Paroxysmal atrial fibrillation', severity: 'Severe' },
  { code: 'I48.91', category: 'Cardiovascular', description: 'Unspecified atrial fibrillation', severity: 'Moderate' },
  { code: 'I50.9', category: 'Cardiovascular', description: 'Heart failure, unspecified', severity: 'Critical' },
  { code: 'I63.9', category: 'Cardiovascular', description: 'Cerebral infarction, unspecified (Ischemic stroke)', severity: 'Critical' },
  { code: 'I73.9', category: 'Cardiovascular', description: 'Peripheral vascular disease, unspecified', severity: 'Moderate' },
  { code: 'I80.209', category: 'Cardiovascular', description: 'Deep vein thrombosis (DVT) of unspecified deep vessels', severity: 'Critical' },

  // Respiratory System Diseases
  { code: 'J00', category: 'Respiratory', description: 'Acute nasopharyngitis [common cold]', severity: 'Mild' },
  { code: 'J01.90', category: 'Respiratory', description: 'Acute sinusitis, unspecified', severity: 'Mild' },
  { code: 'J02.9', category: 'Respiratory', description: 'Acute pharyngitis, unspecified', severity: 'Mild' },
  { code: 'J03.90', category: 'Respiratory', description: 'Acute tonsillitis, unspecified', severity: 'Moderate' },
  { code: 'J06.9', category: 'Respiratory', description: 'Acute upper respiratory infection, unspecified', severity: 'Mild' },
  { code: 'J12.9', category: 'Respiratory', description: 'Viral pneumonia, unspecified', severity: 'Severe' },
  { code: 'J15.9', category: 'Respiratory', description: 'Unspecified bacterial pneumonia', severity: 'Severe' },
  { code: 'J18.9', category: 'Respiratory', description: 'Pneumonia, unspecified organism', severity: 'Severe' },
  { code: 'J20.9', category: 'Respiratory', description: 'Acute bronchitis, unspecified', severity: 'Moderate' },
  { code: 'J44.1', category: 'Respiratory', description: 'Chronic obstructive pulmonary disease with acute exacerbation', severity: 'Critical' },
  { code: 'J44.9', category: 'Respiratory', description: 'Chronic obstructive pulmonary disease, unspecified', severity: 'Moderate' },
  { code: 'J45.20', category: 'Respiratory', description: 'Mild intermittent asthma, uncomplicated', severity: 'Mild' },
  { code: 'J45.41', category: 'Respiratory', description: 'Moderate persistent asthma with acute exacerbation', severity: 'Severe' },
  { code: 'J45.901', category: 'Respiratory', description: 'Unspecified asthma with (acute) exacerbation', severity: 'Severe' },
  { code: 'J80', category: 'Respiratory', description: 'Acute respiratory distress syndrome (ARDS)', severity: 'Critical' },
  { code: 'J96.00', category: 'Respiratory', description: 'Acute respiratory failure, unspecified whether hypoxia or hypercapnia', severity: 'Critical' },

  // Digestive System Diseases
  { code: 'K21.9', category: 'Gastroenterology', description: 'Gastro-esophageal reflux disease without esophagitis', severity: 'Mild' },
  { code: 'K25.9', category: 'Gastroenterology', description: 'Gastric ulcer, unspecified as acute or chronic', severity: 'Moderate' },
  { code: 'K27.9', category: 'Gastroenterology', description: 'Peptic ulcer, site unspecified', severity: 'Moderate' },
  { code: 'K29.70', category: 'Gastroenterology', description: 'Gastritis, unspecified, without bleeding', severity: 'Mild' },
  { code: 'K35.80', category: 'Gastroenterology', description: 'Unspecified acute appendicitis', severity: 'Critical' },
  { code: 'K40.90', category: 'Gastroenterology', description: 'Unilateral inguinal hernia, without obstruction or gangrene', severity: 'Moderate' },
  { code: 'K52.9', category: 'Gastroenterology', description: 'Noninfective gastroenteritis and colitis, unspecified', severity: 'Moderate' },
  { code: 'K57.92', category: 'Gastroenterology', description: 'Diverticulitis of intestine without perforation or abscess', severity: 'Severe' },
  { code: 'K70.30', category: 'Gastroenterology', description: 'Alcoholic cirrhosis of liver without ascites', severity: 'Severe' },
  { code: 'K80.20', category: 'Gastroenterology', description: 'Calculus of gallbladder without cholecystitis', severity: 'Moderate' },
  { code: 'K85.90', category: 'Gastroenterology', description: 'Acute pancreatitis without necrosis or infection', severity: 'Critical' },

  // Musculoskeletal & Orthopedic
  { code: 'M16.9', category: 'Orthopedics', description: 'Osteoarthritis of hip, unspecified', severity: 'Moderate' },
  { code: 'M17.9', category: 'Orthopedics', description: 'Osteoarthritis of knee, unspecified', severity: 'Moderate' },
  { code: 'M25.50', category: 'Orthopedics', description: 'Pain in unspecified joint', severity: 'Mild' },
  { code: 'M54.2', category: 'Orthopedics', description: 'Cervicalgia (Neck pain)', severity: 'Mild' },
  { code: 'M54.50', category: 'Orthopedics', description: 'Low back pain, unspecified', severity: 'Mild' },
  { code: 'M79.3', category: 'Orthopedics', description: 'Panniculitis, unspecified', severity: 'Mild' },
  { code: 'S06.0X0A', category: 'Orthopedics', description: 'Concussion without loss of consciousness, initial encounter', severity: 'Moderate' },
  { code: 'S52.501A', category: 'Orthopedics', description: 'Fracture of lower end of right radius, initial encounter', severity: 'Severe' },
  { code: 'S82.201A', category: 'Orthopedics', description: 'Fracture of shaft of right tibia, initial encounter', severity: 'Severe' },

  // Nervous System Diseases
  { code: 'G40.909', category: 'Neurology', description: 'Epilepsy, unspecified, not intractable', severity: 'Severe' },
  { code: 'G43.909', category: 'Neurology', description: 'Migraine, unspecified, not intractable, without status migrainosus', severity: 'Moderate' },
  { code: 'G44.209', category: 'Neurology', description: 'Tension-type headache, unspecified', severity: 'Mild' },
  { code: 'G47.00', category: 'Neurology', description: 'Insomnia, unspecified', severity: 'Mild' },
  { code: 'G20', category: 'Neurology', description: 'Parkinsons disease', severity: 'Severe' },
  { code: 'G30.9', category: 'Neurology', description: 'Alzheimers disease, unspecified', severity: 'Severe' },

  // Renal & Genitourinary
  { code: 'N17.9', category: 'Nephrology', description: 'Acute kidney failure, unspecified', severity: 'Critical' },
  { code: 'N18.3', category: 'Nephrology', description: 'Chronic kidney disease, stage 3 (moderate)', severity: 'Severe' },
  { code: 'N18.6', category: 'Nephrology', description: 'End stage renal disease', severity: 'Critical' },
  { code: 'N20.0', category: 'Nephrology', description: 'Calculus of kidney (Kidney stones)', severity: 'Severe' },
  { code: 'N39.0', category: 'Nephrology', description: 'Urinary tract infection, site not specified', severity: 'Moderate' },
  { code: 'N40.0', category: 'Nephrology', description: 'Benign prostatic hyperplasia without lower urinary tract symptoms', severity: 'Mild' }
];
