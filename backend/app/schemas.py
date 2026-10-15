from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class StaffUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    role: Literal["Doctor", "Receptionist", "Administrator"]
    doctor_id: int | None = Field(default=None, gt=0)


class UserActiveInput(BaseModel):
    is_active: bool


class LoginInput(BaseModel):
    username: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class TokenOutput(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class PatientInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr | None = None
    phone: str = Field(default="", max_length=32)
    date_of_birth: date | None = None
    gender: str = Field(default="", max_length=30)
    address: str = Field(default="", max_length=255)
    emergency_contact_name: str = Field(default="", max_length=160)
    emergency_contact_phone: str = Field(default="", max_length=32)
    medical_history: str = Field(default="", max_length=10000)


class DoctorInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr | None = None
    phone: str = Field(default="", max_length=32)
    department_id: int = Field(gt=0)
    specialization: str = Field(min_length=2, max_length=120)
    consultation_fee: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    availability: list[str] = Field(default_factory=list, max_length=14)


class AppointmentInput(BaseModel):
    patient_id: int = Field(gt=0)
    doctor_id: int = Field(gt=0)
    department_id: int = Field(gt=0)
    starts_at: datetime
    ends_at: datetime
    notes: str = Field(default="", max_length=5000)

    @field_validator("ends_at")
    @classmethod
    def validate_time_range(cls, ends_at: datetime, info):
        starts_at = info.data.get("starts_at")
        if starts_at and ends_at <= starts_at:
            raise ValueError("Appointment end must be later than its start.")
        if starts_at and (ends_at - starts_at).total_seconds() > 4 * 3600:
            raise ValueError("Appointment duration cannot exceed four hours.")
        return ends_at


class AppointmentStatus(BaseModel):
    status: Literal["Scheduled", "Confirmed", "Completed", "Cancelled"]


class MedicalRecordInput(BaseModel):
    patient_id: int = Field(gt=0)
    doctor_id: int = Field(gt=0)
    appointment_id: int | None = None
    visit_type: str = Field(default="Consultation", max_length=50)
    symptoms: str = Field(default="", max_length=10000)
    diagnosis: str = Field(default="", max_length=10000)
    treatment_notes: str = Field(default="", max_length=10000)
    follow_up_at: date | None = None


class InvoiceInput(BaseModel):
    patient_id: int = Field(gt=0)
    appointment_id: int | None = None
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    due_at: date | None = None


class PaymentInput(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    method: Literal["Cash", "Card", "Insurance", "Transfer"]
    reference: str = Field(min_length=6, max_length=100)


class PrescriptionInput(BaseModel):
    medical_record_id: int = Field(gt=0)
    medicine_name: str = Field(min_length=2, max_length=160)
    strength: str = Field(default="", max_length=80)
    dosage: str = Field(min_length=1, max_length=100)
    frequency: str = Field(min_length=1, max_length=100)
    duration: str = Field(min_length=1, max_length=100)
    instructions: str = Field(default="", max_length=5000)