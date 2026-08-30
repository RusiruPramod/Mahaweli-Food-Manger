/**
 * Reusable quantity stepper with large tap-friendly +/- buttons.
 * Min touch target: 44px as required by the spec.
 */
export default function QtyStepper({ qty, onIncrement, onDecrement, itemId }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Quantity">
      <button
        id={`dec-${itemId}`}
        onClick={onDecrement}
        disabled={qty === 0}
        className={`
          w-11 h-11 rounded-xl text-xl font-bold flex items-center justify-center
          transition-all duration-150 select-none
          ${qty === 0
            ? "bg-gray-100 text-gray-300 cursor-not-allowed"
            : "bg-brand-100 text-brand-700 hover:bg-brand-200 active:scale-95"
          }
        `}
        aria-label="Decrease quantity"
      >
        −
      </button>

      <span
        className={`
          w-9 text-center text-base font-bold tabular-nums transition-colors
          ${qty > 0 ? "text-brand-700" : "text-gray-400"}
        `}
        aria-live="polite"
        aria-atomic="true"
      >
        {qty}
      </span>

      <button
        id={`inc-${itemId}`}
        onClick={onIncrement}
        className="w-11 h-11 rounded-xl text-xl font-bold flex items-center justify-center
          bg-brand-500 text-white hover:bg-brand-600 active:scale-95
          transition-all duration-150 select-none shadow-sm"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
