import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, CalendarDays, CalendarPlus, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Clock3, CreditCard,
  FileHeart, FileText, Filter, LayoutDashboard, LogOut, Menu, MoreHorizontal, Plus,
  Search, Settings, ShieldCheck, Stethoscope, UserRound, UserRoundPlus, Users, X,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiLogin, apiRegister, createManagedUser, deactivateRemote, listManagedUsers, loadHospitalData, payRemote, saveRemote, setManagedUserActive, type ApiRole, type HospitalData, type ManagedUser } from './api'
import { Dialog, DialogContent, DialogTitle } from './components/ui/dialog'

type Page = 'Overview' | 'Patients' | 'Doctors' | 'Appointments' | 'Medical records' | 'Departments' | 'Billing' | 'Reports' | 'Settings'
type Role = 'Administrator' | 'Doctor' | 'Receptionist' | 'Patient'
type Row = Record<string, string>
type Kind = 'patient' | 'doctor' | 'appointment' | 'record' | 'invoice'
type CollectionKey = 'patients' | 'doctors' | 'appointments' | 'records' | 'invoices'
const collectionKeys: Record<Kind, CollectionKey> = { patient: 'patients', doctor: 'doctors', appointment: 'appointments', record: 'records', invoice: 'invoices' }

const navItems: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', icon: LayoutDashboard }, { label: 'Patients', icon: Users },
  { label: 'Doctors', icon: Stethoscope }, { label: 'Appointments', icon: CalendarDays },
  { label: 'Medical records', icon: FileHeart }, { label: 'Departments', icon: Activity },
  { label: 'Billing', icon: CreditCard }, { label: 'Reports', icon: ClipboardList },
]
const departments = [
  { name: 'Cardiology', count: 142, color: '#239a91' }, { name: 'Neurology', count: 98, color: '#679ac8' },
  { name: 'Orthopedics', count: 86, color: '#e3a14b' }, { name: 'Pediatrics', count: 74, color: '#d77970' },
  { name: 'General Medicine', count: 63, color: '#8498a5' },
]
const demoPatients: Row[] = [
  { id: 'PT-2048', name: 'Olivia Rhye', email: 'olivia.rhye@email.test', phone: '+1 (555) 201-0481', dob: '1988-04-12', department: 'Cardiology', status: 'Active', joined: 'Oct 14, 2024' },
  { id: 'PT-2047', name: 'Phoenix Baker', email: 'phoenix.baker@email.test', phone: '+1 (555) 201-0472', dob: '1975-08-23', department: 'Neurology', status: 'Active', joined: 'Oct 14, 2024' },
  { id: 'PT-2046', name: 'Lana Steiner', email: 'lana.steiner@email.test', phone: '+1 (555) 201-0463', dob: '1992-11-06', department: 'Orthopedics', status: 'Active', joined: 'Oct 13, 2024' },
  { id: 'PT-2045', name: 'Demi Wilkinson', email: 'demi.wilkinson@email.test', phone: '+1 (555) 201-0454', dob: '2001-02-18', department: 'Pediatrics', status: 'Active', joined: 'Oct 13, 2024' },
  { id: 'PT-2044', name: 'Candice Wu', email: 'candice.wu@email.test', phone: '+1 (555) 201-0445', dob: '1969-06-30', department: 'General Medicine', status: 'Inactive', joined: 'Oct 12, 2024' },
]
const demoDoctors: Row[] = [
  { id: 'DR-018', name: 'Dr. Leslie Alexander', email: 'leslie.alexander@medicare.test', phone: '+1 (555) 310-0180', department: 'Cardiology', specialty: 'Interventional cardiology', fee: '$180', availability: 'Mon, Wed, Fri', status: 'Available' },
  { id: 'DR-017', name: 'Dr. Jacob Jones', email: 'jacob.jones@medicare.test', phone: '+1 (555) 310-0170', department: 'Neurology', specialty: 'Clinical neurology', fee: '$160', availability: 'Tue, Thu, Sat', status: 'Available' },
  { id: 'DR-016', name: 'Dr. Darlene Robertson', email: 'darlene.robertson@medicare.test', phone: '+1 (555) 310-0160', department: 'Orthopedics', specialty: 'Sports medicine', fee: '$150', availability: 'Mon–Thu', status: 'In surgery' },
  { id: 'DR-015', name: 'Dr. Courtney Henry', email: 'courtney.henry@medicare.test', phone: '+1 (555) 310-0150', department: 'Pediatrics', specialty: 'Pediatric care', fee: '$130', availability: 'Mon–Fri', status: 'Available' },
]
const demoAppointments: Row[] = [
  { id: 'AP-3901', patient: 'Olivia Rhye', doctor: 'Dr. Leslie Alexander', department: 'Cardiology', date: '2024-10-15', time: '09:00 AM', status: 'Confirmed' },
  { id: 'AP-3902', patient: 'Phoenix Baker', doctor: 'Dr. Jacob Jones', department: 'Neurology', date: '2024-10-15', time: '09:30 AM', status: 'Scheduled' },
  { id: 'AP-3903', patient: 'Lana Steiner', doctor: 'Dr. Darlene Robertson', department: 'Orthopedics', date: '2024-10-15', time: '10:00 AM', status: 'Confirmed' },
  { id: 'AP-3904', patient: 'Demi Wilkinson', doctor: 'Dr. Courtney Henry', department: 'Pediatrics', date: '2024-10-15', time: '10:30 AM', status: 'Scheduled' },
]
const demoRecords: Row[] = [
  { id: 'MR-1078', patient: 'Olivia Rhye', type: 'Follow-up visit', diagnosis: 'Essential hypertension', doctor: 'Dr. Leslie Alexander', date: 'Oct 14, 2024', followUp: 'Nov 14, 2024', treatment: 'Lifestyle review and medication check' },
  { id: 'MR-1077', patient: 'Phoenix Baker', type: 'Consultation', diagnosis: 'Migraine without aura', doctor: 'Dr. Jacob Jones', date: 'Oct 13, 2024', followUp: 'Nov 03, 2024', treatment: 'Symptom diary and follow-up' },
  { id: 'MR-1076', patient: 'Lana Steiner', type: 'Treatment', diagnosis: 'Lumbar strain', doctor: 'Dr. Darlene Robertson', date: 'Oct 12, 2024', followUp: 'Oct 26, 2024', treatment: 'Physical therapy plan' },
]
const demoInvoices: Row[] = [
  { id: 'INV-1048', patient: 'Olivia Rhye', department: 'Cardiology', amount: '$180.00', date: 'Oct 14, 2024', status: 'Paid' },
  { id: 'INV-1047', patient: 'Phoenix Baker', department: 'Neurology', amount: '$160.00', date: 'Oct 13, 2024', status: 'Pending' },
  { id: 'INV-1046', patient: 'Lana Steiner', department: 'Orthopedics', amount: '$150.00', date: 'Oct 12, 2024', status: 'Overdue' },
]
const demoTrend = [
  { day: 'Mon', appointments: 42, patients: 24 }, { day: 'Tue', appointments: 54, patients: 31 },
  { day: 'Wed', appointments: 48, patients: 28 }, { day: 'Thu', appointments: 68, patients: 40 },
  { day: 'Fri', appointments: 59, patients: 33 }, { day: 'Sat', appointments: 37, patients: 21 },
  { day: 'Sun', appointments: 26, patients: 15 },
]

function loadRows(key: string, fallback: Row[]): Row[] {
  try {
    const stored = JSON.parse(localStorage.getItem(`medicare-${key}`) || 'null') as Row[] | null
    if (!stored) return fallback
    const defaultStatus = key === 'patients' ? 'Active' : key === 'doctors' ? 'Available' : key === 'appointments' ? 'Scheduled' : key === 'invoices' ? 'Pending' : ''
    return stored.map((row) => ({ ...row, status: row.status || defaultStatus }))
  }
  catch { return fallback }
}

export default function App() {
  const [page, setPage] = useState<Page>('Overview')
  const [role, setRole] = useState<Role>('Administrator')
  const [signedIn, setSignedIn] = useState(false)
  const [apiToken, setApiToken] = useState<string | null>(null)
  const [apiData, setApiData] = useState<HospitalData | null>(null)
  const [registering, setRegistering] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [search, setSearch] = useState('')
  const [patients, setPatients] = useState(() => loadRows('patients', demoPatients))
  const [doctors, setDoctors] = useState(() => loadRows('doctors', demoDoctors))
  const [appointments, setAppointments] = useState(() => loadRows('appointments', demoAppointments))
  const [records, setRecords] = useState(() => loadRows('records', demoRecords))
  const [invoices, setInvoices] = useState(() => loadRows('invoices', demoInvoices))
  const [modal, setModal] = useState<{ kind: Kind; row?: Row } | null>(null)
  const [toast, setToast] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [calendarView, setCalendarView] = useState('Week')
  const [calendarOffset, setCalendarOffset] = useState(0)

  useEffect(() => { if (!apiToken) localStorage.setItem('medicare-patients', JSON.stringify(patients)) }, [patients, apiToken])
  useEffect(() => { if (!apiToken) localStorage.setItem('medicare-doctors', JSON.stringify(doctors)) }, [doctors, apiToken])
  useEffect(() => { if (!apiToken) localStorage.setItem('medicare-appointments', JSON.stringify(appointments)) }, [appointments, apiToken])
  useEffect(() => { if (!apiToken) localStorage.setItem('medicare-records', JSON.stringify(records)) }, [records, apiToken])
  useEffect(() => { if (!apiToken) localStorage.setItem('medicare-invoices', JSON.stringify(invoices)) }, [invoices, apiToken])
  useEffect(() => { if (toast) { const timer = window.setTimeout(() => setToast(''), 3000); return () => window.clearTimeout(timer) } }, [toast])

  const filteredAppointments = useMemo(() => appointments.filter((row) => `${row.patient} ${row.doctor} ${row.department} ${row.status}`.toLowerCase().includes(search.toLowerCase())), [appointments, search])
  const create = (kind: Kind) => setModal({ kind })

  async function save(kind: Kind, values: Row, previous?: Row) {
    if (apiToken && apiData) {
      try {
        const saved = await saveRemote(kind, values, previous, apiToken, apiData)
        const update = (rows: Row[], setter: React.Dispatch<React.SetStateAction<Row[]>>) => setter(previous ? rows.map((item) => item.id === previous.id ? saved : item) : [saved, ...rows])
        if (kind === 'patient') update(patients, setPatients)
        if (kind === 'doctor') update(doctors, setDoctors)
        if (kind === 'appointment') update(appointments, setAppointments)
        if (kind === 'record') update(records, setRecords)
        if (kind === 'invoice') update(invoices, setInvoices)
        const key = collectionKeys[kind]
        setApiData((current) => {
          if (!current) return current
          const rows = current[key]
          return { ...current, [key]: previous ? rows.map((item) => item.id === previous.id ? saved : item) : [saved, ...rows] }
        })
        setModal(null); setToast(previous ? 'Changes saved successfully.' : 'Record created successfully.')
      } catch (error) { setToast(error instanceof Error ? error.message : 'The API request failed.') }
      return
    }
    if (kind === 'appointment' && appointments.some((row) => row.doctor === values.doctor && row.date === values.date && row.time === values.time && row.status !== 'Cancelled' && row.id !== previous?.id)) {
      setToast('That doctor already has an appointment at this time.'); return
    }
    const id = previous?.id || `${{ patient: 'PT', doctor: 'DR', appointment: 'AP', record: 'MR', invoice: 'INV' }[kind]}-${Date.now().toString().slice(-5)}`
    const next: Row = { ...values, id }
    if (kind === 'patient' && !next.status) next.status = 'Active'
    if (kind === 'doctor' && !next.status) next.status = 'Available'
    if (kind === 'appointment' && !next.status) next.status = 'Scheduled'
    if (kind === 'invoice' && !next.status) next.status = 'Pending'
    const update = (rows: Row[], setter: React.Dispatch<React.SetStateAction<Row[]>>) => setter(previous ? rows.map((item) => item.id === previous.id ? next : item) : [next, ...rows])
    if (kind === 'patient') update(patients, setPatients)
    if (kind === 'doctor') update(doctors, setDoctors)
    if (kind === 'appointment') update(appointments, setAppointments)
    if (kind === 'record') update(records, setRecords)
    if (kind === 'invoice') update(invoices, setInvoices)
    setModal(null); setToast(previous ? 'Changes saved successfully.' : 'Record created successfully.')
  }

  async function deactivate(kind: Kind, row: Row) {
    if (!window.confirm(`Deactivate ${row.name || row.patient || row.id}?`)) return
    if (apiToken) {
      try { await deactivateRemote(kind, row, apiToken) }
      catch (error) { setToast(error instanceof Error ? error.message : 'The API request failed.'); return }
    }
    const update = (rows: Row[], setter: React.Dispatch<React.SetStateAction<Row[]>>) => setter(rows.map((item) => item.id === row.id ? { ...item, status: kind === 'appointment' ? 'Cancelled' : 'Inactive' } : item))
    if (kind === 'patient') update(patients, setPatients)
    if (kind === 'doctor') update(doctors, setDoctors)
    if (kind === 'appointment') update(appointments, setAppointments)
    if (kind === 'record') update(records, setRecords)
    if (kind === 'invoice') update(invoices, setInvoices)
    const key = collectionKeys[kind]
    setApiData((current) => {
      if (!current) return current
      const rows = current[key]
      const next = kind === 'patient' || kind === 'doctor'
        ? rows.filter((item) => item.id !== row.id)
        : rows.map((item) => item.id === row.id ? { ...item, status: 'Cancelled' } : item)
      return { ...current, [key]: next }
    })
    setToast(kind === 'appointment' ? 'Appointment cancelled.' : 'Record deactivated.')
  }

  async function payInvoice(row: Row) {
    if (!window.confirm(`Record payment of ${row.amount} for ${row.patient}?`)) return
    if (apiToken) {
      try { await payRemote(row, apiToken) }
      catch (error) { setToast(error instanceof Error ? error.message : 'Payment could not be processed.'); return }
    }
    setInvoices((items) => items.map((item) => item.id === row.id ? { ...item, status: 'Paid' } : item))
    setToast('Payment recorded successfully.')
  }

  async function enterApi(email: string, password: string) {
    const session = await apiLogin(email, password)
    const data = await loadHospitalData(session.access_token, session.role)
    setRole(session.role)
    setApiToken(session.access_token)
    setApiData(data)
    setPatients(data.patients); setDoctors(data.doctors); setAppointments(data.appointments); setRecords(data.records); setInvoices(data.invoices)
    setSignedIn(true)
  }

  async function registerPatient(name: string, email: string, password: string) {
    await apiRegister(name, email, password)
    await enterApi(email, password)
  }

  function enterDemo(selected: Role) {
    setApiToken(null); setApiData(null); setRole(selected); setSignedIn(true)
  }

  if (!signedIn) return <LoginScreen registering={registering} onToggle={() => setRegistering(!registering)} onDemo={enterDemo} onApiLogin={enterApi} onRegister={registerPatient} />
  const isAdmin = role === 'Administrator' || role === 'Receptionist'
  const openCreate = (kind: Kind) => { setMobileNav(false); create(kind) }

  return <div className="app-shell">
    {mobileNav && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Activity size={19} /></span><span>Medi<span>Care</span></span></div>
      <div className="nav-caption">WORKSPACE</div><nav className="side-nav" aria-label="Main navigation">
        {navItems.filter((item) => (role !== 'Patient' || ['Overview', 'Appointments', 'Medical records', 'Billing'].includes(item.label)) && (role !== 'Receptionist' || !['Medical records', 'Reports'].includes(item.label))).map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => { setPage(label); setMobileNav(false) }}><Icon size={18} /><span>{label}</span>{label === 'Appointments' && <i className="nav-count">8</i>}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={17} /><span><strong>Need a hand?</strong><small>Visit our help center</small></span><ChevronRight size={15} /></div>
        <button className={`nav-item ${page === 'Settings' ? 'active' : ''}`} onClick={() => setPage('Settings')}><Settings size={18} /><span>Settings</span></button>
        <div className="side-user"><Avatar initials="AM" tone="navy" /><div><strong>Alex Morgan</strong><small>{role}</small></div><button className="icon-button" aria-label="Account options" onClick={() => setProfileOpen(!profileOpen)}><MoreHorizontal size={18} /></button></div>
      </div>
    </aside>
    <main className={`main-area role-${role.toLowerCase()}`}>
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={19} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{page}</strong></div>
        <div className="topbar-right"><label className="search-box"><Search size={16} /><input aria-label="Search records" placeholder="Search anything..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setToast('You are all caught up.')}><Bell size={19} /><i /></button>
          <div className="profile-wrap"><button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}><Avatar initials="AM" tone="navy" /><span>Alex Morgan</span><ChevronDown size={14} /></button>{profileOpen && <div className="profile-menu"><strong>Alex Morgan</strong><small>{role}{apiToken ? ' · Connected' : ' · Demo'}</small><button onClick={() => { setPatients(demoPatients); setDoctors(demoDoctors); setAppointments(demoAppointments); setRecords(demoRecords); setInvoices(demoInvoices); setApiData(null); setApiToken(null); setSignedIn(false); setProfileOpen(false) }}><LogOut size={15} /> Sign out</button></div>}</div>
        </div>
      </header>
      <div className="page-wrap">
        {page === 'Overview' && <Dashboard patients={patients} doctors={doctors} appointments={appointments} apiStats={apiData?.stats} apiTrend={apiData?.trend} onPage={setPage} onCreate={openCreate} />}
        {page === 'Patients' && <Directory title="Patient directory" subtitle="Manage patient profiles and care information." kind="patient" rows={patients} search={search} setSearch={setSearch} onCreate={() => openCreate('patient')} onEdit={(row) => setModal({ kind: 'patient', row })} onDeactivate={(row) => deactivate('patient', row)} />}
        {page === 'Doctors' && <Directory title="Medical team" subtitle="Your clinicians, their specialties, and availability." kind="doctor" rows={doctors} search={search} setSearch={setSearch} onCreate={() => openCreate('doctor')} onEdit={(row) => setModal({ kind: 'doctor', row })} onDeactivate={(row) => deactivate('doctor', row)} />}
        {page === 'Appointments' && <Appointments rows={filteredAppointments} search={search} view={calendarView} setView={setCalendarView} offset={calendarOffset} setOffset={setCalendarOffset} onCreate={() => openCreate('appointment')} onEdit={(row) => setModal({ kind: 'appointment', row })} onDeactivate={(row) => deactivate('appointment', row)} />}
        {page === 'Medical records' && <Directory title="Patient care records" subtitle={`Clinical notes and follow-up history. ${role === 'Patient' ? 'Showing your permitted records.' : 'Role-restricted clinical access.'}`} kind="record" rows={records} search={search} setSearch={setSearch} onCreate={() => openCreate('record')} onEdit={(row) => setModal({ kind: 'record', row })} onDeactivate={(row) => deactivate('record', row)} />}
        {page === 'Departments' && <DepartmentsPage />}
        {page === 'Billing' && <Directory title="Billing & invoices" subtitle="Consultation charges and payment history." kind="invoice" rows={invoices} search={search} setSearch={setSearch} onCreate={() => openCreate('invoice')} onEdit={(row) => setModal({ kind: 'invoice', row })} onDeactivate={(row) => deactivate('invoice', row)} onPay={(row) => void payInvoice(row)} />}
        {page === 'Reports' && <ReportsPage patients={patients} appointments={appointments} />}
        {page === 'Settings' && <SettingsPage role={role} setRole={setRole} apiToken={apiToken} doctors={doctors} />}
      </div>
    </main>
    {modal && <RecordModal kind={modal.kind} row={modal.row} patients={patients} doctors={doctors} onClose={() => setModal(null)} onSave={(values) => save(modal.kind, values, modal.row)} />}
    {toast && <div className="toast" role="status"><span><Check size={15} /></span>{toast}<button className="icon-button" aria-label="Dismiss" onClick={() => setToast('')}><X size={15} /></button></div>}
    {!isAdmin && <div className="role-note"><ShieldCheck size={14} /> Signed in as {role}. Access to sensitive records is restricted.</div>}
  </div>
}

function Avatar({ initials, tone = 'mint' }: { initials: string; tone?: string }) { return <span className={`avatar avatar-${tone}`}>{initials}</span> }

function LoginScreen({ registering, onToggle, onDemo, onApiLogin, onRegister }: { registering: boolean; onToggle: () => void; onDemo: (role: Role) => void; onApiLogin: (email: string, password: string) => Promise<void>; onRegister: (name: string, email: string, password: string) => Promise<void> }) {
  const [selected, setSelected] = useState<Role>('Administrator')
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit() {
    if (!email || !password || (registering && !fullName)) { setNotice('Complete the required fields to continue.'); return }
    if (registering && !consent) { setNotice('Please accept the privacy policy and terms to continue.'); return }
    setBusy(true); setNotice('')
    try {
      if (registering) await onRegister(fullName, email, password)
      else await onApiLogin(email, password)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to connect to MediCare.') }
    finally { setBusy(false) }
  }
  return <div className="auth-screen"><section className="auth-visual"><div className="auth-brand"><span className="brand-mark"><Activity size={19} /></span><span>Medi<span>Care</span></span></div>
    <div className="visual-copy"><div className="eyebrow"><i /> HEALTHCARE, CONNECTED</div><h1>Care that moves<br />you <em>forward.</em></h1><p>One calm, connected space for better care and healthier communities.</p></div>
    <div className="care-art" aria-hidden="true"><div className="art-ring ring-a" /><div className="art-ring ring-b" /><div className="care-monitor"><Activity size={56} /><div className="monitor-line" /></div><div className="art-chip chip-a"><span />Patient care <b>●●●●●</b></div><div className="art-chip chip-b"><CalendarDays size={15} />Always connected</div><div className="art-chip chip-c"><span className="tiny-avatar">DR</span>Your care team</div></div>
    <div className="auth-qualities"><span>Trusted by care teams</span><span>Thoughtful by design</span><span>Built for people</span></div></section>
    <section className="auth-panel"><div className="auth-form"><div className="form-kicker">{registering ? 'GET STARTED' : 'WELCOME BACK'}</div><h2>{registering ? 'Create your account' : 'Sign in to MediCare'}</h2><p>{registering ? 'Join us to manage your care in one place.' : 'Enter your details to access your workspace.'}</p>
      {notice && <div className="form-alert" role="alert">{notice}</div>}{registering && <label className="field-label">Full name<input className="form-input" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" autoComplete="name" /></label>}
      <label className="field-label">Email address<input className="form-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@hospital.com" autoComplete="email" /></label>
      <label className="field-label">Password<div className="password-wrap"><input className="form-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" minLength={10} autoComplete={registering ? 'new-password' : 'current-password'} /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
      {!registering && <label className="field-label">Sign in as<select className="form-input" value={selected} onChange={(event) => setSelected(event.target.value as Role)}>{(['Administrator', 'Doctor', 'Receptionist', 'Patient'] as Role[]).map((item) => <option key={item}>{item}</option>)}</select></label>}
      {registering && <label className="check-label"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I agree to the privacy policy and terms of service.</label>}
      <button className="primary-button auth-submit" disabled={busy} onClick={() => void submit()}>{busy ? 'Connecting...' : registering ? 'Create patient account' : 'Sign in securely'}<ChevronRight size={17} /></button>
      {!registering && <button className="secondary-button demo-submit" onClick={() => onDemo(selected)}>Explore demo workspace <ChevronRight size={15} /></button>}
      <div className="auth-switch">{registering ? 'Already have an account?' : 'New to MediCare?'} <button onClick={onToggle}>{registering ? 'Sign in' : 'Create an account'}</button></div>
      <div className="demo-note"><ShieldCheck size={15} /><span>Demo workspace uses fictional patient data.<br /><strong>Choose a role and sign in to explore.</strong></span></div>
    </div><div className="auth-bottom"><span>© 2024 MediCare Health Systems</span><span>Privacy</span><span>Support</span></div></section></div>
}

function Dashboard({ patients, doctors, appointments, apiStats, apiTrend, onPage, onCreate }: { patients: Row[]; doctors: Row[]; appointments: Row[]; apiStats?: HospitalData['stats']; apiTrend?: HospitalData['trend']; onPage: (page: Page) => void; onCreate: (kind: Kind) => void }) {
  const trend = apiTrend || demoTrend
  const stats = [
    { label: 'Total patients', value: apiStats ? apiStats.total_patients.toLocaleString() : (2846 + patients.length - demoPatients.length).toLocaleString(), delta: '+12.8%', icon: Users, tone: 'teal', foot: 'vs. last month' },
    { label: 'Registered doctors', value: apiStats ? String(apiStats.registered_doctors) : (184 + doctors.length - demoDoctors.length).toString(), delta: '+4.2%', icon: Stethoscope, tone: 'blue', foot: 'vs. last month' },
    { label: "Today's appointments", value: apiStats ? String(apiStats.todays_appointments) : (36 + appointments.length - demoAppointments.length).toString(), delta: '+8.1%', icon: CalendarDays, tone: 'orange', foot: 'vs. yesterday' },
    { label: 'Available beds', value: apiStats ? String(apiStats.available_beds) : '128', delta: '72%', icon: Activity, tone: 'rose', foot: 'occupancy rate' },
  ]
  const today = appointments.filter((row) => row.status !== 'Cancelled').slice(0, 4)
  return <>
    <div className="page-heading dashboard-heading"><div><div className="date-kicker"><i className="live-dot" /> TUESDAY, OCTOBER 15, 2024</div><h1>Good morning, Administrator<span>.</span></h1><p>Here’s what’s happening at your hospital today.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => onPage('Reports')}><FileText size={16} /> Reports</button><button className="primary-button" onClick={() => onCreate('appointment')}><Plus size={17} /> New appointment</button></div></div>
    <section className="stat-grid">{stats.map(({ label, value, delta, icon: Icon, tone, foot }) => <article className="stat-card" key={label}><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={18} /></span></div><strong className="stat-value">{value}</strong><div className="stat-foot"><span className="delta"><ArrowUpRight size={14} />{delta}</span><span>{foot}</span><button className="icon-button" aria-label={`More ${label} details`}><MoreHorizontal size={16} /></button></div></article>)}</section>
    <section className="dashboard-grid charts-row"><article className="panel chart-panel"><div className="panel-head"><div><h2>Appointment overview</h2><p>Appointment volume across this week</p></div><button className="select-button">This week <ChevronDown size={14} /></button></div><div className="chart-legend"><span><i className="legend-dot teal" />Appointments</span><span><i className="legend-dot sky" />New patients</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 10, right: 5, left: -18, bottom: 0 }}><defs><linearGradient id="appointmentFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#239a91" stopOpacity={0.17} /><stop offset="95%" stopColor="#239a91" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#edf1f3" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8b9aa4', fontSize: 11 }} dy={9} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b9aa4', fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5ebee', fontSize: 12 }} /><Area type="monotone" dataKey="appointments" stroke="#239a91" strokeWidth={2.5} fill="url(#appointmentFill)" /><Area type="monotone" dataKey="patients" stroke="#79a8d1" strokeWidth={2} fill="transparent" /></AreaChart></ResponsiveContainer></div></article>
      <article className="panel registration-panel"><div className="panel-head"><div><h2>Patient registrations</h2><p>New patients this week</p></div><button className="icon-button" aria-label="Registration options"><MoreHorizontal size={19} /></button></div><div className="registration-total">248 <span className="delta"><ArrowUpRight size={14} />18%</span></div><div className="registration-sub">Compared to 210 last week</div><div className="mini-bars">{[42, 62, 50, 78, 56, 87, 68, 100, 74, 58, 83, 66, 92, 71].map((height, index) => <i key={index} className={index === 7 ? 'highlight' : ''} style={{ height: `${height}%` }} />)}</div><div className="mini-axis"><span>Oct 09</span><span>Oct 15</span></div><div className="registration-footer"><span><i className="legend-dot teal" />This week</span><strong>248 registrations</strong></div></article></section>
    <section className="dashboard-grid lower-row"><article className="panel appointments-panel"><div className="panel-head"><div><h2>Upcoming appointments</h2><p>Today, October 15 <span className="today-count">{today.length} upcoming</span></p></div><button className="text-button" onClick={() => onPage('Appointments')}>View calendar <ChevronRight size={15} /></button></div><div className="appointment-list">{today.map((row, index) => <div className="appointment-row" key={row.id}><div className={`time-block time-${index % 3}`}><Clock3 size={14} /><span>{row.time}</span></div><div className="appointment-person"><Avatar initials={row.patient.split(' ').map((part) => part[0]).join('')} /><div><strong>{row.patient}</strong><small>{row.department}</small></div></div><div className="appointment-doctor"><small>Doctor</small><strong>{row.doctor.replace('Dr. ', '')}</strong></div><Status status={row.status} /></div>)}</div><button className="mobile-view-link" onClick={() => onPage('Appointments')}>View all appointments <ChevronRight size={14} /></button></article>
      <article className="panel department-panel"><div className="panel-head"><div><h2>Department overview</h2><p>Appointments by department</p></div><button className="icon-button" aria-label="Department options"><MoreHorizontal size={19} /></button></div><div className="department-list">{departments.slice(0, 4).map((item) => <div className="department-item" key={item.name}><div className="department-top"><span><i style={{ background: item.color }} />{item.name}</span><strong>{item.count}</strong></div><div className="progress-track"><i style={{ width: `${item.count / 1.6}%`, background: item.color }} /></div></div>)}</div><button className="text-button department-link" onClick={() => onPage('Departments')}>All departments <ChevronRight size={15} /></button></article></section>
    <section className="quick-actions"><div><h2>Quick actions</h2><p>Common tasks, right at your fingertips.</p></div><div className="quick-action-list"><QuickAction icon={UserRoundPlus} color="teal" label="Register patient" onClick={() => onCreate('patient')} /><QuickAction icon={Stethoscope} color="blue" label="Add doctor" onClick={() => onCreate('doctor')} /><QuickAction icon={CalendarPlus} color="orange" label="Schedule appointment" onClick={() => onCreate('appointment')} /><QuickAction icon={ClipboardList} color="rose" label="View reports" onClick={() => onPage('Reports')} /></div></section>
    <div className="dashboard-footnote"><ShieldCheck size={14} /> Patient information is confidential and available to authorized staff only.</div>
  </>
}

function QuickAction({ icon: Icon, color, label, onClick }: { icon: typeof Users; color: string; label: string; onClick: () => void }) { return <button onClick={onClick}><span className={`quick-icon quick-${color}`}><Icon size={17} /></span><span>{label}</span><ChevronRight size={15} /></button> }
function Status({ status = 'Unknown' }: { status?: string }) { return <span className={`status-badge status-${status.toLowerCase().replace(/ /g, '-')}`}><i />{status}</span> }
function Person({ name, detail, initials }: { name?: string; detail?: string; initials: string }) { return <div className="person-cell"><Avatar initials={initials} /><span><strong>{name}</strong><small>{detail}</small></span></div> }

function Directory({ title, subtitle, kind, rows, search, setSearch, onCreate, onEdit, onDeactivate, onPay }: { title: string; subtitle: string; kind: Kind; rows: Row[]; search: string; setSearch: (value: string) => void; onCreate: () => void; onEdit: (row: Row) => void; onDeactivate: (row: Row) => void; onPay?: (row: Row) => void }) {
  const [filter, setFilter] = useState('All')
  const [pageNumber, setPageNumber] = useState(1)
  const pageSize = 6
  const filtered = rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || row.status === filter))
  const shown = filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
  const columns: Record<Kind, string[]> = {
    patient: ['Patient', 'Patient ID', 'Contact', 'Department', 'Status'], doctor: ['Doctor', 'Doctor ID', 'Specialty', 'Department', 'Availability'],
    appointment: ['Patient', 'Appointment ID'], record: ['Patient', 'Record ID', 'Visit type', 'Diagnosis', 'Date'], invoice: ['Invoice', 'Patient', 'Department', 'Amount', 'Payment status'],
  }
  const cells = (row: Row): React.ReactNode[] => {
    const initials = (value = '') => value.split(' ').map((part) => part[0]).join('')
    if (kind === 'patient') return [<Person name={row.name} detail={row.email} initials={initials(row.name)} />, <span className="id-text">{row.id}</span>, <span>{row.phone}</span>, <span>{row.department}</span>, <Status status={row.status} />]
    if (kind === 'doctor') return [<Person name={row.name} detail={row.email} initials={initials(row.name.replace('Dr. ', ''))} />, <span className="id-text">{row.id}</span>, <span>{row.specialty}</span>, <span>{row.department}</span>, <Status status={row.status} />]
    if (kind === 'record') return [<Person name={row.patient} detail={row.doctor} initials={initials(row.patient)} />, <span className="id-text">{row.id}</span>, <span>{row.type}</span>, <span>{row.diagnosis}</span>, <span>{row.date}</span>]
    return [<span className="id-text">{row.id}</span>, <Person name={row.patient} detail={row.department} initials={initials(row.patient)} />, <span>{row.department}</span>, <strong>{row.amount}</strong>, <Status status={row.status} />]
  }
  const singular = { patient: 'patient', doctor: 'doctor', appointment: 'appointment', record: 'medical record', invoice: 'invoice' }[kind]
  return <><div className="page-heading directory-heading"><div><div className="date-kicker">CARE OPERATIONS</div><h1>{title}</h1><p>{subtitle}</p></div><button className="primary-button" onClick={onCreate}><Plus size={17} />{kind === 'patient' ? 'Register patient' : kind === 'doctor' ? 'Add doctor' : kind === 'record' ? 'Add care record' : 'Create invoice'}</button></div>
    <section className="panel directory-panel"><div className="directory-tools"><label className="table-search"><Search size={16} /><input placeholder={`Search ${title.toLowerCase()}...`} value={search} onChange={(event) => { setSearch(event.target.value); setPageNumber(1) }} /></label><div className="directory-filters"><select aria-label="Filter by status" value={filter} onChange={(event) => { setFilter(event.target.value); setPageNumber(1) }}><option>All</option>{[...new Set(rows.map((row) => row.status).filter(Boolean))].map((value) => <option key={value}>{value}</option>)}</select><button className="secondary-button filter-button"><Filter size={15} /> Filters</button></div></div>
      {shown.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{columns[kind].map((column) => <th key={column}>{column}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead><tbody>{shown.map((row) => <tr key={row.id}>{cells(row).map((cell, index) => <td key={`${row.id}-${index}`}>{cell}</td>)}<td><div className="row-actions">{kind !== 'invoice' && <button className="icon-button" aria-label={`Edit ${row.id}`} onClick={() => onEdit(row)}><FileText size={15} /></button>}{kind === 'invoice' && row.status !== 'Paid' && <button className="icon-button" aria-label={`Record payment for ${row.id}`} onClick={() => onPay?.(row)}><CreditCard size={15} /></button>}{(kind === 'patient' || kind === 'doctor') && <button className="icon-button" aria-label={`Deactivate ${row.id}`} onClick={() => onDeactivate(row)}><MoreHorizontal size={17} /></button>}</div></td></tr>)}</tbody></table></div> : <div className="empty-state"><div><Search size={20} /></div><h3>No records found</h3><p>Try adjusting your search or filters.</p><button onClick={() => { setSearch(''); setFilter('All') }}>Clear filters</button></div>}
      <div className="table-footer"><span>Showing <strong>{filtered.length ? (pageNumber - 1) * pageSize + 1 : 0}–{Math.min(pageNumber * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> results</span><div className="pagination"><button aria-label="Previous page" disabled={pageNumber === 1} onClick={() => setPageNumber(pageNumber - 1)}><ChevronLeft size={16} /></button><span>Page {pageNumber}</span><button aria-label="Next page" disabled={pageNumber * pageSize >= filtered.length} onClick={() => setPageNumber(pageNumber + 1)}><ChevronRight size={16} /></button></div></div>
    </section><div className="directory-summary"><div><span className="summary-icon"><Users size={17} /></span><span><strong>{rows.length} total {singular}{rows.length === 1 ? '' : 's'}</strong><small>Updated just now</small></span></div><div><span className="summary-icon summary-green"><ShieldCheck size={17} /></span><span><strong>Secure patient data</strong><small>Access-controlled workspace</small></span></div></div></>
}

function Appointments({ rows, search, view, setView, offset, setOffset, onCreate, onEdit, onDeactivate }: { rows: Row[]; search: string; view: string; setView: (value: string) => void; offset: number; setOffset: (value: number) => void; onCreate: () => void; onEdit: (row: Row) => void; onDeactivate: (row: Row) => void }) {
  const hours = ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM']
  const visible = rows.filter((row) => `${row.patient} ${row.doctor} ${row.department}`.toLowerCase().includes(search.toLowerCase()))
  const baseDate = view === 'Month' ? new Date(2024, 9 + offset, 1) : new Date(2024, 9, 14 + (view === 'Day' ? 1 : 0) + offset * 7)
  const dayCount = view === 'Day' ? 1 : 7
  const dates = Array.from({ length: dayCount }, (_, index) => new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + index))
  const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
  const monthOffset = (monthStart.getDay() + 6) % 7
  const monthDays = Array.from({ length: 35 }, (_, index) => new Date(baseDate.getFullYear(), baseDate.getMonth(), index - monthOffset + 1))
  const title = view === 'Month' ? baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : view === 'Day' ? baseDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : `${dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${dates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const eventTop = (time: string) => {
    const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (!match) return 8
    let hour = Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)
    return Math.max(4, Math.min(310, (hour - 9 + Number(match[2]) / 60) * 59))
  }
  return <><div className="page-heading directory-heading"><div><div className="date-kicker">CARE OPERATIONS</div><h1>Appointments</h1><p>Plan and coordinate patient visits across your care teams.</p></div><button className="primary-button" onClick={onCreate}><Plus size={17} />Schedule appointment</button></div>
    <section className="panel calendar-panel"><div className="calendar-toolbar"><div className="calendar-nav"><button className="icon-button" aria-label="Previous period" onClick={() => setOffset(offset - 1)}><ChevronLeft size={18} /></button><button className="icon-button" aria-label="Next period" onClick={() => setOffset(offset + 1)}><ChevronRight size={18} /></button><button className="secondary-button today-button" onClick={() => setOffset(0)}>Today</button><h2>{title}</h2></div><div className="segmented">{['Day', 'Week', 'Month'].map((item) => <button key={item} className={view === item ? 'selected' : ''} onClick={() => setView(item)}>{item}</button>)}</div></div>
      {view === 'Month' ? <div className="calendar-month-grid"><div className="month-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div><div className="month-days">{monthDays.map((date) => { const dayRows = visible.filter((row) => row.date === dateKey(date)); return <div className={date.getMonth() === baseDate.getMonth() ? 'month-day' : 'month-day outside-month'} key={dateKey(date)}><strong>{date.getDate()}</strong>{dayRows.slice(0, 2).map((row) => <button className="month-event" key={row.id} onClick={() => onEdit(row)}>{row.patient}</button>)}{dayRows.length > 2 && <small>+{dayRows.length - 2} more</small>}</div> })}</div></div> : <div className="calendar-scroll"><div className="calendar-grid" style={{ gridTemplateColumns: `68px minmax(0, 1fr)` }}><div /><div className="calendar-day-heads" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(84px, 1fr))` }}>{dates.map((date) => <div key={dateKey(date)} className={dateKey(date) === '2024-10-15' && offset === 0 ? 'current-day' : ''}><span>{date.toLocaleDateString('en-US', { weekday: 'short' })}</span><strong>{date.getDate()}</strong></div>)}</div><div className="calendar-times">{hours.map((hour) => <div key={hour}>{hour}</div>)}</div><div className="calendar-columns" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(84px, 1fr))` }}>{dates.map((date) => <div className="calendar-column" key={dateKey(date)}>{hours.map((hour) => <div className="calendar-cell" key={hour} />)}{visible.filter((row) => row.date === dateKey(date)).map((row) => <button className="calendar-event" key={row.id} style={{ top: `${eventTop(row.time)}px` }} onClick={() => onEdit(row)}><strong>{row.patient}</strong><small>{row.time} · {row.department}</small></button>)}</div>)}</div></div></div>}
      <div className="calendar-mobile-list">{visible.map((row) => <div key={row.id}><span className="mobile-event-time">{row.time}</span><span><strong>{row.patient}</strong><small>{row.doctor} · {row.department}</small></span><Status status={row.status} /><button className="icon-button" aria-label="Cancel appointment" onClick={() => onDeactivate(row)}><X size={16} /></button></div>)}</div>
    </section><section className="panel appointment-table-panel"><div className="panel-head"><div><h2>Appointment schedule</h2><p>{visible.length} visits listed</p></div><button className="secondary-button" onClick={() => window.print()}><FileText size={15} />Export</button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Patient</th><th>Doctor</th><th>Department</th><th>Date & time</th><th>Status</th><th /></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><Person name={row.patient} detail={row.id} initials={row.patient.split(' ').map((part) => part[0]).join('')} /></td><td>{row.doctor}</td><td>{row.department}</td><td>{row.date} · {row.time}</td><td><Status status={row.status} /></td><td><button className="icon-button" aria-label="Reschedule appointment" onClick={() => onEdit(row)}><CalendarPlus size={15} /></button><button className="icon-button" aria-label="Cancel appointment" onClick={() => onDeactivate(row)}><X size={15} /></button></td></tr>)}</tbody></table></div></section></>
}

function DepartmentsPage() {
  return <><div className="page-heading directory-heading"><div><div className="date-kicker">HOSPITAL DIRECTORY</div><h1>Departments</h1><p>Care teams and service lines across the hospital.</p></div><button className="secondary-button" onClick={() => window.print()}><FileText size={16} />Export overview</button></div><div className="department-cards">{departments.map((item, index) => <section className="panel department-card" key={item.name}><div className="department-card-top"><span className="department-symbol" style={{ color: item.color, background: `${item.color}16` }}>{index === 0 ? <Activity size={19} /> : index === 1 ? <FileHeart size={19} /> : index === 2 ? <Stethoscope size={19} /> : index === 3 ? <Users size={19} /> : <ShieldCheck size={19} />}</span><button className="icon-button" aria-label={`${item.name} options`}><MoreHorizontal size={18} /></button></div><h2>{item.name}</h2><p>{['Heart and vascular care', 'Brain and nervous system', 'Bone and joint care', 'Care for infants and children', 'Primary and preventive care'][index]}</p><div className="department-card-metric"><strong>{item.count}</strong><span>appointments this month</span></div><div className="progress-track"><i style={{ width: `${item.count / 1.6}%`, background: item.color }} /></div><div className="department-card-footer"><span><i style={{ background: item.color }} />{index === 2 ? 12 : 16} clinicians</span><span>{index === 2 ? 3 : 4} available today</span></div></section>)}</div></>
}

function ReportsPage({ patients, appointments }: { patients: Row[]; appointments: Row[] }) {
  const data = [{ day: 'Jan', appointments: 320, patients: 190 }, { day: 'Feb', appointments: 370, patients: 210 }, { day: 'Mar', appointments: 410, patients: 260 }, { day: 'Apr', appointments: 390, patients: 230 }, { day: 'May', appointments: 480, patients: 320 }, { day: 'Jun', appointments: 520, patients: 340 }, { day: 'Jul', appointments: 490, patients: 310 }, { day: 'Aug', appointments: 590, patients: 385 }, { day: 'Sep', appointments: 630, patients: 410 }, { day: 'Oct', appointments: 680, patients: 460 }]
  return <><div className="page-heading directory-heading"><div><div className="date-kicker">INSIGHTS & ANALYTICS</div><h1>Reports</h1><p>Hospital activity and care delivery at a glance.</p></div><button className="secondary-button" onClick={() => window.print()}><FileText size={16} />Export report</button></div><div className="report-metrics">{[{ label: 'Appointments', value: (appointments.length + 1524).toLocaleString(), change: '+8.1% from last month', down: false }, { label: 'Patient registrations', value: (patients.length + 244).toLocaleString(), change: '+18.0% from last month', down: false }, { label: 'Doctor utilization', value: '78.4%', change: '2.3% from last month', down: true }, { label: 'Revenue collected', value: '$84,290', change: '+12.6% from last month', down: false }].map((item) => <div className="panel report-metric" key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.down ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}{item.change}</small></div>)}</div><section className="panel report-chart"><div className="panel-head"><div><h2>Patient and appointment trends</h2><p>Monthly activity, January–October 2024</p></div><select className="select-button"><option>Last 10 months</option><option>This year</option></select></div><div className="chart-wrap report-chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><CartesianGrid stroke="#edf1f3" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8b9aa4', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b9aa4', fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="appointments" stroke="#239a91" strokeWidth={2.5} fill="#239a9118" /><Area type="monotone" dataKey="patients" stroke="#79a8d1" strokeWidth={2} fill="#79a8d118" /></AreaChart></ResponsiveContainer></div></section><div className="report-note"><ShieldCheck size={15} /> Reports use aggregated demonstration data.</div></>
}

function SettingsPage({ role, setRole, apiToken, doctors }: { role: Role; setRole: (value: Role) => void; apiToken: string | null; doctors: Row[] }) {
  const tabs = ['Hospital profile', 'Users & permissions', 'Notifications', 'Account'] as const
  const [tab, setTab] = useState<(typeof tabs)[number]>('Hospital profile')
  const [saved, setSaved] = useState(false)
  const [notice, setNotice] = useState('')
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [userEmail, setUserEmail] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [userRole, setUserRole] = useState<ApiRole>('Receptionist')
  const [doctorId, setDoctorId] = useState('')
  const [hospital, setHospital] = useState(() => {
    try { return JSON.parse(localStorage.getItem('medicare-hospital') || 'null') || { name: 'MediCare General Hospital', email: 'contact@medicare.example', phone: '+1 (555) 100-2024', timezone: 'Eastern Time (ET)' } }
    catch { return { name: 'MediCare General Hospital', email: 'contact@medicare.example', phone: '+1 (555) 100-2024', timezone: 'Eastern Time (ET)' } }
  })
  useEffect(() => {
    if (tab !== 'Users & permissions' || !apiToken) return
    listManagedUsers(apiToken).then(setUsers).catch((error) => setNotice(error instanceof Error ? error.message : 'Unable to load accounts.'))
  }, [tab, apiToken])
  const setHospitalField = (key: string, value: string) => setHospital((current: Record<string, string>) => ({ ...current, [key]: value }))
  const saveHospital = () => {
    localStorage.setItem('medicare-hospital', JSON.stringify(hospital))
    setSaved(true); window.setTimeout(() => setSaved(false), 2200)
  }
  async function submitUser(event: React.FormEvent) {
    event.preventDefault(); setNotice('')
    if (userPassword.length < 10) { setNotice('Use a password with at least 10 characters.'); return }
    try {
      if (apiToken) {
        const created = await createManagedUser(apiToken, userEmail, userPassword, userRole, userRole === 'Doctor' ? Number(doctorId) : undefined)
        setUsers((current) => [created, ...current])
      } else {
        setUsers((current) => [{ id: Date.now(), email: userEmail, role: userRole, is_active: true }, ...current])
      }
      setUserEmail(''); setUserPassword(''); setDoctorId(''); setNotice('Account created successfully.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to create account.') }
  }
  async function toggleUser(user: ManagedUser) {
    try {
      const updated = apiToken ? await setManagedUserActive(apiToken, user.id, !user.is_active) : { ...user, is_active: !user.is_active }
      setUsers((current) => current.map((item) => item.id === user.id ? updated : item))
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to update account.') }
  }
  return <><div className="page-heading directory-heading"><div><div className="date-kicker">WORKSPACE PREFERENCES</div><h1>Settings</h1><p>Hospital details, access, and notification preferences.</p></div>{tab === 'Hospital profile' && <button className="primary-button" onClick={saveHospital}><Check size={16} />{saved ? 'Saved' : 'Save changes'}</button>}</div>
    <div className="settings-layout"><nav className="panel settings-nav" aria-label="Settings sections">{tabs.map((item) => <button key={item} className={tab === item ? 'selected' : ''} onClick={() => { setTab(item); setNotice('') }}>{item === 'Hospital profile' ? <Activity size={16} /> : item === 'Users & permissions' ? <Users size={16} /> : item === 'Notifications' ? <Bell size={16} /> : <UserRound size={16} />}{item}</button>)}</nav>
      <section className="panel settings-content">
        {tab === 'Hospital profile' && <><div className="panel-head"><div><h2>Hospital profile</h2><p>Information visible to patients and care teams.</p></div></div><div className="settings-fields"><label className="field-label">Hospital name<input className="form-input" value={hospital.name} onChange={(event) => setHospitalField('name', event.target.value)} /></label><label className="field-label">Contact email<input className="form-input" type="email" value={hospital.email} onChange={(event) => setHospitalField('email', event.target.value)} /></label><label className="field-label">Phone number<input className="form-input" value={hospital.phone} onChange={(event) => setHospitalField('phone', event.target.value)} /></label><label className="field-label">Time zone<select className="form-input" value={hospital.timezone} onChange={(event) => setHospitalField('timezone', event.target.value)}><option>Eastern Time (ET)</option><option>Central Time (CT)</option><option>Pacific Time (PT)</option></select></label>{!apiToken && <><div className="settings-divider" /><div className="settings-access"><span><strong>Demo role</strong><small>Switch roles to preview access-controlled views.</small></span><select className="form-input" value={role} onChange={(event) => setRole(event.target.value as Role)}>{(['Administrator', 'Doctor', 'Receptionist', 'Patient'] as Role[]).map((item) => <option key={item}>{item}</option>)}</select></div></>}</div></>}
        {tab === 'Users & permissions' && <><div className="panel-head"><div><h2>Users & permissions</h2><p>Staff roles determine which records and actions are available.</p></div></div>{notice && <div className="form-alert" role="status">{notice}</div>}{apiToken && role !== 'Administrator' ? <div className="empty-state"><div><ShieldCheck size={20} /></div><h3>Administrator access required</h3><p>Your account cannot manage users.</p></div> : <><form className="user-create-form" onSubmit={(event) => void submitUser(event)}><label className="field-label">Work email<input className="form-input" type="email" required value={userEmail} onChange={(event) => setUserEmail(event.target.value)} /></label><label className="field-label">Temporary password<input className="form-input" type="password" minLength={10} required value={userPassword} onChange={(event) => setUserPassword(event.target.value)} /></label><label className="field-label">Role<select className="form-input" value={userRole} onChange={(event) => setUserRole(event.target.value as ApiRole)}><option>Receptionist</option><option>Doctor</option><option>Administrator</option></select></label>{userRole === 'Doctor' && <label className="field-label">Doctor profile<select className="form-input" required value={doctorId} onChange={(event) => setDoctorId(event.target.value)}><option value="">Select doctor</option>{doctors.filter((item) => item.remoteId).map((item) => <option key={item.remoteId} value={item.remoteId}>{item.name}</option>)}</select></label>}<button className="primary-button" type="submit"><Plus size={15} />Create staff account</button></form><div className="permission-list"><div className="permission-head"><strong>Role access</strong><span>Patients</span><span>Clinical records</span><span>Billing</span></div>{[['Administrator', 'Full access', 'Full access', 'Full access'], ['Doctor', 'Assigned patients', 'Assigned records', 'Read only'], ['Receptionist', 'Manage profiles', 'No access', 'Manage invoices'], ['Patient', 'Own profile', 'Own records', 'Own invoices']].map((line) => <div className="permission-row" key={line[0]}>{line.map((value, index) => <span key={`${line[0]}-${index}`}>{value}</span>)}</div>)}</div><div className="managed-user-list">{users.map((user) => <div className="managed-user" key={user.id}><Avatar initials={user.email.slice(0, 2).toUpperCase()} /><span><strong>{user.email}</strong><small>{user.role}</small></span><Status status={user.is_active ? 'Active' : 'Inactive'} /><button className="secondary-button" onClick={() => void toggleUser(user)}>{user.is_active ? 'Deactivate' : 'Reactivate'}</button></div>)}</div></>}</>}
        {tab === 'Notifications' && <><div className="panel-head"><div><h2>Notification preferences</h2><p>Choose which operational updates your team receives.</p></div></div><div className="notification-settings">{[['Appointment reminders', 'Send a reminder 24 hours before appointments.'], ['Schedule changes', 'Notify care teams when a visit is rescheduled or cancelled.'], ['Weekly activity summary', 'Receive a Monday morning operations report.'], ['Billing updates', 'Notify staff when an invoice is paid or overdue.']].map(([title, text]) => <div className="settings-access" key={title}><span><strong>{title}</strong><small>{text}</small></span><label className="toggle"><input type="checkbox" defaultChecked /><i /></label></div>)}</div></>}
        {tab === 'Account' && <><div className="panel-head"><div><h2>Account</h2><p>Signed in as Alex Morgan.</p></div></div><div className="account-summary"><Avatar initials="AM" tone="navy" /><div><strong>Alex Morgan</strong><span>{role} account</span></div></div><div className="settings-access"><span><strong>Security</strong><small>Passwords are hashed by the backend and API access is role-restricted.</small></span><ShieldCheck size={19} color="#329689" /></div><p className="account-hint">Use the account menu in the top bar to sign out.</p></>}
      </section>
    </div></>
}

function RecordModal({ kind, row, patients, doctors, onClose, onSave }: { kind: Kind; row?: Row; patients: Row[]; doctors: Row[]; onClose: () => void; onSave: (values: Row) => void }) {
  const options = departments.map((item) => item.name)
  const config: Record<Kind, { title: string; fields: { key: string; label: string; type?: string; options?: string[]; required?: boolean }[] }> = {
    patient: { title: 'patient', fields: [{ key: 'name', label: 'Full name', required: true }, { key: 'email', label: 'Email address', type: 'email', required: true }, { key: 'phone', label: 'Phone number', required: true }, { key: 'dob', label: 'Date of birth', type: 'date' }, { key: 'gender', label: 'Gender', options: ['Female', 'Male', 'Non-binary', 'Prefer not to say'] }, { key: 'department', label: 'Department', options }, { key: 'emergencyName', label: 'Emergency contact name' }, { key: 'emergencyPhone', label: 'Emergency contact phone' }, { key: 'history', label: 'Relevant medical history' }, { key: 'status', label: 'Status', options: ['Active', 'Inactive'] }] },
    doctor: { title: 'doctor', fields: [{ key: 'name', label: 'Doctor name', required: true }, { key: 'email', label: 'Email address', type: 'email', required: true }, { key: 'phone', label: 'Phone number', required: true }, { key: 'specialty', label: 'Specialty', required: true }, { key: 'department', label: 'Department', options }, { key: 'fee', label: 'Consultation fee', required: true }, { key: 'availability', label: 'Availability' }, { key: 'status', label: 'Status', options: ['Available', 'In surgery', 'On leave'] }] },
    appointment: { title: 'appointment', fields: [{ key: 'patient', label: 'Patient', options: patients.map((item) => item.name), required: true }, { key: 'doctor', label: 'Doctor', options: doctors.map((item) => item.name), required: true }, { key: 'department', label: 'Department', options, required: true }, { key: 'date', label: 'Date', type: 'date', required: true }, { key: 'time', label: 'Available time', options: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '01:00 PM', '01:30 PM', '02:00 PM'], required: true }, { key: 'status', label: 'Status', options: ['Scheduled', 'Confirmed', 'Completed', 'Cancelled'] }] },
    record: { title: 'medical record', fields: [{ key: 'patient', label: 'Patient', options: patients.map((item) => item.name), required: true }, { key: 'doctor', label: 'Attending doctor', options: doctors.map((item) => item.name), required: true }, { key: 'type', label: 'Visit type', options: ['Consultation', 'Follow-up visit', 'Treatment', 'Emergency'], required: true }, { key: 'diagnosis', label: 'Diagnosis', required: true }, { key: 'symptoms', label: 'Symptoms' }, { key: 'treatment', label: 'Treatment notes' }, { key: 'followUp', label: 'Follow-up date', type: 'date' }, { key: 'medicine', label: 'Prescription medicine' }, { key: 'strength', label: 'Medicine strength' }, { key: 'dosage', label: 'Dosage' }, { key: 'frequency', label: 'Frequency' }, { key: 'duration', label: 'Duration' }] },
    invoice: { title: 'invoice', fields: [{ key: 'patient', label: 'Patient', options: patients.map((item) => item.name), required: true }, { key: 'department', label: 'Department', options }, { key: 'amount', label: 'Amount', required: true }, { key: 'date', label: 'Invoice date', type: 'date', required: true }, { key: 'status', label: 'Payment status', options: ['Paid', 'Pending', 'Overdue'] }] },
  }
  const fields = config[kind]
  const [values, setValues] = useState<Row>(row || {})
  const [error, setError] = useState('')
  const update = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }))
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const missing = fields.fields.find((field) => field.required && !values[field.key]?.trim())
    if (missing) { setError(`${missing.label} is required.`); return }
    const output = { ...values }
    if (kind === 'appointment' && !output.status) output.status = 'Scheduled'
    if (kind === 'doctor' && !output.status) output.status = 'Available'
    if (kind === 'invoice' && !output.amount.startsWith('$')) output.amount = `$${Number(output.amount || 0).toFixed(2)}`
    if (kind === 'patient' && !row) output.joined = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    if (kind === 'record' && !output.date) output.date = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    onSave(output)
  }
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent aria-describedby={undefined}><div className="modal-head"><div><div className="date-kicker">CARE OPERATIONS</div><DialogTitle className="dialog-heading">{row ? 'Edit' : 'New'} {fields.title}</DialogTitle></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div><form onSubmit={submit}><div className="modal-fields">{fields.fields.map((field) => <label className="field-label" key={field.key}>{field.label}{field.options ? <select className="form-input" value={values[field.key] || ''} onChange={(event) => update(field.key, event.target.value)}><option value="">Select {field.label.toLowerCase()}</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : <input className="form-input" type={field.type || 'text'} value={values[field.key] || ''} onChange={(event) => update(field.key, event.target.value)} required={field.required} />}</label>)}</div>{error && <div className="form-alert">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={16} />{row ? 'Save changes' : 'Create record'}</button></div></form></DialogContent></Dialog>
}