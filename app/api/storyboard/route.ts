import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateStoryboardJSON, type StoryboardInput } from '@/lib/ai/gemini'
import prisma from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  const customReadable = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        // DEV BYPASS: Allow generation without login
        const DEV_BYPASS_LOGIN = true
        if (!user && !DEV_BYPASS_LOGIN) {
          send({ error: 'Unauthorized', progress: 0 })
          controller.close()
          return
        }

        const userId = user?.id || '00000000-0000-0000-0000-000000000000'

        // Check limits if user exists
        let usageRow = null
        // Use date-only (no time component) to match @db.Date constraint
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        if (user) {
          // Ensure Profile exists before any FK-dependent operations
          await prisma.profile.upsert({
            where: { id: user.id },
            update: {},
            create: {
              id: user.id,
              email: user.email ?? '',
              full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
              username: null,
            },
          })

          usageRow = await prisma.dailyUsage.findFirst({
            where: { user_id: user.id, date: today }
          })

          if (usageRow && usageRow.count && usageRow.count >= 10) {
            send({ error: 'Limit harian tercapai (10/10). Coba lagi besok.', progress: 0 })
            controller.close()
            return
          }
        }

        const body = await request.json()
        const input: StoryboardInput = {
          productName: body.productName,
          visualDesc: body.visualDesc || body.productVisual || '',
          benefits: body.benefits || body.productBenefits || [],
          anchorPhrase: body.anchorPhrase || body.characterAnchor || body.characterLabel || '',
          selectedNiche: body.selectedNiche,
          selectedAngle: body.selectedAngle,
          selectedPersona: body.selectedPersona,
        }

        send({ step: 'init', message: 'Menganalisis angle dan persona...', progress: 10 })

        // Step 1: Generate scenes (JSON)
        send({ step: 'generating_scenes', message: 'Membangun storyboard...', progress: 30 })
        const { scenes, agent_instruction } = await generateStoryboardJSON(input)
        
        // No more image generation, scenes are ready
        
        // Step 2: Save to Supabase (if user is logged in)
        send({ step: 'saving', message: 'Menyimpan storyboard...', progress: 90 })

        let storyboardId = null
        
        if (user) {
          // Auto-save the custom Character if present and not already registered in DB
          let characterId = body.characterId || null
          
          if (input.anchorPhrase && !characterId) {
            const anchorHash = crypto
              .createHash('sha256')
              .update(input.anchorPhrase)
              .digest('hex')
              .slice(0, 16)
              
            const existingChar = await prisma.character.findFirst({
              where: { user_id: user.id, anchor_hash: anchorHash }
            })
            
            if (existingChar) {
              characterId = existingChar.id
            } else {
              const character = await prisma.character.create({
                data: {
                  user_id: user.id,
                  label_name: body.characterLabel || 'Karakter Utama',
                  anchor_phrase: input.anchorPhrase,
                  anchor_hash: anchorHash,
                  image_urls: body.characterImages || [],
                }
              })
              characterId = character.id
            }
          }

          const storyboard = await prisma.storyboard.create({
            data: {
              user_id: user.id,
              title: `${input.selectedNiche} - ${input.selectedAngle || 'Storyboard'}`,
              character_id: characterId,
              product_id: body.productId || null,
              selected_angle: { name: input.selectedAngle },
              selected_persona: { name: input.selectedPersona },
              selected_niche: input.selectedNiche,
              framework: agent_instruction,
              scenes: scenes as any,
              status: 'complete',
            }
          })

          storyboardId = storyboard.id

          // Increment usage
          const currentCount = usageRow?.count || 0
          
          if (usageRow) {
            await prisma.dailyUsage.update({
              where: { id: usageRow.id },
              data: { count: currentCount + 1 }
            })
          } else {
            await prisma.dailyUsage.create({
              data: {
                user_id: user.id,
                date: today,
                count: 1
              }
            })
          }
        }

        send({
          step: 'complete',
          storyboardId: storyboardId,
          scenes: scenes,
          agent_instruction,
          progress: 100,
          message: 'Paket Produksi berhasil dibuat!',
        })
        controller.close()
      } catch (error: any) {
        console.error('Storyboard error:', error)
        send({ error: error.message || 'Terjadi kesalahan sistem' })
        controller.close()
      }
    },
  })

  return new NextResponse(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
