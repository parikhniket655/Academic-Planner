# MASTER COURSE & ONBOARDING PROMPT FOR CLINE: ACADEMIC PLANNER

Paste this prompt directly into your first Cline chat session in VS Code:

---

```text
You are my senior technical co-founder and autonomous agent for the "Academic Planner & Attendance Tracker" project. 

Before making any code changes, read this comprehensive operational guide to understand the purpose of the application, how every moving part connects, and the strict rules governing its development.

================================================================================
PART 1: WHAT IS THIS APPLICATION?
================================================================================
This application is a Progressive Web App (PWA) tailored specifically for MBA / IPM students at IIM Rohtak (currently actively running Term V). 

The Problem:
The institute's academic office (PGP office) schedules 24+ electives across 4 sections (A, B, C, D) and constantly reschedules, swaps, or delays lectures using a live Google Spreadsheet. Students often miss class changes, struggle to track their 80% mandatory attendance threshold, and lose track of how many classes they can safely miss ("bunk buffer").

The Solution:
This app provides:
1. Personalized Timetable: Filters out irrelevant batch lectures and only displays the electives the logged-in student is subscribed to.
2. Conducted-Only Attendance Tracking: Students can only mark their presence/absence *after* a lecture slot has actually concluded. Future lectures stay locked.
3. Attendance Predictor & Bunk Buffer: Computes exact current attendance %, projected attendance, and safe absences remaining before hitting the 80% penalty.
4. Area Color-Coded Timetable: Sessions are visually outlined by Academic Area (Finance, Marketing & Strategy, Operations, MIS, OB & HR, Economics).
5. Student Mess Menu: Live daily mess schedule mapped day-by-day.
6. Offline-First PWA: Fully functional even when campus Wi-Fi drops.

Production URL: https://academic-planner-eight.vercel.app
Git Repository: https://github.com/parikhniket655/Academic-Planner.git (Branch: main)

================================================================================
PART 2: ARCHITECTURE & COMPONENTS IN PLAY
================================================================================
The app is designed with a lightweight, resilient, zero-dependency architecture:

1. FRONTEND CLIENT (SPA):
   - `index.html`: Single-page layout containing the main views:
     * Today / Attendance Tab (Live session cards + marking)
     * Timetable Tab (Weekly 7-day grid & monthly calendar)
     * Dashboard (Metrics, quick-stats, next upcoming class)
     * Analytics & Course Summary
     * Mess Menu Tab
     * Settings & Subscriptions Modal
   - `app.js`: Core client engine (~9,900 lines). Handles state management, UI rendering, time-normalization, date-matching, attendance graph math, and API syncing.
   - `styles.css`: Custom responsive stylesheet with dark-mode theme, area-coded borders, responsive grid layout, and touch-friendly controls.

2. PWA SERVICE WORKER LAYER:
   - `sw.js`: Intercepts network requests and caches core shell files for offline loading.
   - `manifest.json`: Web app manifest allowing students to "Install to Home Screen" on iOS and Android.

3. DATA STORAGE & PERSISTENCE:
   - Client LocalStorage & IndexedDB: Stores attendance logs (`attendanceLogs`), user settings, custom added sessions, and timetable cache.
   - Supabase PostgreSQL Database: Remote database used to store synced timetable sessions and student profiles.
   - Fallback Static JSON (`term5_default_timetable.json`): Complete pre-seeded Term V schedule (~200+ lectures) so the app renders immediately on first launch even with zero internet.
   - Student Directory (`student_db.json`): Maps student email addresses to their roll numbers, names, and course subscriptions.

4. LIVE SHEET SYNC PIPELINE (Google Apps Script):
   - `supabase_sync_script.js` (and `google_apps_script.js`): Running in Google Apps Script bound to the institute's official schedule Google Sheet (ID: `1KO1bwDTVyirnMFLKpsdDe8y6OiicN-Xju9ytnpnDIFQ`).
   - Serves live JSON data via a dedicated Web App URL (`TIMETABLE_SHEETS_URL`).
   - Pushes scheduled batch inserts to Supabase.

5. HOSTING & DEPLOYMENT (Vercel):
   - Hosted on Vercel with automatic continuous integration.
   - Every `git push origin main` triggers an automatic live deployment to `academic-planner-eight.vercel.app` in ~15 seconds.

================================================================================
PART 3: THE 4-TIER DATA FALLBACK PIPELINE
================================================================================
To ensure 100% uptime for students entering classrooms, `app.js` runs this hierarchical fallback:
  Tier 1: Direct Supabase REST API query (`/rest/v1/timetable?date_key=gte.2026-09-12...`).
  Tier 2: If Supabase has partial data or network errors, automatically falls back to `TIMETABLE_SHEETS_URL` (Google Apps Script Web App endpoint).
  Tier 3: If external network is down, loads cached schedule from LocalStorage (`iimr_timetable_<email>`).
  Tier 4: If first load with no network, falls back to pre-bundled `DEFAULT_TIMETABLE` (`term5_default_timetable.json`).

================================================================================
PART 4: OFFICIAL TERM V CURRICULUM (24 COURSES)
================================================================================
Always use these exact abbreviations and official course titles:
- GSEC: Growth Strategies for E-Commerce (Dr. Ashwani Kumar) [MIS]
- CSY: Cyber Security (Dr. Ankit Chaudhary) [MIS]
- AAB: Agentic AI for Business (AAB) (Dr. Anurag Kulshrestha) [MIS]
- IT: International Trade (Dr. Deepabali Bhattacharjee) [EPP]
- FIS: Fixed Income Securities (Dr. Amit Pandey) [F&A]
- FORM: Futures, Options & Risk Management (Dr. Ujjwal Sawarn) [F&A]
- MBFM: Money, Banking, and Financial Markets (Dr. Charan Singh) [F&A]
- IB: Investment Banking (Dr. Vaneet Bhatia) [F&A]
- PFWM: Personal Finance & Wealth Management (Dr Surbhi Verma) [F&A]
- TM: Talent Management (Dr. Lubna Rashid Malik) [OB&HR]
- SNCM: Strategies for Negotiation & Conflict Management (Dr. Madhurima Mishra) [OB&HR]
- SSM: Strategic Storytelling for Managers (Prof. Koustab Ghosh) [OB&HR]
- MSS: Markstrat Simulations (Core) [M&S] (Sec-A: Dr. Abhishek Yadav, Sec-B: Dr. Archit V. Tapar, Sec-C: Dr. Harmanjit Singh, Sec-D: Dr. Abhishek Yadav)
- IMC: Integrated Marketing Communication (Dr. Garima Ranga) [M&S]
- PBM: Product & Brand Management [M&S] (Sec-A: Dr. Archit V. Tapar, Sec-B: Dr. Harmanjit Singh)
- SM: Service Marketing (Dr. Harmanjit Singh) [M&S]
- M & A / M&A: Mergers and Acquisitions (Dr. Deepali Dhingra) [M&S]
- ENV: Entrepreneurship and New Ventures (Dr. Rubina Chakma) [M&S]
- ESMM: Entertainment, Sports and Media Marketing (Dr. Abhishek Yadav) [M&S]
- SoM: Social Marketing (Dr. Mihir Kushwah) [M&S]
- SNAB: Strategies for New Age Businesses (Dr. Pranav Dharmani) [M&S]
- NPD: New Product Development (Dr. Anurag Tiwari) [OM&QT]
- MSD: Manufacturing System Design (Dr. Anurag Tiwari) [OM&QT]
- TQMS: Total Quality Management & Six Sigma (Sec-A & Sec-B: Dr. C.P. Garg) [OM&QT]

================================================================================
PART 5: PRIMARY USER CONTEXT
================================================================================
- Primary user: Niket Parikh (`ipm04niketp@iimrohtak.ac.in`).
- Enrolled courses:
  `["CSY", "IT", "FORM", "PBM Sec-A", "SNAB", "TQMS Sec-B", "MSS Sec-A"]`
- When testing or inspecting student views, ensure these 7 electives show correctly.

================================================================================
PART 6: THE 3 GOLDEN INVARIANTS (NEVER BREAK THESE)
================================================================================
1. MANDATORY PWA CACHE INVALIDATION:
   Whenever you modify `app.js` or `styles.css`, you MUST bump the cache version across ALL THREE files:
   - `app.js`: `const TIMETABLE_CACHE_VERSION = "v<INCREMENT>";`
   - `sw.js`: `const CACHE_NAME = "iimr-tracker-cache-v<INCREMENT>";`
   - `index.html`: `<script src="app.js?v=<YYYYMMDD>v<INCREMENT>"></script>`
   Failure to do this will cause student devices to stay on old cached code!

2. CONDUCTED SESSIONS ONLY:
   Students can NEVER mark attendance for future sessions. A lecture is only eligible once its start date has arrived and its time slot has concluded (`isSessionConducted(session, now)`).

3. PRESERVE STUDENT ATTENDANCE LOGS:
   Never wipe `state.attendanceLogs` or alter keys (`<dateKey>_<courseId>`).

================================================================================
PART 7: YOUR FIRST ACTION
================================================================================
Please confirm that you have read and understood this guide by stating:
1. Our current active cache version.
2. The enrolled courses for Niket.
3. Who teaches TQMS and IB.
4. The exact 3 files that must be touched whenever code is updated.

Then, tell me you are ready to work on the app!
```
