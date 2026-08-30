import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const SHOPS_SEED_DATA = [
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
    items: [], // no menu provided yet
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

export default function Setup() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSetup() {
    setLoading(true);
    setError("");
    setStatus("Starting setup...");

    try {
      // 1. Create/Update Admin User (admin@gmail.com / admin123)
      setStatus("Creating admin account (admin@gmail.com)...");
      let adminUid = "";
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          "admin@gmail.com",
          "admin123"
        );
        adminUid = cred.user.uid;
      } catch (err) {
        if (err.code === "auth/email-already-in-use") {
          // Try signing in to get the UID
          const cred = await signInWithEmailAndPassword(
            auth,
            "admin@gmail.com",
            "admin123"
          );
          adminUid = cred.user.uid;
        } else {
          throw err;
        }
      }

      // Write Admin profile
      await setDoc(doc(db, "users", adminUid), {
        name: "Admin",
        usernameLower: "admin",
        isAdmin: true,
        createdAt: serverTimestamp(),
      });

      // Write Admin username lookup
      await setDoc(doc(db, "usernames", "admin"), {
        uid: adminUid,
        email: "admin@gmail.com",
        createdAt: serverTimestamp(),
      });

      // 2. Create/Update Regular User (rusiru / 123456)
      setStatus("Creating user account (rusiru)...");
      let userUid = "";
      const syntheticEmail = "rusiru@hostelfoods.app";
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          syntheticEmail,
          "123456"
        );
        userUid = cred.user.uid;
      } catch (err) {
        if (err.code === "auth/email-already-in-use") {
          const cred = await signInWithEmailAndPassword(
            auth,
            syntheticEmail,
            "123456"
          );
          userUid = cred.user.uid;
        } else {
          throw err;
        }
      }

      // Write User profile
      await setDoc(doc(db, "users", userUid), {
        name: "rusiru",
        usernameLower: "rusiru",
        isAdmin: false,
        createdAt: serverTimestamp(),
      });

      // Write User username lookup
      await setDoc(doc(db, "usernames", "rusiru"), {
        uid: userUid,
        email: syntheticEmail,
        createdAt: serverTimestamp(),
      });

      // 3. Seed Shops and Items
      setStatus("Seeding shops and menu items...");
      for (const shop of SHOPS_SEED_DATA) {
        setStatus(`Seeding shop: ${shop.name}...`);
        const shopRef = doc(db, "shops", shop.id);
        await setDoc(shopRef, {
          name: shop.name,
          order: shop.order,
          active: true,
        });

        for (const item of shop.items) {
          const itemRef = doc(db, "shops", shop.id, "items", item.id);
          await setDoc(itemRef, {
            name: item.name,
            price: item.price,
            active: true,
            updatedAt: serverTimestamp(),
          });
        }
      }

      setStatus("Setup completed successfully! Redirecting in 3 seconds...");
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      console.error(err);
      setError("Setup failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚙️</div>
          <h1 className="text-3xl font-extrabold text-gray-900">App Setup Wizard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Initialize your database and create initial users.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-orange-100 border border-gray-100 p-8 space-y-6">
          <div className="text-sm text-gray-600 space-y-2">
            <p className="font-semibold text-gray-800">This will automatically setup:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Shop menu items (Malu Kade, Samje, Gallery, Delgaha Kade)</li>
              <li>User account: <span className="font-mono text-brand-600">rusiru</span> (Password: <span className="font-mono text-brand-600">123456</span>)</li>
              <li>Admin account: <span className="font-mono text-brand-600">admin@gmail.com</span> (Password: <span className="font-mono text-brand-600">admin123</span>)</li>
            </ul>
          </div>

          {status && (
            <div className="bg-orange-50 border border-orange-200 text-orange-800 text-xs rounded-xl px-4 py-3 font-medium">
              {status}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-medium space-y-1">
              <p>{error}</p>
              <div className="text-[10px] text-red-500 font-normal mt-1 border-t border-red-100 pt-1 leading-normal">
                <strong>Troubleshooting Tip:</strong> If you get a "Missing or insufficient permissions" error, please make sure you deployed the updated <code className="bg-red-100 px-1 rounded">firestore.rules</code> file using the Firebase CLI, or set rules to public read/write in your Firebase Console temporarily while running this setup!
              </div>
            </div>
          )}

          <button
            onClick={handleSetup}
            disabled={loading}
            className="w-full bg-brand-500 text-white font-bold py-4 rounded-xl
              hover:bg-brand-600 active:scale-[0.98] transition-all duration-150
              disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-brand-200
              flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Initializing Database...
              </>
            ) : (
              "Initialize App & Users"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
