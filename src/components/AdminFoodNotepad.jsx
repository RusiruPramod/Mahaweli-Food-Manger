import { useState, useEffect, useMemo } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { formatPrice } from "../utils/price";
import { getToday } from "../utils/today";
import {
  Calculator,
  Store,
  Trash2,
  Plus,
  Minus,
  Copy,
  RotateCcw,
  CheckCircle,
  Search,
  FileText,
  UtensilsCrossed,
  Save,
  ChevronDown,
  ChevronUp,
  History,
  Calendar,
  ClipboardList,
} from "./Icons";

export default function AdminFoodNotepad({ shops = [], loading = false }) {
  const today = getToday();

  // Active view: 'calculator' | 'saved_notes'
  const [activeSubView, setActiveSubView] = useState("calculator");

  // Selected shop filter ("all" or shopId)
  const [selectedShopFilter, setSelectedShopFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Notepad active items state: map of { [itemKey]: { shopId, shopName, itemId, itemName, price, qty } }
  const [notepadItems, setNotepadItems] = useState({});

  // Saved Notes from Firestore
  const [savedNotes, setSavedNotes] = useState([]);
  const [savedNotesLoading, setSavedNotesLoading] = useState(true);
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [savedNotesSearch, setSavedNotesSearch] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState(null);

  // 1. Subscribe to saved notes in Firestore
  useEffect(() => {
    setSavedNotesLoading(true);
    const notesRef = collection(db, "admin_notes");
    const q = query(notesRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setSavedNotes(list);
        setSavedNotesLoading(false);
      },
      (err) => {
        console.error("Error loading admin notes:", err);
        setSavedNotesLoading(false);
      }
    );

    return unsub;
  }, []);

  // Filter active shops
  const activeShops = useMemo(() => {
    return shops.filter((s) => s.active !== false);
  }, [shops]);

  // Stepper handlers: '+' increases by 1, '-' decreases by 1
  const handleItemCountChange = (shop, item, delta) => {
    const key = `${shop.id}_${item.id}`;
    setNotepadItems((prev) => {
      const currentQty = prev[key]?.qty || 0;
      const newQty = currentQty + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: {
          key,
          shopId: shop.id,
          shopName: shop.name,
          itemId: item.id,
          itemName: item.name,
          price: item.price || 0,
          qty: newQty,
        },
      };
    });
  };

  const handleUpdateQty = (key, delta) => {
    setNotepadItems((prev) => {
      if (!prev[key]) return prev;
      const newQty = prev[key].qty + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: {
          ...prev[key],
          qty: newQty,
        },
      };
    });
  };

  const handleRemoveItem = (key) => {
    setNotepadItems((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Reset Pad handler
  const handleResetNotepad = () => {
    if (Object.keys(notepadItems).length === 0 && !noteTitle) return;
    if (window.confirm("Are you sure you want to reset this notepad? All current counts will be reset to 0.")) {
      setNotepadItems({});
      setNoteTitle("");
      setSaveSuccessMsg("");
    }
  };

  // Aggregated calculations
  const itemsList = useMemo(() => Object.values(notepadItems), [notepadItems]);

  const grandTotal = useMemo(() => {
    return itemsList.reduce((sum, item) => sum + item.price * item.qty, 0);
  }, [itemsList]);

  const totalItemCount = useMemo(() => {
    return itemsList.reduce((sum, item) => sum + item.qty, 0);
  }, [itemsList]);

  // Group notepad items by shop
  const shopBreakdowns = useMemo(() => {
    const map = {};
    for (const item of itemsList) {
      if (!map[item.shopId]) {
        map[item.shopId] = {
          shopId: item.shopId,
          shopName: item.shopName,
          items: [],
          totalAmount: 0,
          totalQty: 0,
        };
      }
      map[item.shopId].items.push(item);
      map[item.shopId].totalAmount += item.price * item.qty;
      map[item.shopId].totalQty += item.qty;
    }
    return Object.values(map);
  }, [itemsList]);

  const activeShopsCount = shopBreakdowns.length;

  // Save note to database
  const handleSaveNote = async () => {
    if (itemsList.length === 0) {
      alert("Please add at least one food item before saving.");
      return;
    }

    setSaving(true);
    setSaveSuccessMsg("");

    try {
      const title = noteTitle.trim() || `Manual Note (${today})`;
      await addDoc(collection(db, "admin_notes"), {
        title,
        date: today,
        items: itemsList.map((it) => ({
          shopId: it.shopId,
          shopName: it.shopName,
          itemId: it.itemId,
          itemName: it.itemName,
          price: it.price,
          qty: it.qty,
          subtotal: it.price * it.qty,
        })),
        shopBreakdowns: shopBreakdowns.map((sb) => ({
          shopId: sb.shopId,
          shopName: sb.shopName,
          totalAmount: sb.totalAmount,
          totalQty: sb.totalQty,
          items: sb.items.map((it) => ({
            itemName: it.itemName,
            price: it.price,
            qty: it.qty,
            subtotal: it.price * it.qty,
          })),
        })),
        totalAmount: grandTotal,
        totalQty: totalItemCount,
        createdAt: serverTimestamp(),
      });

      setSaveSuccessMsg(`✅ Note "${title}" saved to database successfully!`);
      setTimeout(() => setSaveSuccessMsg(""), 5000);
    } catch (err) {
      console.error("Error saving note:", err);
      alert("Failed to save note: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Load a saved note back into active notepad
  const handleLoadSavedNote = (note) => {
    if (
      itemsList.length > 0 &&
      !window.confirm("Replace current notepad with this saved note?")
    ) {
      return;
    }

    const newItems = {};
    (note.items || []).forEach((it) => {
      const key = `${it.shopId}_${it.itemId}`;
      newItems[key] = {
        key,
        shopId: it.shopId,
        shopName: it.shopName,
        itemId: it.itemId,
        itemName: it.itemName,
        price: it.price || 0,
        qty: it.qty || 1,
      };
    });

    setNotepadItems(newItems);
    setNoteTitle(note.title || "");
    setActiveSubView("calculator");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Delete a saved note from database
  const handleDeleteSavedNote = async (noteId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to permanently delete this saved note from the database?")) {
      return;
    }

    setDeletingNoteId(noteId);
    try {
      await deleteDoc(doc(db, "admin_notes", noteId));
    } catch (err) {
      console.error("Error deleting note:", err);
      alert("Failed to delete note: " + err.message);
    } finally {
      setDeletingNoteId(null);
    }
  };

  // Copy formatted text
  const handleCopySummary = async (items = itemsList, breakdowns = shopBreakdowns, totalAmt = grandTotal, totalCount = totalItemCount, title = noteTitle) => {
    if (items.length === 0) return;

    let text = `📝 *MAHAWELI FOODS - NOTEPAD CALCULATION*\n`;
    text += `📅 Date: ${today}\n`;
    if (title && title.trim()) {
      text += `🏷️ Title: ${title.trim()}\n`;
    }
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    breakdowns.forEach((sb) => {
      text += `\n🏪 *${sb.shopName.toUpperCase()}*\n`;
      sb.items.forEach((item) => {
        text += ` • ${item.itemName} x ${item.qty} = ${formatPrice(item.price * item.qty)}\n`;
      });
      text += `   ↳ Subtotal: ${formatPrice(sb.totalAmount)} (${sb.totalQty} items)\n`;
    });

    text += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🔢 *TOTAL ITEMS:* ${totalCount}\n`;
    text += `💰 *GRAND TOTAL:* ${formatPrice(totalAmt)}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy clipboard:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Filter shops according to selection
  const filteredShops = activeShops.filter((shop) => {
    if (selectedShopFilter !== "all" && shop.id !== selectedShopFilter) {
      return false;
    }
    return true;
  });

  // Filter saved notes
  const filteredSavedNotes = savedNotes.filter((n) => {
    if (!savedNotesSearch.trim()) return true;
    const term = savedNotesSearch.toLowerCase();
    return (
      (n.title && n.title.toLowerCase().includes(term)) ||
      (n.date && n.date.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* ── Sub-view Switcher & Header ────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center border border-brand-100 shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
              Food Notepad & Manual Calculator
              <span className="text-[10px] font-bold bg-brand-100 text-brand-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live Pad
              </span>
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Tap - / + counts · Real-time summary breakdown · Save to database anytime
            </p>
          </div>
        </div>

        {/* Sub-view Switcher Pills */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-2xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubView("calculator")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubView === "calculator"
                ? "bg-white text-gray-900 shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-brand-600" />
            <span>Active Pad</span>
            {totalItemCount > 0 && (
              <span className="bg-brand-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {totalItemCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView("saved_notes")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubView === "saved_notes"
                ? "bg-white text-gray-900 shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <History className="w-3.5 h-3.5 text-brand-600" />
            <span>Saved Notes ({savedNotes.length})</span>
          </button>
        </div>
      </div>

      {/* Save Success Feedback Banner */}
      {saveSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl px-4 py-3 flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveSubView("saved_notes")}
            className="text-[11px] font-bold text-emerald-700 underline hover:text-emerald-900 ml-2"
          >
            View Saved Notes →
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── VIEW 1: ACTIVE NOTEPAD & CALCULATOR ────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeSubView === "calculator" && (
        <div className="space-y-6">
          {/* Step 1: Select Foods via clean cards with [- count +] stepper */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 uppercase tracking-wider">
                  Select Foods (Tap - / + to adjust counts)
                </h3>
              </div>

              {/* Search box for foods */}
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter foods..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Shop Switcher Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedShopFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedShopFilter === "all"
                    ? "bg-gray-900 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span>🏬 All Shops ({activeShops.length})</span>
              </button>
              {activeShops.map((shop) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => setSelectedShopFilter(shop.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    selectedShopFilter === shop.id
                      ? "bg-brand-600 text-white shadow-xs shadow-brand-600/30"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>{shop.name}</span>
                  <span className="text-[10px] opacity-75">
                    ({(shop.items || []).filter((i) => i.active !== false).length})
                  </span>
                </button>
              ))}
            </div>

            {/* Foods Grid */}
            <div className="space-y-4 pt-1">
              {filteredShops.length === 0 ? (
                <p className="text-center py-8 text-xs text-gray-400">No active shops found.</p>
              ) : (
                filteredShops.map((shop) => {
                  const availableItems = (shop.items || []).filter((item) => {
                    if (item.active === false) return false;
                    if (searchQuery.trim()) {
                      return item.name.toLowerCase().includes(searchQuery.toLowerCase());
                    }
                    return true;
                  });

                  if (availableItems.length === 0) return null;

                  return (
                    <div
                      key={shop.id}
                      className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-gray-500" />
                          <span className="text-xs sm:text-sm font-extrabold text-gray-800">
                            {shop.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-500 font-medium">
                          {availableItems.length} foods
                        </span>
                      </div>

                      {/* Food Item Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {availableItems.map((item) => {
                          const itemKey = `${shop.id}_${item.id}`;
                          const currentCount = notepadItems[itemKey]?.qty || 0;

                          return (
                            <div
                              key={item.id}
                              className={`bg-white rounded-xl border p-3 shadow-xs flex items-center justify-between gap-2 transition-all ${
                                currentCount > 0
                                  ? "border-brand-500 ring-1 ring-brand-400/30"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <div className="flex-1 min-w-0 pr-1">
                                <p className="text-xs font-bold text-gray-900 truncate leading-tight">
                                  {item.name}
                                </p>
                                <p className="text-[11px] font-semibold text-brand-600 mt-0.5">
                                  {formatPrice(item.price || 0)}
                                </p>
                              </div>

                              {/* Stepper */}
                              <div className="flex items-center gap-1 shrink-0 bg-gray-50 border border-gray-200 p-0.5 rounded-xl">
                                <button
                                  type="button"
                                  disabled={currentCount === 0}
                                  onClick={() => handleItemCountChange(shop, item, -1)}
                                  title="Decrease"
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                    currentCount > 0
                                      ? "bg-white text-gray-800 hover:bg-gray-200 shadow-2xs active:scale-95 cursor-pointer"
                                      : "text-gray-300 cursor-not-allowed"
                                  }`}
                                >
                                  <Minus className="w-3 h-3" />
                                </button>

                                <span
                                  className={`min-w-5 text-center text-xs font-bold px-1 ${
                                    currentCount > 0
                                      ? "text-brand-700 font-extrabold"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {currentCount}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleItemCountChange(shop, item, 1)}
                                  title="Increase"
                                  className="w-6 h-6 rounded-lg bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* Step 2: TODAY'S NOTEPAD SUMMARY (EXACT Shopping Summary UI Style) */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Card Header (Identical to Today's Shopping Summary) */}
            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center border border-brand-100 shrink-0">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-extrabold text-gray-900 text-sm sm:text-base tracking-tight">
                    TODAY'S NOTEPAD SUMMARY
                  </h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                    Date: {today}
                  </p>
                </div>
              </div>

              {/* Header Right: Stats + Actions */}
              <div className="flex items-center gap-3 text-xs font-bold text-gray-500 flex-wrap">
                <span>Shops: <strong className="text-gray-900">{activeShopsCount} / {activeShops.length}</strong></span>
                <span>•</span>
                <span>Total Items: <strong className="text-brand-600">{totalItemCount}</strong></span>

                {/* Toolbar Buttons */}
                <div className="flex items-center gap-1.5 ml-1">
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    disabled={itemsList.length === 0 || saving}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      itemsList.length > 0
                        ? "bg-brand-600 hover:bg-brand-700 text-white shadow-xs shadow-brand-600/30 active:scale-95 cursor-pointer"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? "Saving..." : "Save"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetNotepad}
                    disabled={itemsList.length === 0 && !noteTitle}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      itemsList.length > 0 || noteTitle
                        ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 active:scale-95 cursor-pointer"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopySummary()}
                    disabled={itemsList.length === 0}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-gray-200 ${
                      copied
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : itemsList.length > 0
                        ? "bg-white text-gray-700 hover:bg-gray-50 active:scale-95 cursor-pointer"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {copied ? (
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                    )}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Note / Reference Tag Row */}
            <div className="px-6 py-2.5 bg-gray-50/20 border-b border-gray-100 flex items-center gap-2 text-xs">
              <span className="font-bold text-gray-500 shrink-0">🏷️ Note / Tag:</span>
              <input
                type="text"
                placeholder="e.g. Table 4 / Guest Order / Morning Parcel (Optional)"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-hidden focus:border-brand-500"
              />
            </div>

            {/* Manifest List Content (Exact Shopping Summary List Layout) */}
            {itemsList.length === 0 ? (
              <div className="text-center py-14 text-gray-400 p-8 space-y-2">
                <Store className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <h3 className="font-bold text-gray-800 text-base">Notepad List is Empty</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Tap <code>+</code> on any food item above to start calculating notepad orders.
                </p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {shopBreakdowns.map((shop) => (
                  <div key={shop.shopId} className="space-y-2.5">
                    {/* Shop Name and Corner Total */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-gray-500" />
                        <h3 className="font-extrabold text-gray-800 text-sm sm:text-base">
                          {shop.shopName}
                        </h3>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-gray-600">
                        Total: <span className="text-brand-600 font-extrabold">{formatPrice(shop.totalAmount)}</span>
                      </span>
                    </div>

                    {/* Items */}
                    <div className="pl-6 space-y-1.5 border-l border-gray-150 ml-2">
                      {shop.items.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between text-xs sm:text-sm py-1 max-w-md"
                        >
                          <span className="text-gray-700 font-medium">
                            • {item.itemName}
                          </span>
                          <span className="font-extrabold text-gray-900 tabular-nums">
                            x {item.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Card Footer (Exact Shopping Summary Footer Layout) */}
            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-gray-500">
              <div className="flex items-center gap-4">
                <span>Total Items: <strong className="text-brand-600 font-extrabold text-sm">{totalItemCount} items</strong></span>
                <span>•</span>
                <span>Active Shops: <strong className="text-gray-900">{activeShopsCount}</strong></span>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-gray-600">Grand Total:</span>
                <span className="text-brand-600 font-black text-base sm:text-lg">
                  {formatPrice(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── VIEW 2: SAVED NOTES DATABASE ──────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeSubView === "saved_notes" && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden space-y-0">
          {/* Header */}
          <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center border border-brand-100">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-extrabold text-gray-900 text-sm sm:text-base tracking-tight">
                  SAVED NOTEPAD RECORDS ({savedNotes.length})
                </h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                  Database Archive · Stored calculations
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search saved notes..."
                value={savedNotesSearch}
                onChange={(e) => setSavedNotesSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-brand-500"
              />
            </div>
          </div>

          {/* Saved Notes Content */}
          <div className="p-6">
            {savedNotesLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredSavedNotes.length === 0 ? (
              <div className="text-center py-12 text-gray-400 space-y-2">
                <FileText className="w-10 h-10 text-gray-300 mx-auto" />
                <p className="font-bold text-gray-800 text-sm">No saved notes found</p>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  When you calculate notepad orders and click "Save", records will appear here.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSubView("calculator")}
                  className="mt-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700"
                >
                  Go to Active Pad
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSavedNotes.map((note) => {
                  const isExpanded = expandedNoteId === note.id;
                  const formattedDate = note.date || (note.createdAt?.toDate ? note.createdAt.toDate().toLocaleDateString() : today);
                  const formattedTime = note.createdAt?.toDate ? note.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";

                  return (
                    <div
                      key={note.id}
                      className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-2xs hover:border-gray-300 transition-all"
                    >
                      {/* Note Header Row */}
                      <div
                        onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50/60 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center border border-gray-200 shrink-0 font-bold text-xs">
                            📝
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-gray-900">
                              {note.title || "Manual Food Note"}
                            </h4>
                            <p className="text-xs text-gray-500 font-medium flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                {formattedDate} {formattedTime && `at ${formattedTime}`}
                              </span>
                              <span>•</span>
                              <span>{note.totalQty || 0} items</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <span className="text-xs sm:text-sm font-bold text-gray-600">
                            Total: <span className="text-brand-600 font-extrabold">{formatPrice(note.totalAmount || 0)}</span>
                          </span>

                          <div className="flex items-center gap-1 ml-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadSavedNote(note);
                              }}
                              title="Load into Active Pad"
                              className="px-2.5 py-1.5 bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              Load
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopySummary(
                                  note.items || [],
                                  note.shopBreakdowns || [],
                                  note.totalAmount || 0,
                                  note.totalQty || 0,
                                  note.title || ""
                                );
                              }}
                              title="Copy text"
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteSavedNote(note.id, e)}
                              disabled={deletingNoteId === note.id}
                              title="Delete note"
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <div className="text-gray-400 p-1">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Breakdown in Shopping Summary Style */}
                      {isExpanded && (
                        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 space-y-4 text-xs">
                          {(note.shopBreakdowns || []).map((sb, idx) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex items-center justify-between font-extrabold text-gray-800">
                                <span className="flex items-center gap-1.5">
                                  <Store className="w-3.5 h-3.5 text-gray-500" />
                                  {sb.shopName}
                                </span>
                                <span className="text-brand-600">
                                  {formatPrice(sb.totalAmount)}
                                </span>
                              </div>
                              <div className="pl-6 space-y-1.5 border-l border-gray-150 ml-2">
                                {(sb.items || []).map((it, itemIdx) => (
                                  <div key={itemIdx} className="flex items-center justify-between text-gray-700 py-1 max-w-md">
                                    <span className="font-medium">• {it.itemName}</span>
                                    <span className="font-extrabold text-gray-900 tabular-nums">
                                      x {it.qty}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}

                          <div className="flex justify-end pt-2">
                            <button
                              type="button"
                              onClick={() => handleLoadSavedNote(note)}
                              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow-xs"
                            >
                              Open in Active Pad →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
