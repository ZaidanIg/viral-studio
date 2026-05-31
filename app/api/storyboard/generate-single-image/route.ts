import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSceneImage } from '@/lib/ai/gemini'
import prisma from '@/lib/prisma'

/**
 * POST /api/storyboard/generate-single-image
 * Generates/regenerates a single scene image.
 * Supports both saved library storyboards (via storyboardId + sceneIndex)
 * and unsaved drafts (via direct scene properties).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { storyboardId, sceneIndex, sceneDescription, videoPrompt, sceneLabel, anchorPhrase } = body

    let imageBase64: string | null = null

    if (storyboardId !== undefined && sceneIndex !== undefined) {
      // Flow A: Saved Storyboard in DB
      const storyboard = await prisma.storyboard.findUnique({
        where: { id: storyboardId, user_id: user.id },
        include: { character: true }
      })

      if (!storyboard) {
        return NextResponse.json({ error: 'Storyboard tidak ditemukan' }, { status: 404 })
      }

      const scenes = (storyboard.scenes ?? []) as any[]
      const scene = scenes[sceneIndex]

      if (!scene) {
        return NextResponse.json({ error: 'Scene tidak ditemukan' }, { status: 404 })
      }

      console.log(`[generate-single-image] Regenerating image for saved storyboard scene ${sceneIndex + 1}`)
      
      const finalDesc = sceneDescription || scene.scene_description
      const finalPrompt = videoPrompt || scene.video_prompt

      imageBase64 = await generateSceneImage(
        finalDesc,
        finalPrompt,
        scene.scene_label,
        storyboard?.character?.anchor_phrase || anchorPhrase || undefined
      )

      if (!imageBase64) {
        return NextResponse.json({ error: 'Gagal membuat gambar untuk scene' }, { status: 500 })
      }

      // Update scenes array
      scenes[sceneIndex] = { ...scene, image_base64: imageBase64, scene_description: finalDesc, video_prompt: finalPrompt }

      // Save back to DB
      await prisma.storyboard.update({
        where: { id: storyboardId },
        data: { scenes: scenes as any },
      })

      return NextResponse.json({ success: true, image_base64: imageBase64 })
    } else {
      // Flow B: Draft Storyboard (unsaved)
      if (!sceneDescription || !sceneLabel) {
        return NextResponse.json({ error: 'Deskripsi scene dan label wajib diisi' }, { status: 400 })
      }

      console.log(`[generate-single-image] Generating image for draft scene: ${sceneLabel}`)
      
      imageBase64 = await generateSceneImage(
        sceneDescription,
        videoPrompt || '',
        sceneLabel,
        anchorPhrase || undefined
      )

      if (!imageBase64) {
        return NextResponse.json({ error: 'Gagal membuat gambar untuk draf scene' }, { status: 500 })
      }

      return NextResponse.json({ success: true, image_base64: imageBase64 })
    }
  } catch (err: any) {
    console.error('[generate-single-image] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
