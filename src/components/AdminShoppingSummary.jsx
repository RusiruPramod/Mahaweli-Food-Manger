import { formatPrice } from "../utils/price";

/**
 * Admin tab: Shopping Summary
 * Derived from all orders. Grouped by shop → item → total qty.
 * NO user names anywhere in this view.
 *
 * Props:
 *  - orders: same array as AdminOrderList
 *  - loading: boolean
 */
export default function AdminShoppingSummary({ orders, loading }) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">🛒</p>
        <p className="font-medium">No orders yet — shopping list is empty.</p>
      </div>
    );
  }

  // Aggregate: { shopId → { shopName, items: { itemId → { itemName, price, totalQty } } } }
  const shopMap = {};
  let overallTotal = 0;

  for (const order of orders) {
    for (const item of order.items) {
      if (!shopMap[item.shopId]) {
        shopMap[item.shopId] = { shopName: item.shopName, items: {} };
      }
      const shop = shopMap[item.shopId];
      if (!shop.items[item.itemId]) {
        shop.items[item.itemId] = {
          itemName: item.itemName,
          price: item.price,
          totalQty: 0,
        };
      }
      shop.items[item.itemId].totalQty += item.qty;
      overallTotal += item.price * item.qty;
    }
  }

  const shops = Object.entries(shopMap);

  return (
    <div className="space-y-4">
      {/* Overall total */}
      <div className="bg-brand-50 border border-brand-200 rounded-2xl px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-brand-800 text-sm">Overall Grand Total</span>
        <span className="font-bold text-brand-700 text-lg tabular-nums">
          {formatPrice(overallTotal)}
        </span>
      </div>

      {/* Per shop */}
      {shops.map(([shopId, shop]) => {
        const items = Object.entries(shop.items);
        const shopTotal = items.reduce(
          (s, [, it]) => s + it.price * it.totalQty,
          0
        );

        return (
          <div
            key={shopId}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
          >
            {/* Shop header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">{shop.shopName}</h3>
              <span className="font-semibold text-gray-600 tabular-nums">
                {formatPrice(shopTotal)}
              </span>
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-100">
              {items.map(([itemId, item]) => (
                <div
                  key={itemId}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-800 text-sm">
                      {item.itemName}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatPrice(item.price)} each
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-base tabular-nums">
                      × {item.totalQty}
                    </p>
                    <p className="text-xs text-gray-500 tabular-nums">
                      {formatPrice(item.price * item.totalQty)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
