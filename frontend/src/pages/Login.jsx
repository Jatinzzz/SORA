import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";


export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const user = await login(email, password);
      if (user.role === "admin") navigate("/admin-dashboard");
      else if (user.role === "teacher") navigate("/teacher-dashboard");
      else if (user.role === "student") navigate("/student-dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    }
  };


  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)",
        padding: "20px",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#ffffff",
          padding: "40px",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.10)",
          boxSizing: "border-box",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            margin: "0 0 30px",
            fontSize: "30px",
            fontWeight: "700",
            color: "#1e293b",
          }}
        >
          Login
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#334155",
              }}
            >
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
                backgroundColor: "#f8fafc",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#334155",
              }}
            >
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
                backgroundColor: "#f8fafc",
              }}
            />
          </div>

          {error && (
            <p
              style={{
                color: "#dc2626",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                padding: "10px 12px",
                borderRadius: "8px",
                fontSize: "14px",
                margin: "0 0 18px",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "13px",
              border: "none",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #4f46e5, #6366f1)",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
            }}
          >
            Login
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: "24px",
            marginBottom: "0",
            fontSize: "0.9rem",
            color: "#64748b",
          }}
        >
          Don't have an account?{" "}
          <Link
            to="/register"
            style={{
              color: "#4f46e5",
              fontWeight: "600",
              textDecoration: "none",
            }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

