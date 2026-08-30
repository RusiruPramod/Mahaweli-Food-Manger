import QtyStepper from "./QtyStepper";
import { formatPrice } from "../utils/price";

// Soft accent colours per shop
const SHOP_ACCENTS = [
  "border-orange-200 bg-orange-50/50",
  "border-emerald-200 bg-emerald-50/50",
  "border-sky-200 bg-sky-50/50",
  "border-violet-200 bg-violet-50/50",
];

export default function ShopOrderCard({
  shop,
  items,
  quantities,
  onQtyChange,
  accentIdx = 0,
}) {
  const accent = SHOP_ACCENTS[accentIdx % SHOP_ACCENTS.length];

  const shopTotal = items.reduce(
    (sum, item) => sum + item.price * (quantities[item.id] ?? 0),
    0
  );

  const totalItemsCount = items.reduce(
    (sum, item) => sum + (quantities[item.id] ?? 0),
    0
  );

  const activeItems = items.filter((i) => i.active);

  return (
    <div className={`rounded-3xl border shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md bg-white ${accent}`}>
      {/* Shop header */}
      <div className="px-4 py-3.5 border-b border-black/5 bg-white/70 backdrop-blur-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏪</span>
          <div>
            <h2 className="font-extrabold text-gray-900 text-sm sm:text-base leading-tight">{shop.name}</h2>
            {totalItemsCount > 0 && (
              <span className="text-[11px] font-bold text-brand-600">
                {totalItemsCount} {totalItemsCount === 1 ? "item" : "items"} selected
              </span>
            )}
          </div>
        </div>
        {shopTotal > 0 && (
          <span className="text-xs sm:text-sm font-extrabold text-brand-700 bg-brand-50 border border-brand-200/80 px-2.5 py-1 rounded-full shadow-2xs">
            {formatPrice(shopTotal)}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-100">
        {activeItems.length === 0 ? (
          <p className="px-4 py-6 text-xs sm:text-sm text-gray-400 italic text-center">
            No items available right now
          </p>
        ) : (
          activeItems.map((item) => {
            const qty = quantities[item.id] ?? 0;
            const isSelected = qty > 0;
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 ${
                  isSelected ? "bg-brand-50/60 border-l-4 border-brand-500" : "bg-white hover:bg-gray-50/70"
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <p className={`font-bold text-xs sm:text-sm leading-snug truncate ${
                      isSelected ? "text-brand-950" : "text-gray-800"
                    }`}>
                      {item.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-semibold text-gray-500">
                      {formatPrice(item.price)}
                    </span>
                    {isSelected && (
                      <span className="text-[11px] font-extrabold text-brand-700 bg-brand-100/90 px-1.5 py-0.2 rounded-md">
                        = {formatPrice(item.price * qty)}
                      </span>
                    )}
                  </div>
                </div>

                <QtyStepper
                  itemId={`${shop.id}-${item.id}`}
                  qty={qty}
                  onIncrement={() => onQtyChange(item.id, qty + 1, item.name)}
                  onDecrement={() => qty > 0 && onQtyChange(item.id, qty - 1, item.name)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
