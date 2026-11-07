import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Photo uploads are shop content, not code: files live under
// public/uploads/products/ on the host, next to the database file.
// They are gitignored (see .gitignore) and never go into the repo.
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'products');
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_WIDTH = 1200;

/**
 * Admin-only product photo upload.
 * Accepts one image file (JPEG/PNG/WebP, max 5 MB), resizes it to at
 * most 1200px wide and recompresses it as JPEG (quality 80), and saves
 * it under a unique filename. Returns the public URL to store in the
 * product record. Old files are never deleted here (see CODEMAP.md).
 */
export async function POST(request: Request) {
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

    // Resize + recompress: at most 1200px wide, JPEG quality 80.
    // A 5 MB phone photo becomes a web-sized file (usually well under 300 KB).
    let output: Buffer;
    try {
      output = await sharp(input)
        .rotate() // honour the phone's orientation flag
        .resize(MAX_WIDTH, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { success: false, error: 'That file could not be read as a photo. Please try a different image.' },
        { status: 400 }
      );
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.jpg`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), output);

    return NextResponse.json({
      success: true,
      url: `/uploads/products/${filename}`,
      sizeBytes: output.length,
    });
  } catch (error: any) {
    console.error('Photo upload error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Photo upload failed.' }, { status: 500 });
  }
}
