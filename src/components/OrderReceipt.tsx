import React from 'react';
import type { Order } from '@/lib/types';

// Print/download receipt for one order.
//
// Rendered off-screen on the order page and rasterised with html2canvas
// into a PDF. Everything here uses plain inline styles (hex colours only,
// no Tailwind classes, no letter-spacing) so the rasteriser cannot
// mis-parse a utility and Bangla conjuncts keep their shaping — the
// browser's text engine does the shaping while drawing to canvas.
export default function OrderReceipt({
  order,
  lang,
  whatsappNumber,
  paymentStatusLabel,
}: {
  order: Order;
  lang: 'en' | 'bn';
  whatsappNumber: string;
  paymentStatusLabel: string;
}) {
  const bn = lang === 'bn';
  const ink = '#2C1E19';
  const muted = '#7A6A5E';
  const caramel = '#9C6237';
  const line = '#E8DDD2';
  const softBg = '#F7EFE7';

  // created_at is stored as an ISO UTC string; show it in Dhaka time.
  const placed = new Date(order.created_at);
  const locale = bn ? 'bn-BD' : 'en-GB';
  const dateStr = new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(placed);
  const timeStr = new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Dhaka',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(placed);

  const paymentMethodLabel =
    order.payment_method === 'cod'
      ? bn
        ? 'ক্যাশ অন ডেলিভারি'
        : 'Cash on Delivery'
      : order.payment_method.toUpperCase();

  const row: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: 14,
    color: muted,
  };

  return (
    <div
      style={{
        width: 760,
        backgroundColor: '#ffffff',
        color: ink,
        fontFamily: "'Hind Siliguri', system-ui, sans-serif",
        padding: '36px 40px',
      }}
    >
      {/* Shop header */}
      <div style={{ textAlign: 'center', paddingBottom: 16 }}>
        <div
          style={{
            fontFamily: "'Hind Siliguri', system-ui, sans-serif",
            fontSize: 30,
            fontWeight: 700,
            color: ink,
          }}
        >
          Sweet Cravings
        </div>
        <div style={{ fontSize: 14, color: muted, marginTop: 4 }}>
          {bn ? 'হোমমেড ডেজার্টস • রাজশাহী' : 'Homemade Desserts • Rajshahi'}
        </div>
        <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>
          Rajshahi, Bangladesh
          {whatsappNumber ? ` • WhatsApp: ${whatsappNumber}` : ''}
        </div>
      </div>

      <div style={{ height: 2, backgroundColor: caramel, marginBottom: 20 }} />

      {/* Receipt title + reference + date */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{bn ? 'রশিদ' : 'Receipt'}</div>
          <div style={{ fontSize: 14, color: muted, marginTop: 4 }}>
            {bn ? 'অর্ডার' : 'Order'} #{order.public_code}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: muted, lineHeight: 1.6 }}>
          <div>{dateStr}</div>
          <div>{timeStr}</div>
        </div>
      </div>

      {/* Customer */}
      <div
        style={{
          border: `1px solid ${line}`,
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 20,
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 2 }}>
          {bn ? 'ডেলিভারির ঠিকানা' : 'Deliver To'}
        </div>
        <div style={{ fontWeight: 700 }}>{order.customer_name}</div>
        <div>{order.customer_phone}</div>
        <div style={{ color: muted }}>
          {order.delivery_address}
          {order.area_landmark ? `, ${order.area_landmark}` : ''}
        </div>
      </div>

      {/* Items table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 14,
          marginBottom: 8,
        }}
      >
        <thead>
          <tr style={{ backgroundColor: softBg }}>
            <th style={{ textAlign: 'left', padding: '9px 10px', borderBottom: `1px solid ${line}` }}>
              {bn ? 'আইটেম' : 'Item'}
            </th>
            <th style={{ textAlign: 'center', padding: '9px 10px', borderBottom: `1px solid ${line}`, width: 52 }}>
              {bn ? 'পরিমাণ' : 'Qty'}
            </th>
            <th style={{ textAlign: 'right', padding: '9px 10px', borderBottom: `1px solid ${line}`, width: 96 }}>
              {bn ? 'একক মূল্য' : 'Unit Price'}
            </th>
            <th style={{ textAlign: 'right', padding: '9px 10px', borderBottom: `1px solid ${line}`, width: 96 }}>
              {bn ? 'মোট' : 'Total'}
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items?.map((item, idx) => (
            <tr key={idx}>
              <td style={{ padding: '10px', borderBottom: `1px solid ${line}`, verticalAlign: 'top' }}>
                <div style={{ fontWeight: 700 }}>
                  {bn ? item.product_name_bn : item.product_name_en}
                </div>
                {(item.variant_label_en || item.variant_label_bn) && (
                  <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                    {bn ? item.variant_label_bn : item.variant_label_en}
                  </div>
                )}
              </td>
              <td style={{ padding: '10px', borderBottom: `1px solid ${line}`, textAlign: 'center', verticalAlign: 'top' }}>
                {item.quantity}
              </td>
              <td style={{ padding: '10px', borderBottom: `1px solid ${line}`, textAlign: 'right', verticalAlign: 'top' }}>
                ৳{item.unit_price}
              </td>
              <td style={{ padding: '10px', borderBottom: `1px solid ${line}`, textAlign: 'right', fontWeight: 700, verticalAlign: 'top' }}>
                ৳{item.line_total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ marginLeft: 'auto', width: 300, paddingTop: 6 }}>
        <div style={row}>
          <span>{bn ? 'সাবটোটাল' : 'Subtotal'}</span>
          <span style={{ color: ink, fontWeight: 600 }}>৳{order.subtotal}</span>
        </div>
        {order.discount_amount && order.discount_amount > 0 ? (
          <div style={{ ...row, color: '#3F6212' }}>
            <span>
              {bn ? 'ডিসকাউন্ট' : 'Discount'} ({order.coupon_code || 'Promo'})
            </span>
            <span style={{ fontWeight: 700 }}>-৳{order.discount_amount}</span>
          </div>
        ) : null}
        <div style={row}>
          <span>{bn ? 'ডেলিভারি চার্জ' : 'Delivery Fee'}</span>
          <span style={{ color: ink, fontWeight: 600 }}>
            {order.delivery_fee === 0 ? (bn ? 'ফ্রি' : 'FREE') : `৳${order.delivery_fee}`}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '10px 0 0',
            marginTop: 4,
            borderTop: `1px solid ${line}`,
            fontSize: 18,
            fontWeight: 700,
            color: ink,
          }}
        >
          <span>{bn ? 'সর্বমোট' : 'Grand Total'}</span>
          <span style={{ color: caramel }}>৳{order.total_amount}</span>
        </div>
      </div>

      {/* Payment */}
      <div
        style={{
          borderTop: `1px solid ${line}`,
          marginTop: 20,
          paddingTop: 14,
          fontSize: 14,
          lineHeight: 1.9,
        }}
      >
        <div>
          <span style={{ color: muted }}>{bn ? 'পেমেন্ট মাধ্যম: ' : 'Payment Method: '}</span>
          <strong>{paymentMethodLabel}</strong>
        </div>
        <div>
          <span style={{ color: muted }}>{bn ? 'পেমেন্ট অবস্থা: ' : 'Payment Status: '}</span>
          <strong>{paymentStatusLabel}</strong>
        </div>
        {order.delivery_instructions ? (
          <div>
            <span style={{ color: muted }}>{bn ? 'মন্তব্য: ' : 'Delivery Note: '}</span>
            {order.delivery_instructions}
          </div>
        ) : null}
      </div>

      {/* Thank-you */}
      <div style={{ textAlign: 'center', marginTop: 26, paddingTop: 16, borderTop: `1px solid ${line}` }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {bn
            ? 'সুইট ক্রেভিংস থেকে অর্ডার করার জন্য ধন্যবাদ!'
            : 'Thank you for ordering from Sweet Cravings!'}
        </div>
        <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>
          {bn
            ? 'অনুগ্রহ করে এই রশিদটি সংরক্ষণ করুন।'
            : 'Please save this receipt for your records.'}
        </div>
      </div>
    </div>
  );
}
