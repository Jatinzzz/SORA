import { useAuth } from "../context/AuthContext";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  return (
    <div style={{ maxWidth: "400px", margin: "50px auto" }}>
      <h2>Student Dashboard</h2>
      <p>Welcome, {user.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}