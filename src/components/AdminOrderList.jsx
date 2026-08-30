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
export default function AdminOrderList({ orders, allUsers, loading }) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Filter out admin accounts to get list of regular members
  const members = (allUsers || []).filter((u) => !u.isAdmin);

  if (members.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">👥</p>
        <p className="font-medium">No members registered yet.</p>
      </div>
    );
  }

  // Sort members alphabetically by name
  const sortedMembers = [...members].sort((a, b) =>
    a.name.localeCompare(b.name)
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

  // Count how many members have ordered
  const orderedCount = sortedMembers.filter((m) =>
    orders.some((o) => o.uid === m.uid)
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-500 font-medium">
        <span>
          Ordered: <strong className="text-brand-600 font-bold">{orderedCount}</strong> / {sortedMembers.length} members
        </span>
      </div>

      {sortedMembers.map((member) => {
        const order = orders.find((o) => o.uid === member.uid);

        if (!order) {
          // Member has not ordered yet
          return (
            <div
              key={member.uid}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center justify-between opacity-75"
            >
              <div>
                <h3 className="font-bold text-gray-700">{member.name}</h3>
                <p className="text-xs text-red-500 font-medium mt-0.5">
                  ❌ No order placed today
                </p>
              </div>
              <span className="text-xs font-semibold bg-gray-100 text-gray-400 px-2.5 py-1 rounded-full">
                Pending
              </span>
            </div>
          );
        }

        const shopGroups = groupByShop(order.items);
        return (
          <div
            key={member.uid}
            className="bg-white rounded-2xl border-2 border-brand-200 shadow-sm overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-brand-50/50 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">{member.name}</h3>
                <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider mt-0.5">
                  ✅ Ordered
                </p>
              </div>
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
                          <span className="text-gray-400 font-bold">× {item.qty}</span>
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
