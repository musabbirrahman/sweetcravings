import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getProducts, getCategories, getShopSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`products:${ip}`, 60, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: `Too many requests. Please wait ${limit.retryAfterSeconds} seconds and try again.` },
      { status: 429 }
    );
  }
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category') ? parseInt(searchParams.get('category')!, 10) : undefined;

    const products = await getProducts({ 
      categoryId, 
      status: 'published', // only published products visible to public
      includeArchived: false 
    });
    
    const categories = await getCategories(false);
    const settings = await getShopSettings();

    // Redact internal secrets, expose public settings
    const publicSettings = {
      service_city: settings.service_city,
      coverage_statement_en: settings.coverage_statement_en,
      coverage_statement_bn: settings.coverage_statement_bn,
      delivery_fee: settings.delivery_fee,
      free_delivery_threshold: settings.free_delivery_threshold,
      is_store_paused: settings.is_store_paused,
      pause_message_en: settings.pause_message_en,
      pause_message_bn: settings.pause_message_bn,
      whatsapp_number: settings.whatsapp_number,
      cod_enabled: settings.cod_enabled,
      bkash_enabled: settings.bkash_enabled,
      bkash_number: settings.bkash_number,
      bkash_type: settings.bkash_type,
      bkash_instructions_en: settings.bkash_instructions_en,
      bkash_instructions_bn: settings.bkash_instructions_bn,
      nagad_enabled: settings.nagad_enabled,
      nagad_number: settings.nagad_number,
      nagad_type: settings.nagad_type,
      nagad_instructions_en: settings.nagad_instructions_en,
      nagad_instructions_bn: settings.nagad_instructions_bn,
    };

    return NextResponse.json({
      success: true,
      products,
      categories,
      settings: publicSettings,
    });
  } catch (error: any) {
    console.error('API products error:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
