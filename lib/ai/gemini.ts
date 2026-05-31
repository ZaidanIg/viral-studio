import 'server-only'
import { GoogleGenAI } from '@google/genai'
import type { NicheDetectionResult, StoryboardScene } from '@/types/database'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const MODEL = 'gemini-2.5-flash'

// =====================================================
// Niche Intelligence — Detect niche from product
// =====================================================
export async function detectNiche(
  productName: string,
  productDescription: string,
  imageBase64?: string
): Promise<NicheDetectionResult> {
  const prompt = `Kamu adalah analis konten affiliate marketing Indonesia spesialis TikTok Shop.
Analisis produk berikut dan hasilkan niche intelligence report.

PRODUK: ${productName}
DESKRIPSI: ${productDescription}

Return JSON ONLY (no explanation, no markdown code blocks):
{
  "primary_niche": "string",
  "secondary_niche": "string",
  "sub_niches": [{"name": "string", "description": "string"}],
  "opportunity_scores": [{"niche": "string", "score": 0-100, "reason": "string", "difficulty": "Mudah|Medium|Sulit"}],
  "content_angles": [{"type": "string", "name": "string", "hook_example": "string", "why_effective": "string", "estimated_ctr": "Sangat Tinggi|Tinggi|Medium-Tinggi|Medium"}],
  "creator_personas": [{"name": "string", "description": "string", "content_style": "string"}],
  "platform_scores": {"tiktok": 0-100, "reels": 0-100, "shorts": 0-100, "facebook": 0-100},
  "content_matrix": [{"niche": "string", "angle": "string", "hook_ready_to_use": "string"}],
  "competitor_pattern": {"hook_pattern": "string", "body_pattern": "string", "cta_pattern": "string"}
}

Rules:
- sub_niches: 3-5 items
- opportunity_scores: 3-5 items, sorted by score descending
- content_angles: minimum 3 items, maximum 5
- creator_personas: 3-4 items
- content_matrix: minimum 5 rows, maximum 8 rows
- All text in Bahasa Indonesia`

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ]

  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    })
  }

  const response = await genai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  })

  const text = response.text ?? ''
  // In case model still wraps in markdown (rare with responseMimeType, but safe to keep)
  const jsonStr = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(jsonStr) as NicheDetectionResult
  } catch (err) {
    console.error('Failed to parse Gemini output:', jsonStr)
    throw new Error('Gemini returned invalid JSON')
  }
}

// =====================================================
// Storyboard Generation — Generate 5-scene storyboard
// =====================================================
import { promises as fs } from 'fs'
import path from 'path'

export interface StoryboardInput {
  anchorPhrase: string
  productName: string
  visualDesc: string
  benefits: string[]
  selectedNiche: string
  selectedAngle: string
  selectedPersona: string
  style?: string
  accent?: string
}

export async function generateStoryboardJSON(
  input: StoryboardInput
): Promise<{ scenes: StoryboardScene[], agent_instruction: string }> {
  // Read prompt reference files
  const anglesPath = path.join(process.cwd(), 'prompts', 'angles.md')
  const promptingPath = path.join(process.cwd(), 'prompts', 'prompting.md')

  let anglesRef = ''
  let promptingRef = ''

  try {
    anglesRef = await fs.readFile(anglesPath, 'utf8')
    promptingRef = await fs.readFile(promptingPath, 'utf8')
  } catch (err) {
    console.warn('Could not read prompt reference files, using fallback.')
  }

  const prompt = `Buat storyboard video affiliate TikTok 5 scene dan Google Flow Production Package.

REFERENSI ANGLE:
${anglesRef.substring(0, 3000)}...

REFERENSI PROMPTING GOOGLE FLOW:
${promptingRef.substring(0, 3000)}...

DATA INPUT:
KARAKTER: ${input.anchorPhrase}
PRODUK: ${input.productName} — ${input.visualDesc}
KEUNGGULAN: ${input.benefits.join(', ')}
NICHE: ${input.selectedNiche} | ANGLE: ${input.selectedAngle}
PERSONA: ${input.selectedPersona}
GAYA NARASI: ${input.style || 'conversational'} | AKSEN: ${input.accent || 'Netral'}

TUGAS:
1. Hasilkan 5 scene sesuai dengan ANGLE yang dipilih.
2. Setiap scene harus memiliki dialogue UGC (Bahasa Indonesia) dan Flow Prompt (Bahasa Indonesia/Inggris sesuai aturan).
3. Gunakan tag 'creator.png' untuk karakter dan 'product.jpg' untuk produk di dalam flow_prompt.
4. Buat SATU agent_instruction global yang merangkum kelima scene tersebut.

Return JSON ONLY (no explanation, no markdown):
{
  "scenes": [
    {
      "scene_type": "string (hook|problem|solution|benefit|cta)",
      "scene_label": "string (e.g. Scene 1 — Hook)",
      "scene_description": "string (visual scene description)",
      "video_prompt": "string (camera direction, lighting, mood)",
      "flow_prompt": "string (THE EXACT GOOGLE FLOW PROMPT. Must include creator.png, and product.jpg if applicable. Must include style modifiers like 'nuansa handheld', 'candid', 'tekstur kulit natural', 'framing tidak sempurna'. Must include verbatim dialogue inside quotes.)",
      "narasi_script": "string (Dialogue text only)",
      "camera_suggestion": "string"
    }
  ],
  "agent_instruction": "string (The complete Agent Mode Briefing combining all 5 scenes as described in prompting.md)"
}

RULES:
- JSON only, no markdown formatting.
- flow_prompt MUST follow the rules in prompting.md strictly.`

  const response = await genai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature: 0.8,
      maxOutputTokens: 5000,
      responseMimeType: 'application/json',
    },
  })

  const text = response.text ?? ''
  const jsonStr = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(jsonStr)
  } catch (err) {
    console.error('Failed to parse Storyboard Gemini output:', jsonStr)
    throw new Error('Gemini returned invalid JSON for storyboard')
  }
}

// =====================================================
// Scene Image Generation — Multi-tier pipeline
// 1. gemini-2.5-flash-image (if API quota allows)
// 2. Pollinations.AI (free, zero-config, highly robust 9:16 generator)
// =====================================================
export async function generateSceneImage(
  sceneDescription: string,
  videoPrompt: string,
  sceneLabel: string,
  anchorPhrase?: string
): Promise<string | null> {
  try {
    const characterPrompt = anchorPhrase ? `Character appearance: ${anchorPhrase}. ` : ''
    const prompt = `Cinematic storyboard reference frame for a TikTok/short video.
Scene: ${sceneLabel}.
${sceneDescription}.
Camera & mood: ${videoPrompt}.
${characterPrompt}Style: realistic UGC social media video, natural lighting, candid handheld feel, slightly desaturated warm tones. No text overlays. No watermarks.`

    console.log(`[generateSceneImage] Attempting local imagen-3.0-generate-001...`)
    const response = await genai.models.generateImages({
      model: 'imagen-3.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '9:16'
      },
    })

    const base64 = response.generatedImages?.[0]?.image?.imageBytes
    if (base64) {
      return base64 as string
    }
    throw new Error('No image returned from Imagen 3')
  } catch (err: any) {
    console.error(`[generateSceneImage] Image generation failed:`, err?.message ?? err)
    return null
  }
}

// =====================================================
// Character Analysis — Extract anchor phrase
// =====================================================
export async function analyzeCharacter(
  imageBase64: string
): Promise<{ anchorPhrase: string; description: string }> {
  const prompt = `Analyze this person's photo and create a detailed character anchor phrase for AI image generation consistency.
CRITICAL RULE: ONLY describe the exact physical features and clothing clearly visible in the photo. DO NOT hallucinate, guess, or add ANY details (like hats, peci, glasses, facial hair, or accessories) if they are not explicitly and clearly present in the image. Keep it purely descriptive of what is seen.

Return JSON ONLY:
{
  "anchorPhrase": "string (detailed visual description: gender, age range, hair color/style, skin tone, explicitly visible clothing/accessories, expression — in English, max 50 words)",
  "description": "string (brief Indonesian description for user display, max 20 kata)"
}

The anchor phrase will be used verbatim in every image generation prompt to maintain character consistency.`

  const response = await genai.models.generateContent({
    model: MODEL,
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
      ],
    }],
    config: {
      temperature: 0.3,
      maxOutputTokens: 500,
      responseMimeType: 'application/json',
    },
  })

  const text = response.text ?? ''
  const jsonStr = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(jsonStr)
  } catch (err) {
    console.error('Failed to parse Character Gemini output:', jsonStr)
    throw new Error('Gemini returned invalid JSON for character analysis')
  }
}
