import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-001',
      prompt: 'A cute cat',
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '9:16'
      }
    });
    console.log("Success", !!response.generatedImages[0].image.imageBytes);
  } catch (e) {
    console.error(e);
  }
}
run();
