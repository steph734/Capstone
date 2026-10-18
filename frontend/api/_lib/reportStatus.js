// The ONE place that decides a patient's progress status. Used by the Patient Progress report, the Individual Patient
// report and the front end (which only displays the result and the "why").
//   Critical        = progress < 35%  OR  dropped 5+ points vs the previous period  OR  2 missed sessions in a row
//   Needs attention = no completed session for 3 weeks  OR  no next session booked  OR  home exercises under 50% done
//   On track        = everything else
export const STATUS = { CRITICAL: 'Critical', ATTENTION: 'Needs Attention', OK: 'On Track' }

// input: { progress (0-100|null), change (points|null), missedInARow, daysSinceLastSession (null = never), hasNextSession, exercisePct (0-100|null) }
export function patientStatus({ progress, change, missedInARow = 0, daysSinceLastSession = null, hasNextSession = true, exercisePct = null }) {
  const critical = []
  if (progress != null && progress < 35) critical.push(`Progress ${progress}% (under 35%)`)
  if (change != null && change <= -5) critical.push(`Progress down ${Math.abs(change)} pts`)
  if (missedInARow >= 2) critical.push(`Missed ${missedInARow} sessions in a row`)
  if (critical.length) return { status: STATUS.CRITICAL, why: critical.join(' · ') }

  const attention = []
  if (daysSinceLastSession != null && daysSinceLastSession >= 21) attention.push(`No session for ${Math.floor(daysSinceLastSession / 7)} weeks`)
  if (!hasNextSession) attention.push('No next session booked')
  if (exercisePct != null && exercisePct < 50) attention.push(`Home exercises ${exercisePct}% done`)
  if (attention.length) return { status: STATUS.ATTENTION, why: attention.join(' · ') }

  return { status: STATUS.OK, why: 'Attending and progressing as expected' }
}
