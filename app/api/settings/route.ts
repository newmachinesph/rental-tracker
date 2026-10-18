import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });
    return NextResponse.json(settings ?? {});
  } catch (error) {
    console.error('Failed to fetch user settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        currency: body.currency ?? '₱',
        propertyTypes: body.propertyTypes ?? ['Apartment', 'House', 'Cottage', 'Condo', 'Townhouse', 'Commercial'],
        incomeCategories: body.incomeCategories ?? ['Rent', 'Parking', 'Laundry', 'Pet Fee', 'Late Fee', 'Storage', 'Other Income'],
        expenseCategories: body.expenseCategories ?? ['Maintenance', 'Repairs', 'Insurance', 'Property Tax', 'Utilities', 'Management Fee', 'Mortgage', 'Landscaping', 'Cleaning', 'Legal Fees', 'Advertising', 'Other Expense'],
        paymentMethods: body.paymentMethods ?? ['Bank Transfer', 'Cash', 'Credit Card', 'Check', 'E-Transfer', 'PayPal'],
        mileageUnit: body.mileageUnit ?? 'miles',
        sidebarModules: body.sidebarModules ?? null,
      },
      update: {
        ...(body.currency !== undefined && { currency: body.currency }),
        ...(body.propertyTypes !== undefined && { propertyTypes: body.propertyTypes }),
        ...(body.incomeCategories !== undefined && { incomeCategories: body.incomeCategories }),
        ...(body.expenseCategories !== undefined && { expenseCategories: body.expenseCategories }),
        ...(body.paymentMethods !== undefined && { paymentMethods: body.paymentMethods }),
        ...(body.mileageUnit !== undefined && { mileageUnit: body.mileageUnit }),
        ...(body.sidebarModules !== undefined && { sidebarModules: body.sidebarModules }),
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to update user settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
