export type Language = 'en' | 'bn';

export type OrderStatus = 
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'submitted'
  | 'confirmed'
  | 'rejected'
  | 'refunded';

export type PaymentMethod = 'cod' | 'bkash' | 'nagad';

export interface Category {
  id: number;
  slug: string;
  sort_order: number;
  active: number; // 1 or 0
  name_en: string;
  name_bn: string;
  description_en: string;
  description_bn: string;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  label_en: string;
  label_bn: string;
  sku: string;
  price_adjustment: number; // integer BDT (+/-)
  active: number;
  sort_order: number;
}

export interface Product {
  id: number;
  category_id: number;
  slug: string;
  status: 'published' | 'sold_out' | 'archived' | 'draft';
  sort_order: number;
  base_price: number; // integer BDT
  name_en: string;
  name_bn: string;
  description_en: string;
  description_bn: string;
  ingredients_en: string;
  ingredients_bn: string;
  allergens_en: string;
  allergens_bn: string;
  lead_time_en: string;
  lead_time_bn: string;
  image_url: string;
  created_at: string;
  updated_at: string;
  daily_batch_limit?: number;
  sold_today?: number;
  remaining_today?: number;
  variants?: ProductVariant[];
  category_name_en?: string;
  category_name_bn?: string;
}

export interface CartItem {
  productId: number;
  productSlug: string;
  name_en: string;
  name_bn: string;
  imageUrl: string;
  variantId?: number;
  variantLabel_en?: string;
  variantLabel_bn?: string;
  unitPrice: number; // integer BDT
  quantity: number;
  lineTotal: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  product_name_en: string;
  product_name_bn: string;
  variant_label_en: string;
  variant_label_bn: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface OrderStatusEvent {
  id: number;
  order_id: number;
  from_status: string;
  to_status: string;
  acting_admin: string;
  note: string;
  created_at: string;
}

export interface PaymentSubmission {
  id: number;
  order_id: number;
  provider: 'bkash' | 'nagad' | 'cod';
  transaction_ref: string;
  claimed_amount: number;
  submitted_at: string;
  reviewed_at: string | null;
  review_state: 'pending' | 'verified' | 'rejected';
  reviewer: string | null;
}

export interface Order {
  id: number;
  public_code: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  area_landmark: string;
  delivery_instructions: string;
  requested_time: string;
  is_gift?: boolean | number;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  gift_message?: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  discount_amount?: number;
  coupon_code?: string | null;
  total_amount: number;
  completed_orders_count?: number;
  idempotency_token: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  events?: OrderStatusEvent[];
  payment_submissions?: PaymentSubmission[];
}

export interface Coupon {
  id: number;
  code: string;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  times_used: number;
  active: number;
  expires_at: string | null;
  created_at: string;
}

export interface ShopSettings {
  service_city: string;
  coverage_statement_en: string;
  coverage_statement_bn: string;
  delivery_fee: number;
  free_delivery_threshold: number;
  is_store_paused: boolean;
  pause_message_en: string;
  pause_message_bn: string;
  whatsapp_number: string;
  cod_enabled: boolean;
  bkash_enabled: boolean;
  bkash_number: string;
  bkash_type: 'personal' | 'merchant';
  bkash_instructions_en: string;
  bkash_instructions_bn: string;
  nagad_enabled: boolean;
  nagad_number: string;
  nagad_type: 'personal' | 'merchant';
  nagad_instructions_en: string;
  nagad_instructions_bn: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  sms_gateway_url?: string;
  sms_api_key?: string;
  sms_sender_id?: string;
  notifications_enabled?: boolean;
  loyalty_orders_per_reward: number;
  loyalty_reward_amount: number;
  loyalty_reward_min_order: number;
}

export interface LoyaltyInfo {
  phone: string;
  customerName: string | null;
  totalOrders: number;
  completedOrders: number;
  totalSpent: number;
  stamps: number; // 0 to (stampsNeeded - 1); 0 also when a reward was just earned
  stampsNeeded: number; // orders per reward (loyalty setting, default 5)
  stampsToNextReward: number;
  rewardsEarned: number;
  rewardsAvailable: number; // earned rewards not yet redeemed (0 until enough completed orders, then earned minus used)
  tier: string;
  tierBn: string;
  rewardCouponCode: string;
  rewardAmount: number; // ৳ off per reward (loyalty setting, default 150)
  rewardMinOrder: number; // minimum order ৳ to use a reward (loyalty setting, default 200)
}
