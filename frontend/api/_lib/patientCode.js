// The short, human-friendly patient ID shown in the app ("P-6E31DA").
// It is NOT stored: it is derived from the patient's unique `_id` (its last 6 characters),
// so `patients` needs no separate PatientID / patient_code field.
export const patientCodeOf = (id) => `P-${String(id).slice(-6).toUpperCase()}`
