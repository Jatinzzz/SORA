import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { 
  LogOut, 
  CalendarCheck, 
  PlayCircle, 
  Users, 
  Award, 
  ShieldAlert, 
  UserPlus,
  ClipboardList 
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import "./TeacherDashboard.css";

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [session, setSession] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [classScores, setClassScores] = useState(null);
  
  // Track current section view ('overview' vs 'unassigned')
  const [activeTab, setActiveTab] = useState("overview");
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchClasses();
    fetchPendingLeaves();
    fetchUnassigned();
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
      }, 120000);
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
    if (selectedClass) fetchClassScores(selectedClass);
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

  const fetchPendingLeaves = async () => {
    try {
      const res = await api.get("/leave/pending");
      setPendingLeaves(res.data);
    } catch (err) {
      console.error("Failed to load leave requests");
    }
  };

  const reviewLeave = async (leaveId, status) => {
    try {
      await api.put(`/leave/${leaveId}/review`, { status });
      setPendingLeaves(pendingLeaves.filter((l) => l.id !== leaveId));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to review leave request");
    }
  };

  const fetchUnassigned = async () => {
    try {
      const res = await api.get("/classes/unassigned-students");
      setUnassignedStudents(res.data);
    } catch (err) {
      console.error("Failed to load unassigned students");
    }
  };

  const assignStudent = async (studentId, classId) => {
    if (!classId) {
      alert("Please select a class first");
      return;
    }
    try {
      await api.put(`/classes/${classId}/assign-student/${studentId}`);
      setUnassignedStudents(unassignedStudents.filter((s) => s.student_id !== studentId));
      fetchClasses();
      alert("Student assigned successfully");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to assign student");
    }
  };

  const fetchClassScores = async (classId) => {
    if (!classId) {
      setClassScores(null);
      return;
    }
    try {
      const res = await api.get(`/analytics/class/${classId}`);
      setClassScores(res.data);
    } catch (err) {
      console.error("Failed to load class scores");
    }
  };

  const handleClassChange = (classId) => {
    setSelectedClass(classId);
    fetchClassScores(classId);
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation Panel */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <Award className="brand-icon" />
          <span>EduPortal</span>
        </div>
        <nav className="sidebar-menu">
          <button 
            onClick={() => setActiveTab("overview")} 
            className={`menu-item-btn ${activeTab === "overview" ? "active" : ""}`}
          >
            <ClipboardList size={18} /> Overview & Leaves
          </button>
          <button 
            onClick={() => setActiveTab("unassigned")} 
            className={`menu-item-btn ${activeTab === "unassigned" ? "active" : ""}`}
          >
            <UserPlus size={18} /> Unassigned Students
          </button>
        </nav>
        <button className="logout-button" onClick={logout}>
          <LogOut size={18} /> Logout
        </button>
      </aside>

      {/* Main Layout Area */}
      <main className="dashboard-content">
        <header className="content-header">
          <div>
            <h1>Teacher Dashboard</h1>
            <p className="welcome-text">Welcome back, <span>{user.name}</span></p>
          </div>
        </header>

        {error && (
          <div className="status-banner error">
            <ShieldAlert size={18} /> {error}
          </div>
        )}

        {/* Tab Subview Switcher */}
        {activeTab === "overview" ? (
          <div className="overview-page-layout">
            <div className="dashboard-grid">
              
              {/* Session Control Box */}
              <div className="card action-card">
                {!session ? (
                  <div>
                    <h3>Start a Session</h3>
                    <p className="action-desc">Select an authorized course partition grid below to roll out live QR captures.</p>
                    <div className="session-controls-group">
                      <select 
                        value={selectedClass} 
                        onChange={(e) => handleClassChange(e.target.value)}
                        className="modern-select"
                      >
                        <option value="">-- Select a class --</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button onClick={startSession} className="scan-button">
                        <PlayCircle size={18} /> Start Session
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="active-session-wrapper">
                    <div className="session-status-header">
                      <h3>Session Active</h3>
                      <button onClick={endSession} className="btn-secondary danger-btn">End Session</button>
                    </div>

                    {qrData && (
                      <div className="qr-display-container">
                        <div className="qr-svg-card">
                          <QRCodeSVG value={qrData.qr_token} size={180} />
                        </div>
                        <div className="qr-metadata">
                          <p>Expires: <strong>{new Date(qrData.qr_expiry).toLocaleTimeString()}</strong></p>
                          <span className="refresh-notice">Auto-refreshes every 120 seconds</span>
                        </div>
                      </div>
                    )}

                    <h4>Class Roster</h4>
                    <div className="table-container text-table">
                      <table className="modern-table">
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
                                <div className="btn-row">
                                  <button onClick={() => handleManualMark(s.student_id, "present")} className="table-action-btn present-btn">
                                    Present
                                  </button>
                                  <button onClick={() => handleManualMark(s.student_id, "absent")} className="table-action-btn absent-btn">
                                    Absent
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Attendance Records Rollbox */}
              <div className="card score-card">
                <h3>Attendance Statistics</h3>
                {classScores ? (
                  <div>
                    <div className="score-box-meta">
                      <p>Class Matrix: <strong>{classScores.class_name}</strong></p>
                      <div className="stat-pill total">Total Sessions: {classScores.total_sessions}</div>
                    </div>
                    <div className="table-container">
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Roll No.</th>
                            <th>P</th>
                            <th>A</th>
                            <th>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classScores.students.map((s) => (
                            <tr 
                              key={s.student_id} 
                              className={s.attendance_percentage < 75 ? "alert-row" : ""}
                            >
                              <td>{s.name}</td>
                              <td>{s.roll_number}</td>
                              <td><span className="text-present">{s.present_count}</span></td>
                              <td><span className="text-absent">{s.absent_count}</span></td>
                              <td>
                                <span className={`status-pill ${s.attendance_percentage < 75 ? "state-rejected" : "state-approved"}`}>
                                  {s.attendance_percentage}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="empty-notice text-center">Select an active class stream to query cumulative records.</p>
                )}
              </div>
            </div>

            {/* Pending Leave Requests Section (Placed on the same page below the main grid cards) */}
            <section className="card leave-section">
              <div className="leave-header">
                <div>
                  <h3>Pending Leave Requests</h3>
                  <p className="section-subtitle">Process incoming medical waivers and exception logs submitted by students.</p>
                </div>
              </div>

              <div className="table-container">
                {pendingLeaves.length === 0 ? (
                  <p className="empty-notice">No leave exceptions waiting for approval logs.</p>
                ) : (
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Reason</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingLeaves.map((l) => (
                        <tr key={l.id}>
                          <td><strong>{l.reason}</strong></td>
                          <td>{l.date_from}</td>
                          <td>{l.date_to}</td>
                          <td>
                            <div className="btn-row">
                              <button onClick={() => reviewLeave(l.id, "approved")} className="table-action-btn present-btn">
                                Approve
                              </button>
                              <button onClick={() => reviewLeave(l.id, "rejected")} className="table-action-btn absent-btn">
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        ) : (
          /* Separate Isolation Subview Section for Unassigned Students */
          <div className="card leave-section animate-fade-in">
            <div className="leave-header">
              <div>
                <h3>Unassigned Students Pipeline</h3>
                <p className="section-subtitle">Route newly enrolled student profiles to their respective academic classrooms.</p>
              </div>
            </div>
            
            <div className="table-container">
              {unassignedStudents.length === 0 ? (
                <p className="empty-notice">Clear pipeline! All student accounts are linked to a class structure.</p>
              ) : (
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Roll No.</th>
                      <th>Assign to Target Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unassignedStudents.map((s) => (
                      <tr key={s.student_id}>
                        <td><strong>{s.name}</strong></td>
                        <td>{s.roll_number}</td>
                        <td>
                          <select
                            onChange={(e) => assignStudent(s.student_id, e.target.value)}
                            defaultValue=""
                            className="modern-select table-inline-select"
                          >
                            <option value="" disabled>-- Select class --</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}