# Website SET-UP
**SET-UP:**
🖥️ WEBSITE SETUP

Frontend: React.js
Backend: Firebase Realtime Database for storage and real-time data updates
Authentication: Firebase Auth (email/password, optional 2FA)
Hosting: Firebase Hosting or Vercel/Netlify for React app

Folder Structure (Example)
CHIRP/
├─ public/
├─ src/
│ ├─ components/
│ │ ├─ Navbar.js
│ │ ├─ CapyHome.js
│ │ ├─ Cappies.js
│ │ └─ CapyDEVS.js
│ ├─ pages/
│ │ ├─ Login.js
│ │ ├─ Signup.js
│ │ └─ Profile.js
│ ├─ firebase.js
│ ├─ App.js
│ └─ index.js
├─ package.json
└─ README.md

Firebase Setup Steps

Create Firebase project.

Enable Authentication (email/password).

Create Realtime Database and structure collections for users, posts, Cappies, developer posts.

Add Firebase config to firebase.js in React.

Use React hooks to fetch and push real-time data.

Key React Features

State management: useState/useEffect

Routing: React Router (Login, Signup, Home, Profile)

Forms: Controlled components with validation

Real-time updates: Firebase Realtime Database listeners


# 🦫 CHIRP – Cybersecurity Social Media Platform

## 📌 Project Overview

**CHIRP** is a cybersecurity-focused social media platform inspired by familiar social networks but redesigned for **security awareness, ethical hacking, and risk management**. It uses a **capybara-themed UI/UX** to create a calm, friendly, and trustworthy environment while demonstrating real-world cybersecurity concepts using web development and APIs. Almost Facebook cloned but different just inspiration.

**Acronym Meaning:**

* **C** – Cybersecurity
* **H** – Hacking
* **I** – Information
* **R** – Risk
* **P** – Platform

---

## 🎨 UI/UX THEME – CAPYBARA DESIGN

**Design Philosophy:** Calm, friendly, secure, and non-intimidating cybersecurity.

### Color Theme

* Warm Brown (Primary)
* Soft Beige (Background)
* Muted Green (Security / Success)
* Caramel Orange (Buttons / Alerts)
* Deep Coffee (Text)

### Logo Concept

* Minimalist capybara head icon
* Rounded shapes (Facebook-style simplicity)
* Friendly but professional

### Tagline Examples

* "CHIRP – A Calm Place for Cybersecurity"
* "Secure Together. Learn Together."

---

## 🪟 FIRST WINDOW – WELCOME / LANDING PAGE

### Purpose

Introduce CHIRP, establish branding, and provide secure authentication access.

### Components

* Capybara Logo (centered)
* Platform Name: **CHIRP**
* Short Tagline below logo

### Authentication Section

* Login Form
* Sign Up Button
* Forgot Password Link

### Security Notes

* Password hashing
* Input validation
* Rate limiting on login

---

## 🔐 AFTER LOGIN – MAIN DASHBOARD

Layout inspired by Facebook but customized for CHIRP.

### Top Navigation Bar

* CHIRP Logo (left)
* Search bar (center)
* User Profile + Logout (right)

### Main Menus

#### 🏠 CapyHome

**Description:**

* Main feed where your posts and public posts appear
* Displays cybersecurity posts, tips, alerts, and updates

**Features:**

* Create a post (text / links / code snippets)
* Like, comment, share (secure & sanitized)
* Report suspicious content

---

#### 🐾 Cappies (Friends System)

**Description:**

* Equivalent of Facebook Friends
* Users connected on CHIRP are called **Cappies**

**Features:**

* Send / accept Cappies requests
* View Cappies-only posts
* Security trust indicator (verified / unverified)

---

#### 👨‍💻 CapyDEVS

**Description:**

* Official developer & creator feed
* Posts ONLY from CHIRP developers and creators

**Important Note:**

* Developers and creators have **separate verified accounts**
* Content includes:

  * Platform updates
  * Security advisories
  * Patch notes
  * Cybersecurity announcements

---

## 👤 USER PROFILE PAGE

### Profile Elements

* Capybara-style avatar
* Username & **Capy Role Badge**

### Capy Role Badges (Hacker Types)

* ⚫ **BlackCapy** – Malicious hacker
* ⚪ **WhiteCapy** – Ethical hacker
* ⚙️ **GreyCapy** – Not malicious, but not always ethical
* 🟢 **GreenCapy** – New, unskilled hacker
* 🔵 **BlueCapy** – Vengeful hacker
* 🔴 **RedCapy** – Vigilante hacker
* 🟣 **PurpleCapy** – Hacks their own systems

## 🎓 PROJECT VALUE

* Combines **web development + cybersecurity + API**
* Everyone acts as **defender and attacker**
* Friendly UI with serious security concepts
* Easy to explain and demo
* Unique capybara branding

---

## 📌 ONE-SENTENCE SUMMARY

**CHIRP is a capybara-themed cybersecurity social media platform that promotes secure communication, ethical hacking awareness, and risk management through a calm, user-friendly web and API-based system.**
