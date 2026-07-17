import { useState, useEffect } from "react";
import { 
  LogOut, 
  Award, 
  ShieldAlert, 
  UserCheck, 
  Settings 
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifyingUserId, setVerifyingUserId] = useState(null);
  const [rollNumber, setRollNumber] = useState("");
  const [classId, setClassId] = useState("");
  const [department, setDepartment] = useState("");

  // Track active subview ('approvals' vs 'system-logs')
  const [activeTab, setActiveTab] = useState("approvals");

  const fetchPendingUsers = async () => {
    try {
      const res = await api.get("/admin/pending-users");
      setPendingUsers(res.data);
    } catch (err) {
      setError("Failed to load pending users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const openVerifyForm = (userId) => {
    setVerifyingUserId(userId);
    setRollNumber("");
    setClassId("");
    setDepartment("");
    setError("");
  };

  const cancelVerify = () => {
    setVerifyingUserId(null);
  };

  const submitVerify = async (e, role) => {
    e.preventDefault();
    setError("");

    let payload = {};
    if (role === "student") {
      if (!rollNumber) {
        setError("Roll number is required");
        return;
      }
      payload.roll_number = rollNumber;
      if (classId) payload.class_id = parseInt(classId);
    } else if (role === "teacher") {
      payload.department = department || null;
    }

    try {
      await api.put(`/admin/verify-user/${verifyingUserId}`, payload);
      setPendingUsers(pendingUsers.filter((u) => u.id !== verifyingUserId));
      setVerifyingUserId(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to verify user");
    }
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
            onClick={() => setActiveTab("approvals")} 
            className={`menu-item-btn ${activeTab === "approvals" ? "active" : ""}`}
          >
            <UserCheck size={18} /> Approvals
          </button>
          <button 
            onClick={() => setActiveTab("system-logs")} 
            className={`menu-item-btn ${activeTab === "system-logs" ? "active" : ""}`}
          >
            <Settings size={18} /> System Config
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
            <h1>Admin Dashboard</h1>
            <p className="welcome-text">Welcome back</p>
          </div>
          <div className="class-badge admin-badge">Role: System Admin</div>
        </header>

        {error && (
          <div className="status-banner error">
            <ShieldAlert size={18} /> {error}
          </div>
        )}

        {activeTab === "approvals" ? (
          <div className="overview-page-layout animate-fade-in">
            <section className="card leave-section">
              <div className="leave-header">
                <div>
                  <h3>Pending User Registrations</h3>
                  <p className="section-subtitle">Assign identifiers and verify credentials for pending teacher and student sign-ups.</p>
                </div>
              </div>

              {loading ? (
                <p className="loading-text">Querying authentication systems...</p>
              ) : pendingUsers.length === 0 ? (
                <p className="empty-notice">No registration approvals waiting in the queue.</p>
              ) : (
                <div className="table-container">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingUsers.map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.name}</strong></td>
                          <td>{u.email}</td>
                          <td>
                            <span className={`status-pill role-${u.role}`}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            {verifyingUserId === u.id ? (
                              <button onClick={cancelVerify} className="table-action-btn cancel-btn">
                                Cancel
                              </button>
                            ) : (
                              <button onClick={() => openVerifyForm(u.id)} className="table-action-btn approve-btn">
                                Approve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Inline verification details section */}
            {verifyingUserId && (
              <div className="card action-card verify-form-card animate-fade-in">
                <h3>Verification Criteria Setup</h3>
                <p className="action-desc">
                  Input unique credential mappings for:{" "}
                  <strong>{pendingUsers.find((u) => u.id === verifyingUserId)?.name}</strong>
                </p>
                <form 
                  onSubmit={(e) => 
                    submitVerify(
                      e, 
                      pendingUsers.find((u) => u.id === verifyingUserId)?.role
                    )
                  }
                  className="leave-form"
                >
                  {pendingUsers.find((u) => u.id === verifyingUserId)?.role === "student" && (
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Roll Number <span className="req-star">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g., ENG2026-88"
                          value={rollNumber}
                          onChange={(e) => setRollNumber(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Class ID (Optional)</label>
                        <input
                          type="number"
                          placeholder="e.g., 101"
                          value={classId}
                          onChange={(e) => setClassId(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {pendingUsers.find((u) => u.id === verifyingUserId)?.role === "teacher" && (
                    <div className="form-group">
                      <label>Department Designation (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g., Department of Computing"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="form-footer">
                    <button type="submit" className="scan-button" style={{ maxWidth: "250px" }}>
                      Confirm Approval
                    </button>
                    <button type="button" onClick={cancelVerify} className="btn-secondary">
                      Discard
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ) : (
          /* Separate System Config Subview Page */
          <div className="card leave-section animate-fade-in">
            <div className="leave-header">
              <div>
                <h3>System Configuration</h3>
                <p className="section-subtitle">Global administrative settings and core portal metrics.</p>
              </div>
            </div>
            <div className="config-grid">
              <div className="config-card-mini">
                <h4>SORA Portal Version</h4>
                <p>v2.4.0-production</p>
              </div>
              <div className="config-card-mini">
                <h4>System Integrity</h4>
                <p className="text-present">All nodes operational</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}