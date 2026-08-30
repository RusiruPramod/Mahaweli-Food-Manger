/**
 * Seed script — run once with Node.js to populate Firestore with shops and items.
 *
 * Prerequisites:
 *   1. npm install firebase-admin  (install in project root)
 *   2. Download your Firebase service account key from:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   3. Save the downloaded JSON as `serviceAccountKey.json` in the project root.
 *      (This file is in .gitignore and must NEVER be committed.)
 *
 * Run:
 *   node scripts/seed.js
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, "../serviceAccountKey.json"), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Seed data — exactly as specified in the build prompt
// ---------------------------------------------------------------------------
const shops = [
  {
    id: "maalu-kade",
    name: "Malu Kade",
    order: 1,
    items: [
      { id: "chicken-keema", name: "Chicken Keema Packet", price: 320 },
      { id: "sausage-keema", name: "Sausage Keema Packet", price: 180 },
      { id: "egg-keema", name: "Egg Keema", price: 160 },
      { id: "omelette", name: "Omelette", price: 180 },
    ],
  },
  {
    id: "delgaha-kade",
    name: "Delgaha Kade",
    order: 2,
    items: [], // No menu yet — admin adds items later via Manage Menu
  },
  {
    id: "samje",
    name: "Samje",
    order: 3,
    items: [
      { id: "egg-rice", name: "Egg Rice", price: 160 },
      { id: "omelette", name: "Omelette", price: 160 },
      { id: "normal-rice", name: "Normal Rice", price: 100 },
      { id: "chicken", name: "Chicken", price: 260 },
      { id: "maalu", name: "Maalu", price: 220 },
    ],
  },
  {
    id: "gallery",
    name: "Gallery",
    order: 4,
    items: [
      { id: "chicken", name: "Chicken", price: 180 },
      { id: "normal", name: "Normal", price: 110 },
      { id: "eggs", name: "Eggs", price: 140 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Write to Firestore
// ---------------------------------------------------------------------------
async function seed() {
  console.log("🌱 Starting seed…\n");

  for (const shop of shops) {
    const shopRef = db.collection("shops").doc(shop.id);

    // Write shop document
    await shopRef.set({
      name: shop.name,
      order: shop.order,
      active: true,
    });
    console.log(`✅ Shop: ${shop.name} (${shop.id})`);

    // Write each item as a subcollection document
    for (const item of shop.items) {
      await shopRef.collection("items").doc(item.id).set({
        name: item.name,
        price: item.price,
        active: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`   ↳ Item: ${item.name} — Rs. ${item.price.toFixed(2)}`);
    }

    if (shop.items.length === 0) {
      console.log("   ↳ (no items — add via Admin > Manage Menu)");
    }
  }

  console.log("\n🎉 Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
