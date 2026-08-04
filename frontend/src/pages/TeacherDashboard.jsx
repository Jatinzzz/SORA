import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  LogOut,
  PlayCircle,
  Award,
  ShieldAlert,
  Users,
  ClipboardList,
  X,
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
  const [classScores, setClassScores] = useState(null);

  // Track current section view ('overview' vs 'manage-students')
  const [activeTab, setActiveTab] = useState("overview");
  const intervalRef = useRef(null);

  // ── Manage Students (scoped to teacher's own classes) ──
  const [manageSelectedClass, setManageSelectedClass] = useState("");
  const [manageStudents, setManageStudents] = useState([]);
  const [manageError, setManageError] = useState("");
  const [viewingProfile, setViewingProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    fetchClasses();
    fetchPendingLeaves();
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

  // ── Manage Students ──
  const handleManageClassSelect = async (classId) => {
    setManageSelectedClass(classId);
    setManageError("");
    setViewingProfile(null);
    if (!classId) {
      setManageStudents([]);
      return;
    }
    try {
      const res = await api.get(`/classes/${classId}/students`);
      setManageStudents(res.data);
    } catch (err) {
      setManageError("Failed to load students for this course");
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    if (!window.confirm(`Remove ${studentName} from this course?`)) return;
    try {
      await api.delete(`/classes/${manageSelectedClass}/student/${studentId}`);
      setManageStudents(manageStudents.filter((s) => s.student_id !== studentId));
      if (viewingProfile && viewingProfile.student_id === studentId) {
        setViewingProfile(null);
      }
    } catch (err) {
      setManageError(err.response?.data?.detail || "Failed to remove student");
    }
  };

  const handleViewProfile = async (studentId) => {
    setProfileLoading(true);
    setViewingProfile(null);
    try {
      const res = await api.get(`/classes/${manageSelectedClass}/student/${studentId}/profile`);
      setViewingProfile(res.data);
    } catch (err) {
      setManageError("Failed to load student profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setViewingProfile(null);
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation Panel */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <Award className="brand-icon" />
          <span>SORA</span>
        </div>
        <nav className="sidebar-menu">
          <button
            onClick={() => setActiveTab("overview")}
            className={`menu-item-btn ${activeTab === "overview" ? "active" : ""}`}
          >
            <ClipboardList size={18} /> Overview & Leaves
          </button>
          <button
            onClick={() => setActiveTab("manage-students")}
            className={`menu-item-btn ${activeTab === "manage-students" ? "active" : ""}`}
          >
            <Users size={18} /> Manage Students
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
            <p className="welcome-text">Welcome back</p>
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

            {/* Pending Leave Requests Section */}
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
                        <th>Student</th>
                        <th>Roll No.</th>
                        <th>Reason</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingLeaves.map((l) => (
                        <tr key={l.id}>
                          <td><strong>{l.student_name}</strong></td>
                          <td>{l.roll_number}</td>
                          <td>{l.reason}</td>
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
          /* Manage Students Subview */
          <div className="overview-page-layout animate-fade-in">
            <section className="card leave-section">
              <div className="leave-header">
                <div>
                  <h3>Manage Students</h3>
                  <p className="section-subtitle">
                    View profiles and attendance, or remove students from courses you teach.
                  </p>
                </div>
              </div>

              {manageError && (
                <div className="status-banner error">
                  <ShieldAlert size={18} /> {manageError}
                </div>
              )}

              <div className="session-controls-group" style={{ marginBottom: "16px" }}>
                <select
                  value={manageSelectedClass}
                  onChange={(e) => handleManageClassSelect(e.target.value)}
                  className="modern-select"
                >
                  <option value="">-- Select a course --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {manageSelectedClass && (
                <div className="table-container">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Roll No.</th>
                        <th>Email</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manageStudents.length === 0 ? (
                        <tr>
                          <td colSpan="4">
                            <p className="empty-notice">No students enrolled in this course.</p>
                          </td>
                        </tr>
                      ) : (
                        manageStudents.map((s) => (
                          <tr key={s.student_id}>
                            <td><strong>{s.name}</strong></td>
                            <td>{s.roll_number}</td>
                            <td>{s.email}</td>
                            <td>
                              <div className="btn-row">
                                <button
                                  onClick={() => handleViewProfile(s.student_id)}
                                  className="table-action-btn present-btn"
                                >
                                  View Profile
                                </button>
                                <button
                                  onClick={() => handleRemoveStudent(s.student_id, s.name)}
                                  className="table-action-btn absent-btn"
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Student Profile Panel */}
            {(profileLoading || viewingProfile) && (
              <div className="card action-card animate-fade-in">
                {profileLoading ? (
                  <p className="loading-text">Loading profile...</p>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ margin: 0 }}>{viewingProfile.name}'s Profile</h3>
                      <button onClick={closeProfile} className="btn-secondary">
                        <X size={16} style={{ verticalAlign: "middle" }} /> Close
                      </button>
                    </div>

                    <table className="modern-table" style={{ marginTop: "14px" }}>
                      <tbody>
                        <tr><td><strong>Email</strong></td><td>{viewingProfile.email}</td></tr>
                        <tr><td><strong>Roll Number</strong></td><td>{viewingProfile.roll_number}</td></tr>
                        <tr><td><strong>Department</strong></td><td>{viewingProfile.department_name || "Not set"}</td></tr>
                        <tr><td><strong>Face Enrolled</strong></td><td>{viewingProfile.face_enrolled ? "Yes" : "No"}</td></tr>
                      </tbody>
                    </table>

                    <h4 style={{ marginTop: "18px" }}>
                      Overall Attendance: {viewingProfile.overall_percentage}%
                      {" "}({viewingProfile.present_count} / {viewingProfile.total_sessions} sessions)
                    </h4>

                    <h4 style={{ marginTop: "18px" }}>By Course</h4>
                    {viewingProfile.courses.length === 0 ? (
                      <p className="empty-notice">Not enrolled in any course.</p>
                    ) : (
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>Course</th>
                            <th>Present</th>
                            <th>Total</th>
                            <th>Percentage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewingProfile.courses.map((c, idx) => (
                            <tr key={idx}>
                              <td>{c.class_name}</td>
                              <td>{c.present_count}</td>
                              <td>{c.total_sessions}</td>
                              <td>{c.attendance_percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
