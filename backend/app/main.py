import os
import secrets
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, schemas
from .database import Base, SessionLocal, engine, get_db
from .security import create_access_token, decode_access_token, hash_password, verify_password

@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="MediCare Hospital API", version="1.0.0", lifespan=lifespan)
origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(CORSMiddleware, allow_origins=[origin], allow_credentials=True, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])
oauth_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def initialize_database():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        defaults = [
            ("Cardiology", "Heart and vascular care", Decimal("180.00")),
            ("Neurology", "Brain and nervous system", Decimal("160.00")),
            ("Orthopedics", "Bone and joint care", Decimal("150.00")),
            ("Pediatrics", "Care for infants and children", Decimal("130.00")),
            ("General Medicine", "Primary and preventive care", Decimal("100.00")),
        ]
        for name, description, fee in defaults:
            if not db.scalar(select(models.Department).where(models.Department.name == name)):
                db.add(models.Department(name=name, description=description, consultation_fee=fee))
        admin_email = os.getenv("BOOTSTRAP_ADMIN_EMAIL")
        admin_password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD")
        if admin_email and admin_password and not db.scalar(select(models.User).where(models.User.email == admin_email.lower())):
            db.add(models.User(email=admin_email.lower(), username=admin_email.lower(), password_hash=hash_password(admin_password), role="Administrator"))
        db.commit()


def current_user(token: str = Depends(oauth_scheme), db: Session = Depends(get_db)) -> models.User:
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired credentials.", headers={"WWW-Authenticate": "Bearer"})
    user = db.get(models.User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account is inactive or does not exist.")
    return user


def require_roles(*roles: str):
    def check(user: models.User = Depends(current_user)) -> models.User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Your role cannot access this resource.")
        return user
    return check


def patient_dict(patient: models.Patient) -> dict:
    return {"id": patient.id, "patient_number": patient.patient_number, "full_name": patient.full_name, "email": patient.email, "phone": patient.phone, "date_of_birth": patient.date_of_birth, "gender": patient.gender, "address": patient.address, "emergency_contact_name": patient.emergency_contact_name, "emergency_contact_phone": patient.emergency_contact_phone, "medical_history": patient.medical_history, "is_active": patient.is_active, "created_at": patient.created_at}


def doctor_dict(doctor: models.Doctor) -> dict:
    return {"id": doctor.id, "doctor_number": doctor.doctor_number, "full_name": doctor.full_name, "email": doctor.email, "phone": doctor.phone, "department_id": doctor.department_id, "department": doctor.department.name, "specialization": doctor.specialization, "consultation_fee": doctor.consultation_fee, "availability": doctor.availability, "is_active": doctor.is_active}


def appointment_dict(appointment: models.Appointment) -> dict:
    return {"id": appointment.id, "patient_id": appointment.patient_id, "patient": appointment.patient.full_name, "doctor_id": appointment.doctor_id, "doctor": appointment.doctor.full_name, "department_id": appointment.department_id, "department": appointment.department.name, "starts_at": appointment.starts_at, "ends_at": appointment.ends_at, "status": appointment.status, "notes": appointment.notes}


def record_dict(record: models.MedicalRecord) -> dict:
    return {"id": record.id, "patient_id": record.patient_id, "patient": record.patient.full_name, "doctor_id": record.doctor_id, "doctor": record.doctor.full_name, "appointment_id": record.appointment_id, "visit_type": record.visit_type, "symptoms": record.symptoms, "diagnosis": record.diagnosis, "treatment_notes": record.treatment_notes, "follow_up_at": record.follow_up_at, "created_at": record.created_at}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "MediCare Hospital API"}


@app.post("/api/auth/register", status_code=201)
def register(data: schemas.UserRegister, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(models.User).where(or_(models.User.email == email, models.User.username == email))):
        raise HTTPException(status_code=409, detail="An account already exists for this email.")
    patient = models.Patient(patient_number=f"PT-{secrets.token_hex(4).upper()}", full_name=data.full_name, email=email)
    user = models.User(email=email, username=email, password_hash=hash_password(data.password), role="Patient")
    try:
        db.add(user)
        db.flush()
        patient.user_id = user.id
        db.add(patient)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Unable to create an account with those details.")
    return {"id": user.id, "role": user.role, "patient_id": patient.id}


@app.post("/api/auth/login", response_model=schemas.TokenOutput)
def login(data: schemas.LoginInput, db: Session = Depends(get_db)):
    identity = data.username.lower()
    user = db.scalar(select(models.User).where(or_(models.User.email == identity, models.User.username == identity)))
    if not user or not user.is_active or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    return {"access_token": create_access_token(user.id, user.role), "role": user.role}


@app.get("/api/auth/me")
def who_am_i(user: models.User = Depends(current_user)):
    return {"id": user.id, "email": user.email, "username": user.username, "role": user.role}


@app.get("/api/users")
def list_users(db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator"))):
    users = db.scalars(select(models.User).order_by(models.User.created_at.desc())).all()
    return [{"id": user.id, "email": user.email, "username": user.username, "role": user.role, "is_active": user.is_active, "created_at": user.created_at} for user in users]


@app.post("/api/users", status_code=201)
def create_staff_user(data: schemas.StaffUserCreate, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator"))):
    email = data.email.lower()
    if db.scalar(select(models.User).where(or_(models.User.email == email, models.User.username == email))):
        raise HTTPException(status_code=409, detail="An account already exists for this email.")
    doctor = None
    if data.role == "Doctor":
        doctor = db.get(models.Doctor, data.doctor_id) if data.doctor_id else None
        if not doctor or not doctor.is_active or doctor.user_id:
            raise HTTPException(status_code=422, detail="Choose an active doctor without an account.")
    elif data.doctor_id:
        raise HTTPException(status_code=422, detail="A doctor profile can only be linked to a doctor account.")
    user = models.User(email=email, username=email, password_hash=hash_password(data.password), role=data.role)
    db.add(user)
    db.flush()
    if doctor:
        doctor.user_id = user.id
    db.commit()
    return {"id": user.id, "email": user.email, "username": user.username, "role": user.role, "is_active": user.is_active}


@app.patch("/api/users/{user_id}/active")
def set_user_active(user_id: int, data: schemas.UserActiveInput, db: Session = Depends(get_db), actor: models.User = Depends(require_roles("Administrator"))):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if actor.id == user.id and not data.is_active:
        raise HTTPException(status_code=422, detail="You cannot deactivate your own account.")
    user.is_active = data.is_active
    db.commit()
    return {"id": user.id, "email": user.email, "role": user.role, "is_active": user.is_active}


@app.get("/api/dashboard/stats")
def dashboard_stats(db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator", "Doctor", "Receptionist"))):
    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())
    return {
        "total_patients": db.scalar(select(func.count()).select_from(models.Patient).where(models.Patient.is_active.is_(True))) or 0,
        "registered_doctors": db.scalar(select(func.count()).select_from(models.Doctor).where(models.Doctor.is_active.is_(True))) or 0,
        "todays_appointments": db.scalar(select(func.count()).select_from(models.Appointment).where(models.Appointment.starts_at.between(start, end), models.Appointment.status != "Cancelled")) or 0,
        "available_beds": 128,
        "department_appointments": [{"department": name, "appointments": count} for name, count in db.execute(select(models.Department.name, func.count(models.Appointment.id)).outerjoin(models.Appointment, and_(models.Appointment.department_id == models.Department.id, models.Appointment.starts_at >= datetime(today.year, today.month, 1))).group_by(models.Department.id)).all()],
    }


@app.get("/api/patients")
def list_patients(q: str = "", active: bool | None = None, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator", "Doctor", "Receptionist"))):
    query = select(models.Patient).order_by(models.Patient.created_at.desc())
    if q:
        term = f"%{q.strip()}%"
        query = query.where(or_(models.Patient.full_name.ilike(term), models.Patient.email.ilike(term), models.Patient.patient_number.ilike(term), models.Patient.phone.ilike(term)))
    if active is not None:
        query = query.where(models.Patient.is_active.is_(active))
    return [patient_dict(item) for item in db.scalars(query).all()]


@app.post("/api/patients", status_code=201)
def create_patient(data: schemas.PatientInput, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator", "Receptionist"))):
    values = data.model_dump()
    values["email"] = values["email"] or ""
    patient = models.Patient(patient_number=f"PT-{secrets.token_hex(4).upper()}", **values)
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient_dict(patient)


@app.put("/api/patients/{patient_id}")
def update_patient(patient_id: int, data: schemas.PatientInput, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator", "Receptionist"))):
    patient = db.get(models.Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
    values = data.model_dump()
    values["email"] = values["email"] or ""
    for key, value in values.items():
        setattr(patient, key, value)
    db.commit()
    return patient_dict(patient)


@app.delete("/api/patients/{patient_id}", status_code=204)
def deactivate_patient(patient_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator"))):
    patient = db.get(models.Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
    patient.is_active = False
    db.commit()


@app.get("/api/doctors")
def list_doctors(q: str = "", db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator", "Doctor", "Receptionist", "Patient"))):
    query = select(models.Doctor).join(models.Department).where(models.Doctor.is_active.is_(True)).order_by(models.Doctor.full_name)
    if q:
        term = f"%{q.strip()}%"
        query = query.where(or_(models.Doctor.full_name.ilike(term), models.Doctor.specialization.ilike(term), models.Department.name.ilike(term)))
    return [doctor_dict(item) for item in db.scalars(query).all()]


@app.post("/api/doctors", status_code=201)
def create_doctor(data: schemas.DoctorInput, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator"))):
    if not db.get(models.Department, data.department_id):
        raise HTTPException(status_code=422, detail="Department does not exist.")
    values = data.model_dump()
    values["email"] = values["email"] or ""
    doctor = models.Doctor(doctor_number=f"DR-{secrets.token_hex(4).upper()}", **values)
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor_dict(doctor)


@app.put("/api/doctors/{doctor_id}")
def update_doctor(doctor_id: int, data: schemas.DoctorInput, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator"))):
    doctor = db.get(models.Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    values = data.model_dump()
    values["email"] = values["email"] or ""
    for key, value in values.items():
        setattr(doctor, key, value)
    db.commit()
    return doctor_dict(doctor)


@app.delete("/api/doctors/{doctor_id}", status_code=204)
def deactivate_doctor(doctor_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator"))):
    doctor = db.get(models.Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    doctor.is_active = False
    db.commit()


@app.get("/api/departments")
def list_departments(db: Session = Depends(get_db), _: models.User = Depends(current_user)):
    return [{"id": item.id, "name": item.name, "description": item.description, "consultation_fee": item.consultation_fee} for item in db.scalars(select(models.Department).where(models.Department.is_active.is_(True)).order_by(models.Department.name)).all()]


def ensure_appointment_access(user: models.User, appointment: models.Appointment, db: Session):
    if user.role == "Patient":
        patient = db.scalar(select(models.Patient).where(models.Patient.user_id == user.id))
        if not patient or patient.id != appointment.patient_id:
            raise HTTPException(status_code=404, detail="Appointment not found.")
    if user.role == "Doctor":
        doctor = db.scalar(select(models.Doctor).where(models.Doctor.user_id == user.id))
        if not doctor or doctor.id != appointment.doctor_id:
            raise HTTPException(status_code=404, detail="Appointment not found.")


@app.get("/api/appointments")
def list_appointments(q: str = "", from_at: datetime | None = None, to_at: datetime | None = None, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    query = select(models.Appointment).join(models.Patient).join(models.Doctor).join(models.Department).order_by(models.Appointment.starts_at)
    if from_at:
        query = query.where(models.Appointment.starts_at >= from_at)
    if to_at:
        query = query.where(models.Appointment.starts_at < to_at)
    if q:
        term = f"%{q.strip()}%"
        query = query.where(or_(models.Patient.full_name.ilike(term), models.Doctor.full_name.ilike(term), models.Department.name.ilike(term)))
    if user.role == "Patient":
        patient = db.scalar(select(models.Patient).where(models.Patient.user_id == user.id))
        query = query.where(models.Appointment.patient_id == (patient.id if patient else -1))
    elif user.role == "Doctor":
        doctor = db.scalar(select(models.Doctor).where(models.Doctor.user_id == user.id))
        query = query.where(models.Appointment.doctor_id == (doctor.id if doctor else -1))
    return [appointment_dict(item) for item in db.scalars(query).all()]


def save_appointment(data: schemas.AppointmentInput, db: Session, existing: models.Appointment | None = None):
    doctor = db.scalar(select(models.Doctor).where(models.Doctor.id == data.doctor_id, models.Doctor.is_active.is_(True)).with_for_update())
    patient = db.get(models.Patient, data.patient_id)
    department = db.get(models.Department, data.department_id)
    if not doctor or not patient or not patient.is_active or not department or doctor.department_id != department.id:
        raise HTTPException(status_code=422, detail="Choose an active patient, doctor, and matching department.")
    conflict_query = select(models.Appointment.id).where(
        models.Appointment.doctor_id == data.doctor_id,
        models.Appointment.status != "Cancelled",
        models.Appointment.starts_at < data.ends_at,
        models.Appointment.ends_at > data.starts_at,
    )
    if existing:
        conflict_query = conflict_query.where(models.Appointment.id != existing.id)
    if db.scalar(conflict_query.limit(1)):
        raise HTTPException(status_code=409, detail="The doctor already has an appointment during this time.")
    if existing:
        for key, value in data.model_dump().items():
            setattr(existing, key, value)
        return existing
    appointment = models.Appointment(**data.model_dump(), status="Scheduled")
    db.add(appointment)
    return appointment


@app.post("/api/appointments", status_code=201)
def create_appointment(data: schemas.AppointmentInput, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator", "Receptionist"))):
    try:
        appointment = save_appointment(data, db)
        db.commit()
        db.refresh(appointment)
        return appointment_dict(appointment)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That appointment time is already booked.")


@app.put("/api/appointments/{appointment_id}")
def update_appointment(appointment_id: int, data: schemas.AppointmentInput, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator", "Receptionist"))):
    appointment = db.get(models.Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    try:
        save_appointment(data, db, appointment)
        db.commit()
        db.refresh(appointment)
        return appointment_dict(appointment)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That appointment time is already booked.")


@app.patch("/api/appointments/{appointment_id}/status")
def update_appointment_status(appointment_id: int, data: schemas.AppointmentStatus, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator", "Doctor", "Receptionist"))):
    appointment = db.get(models.Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    appointment.status = data.status
    db.commit()
    return appointment_dict(appointment)


@app.get("/api/medical-records")
def list_medical_records(patient_id: int | None = None, db: Session = Depends(get_db), user: models.User = Depends(require_roles("Administrator", "Doctor", "Patient"))):
    query = select(models.MedicalRecord).join(models.Patient).join(models.Doctor).order_by(models.MedicalRecord.created_at.desc())
    if user.role == "Patient":
        patient = db.scalar(select(models.Patient).where(models.Patient.user_id == user.id))
        query = query.where(models.MedicalRecord.patient_id == (patient.id if patient else -1))
    elif user.role == "Doctor":
        doctor = db.scalar(select(models.Doctor).where(models.Doctor.user_id == user.id))
        query = query.where(models.MedicalRecord.doctor_id == (doctor.id if doctor else -1))
    elif patient_id:
        query = query.where(models.MedicalRecord.patient_id == patient_id)
    return [record_dict(item) for item in db.scalars(query).all()]


@app.post("/api/medical-records", status_code=201)
def create_medical_record(data: schemas.MedicalRecordInput, db: Session = Depends(get_db), user: models.User = Depends(require_roles("Administrator", "Doctor"))):
    if not db.get(models.Patient, data.patient_id) or not db.get(models.Doctor, data.doctor_id):
        raise HTTPException(status_code=422, detail="Patient or doctor does not exist.")
    if user.role == "Doctor":
        doctor = db.scalar(select(models.Doctor).where(models.Doctor.user_id == user.id))
        if not doctor or doctor.id != data.doctor_id:
            raise HTTPException(status_code=403, detail="Doctors may only add records to their own visits.")
    record = models.MedicalRecord(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record_dict(record)


@app.put("/api/medical-records/{record_id}")
def update_medical_record(record_id: int, data: schemas.MedicalRecordInput, db: Session = Depends(get_db), user: models.User = Depends(require_roles("Administrator", "Doctor"))):
    record = db.get(models.MedicalRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found.")
    if user.role == "Doctor":
        doctor = db.scalar(select(models.Doctor).where(models.Doctor.user_id == user.id))
        if not doctor or doctor.id != record.doctor_id or doctor.id != data.doctor_id:
            raise HTTPException(status_code=403, detail="Doctors may only update their own patient records.")
    if not db.get(models.Patient, data.patient_id) or not db.get(models.Doctor, data.doctor_id):
        raise HTTPException(status_code=422, detail="Patient or doctor does not exist.")
    for key, value in data.model_dump().items():
        setattr(record, key, value)
    db.commit()
    return record_dict(record)


@app.get("/api/medical-records/{record_id}/prescriptions")
def list_prescriptions(record_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_roles("Administrator", "Doctor", "Patient"))):
    record = db.get(models.MedicalRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found.")
    if user.role == "Patient":
        patient = db.scalar(select(models.Patient).where(models.Patient.user_id == user.id))
        if not patient or patient.id != record.patient_id:
            raise HTTPException(status_code=404, detail="Medical record not found.")
    if user.role == "Doctor":
        doctor = db.scalar(select(models.Doctor).where(models.Doctor.user_id == user.id))
        if not doctor or doctor.id != record.doctor_id:
            raise HTTPException(status_code=404, detail="Medical record not found.")
    rows = db.scalars(select(models.Prescription).where(models.Prescription.medical_record_id == record_id)).all()
    return [{"id": item.id, "medicine": item.medicine.name, "strength": item.medicine.strength, "dosage": item.dosage, "frequency": item.frequency, "duration": item.duration, "instructions": item.instructions} for item in rows]


@app.post("/api/prescriptions", status_code=201)
def create_prescription(data: schemas.PrescriptionInput, db: Session = Depends(get_db), user: models.User = Depends(require_roles("Administrator", "Doctor"))):
    record = db.get(models.MedicalRecord, data.medical_record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found.")
    if user.role == "Doctor":
        doctor = db.scalar(select(models.Doctor).where(models.Doctor.user_id == user.id))
        if not doctor or doctor.id != record.doctor_id:
            raise HTTPException(status_code=403, detail="Doctors may only prescribe for their own patients.")
    medicine = db.scalar(select(models.Medicine).where(func.lower(models.Medicine.name) == data.medicine_name.lower(), models.Medicine.strength == data.strength))
    if not medicine:
        medicine = models.Medicine(name=data.medicine_name, strength=data.strength)
        db.add(medicine)
        db.flush()
    prescription = models.Prescription(medical_record_id=data.medical_record_id, medicine_id=medicine.id, dosage=data.dosage, frequency=data.frequency, duration=data.duration, instructions=data.instructions)
    db.add(prescription)
    db.commit()
    return {"id": prescription.id, "medicine": medicine.name, "strength": medicine.strength, "dosage": prescription.dosage, "frequency": prescription.frequency, "duration": prescription.duration, "instructions": prescription.instructions}


@app.get("/api/invoices")
def list_invoices(patient_id: int | None = None, payment_status: str | None = None, from_date: date | None = None, to_date: date | None = None, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    query = select(models.Invoice).join(models.Patient).order_by(models.Invoice.created_at.desc())
    if user.role == "Patient":
        patient = db.scalar(select(models.Patient).where(models.Patient.user_id == user.id))
        query = query.where(models.Invoice.patient_id == (patient.id if patient else -1))
    elif patient_id:
        query = query.where(models.Invoice.patient_id == patient_id)
    if payment_status:
        query = query.where(models.Invoice.status == payment_status)
    if from_date:
        query = query.where(func.date(models.Invoice.created_at) >= from_date)
    if to_date:
        query = query.where(func.date(models.Invoice.created_at) <= to_date)
    return [{"id": item.id, "invoice_number": item.invoice_number, "patient_id": item.patient_id, "patient": item.patient.full_name, "amount": item.amount, "currency": item.currency, "status": item.status, "due_at": item.due_at, "created_at": item.created_at} for item in db.scalars(query).all()]


@app.post("/api/invoices", status_code=201)
def create_invoice(data: schemas.InvoiceInput, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator", "Receptionist"))):
    if not db.get(models.Patient, data.patient_id):
        raise HTTPException(status_code=422, detail="Patient does not exist.")
    invoice = models.Invoice(invoice_number=f"INV-{secrets.token_hex(5).upper()}", **data.model_dump())
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return {"id": invoice.id, "invoice_number": invoice.invoice_number, "patient_id": invoice.patient_id, "amount": invoice.amount, "status": invoice.status, "due_at": invoice.due_at}


@app.post("/api/invoices/{invoice_id}/payments", status_code=201)
def process_payment(invoice_id: int, data: schemas.PaymentInput, db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator", "Receptionist"))):
    invoice = db.scalar(select(models.Invoice).where(models.Invoice.id == invoice_id).with_for_update())
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if invoice.status == "Paid":
        raise HTTPException(status_code=409, detail="This invoice has already been paid.")
    if data.amount != invoice.amount:
        raise HTTPException(status_code=422, detail="Payment amount must match the invoice balance.")
    payment = models.Payment(invoice_id=invoice.id, amount=data.amount, method=data.method, reference=data.reference, status="Succeeded")
    invoice.status = "Paid"
    db.add(payment)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Payment reference has already been used.")
    return {"payment_id": payment.id, "invoice_id": invoice.id, "status": invoice.status, "amount": payment.amount, "method": payment.method}


@app.get("/api/reports/summary")
def reports_summary(db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator", "Doctor"))):
    today = date.today()
    month_start = datetime(today.year, today.month, 1)
    return {
        "appointments_this_month": db.scalar(select(func.count()).select_from(models.Appointment).where(models.Appointment.starts_at >= month_start)) or 0,
        "patient_registrations_this_month": db.scalar(select(func.count()).select_from(models.Patient).where(models.Patient.created_at >= month_start)) or 0,
        "revenue_paid": db.scalar(select(func.coalesce(func.sum(models.Payment.amount), 0)).where(models.Payment.status == "Succeeded")) or Decimal("0.00"),
        "department_appointments": [{"department": name, "appointments": count} for name, count in db.execute(select(models.Department.name, func.count(models.Appointment.id)).outerjoin(models.Appointment, models.Appointment.department_id == models.Department.id).group_by(models.Department.id)).all()],
    }


@app.get("/api/dashboard/trend")
def dashboard_trend(db: Session = Depends(get_db), _: models.User = Depends(require_roles("Administrator", "Doctor", "Receptionist"))):
    today = date.today()
    start_day = today - timedelta(days=6)
    start_at = datetime.combine(start_day, datetime.min.time())
    appointment_counts = dict(db.execute(select(func.date(models.Appointment.starts_at), func.count(models.Appointment.id)).where(models.Appointment.starts_at >= start_at, models.Appointment.status != "Cancelled").group_by(func.date(models.Appointment.starts_at))).all())
    patient_counts = dict(db.execute(select(func.date(models.Patient.created_at), func.count(models.Patient.id)).where(models.Patient.created_at >= start_at).group_by(func.date(models.Patient.created_at))).all())
    return [{"day": (day := start_day + timedelta(days=index)).strftime("%a"), "appointments": appointment_counts.get(day, 0), "patients": patient_counts.get(day, 0)} for index in range(7)]