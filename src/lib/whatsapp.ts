type OrderItem = {
  name: string;
  quantity: number;
  price: number;
};

type WhatsAppOrderPayload = {
  orderId: string;
  customerName: string;
  phone: string;
  address: string;
  landmark?: string;
  note?: string;
  orderType: "delivery" | "pickup";
  items: OrderItem[];
  totalAmount: number;
};

export function createWhatsAppOrderMessage(data: WhatsAppOrderPayload) {
  const itemsText = data.items
    .map(
      (item, index) =>
        `${index + 1}. ${item.name} x ${item.quantity} = ₹${item.price * item.quantity}`
    )
    .join("\n");

  return `Hello Cafe, I want to place an order.

Order ID: ${data.orderId}
Name: ${data.customerName}
Phone: ${data.phone}
Order Type: ${data.orderType}

Address: ${data.address}
Landmark: ${data.landmark || "-"}

Items:
${itemsText}

Total: ₹${data.totalAmount}

Note: ${data.note || "-"}`;
}

export function getWhatsAppLink(message: string) {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}