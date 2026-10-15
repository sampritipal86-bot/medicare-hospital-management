export type ApiRole = 'Administrator' | 'Doctor' | 'Receptionist' | 'Patient'
export type ApiRow = Record<string, string>
export type HospitalData = { patients: ApiRow[]; doctors: ApiRow[]; appointments: ApiRow[]; records: ApiRow[]; invoices: ApiRow[]; departments: { id: number; name: string }[]; stats?: { total_patients: number; registered_doctors: number; todays_appointments: number; available_beds: number; department_appointments: { department: string; appointments: number }[] }; trend?: { day: string; appointments: number; patients: number }[] }
export type ManagedUser = { id: number; email: string; role: ApiRole; is_active: boolean }

const apiRoot = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '')

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiRoot}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.detail || `Request failed (${response.status}).`)
  return body as T
}

export async function apiLogin(email: string, password: string) {
  return request<{ access_token: string; role: ApiRole }>('/auth/login', '', { method: 'POST', body: JSON.stringify({ username: email, password }) })
}

export async function apiRegister(fullName: string, email: string, password: string) {
  return request<{ id: number; role: ApiRole }>('/auth/register', '', { method: 'POST', body: JSON.stringify({ full_name: fullName, email, password }) })
}

function datePart(value: string) { return value?.slice(0, 10) || '' }
function timePart(value: string) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
function dateLabel(value: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

function patientFromApi(item: Record<string, any>): ApiRow {
  return { id: item.patient_number, remoteId: String(item.id), name: item.full_name, email: item.email || '', phone: item.phone || '', dob: item.date_of_birth || '', gender: item.gender || '', department: 'General Medicine', status: item.is_active ? 'Active' : 'Inactive', joined: dateLabel(item.created_at) }
}
function doctorFromApi(item: Record<string, any>): ApiRow {
  return { id: item.doctor_number, remoteId: String(item.id), name: item.full_name, email: item.email || '', phone: item.phone || '', department: item.department, departmentId: String(item.department_id), specialty: item.specialization, fee: `$${Number(item.consultation_fee).toFixed(2)}`, availability: Array.isArray(item.availability) ? item.availability.join(', ') : '', status: item.is_active ? 'Available' : 'Inactive' }
}
function appointmentFromApi(item: Record<string, any>): ApiRow {
  return { id: `AP-${item.id}`, remoteId: String(item.id), patientId: String(item.patient_id), doctorId: String(item.doctor_id), departmentId: String(item.department_id), patient: item.patient, doctor: item.doctor, department: item.department, date: datePart(item.starts_at), time: timePart(item.starts_at), startsAt: item.starts_at, endsAt: item.ends_at, status: item.status }
}
function recordFromApi(item: Record<string, any>): ApiRow {
  return { id: `MR-${item.id}`, remoteId: String(item.id), patientId: String(item.patient_id), doctorId: String(item.doctor_id), patient: item.patient, doctor: item.doctor, type: item.visit_type, diagnosis: item.diagnosis, symptoms: item.symptoms, treatment: item.treatment_notes, followUp: item.follow_up_at || '', date: dateLabel(item.created_at) }
}
function invoiceFromApi(item: Record<string, any>): ApiRow {
  return { id: item.invoice_number, remoteId: String(item.id), patientId: String(item.patient_id), patient: item.patient, department: '', amount: `$${Number(item.amount).toFixed(2)}`, date: dateLabel(item.created_at), status: item.status }
}

export async function loadHospitalData(token: string, role: ApiRole): Promise<HospitalData> {
  const departmentsRequest = request<Record<string, any>[]>('/departments', token)
  const patientsRequest = role === 'Patient' ? Promise.resolve([]) : request<Record<string, any>[]>('/patients', token)
  const doctorsRequest = role === 'Patient' || role === 'Administrator' || role === 'Doctor' || role === 'Receptionist' ? request<Record<string, any>[]>('/doctors', token) : Promise.resolve([])
  const [departments, patients, doctors, appointments, records, invoices, stats, trend] = await Promise.all([
    departmentsRequest, patientsRequest, doctorsRequest,
    request<Record<string, any>[]>('/appointments', token),
    role === 'Receptionist' ? Promise.resolve([]) : request<Record<string, any>[]>('/medical-records', token),
    request<Record<string, any>[]>('/invoices', token),
    role === 'Patient' ? Promise.resolve(undefined) : request<HospitalData['stats']>('/dashboard/stats', token),
    role === 'Patient' ? Promise.resolve(undefined) : request<NonNullable<HospitalData['trend']>>('/dashboard/trend', token),
  ])
  return {
    departments: departments.map(({ id, name }) => ({ id, name })),
    patients: patients.map(patientFromApi), doctors: doctors.map(doctorFromApi),
    appointments: appointments.map(appointmentFromApi), records: records.map(recordFromApi), invoices: invoices.map(invoiceFromApi), stats, trend,
  }
}

function localStart(date: string, time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) throw new Error('Choose a valid appointment time.')
  let hour = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hour += 12
  return `${date}T${String(hour).padStart(2, '0')}:${match[2]}:00`
}

export async function saveRemote(kind: string, row: ApiRow, previous: ApiRow | undefined, token: string, data: HospitalData): Promise<ApiRow> {
  const method = previous?.remoteId ? 'PUT' : 'POST'
  let path = ''
  let payload: Record<string, unknown> = {}
  if (kind === 'patient') {
    path = previous?.remoteId ? `/patients/${previous.remoteId}` : '/patients'
    payload = { full_name: row.name, email: row.email || null, phone: row.phone || '', date_of_birth: row.dob || null, gender: row.gender || '', address: row.address || '', emergency_contact_name: row.emergencyName || '', emergency_contact_phone: row.emergencyPhone || '', medical_history: row.history || '' }
  } else if (kind === 'doctor') {
    path = previous?.remoteId ? `/doctors/${previous.remoteId}` : '/doctors'
    const department = data.departments.find((item) => item.name === row.department)
    if (!department) throw new Error('Choose a valid department.')
    payload = { full_name: row.name, email: row.email || null, phone: row.phone || '', department_id: department.id, specialization: row.specialty, consultation_fee: Number(row.fee.replace(/[^\d.]/g, '')), availability: (row.availability || '').split(',').map((item) => item.trim()).filter(Boolean) }
  } else if (kind === 'appointment') {
    path = previous?.remoteId ? `/appointments/${previous.remoteId}` : '/appointments'
    const patient = data.patients.find((item) => item.name === row.patient)
    const doctor = data.doctors.find((item) => item.name === row.doctor)
    const department = data.departments.find((item) => item.name === row.department)
    if (!patient?.remoteId || !doctor?.remoteId || !department) throw new Error('Choose an available patient, doctor, and department.')
    const startsAt = localStart(row.date, row.time)
    const endDate = new Date(`${startsAt}Z`)
    endDate.setMinutes(endDate.getMinutes() + 30)
    payload = { patient_id: Number(patient.remoteId), doctor_id: Number(doctor.remoteId), department_id: department.id, starts_at: startsAt, ends_at: endDate.toISOString().slice(0, 19), notes: row.notes || '' }
  } else if (kind === 'record') {
    path = previous?.remoteId ? `/medical-records/${previous.remoteId}` : '/medical-records'
    const patient = data.patients.find((item) => item.name === row.patient)
    const doctor = data.doctors.find((item) => item.name === row.doctor)
    if (!patient?.remoteId || !doctor?.remoteId) throw new Error('Choose a patient and doctor from the connected directory.')
    payload = { patient_id: Number(patient.remoteId), doctor_id: Number(doctor.remoteId), visit_type: row.type || 'Consultation', diagnosis: row.diagnosis || '', symptoms: row.symptoms || '', treatment_notes: row.treatment || '', follow_up_at: row.followUp || null }
  } else if (kind === 'invoice') {
    path = '/invoices'
    const patient = data.patients.find((item) => item.name === row.patient)
    if (!patient?.remoteId) throw new Error('Choose a patient from the connected directory.')
    payload = { patient_id: Number(patient.remoteId), amount: Number(row.amount.replace(/[^\d.]/g, '')), due_at: row.dueAt || null }
  }
  if (!path) throw new Error('This record type is not available through the API.')
  const result = await request<Record<string, any>>(path, token, { method, body: JSON.stringify(payload) })
  if (kind === 'record' && !previous && row.medicine?.trim()) {
    await request('/prescriptions', token, { method: 'POST', body: JSON.stringify({ medical_record_id: result.id, medicine_name: row.medicine, strength: row.strength || '', dosage: row.dosage || 'As directed', frequency: row.frequency || 'As directed', duration: row.duration || 'As directed', instructions: '' }) })
  }
  if (kind === 'patient') return patientFromApi(result)
  if (kind === 'doctor') return doctorFromApi(result)
  if (kind === 'appointment') return appointmentFromApi(result)
  if (kind === 'record') return recordFromApi(result)
  return invoiceFromApi(result)
}

export async function deactivateRemote(kind: string, row: ApiRow, token: string) {
  if (!row.remoteId) return
  if (kind === 'appointment') {
    await request(`/appointments/${row.remoteId}/status`, token, { method: 'PATCH', body: JSON.stringify({ status: 'Cancelled' }) })
    return
  }
  if (kind === 'patient' || kind === 'doctor') {
    await request(`/${kind === 'patient' ? 'patients' : 'doctors'}/${row.remoteId}`, token, { method: 'DELETE' })
    return
  }
  throw new Error('This record cannot be deactivated through the API.')
}

export async function payRemote(row: ApiRow, token: string) {
  if (!row.remoteId) return
  await request(`/invoices/${row.remoteId}/payments`, token, {
    method: 'POST', body: JSON.stringify({ amount: Number(row.amount.replace(/[^\d.]/g, '')), method: 'Cash', reference: `MED-${Date.now()}` }),
  })
}

export function listManagedUsers(token: string) {
  return request<ManagedUser[]>('/users', token)
}

export function createManagedUser(token: string, email: string, password: string, role: ApiRole, doctorId?: number) {
  return request<ManagedUser>('/users', token, { method: 'POST', body: JSON.stringify({ email, password, role, doctor_id: doctorId }) })
}

export function setManagedUserActive(token: string, id: number, isActive: boolean) {
  return request<ManagedUser>(`/users/${id}/active`, token, { method: 'PATCH', body: JSON.stringify({ is_active: isActive }) })
}