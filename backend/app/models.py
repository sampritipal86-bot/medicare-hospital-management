from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(24), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False)


class Department(Base):
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(255), default="")
    consultation_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Patient(Base):
    __tablename__ = "patients"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_number: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), unique=True)
    full_name: Mapped[str] = mapped_column(String(160), index=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str] = mapped_column(String(30), default="")
    email: Mapped[str] = mapped_column(String(254), default="", index=True)
    phone: Mapped[str] = mapped_column(String(32), default="")
    address: Mapped[str] = mapped_column(String(255), default="")
    emergency_contact_name: Mapped[str] = mapped_column(String(160), default="")
    emergency_contact_phone: Mapped[str] = mapped_column(String(32), default="")
    medical_history: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False)


class Doctor(Base):
    __tablename__ = "doctors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    doctor_number: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), unique=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id", ondelete="RESTRICT"), index=True)
    full_name: Mapped[str] = mapped_column(String(160), index=True)
    email: Mapped[str] = mapped_column(String(254), default="", index=True)
    phone: Mapped[str] = mapped_column(String(32), default="")
    specialization: Mapped[str] = mapped_column(String(120), default="")
    consultation_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    availability: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    department: Mapped[Department] = relationship()


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        UniqueConstraint("doctor_id", "starts_at", name="uq_appointment_doctor_start"),
        Index("ix_appointments_doctor_time", "doctor_id", "starts_at", "ends_at"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="RESTRICT"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id", ondelete="RESTRICT"), index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id", ondelete="RESTRICT"), index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(20), default="Scheduled", index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    patient: Mapped[Patient] = relationship()
    doctor: Mapped[Doctor] = relationship()
    department: Mapped[Department] = relationship()


class MedicalRecord(Base):
    __tablename__ = "medical_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="RESTRICT"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id", ondelete="RESTRICT"), index=True)
    appointment_id: Mapped[int | None] = mapped_column(ForeignKey("appointments.id", ondelete="SET NULL"), index=True)
    visit_type: Mapped[str] = mapped_column(String(50), default="Consultation")
    symptoms: Mapped[str] = mapped_column(Text, default="")
    diagnosis: Mapped[str] = mapped_column(Text, default="")
    treatment_notes: Mapped[str] = mapped_column(Text, default="")
    follow_up_at: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False, index=True)
    patient: Mapped[Patient] = relationship()
    doctor: Mapped[Doctor] = relationship()


class Medicine(Base):
    __tablename__ = "medicines"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    strength: Mapped[str] = mapped_column(String(80), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Prescription(Base):
    __tablename__ = "prescriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    medical_record_id: Mapped[int] = mapped_column(ForeignKey("medical_records.id", ondelete="CASCADE"), index=True)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id", ondelete="RESTRICT"), index=True)
    dosage: Mapped[str] = mapped_column(String(100))
    frequency: Mapped[str] = mapped_column(String(100))
    duration: Mapped[str] = mapped_column(String(100))
    instructions: Mapped[str] = mapped_column(Text, default="")
    medicine: Mapped[Medicine] = relationship()


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="RESTRICT"), index=True)
    appointment_id: Mapped[int | None] = mapped_column(ForeignKey("appointments.id", ondelete="SET NULL"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    status: Mapped[str] = mapped_column(String(20), default="Pending", index=True)
    due_at: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False, index=True)
    patient: Mapped[Patient] = relationship()


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="RESTRICT"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    method: Mapped[str] = mapped_column(String(30))
    reference: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="Succeeded")
    paid_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False)