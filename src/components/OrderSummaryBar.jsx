import { formatPrice } from "../utils/price";

/**
 * Sticky bottom bar showing grand total and save button.
 *
 * Props:
 *  - total: number
 *  - onSave: async () => void
 *  - saving: boolean
 *  - saved: boolean
 *  - savedTotal: number | null
 */
export default function OrderSummaryBar({
  total,
  onSave,
  saving,
  saved,
  savedTotal,
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Total display */}
        <div className="flex-1 min-w-0">
          {saved && savedTotal !== null ? (
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-semibold text-sm flex items-center gap-1">
                ✅ Saved
              </span>
              <span className="text-gray-500 text-sm">{formatPrice(savedTotal)}</span>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total</p>
              <p className="text-xl font-bold text-gray-900 leading-none">
                {formatPrice(total)}
              </p>
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          id="save-order-btn"
          onClick={onSave}
          disabled={saving || total === 0}
          className={`
            px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200
            min-w-[140px] flex items-center justify-center gap-2
            ${saving
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : total === 0
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-brand-500 text-white hover:bg-brand-600 active:scale-95 shadow-md shadow-brand-200"
            }
          `}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Saving…
            </>
          ) : saved ? (
            "Update Order"
          ) : (
            "Save Today's Order"
          )}
        </button>
      </div>
    </div>
  );
}
