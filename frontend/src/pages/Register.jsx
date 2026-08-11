
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
          background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%);
          padding: 20px;
          box-sizing: border-box;
          font-family: Arial, sans-serif;
        }

        .register-card {
          width: 100%;
          max-width: 420px;
          background: #ffffff;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.10);
          box-sizing: border-box;
        }

        .register-title {
          text-align: center;
          margin: 0 0 30px;
          font-size: 30px;
          font-weight: 700;
          color: #1e293b;
        }

        .register-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .register-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .register-field label {
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }

        .register-field input,
        .register-field select {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 15px;
          outline: none;
          background: #f8fafc;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 0.2s ease, box-shadow 0.2s ease,
            background-color 0.2s ease;
        }

        .register-field input:focus,
        .register-field select:focus {
          border-color: #4f46e5;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }

        .register-field input::placeholder {
          color: #94a3b8;
        }

        .register-error {
          color: #dc2626;
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 14px;
          margin: -4px 0 0;
        }

        .register-success {
          text-align: center;
          color: #15803d;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 18px;
          font-size: 14px;
          line-height: 1.6;
          margin: 0;
        }

        .register-button {
          margin-top: 4px;
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
          transition: transform 0.2s ease, box-shadow 0.2s ease,
            background 0.2s ease;
        }

        .register-button:hover {
          background: linear-gradient(135deg, #4338ca, #4f46e5);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.30);
        }

        .register-button:active {
          transform: translateY(0);
          box-shadow: 0 3px 8px rgba(79, 70, 229, 0.20);
        }

        .register-login-link {
          text-align: center;
          margin: 24px 0 0;
          font-size: 14px;
          color: #64748b;
        }

        .register-login-link a {
          color: #4f46e5;
          font-weight: 600;
          text-decoration: none;
        }

        .register-login-link a:hover {
          text-decoration: underline;
        }

        @media (max-width: 480px) {
          .register-page {
            padding: 15px;
          }

          .register-card {
            padding: 30px 24px;
          }

          .register-title {
            font-size: 26px;
          }
        }
      `}</style>


      <div className="register-card">
        <h2 className="register-title">Register</h2>

        {success ? (
          <p className="register-success">
            {formData.role === "student"
              ? "Registered successfully! You can log in now."
              : "Registered successfully! Waiting for admin approval."}
            {" "}Redirecting to login...
          </p>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="register-form">
              <div className="register-field">
                <label>Name</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="register-field">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="register-field">
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="register-field">
                <label>Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>

              {error && <p className="register-error">{error}</p>}

              <button type="submit" className="register-button">
                Register
              </button>
            </form>

            <p className="register-login-link">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

