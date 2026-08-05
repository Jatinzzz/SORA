import { useState, useEffect } from "react";
import {
  LogOut,
  Award,
  ShieldAlert,
  UserCheck,
  Settings,
  Users,
  X,
  BookOpen,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  // ── Pending teacher approvals ──
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifyingUserId, setVerifyingUserId] = useState(null);
  const [department, setDepartment] = useState("");

  // Track active subview ('approvals' vs 'manage-students' vs 'system-logs')
  const [activeTab, setActiveTab] = useState("approvals");

  // ── Manage Students: department -> course -> student list ──
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [courseStudents, setCourseStudents] = useState([]);
  const [manageError, setManageError] = useState("");

  // ── Student profile view ──
  const [viewingProfile, setViewingProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // ── Manage Courses: create course + reassign teacher ──
  const [teachers, setTeachers] = useState([]);
  const [courseDept, setCourseDept] = useState("");
  const [courseDeptCourses, setCourseDeptCourses] = useState([]);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseTeacher, setNewCourseTeacher] = useState("");
  const [courseMessage, setCourseMessage] = useState("");
  const [courseError, setCourseError] = useState("");
  const [reassigningCourseId, setReassigningCourseId] = useState(null);
  const [reassignTeacherId, setReassignTeacherId] = useState("");

  useEffect(() => {
    fetchPendingUsers();
    fetchDepartments();
    fetchTeachers();
  }, []);

  // ── Pending teacher approvals ──
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

  const openVerifyForm = (userId) => {
    setVerifyingUserId(userId);
    setDepartment("");
    setError("");
  };

  const cancelVerify = () => {
    setVerifyingUserId(null);
  };

  const submitVerify = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.put(`/admin/verify-user/${verifyingUserId}`, {
        department_id: department ? parseInt(department) : null,
      });
      setPendingUsers(pendingUsers.filter((u) => u.id !== verifyingUserId));
      setVerifyingUserId(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to verify user");
    }
  };

  // ── Manage Students ──
  const fetchDepartments = async () => {
    try {
      const res = await api.get("/departments");
      setDepartments(res.data);
    } catch (err) {
      setManageError("Failed to load departments");
    }
  };

  const handleDeptSelect = async (deptId) => {
    setSelectedDept(deptId);
    setSelectedCourse("");
    setCourseStudents([]);
    setManageError("");
    if (!deptId) {
      setCourses([]);
      return;
    }
    try {
      const res = await api.get(`/departments/${deptId}/courses`);
      setCourses(res.data);
    } catch (err) {
      setManageError("Failed to load courses");
    }
  };

  const handleCourseSelect = async (classId) => {
    setSelectedCourse(classId);
    setManageError("");
    if (!classId) {
      setCourseStudents([]);
      return;
    }
    try {
      const res = await api.get(`/admin/course/${classId}/students`);
      setCourseStudents(res.data);
    } catch (err) {
      setManageError("Failed to load students for this course");
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    if (!window.confirm(`Remove ${studentName} from this course?`)) return;
    try {
      await api.delete(`/admin/course/${selectedCourse}/student/${studentId}`);
      setCourseStudents(courseStudents.filter((s) => s.student_id !== studentId));
    } catch (err) {
      setManageError(err.response?.data?.detail || "Failed to remove student");
    }
  };

  // ── Student profile view ──
  const handleViewProfile = async (studentId) => {
    setProfileLoading(true);
    setViewingProfile(null);
    try {
      const res = await api.get(`/admin/student/${studentId}/full-profile`);
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

  // ── Manage Courses ──
  const fetchTeachers = async () => {
    try {
      const res = await api.get("/admin/teachers");
      setTeachers(res.data);
    } catch (err) {
      console.error("Failed to load teachers");
    }
  };

  const handleCourseDeptSelect = async (deptId) => {
    setCourseDept(deptId);
    setCourseDeptCourses([]);
    setCourseMessage("");
    setCourseError("");
    setReassigningCourseId(null);
    if (!deptId) return;
    try {
      const res = await api.get(`/departments/${deptId}/courses`);
      setCourseDeptCourses(res.data);
    } catch (err) {
      setCourseError("Failed to load courses for this department");
    }
  };

  const createCourse = async (e) => {
    e.preventDefault();
    setCourseError("");
    setCourseMessage("");
    if (!courseDept || !newCourseName.trim()) {
      setCourseError("Please select a department and enter a course name");
      return;
    }
    try {
      await api.post(`/admin/departments/${courseDept}/courses`, {
        name: newCourseName,
        teacher_id: newCourseTeacher ? parseInt(newCourseTeacher) : null,
      });
      setCourseMessage("Course created successfully");
      setNewCourseName("");
      setNewCourseTeacher("");
      handleCourseDeptSelect(courseDept); // refresh list
    } catch (err) {
      setCourseError(err.response?.data?.detail || "Failed to create course");
    }
  };

  const openReassignForm = (classId) => {
    setReassigningCourseId(classId);
    setReassignTeacherId("");
    setCourseMessage("");
    setCourseError("");
  };

  const cancelReassign = () => {
    setReassigningCourseId(null);
  };

  const submitReassign = async (e) => {
    e.preventDefault();
    setCourseError("");
    if (!reassignTeacherId) {
      setCourseError("Please select a teacher");
      return;
    }
    try {
      await api.put(`/admin/courses/${reassigningCourseId}/reassign-teacher`, {
        teacher_id: parseInt(reassignTeacherId),
      });
      setCourseMessage("Teacher reassigned successfully. Existing course data is unchanged.");
      setReassigningCourseId(null);
      handleCourseDeptSelect(courseDept); // refresh list
    } catch (err) {
      setCourseError(err.response?.data?.detail || "Failed to reassign teacher");
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
            onClick={() => setActiveTab("manage-students")}
            className={`menu-item-btn ${activeTab === "manage-students" ? "active" : ""}`}
          >
            <Users size={18} /> Manage Students
          </button>
          <button
            onClick={() => setActiveTab("manage-courses")}
            className={`menu-item-btn ${activeTab === "manage-courses" ? "active" : ""}`}
          >
            <BookOpen size={18} /> Manage Courses
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

        {/* ───────── Approvals Tab ───────── */}
        {activeTab === "approvals" && (
          <div className="overview-page-layout animate-fade-in">
            <section className="card leave-section">
              <div className="leave-header">
                <div>
                  <h3>Pending Teacher Approvals</h3>
                  <p className="section-subtitle">
                    Verify credentials for pending teacher sign-ups. Students are approved automatically at registration.
                  </p>
                </div>
              </div>

              {loading ? (
                <p className="loading-text">Querying authentication systems...</p>
              ) : pendingUsers.length === 0 ? (
                <p className="empty-notice">No teacher approvals waiting in the queue.</p>
              ) : (
                <div className="table-container">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingUsers.map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.name}</strong></td>
                          <td>{u.email}</td>
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

            {verifyingUserId && (
              <div className="card action-card verify-form-card animate-fade-in">
                <h3>Verification Details</h3>
                <p className="action-desc">
                  Approving:{" "}
                  <strong>{pendingUsers.find((u) => u.id === verifyingUserId)?.name}</strong>
                </p>
                <form onSubmit={submitVerify} className="leave-form">
                  <div className="form-group">
                    <label>Department (Optional)</label>
                    <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                      <option value="">-- No department --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
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
        )}

        {/* ───────── Manage Students Tab ───────── */}
        {activeTab === "manage-students" && (
          <div className="overview-page-layout animate-fade-in">
            <section className="card leave-section">
              <div className="leave-header">
                <div>
                  <h3>Manage Students</h3>
                  <p className="section-subtitle">
                    Browse students by department and course, view full profiles with attendance, or remove them from a course.
                  </p>
                </div>
              </div>

              {manageError && (
                <div className="status-banner error">
                  <ShieldAlert size={18} /> {manageError}
                </div>
              )}

              <div className="form-grid" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Department</label>
                  <select value={selectedDept} onChange={(e) => handleDeptSelect(e.target.value)}>
                    <option value="">-- Select department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Course</label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => handleCourseSelect(e.target.value)}
                    disabled={!selectedDept}
                  >
                    <option value="">-- Select course --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.teacher_name ? `(${c.teacher_name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCourse && (
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
                      {courseStudents.length === 0 ? (
                        <tr>
                          <td colSpan="4">
                            <p className="empty-notice">No students enrolled in this course.</p>
                          </td>
                        </tr>
                      ) : (
                        courseStudents.map((s) => (
                          <tr key={s.student_id}>
                            <td><strong>{s.name}</strong></td>
                            <td>{s.roll_number}</td>
                            <td>{s.email}</td>
                            <td>
                              <button
                                onClick={() => handleViewProfile(s.student_id)}
                                className="table-action-btn approve-btn"
                              >
                                View Profile
                              </button>{" "}
                              <button
                                onClick={() => handleRemoveStudent(s.student_id, s.name)}
                                className="table-action-btn cancel-btn"
                              >
                                Remove
                              </button>
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

        {/* ───────── Manage Courses Tab ───────── */}
        {activeTab === "manage-courses" && (
          <div className="overview-page-layout animate-fade-in">
            <section className="card leave-section">
              <div className="leave-header">
                <div>
                  <h3>Create a Course</h3>
                  <p className="section-subtitle">
                    Add a new course under an existing department and optionally assign a teacher.
                  </p>
                </div>
              </div>

              {courseError && (
                <div className="status-banner error">
                  <ShieldAlert size={18} /> {courseError}
                </div>
              )}
              {courseMessage && (
                <p style={{ color: "#15803d" }}>{courseMessage}</p>
              )}

              <form onSubmit={createCourse} className="leave-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Department</label>
                    <select value={courseDept} onChange={(e) => handleCourseDeptSelect(e.target.value)}>
                      <option value="">-- Select department --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Course Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Data Structures"
                      value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Assign Teacher (Optional)</label>
                    <select value={newCourseTeacher} onChange={(e) => setNewCourseTeacher(e.target.value)}>
                      <option value="">-- No teacher --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.department_name ? `(${t.department_name})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-footer">
                  <button type="submit" className="scan-button" style={{ maxWidth: "220px" }}>
                    Create Course
                  </button>
                </div>
              </form>
            </section>

            {courseDept && (
              <section className="card leave-section">
                <div className="leave-header">
                  <div>
                    <h3>Existing Courses in this Department</h3>
                    <p className="section-subtitle">
                      Reassign a teacher without affecting existing sessions or attendance records.
                    </p>
                  </div>
                </div>

                <div className="table-container">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Current Teacher</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courseDeptCourses.length === 0 ? (
                        <tr>
                          <td colSpan="3">
                            <p className="empty-notice">No courses in this department yet.</p>
                          </td>
                        </tr>
                      ) : (
                        courseDeptCourses.map((c) => (
                          <>
                            <tr key={c.id}>
                              <td><strong>{c.name}</strong></td>
                              <td>{c.teacher_name || "Unassigned"}</td>
                              <td>
                                {reassigningCourseId === c.id ? (
                                  <button onClick={cancelReassign} className="table-action-btn cancel-btn">
                                    Cancel
                                  </button>
                                ) : (
                                  <button onClick={() => openReassignForm(c.id)} className="table-action-btn approve-btn">
                                    Reassign Teacher
                                  </button>
                                )}
                              </td>
                            </tr>
                            {reassigningCourseId === c.id && (
                              <tr>
                                <td colSpan="3" style={{ background: "#f5f5f5", padding: "15px" }}>
                                  <form onSubmit={submitReassign} style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                                    <select
                                      value={reassignTeacherId}
                                      onChange={(e) => setReassignTeacherId(e.target.value)}
                                    >
                                      <option value="">-- Select new teacher --</option>
                                      {teachers.map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.name} {t.department_name ? `(${t.department_name})` : ""}
                                        </option>
                                      ))}
                                    </select>
                                    <button type="submit" className="table-action-btn approve-btn">
                                      Confirm
                                    </button>
                                  </form>
                                </td>
                              </tr>
                            )}
                          </>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ───────── System Config Tab ───────── */}
        {activeTab === "system-logs" && (
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
