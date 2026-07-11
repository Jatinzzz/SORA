import { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [qrToken, setQrToken] = useState(null);
  const [step, setStep] = useState("idle"); // idle -> scanning -> face-capture -> result
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const scannerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // ── Leave management state ──
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [myLeaves, setMyLeaves] = useState([]);
  const [leaveMessage, setLeaveMessage] = useState("");

  // ── Load leave requests on mount ──
  useEffect(() => {
    fetchMyLeaves();
  }, []);

  // ── Start/stop QR scanner whenever step changes to/from "scanning" ──
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
          () => {} // ignore per-frame scan failures
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

  // ── Start front camera whenever step changes to "face-capture" ──
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

  // ── Leave management functions ──
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

  return (
    <div style={{ maxWidth: "500px", margin: "50px auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2>Student Dashboard</h2>
        <button onClick={logout}>Logout</button>
      </div>
      <p>Welcome, {user.name}</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {step === "idle" && (
        <button onClick={startScan}>Scan QR to Mark Attendance</button>
      )}

      {step === "scanning" && (
        <div>
          <p>Point your camera at the QR code</p>
          <div id="qr-reader" style={{ width: "100%" }}></div>
          <button onClick={cancelScan}>Cancel</button>
        </div>
      )}

      {step === "face-capture" && (
        <div>
          <p>QR verified. Now let's verify your face.</p>
          <video ref={videoRef} autoPlay playsInline style={{ width: "100%" }}></video>
          <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
          <br />
          <button onClick={captureAndSubmit}>Capture & Submit</button>
          <button onClick={cancelFaceCapture}>Cancel</button>
        </div>
      )}

      {step === "result" && (
        <div>
          <p>{message}</p>
          <button onClick={reset}>Done</button>
        </div>
      )}

      <hr style={{ margin: "30px 0" }} />

      <h3>Leave Requests</h3>
      <button onClick={() => setShowLeaveForm(!showLeaveForm)}>
        {showLeaveForm ? "Cancel" : "Apply for Leave"}
      </button>

      {showLeaveForm && (
        <form onSubmit={submitLeave} style={{ marginTop: "15px" }}>
          <div>
            <label>Reason</label>
            <input
              type="text"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              required
            />
          </div>
          <div>
            <label>From</label>
            <input
              type="date"
              value={leaveFrom}
              onChange={(e) => setLeaveFrom(e.target.value)}
              required
            />
          </div>
          <div>
            <label>To</label>
            <input
              type="date"
              value={leaveTo}
              onChange={(e) => setLeaveTo(e.target.value)}
              required
            />
          </div>
          <button type="submit">Submit Request</button>
          {leaveMessage && <p>{leaveMessage}</p>}
        </form>
      )}

      <h4 style={{ marginTop: "20px" }}>My Requests</h4>
      {myLeaves.length === 0 && <p>No leave requests yet.</p>}
      <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
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
              <td>{l.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}