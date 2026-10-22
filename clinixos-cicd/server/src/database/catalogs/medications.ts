export interface MedicationCatalogItem {
  barcode: string;
  name: string;
  generic_name: string;
  category: 'Antibiotic' | 'Analgesic' | 'Cardiovascular' | 'Antidiabetic' | 'Antihistamine' | 'Respiratory' | 'Gastrointestinal' | 'Emergency / Critical';
  dosage_form: 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'Inhaler' | 'IV Infusion';
  strength: string;
  stock_count: number;
  min_threshold: number;
  unit_price: number;
}

export const PHARMACY_MEDICATIONS_CATALOG: MedicationCatalogItem[] = [
  // Analgesics & Anti-inflammatory
  { barcode: '890103001001', name: 'Paracetamol 500mg', generic_name: 'Acetaminophen', category: 'Analgesic', dosage_form: 'Tablet', strength: '500 mg', stock_count: 42, min_threshold: 50, unit_price: 3.50 },
  { barcode: '890103001002', name: 'Paracetamol IV 1000mg', generic_name: 'Acetaminophen', category: 'Analgesic', dosage_form: 'IV Infusion', strength: '10 mg/ml', stock_count: 18, min_threshold: 25, unit_price: 45.00 },
  { barcode: '890103001003', name: 'Ibuprofen 400mg', generic_name: 'Ibuprofen', category: 'Analgesic', dosage_form: 'Tablet', strength: '400 mg', stock_count: 120, min_threshold: 40, unit_price: 6.00 },
  { barcode: '890103001004', name: 'Tramadol HCl 50mg', generic_name: 'Tramadol Hydrochloride', category: 'Analgesic', dosage_form: 'Capsule', strength: '50 mg', stock_count: 35, min_threshold: 30, unit_price: 18.50 },
  { barcode: '890103001005', name: 'Diclofenac Sodium 50mg', generic_name: 'Diclofenac', category: 'Analgesic', dosage_form: 'Tablet', strength: '50 mg', stock_count: 85, min_threshold: 30, unit_price: 8.00 },
  { barcode: '890103001006', name: 'Morphine Sulfate 10mg/ml', generic_name: 'Morphine', category: 'Emergency / Critical', dosage_form: 'Injection', strength: '10 mg/ml', stock_count: 14, min_threshold: 20, unit_price: 85.00 },

  // Antibiotics & Anti-infectives
  { barcode: '890103002001', name: 'Amoxicillin + Clavulanate 625mg', generic_name: 'Amoxicillin / Clavulanic Acid', category: 'Antibiotic', dosage_form: 'Tablet', strength: '625 mg', stock_count: 75, min_threshold: 40, unit_price: 24.00 },
  { barcode: '890103002002', name: 'Azithromycin 500mg', generic_name: 'Azithromycin', category: 'Antibiotic', dosage_form: 'Tablet', strength: '500 mg', stock_count: 60, min_threshold: 30, unit_price: 32.00 },
  { barcode: '890103002003', name: 'Ceftriaxone 1g Injection', generic_name: 'Ceftriaxone Sodium', category: 'Antibiotic', dosage_form: 'Injection', strength: '1 g', stock_count: 22, min_threshold: 30, unit_price: 75.00 },
  { barcode: '890103002004', name: 'Ciprofloxacin 500mg', generic_name: 'Ciprofloxacin HCl', category: 'Antibiotic', dosage_form: 'Tablet', strength: '500 mg', stock_count: 90, min_threshold: 35, unit_price: 15.00 },
  { barcode: '890103002005', name: 'Metronidazole 400mg', generic_name: 'Metronidazole', category: 'Antibiotic', dosage_form: 'Tablet', strength: '400 mg', stock_count: 110, min_threshold: 40, unit_price: 5.50 },
  { barcode: '890103002006', name: 'Vancomycin 500mg IV', generic_name: 'Vancomycin Hydrochloride', category: 'Emergency / Critical', dosage_form: 'Injection', strength: '500 mg', stock_count: 12, min_threshold: 15, unit_price: 180.00 },

  // Cardiovascular & Antihypertensive
  { barcode: '890103003001', name: 'Amlodipine 5mg', generic_name: 'Amlodipine Besylate', category: 'Cardiovascular', dosage_form: 'Tablet', strength: '5 mg', stock_count: 140, min_threshold: 50, unit_price: 4.50 },
  { barcode: '890103003002', name: 'Telmisartan 40mg', generic_name: 'Telmisartan', category: 'Cardiovascular', dosage_form: 'Tablet', strength: '40 mg', stock_count: 80, min_threshold: 40, unit_price: 11.00 },
  { barcode: '890103003003', name: 'Metoprolol Succinate 25mg', generic_name: 'Metoprolol Succinate', category: 'Cardiovascular', dosage_form: 'Tablet', strength: '25 mg', stock_count: 95, min_threshold: 35, unit_price: 14.00 },
  { barcode: '890103003004', name: 'Atorvastatin 20mg', generic_name: 'Atorvastatin Calcium', category: 'Cardiovascular', dosage_form: 'Tablet', strength: '20 mg', stock_count: 115, min_threshold: 40, unit_price: 16.50 },
  { barcode: '890103003005', name: 'Aspirin Gastro-resistant 75mg', generic_name: 'Acetylsalicylic Acid', category: 'Cardiovascular', dosage_form: 'Tablet', strength: '75 mg', stock_count: 160, min_threshold: 50, unit_price: 3.00 },
  { barcode: '890103003006', name: 'Clopidogrel 75mg', generic_name: 'Clopidogrel Bisulfate', category: 'Cardiovascular', dosage_form: 'Tablet', strength: '75 mg', stock_count: 65, min_threshold: 30, unit_price: 22.00 },
  { barcode: '890103003007', name: 'Furosemide 40mg', generic_name: 'Furosemide', category: 'Cardiovascular', dosage_form: 'Tablet', strength: '40 mg', stock_count: 70, min_threshold: 30, unit_price: 4.00 },

  // Antidiabetic & Endocrine
  { barcode: '890103004001', name: 'Metformin 500mg SR', generic_name: 'Metformin Hydrochloride', category: 'Antidiabetic', dosage_form: 'Tablet', strength: '500 mg', stock_count: 180, min_threshold: 60, unit_price: 5.00 },
  { barcode: '890103004002', name: 'Glimepiride 2mg', generic_name: 'Glimepiride', category: 'Antidiabetic', dosage_form: 'Tablet', strength: '2 mg', stock_count: 85, min_threshold: 35, unit_price: 8.50 },
  { barcode: '890103004003', name: 'Insulin Human Regular 100IU/ml', generic_name: 'Regular Human Insulin', category: 'Emergency / Critical', dosage_form: 'Injection', strength: '100 IU/ml', stock_count: 28, min_threshold: 30, unit_price: 145.00 },
  { barcode: '890103004004', name: 'Thyroxine Sodium 50mcg', generic_name: 'Levothyroxine', category: 'Antidiabetic', dosage_form: 'Tablet', strength: '50 mcg', stock_count: 130, min_threshold: 40, unit_price: 4.00 },

  // Gastrointestinal
  { barcode: '890103005001', name: 'Pantoprazole 40mg', generic_name: 'Pantoprazole Sodium', category: 'Gastrointestinal', dosage_form: 'Tablet', strength: '40 mg', stock_count: 150, min_threshold: 50, unit_price: 9.50 },
  { barcode: '890103005002', name: 'Pantoprazole 40mg IV', generic_name: 'Pantoprazole Sodium', category: 'Gastrointestinal', dosage_form: 'Injection', strength: '40 mg', stock_count: 32, min_threshold: 30, unit_price: 42.00 },
  { barcode: '890103005003', name: 'Ondansetron 4mg', generic_name: 'Ondansetron Hydrochloride', category: 'Gastrointestinal', dosage_form: 'Tablet', strength: '4 mg', stock_count: 95, min_threshold: 30, unit_price: 7.00 },
  { barcode: '890103005004', name: 'Sucralfate Suspension 100ml', generic_name: 'Sucralfate', category: 'Gastrointestinal', dosage_form: 'Syrup', strength: '1000 mg/10ml', stock_count: 45, min_threshold: 20, unit_price: 68.00 },

  // Respiratory & Antiallergic
  { barcode: '890103006001', name: 'Salbutamol Inhaler 100mcg', generic_name: 'Albuterol Sulfate', category: 'Respiratory', dosage_form: 'Inhaler', strength: '100 mcg/puff', stock_count: 24, min_threshold: 25, unit_price: 120.00 },
  { barcode: '890103006002', name: 'Budesonide Respules 0.5mg', generic_name: 'Budesonide', category: 'Respiratory', dosage_form: 'Inhaler', strength: '0.5 mg/2ml', stock_count: 40, min_threshold: 30, unit_price: 35.00 },
  { barcode: '890103006003', name: 'Levocetirizine 5mg', generic_name: 'Levocetirizine Dihydrochloride', category: 'Antihistamine', dosage_form: 'Tablet', strength: '5 mg', stock_count: 130, min_threshold: 40, unit_price: 6.00 },
  { barcode: '890103006004', name: 'Montelukast 10mg', generic_name: 'Montelukast Sodium', category: 'Respiratory', dosage_form: 'Tablet', strength: '10 mg', stock_count: 75, min_threshold: 30, unit_price: 18.00 },

  // Emergency & Critical Care Fluids
  { barcode: '890103007001', name: 'Adrenaline Injection 1:1000', generic_name: 'Epinephrine', category: 'Emergency / Critical', dosage_form: 'Injection', strength: '1 mg/ml', stock_count: 15, min_threshold: 20, unit_price: 35.00 },
  { barcode: '890103007002', name: 'Atropine Sulfate 0.6mg/ml', generic_name: 'Atropine', category: 'Emergency / Critical', dosage_form: 'Injection', strength: '0.6 mg/ml', stock_count: 18, min_threshold: 20, unit_price: 25.00 },
  { barcode: '890103007003', name: 'Normal Saline 0.9% 500ml', generic_name: 'Sodium Chloride IV', category: 'Emergency / Critical', dosage_form: 'IV Infusion', strength: '0.9% w/v', stock_count: 160, min_threshold: 60, unit_price: 38.00 },
  { barcode: '890103007004', name: 'Ringer Lactate 500ml', generic_name: 'Hartmann Solution', category: 'Emergency / Critical', dosage_form: 'IV Infusion', strength: '500 ml', stock_count: 120, min_threshold: 50, unit_price: 42.00 }
];
