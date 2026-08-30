import QtyStepper from "./QtyStepper";
import { formatPrice } from "../utils/price";

// Soft accent colours per shop — purely decorative
const SHOP_ACCENTS = [
  "border-orange-400 bg-orange-50",
  "border-emerald-400 bg-emerald-50",
  "border-sky-400 bg-sky-50",
  "border-violet-400 bg-violet-50",
];

/**
 * Displays one shop's card with its item list and qty steppers.
 *
 * Props:
 *  - shop: { id, name, order }
 *  - items: [{ id, name, price, active }]
 *  - quantities: { [itemId]: number }
 *  - onQtyChange: (itemId, newQty) => void
 *  - accentIdx: number (0-3)
 */
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

  const activeItems = items.filter((i) => i.active);

  return (
    <div className={`rounded-2xl border-2 shadow-sm overflow-hidden ${accent}`}>
      {/* Shop header */}
      <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-base">{shop.name}</h2>
        {shopTotal > 0 && (
          <span className="text-sm font-semibold text-gray-700 bg-white/70 px-2 py-0.5 rounded-full">
            {formatPrice(shopTotal)}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="divide-y divide-black/5">
        {activeItems.length === 0 ? (
          <p className="px-4 py-5 text-sm text-gray-400 italic text-center">
            No items available yet
          </p>
        ) : (
          activeItems.map((item) => {
            const qty = quantities[item.id] ?? 0;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 px-4 py-3 bg-white/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm leading-tight truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatPrice(item.price)}
                  </p>
                </div>
                <QtyStepper
                  itemId={`${shop.id}-${item.id}`}
                  qty={qty}
                  onIncrement={() => onQtyChange(item.id, qty + 1)}
                  onDecrement={() => qty > 0 && onQtyChange(item.id, qty - 1)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
