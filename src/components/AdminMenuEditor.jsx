import { useState } from "react";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { formatPrice } from "../utils/price";

/**
 * Admin tab: Manage Menu
 * CRUD for shops and items — edit price, toggle active, add items, add shops.
 *
 * Props:
 *  - shops: [{ id, name, order, active, items: [{id, name, price, active}] }]
 *  - loading: boolean
 */
export default function AdminMenuEditor({ shops, loading }) {
  const [editingItem, setEditingItem] = useState(null); // { shopId, itemId, name, price }
  const [addingItem, setAddingItem] = useState(null); // shopId
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [addingShop, setAddingShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // --- Helpers ---
  function slugify(name) {
    return name.toLowerCase().trim().replace(/\s+/g, "-");
  }

  async function handleToggleShop(shop) {
    await updateDoc(doc(db, "shops", shop.id), { active: !shop.active });
  }

  async function handleToggleItem(shopId, item) {
    await updateDoc(doc(db, "shops", shopId, "items", item.id), {
      active: !item.active,
      updatedAt: serverTimestamp(),
    });
  }

  async function handleSaveItemEdit() {
    if (!editingItem) return;
    const price = parseFloat(editingItem.price);
    if (isNaN(price) || price < 0) {
      setError("Price must be a valid positive number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateDoc(
        doc(db, "shops", editingItem.shopId, "items", editingItem.itemId),
        { name: editingItem.name.trim(), price, updatedAt: serverTimestamp() }
      );
      setEditingItem(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem(shopId) {
    const name = newItemName.trim();
    const price = parseFloat(newItemPrice);
    if (!name || isNaN(price) || price < 0) {
      setError("Enter a valid item name and price.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const itemId = slugify(name);
      await setDoc(doc(db, "shops", shopId, "items", itemId), {
        name,
        price,
        active: true,
        updatedAt: serverTimestamp(),
      });
      setAddingItem(null);
      setNewItemName("");
      setNewItemPrice("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddShop() {
    const name = newShopName.trim();
    if (!name) {
      setError("Enter a shop name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const shopId = slugify(name);
      const maxOrder = shops.reduce((m, s) => Math.max(m, s.order ?? 0), 0);
      await setDoc(doc(db, "shops", shopId), {
        name,
        order: maxOrder + 1,
        active: true,
      });
      setAddingShop(false);
      setNewShopName("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Shop list */}
      {shops.map((shop) => (
        <div
          key={shop.id}
          className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
            shop.active ? "border-gray-200" : "border-gray-100 opacity-60"
          }`}
        >
          {/* Shop header */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3">
            <h3 className="font-bold text-gray-800">{shop.name}</h3>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  shop.active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {shop.active ? "Active" : "Inactive"}
              </span>
              <button
                onClick={() => handleToggleShop(shop)}
                className="text-xs text-gray-500 hover:text-gray-800 underline transition-colors"
              >
                {shop.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="divide-y divide-gray-100">
            {(shop.items ?? []).length === 0 && (
              <p className="px-4 py-4 text-sm text-gray-400 italic">
                No items yet — add one below.
              </p>
            )}

            {(shop.items ?? []).map((item) => (
              <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                {editingItem?.shopId === shop.id &&
                editingItem?.itemId === item.id ? (
                  // Edit mode
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    <input
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-brand-400"
                      value={editingItem.name}
                      onChange={(e) =>
                        setEditingItem((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="Item name"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-brand-400"
                      value={editingItem.price}
                      onChange={(e) =>
                        setEditingItem((p) => ({ ...p, price: e.target.value }))
                      }
                      placeholder="Price"
                    />
                    <button
                      onClick={handleSaveItemEdit}
                      disabled={saving}
                      className="bg-brand-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-brand-600 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingItem(null)}
                      className="text-gray-400 text-xs hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  // Display mode
                  <>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          item.active ? "text-gray-800" : "text-gray-400 line-through"
                        }`}
                      >
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatPrice(item.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() =>
                          setEditingItem({
                            shopId: shop.id,
                            itemId: item.id,
                            name: item.name,
                            price: String(item.price),
                          })
                        }
                        className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleItem(shop.id, item)}
                        className="text-xs text-gray-400 hover:text-gray-700 underline"
                      >
                        {item.active ? "Hide" : "Show"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Add item form */}
            {addingItem === shop.id ? (
              <div className="px-4 py-3 bg-brand-50 flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Item name"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="Price"
                />
                <button
                  onClick={() => handleAddItem(shop.id)}
                  disabled={saving}
                  className="bg-brand-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-brand-600 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setAddingItem(null);
                    setNewItemName("");
                    setNewItemPrice("");
                    setError("");
                  }}
                  className="text-gray-400 text-xs hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAddingItem(shop.id);
                  setError("");
                }}
                className="w-full text-left px-4 py-3 text-sm text-brand-600 hover:bg-brand-50 font-medium transition-colors"
              >
                + Add item
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add shop */}
      {addingShop ? (
        <div className="bg-white rounded-2xl border border-brand-300 shadow-sm px-4 py-4 flex flex-wrap items-center gap-3">
          <input
            autoFocus
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-brand-400"
            value={newShopName}
            onChange={(e) => setNewShopName(e.target.value)}
            placeholder="Shop name"
          />
          <button
            onClick={handleAddShop}
            disabled={saving}
            className="bg-brand-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-600 disabled:opacity-50"
          >
            Create Shop
          </button>
          <button
            onClick={() => {
              setAddingShop(false);
              setNewShopName("");
              setError("");
            }}
            className="text-gray-400 text-sm hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          id="add-shop-btn"
          onClick={() => setAddingShop(true)}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-medium
            hover:border-brand-400 hover:text-brand-600 transition-colors text-sm"
        >
          + Add New Shop
        </button>
      )}
    </div>
  );
}
