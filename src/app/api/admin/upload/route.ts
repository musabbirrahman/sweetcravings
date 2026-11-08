import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { verifyAdminSession } from '@/lib/auth';
import { getDb, isTursoEnabled } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Photo uploads are shop content, not code.
//
// - On Cloudflare Workers there is no disk and no sharp, so the photo
//   is resized in the BROWSER before upload (see the admin product
//   form: canvas resize to at most 1200px wide, JPEG quality 80) and
//   the resized bytes are stored in the product_images table, served by
//   GET /api/images/[id]. That is the path when Turso is configured.
// - Locally (no Turso vars) the same bytes are written to
//   public/uploads/products/ on disk, as before. They are gitignored
//   (see .gitignore) and never go into the repo.
//
// node:fs / node:path are imported dynamically inside the local branch
// only, so this module still loads on Workers, where they do not exist.
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB input (before the browser resize)
const MAX_STORED_BYTES = 1024 * 1024; // 1 MB cap for one stored photo
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Admin-only product photo upload.
 * Accepts one image file (JPEG/PNG/WebP, max 5 MB — normally already
 * resized in the browser to at most 1200px wide, JPEG quality 80).
 * Returns the URL to store in the product record: /api/images/<id>
 * when Turso is configured, /uploads/products/<file> locally.
 * Old files / rows are never deleted here (see CODEMAP.md).
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`admin-upload:${ip}`, 120, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: `Too many requests. Please wait ${limit.retryAfterSeconds} seconds and try again.` },
      { status: 429 }
    );
  }
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('photo');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Please choose a photo file to upload.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Only JPG, PNG or WebP photos are accepted. Please choose an image file.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'That photo is too large. Please choose one under 5 MB.' },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ success: false, error: 'That file is empty. Please choose a photo.' }, { status: 400 });
    }

    const input = Buffer.from(await file.arrayBuffer());

    // Cloudflare path: store the (browser-resized) bytes in Turso.
    // The 1 MB cap keeps the database small; a 1200px JPEG at quality
    // 80 is normally well under 300 KB. If the browser could not resize
    // (an unusual file), a large original is refused here rather than
    // stored at full size.
    if (isTursoEnabled()) {
      if (input.length > MAX_STORED_BYTES) {
        return NextResponse.json(
          { success: false, error: 'That photo is too large to store. Please choose a smaller photo (the browser normally resizes it first).' },
          { status: 400 }
        );
      }
      const db = await getDb();
      const result = (await db.prepare(
        'INSERT INTO product_images (mime_type, data, size_bytes, created_at) VALUES (?, ?, ?, ?)'
      ).run(file.type, input, input.length, new Date().toISOString())) as { lastInsertRowid: number | bigint };
      const id = Number(result.lastInsertRowid);
      return NextResponse.json({
        success: true,
        url: `/api/images/${id}`,
        sizeBytes: input.length,
      });
    }

    // Local path: write the bytes to public/uploads/products/.
    const path = await import('node:path');
    const fs = await import('node:fs');
    const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'products');
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext = EXT_BY_TYPE[file.type] || 'jpg';
    const filename = `${Date.now()}-${globalThis.crypto.randomUUID().slice(0, 8)}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), input);

    return NextResponse.json({
      success: true,
      url: `/uploads/products/${filename}`,
      sizeBytes: input.length,
    });
  } catch (error: any) {
    console.error('Photo upload error:', error);
    return NextResponse.json({ success: false, error: 'Photo upload failed.' }, { status: 500 });
  }
}
