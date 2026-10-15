import os
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

_temporary = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
_database = Path(_temporary.name, "medicare-test.db").as_posix()
os.environ["DATABASE_URL"] = f"sqlite:///{_database}"
os.environ["JWT_SECRET_KEY"] = "test-only-secret-key-long-enough-for-local-tests"
os.environ["BOOTSTRAP_ADMIN_EMAIL"] = "admin@example.com"
os.environ["BOOTSTRAP_ADMIN_PASSWORD"] = "test-admin-password-2026"

from backend.app.main import app


def test_role_protected_clinical_workflow_and_transactions():
    with TestClient(app) as client:
        login = client.post("/api/auth/login", json={"username": "admin@example.com", "password": "test-admin-password-2026"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        stats = client.get("/api/dashboard/stats", headers=headers)
        trend = client.get("/api/dashboard/trend", headers=headers)
        assert stats.status_code == 200 and stats.json()["available_beds"] == 128
        assert trend.status_code == 200 and len(trend.json()) == 7

        departments = client.get("/api/departments", headers=headers).json()
        cardiology_id = next(item["id"] for item in departments if item["name"] == "Cardiology")
        patient = client.post("/api/patients", headers=headers, json={"full_name": "Taylor Demo", "email": "taylor@patient.example.com", "phone": "+1 555 0100"})
        assert patient.status_code == 201, patient.json()
        doctor = client.post("/api/doctors", headers=headers, json={"full_name": "Dr. Avery Demo", "email": "avery@doctor.example.com", "department_id": cardiology_id, "specialization": "Cardiology", "consultation_fee": "180.00", "availability": ["Tuesday"]})
        assert doctor.status_code == 201, doctor.json()

        appointment_data = {"patient_id": patient.json()["id"], "doctor_id": doctor.json()["id"], "department_id": cardiology_id, "starts_at": "2030-10-15T09:00:00", "ends_at": "2030-10-15T09:30:00"}
        appointment = client.post("/api/appointments", headers=headers, json=appointment_data)
        assert appointment.status_code == 201
        overlapping = {**appointment_data, "starts_at": "2030-10-15T09:15:00", "ends_at": "2030-10-15T09:45:00"}
        assert client.post("/api/appointments", headers=headers, json=overlapping).status_code == 409

        medical_record = client.post("/api/medical-records", headers=headers, json={"patient_id": patient.json()["id"], "doctor_id": doctor.json()["id"], "visit_type": "Consultation", "diagnosis": "Demo diagnosis"})
        assert medical_record.status_code == 201
        prescription = client.post("/api/prescriptions", headers=headers, json={"medical_record_id": medical_record.json()["id"], "medicine_name": "Demo medicine", "dosage": "1 tablet", "frequency": "Once daily", "duration": "7 days"})
        assert prescription.status_code == 201
        assert client.get(f"/api/medical-records/{medical_record.json()['id']}/prescriptions", headers=headers).json()[0]["medicine"] == "Demo medicine"

        invoice = client.post("/api/invoices", headers=headers, json={"patient_id": patient.json()["id"], "amount": "180.00"})
        assert invoice.status_code == 201
        payment_data = {"amount": "180.00", "method": "Cash", "reference": "TEST-PAY-0001"}
        assert client.post(f"/api/invoices/{invoice.json()['id']}/payments", headers=headers, json=payment_data).status_code == 201
        assert client.post(f"/api/invoices/{invoice.json()['id']}/payments", headers=headers, json={**payment_data, "reference": "TEST-PAY-0002"}).status_code == 409

        staff = client.post("/api/users", headers=headers, json={"email": "avery@doctor.example.com", "password": "doctor-password-2026", "role": "Doctor", "doctor_id": doctor.json()["id"]})
        assert staff.status_code == 201, staff.json()
        doctor_login = client.post("/api/auth/login", json={"username": "avery@doctor.example.com", "password": "doctor-password-2026"})
        doctor_headers = {"Authorization": f"Bearer {doctor_login.json()['access_token']}"}
        assert len(client.get("/api/medical-records", headers=doctor_headers).json()) == 1
        assert client.post("/api/patients", headers=doctor_headers, json={"full_name": "Unauthorized Demo"}).status_code == 403

        registration = client.post("/api/auth/register", json={"full_name": "Casey Demo", "email": "casey@patient.example.com", "password": "patient-password-2026"})
        patient_login = client.post("/api/auth/login", json={"username": "casey@patient.example.com", "password": "patient-password-2026"})
        patient_headers = {"Authorization": f"Bearer {patient_login.json()['access_token']}"}
        assert registration.status_code == 201
        assert client.get("/api/patients", headers=patient_headers).status_code == 403
        assert client.get("/api/medical-records", headers=patient_headers).json() == []