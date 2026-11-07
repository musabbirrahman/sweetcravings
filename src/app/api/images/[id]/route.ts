import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Serve one uploaded product photo stored in the product_images table
 * (the Cloudflare path — see POST /api/admin/upload). Public: product
 * photos are shop content, same as the old /uploads/products/*.jpg
 * files. Long cache: an image row never changes once stored.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ success: false, error: 'Image not found.' }, { status: 404 });
  }
  const db = await getDb();
  const row = (await db.prepare(
    'SELECT mime_type, data FROM product_images WHERE id = ?'
  ).get(id)) as { mime_type: string; data: Uint8Array } | undefined;
  if (!row) {
    return NextResponse.json({ success: false, error: 'Image not found.' }, { status: 404 });
  }
  const bytes = row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data as unknown as ArrayBuffer);
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': row.mime_type,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
