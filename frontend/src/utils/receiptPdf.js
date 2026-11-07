// Downloadable receipt for a successful online payment (a simple PDF made in the browser with jsPDF).
// Times are shown in Philippine time (Asia/Manila).
const peso = (n) => `PHP ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const manilaDateTime = (d) => new Date(d || Date.now()).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export async function downloadReceipt({ referenceNo, amount, methodLabel, paidAt, sessionLabel, therapist, patient }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  let y = 18
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('TherapyPro', 14, y)
  y += 7; doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.text('Payment receipt', 14, y)
  y += 10
  const row = (label, value) => {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(110); doc.text(label, 14, y)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(20); doc.text(String(value || '-'), 60, y, { maxWidth: 76 })
    y += 8
  }
  row('Reference no.', referenceNo)
  row('Amount paid', peso(amount))
  row('Payment method', methodLabel)
  row('Date', `${manilaDateTime(paidAt)} (Manila)`)
  if (patient) row('Patient', patient)
  row('Session', sessionLabel)
  row('Therapist', therapist)
  y += 4
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120)
  doc.text('Thank you. Keep this receipt for your records.', 14, y)
  doc.save(`TherapyPro-receipt-${referenceNo || 'payment'}.pdf`)
}
