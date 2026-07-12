# SORA
smart attendance system

**Just do it**

(Note: we're using localStorage here for simplicity given your timeline — it's fine for a semester project, though in a production app you'd typically use httpOnly cookies for better security. Worth mentioning in your report as a known tradeoff if you want to show awareness of it.)
---
Quick summary
ScenarioResultScan the QR currently on screen✅ WorksScan an old QR after a newer one has replaced it❌ Rejected — token mismatchDifferent students scanning different QR "generations" within the same session✅ Both work — session stays the same, only the token image changesSame student scanning twice (any QR)❌ Rejected — "already marked"
---
 ("face verification typically takes few seconds due to on-device CPU processing")
---
Let's walk through this with a concrete story — imagine a professor named Mr. Sharma teaching "Computer Science - Section A" at a college, and a student named Priya in that class.
Setting the stage — before any class ever happens
1. Getting people into the system
Priya and Mr. Sharma both discovered the college's new smart attendance app. Priya registers herself as a student, Mr. Sharma registers as a teacher — both accounts sit in a "pending" state, since neither can log in yet.
2. Admin approval
The college's IT admin logs into the Admin Dashboard, sees both pending accounts, and approves them. For Mr. Sharma (teacher), the admin optionally notes his department. For Priya (student), the admin assigns her a roll number — this is the exact moment her students profile record gets created in the database, separate from her login account.
3. Setting up the class
Mr. Sharma logs into his Teacher Dashboard for the first time and creates a class: "Computer Science - Section A." This becomes a permanent entity in the system — every future session for this course will belong to this one class.
4. Enrolling Priya into that class
Since Priya was approved without being pre-assigned to a class, she shows up under "Unassigned Students" on Mr. Sharma's dashboard. He selects her name and assigns her to "Computer Science - Section A." Now she's officially on his roster.
5. Priya enrolls her face
Before her first class, Priya takes a clear selfie through the app, which gets converted into a mathematical "face signature" (an embedding) and stored securely — not the photo itself, just the numeric representation of her facial features.
The actual class day — Monday, 10 AM lecture
6. Class happens, professor takes attendance
At the end of his lecture, Mr. Sharma opens his dashboard, selects "Computer Science - Section A," and clicks Start Session. This creates one specific record — "CS Section A, Monday, 10 AM" — and immediately generates a QR code on his screen.
7. Students scan in, one by one
Priya pulls out her phone, opens the student app, and taps "Scan QR." She points her camera at the projector screen showing Mr. Sharma's QR code. The moment it's decoded, her app switches to her front camera and asks her to look into it.
8. The anti-proxy check happens here
Her live face capture is compared against the face signature she enrolled earlier. Since it's really her, the match succeeds, and her attendance gets recorded as present, tagged as self-verified with face_verified: true.
9. The QR keeps refreshing — this defeats cheating
While students are still scanning, the QR code on the projector automatically changes every 2 minutes. So if Priya had texted a screenshot of the QR to her friend Rohan (who skipped class), by the time Rohan tries to use it, that QR has likely already expired and been replaced — his scan gets rejected.
10. The problem case — Amit forgot his phone
Amit, another student, doesn't have his phone today, so he can't scan at all. Mr. Sharma simply finds Amit's name in the roster table on his own dashboard and clicks "Mark Present" manually. This gets recorded too, but tagged differently — marked_by: teacher_manual, face_verified: false — so the system always knows the difference between someone who proved their identity and someone the teacher vouched for.
Handling exceptions — later that week
11. Priya has a doctor's appointment on Wednesday
Before Wednesday's class, she opens her Student Dashboard, clicks "Apply for Leave," writes her reason, and picks the date range. This sits as pending.
12. Mr. Sharma reviews it
On his dashboard, he sees Priya's leave request waiting for review, checks it, and clicks Approve. Priya can now see her request marked as approved — though as we discussed, this is currently just informational (it doesn't automatically change her attendance percentage yet — that connection is something we'd build in the scoring phase, if you decide to).
What's tracked, and why it matters
By the end of the semester, the attendance table has a growing, permanent record: every session Priya attended (with proof of identity), every day Amit was manually marked in, every leave Priya took. This raw data is exactly what feeds into your still-to-be-built Attendance Score feature — instead of Mr. Sharma manually tallying attendance in a notebook or spreadsheet, the system can calculate Priya's attendance percentage automatically, distinguishing genuine self-verified attendance from manual overrides, and (optionally) accounting for approved leaves.