import { formatPrice } from "../utils/price";

/**
 * Admin tab: Today's Orders
 * Real-time list of every member's order — name, breakdown per shop, total.
 * Sorted alphabetically by name.
 *
 * Props:
 *  - orders: [{ uid, userName, items: [{shopId, shopName, itemId, itemName, price, qty}], total }]
 *  - loading: boolean
 */
export default function AdminOrderList({ orders, loading }) {
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
        <p className="text-4xl mb-3">📋</p>
        <p className="font-medium">No orders placed today yet.</p>
        <p className="text-sm mt-1">Check back once members start ordering.</p>
      </div>
    );
  }

  // Sort alphabetically by name
  const sorted = [...orders].sort((a, b) =>
    a.userName.localeCompare(b.userName)
  );

  // Group a user's items by shop
  function groupByShop(items) {
    const map = {};
    for (const item of items) {
      if (!map[item.shopId]) {
        map[item.shopId] = { shopName: item.shopName, items: [] };
      }
      map[item.shopId].items.push(item);
    }
    return Object.values(map);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 font-medium">
        {orders.length} member{orders.length !== 1 ? "s" : ""} ordered today
      </p>

      {sorted.map((order) => {
        const shopGroups = groupByShop(order.items);
        return (
          <div
            key={order.uid}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">{order.userName}</h3>
              <span className="font-bold text-brand-600">
                {formatPrice(order.total)}
              </span>
            </div>

            {/* Items by shop */}
            <div className="px-4 py-3 space-y-3">
              {shopGroups.map((group) => (
                <div key={group.shopName}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    {group.shopName}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-700">
                          {item.itemName}{" "}
                          <span className="text-gray-400">× {item.qty}</span>
                        </span>
                        <span className="text-gray-600 font-medium tabular-nums">
                          {formatPrice(item.price * item.qty)}
                        </span>
                      </div>
                    ))}
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
