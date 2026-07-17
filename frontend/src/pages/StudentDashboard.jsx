import { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { LogOut, Calendar, QrCode, CheckCircle2, User, Award, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
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

  // Attendance score
  const [myInfo, setMyInfo] = useState(null);
  const [myScore, setMyScore] = useState(null);

  // Separate page routing active view state ('overview' vs 'leave')
  const [activeTab, setActiveTab] = useState("overview");

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
        fetchMyScore();
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

  // ── Attendance score ──
  const fetchMyInfo = async () => {
    try {
      const res = await api.get("/classes/my-student-info");
      setMyInfo(res.data);
      if (res.data.class_id) {
        fetchMyScoreWithInfo(res.data.student_id, res.data.class_id);
      }
    } catch (err) {
      console.error("Failed to load student info");
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
    if (myInfo && myInfo.class_id) {
      fetchMyScoreWithInfo(myInfo.student_id, myInfo.class_id);
    }
  };

  const presentCount = myScore?.present_count || 0;
  const totalSessions = myScore?.total_sessions || 0;
  const absentCount = Math.max(0, totalSessions - presentCount);

  const chartData = [
    { name: "Present", value: presentCount, color: "#10b981" },
    { name: "Absent", value: absentCount, color: "#ef4444" },
  ];

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
          {myInfo?.class_name && activeTab === "overview" && (
            <div className="class-badge">Class: {myInfo.class_name}</div>
          )}
        </header>

        {/* Tab Routing View Toggler */}
        {activeTab === "overview" ? (
          <div className="dashboard-grid animate-fade-in">
            {/* Attendance Section featuring Pie Chart */}
            <div className="card score-card">
              <h3>My Attendance Status</h3>
              {myScore ? (
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
                      <span className="percentage-num">{myScore.attendance_percentage}%</span>
                      <span className="percentage-label">Attended</span>
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
                </div>
              ) : (
                <p className="loading-text">Loading attendance metrics...</p>
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
        ) : (
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
      </main>
    </div>
  );
}