const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('clinixos.sqlite');

db.serialize(() => {
  db.run("UPDATE beds SET status = 'Occupied', current_patient_id = 2, check_in_time = datetime('now', '-3 hours') WHERE id = 2");
  db.run("UPDATE beds SET status = 'Occupied', current_patient_id = 3, check_in_time = datetime('now', '-1 hour') WHERE id = 11");
  db.run("UPDATE beds SET status = 'Occupied', current_patient_id = 1, check_in_time = datetime('now', '-5 hours') WHERE id = 8");
  console.log('[ClinixOS DB] 3 Beds set to Occupied with live patient admissions.');
});

db.close();
