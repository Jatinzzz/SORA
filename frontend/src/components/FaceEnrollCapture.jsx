import { useState, useRef, useEffect } from "react";
import { Upload, Camera } from "lucide-react";
import api from "../api/axios";

export default function FaceEnrollCapture({ onEnrolled }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        // Camera not available - that's fine, upload option still works
      });

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitBlob = async (blob) => {
    setError("");
    setMessage("Enrolling...");
    setSubmitting(true);

    const formData = new FormData();
    formData.append("file", blob, "enroll.jpg");

    try {
      await api.post("/face/enroll", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("Face enrolled successfully!");
      setSubmitting(false);
      if (onEnrolled) onEnrolled();
    } catch (err) {
      setMessage("");
      setError(err.response?.data?.detail || "Face enrollment failed. Please try again.");
      setSubmitting(false);
    }
  };

  const captureAndEnroll = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      submitBlob(blob);
    }, "image/jpeg");
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    submitBlob(file);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <p>Position your face clearly in the frame and capture, or upload an existing photo instead.</p>

      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Selected for enrollment"
          style={{ width: "100%", maxWidth: "350px", borderRadius: "8px" }}
        />
      ) : (
        <video ref={videoRef} autoPlay playsInline style={{ width: "100%", maxWidth: "350px" }}></video>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>

      <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
        <button onClick={captureAndEnroll} disabled={submitting}>
          <Camera size={16} style={{ verticalAlign: "middle", marginRight: "6px" }} />
          {submitting ? "Enrolling..." : "Capture & Enroll"}
        </button>

        <button onClick={triggerFileUpload} disabled={submitting} type="button">
          <Upload size={16} style={{ verticalAlign: "middle", marginRight: "6px" }} />
          Upload Photo Instead
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
      </div>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
