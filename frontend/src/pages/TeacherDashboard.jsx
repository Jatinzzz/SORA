import { useAuth } from "../context/AuthContext";

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  return (
    <div style={{ maxWidth: "400px", margin: "50px auto" }}>
      <h2>Teacher Dashboard</h2>
      <p>Welcome, {user.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}