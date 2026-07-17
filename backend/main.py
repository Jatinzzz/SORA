from fastapi import FastAPI
import models
from routes import auth, admin, sessions, attendance, face, classes, leave, analytics
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://drift-oil-squealer.ngrok-free.dev"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(sessions.router)
app.include_router(attendance.router)
app.include_router(face.router)
app.include_router(classes.router)
app.include_router(leave.router)
app.include_router(analytics.router)

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")

@app.get("/{full_path:path}")
def serve_frontend(full_path: str):
    return FileResponse(os.path.join(frontend_path, "index.html"))

@app.get("/")
def read_root():
    return {"message": "Backend is running"}