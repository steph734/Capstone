// Small, dependency-free random data generator shared by the seeders — no
// faker package, just enough plausible Filipino-context values to make demo
// records readable instead of "Test Test 1", "Test Test 2", ...

const CHILD_FIRST_NAMES = [
  'Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Carmen', 'Luis', 'Sofia', 'Miguel', 'Isabel',
  'Gabriel', 'Andrea', 'Rafael', 'Camille', 'Daniel', 'Bea', 'Marco', 'Nadine', 'Diego', 'Kyla',
  'Enzo', 'Trisha', 'Iñigo', 'Faith', 'Mateo', 'Grace', 'Leon', 'Hannah', 'Nathan', 'Alexa',
  'Elijah', 'Zoe', 'Adrian', 'Mika', 'Vincent', 'Julia', 'Sean', 'Reign', 'Aldrich', 'Chloe',
]
const LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Ramos', 'Villanueva',
  'Castillo', 'Aquino', 'Del Rosario', 'Gonzales', 'Pascual', 'Santiago', 'Domingo', 'Fernandez', 'Rivera', 'Navarro',
]
const GUARDIAN_FIRST_NAMES = [
  'Maria', 'Josefina', 'Ricardo', 'Teresita', 'Antonio', 'Rosario', 'Eduardo', 'Corazon', 'Ramon', 'Leticia',
  'Fernando', 'Remedios', 'Roberto', 'Angelica', 'Benjamin', 'Divina', 'Cesar', 'Marilou', 'Arnel', 'Jocelyn',
]
const STREETS = [
  'Rizal St.', 'Bonifacio Ave.', 'Mabini St.', 'Quezon Blvd.', 'Roxas St.', 'Magsaysay Ave.',
  'Bangkal Rd.', 'Matina St.', 'Ma-a Rd.', 'Buhangin St.', 'Toril Ave.', 'Ecoland St.',
]
const CITIES = ['Davao City', 'Tagum City', 'Panabo City', 'Digos City', 'Mati City']
const CONDITIONS = [
  'Speech Delay', 'Autism Spectrum Disorder', 'ADHD', 'Down Syndrome',
  'Cerebral Palsy', 'Developmental Delay', 'Learning Disability', 'Other',
]
const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Sibling', 'Other']
const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com']

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomPhone() {
  return `09${randomInt(10, 99)} ${randomInt(100, 999)} ${randomInt(1000, 9999)}`
}

export function randomEmail(firstName, lastName) {
  const slug = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '')
  return `${slug}${randomInt(1, 999)}@${pick(EMAIL_DOMAINS)}`
}

export function randomAddress() {
  return `${randomInt(1, 999)} ${pick(STREETS)}, ${pick(CITIES)}`
}

// A plausible child's birthdate — ages 2 to 15, matching the age range this
// clinic's booking form and patient list are built around.
export function randomChildBirthdate() {
  const ageYears = randomInt(2, 15)
  const now = new Date()
  const d = new Date(now.getFullYear() - ageYears, randomInt(0, 11), randomInt(1, 28))
  return d
}

// A date within `daysBack` days before today through `daysForward` days
// after today — used for appointment session dates spanning past (completed/
// no-show/cancelled) and upcoming (pending/confirmed) bookings.
export function randomDateAround(daysBack, daysForward) {
  const now = new Date()
  const offset = randomInt(-daysBack, daysForward)
  const d = new Date(now)
  d.setDate(d.getDate() + offset)
  d.setHours(0, 0, 0, 0)
  return d
}

const SLOT_STARTS_24H = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']

function to12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const mer = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${mer}`
}
function addHour(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function randomSlot() {
  const start = pick(SLOT_STARTS_24H)
  const end = addHour(start)
  return { start, end, label: `${to12h(start)} - ${to12h(end)}` }
}

export function randomFirstName() { return pick(CHILD_FIRST_NAMES) }
export function randomLastName() { return pick(LAST_NAMES) }
export function randomGuardianFirstName() { return pick(GUARDIAN_FIRST_NAMES) }
export function randomCondition() { return pick(CONDITIONS) }
export function randomRelationship() { return pick(RELATIONSHIPS) }
export function randomGender() { return pick(['Male', 'Female', 'Other']) }
