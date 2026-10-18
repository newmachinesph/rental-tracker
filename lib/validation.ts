import { NextResponse } from 'next/server';

type ValidationRule = {
  field: string;
  value: unknown;
  type: 'string' | 'number' | 'positiveNumber' | 'nonNegativeNumber' | 'boolean';
  required?: boolean;
};

export function validateFields(rules: ValidationRule[]): NextResponse | null {
  for (const rule of rules) {
    const { field, value, type, required } = rule;

    if (required && (value === undefined || value === null || value === '')) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }

    if (value === undefined || value === null) continue;

    if (type === 'string' && typeof value !== 'string') {
      return NextResponse.json({ error: `${field} must be a string` }, { status: 400 });
    }

    if (type === 'boolean' && typeof value !== 'boolean') {
      return NextResponse.json({ error: `${field} must be a boolean` }, { status: 400 });
    }

    if ((type === 'number' || type === 'positiveNumber' || type === 'nonNegativeNumber') && typeof value !== 'number') {
      return NextResponse.json({ error: `${field} must be a number` }, { status: 400 });
    }

    if (type === 'positiveNumber' && typeof value === 'number' && value <= 0) {
      return NextResponse.json({ error: `${field} must be greater than 0` }, { status: 400 });
    }

    if (type === 'nonNegativeNumber' && typeof value === 'number' && value < 0) {
      return NextResponse.json({ error: `${field} must be 0 or greater` }, { status: 400 });
    }
  }

  return null;
}
