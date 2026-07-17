import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/auth/register", formData);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    }
  };

  return (
    <div className="register-page">
      <style>{`
        .register-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f4f5f7;
          padding: 20px;
        }

        .register-card {
          width: 100%;
          max-width: 380px;
          background: #ffffff;
          border-radius: 12px;
          padding: 40px 32px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .register-title {
          text-align: center;
          margin-bottom: 28px;
          font-size: 1.6rem;
          font-weight: 600;
          color: #1f2937;
        }

        .register-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .register-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .register-field label {
          font-size: 0.85rem;
          font-weight: 500;
          color: #374151;
        }

        .register-field input,
        .register-field select {
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 0.95rem;
          outline: none;
          background: #fff;
          font-family: inherit;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .register-field input:focus,
        .register-field select:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }

        .register-error {
          color: #dc2626;
          font-size: 0.85rem;
          margin: -6px 0 0;
        }

        .register-success {
          text-align: center;
          color: #15803d;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 16px;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .register-button {
          margin-top: 8px;
          padding: 11px;
          background: #4f46e5;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .register-button:hover {
          background: #4338ca;
        }

        .register-button:active {
          background: #3730a3;
        }
      `}</style>

      <div className="register-card">
        <h2 className="register-title">Register</h2>
        {success ? (
          <p className="register-success">
            Registered successfully! Waiting for admin approval. Redirecting to login...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="register-form">
            <div className="register-field">
              <label>Name</label>
              <input name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="register-field">
              <label>Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="register-field">
              <label>Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} required />
            </div>
            <div className="register-field">
              <label>Role</label>
              <select name="role" value={formData.role} onChange={handleChange}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>
            {error && <p className="register-error">{error}</p>}
            <button type="submit" className="register-button">Register</button>
          </form>
        )}
      </div>
    </div>
  );
}