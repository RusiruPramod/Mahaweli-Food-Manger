# Vercel Deployment Configurations

This file contains the compliant project name and the exact list of environment variables you need to copy and paste when deploying this project to Vercel.

---

## 1. Compliant Project Name
According to Vercel's naming rules, project names must be:
* Up to 100 characters long.
* Strictly lowercase.
* Can include letters, digits, and the following characters: `.`, `_`, `-`.
* Cannot contain the sequence `---`.

### Recommended Project Name:
`mahaweli-food-manager`

---

## 2. Environment Variables List (Vercel Console)

Add the following environment variables to your project settings in Vercel (**Settings → Environment Variables**):

| Key | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | `AIzaSyCnWQu_1QGONXpYYSF0bj-zysCK5bzafXI` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `m-foods-90828.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `m-foods-90828` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `m-foods-90828.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `1011345296112` |
| `VITE_FIREBASE_APP_ID` | `1:1011345296112:web:16c7c65d4ce06df3b49035` |

---

### How to Add on Vercel:
1. Go to your project dashboard on Vercel.
2. Navigate to **Settings** → **Environment Variables**.
3. Copy the **Key** and **Value** from the table above and add them one by one.
4. Click **Deploy** / **Redeploy** to apply the configuration.
