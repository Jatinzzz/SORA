# SORA
System Overview

The Smart Attendance System (SORA) is a full-stack web application designed to automate and secure the attendance-marking process in an educational institution, replacing manual roll-calls with a two-factor verification system combining QR codes and facial recognition.

The system supports three roles — Admin, Teacher, and Student — each with a dedicated dashboard. Teachers create courses and start attendance sessions, which generate a secure, auto-refreshing QR code. Students scan this QR code and complete a live facial verification against their enrolled face before their attendance is recorded — ensuring that attendance can only be marked by the actual student physically present, not a proxy. The system also supports manual attendance override for exceptional cases, a leave management workflow, and automatic attendance percentage calculation per course and overall, viewable by students, teachers, and admins.

Tools, Libraries & Technologies Used

Frontend

Tool	Purpose	Why it was used

React.js (Vite)	Building the user interface across all three dashboards	Component-based architecture made it easy to build reusable, role-specific dashboards; Vite offers a much faster development server than older tooling

React Router	Client-side routing and protected routes	Enables role-based navigation (e.g., redirecting students away from the teacher dashboard) without full page reloads

Axios	Making HTTP requests to the backend API	Simplifies API calls, supports request interceptors used to automatically attach the JWT auth token to every request
html5-qrcode	Scanning QR codes using the device camera	Provides reliable camera access and QR decoding directly in the browser, with no native app required
qrcode.react	Rendering QR codes on the teacher's screen	Converts the signed token string into an actual scannable QR image
Recharts	Displaying attendance data as pie charts	Gives students and teachers a clear visual breakdown of present/absent attendance
Lucide React	Icon set used across the UI	Lightweight, consistent icon library that integrates cleanly with React
Backend


Tool	Purpose	Why it was used


FastAPI (Python)	Core backend framework serving all API endpoints	Modern, high-performance framework with automatic interactive API documentation (/docs), which was used constantly for testing during development
SQLAlchemy	Object-Relational Mapper (ORM) for database interaction	Allows database tables to be defined and queried using Python classes instead of raw SQL, reducing errors and improving maintainability
Alembic	Database migration management	Tracks and applies schema changes (new tables/columns) in a version-controlled, repeatable way as the project evolved
python-jose	Creating and verifying JWTs (JSON Web Tokens)	Used both for user authentication tokens and for the signed, time-limited QR attendance tokens
passlib (bcrypt)	Password hashing	Ensures user passwords are never stored in plain text in the database
Uvicorn	ASGI server running the FastAPI application	Required to actually run a FastAPI app; supports asynchronous request handling


Database


Tool	Purpose	Why it was used
PostgreSQL	Primary relational database	Chosen for its reliability, support for complex relationships (e.g., many-to-many course enrollment), and strong data-integrity features such as unique constraints, which were used to prevent duplicate attendance records
Neon	Cloud-hosted PostgreSQL provider	Provided a free, always-accessible database without needing local server setup, and allowed collaborators to work off the same shared data
Machine Learning / Facial Recognition


Tool	Purpose	Why it was used


DeepFace	Facial recognition library	Provides a simple interface to powerful pre-trained face recognition models, avoiding the need to train a custom model from scratch
Facenet (via DeepFace)	Generating facial embeddings	Converts a face image into a 128-dimension numeric vector, which can be mathematically compared to determine identity
MTCNN (via DeepFace)	Face detection	Locates and crops the face within an image before recognition; switched to from the default detector after testing revealed it handled real-world lighting/angle conditions far more reliably
OpenCV (cv2)	Image processing	Used to read and decode uploaded/captured images into a format usable by the recognition pipeline
NumPy	Numerical computation	Used to calculate cosine similarity between two facial embeddings to determine whether they match
TensorFlow	Underlying deep learning framework	Powers the neural networks used internally by DeepFace's detection and recognition models
Authentication & Security
Tool	Purpose	Why it was used
JWT (JSON Web Tokens)	Session authentication and QR code signing	Stateless, secure way to verify both logged-in users and scanned QR codes without needing a server-side session store
Role-Based Access Control (custom FastAPI dependencies)	Restricting endpoints by user role	Ensures, for example, that only teachers can generate QR codes and only admins can approve teacher accounts

Development & Deployment Tools

Tool	Purpose	Why it was used

Git & GitHub	Version control and collaboration	Enabled multiple collaborators to work on the project simultaneously and track changes over time
Postman / FastAPI's built-in /docs	API testing	Used extensively to test backend endpoints independently of the frontend during development
ngrok	Temporary HTTPS tunneling for mobile testing	Allowed camera-dependent features (QR scanning, face capture) to be tested on real mobile devices before full deployment, since browsers require HTTPS for camera access
