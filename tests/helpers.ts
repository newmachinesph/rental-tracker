import { APIRequestContext } from '@playwright/test';

export const ADMIN_EMAIL = 'admin@gmail.com';
export const ADMIN_PASSWORD = 'admin123';
export const USER_EMAIL = 'john@example.com';
export const USER_PASSWORD = 'password123';

export async function loginAsAdmin(request: APIRequestContext) {
  const res = await request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) throw new Error(`Admin login failed: ${res.status()}`);
  return res;
}

export async function loginAsUser(request: APIRequestContext) {
  const res = await request.post('/api/auth/login', {
    data: { email: USER_EMAIL, password: USER_PASSWORD },
  });
  if (!res.ok()) throw new Error(`User login failed: ${res.status()}`);
  return res;
}
