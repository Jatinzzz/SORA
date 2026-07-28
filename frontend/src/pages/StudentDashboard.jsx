import { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { LogOut, Calendar, QrCode, CheckCircle2, User, Award, ShieldAlert, UserCircle, ScanFace } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import StudentOnboarding from "./StudentOnboarding";
import FaceEnrollCapture from "../components/FaceEnrollCapture";
import "./StudentDashboard.css";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [qrToken, setQrToken] = useState(null);
  const [step, setStep] = useState("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const scannerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Leave management
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [myLeaves, setMyLeaves] = useState([]);
  const [leaveMessage, setLeaveMessage] = useState("");

  // Student info (department + enrolled courses) and attendance score
  const [myInfo, setMyInfo] = useState(null);
  const [myScore, setMyScore] = useState(null);
  const [overallScore, setOverallScore] = useState(null);
  const [selectedScoreCourse, setSelectedScoreCourse] = useState(""); // "" = overall, else class_id

  // Separate page routing active view state ('overview' vs 'leave')
  const [activeTab, setActiveTab] = useState("overview");

  const [needsOnboarding, setNeedsOnboarding] = useState(null); // null = loading, true/false once known

  // Profile tab - re-enroll face flow
  const [reEnrolling, setReEnrolling] = useState(false);

  // Profile tab - enroll in additional courses (within same department)
  const [deptCourses, setDeptCourses] = useState([]);
  const [selectedNewCourse, setSelectedNewCourse] = useState("");
  const [enrollMessage, setEnrollMessage] = useState("");
  const [enrollError, setEnrollError] = useState("");

  // ── Initial load ──
  useEffect(() => {
    fetchMyLeaves();
    fetchMyInfo();
  }, []);

  useEffect(() => {
    if (step === "scanning") {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        )
        .catch(() => {
          setError("Could not start camera. Please allow camera access.");
          setStep("idle");
        });
    }

    return () => {
      const scanner = scannerRef.current;
      if (scanner && scanner.getState && scanner.getState() === 2) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, [step]);

  useEffect(() => {
    if (step === "face-capture") {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user" } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          setError("Could not access front camera for face verification.");
        });
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [step]);

  const startScan = () => {
    setError("");
    setStep("scanning");
  };

  const cancelScan = () => {
    setStep("idle");
  };

  const handleScanSuccess = (decodedText) => {
    setQrToken(decodedText);
    setStep("face-capture");
  };

  const cancelFaceCapture = () => {
    reset();
  };

  const captureAndSubmit = async () => {
    setError("");
    setMessage("Verifying...");

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("qr_token", qrToken);
      formData.append("file", blob, "capture.jpg");

      try {
        const res = await api.post("/attendance/mark", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage(res.data.message);
        setStep("result");
        fetchMyScore(); // refresh score after marking attendance
      } catch (err) {
        setMessage("");
        setError(err.response?.data?.detail || "Failed to mark attendance");
        setStep("result");
      }
    }, "image/jpeg");
  };

  const reset = () => {
    setStep("idle");
    setQrToken(null);
    setMessage("");
    setError("");
  };

  // ── Leave management ──
  const fetchMyLeaves = async () => {
    try {
      const res = await api.get("/leave/my-requests");
      setMyLeaves(res.data);
    } catch (err) {
      console.error("Failed to load leave requests");
    }
  };

  const submitLeave = async (e) => {
    e.preventDefault();
    setLeaveMessage("");
    try {
      await api.post("/leave/apply", {
        reason: leaveReason,
        date_from: leaveFrom,
        date_to: leaveTo,
      });
      setLeaveMessage("Leave request submitted successfully");
      setLeaveReason("");
      setLeaveFrom("");
      setLeaveTo("");
      fetchMyLeaves();
    } catch (err) {
      setLeaveMessage(err.response?.data?.detail || "Failed to submit leave request");
    }
  };

  // ── Student info (department + courses) and attendance score ──
  const fetchMyInfo = async () => {
    try {
      const res = await api.get("/classes/my-courses");
      setMyInfo(res.data);
      setNeedsOnboarding(!res.data.department_id);

      if (res.data.courses && res.data.courses.length > 0) {
        // Default view: overall attendance across all enrolled courses
        fetchOverallScore(res.data.student_id);
      }

      // Load all courses in the student's department, for the "enroll in more" picker
      if (res.data.department_id) {
        fetchDeptCourses(res.data.department_id);
      }
    } catch (err) {
      console.error("Failed to load student info");
    }
  };

  const fetchOverallScore = async (studentId) => {
    try {
      const res = await api.get(`/analytics/student/${studentId}/overall`);
      setOverallScore(res.data);
      setMyScore(null);
      setSelectedScoreCourse("");
    } catch (err) {
      console.error("Failed to load overall attendance score");
    }
  };

  const handleScoreViewChange = (value) => {
    setSelectedScoreCourse(value);
    if (!value) {
      // "Overall" selected
      if (myInfo) fetchOverallScore(myInfo.student_id);
    } else {
      setOverallScore(null);
      fetchMyScoreWithInfo(myInfo.student_id, value);
    }
  };

  const fetchDeptCourses = async (departmentId) => {
    try {
      const res = await api.get(`/departments/${departmentId}/courses`);
      setDeptCourses(res.data);
    } catch (err) {
      console.error("Failed to load department courses");
    }
  };

  const enrolledClassIds = new Set((myInfo?.courses || []).map((c) => c.class_id));
  const availableCourses = deptCourses.filter((c) => !enrolledClassIds.has(c.id));

  const enrollInAdditionalCourse = async () => {
    if (!selectedNewCourse) return;
    setEnrollError("");
    setEnrollMessage("");
    try {
      const res = await api.post(`/classes/enroll-additional?class_id=${selectedNewCourse}`);
      setEnrollMessage(res.data.message || "Enrolled successfully");
      setSelectedNewCourse("");
      fetchMyInfo();
    } catch (err) {
      setEnrollError(err.response?.data?.detail || "Failed to enroll in course");
    }
  };

  const fetchMyScoreWithInfo = async (studentId, classId) => {
    try {
      const res = await api.get(`/analytics/student/${studentId}/class/${classId}`);
      setMyScore(res.data);
    } catch (err) {
      console.error("Failed to load attendance score");
    }
  };

  const fetchMyScore = async () => {
    if (!myInfo) return;
    if (selectedScoreCourse) {
      fetchMyScoreWithInfo(myInfo.student_id, selectedScoreCourse);
    } else {
      fetchOverallScore(myInfo.student_id);
    }
  };

  // Use whichever score is currently active - overall by default, or a specific course
  const activeScore = selectedScoreCourse ? myScore : overallScore;
  const activePercentage = selectedScoreCourse
    ? myScore?.attendance_percentage
    : overallScore?.overall_percentage;

  const presentCount = activeScore?.present_count || 0;
  const totalSessions = activeScore?.total_sessions || 0;
  const absentCount = Math.max(0, totalSessions - presentCount);

  const chartData = [
    { name: "Present", value: presentCount, color: "#10b981" },
    { name: "Absent", value: absentCount, color: "#ef4444" },
  ];

  // ── Still checking onboarding status ──
  if (needsOnboarding === null) {
    return <p style={{ textAlign: "center", marginTop: "50px" }}>Loading...</p>;
  }

  // ── First-time setup: department + course + face enrollment ──
  if (needsOnboarding) {
    return (
      <StudentOnboarding
        onComplete={() => {
          setNeedsOnboarding(false);
          fetchMyInfo();
        }}
      />
    );
  }

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
            <User size={18} /> Overview
          </button>
          <button
            onClick={() => setActiveTab("leave")}
            className={`menu-item-btn ${activeTab === "leave" ? "active" : ""}`}
          >
            <Calendar size={18} /> Leave Module
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`menu-item-btn ${activeTab === "profile" ? "active" : ""}`}
          >
            <UserCircle size={18} /> My Profile
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
            <h1>Student Dashboard</h1>
            <p className="welcome-text">Welcome back</p>
          </div>
          {myInfo?.department_name && activeTab === "overview" && (
            <div className="class-badge">
              Department: {myInfo.department_name}
              {myInfo.courses && myInfo.courses.length > 0 && (
                <> &middot; {myInfo.courses.length} course{myInfo.courses.length > 1 ? "s" : ""} enrolled</>
              )}
            </div>
          )}
        </header>

        {/* Tab Routing View Toggler */}
        {activeTab === "overview" && (
          <div className="dashboard-grid animate-fade-in">
            {/* Attendance Section featuring Pie Chart */}
            <div className="card score-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <h3 style={{ margin: 0 }}>My Attendance Status</h3>
                {myInfo && myInfo.courses && myInfo.courses.length > 0 && (
                  <select
                    value={selectedScoreCourse}
                    onChange={(e) => handleScoreViewChange(e.target.value)}
                    style={{ fontSize: "0.85rem" }}
                  >
                    <option value="">Overall (All Courses)</option>
                    {myInfo.courses.map((c) => (
                      <option key={c.class_id} value={c.class_id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
              {activeScore ? (
                <div className="chart-wrapper">
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} Sessions`, 'Status']} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="chart-center-text">
                      <span className="percentage-num">{activePercentage}%</span>
                      <span className="percentage-label">
                        {selectedScoreCourse ? "Attended" : "Overall"}
                      </span>
                    </div>
                  </div>
                  <div className="score-summary">
                    <div className="stat-pill present">
                      <span>Present:</span> <strong>{presentCount}</strong>
                    </div>
                    <div className="stat-pill absent">
                      <span>Absent:</span> <strong>{absentCount}</strong>
                    </div>
                    <div className="stat-pill total">
                      <span>Total:</span> <strong>{totalSessions}</strong>
                    </div>
                  </div>

                  {/* Per-course breakdown, only shown in "Overall" view */}
                  {!selectedScoreCourse && overallScore && overallScore.courses.length > 1 && (
                    <div style={{ marginTop: "14px" }}>
                      <h4 style={{ margin: "0 0 8px 0" }}>By Course</h4>
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>Course</th>
                            <th>Present</th>
                            <th>Total</th>
                            <th>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overallScore.courses.map((c, idx) => (
                            <tr key={idx}>
                              <td>{c.name}</td>
                              <td>{c.present_count}</td>
                              <td>{c.total_sessions}</td>
                              <td>{c.attendance_percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <p className="loading-text">
                  {myInfo && myInfo.courses && myInfo.courses.length === 0
                    ? "You are not enrolled in any course yet."
                    : "Loading attendance metrics..."}
                </p>
              )}
            </div>

            {/* Verification / Action Card */}
            <div className="card action-card">
              <h3>Attendance Check-in</h3>
              <p className="action-desc">Validate your classes using instant QR scanning paired with biometric face capturing checks.</p>

              {error && (
                <div className="status-banner error">
                  <ShieldAlert size={18} /> {error}
                </div>
              )}

              {step === "idle" && (
                <button className="scan-button" onClick={startScan}>
                  <QrCode size={18} /> Scan QR to Mark Attendance
                </button>
              )}

              {step === "scanning" && (
                <div className="camera-box">
                  <p className="box-instruction">Point camera towards verification layout code</p>
                  <div id="qr-reader"></div>
                  <button className="btn-secondary" onClick={cancelScan}>Cancel Scan</button>
                </div>
              )}

              {step === "face-capture" && (
                <div className="camera-box">
                  <p className="box-instruction">QR Code verified! Keep still for face lock check.</p>
                  <div className="video-viewport">
                    <video ref={videoRef} autoPlay playsInline></video>
                  </div>
                  <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
                  <div className="btn-row">
                    <button className="scan-button" onClick={captureAndSubmit}>Capture & Submit</button>
                    <button className="btn-secondary" onClick={cancelFaceCapture}>Cancel</button>
                  </div>
                </div>
              )}

              {step === "result" && (
                <div className="camera-box outcome-box">
                  <CheckCircle2 size={48} color="#10b981" />
                  <p className="success-message">{message}</p>
                  <button className="scan-button" onClick={reset}>Complete</button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "leave" && (
          /* Separate Leave Requests Page View */
          <section className="card leave-section animate-fade-in">
            <div className="leave-header">
              <div>
                <h3>Leave Request Management</h3>
                <p className="section-subtitle">File extensions, check approval states or submit emergency exceptions.</p>
              </div>
              <button className="btn-primary" onClick={() => setShowLeaveForm(!showLeaveForm)}>
                {showLeaveForm ? "Close Form" : "Apply for Leave"}
              </button>
            </div>

            {showLeaveForm && (
              <form onSubmit={submitLeave} className="leave-form animate-fade-in">
                <div className="form-group">
                  <label>Reason for Leave</label>
                  <input
                    type="text"
                    placeholder="e.g., Medical checkup, family emergency"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    required
                  />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={leaveFrom}
                      onChange={(e) => setLeaveFrom(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={leaveTo}
                      onChange={(e) => setLeaveTo(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="form-footer">
                  <button type="submit" className="scan-button" style={{ maxWidth: "240px" }}>
                    Submit Application
                  </button>
                  {leaveMessage && <p className="form-status-msg">{leaveMessage}</p>}
                </div>
              </form>
            )}

            <div className="table-container">
              <h4>Application History Log</h4>
              {myLeaves.length === 0 ? (
                <p className="empty-notice">No processed exceptions logged to date.</p>
              ) : (
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Reason</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLeaves.map((l) => (
                      <tr key={l.id}>
                        <td>{l.reason}</td>
                        <td>{l.date_from}</td>
                        <td>{l.date_to}</td>
                        <td>
                          <span className={`status-pill state-${l.status?.toLowerCase() || 'pending'}`}>
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {activeTab === "profile" && (
          <div className="dashboard-grid animate-fade-in">
            {/* Personal & Academic Details */}
            <div className="card">
              <h3>My Details</h3>
              {myInfo ? (
                <table className="modern-table">
                  <tbody>
                    <tr>
                      <td><strong>Name</strong></td>
                      <td>{myInfo.name}</td>
                    </tr>
                    <tr>
                      <td><strong>Email</strong></td>
                      <td>{myInfo.email}</td>
                    </tr>
                    <tr>
                      <td><strong>Roll Number</strong></td>
                      <td>{myInfo.roll_number}</td>
                    </tr>
                    <tr>
                      <td><strong>Department</strong></td>
                      <td>{myInfo.department_name || "Not set"}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="loading-text">Loading profile...</p>
              )}

              <h4 style={{ marginTop: "20px" }}>Enrolled Courses</h4>
              {myInfo && myInfo.courses && myInfo.courses.length > 0 ? (
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myInfo.courses.map((c) => (
                      <tr key={c.class_id}>
                        <td>{c.name}</td>
                        <td>{c.teacher_name || "Unassigned"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="empty-notice">Not enrolled in any course yet.</p>
              )}

              {myInfo && myInfo.department_id && (
                <div style={{ marginTop: "18px" }}>
                  <h4>Enroll in Another Course</h4>
                  {availableCourses.length > 0 ? (
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                      <select
                        value={selectedNewCourse}
                        onChange={(e) => setSelectedNewCourse(e.target.value)}
                      >
                        <option value="">-- Select a course --</option>
                        {availableCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.teacher_name ? `(${c.teacher_name})` : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={enrollInAdditionalCourse}
                        disabled={!selectedNewCourse}
                      >
                        Enroll
                      </button>
                    </div>
                  ) : (
                    <p className="empty-notice">
                      You're enrolled in every available course in {myInfo.department_name}.
                    </p>
                  )}
                  {enrollMessage && <p style={{ color: "green" }}>{enrollMessage}</p>}
                  {enrollError && <p style={{ color: "red" }}>{enrollError}</p>}
                </div>
              )}

              <p style={{ marginTop: "12px", fontSize: "0.85rem" }} className="section-subtitle">
                You can enroll in additional courses within your own department here.
                To change your department or drop a course, please contact your teacher or admin.
              </p>
            </div>

            {/* Face Enrollment Status */}
            <div className="card action-card">
              <h3>Face Verification</h3>
              {myInfo && myInfo.face_enrolled && !reEnrolling ? (
                <div className="camera-box outcome-box">
                  <ScanFace size={48} color="#10b981" />
                  <p className="success-message">Your face is enrolled and ready for attendance verification.</p>
                  <button className="btn-secondary" onClick={() => setReEnrolling(true)}>
                    Re-enroll Face
                  </button>
                </div>
              ) : (
                <div className="camera-box">
                  {!myInfo?.face_enrolled && (
                    <p className="box-instruction">
                      You haven't enrolled your face yet. This is required to mark attendance.
                    </p>
                  )}
                  <FaceEnrollCapture
                    onEnrolled={() => {
                      setReEnrolling(false);
                      fetchMyInfo();
                    }}
                  />
                  {reEnrolling && (
                    <button
                      className="btn-secondary"
                      style={{ marginTop: "10px" }}
                      onClick={() => setReEnrolling(false)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
