import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { createClient } from '@/lib/supabase/server'

const f = createUploadthing()

async function authMiddleware() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return { userId: user.id }
}

export const ourFileRouter = {
  // Character reference photos (up to 5 images, 4MB each)
  characterImage: f({
    image: { maxFileSize: '4MB', maxFileCount: 5 },
  })
    .middleware(authMiddleware)
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl }
    }),

  // Product photos (up to 3 images, 4MB each)
  productImage: f({
    image: { maxFileSize: '4MB', maxFileCount: 3 },
  })
    .middleware(authMiddleware)
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
