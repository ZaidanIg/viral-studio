import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSceneImage } from '@/lib/ai/gemini'
import prisma from '@/lib/prisma'
import type { StoryboardScene } from '@/types/database'

/**
 * POST /api/storyboard/generate-images
 * Streams SSE progress while generating Imagen 3 reference images for each
 * scene in a saved storyboard, then persists the base64 back into the DB.
 *
 * Body: { storyboardId: string }
 * Events:
 *   { step: 'start', total: number }
 *   { step: 'scene', sceneIndex: number, label: string, progress: number }
 *   { step: 'scene_done', sceneIndex: number, label: string, image_base64: string, progress: number }
 *   { step: 'complete', scenes: StoryboardScene[], progress: 100 }
 *   { step: 'error', message: string }
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const supabase = await createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          send({ step: 'error', message: 'Unauthorized' })
          controller.close()
          return
        }

        const body = await request.json()
        const { storyboardId } = body as { storyboardId: string }

        if (!storyboardId) {
          send({ step: 'error', message: 'storyboardId required' })
          controller.close()
          return
        }

        // Fetch storyboard — must belong to the user, include character for consistency
        const storyboard = await prisma.storyboard.findUnique({
          where: { id: storyboardId, user_id: user.id },
          include: { character: true },
        })

        if (!storyboard) {
          send({ step: 'error', message: 'Storyboard not found' })
          controller.close()
          return
        }

        const scenes = ((storyboard.scenes ?? []) as unknown[]) as (StoryboardScene & {
          image_base64?: string | null
        })[]

        send({ step: 'start', total: scenes.length })

        // Generate image for each scene sequentially
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i]
          const progress = Math.round(((i + 0.5) / scenes.length) * 95)

          send({
            step: 'scene',
            sceneIndex: i,
            label: scene.scene_label,
            progress,
          })

          // Skip if already has an image
          if (scene.image_base64) {
            send({
              step: 'scene_done',
              sceneIndex: i,
              label: scene.scene_label,
              image_base64: scene.image_base64,
              progress: Math.round(((i + 1) / scenes.length) * 95),
            })
            continue
          }

          const imageBase64 = await generateSceneImage(
            scene.scene_description,
            scene.video_prompt,
            scene.scene_label,
            storyboard?.character?.anchor_phrase || undefined
          )

          scenes[i] = { ...scene, image_base64: imageBase64 ?? undefined }

          send({
            step: 'scene_done',
            sceneIndex: i,
            label: scene.scene_label,
            image_base64: imageBase64,
            progress: Math.round(((i + 1) / scenes.length) * 95),
          })
        }

        // Persist updated scenes (with image_base64) back to DB
        await prisma.storyboard.update({
          where: { id: storyboardId },
          data: { scenes: scenes as any },
        })

        send({ step: 'complete', scenes, progress: 100 })
        controller.close()
      } catch (err: any) {
        console.error('[generate-images] Error:', err)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ step: 'error', message: err.message ?? 'Internal error' })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
