import React, { useCallback, useRef, useState } from 'react';
import JSZip from 'jszip';
import PageHeader from '../../shared/components/PageHeader';
import GradientLoader from '../../shared/components/GradientLoader';
import loadingGif0 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil.gif";
import loadingGif1 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil (1).gif";
import loadingGif2 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil (2).gif";
import loadingGif3 from "../../../../asset/loading/Buat_jadi_video_cinematic_dan_pastikan_mobil (3).gif";
import { getFriendlyErrorHint } from '../../shared/utils/friendlyError';
import { useAuthReady } from '../../shared/utils/useAuthReady';
import { type ImageResolutionOption, useImageResolution } from '../../shared/utils/useImageResolution';
import { useLanguage } from '../../shared/i18n';

// Local helper types

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

type EngineAspectRatioKey = 'portrait' | 'vertical' | 'square' | 'landscape';

type ActivityLogEntry = {
  id: number;
  type: 'INFO' | 'SUCCESS' | 'ERROR';
  message: string;
  timestamp: string;
};

const CHARACTER_TUTORIAL_URL = 'https://www.youtube.com/embed/LALT-I6kjH0?autoplay=1&mute=1&origin=http://localhost:3000';

type CharacterAngleVideoOutput = {
  fileName: string;
  filePath: string;
  sceneIndex?: number;
  status?: 'empty' | 'generating' | 'success' | 'failed' | 'completed';
  startedAt?: number;
  estimatedTotalSeconds?: number;
  errorMessage?: string;
  prompt?: string;
};

type CharacterImageOutput = {
  dataUrl: string;
  status?: 'generating' | 'completed' | 'failed';
  startedAt?: number;
  estimatedTotalSeconds?: number;
  prompt?: string;
  errorMessage?: string;
};

type CharacterAngleViewMode = 'photo' | 'video';

interface UploadedImageFile {
  file: File;
  preview: string;
}

interface CharacterEditModalState {
  isOpen: boolean;
  index: number | null;
  imageUrl: string | null;
  instruction: string;
  isSubmitting: boolean;
}

const initialFormData = {
  namaKarakter: '',
  jenisKelamin: '',
  usia: '',
  etnis: '',
  warnaKulit: '',
  bentukWajah: '',
  warnaMata: '',
  bentukMata: '',
  detailMata: '',
  bentukHidung: '',
  bentukBibir: '',
  warnaBibir: '',
  bentukRahang: '',
  tahiLalat: '',
  bekasLuka: '',
  bintikBintik: '',
  warnaRambut: '',
  panjangRambut: '',
  gayaRambut: '',
  detailGaya: '',
  tinggiBadan: '',
  bentukTubuh: '',
  tato: '',
  tandaLahir: '',
  gayaPakaian: '',
  atasan: '',
  bawahan: '',
  outerwear: '',
  alasKaki: '',
  warnaPola: '',
  anting: '',
  aksesorisLeher: '',
  aksesorisTangan: '',
  kacamata: '',
  penutupKepala: '',
  ekspresi: '',
  postur: '',
  bendaPendamping: '',
  lingkungan: '',
  gayaSeni: '',
  kualitas: '',
  pencahayaan: '',
  paletWarna: '',
  tipeShot: '',
  promptNegatif:
    'bad anatomy, distorted face, extra limbs, blurry, inconsistent character, different hair, wrong clothes, watermark, signature, text, logo',
};

type CharacterFormData = typeof initialFormData;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } else {
        reject(new Error('Failed to read file as a Base64 string.'));
      }
    };
    reader.onerror = (error) => reject(error);
  });

const downloadFile = (url: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
};

const getVideoFileUrl = (filePath?: string): string | null => {
  if (!filePath) return null;
  const encoded = encodeURIComponent(filePath);
  return `http://localhost:3123/video?path=${encoded}`;
};

type CharacterVideoAspectOption = '16:9' | '9:16';

type CharacterVideoSettings = {
  aspectRatio: CharacterVideoAspectOption;
  veoModel: '3.1-fast-low';
  resolution: '720p';
};

const getVideoSettingsFromAspectRatio = (
  ratio: AspectRatio,
  veoModel: '3.1-fast-low',
): CharacterVideoSettings => {
  const aspectRatio: CharacterVideoAspectOption = ratio === '16:9' ? '16:9' : '9:16';
  return {
    aspectRatio,
    veoModel,
    resolution: '720p',
  };
};

const mapAspectRatioToEngineKey = (aspectRatio: AspectRatio): EngineAspectRatioKey => {
  switch (aspectRatio) {
    case '1:1':
      return 'square';
    case '16:9':
      return 'landscape';
    case '9:16':
      return 'portrait';
    case '4:3':
      return 'landscape';
    case '3:4':
      return 'vertical';
    default:
      return 'square';
  }
};

const compressImage = (file: File, maxWidth = 1024, maxHeight = 1024): Promise<string> =>
  new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const img = new Image();
          img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
            } else if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas context is not available'));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          };
          img.onerror = (err) => reject(err || new Error('Failed to load image'));
          img.src = reader.result as string;
        } catch (err) {
          reject(err as Error);
        }
      };
      reader.onerror = (err) => reject(err || new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    } catch (err) {
      reject(err as Error);
    }
  });

const buildCharacterPrompt = (data: CharacterFormData): string => {
  const parts: string[] = [];

  const isMale = data.jenisKelamin?.toLowerCase().includes('male') && !data.jenisKelamin?.toLowerCase().includes('female');
  const subject = isMale ? 'He' : 'She';
  const possessive = isMale ? 'His' : 'Her';

  const introParts = [data.gayaSeni, data.kualitas, data.tipeShot].filter(Boolean);
  let identity = introParts.length > 0 
    ? `${introParts.join(', ')}, captured with a Leica Vario-Elmarit-SL 24-90mm f/2.8-4 ASPH lens, of a`
    : `Captured with a Leica Vario-Elmarit-SL 24-90mm f/2.8-4 ASPH lens, of a`;

  if (data.usia) identity += ` ${data.usia}`;
  if (data.etnis) identity += ` ${data.etnis}`;
  if (data.jenisKelamin) identity += ` ${data.jenisKelamin}`;
  if (data.namaKarakter) identity += ` named ${data.namaKarakter}`;
  parts.push(`${identity}.`);

  const faceDetails = [
    data.bentukWajah && `${data.bentukWajah} face`,
    data.warnaKulit &&
      `${data.warnaKulit} healthy, ultra-clean skin with an even tone and very smooth surface, like professional beauty retouching; keep subtle, realistic micro-texture and tiny pores, but absolutely no acne, pimples, bruntusan, blackheads, cystic acne, inflamed spots, severe blemishes, scars, redness, hyperpigmentation, or any signs of skin disease`,
    data.bentukMata && `${data.bentukMata} shaped ${data.warnaMata || ''} eyes`.replace('  ', ' '),
    data.detailMata,
    data.bentukHidung && `${data.bentukHidung} nose`,
    data.bentukBibir && `${data.bentukBibir} ${data.warnaBibir || ''} lips`.replace('  ', ' '),
    data.bentukRahang && `${data.bentukRahang} jawline`,
  ]
    .filter(Boolean)
    .join(', ');
  if (faceDetails) parts.push(`${subject} has a ${faceDetails}.`);

  const uniqueFeatures = [data.tahiLalat, data.bekasLuka, data.bintikBintik]
    .filter(Boolean)
    .join(', ');
  if (uniqueFeatures) parts.push(`Unique features include: ${uniqueFeatures}.`);

  const hair = [data.panjangRambut, data.gayaRambut, data.warnaRambut].filter(Boolean).join(' ');
  if (hair) parts.push(`${possessive} hair is ${hair}. ${data.detailGaya || ''}`);

  const body = [
    data.tinggiBadan && `around ${data.tinggiBadan} tall`,
    data.bentukTubuh && `with a ${data.bentukTubuh} build`,
  ]
    .filter(Boolean)
    .join(' ');
  if (body) parts.push(`${subject} is ${body}.`);

  const bodyFeatures = [data.tato, data.tandaLahir].filter(Boolean).join(', ');
  if (bodyFeatures) parts.push(`Body features: ${bodyFeatures}.`);

  if (data.gayaPakaian) parts.push(`${possessive} clothing style is ${data.gayaPakaian}.`);

  const outfit = [
    data.atasan && `wearing a ${data.atasan}`,
    data.bawahan && `a pair of ${data.bawahan}`,
    data.outerwear && `and ${data.outerwear}`,
    data.alasKaki && `with ${data.alasKaki}`,
  ]
    .filter(Boolean)
    .join(', ');
  if (outfit) parts.push(`${subject} is ${outfit}.`);

  if (data.warnaPola) parts.push(`${possessive} outfit has a dominant color palette of ${data.warnaPola}.`);

  const positiveAccessories = [
    data.anting,
    data.aksesorisLeher,
    data.aksesorisTangan,
    data.kacamata,
    data.penutupKepala,
  ].filter((a) => a && a.toLowerCase() !== 'none' && a.toLowerCase() !== 'tidak ada');

  if (positiveAccessories.length > 0) {
    parts.push(`${subject} accessorizes with ${positiveAccessories.join(', ')}.`);
  } else {
    parts.push(`${subject} is wearing no accessories at all.`);
  }

  if (data.ekspresi && data.postur) {
    parts.push(`${possessive} typical expression is a ${data.ekspresi} and ${subject.toLowerCase()} has a ${data.postur} posture.`);
  } else if (data.ekspresi) {
    parts.push(`${possessive} typical expression is a ${data.ekspresi}.`);
  } else if (data.postur) {
    parts.push(`${subject} has a ${data.postur} posture.`);
  }

  if (data.bendaPendamping && data.bendaPendamping.toLowerCase() !== 'none' && data.bendaPendamping.toLowerCase() !== 'tidak ada') {
    parts.push(`${subject} is often seen with ${data.bendaPendamping}.`);
  }

  const visualStyle = [
    data.pencahayaan && `${data.pencahayaan} lighting`,
    data.paletWarna && `a dominant color palette of ${data.paletWarna}`,
  ]
    .filter(Boolean)
    .join(', ');
  if (visualStyle) parts.push(`The visual style includes ${visualStyle}.`);

  parts.push(
    'IMPORTANT: If a reference photo is provided, the person in this image MUST be the exact same individual as in the reference: same face, skin tone, hairstyle, and overall body proportions. Do NOT change their identity, gender, age, or ethnicity.',
  );

  parts.push(
    'IMPORTANT: The outfit and wardrobe must remain EXACTLY the same across all images: same garments (top, bottom, outerwear, shoes), same colors, same style, and same accessories. The model must never change clothes or appear in a different outfit.',
  );

  parts.push(
    'The character is photographed in a clean, minimal professional WHITE studio with a seamless white backdrop and floor, no visible furniture, windows, or environment elements, and no props other than the character and their outfit.',
  );

  parts.push(
    'The final image must be clean and professional, with absolutely no text, watermarks, signatures, or logos of any kind.',
  );

  const negativeParts: string[] = [data.promptNegatif];
  if (!data.aksesorisTangan) negativeParts.push('watch, bracelet, ring');
  if (!data.aksesorisLeher) negativeParts.push('necklace, choker');
  if (!data.anting) negativeParts.push('earrings');
  if (!data.penutupKepala) negativeParts.push('hat, cap, beanie, headband');
  if (!data.kacamata) negativeParts.push('glasses, sunglasses');
  negativeParts.push(
    'different clothes, wardrobe change, outfit change, different colored clothes, different shirt, different pants, different dress',
  );

  const finalPrompt = parts.join('\n\n').replace(/,\./g, '.').replace(/\s+/g, ' ').trim();
  return `${finalPrompt} --no ${negativeParts.join(', ')}`;
};

const LabeledInput: React.FC<{
  label: string;
  name: keyof CharacterFormData;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, name, value, onChange }) => (
  <label className="flex flex-col gap-1 text-xs text-gray-200">
    <span className="font-semibold text-gray-300">{label}</span>
    <input
      name={name}
      value={value}
      onChange={onChange}
      className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
    />
  </label>
);

const LabeledTextarea: React.FC<{
  label: string;
  name: keyof CharacterFormData;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
}> = ({ label, name, value, onChange, rows = 3 }) => (
  <label className="flex flex-col gap-1 text-xs text-gray-200">
    <span className="font-semibold text-gray-300">{label}</span>
    <textarea
      name={name}
      value={value}
      rows={rows}
      onChange={onChange}
      className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
    />
  </label>
);

const CharacterHeaderIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 mr-3 text-pink-400"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6" />
  </svg>
);

const ANALYSIS_PARAM_TO_FIELD: Record<string, keyof CharacterFormData> = {
  'Character Name': 'namaKarakter',
  Gender: 'jenisKelamin',
  Age: 'usia',
  'Ethnicity/Race': 'etnis',
  'Skin Tone': 'warnaKulit',
  'Face Shape': 'bentukWajah',
  'Eye Color': 'warnaMata',
  'Eye Shape': 'bentukMata',
  'Eye Detail (Brows, etc)': 'detailMata',
  'Nose Shape': 'bentukHidung',
  'Lip Shape': 'bentukBibir',
  'Natural Lip Color': 'warnaBibir',
  'Jaw & Chin Shape': 'bentukRahang',
  'Mole/Birthmark (Location)': 'tahiLalat',
  'Scar (Description)': 'bekasLuka',
  'Freckles (Frequency)': 'bintikBintik',
  'Hair Color': 'warnaRambut',
  'Hair Length': 'panjangRambut',
  'Hair Style & Texture': 'gayaRambut',
  'Style Detail (bangs, parting)': 'detailGaya',
  Height: 'tinggiBadan',
  'Body Shape (build)': 'bentukTubuh',
  'Tattoo (Location & Description)': 'tato',
  'Birthmark (Location)': 'tandaLahir',
  'General Clothing Style': 'gayaPakaian',
  Top: 'atasan',
  Bottom: 'bawahan',
  Outerwear: 'outerwear',
  Footwear: 'alasKaki',
  'Dominant Color / Pattern': 'warnaPola',
  Jewelry: 'anting',
  'Glasses/Lenses': 'kacamata',
  Headwear: 'penutupKepala',
  'Other Accessories (Watch, Scarf, Bag)': 'aksesorisTangan',
  'Signature Facial Expression': 'ekspresi',
  'Signature Body Posture': 'postur',
  'Signature Companion Object': 'bendaPendamping',
  'Signature Environment/Background': 'lingkungan',
  'Art Style (Photorealistic, Anime)': 'gayaSeni',
  'Quality & Resolution (8K, Ultra Detail)': 'kualitas',
  'Lighting Type (Cinematic, Golden hour)': 'pencahayaan',
  'Dominant Color Palette': 'paletWarna',
  'Shot Type (Close-up, Full body)': 'tipeShot',
  'Mandatory Negative Prompts': 'promptNegatif',
};

const CHARACTER_ANALYSIS_PARAMETERS: string[] = Object.keys(ANALYSIS_PARAM_TO_FIELD);

const CHARACTER_ANGLE_BATCH_SIZE = 4;

const PROFESSIONAL_ANGLE_DESCRIPTIONS: string[] = [
  // I. Close-Up & Portrait (Fokus pada Emosi & Wajah)
  'CLOSE-UP EYE-LEVEL PORTRAIT. Tight framing on face and upper shoulders, neutral studio background. Shoulders square to camera, chin slightly lowered, piercing eye contact directly into the lens, subtle beauty lighting that highlights eyes and skin texture.',
  'CLOSE-UP HIGH ANGLE (45°). Camera slightly above eye level looking down, making eyes appear larger and face slimmer. Model tilts head up toward the camera, lips gently parted for a relaxed look, soft flattering light on the face.',
  'CLOSE-UP SIDE PROFILE. Clean profile view that emphasizes jawline and nose. Model turns head 90 degrees to the left or right, eyes looking off into the distance (not at camera), background simple and uncluttered.',
  'CLOSE-UP WITH BEAUTY HANDS. Portrait framing with hands gently framing the face. One or both hands softly touching cheek or chin, fingers relaxed (never stiff), expression dreamy and calm, eyes either to camera or slightly off-camera.',

  // II. Medium Shot / Waist Up (Fokus pada Outfit & Gestur)
  'MEDIUM SHOT LOW ANGLE. Framing from waist up, camera placed slightly below chin for a power shot. Model crosses arms over chest or one hand touches the collar of the shirt, chin lifted with a confident, dominant expression.',
  'MEDIUM SHOT 3/4 TURN. Slimming pose. Body turned about 45 degrees away from camera, head turned back toward camera, one shoulder slightly raised (shoulder pop), relaxed arms, showing outfit details clearly.',
  'MEDIUM SHOT OVER THE SHOULDER. Model facing away from camera then looking back over one shoulder. Hair can be swept to one side to reveal neck and jawline, expression elegant and slightly mysterious.',
  'MEDIUM SHOT DUTCH ANGLE. Slight diagonal camera tilt for an edgy, dynamic look. Model leans against a wall with one knee bent against the wall, expression cool or laughing candidly, fashion pose feeling modern and cinematic.',

  // III. Full Body (Fokus pada Siluet & Kaki)
  'FULL BODY FROG EYE / EXTREME LOW ANGLE. Camera very low near the floor pointing up, making legs look longer and more supermodel-like. One leg extended toward the camera, weight on the back leg, both hands on hips for a powerful stance.',
  'FULL BODY WALKING SHOT AT EYE LEVEL. Model walks naturally across the frame or toward the camera. Arms swinging in a relaxed, natural way, hair showing a bit of motion as if moved by wind or fan, expression casual and approachable.',
  'FULL BODY SITTING HIGH ANGLE. Camera slightly above, looking down at a seated pose to feel casual or vulnerable. Model sits on the floor or on a simple chair, knees bent and partially hugged, head tilted up to look toward the camera.',
  'FULL BODY “S” CURVE POSE. Eye-level camera emphasizing feminine curves. Weight heavily on one hip to create an S-shaped silhouette, one hand on the waist, the other lightly touching the hair, expression confident and stylish.',

  // IV. Creative & Artistic (Eksperimental)
  'BIRD’S EYE VIEW FROM DIRECTLY ABOVE. Camera directly overhead. Model lying on the floor or soft surface, hair spread out like a halo around the head, arms posed gracefully, eyes looking straight up at the lens for a graphic, geometric look.',
  'WIDE SHOT WITH NEGATIVE SPACE. Model appears relatively small inside a wide, clean frame. Model stands near one edge of the frame, body language contemplative, looking into the empty space, cinematic and minimal composition.',
  'REFLECTION SHOT IN MIRROR OR GLASS. Camera focuses on the reflection, not the direct subject. Model looks at their own reflection in a mirror or window, hands may lightly touch the surface, background soft, mood introspective and artistic.',
  'BACK SHOT WALKING AWAY. Camera behind the model focusing on the back of the outfit and hair. Model walks away from the camera, one hand holding a hat or bag, no turning back toward the camera at all, emphasizing wardrobe details from behind.',
];

// Extended set for Extend Generate (poses & angles beyond the first 16)
const EXTENDED_ANGLE_DESCRIPTIONS: string[] = [
  // V. Close-Up & Portrait Variants
  'CLOSE-UP LAUGHING CANDID. Tight framing on face and shoulders, eyes slightly squinted from genuine laughter, head tilted back a bit, hair moving slightly as if caught mid-laugh, soft studio light from the side.',
  'CLOSE-UP 3/4 PORTRAIT. Camera at eye level, subject turned about 30 degrees away from camera, eyes looking back toward camera, one eyebrow slightly raised, subtle smirk, background softly blurred.',
  'CLOSE-UP LOOKING OFF-FRAME. Subject framed from shoulders up, gaze directed far to the left or right (off camera), expression thoughtful or dreamy, rim light on hair to separate from background.',
  'CLOSE-UP CHIN REST ON HAND. Face supported by one hand under the chin, elbow resting just out of frame, fingers relaxed, expression calm and introspective, soft beauty lighting from 45 degrees.',

  // VI. Medium Shot Storytelling
  'MEDIUM SHOT LEANING ON TABLE. Framing from waist up, subject leaning slightly forward on a cafe table, both forearms resting casually, one hand holding a cup or prop, expression engaged as if in conversation.',
  'MEDIUM SHOT PHONE SELFIE STYLE. Camera slightly above eye level and close, arm subtly in frame as if holding a phone, playful or flirty expression, background slightly blurred as an indoor lifestyle scene.',
  'MEDIUM SHOT ARMS WIDE OPEN. Body facing camera, arms gently opened outward as if welcoming or presenting something, warm friendly smile, torso centered in frame.',
  'MEDIUM SHOT HANDS IN POCKET. Body turned 30–45 degrees, both hands casually in pockets or one thumb hooked, relaxed posture, subtle weight shift to one leg, expression cool and confident.',

  // VII. Full Body Dynamic
  'FULL BODY JUMPING SHOT. Captured mid-air jump, knees slightly bent, one leg kicked back a bit, arms raised or out to the sides, expression joyful and energetic, camera at eye-level or slightly low.',
  'FULL BODY CROSSING STREET. Subject mid-step in a crosswalk or implied street scene, one foot forward, natural arm swing, head turned slightly to the side, urban background softly blurred.',
  'FULL BODY LEANING ON RAILING. Subject leaning sideways against a railing or ledge, one foot crossed over the other, arms relaxed or lightly gripping the rail, expression calm, environment giving depth.',
  'FULL BODY SITTING SIDEWAYS ON CHAIR. Chair angled sideways to camera, subject sitting with legs to one side, one arm draped over chair back, posture relaxed but elegant.',

  // VIII. Creative & Cinematic
  'HALF-SILHOUETTE BACKLIGHT SHOT. Subject backlit by a bright window or light source, edges of body and hair glowing, face partially in shadow but still readable, cinematic mood.',
  'REFLECTION ON WET FLOOR OR PUDDLE. Camera low, focusing on reflection of the subject standing above a shiny or wet surface, only partial body directly visible, framing emphasizing symmetry.',
  'SHADOW PLAY ON WALL. Strong side light casting an interesting shadow of the subject on the wall, camera framing both the person and their shadow, pose chosen to create an interesting silhouette shape.',
  'CINEMATIC CLOSE BACK PROFILE. Camera behind the subject, framing from shoulders up, subject looking over the horizon or into distance, shallow depth of field with bokeh lights or soft environment.',
];

const PREVIEW_LABELS: string[] = [
  '1 · Close-Up Eye-Level',
  '1 · Close-Up High Angle',
  '1 · Close-Up Side Profile',
  '1 · Close-Up Beauty Hands',
  '2 · Medium Low Angle Power Shot',
  '2 · Medium 3/4 Turn',
  '2 · Medium Over the Shoulder',
  '2 · Medium Dutch Angle',
  '3 · Full Body Frog Eye',
  '3 · Full Body Walking Shot',
  '3 · Full Body Sitting Down',
  '3 · Full Body S Curve',
  '4 · Creative Bird’s Eye',
  '4 · Creative Negative Space',
  '4 · Creative Reflection',
  '4 · Creative Back Shot',
];

// Labels for extended set (EXTENDED_ANGLE_DESCRIPTIONS)
const EXTENDED_PREVIEW_LABELS: string[] = [
  '5 · Close-Up Laughing Candid',
  '5 · Close-Up 3/4 Portrait',
  '5 · Close-Up Looking Off-Frame',
  '5 · Close-Up Chin on Hand',
  '6 · Medium Leaning on Table',
  '6 · Medium Phone Selfie Style',
  '6 · Medium Arms Wide Open',
  '6 · Medium Hands in Pocket',
  '7 · Full Body Jumping Shot',
  '7 · Full Body Crossing Street',
  '7 · Full Body Leaning on Railing',
  '7 · Full Body Sitting Sideways on Chair',
  '8 · Creative Half Silhouette Backlight',
  '8 · Creative Reflection on Wet Floor',
  '8 · Creative Shadow Play on Wall',
  '8 · Creative Cinematic Back Profile',
];

type AngleGroupDef = { id: string; title: string; subtitle: string };

const ANGLE_GROUPS_BASE: AngleGroupDef[] = [
  { id: '1', title: '1 · Close-Up Essentials', subtitle: 'Angles 1–4' },
  { id: '2', title: '2 · Medium Essentials', subtitle: 'Angles 5–8' },
  { id: '3', title: '3 · Full Body Essentials', subtitle: 'Angles 9–12' },
  { id: '4', title: '4 · Creative Essentials', subtitle: 'Angles 13–16' },
  { id: '5', title: '5 · Close-Up Variants', subtitle: 'Angles 17–20' },
  { id: '6', title: '6 · Medium Variants', subtitle: 'Angles 21–24' },
  { id: '7', title: '7 · Full Body Variants', subtitle: 'Angles 25–28' },
  { id: '8', title: '8 · Creative Variants', subtitle: 'Angles 29–32' },
];

const ANGLE_GROUPS_ID: AngleGroupDef[] = [
  { id: '1', title: '1 · Close-Up Dasar', subtitle: 'Sudut 1–4' },
  { id: '2', title: '2 · Medium Dasar', subtitle: 'Sudut 5–8' },
  { id: '3', title: '3 · Full Body Dasar', subtitle: 'Sudut 9–12' },
  { id: '4', title: '4 · Creative Dasar', subtitle: 'Sudut 13–16' },
  { id: '5', title: '5 · Close-Up Variasi', subtitle: 'Sudut 17–20' },
  { id: '6', title: '6 · Medium Variasi', subtitle: 'Sudut 21–24' },
  { id: '7', title: '7 · Full Body Variasi', subtitle: 'Sudut 25–28' },
  { id: '8', title: '8 · Creative Variasi', subtitle: 'Sudut 29–32' },
];

const DEFAULT_ENABLED_ANGLE_GROUPS = Array.from({ length: ANGLE_GROUPS_BASE.length }, () => false);
const MIN_ANGLE_GROUPS = 1;
const MAX_ANGLE_GROUPS = 3;

const getAngleGroupIndex = (index: number): number => {
  if (index < 0) return -1;

  if (index < PREVIEW_LABELS.length) {
    return Math.floor(index / 4);
  }

  const extendedStart = PREVIEW_LABELS.length;
  const extendedEnd = PREVIEW_LABELS.length + EXTENDED_PREVIEW_LABELS.length;
  if (index >= extendedStart && index < extendedEnd) {
    return 4 + Math.floor((index - extendedStart) / 4);
  }

  const baseIndex = index % PREVIEW_LABELS.length;
  return Math.floor(baseIndex / 4);
};

const GenerateCharacterPage: React.FC = () => {
  const loadingGifs = React.useMemo(() => [loadingGif0, loadingGif1, loadingGif2, loadingGif3], []);
  const getLoadingGifByIndex = (index: number) => loadingGifs[index % loadingGifs.length];

  const { t, language } = useLanguage();
  const ANGLE_GROUPS_MS: AngleGroupDef[] = [
    { id: '1', title: '1 · Close-Up Asas', subtitle: 'Sudut 1–4' },
    { id: '2', title: '2 · Medium Asas', subtitle: 'Sudut 5–8' },
    { id: '3', title: '3 · Full Body Asas', subtitle: 'Sudut 9–12' },
    { id: '4', title: '4 · Creative Asas', subtitle: 'Sudut 13–16' },
    { id: '5', title: '5 · Close-Up Variasi', subtitle: 'Sudut 17–20' },
    { id: '6', title: '6 · Medium Variasi', subtitle: 'Sudut 21–24' },
    { id: '7', title: '7 · Full Body Variasi', subtitle: 'Sudut 25–28' },
    { id: '8', title: '8 · Creative Variasi', subtitle: 'Sudut 29–32' },
  ];
  const angleGroups: AngleGroupDef[] = React.useMemo(() => {
    if (language === 'id') return ANGLE_GROUPS_ID;
    if (language === 'ms') return ANGLE_GROUPS_MS;
    return ANGLE_GROUPS_BASE;
  }, [language]);
  const statusNotReadyMessage = t.logMessages.common.statusNotReady;
  const bearerTokenMissingMessage = t.logMessages.common.bearerTokenMissing;
  const engineNotAvailableMessage = t.logMessages.common.engineNotAvailable;
  const outputFolderMissingMessage = t.logMessages.common.folderOutputMissing;
  const apiKeyMissingMessage = t.logMessages.common.apiKeyMissing;
  const authReady = useAuthReady();
  const [formData, setFormData] = useState<CharacterFormData>(initialFormData);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [imageResolution, setImageResolution] = useImageResolution();
  const veoModel = '3.1-fast-low';

  // Calculate fixed card dimensions based on resolution
  const cardDimensions = imageResolution === '1366x768' 
    ? { parameter: 427, preview: 907 }
    : { parameter: 599, preview: 1273 };

  const [enabledAngleGroups, setEnabledAngleGroups] = useState<boolean[]>(DEFAULT_ENABLED_ANGLE_GROUPS);
  const [uploadedImage, setUploadedImage] = useState<UploadedImageFile | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [angleImages, setAngleImages] = useState<(CharacterImageOutput | null)[]>([]);
  const [visibleCardIds, setVisibleCardIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<number>(Date.now());
  const [videoUiByIndex, setVideoUiByIndex] = useState<
    Record<
      number,
      {
        isPlaying: boolean;
        currentTime: number;
        duration: number;
        volume: number;
        muted: boolean;
      }
    >
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisSuccess, setAnalysisSuccess] = useState<boolean>(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [isRegeneratingFailed, setIsRegeneratingFailed] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [nextCharacterAngleIndex, setNextCharacterAngleIndex] = useState<number>(0);
  const [nextExtendedCharacterAngleIndex, setNextExtendedCharacterAngleIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [activityLogCopyLabel, setActivityLogCopyLabel] = useState<string>(t.activityLog.copyLog);
  const [isLogMinimized, setIsLogMinimized] = useState<boolean>(false);

  const [angleVideos, setAngleVideos] = useState<(CharacterAngleVideoOutput | null)[]>([]);
  const [angleViewModes, setAngleViewModes] = useState<CharacterAngleViewMode[]>([]);
  const [videoGeneratingIndexes, setVideoGeneratingIndexes] = useState<number[]>([]);
  const [isBatchVideoRunning, setIsBatchVideoRunning] = useState<boolean>(false);

  const [customVideoPromptsByIndex, setCustomVideoPromptsByIndex] = useState<Record<number, string>>({});
  const [videoPromptModal, setVideoPromptModal] = useState<{
    isOpen: boolean;
    index: number | null;
    draft: string;
  }>({ isOpen: false, index: null, draft: '' });

  React.useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => {
      setError(null);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [error]);

  const isAngleEnabled = useCallback(
    (index: number) => {
      const groupIndex = getAngleGroupIndex(index);
      if (groupIndex < 0) return true;
      return enabledAngleGroups[groupIndex] !== false;
    },
    [enabledAngleGroups],
  );

  // Countdown timer for placeholders
  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-fail timeout - set status ke 'failed' saat countdown habis (v1.2.0+)
  React.useEffect(() => {
    setAngleImages((prev) => {
      let hasChanges = false;
      const next = prev.map((img) => {
        if (!img || img.status !== 'generating') return img;
        if (!img.startedAt || !img.estimatedTotalSeconds) return img;
        
        const elapsed = Math.floor((now - img.startedAt) / 1000);
        if (elapsed > img.estimatedTotalSeconds + 30) { // 30 detik grace period
          hasChanges = true;
          return {
            ...img,
            status: 'failed' as const,
            errorMessage: 'Generation timeout - exceeded estimated time',
          };
        }
        return img;
      });
      return hasChanges ? next : prev;
    });

    setAngleVideos((prev) => {
      let hasChanges = false;
      const next = prev.map((vid) => {
        if (!vid || vid.status !== 'generating') return vid;
        if (!vid.startedAt || !vid.estimatedTotalSeconds) return vid;
        
        const elapsed = Math.floor((now - vid.startedAt) / 1000);
        if (elapsed > vid.estimatedTotalSeconds + 30) { // 30 detik grace period
          hasChanges = true;
          return {
            ...vid,
            status: 'failed' as const,
            errorMessage: 'Video generation timeout - exceeded estimated time',
          };
        }
        return vid;
      });
      return hasChanges ? next : prev;
    });
  }, [now]);

  const getRemainingSecondsForImage = (image: { startedAt?: number; estimatedTotalSeconds?: number } | null): number => {
    if (!image || !image.startedAt || !image.estimatedTotalSeconds) return 0;
    const elapsed = Math.floor((now - image.startedAt) / 1000);
    const remaining = Math.max(0, image.estimatedTotalSeconds - elapsed);
    return remaining;
  };

  const getCountdownMessage = (image: { status?: string; startedAt?: number; estimatedTotalSeconds?: number } | null): string | null => {
    if (!image || image.status !== 'generating') return null;
    const remaining = getRemainingSecondsForImage(image);
    if (remaining <= 0) return null;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.zeoAPI?.onBatchUpdate) return undefined;

    const unsubscribe = window.zeoAPI.onBatchUpdate?.((update: any) => {
      if (!update) return;

      const workflow = (update.workflow || '').toString().toLowerCase();
      const category = (update.category || '').toString().toLowerCase();

      // Handle image generation updates
      if ((workflow.includes('gem_pix') || workflow.includes('affiliate images')) && category === 'character') {
        const message: string = update.message || '';

        if (update.type === 'SCENE_COMPLETED') {
          const sceneIndex: number | null =
            typeof update.index === 'number' && Number.isFinite(update.index) ? update.index : null;
          if (sceneIndex && update.fileName && update.filePath) {
            const angleIndex = sceneIndex - 1;

            setAngleImages((prev) => {
              const next = [...prev];
              if (angleIndex >= 0) {
                if (next.length <= angleIndex) {
                  const oldLength = next.length;
                  next.length = angleIndex + 1;
                  for (let i = oldLength; i < next.length; i += 1) {
                    next[i] = null;
                  }
                }
                const existingImage = next[angleIndex];
                next[angleIndex] = {
                  dataUrl: String(update.filePath),
                  status: 'completed' as const,
                  startedAt: existingImage?.startedAt,
                  estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
                  prompt: existingImage?.prompt,
                };
              }
              return next;
            });

            setRegeneratingIndex((prev) => prev === angleIndex ? null : prev);
          }

          if (message) addLog('SUCCESS', message);
          return;
        }

        if (update.type === 'ERROR' || update.type === 'SCENE_ERROR') {
          const sceneIndex: number | null =
            typeof update.index === 'number' && Number.isFinite(update.index) ? update.index : null;
          if (sceneIndex) {
            const angleIndex = sceneIndex - 1;
            setAngleImages((prev) => {
              const next = [...prev];
              if (angleIndex >= 0 && next[angleIndex]) {
                next[angleIndex] = {
                  ...next[angleIndex]!,
                  status: 'failed' as const,
                  errorMessage: message || 'Generation failed',
                };
              }
              return next;
            });
          }
          if (message) addLog('ERROR', message);
          return;
        }
      }

      // Handle video generation updates
      if (!workflow.includes('affiliate video')) {
        return;
      }

      if (category !== 'character') {
        return;
      }

      const message: string = update.message || '';

      if (update.type === 'INFO' || update.type === 'BATCH_TOTAL' || update.type === 'PROGRESS') {
        if (message) addLog('INFO', message);
        return;
      }

      if (update.type === 'SCENE_COMPLETED') {
        const sceneIndex: number | null =
          typeof update.index === 'number' && Number.isFinite(update.index) ? update.index : null;
        if (sceneIndex && update.fileName && update.filePath) {
          const angleIndex = sceneIndex - 1;

          setAngleVideos((prev) => {
            const next = [...prev];
            if (angleIndex >= 0) {
              if (next.length <= angleIndex) {
                const oldLength = next.length;
                next.length = angleIndex + 1;
                for (let i = oldLength; i < next.length; i += 1) {
                  next[i] = null;
                }
              }
              const existingVideo = next[angleIndex];
              next[angleIndex] = {
                fileName: update.fileName || '',
                filePath: String(update.filePath),
                status: 'completed' as const,
                startedAt: existingVideo?.startedAt,
                estimatedTotalSeconds: existingVideo?.estimatedTotalSeconds,
                prompt: existingVideo?.prompt,
              };
            }
            return next;
          });

          setAngleViewModes((prev) => {
            const next = [...prev];
            if (angleIndex >= 0) {
              if (next.length <= angleIndex) {
                const oldLength = next.length;
                next.length = angleIndex + 1;
                for (let i = oldLength; i < next.length; i += 1) {
                  next[i] = 'photo';
                }
              }
              next[angleIndex] = 'video';
            }
            return next;
          });

          setVideoGeneratingIndexes((prev) => prev.filter((idx) => idx !== angleIndex));
        }

        if (message) addLog('SUCCESS', message);
        return;
      }

      if (update.type === 'BATCH_COMPLETE') {
        if (message) {
          if (typeof update.successCount === 'number' && update.successCount === 0) {
            addLog('ERROR', message);
          } else {
            addLog('SUCCESS', message);
          }
        }
        return;
      }

      if (update.type === 'ERROR' || update.type === 'SCENE_ERROR') {
        const sceneIndex: number | null =
          typeof update.index === 'number' && Number.isFinite(update.index) ? update.index : null;
        if (sceneIndex) {
          const angleIndex = sceneIndex - 1;
          setVideoGeneratingIndexes((prev) => prev.filter((idx) => idx !== angleIndex));
        } else {
          setVideoGeneratingIndexes([]);
        }

        if (message) {
          if (message.includes('PUBLIC_ERROR_AUDIO_FILTERED')) {
            const friendlyMessage = t.characterGenerator.logVideoFilteredError;
            setError(friendlyMessage);
            addLog('ERROR', `${friendlyMessage} Detail: ${message}`);
          } else {
            addLog('ERROR', message);
          }
        }
      }
    });

    return unsubscribe;
  }, []);

  const [characterEditModal, setCharacterEditModal] = useState<CharacterEditModalState>({
    isOpen: false,
    index: null,
    imageUrl: null,
    instruction: '',
    isSubmitting: false,
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const referenceFileInputRef = useRef<HTMLInputElement | null>(null);
  const cardRevealTimeouts = useRef<NodeJS.Timeout[]>([]);
  const videoPreviewRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  const aspectRatios: AspectRatio[] = ['1:1', '16:9', '9:16'];

  const addLog = (type: ActivityLogEntry['type'], message: string) => {
    if (!message) return;
    const prefixedMessage = `[Character] ${message}`;
    setActivityLogs((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        timestamp: new Date().toLocaleTimeString(language === 'en' ? 'en-US' : language === 'ms' ? 'ms-MY' : 'id-ID', { hour12: false }),
        type,
        message: prefixedMessage,
      },
    ]);
  };

  const handleCopyActivityLog = () => {
    if (!activityLogs.length) return;

    const text = activityLogs
      .map((log) => `[${log.timestamp}] [${log.type}] ${log.message}`)
      .join('\n');

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setActivityLogCopyLabel(t.activityLog.copied);
        setTimeout(() => setActivityLogCopyLabel(t.activityLog.copyLog), 1500);
      })
      .catch(() => {
        setActivityLogCopyLabel(t.activityLog.copyLog);
        setTimeout(() => setActivityLogCopyLabel(t.activityLog.copyLog), 1500);
      });
  };

  const runCharacterAnalysis = async (file: File) => {
    try {
      if (typeof window === 'undefined' || !window.zeoAPI?.analyzeCharacterImage) {
        addLog('INFO', engineNotAvailableMessage);
        return;
      }

      const aiProvider = localStorage.getItem('zeoStudio.ai.provider') || '';
      const aiModel = localStorage.getItem('zeoStudio.ai.model') || '';
      const apiKey = localStorage.getItem('zeoStudio.ai.apiKey') || '';

      if (!aiProvider || !apiKey) {
        addLog('INFO', apiKeyMissingMessage);
        return;
      }

      setAnalysisSuccess(false);
      setIsAnalyzing(true);
      addLog('INFO', t.logMessages.character.analysisStarted);

      const imageBase64 = await fileToBase64(file);
      const schemaParameters = CHARACTER_ANALYSIS_PARAMETERS;
      const analysisLanguageHint =
        language === 'en'
          ? 'Return ALL analysis values in English, concise and structured. Do not use Indonesian.'
          : language === 'ms'
          ? 'Balas SEMUA nilai analisis dalam Bahasa Melayu, ringkas dan terstruktur. Jangan gunakan Bahasa Indonesia.'
          : 'Balas SEMUA nilai analisis dalam Bahasa Indonesia yang ringkas dan terstruktur.';

      const result = await window.zeoAPI.analyzeCharacterImage({
        imageBase64,
        mimeType: file.type || 'image/png',
        aiProvider,
        aiModel,
        apiKey,
        schemaParameters,
        language,
        targetLanguage: language,
        analysisLanguageHint,
      });

      if (!result || !result.ok || !result.analysis) {
        const message: string =
          (result && result.error) ||
          t.characterGenerator.logAnalysisFailed;
        addLog('ERROR', message);
        setError(message);
        setAnalysisSuccess(false);
        return;
      }

      const rawAnalysis = result.analysis as Record<string, unknown>;
      const next: Partial<CharacterFormData> = {};

      CHARACTER_ANALYSIS_PARAMETERS.forEach((param) => {
        const field = ANALYSIS_PARAM_TO_FIELD[param];
        if (!field) return;
        const value = rawAnalysis[param];
        if (typeof value === 'string' && value.trim()) {
          (next as any)[field] = value.trim();
        }
      });

      setFormData((prev) => ({ ...prev, ...next }));
      addLog('SUCCESS', t.logMessages.character.analysisSuccess);
      setAnalysisSuccess(true);
    } catch (err: any) {
      const message =
        err?.message || t.characterGenerator.logAnalysisError;
      addLog('ERROR', message);
      setError(message);
      setAnalysisSuccess(false);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedImage({
        file,
        preview: URL.createObjectURL(file),
      });
      runCharacterAnalysis(file);
    }
  };

  const handleClearReferenceImage = () => {
    setUploadedImage(null);
    setAnalysisSuccess(false);
    setIsAnalyzing(false);
    setError(null);
    if (referenceFileInputRef.current) {
      referenceFileInputRef.current.value = '';
    }
    addLog('INFO', t.logMessages.character.photoRemoved);
  };

  const handleRegenerateImage = async (index: number, options?: { bypassGuard?: boolean }) => {
    if (!options?.bypassGuard && (isLoading || regeneratingIndex !== null)) return;

    if (!isAngleEnabled(index)) {
      addLog('INFO', t.logMessages.character.angleDisabled);
      return;
    }

    if (!authReady) {
      setError(statusNotReadyMessage);
      addLog('ERROR', statusNotReadyMessage);
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';

    if (!bearerKey) {
      setError(bearerTokenMissingMessage);
      addLog('ERROR', t.characterGenerator.logRegenBearerMissing.replace('{message}', bearerTokenMissingMessage));
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(engineNotAvailableMessage);
      addLog('ERROR', t.characterGenerator.logRegenEngineNotAvailable.replace('{message}', engineNotAvailableMessage));
      return;
    }

    const mainPrompt = buildCharacterPrompt(formData);
    const anglePrompts = PROFESSIONAL_ANGLE_DESCRIPTIONS;

    const angleIdx = index;
    const baseAngle = anglePrompts[angleIdx] || anglePrompts[0];
    const label = PREVIEW_LABELS[angleIdx] || `professional angle ${angleIdx + 1}`;

    const promptForIndex = `${mainPrompt} IMPORTANT: The person in this image MUST be the exact same character as in the other images, with identical face, skin tone, hairstyle, outfit, and accessories. Do NOT change the identity or clothing at all. Only change the body pose and camera angle. Professional angle ${
      angleIdx + 1
    }: ${baseAngle}.`;

    try {
      setRegeneratingIndex(index);
      
      // Set placeholder dengan status generating dan countdown
      setAngleImages((prev) => {
        const next = [...prev];
        if (angleIdx >= 0 && angleIdx < next.length) {
          next[angleIdx] = {
            dataUrl: prev[angleIdx]?.dataUrl || '',
            status: 'generating' as const,
            startedAt: Date.now(),
            estimatedTotalSeconds: 300,
            prompt: PREVIEW_LABELS[angleIdx] || `Professional angle ${angleIdx + 1}`,
          };
        }
        return next;
      });
      
      addLog('INFO', `${t.logMessages.character.regenerateStarted}: ${label}`);

      const aspectRatioKey = mapAspectRatioToEngineKey(aspectRatio);

      let modelRawBase64List: string[] = [];
      if (uploadedImage) {
        const base64 = await compressImage(uploadedImage.file);
        modelRawBase64List = [base64];
      }

      const response = await window.zeoAPI.generateAffiliateImages({
        bearerKey,
        aspectRatioKey,
        imageResolution,
        items: [{ category: 'ugc', prompt: promptForIndex }],
        references: {
          product: null,
          models: modelRawBase64List,
          additional: [],
        },
      });

      if (!response || !response.ok) {
        const message = response?.error || t.characterGenerator.logEngineRegenInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      const result = results[0];

      if (!result || !result.success || !result.dataUrl) {
        const errMsg: string = result?.error || t.characterGenerator.logEngineRegenFailed;
        setError(errMsg);
        addLog('ERROR', t.characterGenerator.logRegenFailed.replace('{label}', label).replace('{error}', errMsg));
        return;
      }

      const newUrl: string = result.dataUrl;

      setAngleImages((prev) => {
        const next = [...prev];
        if (angleIdx >= 0 && angleIdx < next.length) {
          next[angleIdx] = {
            dataUrl: newUrl,
            status: 'completed' as const,
            startedAt: Date.now(),
            estimatedTotalSeconds: 300,
            prompt: PREVIEW_LABELS[angleIdx] || `Professional angle ${angleIdx + 1}`,
          };
        }
        return next;
      });

      setSelectedPreviewImage(newUrl);
      setLightboxImage(newUrl);
      addLog('SUCCESS', `${t.logMessages.character.regenerateSuccess}: ${label}`);
    } catch (err: any) {
      const message = err?.message || t.characterGenerator.logRegenError;
      setError(message);
      addLog('ERROR', message);
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleDownloadAll = async () => {
    if (!angleImages.length) return;

    const zip = new JSZip();

    const downloadTargets = angleImages
      .map((img, index) => ({ img, index }))
      .filter((item) => item.img?.status === 'completed' && !!item.img.dataUrl);

    if (!downloadTargets.length) return;

    addLog('INFO', t.logMessages.character.zipPreparing);

    // eslint-disable-next-line no-restricted-syntax
    for (const { img, index } of downloadTargets) {
      const url = img!.dataUrl;
      try {
        // Use the same labeling pattern as the grid (angle + set)
        const perBatch = PREVIEW_LABELS.length;
        const batchIndex = Math.floor(index / perBatch);
        const baseIndex = index % perBatch;
        const baseLabel = getAngleLabelByIndex(index);
        const safeLabel = baseLabel
          .replace(/\s+/g, '-')
          .replace(/[^a-zA-Z0-9.-]/g, '')
          .toLowerCase();
        const setSuffix = batchIndex === 0 ? '' : `-set-${batchIndex + 1}`;
        const filename = `character-${safeLabel}${setSuffix}.png`;

        const response = await fetch(url);
        const blob = await response.blob();
        // Store into ZIP without extra compression (STORE mode)
        zip.file(filename, blob, { compression: 'STORE' });
      } catch (err) {
        // If one file fails to fetch, skip and continue
        // eslint-disable-next-line no-continue
        continue;
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const zipUrl = URL.createObjectURL(zipBlob);

    const link = document.createElement('a');
    link.href = zipUrl;
    link.setAttribute('download', 'character-turnaround.zip');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);

    URL.revokeObjectURL(zipUrl);
    addLog('SUCCESS', t.logMessages.character.zipReady);
  };

  const handleRegenerateFailed = async () => {
    if (isLoading || regeneratingIndex !== null) return;

    const failedIndexes: number[] = angleImages
      .map((img, index) => ({ img, index }))
      .filter((item) => isAngleEnabled(item.index) && (!item.img || item.img.status === 'failed' || !item.img.dataUrl))
      .map((item) => item.index)
      .slice(0, 4); // regenerate up to 4 failed items per batch

    if (failedIndexes.length === 0) {
      return;
    }

    setIsRegeneratingFailed(true);
    setIsLoading(true);
    try {
      const BATCH_SIZE = 4;
      for (let i = 0; i < failedIndexes.length; i += BATCH_SIZE) {
        const chunk = failedIndexes.slice(i, i + BATCH_SIZE);
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(chunk.map((idx) => handleRegenerateImage(idx, { bypassGuard: true })));
      }
    } finally {
      setIsLoading(false);
      setRegeneratingIndex(null);
      setIsRegeneratingFailed(false);
    }
  };

  const handleOpenCharacterEditModal = (index: number) => {
    const imageOutput = angleImages[index];
    const src = imageOutput?.dataUrl || '';
    
    if (!src) {
      addLog('ERROR', t.logMessages.character.editOpenFailed);
      return;
    }

    if (!src.startsWith('data:image')) {
      addLog('ERROR', t.characterGenerator.logEditOpenInvalidFormat.replace('{index}', String(index + 1)));
      return;
    }

    setCharacterEditModal({
      isOpen: true,
      index,
      imageUrl: src,
      instruction: '',
      isSubmitting: false,
    });
  };

  const handleCloseCharacterEditModal = () => {
    setCharacterEditModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
  };

  const handleApplyCharacterEdit = async () => {
    if (
      !characterEditModal.imageUrl ||
      characterEditModal.index === null ||
      characterEditModal.index < 0
    ) {
      return;
    }

    if (!authReady) {
      setError(statusNotReadyMessage);
      addLog('ERROR', statusNotReadyMessage);
      return;
    }

    const index = characterEditModal.index;
    const imageUrl = characterEditModal.imageUrl;
    const editInstruction = characterEditModal.instruction.trim();

    if (!editInstruction) {
      addLog('ERROR', t.logMessages.character.editInstructionEmpty);
      return;
    }

    if (!imageUrl.startsWith('data:image')) {
      addLog('ERROR', t.characterGenerator.logEditRunInvalidFormat.replace('{index}', String(index + 1)));
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.editStoryFrame) {
      addLog(
        'ERROR',
        t.characterGenerator.logEditEngineNotAvailable.replace('{index}', String(index + 1)),
      );
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey.trim()) {
      const message = bearerTokenMissingMessage;
      addLog('ERROR', t.characterGenerator.logEditBearerMissing.replace('{index}', String(index + 1)).replace('{message}', message));
      setError(message);
      return;
    }

    const label = getAngleLabelByIndex(index);

    const editInstructionText = `Based on this instruction: "${editInstruction}", edit the following character portrait of the same subject. The result must be a SINGLE, unified character image (no collages, no multiple panels, no UI). CRITICAL RULE: The character's face, skin tone, hairstyle, outfit, and overall identity MUST remain identical to the other character images; only adjust body pose, camera angle, and subtle background details. The final image aspect ratio MUST BE exactly ${aspectRatio}.`;

    setCharacterEditModal((prev) => ({ ...prev, isSubmitting: true, isOpen: false }));
    setEditingIndex(index);
    
    // Set placeholder dengan status generating dan countdown
    setAngleImages((prev) => {
      const next = [...prev];
      if (index >= 0 && index < next.length) {
        next[index] = {
          dataUrl: prev[index]?.dataUrl || '',
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: 300,
          prompt: prev[index]?.prompt || label,
        };
      }
      return next;
    });
    
    addLog('INFO', t.characterGenerator.logEditProcessing.replace('{label}', label));

    try {
      const base64 = imageUrl.split(',')[1] || '';
      const result = await window.zeoAPI.editStoryFrame({
        bearerKey,
        aspectRatio,
        imageResolution,
        instruction: editInstructionText,
        imageBase64: base64,
        mode: 'edit',
      });

      if (!result || !result.ok || !result.dataUrl) {
        const message = (result && result.error) || t.characterGenerator.logNewImageFailed;
        addLog('ERROR', t.characterGenerator.logEditFailed.replace('{label}', label).replace('{error}', message));
        setCharacterEditModal((prev) => ({ ...prev, isSubmitting: false }));
        return;
      }

      const newUrl = result.dataUrl as string;

      setAngleImages((prev) => {
        const next = [...prev];
        if (index >= 0 && index < next.length) {
          const existingImage = next[index];
          next[index] = {
            dataUrl: newUrl,
            status: 'completed' as const,
            startedAt: existingImage?.startedAt,
            estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
            prompt: existingImage?.prompt,
          };
        }
        return next;
      });

      setSelectedPreviewImage(newUrl);
      setLightboxImage(newUrl);
      addLog('SUCCESS', t.characterGenerator.logEditSuccess.replace('{label}', label));
      setCharacterEditModal((prev) => ({ ...prev, isSubmitting: false }));
    } catch (err: any) {
      const message = err?.message || String(err);
      addLog('ERROR', t.characterGenerator.logEditFailed.replace('{label}', label).replace('{error}', message));
      setCharacterEditModal((prev) => ({ ...prev, isSubmitting: false }));
    } finally {
      setEditingIndex(null);
    }
  };

  const handleExtendGenerate = async () => {
    if (isLoading || regeneratingIndex !== null) return;

    if (!authReady) {
      setError(statusNotReadyMessage);
      addLog('ERROR', statusNotReadyMessage);
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';

    if (!bearerKey) {
      setError(bearerTokenMissingMessage);
      addLog('ERROR', t.characterGenerator.logExtendBearerMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(engineNotAvailableMessage);
      addLog('ERROR', t.characterGenerator.logExtendEngineNotAvailable);
      return;
    }

    const mainPrompt = buildCharacterPrompt(formData);

    const totalExtendedAngles = EXTENDED_ANGLE_DESCRIPTIONS.length;
    const totalExtendedBatches = Math.ceil(totalExtendedAngles / CHARACTER_ANGLE_BATCH_SIZE);

    if (nextExtendedCharacterAngleIndex >= totalExtendedAngles) {
      addLog('INFO', t.characterGenerator.logExtendAllDone);
      return;
    }

    const effectiveStartIndex = nextExtendedCharacterAngleIndex;
    const isFirstExtendBatch = effectiveStartIndex === 0;
    const currentExtendBatchIndexLocal =
      Math.floor(effectiveStartIndex / CHARACTER_ANGLE_BATCH_SIZE) + 1;

    setIsLoading(true);
    setError(null);

    addLog(
      'INFO',
      isFirstExtendBatch
        ? t.characterGenerator.logExtendStarting
        : t.characterGenerator.logExtendContinuing.replace('{batch}', String(currentExtendBatchIndexLocal)).replace('{total}', String(totalExtendedBatches)),
    );

    try {
      const aspectRatioKey = mapAspectRatioToEngineKey(aspectRatio);

      const anglePrompts = EXTENDED_ANGLE_DESCRIPTIONS;

      let cursor = effectiveStartIndex >= totalExtendedAngles ? 0 : effectiveStartIndex;
      let batchStart = cursor;
      let batchEnd = Math.min(batchStart + CHARACTER_ANGLE_BATCH_SIZE, totalExtendedAngles);
      let batchIndexDisplay = Math.floor(batchStart / CHARACTER_ANGLE_BATCH_SIZE) + 1;
      let batchTargets: { localIndex: number; globalIndex: number; angleText: string }[] = [];
      let items: { category: 'ugc' | 'broll' | 'commercial'; prompt: string }[] = [];

      while (cursor < totalExtendedAngles) {
        batchStart = cursor;
        batchEnd = Math.min(batchStart + CHARACTER_ANGLE_BATCH_SIZE, totalExtendedAngles);
        batchIndexDisplay = Math.floor(batchStart / CHARACTER_ANGLE_BATCH_SIZE) + 1;

        batchTargets = anglePrompts
          .slice(batchStart, batchEnd)
          .map((angleText, idx) => ({ localIndex: batchStart + idx, angleText }))
          .map(({ localIndex, angleText }) => ({
            localIndex,
            globalIndex: PREVIEW_LABELS.length + localIndex,
            angleText,
          }))
          .filter(({ globalIndex }) => isAngleEnabled(globalIndex));

        items = [];
        batchTargets.forEach(({ localIndex, angleText }) => {
          const labelBase =
            EXTENDED_PREVIEW_LABELS[localIndex] || `Extended angle ${localIndex + 1}`;
          const basePrompt = `${mainPrompt} IMPORTANT: The person in this image MUST be the exact same character as in the other images, with identical face, skin tone, hairstyle, outfit, and accessories. Do NOT change the identity or clothing at all. Only change the body pose and camera angle.`;
          const anglePrompt = `${basePrompt} Advanced angle ${localIndex + 1}: ${angleText}.`;
          items.push({ category: 'ugc', prompt: anglePrompt });
          addLog('INFO', t.characterGenerator.logExtendPreparing.replace('{label}', labelBase));
        });

        if (items.length > 0) break;

        const groupIndex = 4 + Math.floor(batchStart / 4);
        const groupTitle = angleGroups[groupIndex]?.title || `Group ${groupIndex + 1}`;
        addLog(
          'INFO',
          t.characterGenerator.logExtendSkipped.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalExtendedBatches)).replace('{group}', groupTitle),
        );
        cursor = batchEnd;
      }

      if (items.length === 0) {
        addLog('INFO', t.characterGenerator.logExtendNoLabels);
        return;
      }

      {
        const groupIndex = 4 + Math.floor(batchStart / 4);
        const groupTitle = angleGroups[groupIndex]?.title || `Group ${groupIndex + 1}`;
        addLog(
          'INFO',
          t.characterGenerator.logExtendRunning.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalExtendedBatches)).replace('{group}', groupTitle),
        );
      }

      // Create placeholders immediately with loading state
      setAngleImages((prev) => {
        const next = [...prev];
        const globalBatchEnd = PREVIEW_LABELS.length + batchEnd;
        if (next.length < globalBatchEnd) {
          const oldLength = next.length;
          next.length = globalBatchEnd;
          for (let i = oldLength; i < globalBatchEnd; i += 1) {
            next[i] = null;
          }
        }
        
        // Set placeholders for current batch
        batchTargets.forEach(({ localIndex, globalIndex }) => {
          const labelBase = EXTENDED_PREVIEW_LABELS[localIndex] || `Extended angle ${localIndex + 1}`;
          next[globalIndex] = {
            dataUrl: '',
            status: 'generating' as const,
            startedAt: Date.now(),
            estimatedTotalSeconds: 300,
            prompt: labelBase,
          };
        });
        
        return next;
      });
      
      // Schedule sequential card reveal with 2s delay
      batchTargets.forEach((target, idx) => {
        const cardId = `character-image-${target.globalIndex}`;
        const timeout = setTimeout(() => {
          setVisibleCardIds(prevVisible => new Set([...prevVisible, cardId]));
        }, idx * 2000);
        cardRevealTimeouts.current.push(timeout);
      });

      let modelRawBase64List: string[] = [];
      if (uploadedImage) {
        const base64 = await compressImage(uploadedImage.file);
        modelRawBase64List = [base64];
      }

      addLog(
        'INFO',
        t.characterGenerator.logExtendSending.replace('{count}', String(items.length)).replace('{ratio}', aspectRatio).replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalExtendedBatches)),
      );

      const response = await window.zeoAPI.generateAffiliateImages({
        bearerKey,
        aspectRatioKey,
        imageResolution,
        items,
        references: {
          product: null,
          models: modelRawBase64List,
          additional: [],
        },
      });

      if (!response || !response.ok) {
        const message = response?.error || t.characterGenerator.logExtendEngineInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      if (!results.length) {
        throw new Error(t.characterGenerator.logExtendNoResults);
      }

      const batchRequested = items.length;
      const batchReturned = results.length;

      const successLabels: string[] = [];
      let successCount = 0;
      let failedWithErrorCount = 0;

      // Update placeholders with results - ONLY for cards not yet updated by onBatchUpdate
      setAngleImages((prev) => {
        const next = [...prev];
        
        for (let i = 0; i < Math.min(batchReturned, batchRequested); i += 1) {
          const r = results[i];
          const target = batchTargets[i];
          const localIndex = target?.localIndex ?? batchStart + i;
          const globalIndex = target?.globalIndex ?? PREVIEW_LABELS.length + localIndex;
          const labelBase = EXTENDED_PREVIEW_LABELS[localIndex] || `Extended angle ${localIndex + 1}`;
          const label = `${labelBase} · Set 2`;
          const existingImage = next[globalIndex];

          // Skip if already updated by onBatchUpdate
          if (existingImage?.status === 'completed' && existingImage?.dataUrl) {
            successCount += 1;
            successLabels.push(labelBase);
            continue;
          }

          if (r && r.success && r.dataUrl) {
            next[globalIndex] = {
              dataUrl: r.dataUrl,
              status: 'completed' as const,
              startedAt: existingImage?.startedAt,
              estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
              prompt: existingImage?.prompt,
            };
            successCount += 1;
            successLabels.push(labelBase);
          } else if (r) {
            next[globalIndex] = {
              dataUrl: '',
              status: 'failed' as const,
              startedAt: existingImage?.startedAt,
              estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
              prompt: existingImage?.prompt,
              errorMessage: (typeof r.error === 'string' && r.error.trim()) || t.characterGenerator.logEngineFailedLabel,
            };
            failedWithErrorCount += 1;
            const errMsg = next[globalIndex]?.errorMessage || t.characterGenerator.logEngineFailedLabel;
            addLog('ERROR', t.characterGenerator.logExtendFailed.replace('{label}', label).replace('{error}', errMsg));
          }
        }
        
        return next;
      });

      const missingCount = batchRequested > batchReturned ? batchRequested - batchReturned : 0;

      setAngleImages((prev) => {
        const firstBatchIndex = prev.findIndex((img, idx) => {
          const localIdx = idx - PREVIEW_LABELS.length;
          if (localIdx < batchStart || localIdx >= batchEnd) return false;
          if (!isAngleEnabled(idx)) return false;
          return img?.status === 'completed' && !!img.dataUrl;
        });
        if (firstBatchIndex >= 0 && prev[firstBatchIndex]?.dataUrl) {
          setSelectedPreviewImage(prev[firstBatchIndex].dataUrl);
        }
        return prev;
      });

      if (successCount > 0) {
        addLog(
          'SUCCESS',
          t.characterGenerator.logExtendBatchComplete.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalExtendedBatches)).replace('{success}', String(successCount)).replace('{requested}', String(batchRequested)),
        );
        addLog('INFO', t.characterGenerator.logExtendBatchAngles.replace('{labels}', successLabels.join('; ')));
      }

      if (failedWithErrorCount > 0 || missingCount > 0) {
        addLog(
          'INFO',
          t.characterGenerator.logExtendBatchSummary.replace('{batch}', String(batchIndexDisplay)).replace('{requested}', String(batchRequested)).replace('{returned}', String(batchReturned)).replace('{success}', String(successCount)).replace('{failed}', String(failedWithErrorCount)).replace('{missing}', String(missingCount)),
        );
      }

      setNextExtendedCharacterAngleIndex(batchEnd);
    } catch (err: any) {
      const message = err?.message || t.characterGenerator.logExtendError;
      setError(message);
      addLog('ERROR', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = useCallback(async (processAllEnabled: any = false) => {
    const isProcessAll = processAllEnabled === true;
    if (!authReady) {
      setError(statusNotReadyMessage);
      addLog('ERROR', statusNotReadyMessage);
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';

    if (!bearerKey) {
      setError(bearerTokenMissingMessage);
      addLog('ERROR', t.characterGenerator.logGenerateBearerMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(engineNotAvailableMessage);
      addLog('ERROR', t.characterGenerator.logGenerateEngineNotAvailable);
      return;
    }

    const mainPrompt = buildCharacterPrompt(formData);

    const totalAngles = PROFESSIONAL_ANGLE_DESCRIPTIONS.length;
    const totalBatches = Math.ceil(totalAngles / CHARACTER_ANGLE_BATCH_SIZE);

    const effectiveStartIndex =
      nextCharacterAngleIndex >= totalAngles ? 0 : nextCharacterAngleIndex;
    const isFirstBatch = effectiveStartIndex === 0;
    const currentBatchIndex =
      Math.floor(effectiveStartIndex / CHARACTER_ANGLE_BATCH_SIZE) + 1;

    setIsLoading(true);
    setError(null);

    if (isFirstBatch) {
      setGeneratedImage(null);
      setAngleImages([]);
      setAngleVideos([]);
      setAngleViewModes([]);
      setVideoGeneratingIndexes([]);
      setIsBatchVideoRunning(false);
      setActivityLogs([]);
      setSelectedPreviewImage(null);
      setNextCharacterAngleIndex(0);
      setNextExtendedCharacterAngleIndex(0);
      addLog('INFO', t.characterGenerator.logGenerateStarting);
    }

    addLog(
      'INFO',
      isFirstBatch
        ? t.characterGenerator.logGenerateDetermining
        : t.characterGenerator.logGenerateContinuing.replace('{batch}', String(currentBatchIndex)).replace('{total}', String(totalBatches)),
    );

    try {
      const aspectRatioKey = mapAspectRatioToEngineKey(aspectRatio);

      const anglePrompts = PROFESSIONAL_ANGLE_DESCRIPTIONS;

      let cursor = effectiveStartIndex >= totalAngles ? 0 : effectiveStartIndex;
      let batchStart = cursor;
      let batchEnd = Math.min(batchStart + CHARACTER_ANGLE_BATCH_SIZE, totalAngles);
      let batchIndexDisplay = Math.floor(batchStart / CHARACTER_ANGLE_BATCH_SIZE) + 1;
      let batchTargets: { globalIndex: number; angleText: string }[] = [];
      let items: { category: 'ugc' | 'broll' | 'commercial'; prompt: string }[] = [];

      if (isProcessAll) {
        batchStart = 0;
        batchEnd = totalAngles;
        batchIndexDisplay = 1;
        batchTargets = anglePrompts
          .map((angleText, idx) => ({ globalIndex: idx, angleText }))
          .filter(({ globalIndex }) => isAngleEnabled(globalIndex));

        batchTargets.forEach(({ globalIndex, angleText }) => {
          const label = PREVIEW_LABELS[globalIndex] || `Professional angle ${globalIndex + 1}`;
          const anglePrompt = `${mainPrompt} IMPORTANT: The person in this image MUST be the exact same character as in the other images, with identical face, skin tone, hairstyle, outfit, and accessories. Do NOT change the identity or clothing at all. Only change the body pose and camera angle. Professional angle ${
            globalIndex + 1
          }: ${angleText}.`;
          items.push({ category: 'ugc', prompt: anglePrompt });
          addLog('INFO', t.characterGenerator.logGeneratePreparing.replace('{label}', label));
        });
      } else {
        while (cursor < totalAngles) {
          batchStart = cursor;
          batchEnd = Math.min(batchStart + CHARACTER_ANGLE_BATCH_SIZE, totalAngles);
          batchIndexDisplay = Math.floor(batchStart / CHARACTER_ANGLE_BATCH_SIZE) + 1;

          batchTargets = anglePrompts
            .slice(batchStart, batchEnd)
            .map((angleText, idx) => ({ globalIndex: batchStart + idx, angleText }))
            .filter(({ globalIndex }) => isAngleEnabled(globalIndex));

          items = [];
          batchTargets.forEach(({ globalIndex, angleText }) => {
            const label = PREVIEW_LABELS[globalIndex] || `Professional angle ${globalIndex + 1}`;
            const anglePrompt = `${mainPrompt} IMPORTANT: The person in this image MUST be the exact same character as in the other images, with identical face, skin tone, hairstyle, outfit, and accessories. Do NOT change the identity or clothing at all. Only change the body pose and camera angle. Professional angle ${
              globalIndex + 1
            }: ${angleText}.`;
            items.push({ category: 'ugc', prompt: anglePrompt });
            addLog('INFO', t.characterGenerator.logGeneratePreparing.replace('{label}', label));
          });

          if (items.length > 0) break;

          const groupIndex = Math.floor(batchStart / 4);
          const groupTitle = angleGroups[groupIndex]?.title || `Group ${groupIndex + 1}`;
          addLog('INFO', t.characterGenerator.logGenerateSkipped.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)).replace('{group}', groupTitle));
          cursor = batchEnd;
        }
      }

      if (items.length === 0) {
        addLog('INFO', t.characterGenerator.logGenerateNoLabels);
        return;
      }

      {
        const groupIndex = Math.floor(batchStart / 4);
        const groupTitle = angleGroups[groupIndex]?.title || `Group ${groupIndex + 1}`;
        addLog('INFO', t.characterGenerator.logGenerateRunning.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)).replace('{group}', groupTitle));
      }

      let modelRawBase64List: string[] = [];
      if (uploadedImage) {
        const base64 = await compressImage(uploadedImage.file);
        modelRawBase64List = [base64];
      }

      // Create placeholders immediately with loading state
      setAngleImages((prev) => {
        const next = [...prev];
        if (next.length < batchEnd) {
          const oldLength = next.length;
          next.length = batchEnd;
          for (let i = oldLength; i < batchEnd; i += 1) {
            next[i] = null;
          }
        }
        
        // Set placeholders for current batch
        batchTargets.forEach(({ globalIndex, angleText }) => {
          const label = PREVIEW_LABELS[globalIndex] || `Professional angle ${globalIndex + 1}`;
          next[globalIndex] = {
            dataUrl: '',
            status: 'generating' as const,
            startedAt: Date.now(),
            estimatedTotalSeconds: 300,
            prompt: label,
          };
        });
        
        return next;
      });
      
      // Schedule sequential card reveal with 2s delay
      batchTargets.forEach((target, idx) => {
        const cardId = `character-image-${target.globalIndex}`;
        const timeout = setTimeout(() => {
          setVisibleCardIds(prevVisible => new Set([...prevVisible, cardId]));
        }, idx * 2000);
        cardRevealTimeouts.current.push(timeout);
      });

      if (items.length === 0) {
        addLog(
          'INFO',
          t.characterGenerator.logGenerateAllSkipped.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)),
        );
        setNextCharacterAngleIndex(batchEnd);
        return;
      }

      addLog(
        'INFO',
        t.characterGenerator.logGenerateSending.replace('{count}', String(items.length)).replace('{ratio}', aspectRatio).replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)),
      );

      const response = await window.zeoAPI.generateAffiliateImages({
        bearerKey,
        aspectRatioKey,
        imageResolution,
        items,
        references: {
          product: null,
          models: modelRawBase64List,
          additional: [],
        },
      });

      if (!response || !response.ok) {
        const message = response?.error || t.characterGenerator.logGenerateEngineInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      if (!results.length) {
        throw new Error(t.characterGenerator.logGenerateNoResults);
      }

      const batchRequested = items.length;
      const batchReturned = results.length;

      const successLabels: string[] = [];
      let successCount = 0;
      let failedWithErrorCount = 0;

      // Update placeholders with results - ONLY for cards not yet updated by onBatchUpdate
      setAngleImages((prev) => {
        const next = [...prev];
        
        for (let i = 0; i < Math.min(batchReturned, batchRequested); i += 1) {
          const r = results[i];
          const target = batchTargets[i];
          const globalIndex = target?.globalIndex ?? batchStart + i;
          const label = PREVIEW_LABELS[globalIndex] || `Professional angle ${globalIndex + 1}`;
          const existingImage = next[globalIndex];

          // Skip if already updated by onBatchUpdate (status is 'completed')
          if (existingImage?.status === 'completed' && existingImage?.dataUrl) {
            successCount += 1;
            successLabels.push(label);
            continue;
          }

          if (r && r.success && r.dataUrl) {
            next[globalIndex] = {
              dataUrl: r.dataUrl,
              status: 'completed' as const,
              startedAt: existingImage?.startedAt,
              estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
              prompt: existingImage?.prompt,
            };
            successCount += 1;
            successLabels.push(label);
          } else if (r) {
            next[globalIndex] = {
              dataUrl: '',
              status: 'failed' as const,
              startedAt: existingImage?.startedAt,
              estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
              prompt: existingImage?.prompt,
              errorMessage: (typeof r.error === 'string' && r.error.trim()) || t.characterGenerator.logEngineFailedLabel,
            };
            failedWithErrorCount += 1;
            const errMsg = next[globalIndex]?.errorMessage || t.characterGenerator.logEngineFailedLabel;
            addLog('ERROR', t.characterGenerator.logEngineFailed.replace('{label}', label).replace('{error}', errMsg));
          }
        }
        
        return next;
      });

      const missingCount = batchRequested > batchReturned ? batchRequested - batchReturned : 0;

      setAngleImages((prev) => {
        const firstBatchIndex = prev.findIndex((img, idx) => {
          const inRange = idx >= batchStart && idx < batchEnd;
          if (!inRange) return false;
          if (!isAngleEnabled(idx)) return false;
          return img?.status === 'completed' && !!img.dataUrl;
        });
        if (firstBatchIndex >= 0 && prev[firstBatchIndex]?.dataUrl) {
          setSelectedPreviewImage(prev[firstBatchIndex].dataUrl);
        } else if (isFirstBatch) {
          const firstAvailableIndex = prev.findIndex((img) => img?.status === 'completed' && !!img.dataUrl);
          if (firstAvailableIndex >= 0 && prev[firstAvailableIndex]?.dataUrl) {
            setSelectedPreviewImage(prev[firstAvailableIndex].dataUrl);
          }
        }
        return prev;
      });

      const totalSuccessSoFar = successCount;

      if (successCount > 0) {
        addLog(
          'SUCCESS',
          t.characterGenerator.logGenerateBatchComplete.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)).replace('{success}', String(successCount)).replace('{requested}', String(batchRequested)).replace('{totalSuccess}', String(totalSuccessSoFar)).replace('{totalAngles}', String(totalAngles)),
        );
        addLog('INFO', t.characterGenerator.logGenerateBatchAngles.replace('{labels}', successLabels.join('; ')));
      }

      if (failedWithErrorCount > 0 || missingCount > 0) {
        addLog(
          'INFO',
          t.characterGenerator.logGenerateBatchSummary.replace('{batch}', String(batchIndexDisplay)).replace('{requested}', String(batchRequested)).replace('{returned}', String(batchReturned)).replace('{success}', String(successCount)).replace('{failed}', String(failedWithErrorCount)).replace('{missing}', String(missingCount)),
        );
      }

      setNextCharacterAngleIndex(batchEnd);
    } catch (err: any) {
      const message = err?.message || t.characterGenerator.logGenerateError;
      setError(message);
      addLog('ERROR', message);
    } finally {
      setIsLoading(false);
    }
  }, [
    angleImages,
    aspectRatio,
    authReady,
    formData,
    imageResolution,
    isAngleEnabled,
    nextCharacterAngleIndex,
    uploadedImage,
  ]);

  const anyLoading = isLoading;

  const hasAnyMainAngleGroupEnabled = enabledAngleGroups
    .slice(0, 4)
    .some((isEnabled) => isEnabled !== false);
  const hasAnyExtendedAngleGroupEnabled = enabledAngleGroups
    .slice(4)
    .some((isEnabled) => isEnabled !== false);

  const enabledMainAngleGroupCount = enabledAngleGroups
    .slice(0, 4)
    .filter((isEnabled) => isEnabled !== false).length;
  const enabledExtendedAngleGroupCount = enabledAngleGroups
    .slice(4)
    .filter((isEnabled) => isEnabled !== false).length;
  const totalEnabledAngleGroups = enabledMainAngleGroupCount + enabledExtendedAngleGroupCount;
  const hasMoreThanOneLabel = totalEnabledAngleGroups > 1;
  const hasMinAngleGroups = totalEnabledAngleGroups >= MIN_ANGLE_GROUPS;
  const hasMaxAngleGroups = totalEnabledAngleGroups >= MAX_ANGLE_GROUPS;

  const handleGenerateByChecklist = async () => {
    if (anyLoading) return;

    if (hasAnyMainAngleGroupEnabled) {
      await handleGenerate(true);
      return;
    }

    if (hasAnyExtendedAngleGroupEnabled) {
      addLog(
        'INFO',
        t.characterGenerator.logMainLabelsDisabled,
      );
      await handleExtendGenerate();
      return;
    }

    addLog('INFO', t.characterGenerator.logNoAngleLabels);
  };

  const allPreviewImages: (CharacterImageOutput | null)[] = angleImages;
  const hasGeneratedOnce = allPreviewImages.length > 0;
  const successfulImageCount = allPreviewImages.filter((img) => img?.status === 'completed' && !!img.dataUrl).length;

  const visibleAngleEntries = allPreviewImages
    .map((img, index) => ({ img, index }))
    .filter(({ img, index }) => {
      const hasVideo = !!angleVideos[index];
      return isAngleEnabled(index) || (img && (img.status || img.dataUrl)) || hasVideo;
    });

  const totalMainAngles = PREVIEW_LABELS.length;
  const enabledMainAnglesCount = PREVIEW_LABELS.filter((_, idx) => isAngleEnabled(idx)).length;
  const totalMainBatches = enabledMainAnglesCount > 0 ? Math.ceil(enabledMainAnglesCount / CHARACTER_ANGLE_BATCH_SIZE) : 0;
  const hasRemainingEnabledMainAngles = (() => {
    const start = Math.max(0, Math.min(nextCharacterAngleIndex, totalMainAngles));
    for (let i = start; i < totalMainAngles; i += 1) {
      if (isAngleEnabled(i)) return true;
    }
    return false;
  })();
  const canGenerateNextMainBatch =
    hasGeneratedOnce && hasRemainingEnabledMainAngles;
  const nextMainBatchIndex = canGenerateNextMainBatch
    ? Math.floor(nextCharacterAngleIndex / CHARACTER_ANGLE_BATCH_SIZE) + 1
    : totalMainBatches || 1;
  const hasCompletedMainBatches = hasGeneratedOnce && !hasRemainingEnabledMainAngles;

  const totalExtendedAngles = EXTENDED_ANGLE_DESCRIPTIONS.length;
  const totalExtendedBatches = Math.ceil(totalExtendedAngles / CHARACTER_ANGLE_BATCH_SIZE);
  const totalEnabledExtendedBatches = (() => {
    const offset = PREVIEW_LABELS.length;
    let enabledBatchCount = 0;

    for (let batchStart = 0; batchStart < totalExtendedAngles; batchStart += CHARACTER_ANGLE_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + CHARACTER_ANGLE_BATCH_SIZE, totalExtendedAngles);
      let hasEnabledInBatch = false;
      for (let local = batchStart; local < batchEnd; local += 1) {
        if (isAngleEnabled(offset + local)) {
          hasEnabledInBatch = true;
          break;
        }
      }
      if (hasEnabledInBatch) {
        enabledBatchCount += 1;
      }
    }

    return enabledBatchCount || 1;
  })();
  const hasRemainingEnabledExtendedAngles = (() => {
    const start = Math.max(0, Math.min(nextExtendedCharacterAngleIndex, totalExtendedAngles));
    const offset = PREVIEW_LABELS.length;
    for (let local = start; local < totalExtendedAngles; local += 1) {
      if (isAngleEnabled(offset + local)) return true;
    }
    return false;
  })();
  const hasAnyExtendedImage = angleImages.some(
    (img, idx) => idx >= PREVIEW_LABELS.length && img?.status === 'completed' && !!img.dataUrl,
  );
  const hasCompletedExtended =
    !hasAnyExtendedAngleGroupEnabled || (hasAnyExtendedImage && !hasRemainingEnabledExtendedAngles);
  const isExtendInProgress = hasAnyExtendedImage && hasRemainingEnabledExtendedAngles;
  const currentExtendBatchIndex = isExtendInProgress
    ? Math.floor(nextExtendedCharacterAngleIndex / CHARACTER_ANGLE_BATCH_SIZE) + 1
    : totalExtendedBatches;
  const currentExtendBatchIndexUi = (() => {
    const offset = PREVIEW_LABELS.length;
    let uiIndex = 0;

    for (let batchStart = 0; batchStart < totalExtendedAngles; batchStart += CHARACTER_ANGLE_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + CHARACTER_ANGLE_BATCH_SIZE, totalExtendedAngles);
      let hasEnabledInBatch = false;

      for (let local = batchStart; local < batchEnd; local += 1) {
        if (isAngleEnabled(offset + local)) {
          hasEnabledInBatch = true;
          break;
        }
      }

      if (!hasEnabledInBatch) {
        continue;
      }

      uiIndex += 1;

      if (nextExtendedCharacterAngleIndex < batchEnd) {
        return uiIndex;
      }
    }

    return totalEnabledExtendedBatches;
  })();
  const totalEnabledAngleBatchesUi = totalEnabledAngleGroups;
  const currentExtendBatchIndexUiGlobal = enabledMainAngleGroupCount + currentExtendBatchIndexUi;

  const hasFailedAngles = angleImages.some((img, idx) => isAngleEnabled(idx) && img?.status === 'failed');

  const mainPreviewImage: string | null =
    selectedPreviewImage || (allPreviewImages.length > 0 ? allPreviewImages.find((img) => img?.status === 'completed' && !!img.dataUrl)?.dataUrl || null : null);

  const getAngleLabelByIndex = (index: number): string => {
    if (index < 0) return t.characterGenerator.noPhotoYet;
    const perBatch = PREVIEW_LABELS.length;
    const batchIndex = Math.floor(index / perBatch);
    const baseIndex = index % perBatch;

    if (batchIndex === 0) {
      return PREVIEW_LABELS[baseIndex] || `Professional angle ${baseIndex + 1}`;
    }

    if (batchIndex === 1) {
      return EXTENDED_PREVIEW_LABELS[baseIndex] || `Extended angle ${baseIndex + 1}`;
    }

    const fallbackBase =
      EXTENDED_PREVIEW_LABELS[baseIndex] || PREVIEW_LABELS[baseIndex] || `Professional angle ${baseIndex + 1}`;
    return `${fallbackBase} · Set ${batchIndex + 1}`;
  };

  const activeIndex =
    mainPreviewImage && allPreviewImages.length > 0
      ? allPreviewImages.findIndex((img) => img?.dataUrl === mainPreviewImage)
      : -1;

  const activeLabel = getAngleLabelByIndex(activeIndex);

  const thumbnailAspectClass =
    aspectRatio === '1:1'
      ? 'aspect-[1/1]'
      : aspectRatio === '16:9'
      ? 'aspect-[16/9]'
      : aspectRatio === '9:16'
      ? 'aspect-[9/16]'
      : aspectRatio === '4:3'
      ? 'aspect-[4/3]'
      : 'aspect-[3/4]';

  const performFullReset = () => {
    setFormData(initialFormData);
    setAspectRatio('9:16');
    setImageResolution('1366x768');
    setUploadedImage(null);
    setGeneratedImage(null);
    setAngleImages([]);

    setAngleVideos([]);
    setAngleViewModes([]);
    setVideoGeneratingIndexes([]);
    setIsBatchVideoRunning(false);
    setVideoUiByIndex({});

    setIsLoading(false);
    setIsAnalyzing(false);
    setAnalysisSuccess(false);
    setError(null);

    setSelectedPreviewImage(null);
    setIsLightboxOpen(false);
    setLightboxImage(null);

    setRegeneratingIndex(null);
    setIsRegeneratingFailed(false);
    setNextCharacterAngleIndex(0);
    setNextExtendedCharacterAngleIndex(0);

    setCharacterEditModal({
      isOpen: false,
      index: null,
      imageUrl: null,
      instruction: '',
      isSubmitting: false,
    });
    setEditingIndex(null);

    setActivityLogs([]);
    setActivityLogCopyLabel(t.activityLog.copyLog);

    setEnabledAngleGroups([...DEFAULT_ENABLED_ANGLE_GROUPS]);
    setCustomVideoPromptsByIndex({});
    setVideoPromptModal({ isOpen: false, index: null, draft: '' });

    // Clear card reveal timeouts
    cardRevealTimeouts.current.forEach(timeout => clearTimeout(timeout));
    cardRevealTimeouts.current = [];
    setVisibleCardIds(new Set());

    if (referenceFileInputRef.current) {
      referenceFileInputRef.current.value = '';
    }
  };

  const getVideoUiState = (index: number) =>
    videoUiByIndex[index] || {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      muted: false,
    };

  const patchVideoUiState = (
    index: number,
    patch: Partial<{
      isPlaying: boolean;
      currentTime: number;
      duration: number;
      volume: number;
      muted: boolean;
    }>,
  ) => {
    setVideoUiByIndex((prev) => {
      const current =
        prev[index] ||
        ({
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          volume: 1,
          muted: false,
        } as const);

      return {
        ...prev,
        [index]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const pauseOtherVideos = (currentIndex: number) => {
    Object.entries(videoPreviewRefs.current).forEach(([key, el]) => {
      const idx = Number(key);
      const videoEl = el as HTMLVideoElement | null;
      if (idx !== currentIndex && videoEl && !videoEl.paused) {
        videoEl.pause();
        patchVideoUiState(idx, { isPlaying: false });
      }
    });
  };

  const handleToggleVideoPlay = async (index: number) => {
    const videoEl = videoPreviewRefs.current[index];
    if (!videoEl) return;

    try {
      if (videoEl.paused) {
        pauseOtherVideos(index);
        await videoEl.play();
      } else {
        videoEl.pause();
      }
    } catch (error) {
    }
  };

  const handleSeekVideo = (index: number, nextTime: number) => {
    const videoEl = videoPreviewRefs.current[index];
    if (!videoEl) return;
    videoEl.currentTime = nextTime;
    patchVideoUiState(index, { currentTime: nextTime });
  };

  const handleSetVideoVolume = (index: number, nextVolume: number) => {
    const videoEl = videoPreviewRefs.current[index];
    if (!videoEl) return;

    const clamped = Math.max(0, Math.min(1, nextVolume));
    videoEl.volume = clamped;
    if (clamped > 0) {
      videoEl.muted = false;
      patchVideoUiState(index, { volume: clamped, muted: false });
    } else {
      patchVideoUiState(index, { volume: clamped });
    }
  };

  const handleToggleVideoMute = (index: number) => {
    const videoEl = videoPreviewRefs.current[index];
    if (!videoEl) return;
    const nextMuted = !videoEl.muted;
    videoEl.muted = nextMuted;
    patchVideoUiState(index, { muted: nextMuted });
  };

  const buildCharacterVideoPromptForAngle = (index: number): string => {
    const label = getAngleLabelByIndex(index) || `Angle Character ${index + 1}`;
    const settings = getVideoSettingsFromAspectRatio(aspectRatio, veoModel);
    const orientationText =
      settings.aspectRatio === '9:16'
        ? 'vertical 9:16, ideal for Reels/TikTok/Shorts'
        : 'horizontal 16:9, ideal for YouTube or landscape feed';

    const parts: string[] = [];

    parts.push('[Affiliate Video - Character]');
    parts.push(
      'MANDATORY: For the ENTIRE 6–8 second video, the VEO engine must keep the character’s face and body 100% identical to the reference and provided angle photo in EVERY frame: face structure, proportions, age, skin tone, hairstyle, and outfit must not change, morph, or switch to a different person mid-video.',
    );
    parts.push(
      'Video must be a single continuous shot with no cuts or obvious transitions. Motion is limited to subtle camera moves and small natural body movement (breathing, slight gaze shifts, small gestures) with zero outfit changes. ABSOLUTELY NO text, watermark, logo, UI, subtitles, captions, or any writing in the frame.',
    );
    parts.push(`Angle/scene: ${label}.`);
    parts.push(`Orientation: ${orientationText}.`);

    return parts.join(' ');
  };

  const handleOpenVideoPromptModal = (index: number) => {
    setVideoPromptModal({
      isOpen: true,
      index,
      draft: customVideoPromptsByIndex[index] || '',
    });
  };

  const handleCloseVideoPromptModal = () => {
    setVideoPromptModal((prev) => ({ ...prev, isOpen: false, index: null, draft: '' }));
  };

  const handleSaveVideoPromptModal = () => {
    if (videoPromptModal.index === null) return;
    const idx = videoPromptModal.index;
    const nextText = String(videoPromptModal.draft || '').trim();

    setCustomVideoPromptsByIndex((prev) => {
      const next = { ...prev };
      if (!nextText) {
        delete next[idx];
      } else {
        next[idx] = nextText;
      }
      return next;
    });

    setVideoPromptModal({ isOpen: false, index: null, draft: '' });

    // Langsung jalankan generate/regenerate video dengan prompt terbaru
    void handleGenerateAngleVideo(idx, nextText);
  };

  const handleGenerateAngleVideo = async (index: number, overridePrompt?: string) => {
    if (!isAngleEnabled(index)) {
      addLog('INFO', t.characterGenerator.logVideoAngleDisabled.replace('{label}', getAngleLabelByIndex(index)));
      return;
    }

    const imageOutput = angleImages[index];
    const src = imageOutput?.dataUrl || '';
    const label = getAngleLabelByIndex(index) || `Angle ${index + 1}`;

    if (!src) {
      addLog('ERROR', t.characterGenerator.logVideoNoPhoto.replace('{label}', label));
      return;
    }

    if (videoGeneratingIndexes.includes(index)) {
      return;
    }

    if (!src.startsWith('data:image')) {
      addLog(
        'ERROR',
        t.characterGenerator.logVideoInvalidFormat.replace('{label}', label),
      );
      return;
    }

    const parts = src.split(',');
    if (parts.length < 2 || !parts[1].trim()) {
      addLog(
        'ERROR',
        t.characterGenerator.logVideoInvalidData.replace('{label}', label),
      );
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.startAffiliateVideoWorkflow) {
      const message = t.characterGenerator.logVideoEngineNotAvailable;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      const message = t.characterGenerator.logVideoBearerMissing;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const downloadPath = localStorage.getItem('zeoStudio.folder.output') || '';
    if (!downloadPath.trim()) {
      const message = t.characterGenerator.logVideoOutputMissing;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const settings = getVideoSettingsFromAspectRatio(aspectRatio, veoModel);
    const scenePrompt =
      (overridePrompt ?? (customVideoPromptsByIndex[index] || '')).trim() ||
      buildCharacterVideoPromptForAngle(index);
    const base64 = parts[1];

    try {
      setVideoGeneratingIndexes((prev) => (prev.includes(index) ? prev : [...prev, index]));
      
      // Set placeholder dengan status generating dan countdown
      setAngleVideos((prev) => {
        const next = [...prev];
        next[index] = {
          fileName: '',
          filePath: '',
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: 300,
          prompt: scenePrompt,
        };
        return next;
      });
      
      addLog('INFO', t.characterGenerator.logVideoStarting.replace('{label}', label));

      await window.zeoAPI.startAffiliateVideoWorkflow?.({
        bearerKey,
        downloadPath,
        aspectRatio: settings.aspectRatio,
        veoModel: settings.veoModel,
        resolution: settings.resolution,
        scenes: [
          {
            index: index + 1,
            prompt: scenePrompt,
            category: 'character',
            imageBase64: base64,
          },
        ],
        category: 'character',
      });
    } catch (err: any) {
      const message = err?.message || t.characterGenerator.logVideoError;
      setError(message);
      addLog('ERROR', message);
      setVideoGeneratingIndexes((prev) => prev.filter((i) => i !== index));
    }
  };

  const handleGenerateAllVideos = async () => {
    if (isBatchVideoRunning || anyLoading || videoGeneratingIndexes.length > 0) {
      addLog(
        'ERROR',
        t.characterGenerator.logConvertAllBusy,
      );
      return;
    }

    const targets = angleImages
      .map((src, index) => ({ src, index }))
      .filter(({ src, index }) => isAngleEnabled(index) && !!src && !angleVideos[index]);

    if (!targets.length) {
      addLog(
        'INFO',
        t.characterGenerator.logConvertAllNoTargets,
      );
      return;
    }

    const MAX_PARALLEL_VIDEO = 8;

    addLog(
      'INFO',
      t.characterGenerator.logConvertAllStarting.replace('{count}', String(targets.length)).replace('{max}', String(MAX_PARALLEL_VIDEO)),
    );

    try {
      setIsBatchVideoRunning(true);
      for (let i = 0; i < targets.length; i += MAX_PARALLEL_VIDEO) {
        const chunk = targets.slice(i, i + MAX_PARALLEL_VIDEO);
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(
          chunk.map(({ index }) =>
            handleGenerateAngleVideo(index).catch(() => {
              // Per-angle errors are already handled by handleGenerateAngleVideo
            }),
          ),
        );
      }

      addLog(
        'SUCCESS',
        t.characterGenerator.logConvertAllComplete,
      );
    } catch (err: any) {
      const message =
        err?.message ||
        t.characterGenerator.logConvertAllError;
      setError(message);
      addLog('ERROR', message);
    } finally {
      setIsBatchVideoRunning(false);
    }
  };

  const handleFullReset = () => {
    if (anyLoading) return;
    setIsResetConfirmOpen(true);
  };

  const handleConfirmReset = () => {
    setIsResetConfirmOpen(false);
    if (anyLoading) return;
    performFullReset();
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 text-gray-50">
      <PageHeader
        iconId="generate-character"
        iconClassName="h-6 w-6 mr-3 text-white"
        title={t.characterGenerator.title}
        description={t.characterGenerator.description}
        tutorialUrl={CHARACTER_TUTORIAL_URL}
        tutorialTitle="Tutorial Generate Character"
        tutorialMode="direct"
      />

      <div className="flex-1 p-4 lg:p-6 min-h-0 overflow-hidden">
        <div className="flex h-full min-w-0 gap-4">
          <section 
            className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col min-h-0 h-full"
            style={{
              width: `${cardDimensions.parameter}px`,
              backgroundColor: '#181818',
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
              backgroundSize: '12px 12px, 12px 12px, 100% 100%',
              backgroundBlendMode: 'overlay, overlay, normal',
            }}
          >
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <h2 className="text-sm font-semibold text-gray-100 mb-3">
                  {t.characterGenerator.sectionReferencePhoto}
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  {t.characterGenerator.uploadReferencePhotoDesc}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="w-28 h-28 bg-zinc-950 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center text-center text-gray-400 text-[11px] cursor-pointer hover:border-purple-500 transition shrink-0">
                    <label className="w-full h-full flex items-center justify-center cursor-pointer">
                      {uploadedImage ? (
                        <img
                          src={uploadedImage.preview}
                          alt="character reference"
                          className="w-full h-full object-cover rounded-md"
                        />
                      ) : (
                        <span>{t.characterGenerator.clickToUpload}</span>
                      )}
                      <input
                        type="file"
                        ref={referenceFileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                    </label>
                  </div>
                  <div className="flex-grow flex flex-col gap-2 w-full">
                    {uploadedImage && (
                      <button
                        type="button"
                        onClick={handleClearReferenceImage}
                        className="w-full bg-zinc-700 hover:bg-zinc-600 text-white text-xs py-1.5 px-3 rounded-lg transition"
                      >
                        {t.catalogGenerator.deleteCharacterPhoto}
                      </button>
                    )}
                    <div className="text-[11px] text-gray-400">
                      {t.characterGenerator.noPhotoWarning}
                    </div>
                    {isAnalyzing && (
                      <div className="text-[11px] text-purple-300 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                        <span>{t.logMessages.character.analysisStarted}</span>
                      </div>
                    )}
                    {!isAnalyzing && analysisSuccess && (
                      <div className="mt-1 text-[11px] text-emerald-300 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>{t.logMessages.character.analysisSuccess}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <h2 className="text-sm font-semibold text-gray-100">
                  {t.characterGenerator.sectionIdentity}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <LabeledInput
                    label={t.characterGenerator.labelCharacterName}
                    name="namaKarakter"
                    value={formData.namaKarakter}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelGender}
                    name="jenisKelamin"
                    value={formData.jenisKelamin}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelAge}
                    name="usia"
                    value={formData.usia}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelEthnicity}
                    name="etnis"
                    value={formData.etnis}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelSkinColor}
                    name="warnaKulit"
                    value={formData.warnaKulit}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelFaceShape}
                    name="bentukWajah"
                    value={formData.bentukWajah}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelEyeColor}
                    name="warnaMata"
                    value={formData.warnaMata}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelEyeShape}
                    name="bentukMata"
                    value={formData.bentukMata}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelEyeDetail}
                    name="detailMata"
                    value={formData.detailMata}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelNoseShape}
                    name="bentukHidung"
                    value={formData.bentukHidung}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelLipShape}
                    name="bentukBibir"
                    value={formData.bentukBibir}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelLipColor}
                    name="warnaBibir"
                    value={formData.warnaBibir}
                    onChange={handleFormChange as any}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <h2 className="text-sm font-semibold text-gray-100">
                  {t.characterGenerator.sectionHairBody}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <LabeledInput
                    label={t.characterGenerator.labelHairLength}
                    name="panjangRambut"
                    value={formData.panjangRambut}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelHairStyle}
                    name="gayaRambut"
                    value={formData.gayaRambut}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelStyleDetail}
                    name="detailGaya"
                    value={formData.detailGaya}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelHeight}
                    name="tinggiBadan"
                    value={formData.tinggiBadan}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelBodyShape}
                    name="bentukTubuh"
                    value={formData.bentukTubuh}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelTattoo}
                    name="tato"
                    value={formData.tato}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelBirthmark}
                    name="tandaLahir"
                    value={formData.tandaLahir}
                    onChange={handleFormChange as any}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <LabeledInput
                    label={t.characterGenerator.labelClothingStyle}
                    name="gayaPakaian"
                    value={formData.gayaPakaian}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelTop}
                    name="atasan"
                    value={formData.atasan}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelBottom}
                    name="bawahan"
                    value={formData.bawahan}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelOuterwear}
                    name="outerwear"
                    value={formData.outerwear}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelFootwear}
                    name="alasKaki"
                    value={formData.alasKaki}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelColorPattern}
                    name="warnaPola"
                    value={formData.warnaPola}
                    onChange={handleFormChange as any}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <LabeledInput
                    label={t.characterGenerator.labelEarrings}
                    name="anting"
                    value={formData.anting}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelNeckAccessory}
                    name="aksesorisLeher"
                    value={formData.aksesorisLeher}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelHandAccessory}
                    name="aksesorisTangan"
                    value={formData.aksesorisTangan}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelGlasses}
                    name="kacamata"
                    value={formData.kacamata}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelHeadwear}
                    name="penutupKepala"
                    value={formData.penutupKepala}
                    onChange={handleFormChange as any}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <h2 className="text-sm font-semibold text-gray-100">
                  {t.characterGenerator.sectionExpression}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <LabeledInput
                    label={t.characterGenerator.labelExpression}
                    name="ekspresi"
                    value={formData.ekspresi}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelPosture}
                    name="postur"
                    value={formData.postur}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelCompanionObject}
                    name="bendaPendamping"
                    value={formData.bendaPendamping}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelEnvironment}
                    name="lingkungan"
                    value={formData.lingkungan}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelArtStyle}
                    name="gayaSeni"
                    value={formData.gayaSeni}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelQuality}
                    name="kualitas"
                    value={formData.kualitas}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelLighting}
                    name="pencahayaan"
                    value={formData.pencahayaan}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelColorPalette}
                    name="paletWarna"
                    value={formData.paletWarna}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.characterGenerator.labelShotType}
                    name="tipeShot"
                    value={formData.tipeShot}
                    onChange={handleFormChange as any}
                  />
                </div>

                <LabeledTextarea
                  label={t.characterGenerator.labelNegativePrompt}
                  name="promptNegatif"
                  value={formData.promptNegatif}
                  onChange={handleFormChange as any}
                  rows={3}
                />
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <div>
                  <span className="block text-xs font-semibold text-gray-300 mb-2">{t.characterGenerator.aspectRatio}</span>
                  <div className="grid grid-cols-3 gap-2">
                    {aspectRatios.map((ar) => (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => setAspectRatio(ar)}
                        className={`py-1.5 px-3 rounded-lg font-semibold text-xs transition ${
                          aspectRatio === ar
                            ? 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-gray-300'
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>


                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="block text-xs font-semibold text-gray-300">{t.characterGenerator.angleLabel}</span>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setEnabledAngleGroups([...DEFAULT_ENABLED_ANGLE_GROUPS])}
                        className="px-2 py-1 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
                      >
                        {t.productGenerator.selectAll}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEnabledAngleGroups(Array.from({ length: angleGroups.length }, () => false))
                        }
                        className="px-2 py-1 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
                      >
                        {t.productGenerator.clear}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">
                    {t.productGenerator.shotLabelDesc}
                  </p>
                  <div className="text-[10px] mb-2 px-2 py-1.5 rounded-md bg-zinc-800/50 border border-zinc-700/50">
                    <span className={totalEnabledAngleGroups === 0 ? 'text-red-400' : totalEnabledAngleGroups >= MAX_ANGLE_GROUPS ? 'text-emerald-400' : 'text-gray-300'}>
                      {language === 'en' 
                        ? `Selected: ${totalEnabledAngleGroups}/${MAX_ANGLE_GROUPS} labels (min ${MIN_ANGLE_GROUPS}, max ${MAX_ANGLE_GROUPS})`
                        : language === 'ms'
                        ? `Dipilih: ${totalEnabledAngleGroups}/${MAX_ANGLE_GROUPS} label (min ${MIN_ANGLE_GROUPS}, maks ${MAX_ANGLE_GROUPS})`
                        : `Dipilih: ${totalEnabledAngleGroups}/${MAX_ANGLE_GROUPS} label (min ${MIN_ANGLE_GROUPS}, maks ${MAX_ANGLE_GROUPS})`
                      }
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {angleGroups.map((group, idx) => {
                      const isActive = enabledAngleGroups[idx] !== false;
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => {
                            setEnabledAngleGroups((prev) => {
                              const next =
                                prev.length === angleGroups.length ? [...prev] : [...DEFAULT_ENABLED_ANGLE_GROUPS];
                              const currentCount = next.filter(Boolean).length;
                              
                              // Jika ingin enable tapi sudah max, return prev
                              if (!isActive && currentCount >= MAX_ANGLE_GROUPS) {
                                addLog('INFO', language === 'en' 
                                  ? `Maximum ${MAX_ANGLE_GROUPS} labels already selected`
                                  : language === 'ms'
                                  ? `Maksimum ${MAX_ANGLE_GROUPS} label sudah dipilih`
                                  : `Maksimal ${MAX_ANGLE_GROUPS} label sudah dipilih`
                                );
                                return prev;
                              }
                              
                              next[idx] = !isActive;
                              return next;
                            });
                          }}
                          disabled={!isActive && hasMaxAngleGroups}
                          className={`flex items-start justify-start gap-2 px-3 py-2 rounded-lg text-left text-[11px] font-medium border transition-all duration-200
                            bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700
                            ${
                              isActive
                                ? 'text-white border-transparent shadow-lg shadow-purple-500/30 ring-2 ring-purple-200/70'
                                : 'text-white/70 border-purple-500/30 hover:text-white opacity-60'
                            }
                            ${!isActive && hasMaxAngleGroups ? 'opacity-40 cursor-not-allowed' : ''}
                          `}
                          title={`${group.title} · ${group.subtitle}`}
                        >
                          <span
                            className={`mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold ${
                              isActive
                                ? 'border-white/70 bg-white/20 text-white'
                                : 'border-white/40 bg-white/10 text-white/60'
                            }`}
                          >
                            ✓
                          </span>
                          <span className="flex flex-col leading-tight">
                            <span className="text-[11px] font-semibold">{group.title}</span>
                            <span className="text-[10px] text-white/80">{group.subtitle}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>

            <div className="px-6 pb-5 pt-3 border-t border-zinc-800 space-y-3">
              <button
                type="button"
                onClick={handleGenerateByChecklist}
                disabled={anyLoading || !authReady || !hasMinAngleGroups}
                className={`w-full min-h-[48px] px-4 rounded-lg text-white font-semibold text-sm flex items-center justify-center transition-all duration-200 btn-glass-primary
                           focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                           ${
                             anyLoading || !authReady || !hasMinAngleGroups
                               ? 'bg-zinc-600 cursor-not-allowed'
                               : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                           }`}
              >
                {isLoading
                  ? t.characterGenerator.generatingCharacter
                  : authReady
                  ? t.characterGenerator.generateCharacterTurnaround
                  : t.characterGenerator.testTokenFirst}
              </button>

              <div
                className={`vs-activity-log ${isLogMinimized ? 'collapsed' : 'expanded'}`}
              >
                {/* Log header — click to toggle */}
                <div
                  className="vs-activity-log-header"
                  onClick={() => setIsLogMinimized((v) => !v)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsLogMinimized((v) => !v); }}
                  aria-expanded={!isLogMinimized}
                >
                  <div className="flex items-center gap-2">
                    {/* Terminal icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[11px] font-semibold text-white/60">{t.activityLog.title}</span>
                    {activityLogs.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/35 font-medium">
                        {activityLogs.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleCopyActivityLog(); }}
                      disabled={activityLogs.length === 0}
                      className="px-2 py-0.5 rounded-md border border-white/[0.08] text-[9px] text-white/40 hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      {activityLogCopyLabel}
                    </button>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`vs-activity-log-chevron h-3 w-3`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Log body */}
                <div className="vs-activity-log-body">
                  <div className="overflow-y-auto custom-scrollbar space-y-1 p-3" style={{ maxHeight: 200 }}>
                    {activityLogs.length === 0 ? (
                      <p className="text-[10px] text-white/25 italic">{t.characterGenerator.noActivity}</p>
                    ) : (
                      activityLogs.map((log) => (
                        <div key={log.id} className="flex gap-2 items-start">
                          <span className="text-[9px] text-white/25 min-w-[44px] font-mono pt-0.5">{log.timestamp}</span>
                          <span className={`vs-log-badge flex-shrink-0 ${
                            log.type === 'ERROR'   ? 'error'
                            : log.type === 'SUCCESS' ? 'success'
                            : 'info'
                          }`}>{log.type}</span>
                          <span className="text-[10.5px] text-white/65 whitespace-pre-wrap break-words flex-1 leading-relaxed">{log.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section 
            className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col min-h-0 h-full flex-1 min-w-[720px]"
            style={{
              backgroundColor: '#181818',
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
              backgroundSize: '12px 12px, 12px 12px, 100% 100%',
              backgroundBlendMode: 'overlay, overlay, normal',
            }}
          >
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-50">{t.characterGenerator.previewTitle}</h3>
              <button
                type="button"
                onClick={handleFullReset}
                disabled={anyLoading}
                className={`inline-flex items-center px-4 py-2 text-[11px] font-semibold rounded-lg shadow-md transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                  ${
                    anyLoading
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'btn-glass-primary bg-red-600 hover:bg-red-700 text-white'
                  }`}
              >
                <span className="mr-1.5 text-xs">🗑️</span>
                <span>{t.characterGenerator.clearData}</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col px-6 py-4 min-h-0 overflow-y-auto custom-scrollbar">
              {isLoading && !hasGeneratedOnce && (
                <div className="flex-1 flex items-center justify-center">
                  <GradientLoader
                    size="md"
                    text={t.characterGenerator.generatingCharacter}
                    subtitle="Mohon tunggu"
                  />
                </div>
              )}

              {!isLoading && !hasGeneratedOnce && (
                <div className="flex-1 flex items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center text-xs p-4">
                  <p>
                    {t.characterGenerator.previewHint}
                    {' '}
                    <span className="font-semibold text-gray-300">{t.characterGenerator.generateCharacterTurnaround}</span>.
                  </p>
                </div>
              )}

              {!isLoading && hasGeneratedOnce && (
                <div className="mb-3 text-[11px] text-gray-300">
                  <span className="font-semibold text-gray-100">
                    {t.characterGenerator.previewStatsTotal.replace('{count}', String(successfulImageCount))}
                  </span>
                  <span className="mx-1 text-gray-500">·</span>
                  <span className="text-gray-300">
                    {t.characterGenerator.previewStatsAngles
                      .replace('{slots}', String(visibleAngleEntries.length))
                      .replace('{batch}', String(Math.ceil(visibleAngleEntries.length / PREVIEW_LABELS.length)))
                      .replace('{label}', activeLabel)}
                  </span>
                  <p className="text-gray-500 mt-0.5">
                    {t.characterGenerator.gridInstruction}
                  </p>
                </div>
              )}

              {hasGeneratedOnce && (
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-100">{t.characterGenerator.turnaroundTitle}</h4>
                      <p className="text-[10px] text-gray-500">
                        {t.characterGenerator.turnaroundDesc}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleGenerateAllVideos()}
                        disabled={anyLoading || isBatchVideoRunning || videoGeneratingIndexes.length > 0}
                        className="flex items-center gap-2 btn-glass-primary btn-video-gradient text-white font-semibold py-1.5 px-3 min-w-[150px] rounded-lg text-[10px] transition disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="5" width="13" height="14" rx="2" ry="2" />
                          <polygon points="18,9 21,12 18,15" />
                        </svg>
                        <span className="whitespace-nowrap">
                          {isBatchVideoRunning ? t.workflow.status.processing : t.characterGenerator.convertAllToVideo}
                        </span>
                      </button>
                      {canGenerateNextMainBatch && (
                        <button
                          type="button"
                          onClick={handleGenerate}
                          disabled={anyLoading || !authReady}
                          className="flex items-center gap-2 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-1.5 px-3 min-w-[150px] rounded-lg text-[10px] transition disabled:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="whitespace-nowrap">
                            {anyLoading
                              ? t.workflow.status.processing
                              : t.characterGenerator.next4AnglesBatch
                                  .replace('{batch}', String(nextMainBatchIndex))
                                  .replace('{total}', String(totalMainBatches))}
                          </span>
                        </button>
                      )}
                      {hasMoreThanOneLabel &&
                        hasAnyExtendedAngleGroupEnabled &&
                        hasCompletedMainBatches &&
                        !hasCompletedExtended && (
                          <button
                            type="button"
                            onClick={handleExtendGenerate}
                            disabled={anyLoading || !authReady}
                            className="flex items-center gap-2 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-1.5 px-3 min-w-[150px] rounded-lg text-[10px] transition disabled:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                            <span className="whitespace-nowrap">
                              {isLoading
                                ? t.workflow.status.processing
                                : hasAnyExtendedImage
                                ? t.characterGenerator.next4AnglesBatch
                                    .replace('{batch}', String(currentExtendBatchIndexUiGlobal))
                                    .replace('{total}', String(totalEnabledAngleBatchesUi))
                                : t.characterGenerator.continue4AnglesBatch
                                    .replace('{batch}', String(currentExtendBatchIndexUiGlobal))
                                    .replace('{total}', String(totalEnabledAngleBatchesUi))}
                            </span>
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={handleRegenerateFailed}
                        disabled={anyLoading || !hasFailedAngles || !authReady}
                        className="flex items-center gap-2 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-1.5 px-3 min-w-[150px] rounded-lg text-[10px] transition disabled:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0114-7.5M19 5A9 9 0 015 12.5"
                          />
                        </svg>
                        <span className="whitespace-nowrap">
                          {isRegeneratingFailed
                            ? t.workflow.status.processing
                            : t.catalogGenerator.regenerateFailedAngles}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadAll}
                        disabled={!hasCompletedMainBatches}
                        className="flex items-center gap-2 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-1.5 px-3 min-w-[150px] rounded-lg text-[10px] transition disabled:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                          />
                        </svg>
                        <span className="whitespace-nowrap">{t.catalogGenerator.downloadAllImages}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {visibleAngleEntries.map(({ img, index }) => {
                      const label = getAngleLabelByIndex(index);
                      const imageOutput = img;
                      const src = imageOutput?.dataUrl || '';
                      const isImageGenerating = imageOutput?.status === 'generating';
                      const isImageFailed = imageOutput?.status === 'failed';
                      const countdownMsg = getCountdownMessage(imageOutput);

                      const isActive = !!src && mainPreviewImage === src;
                      const isCardRegenerating = regeneratingIndex === index;
                      const isCardEditing = editingIndex === index;
                      const videoOutput = angleVideos[index] || null;
                      const videoUrl = getVideoFileUrl(videoOutput?.filePath || '');
                      const videoUiState = getVideoUiState(index);
                      const viewMode: CharacterAngleViewMode =
                        angleViewModes[index] || (videoOutput ? 'video' : 'photo');
                      const isVideoGenerating = videoGeneratingIndexes.includes(index);
                      const countdownMsgVideo = getCountdownMessage(videoOutput);
                      const isBusy = isCardRegenerating || isCardEditing || isVideoGenerating || isImageGenerating;
                      const cardId = `character-image-${index}`;
                      const isVisible = visibleCardIds.has(cardId);

                      const handleChangeViewMode = (mode: CharacterAngleViewMode) => {
                        if (mode === 'video' && !videoOutput) return;
                        setAngleViewModes((prev) => {
                          const next = [...prev];
                          if (next.length <= index) {
                            const oldLength = next.length;
                            next.length = index + 1;
                            for (let i = oldLength; i < next.length; i += 1) {
                              next[i] = 'photo';
                            }
                          }
                          next[index] = mode;
                          return next;
                        });
                      };

                      return (
                        <div
                          key={index}
                          className={`relative group ${thumbnailAspectClass} cursor-pointer rounded-md overflow-hidden border-2 transition-all duration-700 ease-out ${
                            isActive
                              ? 'border-purple-500'
                              : 'border-blue-500/60 hover:border-blue-400/80'
                          } ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
                          onClick={() => {
                            if (isBusy) return;
                            if (viewMode === 'photo' && src) {
                              setSelectedPreviewImage(src);
                              setLightboxImage(src);
                              setIsLightboxOpen(true);
                            }
                          }}
                        >

                          {viewMode === 'video' && videoUrl ? (
                            <video
                              key={`video-${index}-${videoUrl}`}
                              src={`${videoUrl}#t=0.5`}
                              poster={src}
                              className="w-full h-full object-cover bg-black"
                              loop
                              playsInline
                              preload="metadata"
                              ref={(el) => {
                                videoPreviewRefs.current[index] = el;
                                if (el) {
                                  if (Number.isFinite(videoUiState.volume)) {
                                    el.volume = videoUiState.volume;
                                  }
                                  el.muted = videoUiState.muted;
                                }
                              }}
                              onLoadedMetadata={(event) => {
                                const el = event.currentTarget;
                                patchVideoUiState(index, {
                                  duration: Number.isFinite(el.duration) ? el.duration : 0,
                                  currentTime: el.currentTime || 0,
                                  volume: el.volume,
                                  muted: el.muted,
                                });
                              }}
                              onTimeUpdate={(event) => {
                                const el = event.currentTarget;
                                patchVideoUiState(index, { currentTime: el.currentTime || 0 });
                              }}
                              onPlay={() => {
                                pauseOtherVideos(index);
                                patchVideoUiState(index, { isPlaying: true });
                              }}
                              onPause={() => patchVideoUiState(index, { isPlaying: false })}
                            />
                          ) : isVideoGenerating ? (
                            <div className="w-full h-full relative flex flex-col items-center justify-center text-gray-100">
                              <img
                                src={getLoadingGifByIndex(index)}
                                alt="Loading video"
                                className="absolute inset-0 w-full h-full object-cover opacity-60"
                              />
                              <div className="absolute inset-0 bg-black/60" />
                              <div className="relative z-10 flex flex-col items-center text-center px-3">
                                {countdownMsgVideo && (
                                  <div className="text-sm text-purple-300 font-bold">{countdownMsgVideo}</div>
                                )}
                                <div className="mt-1 text-[10px] text-gray-200 px-2 text-center">
                                  {t.characterGenerator.generateVideoStatus}
                                </div>
                              </div>
                            </div>
                          ) : isImageGenerating ? (
                            <div className="w-full h-full relative flex flex-col items-center justify-center text-gray-100">
                              <img
                                src={getLoadingGifByIndex(index)}
                                alt="Loading image"
                                className="absolute inset-0 w-full h-full object-cover opacity-40"
                              />
                              <div className="absolute inset-0 bg-black/40" />
                              <div className="relative z-10 flex flex-col items-center text-center px-3">
                                {!isCardRegenerating && !isCardEditing && countdownMsg && (
                                  <div className="text-sm text-purple-300 font-bold">{countdownMsg}</div>
                                )}
                                {!isCardRegenerating && !isCardEditing && imageOutput?.prompt && (
                                  <div className="mt-1 text-[10px] text-gray-200 px-2 text-center line-clamp-2">
                                    {imageOutput.prompt}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : isImageFailed ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-red-950/40 text-red-300">
                              <div className="text-2xl mb-2">⚠️</div>
                              <div className="text-xs font-semibold">Failed</div>
                              {imageOutput?.errorMessage && (
                                <div className="mt-1 text-[10px] text-red-400 px-2 text-center">
                                  {imageOutput.errorMessage}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleRegenerateImage(index);
                                }}
                                disabled={!authReady}
                                className="mt-2 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Regenerate
                              </button>
                            </div>
                          ) : imageOutput?.status === 'completed' && src ? (
                            <img src={src} alt={label} className="w-full h-full object-cover" />
                          ) : imageOutput?.status === 'completed' && !src ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-yellow-950/40 text-yellow-300">
                              <div className="text-2xl mb-2">⚠️</div>
                              <div className="text-xs font-semibold">Image data missing</div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleRegenerateImage(index);
                                }}
                                disabled={!authReady}
                                className="mt-2 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Regenerate
                              </button>
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-[10px] text-gray-500">
                              <span>{isBusy ? '' : t.logMessages.character.regenerateFailed}</span>
                            </div>
                          )}

                          <div className="absolute top-1 left-1 right-1 px-2 flex items-center justify-between gap-1 pointer-events-none">
                            <div className="max-w-[60%] px-2 py-0.5 rounded-md bg-black/65 text-[10px] text-gray-100 font-medium truncate">
                              {label}
                            </div>
                            <div className="flex items-center gap-0.5 text-[10px]">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleChangeViewMode('photo');
                                }}
                                className={`px-2.5 py-1 rounded-lg border text-[10px] font-medium pointer-events-auto ${
                                  viewMode === 'photo'
                                    ? 'bg-purple-600 text-white border-purple-500'
                                    : 'bg-black/60 text-gray-200 border-zinc-600 hover:bg-black/80'
                                }`}
                              >
                                {t.characterGenerator.fotoTab}
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleChangeViewMode('video');
                                }}
                                disabled={!videoOutput}
                                className={`px-2.5 py-1 rounded-lg border text-[10px] font-medium pointer-events-auto ${
                                  viewMode === 'video'
                                    ? 'bg-purple-600 text-white border-purple-500'
                                    : 'bg-black/60 text-gray-200 border-zinc-600 hover:bg-black/80'
                                } disabled:opacity-40 disabled:cursor-not-allowed`}
                              >
                                {t.characterGenerator.videoTab}
                              </button>
                            </div>
                          </div>

                          {/* Editing loading state with countdown (same as generating) */}
                          {isCardEditing && isImageGenerating && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
                              <img
                                src={getLoadingGifByIndex(index)}
                                alt="Editing"
                                className="absolute inset-0 w-full h-full object-cover opacity-40"
                              />
                              <div className="absolute inset-0 bg-black/40" />
                              <div className="relative z-10 flex flex-col items-center text-center px-3 text-gray-100">
                                {countdownMsg && (
                                  <div className="text-sm text-purple-300 font-bold">{countdownMsg}</div>
                                )}
                                <div className="mt-1 text-[10px] text-gray-200 px-2 text-center">
                                  Editing...
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Regenerate loading state with countdown (same as generating) */}
                          {isCardRegenerating && isImageGenerating && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
                              <img
                                src={getLoadingGifByIndex(index)}
                                alt="Regenerating"
                                className="absolute inset-0 w-full h-full object-cover opacity-40"
                              />
                              <div className="absolute inset-0 bg-black/40" />
                              <div className="relative z-10 flex flex-col items-center text-center px-3 text-gray-100">
                                {countdownMsg && (
                                  <div className="text-sm text-purple-300 font-bold">{countdownMsg}</div>
                                )}
                                <div className="mt-1 text-[10px] text-gray-200 px-2 text-center">
                                  Regenerasi...
                                </div>
                              </div>
                            </div>
                          )}

                          {!isBusy && !isImageGenerating && imageOutput?.status === 'completed' && src && (
                            <div className="absolute inset-x-1 bottom-1 flex flex-col gap-1">
                              {viewMode === 'photo' && (
                                <div className="w-full flex justify-center">
                                  <div className="inline-flex flex-col items-stretch gap-1">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleOpenCharacterEditModal(index);
                                        }}
                                        disabled={!authReady}
                                        className="px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition"
                                        title={t.characterGenerator.editBtn}
                                      >
                                        {t.characterGenerator.editBtn}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleRegenerateImage(index);
                                        }}
                                        disabled={!authReady}
                                        className="px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition"
                                        title={t.characterGenerator.regenerateBtn}
                                      >
                                        {t.characterGenerator.regenerateBtn}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (src) {
                                            downloadFile(src, `character-angle-${index + 1}.png`);
                                          }
                                        }}
                                        disabled={!src}
                                        className="px-2.5 py-1 bg-gray-700/80 rounded-lg text-white hover:bg-gray-600 transition text-[11px] font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                        title={t.characterGenerator.downloadFoto}
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-3.5 w-3.5"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                                          />
                                        </svg>
                                        <span>{t.characterGenerator.downloadFoto}</span>
                                      </button>
                                    </div>

                                    {!videoOutput && (
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleOpenVideoPromptModal(index);
                                          }}
                                          disabled={!src}
                                          className="flex-1 px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold btn-glass-primary btn-video-gradient transition disabled:opacity-40 disabled:cursor-not-allowed"
                                          title={t.characterGenerator.generateVideoBtn}
                                        >
                                          {t.characterGenerator.generateVideoBtn}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {viewMode === 'video' && (
                                <div className="w-full flex flex-col items-center gap-1">
                                  <div className="w-full rounded-lg bg-black/70 border border-zinc-700/70 px-2 py-1.5 flex items-center gap-1.5 pointer-events-auto">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleToggleVideoPlay(index);
                                  }}
                                  className="h-6 w-6 rounded-md bg-zinc-900/70 hover:bg-zinc-900 text-white flex items-center justify-center transition"
                                  title={videoUiState.isPlaying ? 'Pause' : 'Play'}
                                >
                                  {videoUiState.isPlaying ? (
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                      className="h-4 w-4"
                                    >
                                      <path d="M6 5a1 1 0 011-1h2a1 1 0 011 1v14a1 1 0 01-1 1H7a1 1 0 01-1-1V5zm8 0a1 1 0 011-1h2a1 1 0 011 1v14a1 1 0 01-1 1h-2a1 1 0 01-1-1V5z" />
                                    </svg>
                                  ) : (
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                      className="h-4 w-4"
                                    >
                                      <path d="M8.25 5.25A.75.75 0 019 4.5h.72c.34 0 .67.1.95.28l8.03 5.14a1.5 1.5 0 010 2.52l-8.03 5.14c-.28.18-.61.28-.95.28H9a.75.75 0 01-.75-.75v-12z" />
                                    </svg>
                                  )}
                                </button>

                                <input
                                  type="range"
                                  min={0}
                                  max={Math.max(0, videoUiState.duration || 0)}
                                  step={0.05}
                                  value={Math.min(videoUiState.currentTime || 0, videoUiState.duration || 0)}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => {
                                    event.stopPropagation();
                                    handleSeekVideo(index, Number(event.target.value));
                                  }}
                                  className="flex-1 h-1.5 rounded-lg bg-zinc-700/80 accent-purple-500"
                                  title="Seek"
                                />

                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleToggleVideoMute(index);
                                  }}
                                  className="h-6 w-6 rounded-md bg-zinc-900/70 hover:bg-zinc-900 text-white flex items-center justify-center transition"
                                  title={videoUiState.muted ? 'Unmute' : 'Mute'}
                                >
                                  {videoUiState.muted || (videoUiState.volume || 0) === 0 ? (
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                      className="h-4 w-4"
                                    >
                                      <path d="M16.53 8.47a.75.75 0 011.06 0l1.94 1.94 1.94-1.94a.75.75 0 111.06 1.06l-1.94 1.94 1.94 1.94a.75.75 0 11-1.06 1.06l-1.94-1.94-1.94 1.94a.75.75 0 11-1.06-1.06l1.94-1.94-1.94-1.94a.75.75 0 010-1.06z" />
                                      <path d="M11.36 5.47a.75.75 0 01.79.12l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.28-.53V6a.75.75 0 01.49-.53z" />
                                      <path d="M3 10a1 1 0 011-1h3.25l3.22-2.41a1 1 0 011.53.8v10.22a1 1 0 01-1.53.8L7.25 15H4a1 1 0 01-1-1v-4z" />
                                    </svg>
                                  ) : (
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                      className="h-4 w-4"
                                    >
                                      <path d="M3 10a1 1 0 011-1h3.25l3.22-2.41a1 1 0 011.53.8v10.22a1 1 0 01-1.53.8L7.25 15H4a1 1 0 01-1-1v-4z" />
                                      <path d="M16.5 12a4.5 4.5 0 01-2.09 3.77.75.75 0 11-.82-1.26A3 3 0 0015 12a3 3 0 00-1.41-2.51.75.75 0 11.82-1.26A4.5 4.5 0 0116.5 12z" />
                                      <path d="M19.5 12a7.5 7.5 0 01-3.5 6.31.75.75 0 11-.82-1.26A6 6 0 0018 12a6 6 0 00-2.82-5.05.75.75 0 11.82-1.26A7.5 7.5 0 0119.5 12z" />
                                    </svg>
                                  )}
                                </button>

                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  value={videoUiState.muted ? 0 : videoUiState.volume || 0}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => {
                                    event.stopPropagation();
                                    handleSetVideoVolume(index, Number(event.target.value));
                                  }}
                                  className="w-20 h-1.5 rounded-lg bg-zinc-700/80 accent-purple-500"
                                  title="Volume"
                                />
                              </div>

                              <div className="flex flex-col items-center justify-center gap-1.5 w-full">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenVideoPromptModal(index);
                                  }}
                                  disabled={!src}
                                  className="w-full px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold btn-glass-primary btn-video-gradient transition disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={t.characterGenerator.regenerateVideoBtn}
                                >
                                  {t.characterGenerator.regenerateVideoBtn}
                                </button>

                                {videoOutput && (videoOutput.status === 'completed' || videoOutput.filePath) && (
                                  <div className="w-full px-2 py-1 rounded-md bg-green-900/30 border border-green-700/50 text-center">
                                    <div className="text-[10px] text-green-300 font-medium">
                                      ✓ Video tersimpan otomatis
                                    </div>
                                    <div className="text-[9px] text-green-400/70 mt-0.5">
                                      di folder output global
                                    </div>
                                  </div>
                                )}
                              </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {characterEditModal.isOpen && characterEditModal.imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-gray-100">{t.characterGenerator.editCharacterTitle}</h3>
              <button
                type="button"
                onClick={characterEditModal.isSubmitting ? undefined : handleCloseCharacterEditModal}
                className="text-[18px] text-gray-400 hover:text-gray-100 px-1 disabled:opacity-40"
                disabled={characterEditModal.isSubmitting}
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="w-full bg-zinc-950 rounded-lg overflow-hidden flex items-center justify-center">
                <img
                  src={characterEditModal.imageUrl}
                  alt="Preview Edit Character"
                  className="max-h-[60vh] w-auto max-w-full object-contain"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-gray-200">{t.characterGenerator.editCharacterInstruction}</div>
                <textarea
                  value={characterEditModal.instruction}
                  onChange={(e) =>
                    setCharacterEditModal((prev) => ({
                      ...prev,
                      instruction: e.target.value,
                    }))
                  }
                  placeholder={t.characterGenerator.editCharacterPlaceholder}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 min-h-[96px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="px-4 pb-4 pt-2">
              <button
                type="button"
                onClick={() => void handleApplyCharacterEdit()}
                disabled={characterEditModal.isSubmitting || !authReady}
                className="w-full btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-semibold py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {characterEditModal.isSubmitting ? t.characterGenerator.editCharacterProcessing : t.characterGenerator.editCharacterApply}
              </button>
            </div>
          </div>
        </div>
      )}
      {videoPromptModal.isOpen && videoPromptModal.index !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex flex-col">
                <h3 className="text-sm font-semibold text-gray-100">{t.characterGenerator.videoPromptTitle}</h3>
                <p className="text-[11px] text-gray-500">
                  {getAngleLabelByIndex(videoPromptModal.index)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseVideoPromptModal}
                className="text-[18px] text-gray-400 hover:text-gray-100 px-1"
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-gray-200">{t.characterGenerator.customPromptLabel}</div>
                  <button
                    type="button"
                    onClick={() =>
                      setVideoPromptModal((prev) => ({
                        ...prev,
                        draft: '',
                      }))
                    }
                    className="px-2 py-1 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800"
                  >
                    {t.characterGenerator.clearBtn}
                  </button>
                </div>
                <textarea
                  value={videoPromptModal.draft}
                  onChange={(e) =>
                    setVideoPromptModal((prev) => ({
                      ...prev,
                      draft: e.target.value,
                    }))
                  }
                  placeholder={t.characterGenerator.videoPromptPlaceholder}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-gray-100 px-3 py-2 min-h-[140px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="px-4 pb-4 pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseVideoPromptModal}
                className="px-3 py-2 rounded-lg border border-zinc-600 text-gray-200 hover:bg-zinc-800 text-xs"
              >
                {t.characterGenerator.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleSaveVideoPromptModal}
                className="px-3 py-2 rounded-lg btn-glass-primary btn-video-gradient text-white text-xs font-semibold"
              >
                {t.characterGenerator.generateVideoBtn}
              </button>
            </div>
          </div>
        </div>
      )}
      {isLightboxOpen && lightboxImage && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-auto max-w-[90vw] max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-gray-100">{t.characterGenerator.previewCharacterTitle}</h3>
              <button
                type="button"
                onClick={() => {
                  setIsLightboxOpen(false);
                  setLightboxImage(null);
                }}
                className="text-[18px] text-gray-400 hover:text-gray-100 px-1"
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center overflow-y-auto custom-scrollbar">
              <img
                src={lightboxImage}
                alt="Preview character fullscreen"
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl p-5">
            <h2 className="text-base font-semibold text-gray-50 mb-2">{t.characterGenerator.confirmResetTitle}</h2>
            <div className="space-y-2 text-sm text-gray-200 mb-4">
              <p>
                {t.characterGenerator.confirmResetMessage}
              </p>
              <p className="text-gray-400 text-xs">{t.characterGenerator.confirmResetWarning}</p>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-3 py-1.5 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
              >
                {t.characterGenerator.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {t.characterGenerator.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateCharacterPage;
