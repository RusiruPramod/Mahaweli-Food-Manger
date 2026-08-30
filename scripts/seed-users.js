/**
 * Seed Users Script — run with Node.js to create the requested user and admin accounts.
 *
 * Prerequisites:
 *   1. Download your Firebase service account key from:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   2. Save the downloaded JSON as `serviceAccountKey.json` in the project root.
 *
 * Run:
 *   node scripts/seed-users.js
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, "../serviceAccountKey.json"), "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function createOrUpdateUser({ name, email, password, isAdmin }) {
  const usernameLower = name.toLowerCase().trim().replace(/\s+/g, "");
  let userRecord;

  try {
    // Check if user already exists in Firebase Auth
    userRecord = await auth.getUserByEmail(email);
    console.log(`👤 Auth user already exists: ${email}. Updating password...`);
    await auth.updateUser(userRecord.uid, { password });
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      // Create new user in Firebase Auth
      userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
      });
      console.log(`✅ Auth user created successfully: ${email}`);
    } else {
      throw err;
    }
  }

  const uid = userRecord.uid;

  // Write/Update users/{uid} document
  await db.collection("users").doc(uid).set({
    name,
    usernameLower,
    isAdmin,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`📄 Firestore user document created/updated for ${name} (${uid})`);

  // Write/Update usernames/{usernameLower} lookup document
  await db.collection("usernames").doc(usernameLower).set({
    uid,
    email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`📄 Firestore username lookup document created/updated for ${usernameLower}`);
}

async function run() {
  console.log("🌱 Seeding requested user and admin accounts...\n");

  // 1. Seed user "rusiru" with password "123456"
  await createOrUpdateUser({
    name: "rusiru",
    email: "rusiru@hostelfoods.app",
    password: "123456",
    isAdmin: false,
  });

  console.log("");

  // 2. Seed admin "admin@gmail.com" with password "admin123"
  await createOrUpdateUser({
    name: "Admin",
    email: "admin@gmail.com",
    password: "admin123",
    isAdmin: true,
  });

  console.log("\n🎉 User seeding completed successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
