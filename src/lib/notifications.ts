import { getShopSettings } from './db';

export interface NotificationPayload {
  order: {
    public_code: string;
    customer_name: string;
    customer_phone: string;
    area_landmark: string;
    delivery_address: string;
    delivery_instructions?: string;
    payment_method: string;
    total_amount: number;
    subtotal: number;
    delivery_fee: number;
    discount_amount?: number;
    coupon_code?: string | null;
    is_gift?: boolean;
    recipient_name?: string | null;
    recipient_phone?: string | null;
    gift_message?: string | null;
  };
  items: Array<{
    nameEn: string;
    nameBn: string;
    variantLabelEn?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

/**
 * Dispatches instant notifications to the kitchen operator (Telegram / SMS)
 * Non-blocking: failures are logged without disrupting the customer's checkout.
 */
export async function notifyKitchenNewOrder(payload: NotificationPayload): Promise<{ success: boolean; methods: string[] }> {
  const settings = await getShopSettings();
  const methodsUsed: string[] = [];

  const { order, items } = payload;
  const itemsSummary = items
    .map((i) => `• ${i.quantity}x ${i.nameEn}${i.variantLabelEn ? ` (${i.variantLabelEn})` : ''} - ৳${i.lineTotal}`)
    .join('\n');

  // 1. TELEGRAM BOT NOTIFICATION (Instant push notification with sound to phone)
  if (settings.telegram_bot_token && settings.telegram_chat_id) {
    try {
      const discountText = order.discount_amount && order.discount_amount > 0
        ? `\n🎟 *Discount:* -৳${order.discount_amount} (${order.coupon_code || 'PROMO'})`
        : '';

      const giftText = order.is_gift
        ? `\n🎁 *GIFT ORDER FOR:* ${order.recipient_name || 'Loved One'} (${order.recipient_phone || 'No phone'})\n💌 *Handwritten Card Note:* _"${order.gift_message || 'Sweet Wishes'}"_\n`
        : '';

      const text = `🍮 *NEW SWEET CRAVINGS ORDER!*
━━━━━━━━━━━━━━━━━━
*Order:* #${order.public_code}
*Customer:* ${order.customer_name}
*Phone:* \`${order.customer_phone}\`${giftText}
*Area:* ${order.area_landmark}
*Address:* ${order.delivery_address}
${order.delivery_instructions ? `*Note:* _${order.delivery_instructions}_\n` : ''}
*Payment:* ${order.payment_method.toUpperCase()}
*Subtotal:* ৳${order.subtotal}
*Delivery:* ৳${order.delivery_fee}${discountText}
*Total:* ৳${order.total_amount}
━━━━━━━━━━━━━━━━━━
*Items to Bake:*
${itemsSummary}
━━━━━━━━━━━━━━━━━━
👉 Open Admin: /admin/orders`;

      const telegramUrl = `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`;
      const res = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.telegram_chat_id,
          text,
          parse_mode: 'Markdown',
        }),
        // A slow Telegram must never hang checkout.
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        methodsUsed.push('telegram');
      } else {
        console.error('Telegram notification error:', await res.text());
      }
    } catch (err) {
      console.error('Failed to dispatch Telegram notification:', err);
    }
  }

  // 2. BANGLADESH SMS GATEWAY NOTIFICATION
  if (settings.sms_gateway_url && settings.sms_api_key && settings.whatsapp_number) {
    try {
      const smsMessage = `Sweet Cravings: New Order #${order.public_code} for BDT ${order.total_amount} from ${order.customer_name} (${order.area_landmark}). Payment: ${order.payment_method}. Check admin.`;
      
      const res = await fetch(settings.sms_gateway_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          api_key: settings.sms_api_key,
          sender_id: settings.sms_sender_id || 'SweetCraving',
          recipient: settings.whatsapp_number.replace(/\D/g, ''),
          message: smsMessage,
        }),
      });

      if (res.ok) {
        methodsUsed.push('sms');
      }
    } catch (err) {
      console.error('Failed to dispatch SMS notification:', err);
    }
  }

  return { success: methodsUsed.length > 0, methods: methodsUsed };
}
