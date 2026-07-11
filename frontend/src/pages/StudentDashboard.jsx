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
        // state 2 = SCANNING, only stop if actually scanning
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
    </div>
  );
}