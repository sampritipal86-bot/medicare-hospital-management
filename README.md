# MediCare

**Project title:** Design and Implementation of a Database Management System for Hospital Appointment and Patient Care Management System.

MediCare is a responsive hospital operations application with a React/TypeScript dashboard and a FastAPI service backed by MySQL. The dashboard, directories, appointment calendar, clinical records, billing, reports, and settings are designed as one workspace. All bundled patient and staff examples are fictional.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts, Lucide, and a Radix-based shadcn dialog primitive.
- Backend: FastAPI, SQLAlchemy 2, Pydantic, Argon2 password hashing, and JWT bearer authentication.
- Database: MySQL 8 or compatible MySQL server. SQLAlchemy creates the relational tables on API startup.

## Run The Demo

Requirements: Node.js 20 or newer, npm, Python 3.10 or newer, and MySQL 8.

Create the database and an application account using a MySQL administrator account:

```sql
CREATE DATABASE medicare CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'medicare_app'@'localhost' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON medicare.* TO 'medicare_app'@'localhost';
```

In PowerShell, prepare the backend environment:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

Edit `backend/.env` with the MySQL URL and long random JWT secret. Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` before the first run; this creates the initial Administrator account. Keep `.env` private and do not commit it.

Start the API in one PowerShell terminal:

```powershell
Push-Location backend
uvicorn app.main:app --reload
```

The API documentation is available at `http://localhost:8000/docs`.

In a second terminal, configure and run the frontend:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open the Vite URL printed in the terminal. Sign in with the bootstrap administrator credentials to use the MySQL-backed application. New patient accounts can be registered from the sign-in screen. Staff accounts and role assignments are managed in Settings by an Administrator; a Doctor account can be linked to a doctor profile there.

## Demo Mode

Choose **Explore demo workspace** on the sign-in screen to explore without a backend. Demo records are fictional and saved in browser local storage. Demo CRUD, search, status filters, pagination, appointment conflict checks, calendar views, and invoice payment actions work locally. Signing out of a connected session clears the server-backed lists from the in-memory UI before returning to the sign-in screen.

## Database And Security

SQLAlchemy defines Users, Patients, Doctors, Departments, Appointments, MedicalRecords, Prescriptions, Medicines, Invoices, and Payments with foreign keys, unique keys, and indexes. Appointment creation locks the doctor row, checks time overlap in a transaction, and also has a unique doctor/start-time constraint. Payment processing locks the invoice, validates its balance, and writes the payment and paid status in one transaction.

Passwords are Argon2-hashed. API routes enforce role permissions; the frontend does not contain database credentials. Use HTTPS, strong secrets, backups, database migrations, audit logging, and a reviewed privacy/security program before handling real patient information. The sample dashboard bed count and demo trends are illustrative; connected patient/doctor/appointment totals and the seven-day chart are queried from MySQL.

## Verification

```powershell
python -m compileall -q backend\app
pip install -r backend\requirements-dev.txt
python -m pytest -q backend\tests
npm run build
```

The integration test uses an isolated SQLite database to verify backend workflows without MySQL. `npm run build` checks TypeScript and produces the static frontend bundle once Node dependencies are installed. A MySQL-backed API smoke test requires the database and backend environment described above.