# Temporary Login Credentials

This is temporary authentication data for testing purposes only. Not connected to any database.

## Patient Account

**Email:** patient@gmail.com  
**Password:** patient123  
**Name:** Alvrin

## Super Admin Account

**Email:** superadmin@gmail.com  
**Password:** superadmin123  
**Name:** Super Admin

## Owner Account

**Email:** owner@gmail.com  
**Password:** owner123  
**Name:** Owner

## Therapist Account

**Email:** therapists@gmail.com  
**Password:** therapist123  
**Name:** Therapist

## How to Login

1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:5173`
3. Click on the logo or wait to be redirected to login
4. Enter the credentials above
5. Complete the reCAPTCHA (if enabled)
6. Click "Login" to access the dashboard

## 🎯 New Interactive Features

### 1. Quick-Log Progress Tracker
- **Mood Tracking:** Click emoji faces (😢 😟 😐 😊 😄)
- **Exercise Completion:** Check the box for "Completed Daily Speech Exercises"
- **Pain Level:** Select 0-10 scale

### 2. Mini-Calendar Widget
- Click "View Calendar" button in the Upcoming Appointment card
- See appointment indicators (red dots) on June 29, July 5, and July 12
- Click dates to select them

### 3. Clickable Therapy Categories
- Click any of the 4 therapy cards to open detailed modal
- View exercises and milestones
- Click "View Full Plan" to navigate to therapy detail page
- Categories: Occupational, Speech, Physical, Cognitive

### 4. Weekly Progress Ring
- See circular progress indicator (75%) next to welcome message
- Increases when you complete exercises in Quick-Log

### 5. PWA Notifications
- Click the bell icon (top right) to see notifications
- Click "Test" button to trigger browser notification
- Allow notifications when prompted

## Features

- **Splash Page** - Welcome screen with logo
- **Login Page** - Authentication with temporary credentials
- **Dashboard** - Patient dashboard with:
  - Welcome banner with user name and progress ring
  - Quick-Log progress tracker (mood, exercises, pain)
  - Upcoming appointment card with calendar widget
  - Book appointment button
  - Interactive therapy services grid
  - Recent notes section
  - Notification system
  - Logout functionality
- **Therapy Detail Pages** - Individual pages for each therapy type

## Routes

- `/` - Splash page (redirects to dashboard if logged in)
- `/login` - Login page
- `/signup` - Sign up page (not functional yet)
- `/forgot-password` - Password reset page (not functional yet)
- `/dashboard` - Protected dashboard (requires authentication)
- `/therapy/occupational` - Occupational therapy details
- `/therapy/speech` - Speech therapy details
- `/therapy/physical` - Physical therapy details
- `/therapy/cognitive` - Cognitive therapy details

## Testing the New Features

1. **Log mood:** Click "Show" in Quick Log, then select an emoji
2. **Complete exercise:** Check the exercise completion box
3. **Rate pain:** Select a number from the pain scale
4. **View calendar:** Toggle calendar view in appointment card
5. **Explore therapy:** Click any therapy card, view modal, navigate to detail page
6. **Check notifications:** Click bell icon, test browser notification
7. **Monitor progress:** Watch the progress ring percentage

## Note

This is a frontend-only implementation with hardcoded credentials and temporary data. In production, you would need to:
- Connect to a real backend API
- Implement proper JWT or session-based authentication
- Store user data in a database
- Persist quick-log entries
- Fetch real appointments
- Send scheduled notifications
- Add proper security measures

## Feature Documentation

See [FEATURES_GUIDE.md](./FEATURES_GUIDE.md) for detailed documentation of all interactive features.
