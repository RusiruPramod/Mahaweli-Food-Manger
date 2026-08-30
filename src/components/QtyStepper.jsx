export default function QtyStepper({ qty, onIncrement, onDecrement, itemId }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/80 p-1 rounded-2xl border border-black/5 shadow-xs" role="group" aria-label="Quantity">
      <button
        type="button"
        id={`dec-${itemId}`}
        onClick={onDecrement}
        disabled={qty === 0}
        className={`
          w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-lg sm:text-xl font-bold flex items-center justify-center
          transition-all duration-150 select-none cursor-pointer
          ${qty === 0
            ? "bg-gray-100 text-gray-300 cursor-not-allowed opacity-50"
            : "bg-brand-100/80 text-brand-800 hover:bg-brand-200 active:scale-90 hover:shadow-xs"
          }
        `}
        aria-label="Decrease quantity"
      >
        −
      </button>

      <span
        className={`
          w-8 sm:w-9 text-center text-sm sm:text-base font-extrabold tabular-nums transition-all duration-150
          ${qty > 0 ? "text-brand-600 scale-110" : "text-gray-400 scale-100"}
        `}
        aria-live="polite"
        aria-atomic="true"
      >
        {qty}
      </span>

      <button
        type="button"
        id={`inc-${itemId}`}
        onClick={onIncrement}
        className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-lg sm:text-xl font-bold flex items-center justify-center
          bg-brand-500 hover:bg-brand-600 active:scale-90 text-white
          transition-all duration-150 select-none shadow-sm shadow-brand-500/25 cursor-pointer"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
