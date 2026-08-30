# Mahaweli Foods 🍱

A daily food ordering coordinator app for a hostel group.
Members log in, pick what they want from local shops, and the admin gets a clean shopping list.

> **Currency assumption:** All prices are displayed in Sri Lankan Rupees (LKR) as `Rs. X.00`, inferred from the Sinhala shop names and price ranges. Update the `src/utils/price.js` formatter if a different currency is needed.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 + Vite |
| Routing | React Router v6 |
| Styling | Tailwind CSS v3 (mobile-first) |
| Auth | Firebase Authentication (Email/Password) |
| Database | Firebase Firestore (real-time `onSnapshot`) |
| Deployment | Vercel (static SPA) |

---

## Quick Start (local dev)

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in Firebase credentials
cp .env.example .env
# → Edit .env with your Firebase project values

# 3. Run dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Post-Deploy Setup (REQUIRED steps after first deployment)

### 1. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (e.g. `mahaweli-foods`)
3. In **Project Settings → General → Your apps**, add a **Web app**
4. Copy the Firebase config values into your `.env` file (and Vercel env vars)

### 2. Enable Email/Password Authentication

1. Firebase Console → **Authentication → Sign-in method**
2. Enable **Email/Password** provider
3. Save

### 3. Create the Firestore Database

1. Firebase Console → **Firestore Database → Create database**
2. Choose **Production mode**
3. Select your preferred region (e.g. `asia-south1` for Sri Lanka)

### 4. Deploy Firestore Security Rules

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools

# Login
firebase login

# Update .firebaserc with your project ID
# Replace "YOUR_FIREBASE_PROJECT_ID" with your actual project ID

# Deploy rules
firebase deploy --only firestore:rules
```

### 5. Seed the Database (Shops, Items, and Users)

```bash
# Download your service account key:
# Firebase Console → Project Settings → Service Accounts → Generate new private key
# Save the JSON as serviceAccountKey.json in the project root (it is gitignored)

# Install firebase-admin (only needed once for seeding)
npm install firebase-admin

# Run the shop menu seed script
node scripts/seed.js

# Run the user accounts seed script (creates rusiru & admin@gmail.com)
node scripts/seed-users.js
```

This populates:
- **Malu Kade** — 4 items
- **Delgaha Kade** — 0 items (add via Admin → Manage Menu)
- **Samje** — 5 items
- **Gallery** — 3 items

And registers/seeds these user accounts:
- **User:** `rusiru` (password: `123456`)
- **Admin:** `admin@gmail.com` (password: `admin123`)

### 6. Manual Admin Promotion Alternative

If you do not run the user seeding script, you can manually set the first admin:
1. Sign up on the app.
2. Go to **Firebase Console → Firestore Database → users collection**.
3. Find your user document and change `isAdmin` to `true`.

> ⚠️ **Security:** No user can grant themselves admin via the app UI. The Firestore rules enforce this — only an existing admin can update another user's `isAdmin` field.

---

## Deploying to Vercel

1. Push this repo to GitHub
2. Import it in [vercel.com](https://vercel.com)
3. Add all `VITE_FIREBASE_*` environment variables in Vercel's project settings
4. Deploy — Vercel auto-detects Vite

The `vercel.json` already includes the SPA rewrite rule (`/* → /index.html`).

---

## Project Structure

```
/src
  /components
    AdminMenuEditor.jsx     — CRUD UI for shops and items
    AdminOrderList.jsx      — Admin: today's orders by member
    AdminShoppingSummary.jsx — Admin: shopping list (no user names)
    AdminRoute.jsx          — Route guard: admin only
    Navbar.jsx              — Top navigation bar
    OrderSummaryBar.jsx     — Sticky bottom total + save button
    ProtectedRoute.jsx      — Route guard: authenticated only
    QtyStepper.jsx          — +/- quantity control
    ShopOrderCard.jsx       — One shop's items + subtotal
  /context
    AuthContext.jsx         — Firebase auth state + live profile
  /pages
    Admin.jsx               — Admin panel (3 tabs)
    Login.jsx               — Name + password login
    Order.jsx               — Daily order page
    Signup.jsx              — Name + password signup
  /utils
    price.js                — formatPrice() → "Rs. 320.00"
    today.js                — getToday() → "YYYY-MM-DD" (Colombo TZ)
  App.jsx                   — Router + route guards
  firebase.js               — Firebase app, auth, db init
  index.css                 — Tailwind directives + base styles
  main.jsx                  — React root
/scripts
  seed.js                   — One-time Firestore seed (firebase-admin)
firestore.rules             — Firestore security rules
firebase.json               — Firebase CLI config
vercel.json                 — Vercel SPA rewrite
.env.example                — Environment variable template
```

---

## Auth Design

Users sign up with **Name + Password only** (no visible email field).

Internally:
1. Username is normalized: lowercase, trimmed, spaces removed → `usernameLower`
2. Uniqueness checked via `usernames/{usernameLower}` Firestore doc
3. Synthetic email created: `${usernameLower}@hostelfoods.app`
4. Firebase Auth `createUserWithEmailAndPassword` called with synthetic email
5. `usernames/{usernameLower}` and `users/{uid}` documents written

For login: name → look up synthetic email → `signInWithEmailAndPassword`.

---

## Data Model (Firestore)

```
users/{uid}
  name: string
  usernameLower: string
  isAdmin: boolean
  createdAt: timestamp

usernames/{usernameLower}
  uid: string
  email: string
  createdAt: timestamp

shops/{shopId}
  name: string
  order: number        ← display order
  active: boolean

shops/{shopId}/items/{itemId}
  name: string
  price: number        ← LKR
  active: boolean
  updatedAt: timestamp

orders/{YYYY-MM-DD}/userOrders/{uid}
  userName: string     ← snapshot at order time
  items: [{ shopId, shopName, itemId, itemName, price, qty }]
  total: number
  createdAt: timestamp
  updatedAt: timestamp
```

> **Price snapshot behaviour:** When an order is saved, `price` is copied from the current item price. If admin changes a price later, existing saved orders keep the old price (historically accurate). Users must resave their order to pick up a new price.

---

## License

Private — for internal hostel use.
