import { NextResponse } from 'next/server';
import {
  getCategories,
  countProductsInCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** List all categories (including archived ones) with live product counts. */
export async function GET(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }
    const categories = getCategories(true).map((c) => ({
      ...c,
      productCount: countProductsInCategory(c.id),
    }));
    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** Create a category. The web address (slug) is made from the English name. */
export async function POST(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }
    const body = await request.json();
    const { nameEn, nameBn, descriptionEn, descriptionBn, sortOrder, active } = body;
    if (!nameEn?.trim() || !nameBn?.trim()) {
      return NextResponse.json({ success: false, error: 'English and Bangla names are required' }, { status: 400 });
    }
    const category = createCategory({
      name_en: nameEn,
      name_bn: nameBn,
      description_en: descriptionEn || '',
      description_bn: descriptionBn || '',
      sort_order: sortOrder !== undefined && sortOrder !== '' ? parseInt(sortOrder, 10) : undefined,
      active: active === undefined ? 1 : active ? 1 : 0,
    });
    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    const message = error?.message || 'Failed to create category';
    const status = /already exists/i.test(message) ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/** Edit a category (names, descriptions, order, active flag). Slug never changes. */
export async function PUT(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }
    const body = await request.json();
    const { id, nameEn, nameBn, descriptionEn, descriptionBn, sortOrder, active } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
    }
    if ((nameEn !== undefined && !nameEn.trim()) || (nameBn !== undefined && !nameBn.trim())) {
      return NextResponse.json({ success: false, error: 'Names cannot be empty' }, { status: 400 });
    }
    const category = updateCategory(Number(id), {
      name_en: nameEn,
      name_bn: nameBn,
      description_en: descriptionEn,
      description_bn: descriptionBn,
      sort_order: sortOrder !== undefined && sortOrder !== '' ? parseInt(sortOrder, 10) : undefined,
      active: active === undefined ? undefined : active ? 1 : 0,
    });
    if (!category) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to update category' }, { status: 500 });
  }
}

/**
 * Delete a category only when no live product uses it.
 * When products still use it, the request is refused with a clear
 * message — archive the category instead (PUT active = 0).
 */
export async function DELETE(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
    }
    const result = deleteCategory(Number(id));
    if (!result.deleted) {
      return NextResponse.json(
        {
          success: false,
          error: `This category still has ${result.productCount} dessert${result.productCount === 1 ? '' : 's'} in it. Move or archive those desserts first, or archive the category instead of deleting it.`,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, message: 'Category deleted.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete category' }, { status: 500 });
  }
}
