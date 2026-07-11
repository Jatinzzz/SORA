# SORA
smart attendance system

**Just do it**

(Note: we're using localStorage here for simplicity given your timeline — it's fine for a semester project, though in a production app you'd typically use httpOnly cookies for better security. Worth mentioning in your report as a known tradeoff if you want to show awareness of it.)

Quick summary
ScenarioResultScan the QR currently on screen✅ WorksScan an old QR after a newer one has replaced it❌ Rejected — token mismatchDifferent students scanning different QR "generations" within the same session✅ Both work — session stays the same, only the token image changesSame student scanning twice (any QR)❌ Rejected — "already marked"

 ("face verification typically takes few seconds due to on-device CPU processing")