from fastapi import FastAPI
import models
from routes import auth, admin, sessions, attendance, face, classes, leave, analytics
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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

@app.get("/")
def read_root():
    return {"message": "Backend is running"}