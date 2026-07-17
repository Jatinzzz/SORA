import { useState, useEffect } from "react";
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
    <div style={{ maxWidth: "700px", margin: "50px auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2>Admin Dashboard</h2>
        <button onClick={logout}>Logout</button>
      </div>
      <p>Welcome, {user.name}</p>

      <h3>Pending User Approvals</h3>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!loading && pendingUsers.length === 0 && <p>No pending users.</p>}

      <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
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
            <>
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  {verifyingUserId === u.id ? (
                    <button onClick={cancelVerify}>Cancel</button>
                  ) : (
                    <button onClick={() => openVerifyForm(u.id)}>Approve</button>
                  )}
                </td>
              </tr>
              {verifyingUserId === u.id && (
                <tr>
                  <td colSpan="4" style={{ background: "#f5f5f5", padding: "15px" }}>
                    <form onSubmit={(e) => submitVerify(e, u.role)}>
                      {u.role === "student" && (
                        <>
                          <div>
                            <label>Roll Number (required): </label>
                            <input
                              type="text"
                              value={rollNumber}
                              onChange={(e) => setRollNumber(e.target.value)}
                              required
                            />
                          </div>
                          <div style={{ marginTop: "8px" }}>
                            <label>Class ID (optional): </label>
                            <input
                              type="number"
                              value={classId}
                              onChange={(e) => setClassId(e.target.value)}
                            />
                          </div>
                        </>
                      )}
                      {u.role === "teacher" && (
                        <div>
                          <label>Department (optional): </label>
                          <input
                            type="text"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                          />
                        </div>
                      )}
                      <button type="submit" style={{ marginTop: "10px" }}>
                        Confirm Approval
                      </button>
                    </form>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}