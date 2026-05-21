# Backend

Flask API and Socket.IO server. See the repository root README for setup and architecture (`docs/ARCHITECTURE.md`).

**Windows (recommended):**

```powershell
.\start.ps1
```

**Manual:**

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
flask --app app:create_app init-db
.\.venv\Scripts\python.exe run.py
```

Use the venv Python (`.\.venv\Scripts\python.exe`), not system `python`, or imports will fail.

```bash
python -m pytest tests/ -v
```
