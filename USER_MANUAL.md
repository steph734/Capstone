# TherapyPro User Manual

**For:** Super Admin · Clinic Owner · Therapist · Patient (and Guardian)

---

## Contents

1. [Introduction](#1-introduction)
2. [Getting started (all users)](#2-getting-started-all-users)
3. [Plans and what they unlock](#3-plans-and-what-they-unlock)
4. [Patient guide](#4-patient-guide)
5. [Therapist guide](#5-therapist-guide)
6. [Owner guide](#6-owner-guide)
7. [Super Admin guide](#7-super-admin-guide)
8. [Features shared by every role](#8-features-shared-by-every-role)
9. [Troubleshooting and FAQ](#9-troubleshooting-and-faq)
10. [Quick reference: who can do what](#10-quick-reference-who-can-do-what)

---

## 1. Introduction

TherapyPro is a web app for running a therapy clinic. It handles appointment booking, payments, session notes, home-practice games, messaging and reporting. It works in any modern browser (Chrome, Edge, Firefox, Safari) on a desktop, tablet or phone, and it can be installed as an app (PWA).

### The four roles

| Role | Who they are | What they mainly do |
|---|---|---|
| **Patient** | A child or client receiving therapy (usually with a guardian) | Book sessions, play assigned games, read notes, message the therapist |
| **Therapist** | Clinic staff who treat patients | Manage patients and schedules, write notes, assign games, log attendance |
| **Owner** | The clinic owner or manager | Oversee patients, staff, appointments, billing and reports; choose the clinic's plan |
| **Super Admin** | The TherapyPro platform administrator | Manage branches, plans, the game library, support, audit logs and system health |

Each role has its own sidebar menu. You only see the pages that belong to you.

---

## 2. Getting started (all users)

### 2.1 Creating an account

Only **Patients** and **Therapists** can sign up on their own. Owner and Super Admin accounts are created by the platform team.

1. Open the app and choose **Sign Up**.
2. Enter your **full name, username, email** and choose your **Role** (Therapist or Patient).
3. Create a **password** and submit.
4. A **one-time code (OTP)** is emailed to you. Enter it on the **Verify** screen. Use **Resend** if it doesn't arrive.
5. You can now sign in.

### 2.2 Signing in

1. Go to **Sign In** and enter your email or username and password.
2. After sign-in you land on the dashboard for your role.

### 2.3 Forgot your password

1. Choose **Forgot password** on the sign-in page.
2. Enter your email. A reset code is sent to it.
3. Enter the code on the verification screen, then set a new password.

### 2.4 Joining as staff by invitation (Therapists)

If the Owner invites you to join the clinic:

1. Open the **invite link** from your email. If it says the link is invalid or expired, ask the Owner to send a new one.
2. Set your password (**Set Password** page).
3. Upload your documents on the **Staff Setup** page: **Professional License (PTR)**, **PRC License**, **Diploma / Certificate** and **Valid ID**.
4. Your account waits for the Owner's review. You are notified when it's approved.

### 2.5 Signing out and automatic sign-out

- Use **Logout** at the bottom of the sidebar.
- For your security, you are signed out after **10 minutes of no activity**. A warning with a **60-second countdown** appears first. Move the mouse or press a key to stay signed in.
- If your session expires, you'll see a **Session Expired** page. Sign in again.

### 2.6 Maintenance notices

When the Super Admin schedules downtime, you'll see a banner and a notice pop-up in advance. During the downtime a maintenance screen is shown. Normal service resumes automatically afterwards.

---

## 3. Plans and what they unlock

Every clinic is on one plan. The **Owner** chooses and pays for it. It decides which features everyone in that clinic sees.

| Feature | Free | Silver (₱299/mo) | Gold (₱499/mo) |
|---|:-:|:-:|:-:|
| Appointment booking | ✔ | ✔ | ✔ |
| Online payments | ✔ | ✔ | ✔ |
| SOAP notes / documentation | ✔ | ✔ | ✔ |
| Note-taking tools | ✔ | ✔ | ✔ |
| Voice-assisted Speech to Text | | ✔ | ✔ |
| Text to Speech | | ✔ | ✔ |
| Gamified interactive exercises | | | ✔ |
| Avatar customization (Pao) | | | ✔ |
| Priority goal setting | | | ✔ |

Silver and Gold include a **7-day free trial**. Prices and features are set by the Super Admin and may change, so the **Subscription** page is the source of truth.

If a menu item is missing for you (for example **Speech to Text / TTS** or **Gamified Activities**), your clinic's plan probably doesn't include it. Ask your Owner.

---

## 4. Patient guide

Patients use the app with a guardian in most cases. Pages are listed in the order they appear in the sidebar.

### 4.1 Home (Dashboard)
Your starting page. It shows:
- A **greeting** and your **current streak**.
- **Games this week**, **home practice** and **milestones achieved**.
- Four therapy cards: **Occupational**, **Speech**, **Physical** and **Cognitive Therapy**. Tap one for today's exercises and milestones.
- **Recent Notes** from your therapist, **Notifications** (bell icon) and clinic information ("Our Clinic", "Good to Know").

### 4.2 My Progress
Charts of how you're doing: **Sessions completed, Games completed, Minutes played**, and **Games I finished each day**. Switch between **This Week** and **This Month**. Pao the panda mascot gives encouraging messages. Use the speaker button to hear them read aloud.

### 4.3 Appointments
Shows your upcoming sessions on a **calendar**. Select a date to see the **session overview**: therapist, time slot and session mode (in-person or online).

**Booking a new session** (**Book Appointment**) takes three steps:
1. **Personal details.** Enter the child's name, nickname, birthdate, gender, address, condition, and guardian details. Required fields are checked before you can continue.
2. **Summary and payment.** Review the booking, pick a therapist, date and time, then choose a payment method (cash, card/Stripe, GCash or Maya, depending on what the clinic accepts). For cash, the amount received and change are shown.
3. **Confirmation.** A booking summary confirms the appointment.

Your therapist may also **recommend a session**. You'll get a recommendation card. Open it to review and book it directly.

### 4.4 Notes
Read notes your therapist shares with you, written in plain language: **what we observed, what you said or felt, how you are doing** and **what's next for you**. Use **Search** to find a note. You can also add your own note with **New note**.

### 4.5 Messages
Chat with your therapist.
- Choose a contact (or **New conversation**) to open the thread.
- Send text messages. Use the **voice call** or **video call** buttons to start a call.

### 4.6 Email
An in-app mailbox for messages from the clinic. **Search mail**, open a message, or **Delete** it.

### 4.7 Subscription
Shows your clinic's current plan. Patients can't change it. If you want more features, the page tells you to **contact the clinic Owner**.

### 4.8 Speech to Text / Text to Speech *(Silver or Gold)*
- **Speech to Text:** record your voice and see it written out.
- **Text to Speech:** type text and have it read aloud.

### 4.9 Gamified Activities *(Gold)*
Play the therapy games your therapist assigned, earn points and badges, and dress up **Pao** with unlocked outfit pieces. If the plan doesn't include games, you'll see "Gamified Activities are locked". Games available to you depend on your therapist's **game plan**.

### 4.10 Terms & Policies
The clinic's privacy, data and usage policies.

### 4.11 My Profile
View and update your **personal information** (name, date of birth, phone, email), **medical information** (diagnosis, assigned therapist, guardian), **About Me**, plus **sessions done**, **progress** and **next session**.

### 4.12 Settings
- **Account:** update your photo, name and bio; **Change Password**.
- **Notifications:** appointment reminders, daily exercise reminders, new messages, progress note updates, login alerts.
- **Privacy:** for example, share progress with family.
- **Accessibility:** **Text size** (make text and buttons bigger), **High contrast**, **Reduce motion**.

### 4.13 Help & Support
See [section 8.2](#82-help--support).

---

## 5. Therapist guide

### 5.1 Dashboard
A snapshot of your day:
- **Today's Appointments** and **Today's Focus** (what actually needs your attention).
- **Session Calendar.** Tap a day to see its appointments.
- **Sessions by Type** and **Patient Mix** (by condition on file).
- **Recent Activity**, a log of your latest actions.

### 5.2 My Patients
Your caseload.
- **Search** by name. Filter by **status** (for example **Active**, **Need a session**) and by **session date**. Sort by last or next session.
- Each row shows **last session**, **next session** and **number of sessions**.
- Open a patient to see their profile and statistics, or to go to their notes.

### 5.3 Appointments
Manage patient sessions and schedules.
- View sessions on a calendar or list.
- Confirm, reschedule or cancel sessions, and see the payment status.
- Set your **availability** (the days and times patients can book you) using the availability dialogs. Patients only see slots you've opened.
- **Recommend a session** to a patient. They receive a card they can book from.

### 5.4 Attendance
Your own clinic attendance record.
- **Time in / Time out** logging, plus an **attendance calendar** for the month.
- Monthly summary: **Days logged** and **On-time this month**.
- **Leave requests.** Choose dates, hours and a reason, then submit. Track the status under **My leave requests**. The Owner's decision, with any **Owner's note**, appears there.
- You may also get attendance reminders by email.

### 5.5 Subscription
View the clinic's plan and what it includes. Plan changes are made by the Owner.

### 5.6 Notes & Progress
Documentation for each patient.
1. Pick a patient from the list ("Select a patient to see their notes").
2. Write or review **session notes** in SOAP format (Subjective, Objective, Assessment, Plan). Notes are **signed** when finalised. Signed notes keep an **Edit history**.
3. **Home practice notes** can be **drafted from play data**. The scores used are shown. Review and confirm your clinical view before signing.
4. Notes can be saved offline and **sync** when you're back online (a sync indicator shows the status).
5. Notes are encrypted on the device. Treat them as confidential.

### 5.7 Email
A mailbox for clinic email. Compose, read and reply, for example to guardians.

### 5.8 Assign Games
Set the home-practice games each patient plays.
1. Choose **Assign games** and pick a patient.
2. Choose games from the library and set the plan (session games and **home practice**).
3. The **Assigned Exercises** list shows every active assignment, live. Consistent practice helps progress, so review it regularly.
4. After games are played, check each patient's results in **Gamified Activities → Stats**.

### 5.9 Reports
Run reports on your work.
- **Report Type:** overall summaries or an **Individual Patient Report**.
- Filter by **Date range**, **patient**, and **therapy type**.
- Insights include **busiest day / time**, **in-person vs online**, **top cancellation reasons** and **hardest exercises**.

### 5.10 Speech to Text / TTS *(Silver or Gold)*
Dictate notes by voice (voice-assisted documentation) and convert text to audio.

### 5.11 Gamified Activities *(Gold)*
- **Games:** browse the activity library and preview a game.
- **Stats:** see play statistics per patient.

### 5.12 Profile and Help
- **My Profile:** your name, contact details, **specialization**, **license number**, years of experience, clinic, **availability** and **professional bio**.
- **Help & Support:** see [section 8.2](#82-help--support).

---

## 6. Owner guide

The Owner runs the clinic. The sidebar is below.

### 6.1 Dashboard
Overview of clinic operations, people and revenue:
- **Today's Operations** (live status), **Action Items** (follow-ups that need ownership).
- **Weekly Appointments**, **Revenue Overview**, **Patient Mix**.
- **Recent Activity** across the clinic.

### 6.2 Appointments
All appointments across every branch.
- Filter by **branch**, **date range** (all dates, this month, custom range), and **status** (Pending, Confirmed, Cancelled).
- Open a row for **Appointment Details**: patient, guardian, contact, condition, service, session mode, therapist, payment and booking date.

### 6.3 Subscription
Manage the clinic's plan.
- See **Your plan**, next billing date and amount, and any **free trial** end date.
- **Upgrade your plan** to Silver or Gold. Checkout accepts cards through Stripe.
- **Update card**, **Edit personal info**, view **payment history**, or **Cancel subscription**.
- Upgrades unlock features for **every** user in the clinic.

### 6.4 Patients
Track patients across all branches.
- Search by name, condition or guardian. Filter by status.
- Columns: assigned therapist, last visit, next session, total sessions.
- **View Profile** shows contact details, guardian and address.

### 6.5 Staff
Hire and manage employees.
- **Add New Staff** or invite a therapist by email.
- **Applicants.** Review **Applicant Details**, the **cover letter**, and uploaded documents (license, PRC, diploma, ID). Choose **Approve and hire** or reject.
- Open a staff member to see contact details, **branch**, **caseload** and attendance. Staff can be **archived**.
- **Leave requests.** Approve or decline staff leave, with an optional note the therapist will see.
- **Attendance.** Review therapist check-ins.

### 6.6 Reports
Financial summary and report modules for your clinic.
- Choose a **date range**. All modules follow it.
- Use the **Custom report builder** to pick the metrics you want, then **Build report**. Use **Full export** to download everything.

### 6.7 Sales / Billing
Five sub-pages:

| Page | What it does |
|---|---|
| **Overview** | Total revenue, pending payments, overdue invoices, average transaction value, revenue trend and recent transactions (searchable) |
| **Invoices** | View sent invoices, **Mark paid**, **Download PDF**, void an invoice (with a reason) and filter by status or issue date |
| **Expenses** | Record and track clinic expenses (vendor, category, branch, bill date). Mark paid or void |
| **Payouts** | Payout account, schedule, next payout and payout history |
| **Settings** | **Accepted payment methods** for guardians and **invoice preferences** that apply to every new invoice |

### 6.8 Speech to Text / TTS *(Silver or Gold)*
Same tools as for therapists and patients.

### 6.9 Gamified Activities *(Gold)*
- **Overview:** clinic-wide game activity. Open a patient to see their game statistics.
- **Activity Library:** browse and preview every published game.
- **Request a Game:** ask the platform team for a new game. Provide the **game name or idea, skill focus, age range, priority, and why it would help your patients.** You can attach a sketch (image or PDF) or a reference link. Track replies under **My requests**. You can **withdraw** a request.

### 6.10 Settings and Profile
- **My Account:** update your photo, name and contact details; **Change Password**.
- **Notifications:** new bookings, payments received, staff attendance alerts, billing and subscription reminders, login alerts.
- **Privacy:** show your profile to staff; share analytics with branch managers.
- **Accessibility:** text size, high contrast, reduce motion.

### 6.11 Help & Support
Send a question or concern to the Super Admin, and track it under **My support tickets**. See [section 8.2](#82-help--support).

---

## 7. Super Admin guide

The Super Admin manages the platform across all clinics.

### 7.1 Dashboard
Platform-wide health at a glance:
- **Revenue**, **active subscribers** and **paid plan counts** (from Stripe). Chart interval can be changed. Use **View as table** for an accessible alternative.
- **Branches**, **therapists**, **sessions**, **signed in now**.
- **Items needing attention**, game activity, and technical tiles (API response time, DB connections, storage, capacity).

### 7.2 Branches
Every clinic branch on the platform.
- **Summary:** total branches, patients, therapists, sessions this month.
- Each branch shows address, contact, operating hours, services, TIN, capacity, assigned owner and therapists.
- **Review applications.** Check that all requirements are in place, then **Approve and activate**, or **Decline** with a reason (the applicant sees it). Drafts must be finished and submitted before review.

### 7.3 Subscription
Define the plans that clinics can buy.
- Summary: **plans, active subscribers, monthly revenue, beta testers**.
- **Add plan**, set price and trial, and **Edit features** to choose what each plan includes. A comparison table shows what each plan includes.
- Review **upgrades, downgrades and cancellations**.
- Plans can be marked **Beta** (visible only to testers) or **Hidden**.

### 7.4 Gamified Library
Four sub-pages:

**Dashboard.** Overview of the games, badges and engagement.

**Games.**
- Search, filter by status/difficulty/type, and sort.
- Review **Owner requests waiting**.
- **Create a new game** (or start from a template). **Publish**, **Unpublish** or **Restore** a game. Deleting asks you to type the game name to confirm.
- **Open in builder:** a canvas editor with undo/redo (Ctrl+Z / Ctrl+Shift+Z), zoom, grid, and device preview. **Test play** shows exactly what a patient sees, but results aren't saved. Changes autosave. If someone else edited the game, autosave pauses until you **reload the latest**.

**Badges.**
- Design **medals** and set the rule that awards each one (one per game, or everyday milestones). Filter by theme or game.
- **Pao's wardrobe.** Design outfit pieces that badges unlock. Choose a category, style, colours, pattern and the unlock condition ("Which badge" / "Which game").

**Stats & Points.** Total plays, completion rate, average score and session time. See most-played games and **badge performance**. Edit **Point rules**, then **Save Point System** (or **Reset to Defaults**).

### 7.5 Support Tickets
- **Tickets.** Owner requests and concerns from every branch. The oldest tickets are listed first. Select a ticket to read and reply in the reading pane. Use filters to narrow the list.
- **FAQs.** Maintain what the support assistant (Pao) knows. **Create FAQ**, choose **who sees it** (all roles or a specific role), add search keywords, and review **unanswered questions** that Pao couldn't answer.

### 7.6 Audit Logs
A record of administrative changes and actions.
- Search by action, user or description. Filter by user type (Super Admin, Therapist, Patient). Open a row for the timestamp and full details.

### 7.7 System Health
Monitor the platform. Tabs:
- **Overview:** security score, services status, incidents, response times.
- **Database:** MongoDB Atlas collections, document counts, indexes and validation.
- **Security:** risks, **top sources**, and blocked IP addresses. You can **block permanently** or **unblock** an IP.
- **Alerts:** add alert rules on any metric TherapyPro measures. Choose how long to **keep audit logs**.

### 7.8 System Maintenance
Plan downtime safely.
1. Choose the **start date/time** and the **duration** (use the **quick duration** buttons).
2. Write the **message to users**. A **preview** shows how it looks in the banner, the notice pop-up and the maintenance screen.
3. Choose which groups to notify (for example Patients, Therapists, Owners). Notifications are sent automatically on the schedule.
4. Confirm that people will be signed out.
5. You can **keep downtime** or **keep schedule** when a conflict arises. **Past downtime** is listed below. A **Show banner right away** option announces it now.

### 7.9 Profile
Your admin profile and password.

---

## 8. Features shared by every role

### 8.1 Sidebar and navigation
- The sidebar lists your pages. On phones it slides in from the **menu (☰)** button.
- Items with a small arrow expand into sub-pages (for example **Sales / Billing**).
- **Profile** is reached from your name and photo at the top of the sidebar (**View Profile**).
- A **bell icon** shows notifications. You may be asked to allow browser notifications.

### 8.2 Help & Support
- **FAQs** and **How-To Guides.**
- **Chat with Our Support Assistant** (Pao). Type a question and get an instant answer.
- **Send Us a Message.** Choose a category (Appointment Issue, Technical Problem, General Question), enter your name, email and message. Your requests appear under **My support tickets** with replies.

### 8.3 Offline use
The app caches recent data and keeps drafts (for example session notes) if your connection drops. A **sync indicator** shows progress, and changes upload automatically when you're back online.

### 8.4 Accessibility
In **Settings → Accessibility** you can enlarge text, turn on high contrast and reduce motion. Interactive elements have text labels for screen readers.

### 8.5 Privacy and security
- Passwords are stored securely. OTP codes verify your email.
- Idle sessions are logged out automatically.
- Clinical notes are access-controlled and encrypted on the device.
- Super Admin actions are recorded in the audit log.

---

## 9. Troubleshooting and FAQ

| Problem | What to try |
|---|---|
| I didn't get my OTP | Check spam. Use **Resend**. Confirm the email is spelled correctly |
| "Link invalid or expired" on a staff invite | Ask the Owner to send a new invite |
| I can't see Speech to Text or Gamified Activities | Your clinic's plan doesn't include them. Ask the Owner to upgrade |
| I was signed out | Sessions end after 10 minutes of inactivity. Sign in again |
| I can't change the subscription | Only the Owner can. Patients and Therapists see it read-only |
| A time slot isn't available | The therapist hasn't opened it. Pick another time or therapist |
| My notes aren't showing on another device | Wait for the sync indicator to finish, then refresh |
| Page shows "Try again" | Check your connection, then press **Try again**. If it persists, contact support |
| The app shows a maintenance screen | Scheduled downtime. It lifts automatically at the end time |

**Still stuck?** Use **Help & Support → Send Us a Message**.

---

## 10. Quick reference: who can do what

| Capability | Patient | Therapist | Owner | Super Admin |
|---|:-:|:-:|:-:|:-:|
| Sign up by themselves | ✔ | ✔ | | |
| Book an appointment | ✔ | | | |
| Manage own availability | | ✔ | | |
| View all clinic appointments | | | ✔ | |
| Write / sign SOAP notes | | ✔ | | |
| Read shared notes | ✔ | ✔ | | |
| Assign games | | ✔ | | |
| Play games / earn badges | ✔ | | | |
| Log attendance / request leave | | ✔ | | |
| Approve leave and hire staff | | | ✔ | |
| Invoices, expenses, payouts | | | ✔ | |
| Choose / pay for the clinic plan | | | ✔ | |
| Define plans and prices | | | | ✔ |
| Approve or decline branches | | | | ✔ |
| Build games, badges and outfits | | | | ✔ |
| Request a new game | | | ✔ | |
| Reply to support tickets, manage FAQs | | | | ✔ |
| View audit logs | | | | ✔ |
| System health and maintenance | | | | ✔ |
| Reports | | ✔ (own) | ✔ (clinic) | ✔ (platform) |
| Messages, email, help and settings | ✔ | ✔ | ✔ | ✔ |

---

*Menu names, plan prices and features reflect the current build. Where the app and this manual differ, the app is correct and this manual should be updated.*
