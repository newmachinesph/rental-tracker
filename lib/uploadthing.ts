import { createUploadthing, type FileRouter } from 'uploadthing/server';
import { UploadThingError } from 'uploadthing/server';
import { cookies } from 'next/headers';

const f = createUploadthing();

async function authMiddleware() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  if (!session?.value) throw new UploadThingError('Unauthorized');
  return { userId: session.value };
}

export const ourFileRouter = {
  tenantFile: f({
    image: { maxFileSize: '8MB', maxFileCount: 5 },
    pdf: { maxFileSize: '16MB', maxFileCount: 5 },
    'application/msword': { maxFileSize: '16MB', maxFileCount: 5 },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { maxFileSize: '16MB', maxFileCount: 5 },
  })
    .middleware(authMiddleware)
    .onUploadComplete(({ file }) => {
      return { url: file.ufsUrl, name: file.name, size: file.size, type: file.type };
    }),

  paymentReceipt: f({
    image: { maxFileSize: '8MB', maxFileCount: 3 },
    pdf: { maxFileSize: '16MB', maxFileCount: 3 },
  })
    .middleware(authMiddleware)
    .onUploadComplete(({ file }) => {
      return { url: file.ufsUrl, name: file.name, size: file.size, type: file.type };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
