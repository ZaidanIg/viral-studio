import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateSceneImage } from '@/lib/ai/gemini'
import type { StoryboardScene } from '@/types/database'
import { verifySignatureAppRouter } from '@upstash/qstash/dist/nextjs'

async function handler(request: NextRequest) {
  try {
    const body = await request.json()
    const { storyboardId, sceneIndex, userId } = body

    if (!storyboardId || sceneIndex === undefined || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const storyboard = await prisma.storyboard.findUnique({
      where: { id: storyboardId, user_id: userId },
      include: { character: true },
    })

    if (!storyboard) {
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 })
    }

    const scenes = (storyboard.scenes ?? []) as (StoryboardScene & {
      image_base64?: string | null
    })[]

    const scene = scenes[sceneIndex]
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
    }

    if (scene.image_base64) {
      // already generated
      return NextResponse.json({ success: true, message: 'Already generated' })
    }

    console.log(`[worker] Generating image for storyboard ${storyboardId}, scene ${sceneIndex}...`)
    const imageBase64 = await generateSceneImage(
      scene.scene_description,
      scene.video_prompt,
      scene.scene_label,
      storyboard?.character?.anchor_phrase || undefined
    )

    if (imageBase64) {
      console.log(`[worker] Successfully generated image for scene ${sceneIndex}. Saving to DB...`)
      
      let newStatus = 'generating'

      // Transaction to safely update the JSON array concurrently using row lock
      await prisma.$transaction(async (tx) => {
        // 1. Lock the row for update to prevent race conditions
        await tx.$queryRaw`SELECT id FROM storyboards WHERE id = ${storyboardId} FOR UPDATE`

        // 2. Fetch the latest state of the scenes from the locked row
        const latestStoryboard = await tx.storyboard.findUnique({
          where: { id: storyboardId }
        })

        if (!latestStoryboard) return

        const currentScenes = (latestStoryboard.scenes ?? []) as any[]
        
        // 3. Update the specific scene
        if (currentScenes[sceneIndex]) {
          currentScenes[sceneIndex].image_base64 = imageBase64
        }

        // 4. Check if all scenes have images now
        const allDone = currentScenes.every((s) => !!s.image_base64)
        newStatus = allDone ? 'complete' : 'generating'

        // 5. Save the merged result back
        await tx.storyboard.update({
          where: { id: storyboardId },
          data: { 
            scenes: currentScenes,
            status: newStatus 
          },
        })
      })

      console.log(`[worker] Finished saving image for scene ${sceneIndex}. Status: ${newStatus}`)
      return NextResponse.json({ success: true, status: newStatus })
    } else {
      console.error(`[worker] Failed to generate image for scene ${sceneIndex}`)
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
    }
  } catch (err: any) {
    console.error('[worker] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Bypasses QStash signature verification ONLY if it's a mock token for local development.
export const POST = process.env.QSTASH_TOKEN === 'mock_token_for_dev' || !process.env.QSTASH_TOKEN
  ? handler
  : verifySignatureAppRouter(handler)
