import { useState, useEffect } from "react";
import api from "../api/axios";
import FaceEnrollCapture from "../components/FaceEnrollCapture";

export default function StudentOnboarding({ onComplete }) {
  const [stage, setStage] = useState("department"); // department -> face -> done
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [courses, setCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]); // array of course ids
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState({}); // keyed by student_id

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get("/departments");
      setDepartments(res.data);
    } catch (err) {
      setError("Failed to load departments");
    }
  };

  const handleDeptSelect = async (deptId) => {
    setSelectedDept(deptId);
    setSelectedCourses([]);
    if (!deptId) {
      setCourses([]);
      return;
    }
    try {
      const res = await api.get(`/departments/${deptId}/courses`);
      setCourses(res.data);
    } catch (err) {
      setError("Failed to load courses");
    }
  };

  const toggleCourse = (courseId) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const submitOnboarding = async () => {
    setError("");
    if (!selectedDept || selectedCourses.length === 0) {
      setError("Please select a department and at least one course");
      return;
    }

    setSubmitting(true);
    try {
      // The first selected course sets the department + first enrollment
      const [firstCourse, ...restCourses] = selectedCourses;

      await api.post("/classes/onboard", {
        department_id: parseInt(selectedDept),
        class_id: parseInt(firstCourse),
      });

      // Any additional selected courses get enrolled right after
      for (const courseId of restCourses) {
        await api.post(`/classes/enroll-additional?class_id=${courseId}`);
      }

      setStage("face");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to complete enrollment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "50px auto" }}>
      <h2>Welcome! Let's set up your profile</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {stage === "department" && (
        <div>
          <h3>Step 1: Select your Department</h3>
          <select value={selectedDept} onChange={(e) => handleDeptSelect(e.target.value)}>
            <option value="">-- Select department --</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {selectedDept && (
            <div style={{ marginTop: "15px" }}>
              <h3>Step 2: Select your Course(s)</h3>
              <p style={{ fontSize: "0.85rem", color: "gray" }}>
                You can select more than one course within this department.
              </p>
              {courses.length === 0 ? (
                <p>No courses available in this department yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {courses.map((c) => (
                    <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        checked={selectedCourses.includes(String(c.id))}
                        onChange={() => toggleCourse(String(c.id))}
                      />
                      {c.name} {c.teacher_name ? `(${c.teacher_name})` : ""}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: "20px" }}>
            <button
              onClick={submitOnboarding}
              disabled={!selectedDept || selectedCourses.length === 0 || submitting}
            >
              {submitting ? "Enrolling..." : "Continue"}
            </button>
          </div>
        </div>
      )}

      {stage === "face" && (
        <div>
          <h3>Step 3: Enroll your Face</h3>
          <p>This will be used to verify your identity when marking attendance.</p>
          <FaceEnrollCapture onEnrolled={() => setStage("done")} />
        </div>
      )}

      {stage === "done" && (
        <div>
          <p style={{ color: "green" }}>Setup complete! Redirecting to your dashboard...</p>
          <button onClick={onComplete}>Go to Dashboard</button>
        </div>
      )}
    </div>
  );
}
