import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { Client } from '@upstash/qstash'
import type { StoryboardScene } from '@/types/database'

/**
 * POST /api/storyboard/generate-images
 * Asynchronous trigger for image generation.
 * Publishes messages to QStash for each scene that needs an image,
 * updates the storyboard status to "generating", and returns 202 Accepted.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { storyboardId } = body as { storyboardId: string }

    if (!storyboardId) {
      return NextResponse.json({ error: 'storyboardId required' }, { status: 400 })
    }

    // Fetch storyboard
    const storyboard = await prisma.storyboard.findUnique({
      where: { id: storyboardId, user_id: user.id },
      include: { character: true },
    })

    if (!storyboard) {
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 })
    }

    const scenes = (storyboard.scenes ?? []) as (StoryboardScene & {
      image_base64?: string | null
    })[]

    // Change status to generating
    await prisma.storyboard.update({
      where: { id: storyboardId },
      data: { status: 'generating' },
    })

    // Setup QStash client
    const qstashToken = process.env.QSTASH_TOKEN || ''
    const qstash = new Client({ token: qstashToken })

    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || request.headers.get("host") || "localhost:3000"
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
    const protocol = isLocal ? 'http' : 'https'
    const webhookUrl = `${protocol}://${host}/api/worker/generate-single-scene`

    // Publish a separate job for each scene that needs an image
    let publishedCount = 0
    for (let i = 0; i < scenes.length; i++) {
      if (!scenes[i].image_base64) {
        try {
          // If we don't have a real QStash token in local dev, we simulate async fetch
          if (qstashToken === 'mock_token_for_dev' || !qstashToken) {
            console.log(`[generate-images] Simulated QStash: Fetching webhook locally for scene ${i}`)
            fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ storyboardId, sceneIndex: i, userId: user.id }),
            }).catch(e => console.error('Local async fetch failed:', e))
          } else {
            console.log(`[generate-images] Publishing QStash job for scene ${i}`)
            await qstash.publishJSON({
              url: webhookUrl,
              body: { storyboardId, sceneIndex: i, userId: user.id },
            })
          }
          publishedCount++
        } catch (queueErr) {
          console.error(`Failed to publish scene ${i}:`, queueErr)
        }
      }
    }

    // If all scenes already have images (publishedCount === 0), mark as complete immediately
    if (publishedCount === 0) {
      await prisma.storyboard.update({
        where: { id: storyboardId },
        data: { status: 'complete' },
      })
    }

    // Return 202 Accepted, client will poll
    return NextResponse.json({ success: true, status: 'generating', publishedJobs: publishedCount }, { status: 202 })
  } catch (err: any) {
    console.error('[generate-images] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
