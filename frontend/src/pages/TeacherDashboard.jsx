import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [session, setSession] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchClasses();
    return () => clearInterval(intervalRef.current);
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await api.get("/classes/my-classes");
      setClasses(res.data);
    } catch (err) {
      setError("Failed to load classes");
    }
  };

  const fetchStudents = async (classId) => {
    try {
      const res = await api.get(`/classes/${classId}/students`);
      setStudents(res.data);
    } catch (err) {
      setError("Failed to load students");
    }
  };

  const startSession = async () => {
    if (!selectedClass) {
      setError("Please select a class first");
      return;
    }
    setError("");
    try {
      const res = await api.post("/sessions/create", { class_id: parseInt(selectedClass) });
      setSession(res.data);
      await fetchStudents(selectedClass);
      generateQR(res.data.id);

      intervalRef.current = setInterval(() => {
        generateQR(res.data.id);
      }, 120000); // 120 seconds
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to start session");
    }
  };

  const generateQR = async (sessionId) => {
    try {
      const res = await api.post(`/sessions/${sessionId}/generate-qr`);
      setQrData(res.data);
    } catch (err) {
      setError("Failed to generate QR");
    }
  };

  const endSession = () => {
    clearInterval(intervalRef.current);
    setSession(null);
    setQrData(null);
    setStudents([]);
  };

  const handleManualMark = async (studentId, status) => {
    try {
      await api.post("/attendance/manual-mark", {
        session_id: session.id,
        student_id: studentId,
        status: status,
      });
      alert(`Marked as ${status}`);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to mark attendance");
    }
  };

  return (
    <div style={{ maxWidth: "700px", margin: "50px auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2>Teacher Dashboard</h2>
        <button onClick={logout}>Logout</button>
      </div>
      <p>Welcome, {user.name}</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {!session ? (
        <div>
          <h3>Start a Session</h3>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            <option value="">-- Select a class --</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={startSession} style={{ marginLeft: "10px" }}>
            Start Session
          </button>
        </div>
      ) : (
        <div>
          <h3>Session Active</h3>
          <button onClick={endSession}>End Session</button>

          {qrData && (
            <div style={{ margin: "20px 0" }}>
              <QRCodeSVG value={qrData.qr_token} size={200} />
              <p>Expires: {new Date(qrData.qr_expiry).toLocaleTimeString()}</p>
              <p style={{ fontSize: "12px", color: "gray" }}>Auto-refreshes every 120 seconds</p>
            </div>
          )}

          <h3>Class Roster</h3>
          <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Roll No.</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.student_id}>
                  <td>{s.name}</td>
                  <td>{s.roll_number}</td>
                  <td>
                    <button onClick={() => handleManualMark(s.student_id, "present")}>
                      Mark Present
                    </button>{" "}
                    <button onClick={() => handleManualMark(s.student_id, "absent")}>
                      Mark Absent
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}