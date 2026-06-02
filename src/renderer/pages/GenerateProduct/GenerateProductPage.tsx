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

const PRODUCT_TUTORIAL_URL = 'https://www.youtube.com/embed/Ld1yWug9E08?autoplay=1&mute=1&origin=http://localhost:3000';

type CharacterImageOutput = {
  dataUrl: string;
  status?: 'generating' | 'completed' | 'failed';
  startedAt?: number;
  estimatedTotalSeconds?: number;
  prompt?: string;
  errorMessage?: string;
};

type CharacterAngleVideoOutput = {
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
  // Character-style fields (kept for compatibility with existing prompt logic)
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

  // Product-style fields (ported from previous Generate Product implementation)
  productType: '',
  brandStyle: '',
  mainMaterial: '',
  color: '',
  uniqueDetails: '',
  angle: '',
  focus: '',
  actionState: '',
  background: '',
  secondaryElements: '',
  mood: '',
  lighting: '',
  shadows: '',
  photoStyle: '',
  resolution: '',
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

const buildProductPrompt = (
  data: CharacterFormData,
  aspectRatio: AspectRatio,
  hasReferenceImage: boolean,
): string => {
  const base =
    `${data.resolution} ${data.photoStyle}, captured with a Leica Vario-Elmarit-SL 24-90mm f/2.8-4 ASPH lens, of a ${
      data.productType
    }. ` +
    `Brand Style: ${data.brandStyle}. Material: ${data.mainMaterial}. Color: ${data.color}. ` +
    `Details: ${data.uniqueDetails}. Shot Composition: ${data.angle}, ${data.focus}. The product is ${data.actionState}. ` +
    `Environment: ${data.background}, with ${data.secondaryElements}. Atmosphere: The mood is ${
      data.mood
    }, achieved with ${data.lighting} and ${data.shadows}. `;

  const referenceInstruction = hasReferenceImage
    ? 'IMPORTANT: A reference PRODUCT PHOTO is provided. The product in this image MUST be the exact same physical item as in the reference: identical overall shape and silhouette, identical material and surface texture, identical stitching pattern, identical hardware type and placement (buckles, clasps, zippers, chains), identical straps/handles design, and identical color tone. If there is ANY conflict between the written description and the reference photo, you MUST ALWAYS follow the reference photo as the single source of truth.'
    : 'IMPORTANT: If a reference PRODUCT PHOTO is provided, the product in the generated images must strictly match that reference in shape, material, hardware layout, straps/handles, and color, so that the design stays consistent across all shots.';

  const consistencyInstruction =
    'IMPORTANT: Across ALL photoshoot variations, the product design must NEVER change. Do NOT change the bag model, silhouette, strap type, hardware type, logo placement, embossing, or main color between shots. Only camera angle, framing, distance, and surrounding environment may change.';

  const qualityInstruction =
    `The final image must be clean and professional, with absolutely no text, watermarks, signatures, or logos unless explicitly specified in the details, and must strictly follow the ${aspectRatio} aspect ratio.`;

  const full = `${base} ${referenceInstruction} ${consistencyInstruction} ${qualityInstruction}`;
  return full.replace(/\s+/g, ' ').trim();
};

const buildCharacterPrompt = (data: CharacterFormData): string => {
  const parts: string[] = [];

  let identity = `${data.gayaSeni}, ${data.kualitas} ${data.tipeShot}, captured with a Leica Vario-Elmarit-SL 24-90mm f/2.8-4 ASPH lens, of a`;
  if (data.usia) identity += ` ${data.usia}`;
  if (data.etnis) identity += ` ${data.etnis}`;
  if (data.jenisKelamin) identity += ` ${data.jenisKelamin}`;
  if (data.namaKarakter) identity += ` named ${data.namaKarakter}`;
  parts.push(`${identity}.`);

  const faceDetails = [
    data.bentukWajah && `${data.bentukWajah} face`,
    data.warnaKulit &&
      `${data.warnaKulit} healthy, ultra-clean skin with an even tone and very smooth surface, like professional beauty retouching; keep subtle, realistic micro-texture and tiny pores, but absolutely no acne, pimples, bruntusan, blackheads, cystic acne, inflamed spots, severe blemishes, scars, redness, hyperpigmentation, or any signs of skin disease`,
    data.bentukMata && `${data.bentukMata} shaped ${data.warnaMata} eyes`,
    data.detailMata,
    data.bentukHidung && `${data.bentukHidung} nose`,
    data.bentukBibir && `${data.bentukBibir} ${data.warnaBibir} lips`,
    data.bentukRahang && `${data.bentukRahang} jawline`,
  ]
    .filter(Boolean)
    .join(', ');
  if (faceDetails) parts.push(`She has a ${faceDetails}.`);

  const uniqueFeatures = [data.tahiLalat, data.bekasLuka, data.bintikBintik]
    .filter(Boolean)
    .join(', ');
  if (uniqueFeatures) parts.push(`Unique features include: ${uniqueFeatures}.`);

  const hair = [data.panjangRambut, data.gayaRambut, data.warnaRambut].filter(Boolean).join(' ');
  if (hair) parts.push(`Her hair is ${hair}. ${data.detailGaya || ''}`);

  const body = [
    data.tinggiBadan && `around ${data.tinggiBadan} tall`,
    data.bentukTubuh && `with a ${data.bentukTubuh} build`,
  ]
    .filter(Boolean)
    .join(' ');
  if (body) parts.push(`She is ${body}.`);

  const bodyFeatures = [data.tato, data.tandaLahir].filter(Boolean).join(', ');
  if (bodyFeatures) parts.push(`Body features: ${bodyFeatures}.`);

  parts.push(`Her clothing style is ${data.gayaPakaian}.`);

  const outfit = [
    data.atasan && `wearing a ${data.atasan}`,
    data.bawahan && `a pair of ${data.bawahan}`,
    data.outerwear && `and ${data.outerwear}`,
    data.alasKaki && `with ${data.alasKaki}`,
  ]
    .filter(Boolean)
    .join(', ');
  if (outfit) parts.push(`She is ${outfit}.`);

  if (data.warnaPola) parts.push(`Her outfit has a dominant color palette of ${data.warnaPola}.`);

  const positiveAccessories = [
    data.anting,
    data.aksesorisLeher,
    data.aksesorisTangan,
    data.kacamata,
    data.penutupKepala,
  ].filter(Boolean);
  if (positiveAccessories.length > 0) {
    parts.push(`She accessorizes with ${positiveAccessories.join(', ')}.`);
  } else {
    parts.push('She is wearing no accessories at all.');
  }

  parts.push(`Her typical expression is a ${data.ekspresi} and she has a ${data.postur} posture.`);
  if (data.bendaPendamping) parts.push(`She is often seen with ${data.bendaPendamping}.`);

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

const ProductHeaderIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 mr-3 text-emerald-400"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="7" width="18" height="13" rx="2" ry="2" />
    <path d="M3 11h18" />
    <path d="M8 3h8v4H8z" />
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

// Mapping for automatic PRODUCT analysis (image -> structured fields)
const PRODUCT_ANALYSIS_PARAM_TO_FIELD: Record<string, keyof CharacterFormData> = {
  'Product Type': 'productType',
  'Brand / Style': 'brandStyle',
  'Main Material': 'mainMaterial',
  Color: 'color',
  'Unique Details': 'uniqueDetails',
  Angle: 'angle',
  'Focus & Depth of Field': 'focus',
  'Action / State': 'actionState',
  Background: 'background',
  'Secondary Elements': 'secondaryElements',
  'Mood / Atmosphere': 'mood',
  Lighting: 'lighting',
  Shadows: 'shadows',
  'Photo Style': 'photoStyle',
  'Resolution & Quality': 'resolution',
};

const PRODUCT_ANALYSIS_PARAMETERS: string[] = Object.keys(PRODUCT_ANALYSIS_PARAM_TO_FIELD);

const CHARACTER_ANGLE_BATCH_SIZE = 4;

// Product photoshoot descriptions (main 16 shots)
const PROFESSIONAL_ANGLE_DESCRIPTIONS: string[] = [
  // I. The "Clean" Shots (Catalog & E-Commerce)
  'CLEAN FRONT EYE-LEVEL CATALOG SHOT. Camera at eye level directly facing the front of the product against a simple white or light gray seamless studio background. The goal is to show the true shape of the product without distortion, like an ID photo for the item.',
  'CLEAN 45 DEGREE HERO SHOT. Camera slightly above and rotated around 45 degrees to one side of the product to reveal width, height, and depth in a single view, giving a clear 3D feeling while still looking clean and commercial.',
  'TOP-DOWN FLAT LAY SHOT. Camera placed 90 degrees directly above the product, looking straight down. Ideal for showing packaging layout, contents, or geometric arrangements on a clean, uncluttered surface.',
  'BACK EYE-LEVEL SHOT. Eye-level camera capturing the rear of the product to reveal back details such as labels, ingredients, ports, fasteners, or design elements that are not visible from the front.',

  // II. The "Detail" Shots (Macro & Texture)
  'EXTREME MACRO TEXTURE SHOT. Very close-up view that emphasizes the material texture (leather grain, scrub particles, fabric weave, etc.) with raking side light to clearly show depth and surface quality.',
  'LOGO AND BRANDING CLOSE-UP. Angled close-up with very shallow depth of field so that the brand logo or emblem is tack sharp while the surrounding product and background fall into a smooth bokeh.',
  'HARDWARE OR MECHANISM DETAIL SHOT. Close-up focusing on functional parts such as zippers, buttons, buckles, pump heads, hinges, or camera lenses to highlight build quality and usability.',
  'OPEN PRODUCT CONTENTS SHOT. High-angle shot showing the product opened up to reveal its contents: cream swatches, food cross-sections or bites, inside compartments, or packaging interior.',

  // III. Lifestyle & Context (Scale & Atmosphere)
  'IN-HAND SCALE SHOT. The product being held naturally in a human hand, either from a POV perspective or frontal view, to communicate real-world size and how it feels to hold or use.',
  'ENVIRONMENTAL CONTEXT SHOT. Wider composition placing the product in a realistic scene that fits its use-case (desk setup, street surface, bathroom counter, shelf, etc.) while keeping the product as the clear hero.',
  'GROUP VARIANTS COLLECTION SHOT. Eye-level or top-down image showing multiple colorways, sizes, or a complete set of the product arranged together to suggest a full collection or bundle.',
  'ACTION OR MOTION SHOT. High shutter-speed style shot that freezes dynamic motion around the product, such as water splashing, steam rising, product being sprayed or poured, or subtle movement that suggests real use.',

  // IV. Creative & Editorial (Artistic)
  'LOW-ANGLE MONUMENTAL SHOT. Camera placed below the product looking upward to make a small item (like perfume or lipstick) appear monumental, powerful, and dominant in the frame.',
  'LEVITATION SHOT. The product appears to float in mid-air against a clean background, either suspended by thin supports or composited in post, creating a magical and lightweight feeling.',
  'HARD SHADOW OR SILHOUETTE SHOT. Strong, hard directional light is used to cast dramatic shadows or partial silhouette patterns across and behind the product for a bold graphic look.',
  'REFLECTION SHOT ON MIRROR SURFACE. The product is placed on glossy black glass or an acrylic mirror so that its reflection is clearly visible beneath it, emphasizing symmetry, luxury, and polish.',
];

// Extended set for product Extend Generate (additional 16 shots)
const EXTENDED_ANGLE_DESCRIPTIONS: string[] = [
  'ALTERNATE FRONT HERO SHOT. Camera at a slightly lower angle than the main catalog shot, emphasizing volume and presence with more dramatic studio lighting and subtle vignette.',
  'CLOSE-UP FRONT DETAIL SHOT. Medium-close framing on the front face of the product, highlighting branding, seams, and key design elements in tack-sharp focus against a soft background.',
  'CLEAN SIDE PROFILE SHOT. Eye-level camera directly on the side of the product to reveal depth, thickness, and profile details that are not visible from the front.',
  'TOP 3/4 ANGLE SHOT. Camera positioned above and slightly in front of the product, combining depth with a clear view of the top surface and front branding, ideal for thumbnails.',
  'MATERIAL AND STITCHING MACRO SHOT. Extreme close-up focusing specifically on stitching lines, edge finishing, or seams to showcase craftsmanship and build quality.',
  'CLOSURE OR OPENING MECHANISM SHOT. Close-up of zippers, clasps, lids, or magnetic closures while they are being opened or closed, frozen sharply with shallow depth of field.',
  'INTERIOR ORGANIZATION SHOT. Top-down or high-angle view of the product interior, showing compartments, dividers, and how everyday items fit inside in a clean, organized way.',
  'PACKAGING UNBOXING SHOT. The product partially emerging from its box or packaging with tissue paper or inserts visible, lit cleanly to feel premium and ceremonial.',
  'LIFESTYLE SHOT ON MODEL OR HANDS. The product being carried, worn, or held by a person, framed wider to show how it integrates into an outfit or everyday carry scenario.',
  'DESK OR COUNTERTOP WORKSHOT. Product in use on a realistic surface (desk, vanity, kitchen counter), surrounded by a few carefully chosen props that support the use-case.',
  'MULTI-ANGLE CAROUSEL LAYOUT. Several smaller versions of the product arranged in a single frame, each rotated to a different orientation, mimicking an e-commerce carousel preview.',
  'STACKED OR GROUPED PRODUCTS SHOT. Two or more copies or colorways of the product stacked, lined up, or overlapped to show variety and create a sense of abundance.',
  'HIGH-CONTRAST BACKLIGHT SHOT. Product placed against a bright or glowing background, with rim light around its edges and slightly darker foreground for a dramatic editorial look.',
  'GRAPHIC SHADOW PATTERN SHOT. Strong directional light casting deliberate patterns across the product and background for an artistic, graphic mood.',
  'COLOR-THEMED FLAT LAY SHOT. Top-down arrangement of the product with supporting props that all share a coordinated color palette, creating a cohesive visual story.',
  'MIRRORED ANGLE VARIATION SHOT. Product placed on a reflective surface but framed from a different angle than the main reflection shot, emphasizing symmetry and silhouette in a new way.',
];

// Product shot labels (main 16) - ringkas
const PREVIEW_LABELS: string[] = [
  '1 · Clean · Front Eye-Level',
  '1 · Clean · 45° Hero',
  '1 · Clean · Top-Down',
  '1 · Clean · Back View',
  '2 · Detail · Texture Macro',
  '2 · Detail · Logo Focus',
  '2 · Detail · Hardware',
  '2 · Detail · Open Contents',
  '3 · Lifestyle · In-Hand',
  '3 · Lifestyle · Environmental',
  '3 · Lifestyle · Group Variants',
  '3 · Lifestyle · Action/Motion',
  '4 · Creative · Low Angle',
  '4 · Creative · Levitation',
  '4 · Creative · Hard Shadow',
  '4 · Creative · Reflection',
];

// Extended shot labels (16) - ringkas
const EXTENDED_PREVIEW_LABELS: string[] = [
  '5 · Clean · Alt Front Hero',
  '5 · Clean · Front Detail',
  '5 · Clean · Side Profile',
  '5 · Clean · Top 3/4',
  '6 · Detail · Stitching Macro',
  '6 · Detail · Closure',
  '6 · Detail · Interior Layout',
  '6 · Detail · Unboxing',
  '7 · Lifestyle · On Model/Hand',
  '7 · Lifestyle · Work Surface',
  '7 · Lifestyle · Carousel',
  '7 · Lifestyle · Stacked',
  '8 · Creative · Backlight',
  '8 · Creative · Shadow Pattern',
  '8 · Creative · Color Flat Lay',
  '8 · Creative · Mirrored Angle',
];

type AngleGroupDef = { id: string; title: string; subtitle: string };

// Angle groups follow the same naming pattern as Generate Character: numeric IDs with Essentials/Variants
const ANGLE_GROUPS_BASE: AngleGroupDef[] = [
  { id: '1', title: '1 · Clean Essentials', subtitle: 'Shots 1–4' },
  { id: '2', title: '2 · Detail Essentials', subtitle: 'Shots 5–8' },
  { id: '3', title: '3 · Lifestyle Essentials', subtitle: 'Shots 9–12' },
  { id: '4', title: '4 · Creative Essentials', subtitle: 'Shots 13–16' },
  { id: '5', title: '5 · Clean Variants', subtitle: 'Shots 17–20' },
  { id: '6', title: '6 · Detail Variants', subtitle: 'Shots 21–24' },
  { id: '7', title: '7 · Lifestyle Variants', subtitle: 'Shots 25–28' },
  { id: '8', title: '8 · Creative Variants', subtitle: 'Shots 29–32' },
];

const ANGLE_GROUPS_ID: AngleGroupDef[] = [
  { id: '1', title: '1 · Clean Dasar', subtitle: 'Sudut 1–4' },
  { id: '2', title: '2 · Detail Dasar', subtitle: 'Sudut 5–8' },
  { id: '3', title: '3 · Lifestyle Dasar', subtitle: 'Sudut 9–12' },
  { id: '4', title: '4 · Creative Dasar', subtitle: 'Sudut 13–16' },
  { id: '5', title: '5 · Clean Variasi', subtitle: 'Sudut 17–20' },
  { id: '6', title: '6 · Detail Variasi', subtitle: 'Sudut 21–24' },
  { id: '7', title: '7 · Lifestyle Variasi', subtitle: 'Sudut 25–28' },
  { id: '8', title: '8 · Creative Variasi', subtitle: 'Sudut 29–32' },
];

const ANGLE_GROUPS_MS: AngleGroupDef[] = [
  { id: '1', title: '1 · Clean Asas', subtitle: 'Sudut 1–4' },
  { id: '2', title: '2 · Detail Asas', subtitle: 'Sudut 5–8' },
  { id: '3', title: '3 · Lifestyle Asas', subtitle: 'Sudut 9–12' },
  { id: '4', title: '4 · Creative Asas', subtitle: 'Sudut 13–16' },
  { id: '5', title: '5 · Clean Variasi', subtitle: 'Sudut 17–20' },
  { id: '6', title: '6 · Detail Variasi', subtitle: 'Sudut 21–24' },
  { id: '7', title: '7 · Lifestyle Variasi', subtitle: 'Sudut 25–28' },
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

const GenerateProductPage: React.FC = () => {
  const loadingGifs = React.useMemo(() => [loadingGif0, loadingGif1, loadingGif2, loadingGif3], []);
  const getLoadingGifByIndex = (index: number) => loadingGifs[index % loadingGifs.length];

  const { t, language } = useLanguage();
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

  // Countdown timer state (v1.2.0+)
  const [now, setNow] = useState<number>(Date.now());
  const [visibleCardIds, setVisibleCardIds] = useState<Set<string>>(new Set());
  const cardRevealTimeouts = useRef<NodeJS.Timeout[]>([]);

  // Update timer setiap detik
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

  // Countdown timer helper functions (v1.2.0+)
  const getRemainingSecondsForImage = useCallback(
    (image: CharacterImageOutput | null): number => {
      if (!image || !image.startedAt || !image.estimatedTotalSeconds) return 0;
      const elapsed = Math.floor((now - image.startedAt) / 1000);
      const remaining = Math.max(0, image.estimatedTotalSeconds - elapsed);
      return remaining;
    },
    [now],
  );

  const getCountdownMessage = useCallback(
    (image: CharacterImageOutput | null): string | null => {
      if (!image || image.status !== 'generating') return null;
      const remaining = getRemainingSecondsForImage(image);
      if (remaining <= 0) return null;
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },
    [getRemainingSecondsForImage],
  );

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.zeoAPI?.onBatchUpdate) return undefined;

    const unsubscribe = window.zeoAPI.onBatchUpdate?.((update: any) => {
      if (!update) return;

      const workflow = (update.workflow || '').toString().toLowerCase();
      if (!workflow.includes('affiliate video')) {
        return;
      }

      const category = (update.category || '').toString().toLowerCase();
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
                dataUrl: String(update.filePath),
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
            const friendlyMessage = t.productGenerator.logVideoFilteredError;
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
  const videoPreviewRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  const aspectRatios: AspectRatio[] = ['1:1', '16:9', '9:16'];

  const addLog = (type: ActivityLogEntry['type'], message: string) => {
    if (!message) return;
    const prefixedMessage = `[Product] ${message}`;
    const tsLocale = language === 'ms' ? 'ms-MY' : language === 'id' ? 'id-ID' : 'en-US';
    setActivityLogs((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        timestamp: new Date().toLocaleTimeString(tsLocale, { hour12: false }),
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
        setActivityLogCopyLabel(t.activityLog.failed);
        setTimeout(() => setActivityLogCopyLabel(t.activityLog.copyLog), 1500);
      });
  };

  const runProductAnalysis = async (file: File) => {
    try {
      if (typeof window === 'undefined' || !window.zeoAPI?.analyzeCharacterImage) {
        addLog(
          'INFO',
          t.productGenerator.logAnalysisSkippedEngine,
        );
        return;
      }

      const aiProvider = localStorage.getItem('zeoStudio.ai.provider') || '';
      const aiModel = localStorage.getItem('zeoStudio.ai.model') || '';
      const apiKey = localStorage.getItem('zeoStudio.ai.apiKey') || '';

      if (!aiProvider || !apiKey) {
        addLog(
          'INFO',
          t.productGenerator.logAnalysisSkippedConfig,
        );
        return;
      }

      setAnalysisSuccess(false);
      setIsAnalyzing(true);
      addLog('INFO', t.productGenerator.logAnalysisStarting);

      const imageBase64 = await fileToBase64(file);
      const schemaParameters = PRODUCT_ANALYSIS_PARAMETERS;

      const result = await window.zeoAPI.analyzeCharacterImage({
        imageBase64,
        mimeType: file.type || 'image/png',
        aiProvider,
        aiModel,
        apiKey,
        schemaParameters,
      });

      if (!result || !result.ok || !result.analysis) {
        const message: string =
          (result && result.error) ||
          t.productGenerator.logAnalysisFailed;
        addLog('ERROR', message);
        setError(message);
        setAnalysisSuccess(false);
        return;
      }

      const rawAnalysis = result.analysis as Record<string, unknown>;
      const next: Partial<CharacterFormData> = {};

      PRODUCT_ANALYSIS_PARAMETERS.forEach((param) => {
        const field = PRODUCT_ANALYSIS_PARAM_TO_FIELD[param];
        if (!field) return;
        const value = rawAnalysis[param];
        if (typeof value === 'string' && value.trim()) {
          (next as any)[field] = value.trim();
        }
      });

      setFormData((prev) => ({ ...prev, ...next }));
      addLog(
        'SUCCESS',
        t.productGenerator.logAnalysisSuccess,
      );
      setAnalysisSuccess(true);
    } catch (err: any) {
      const message =
        err?.message || t.productGenerator.logAnalysisError;
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
      setAnalysisSuccess(false);
      setIsAnalyzing(false);
      addLog(
        'INFO',
        t.productGenerator.logReferenceUploaded,
      );
      void runProductAnalysis(file);
    }
  };

  const handleClearReferenceImage = () => {
    setUploadedImage(null);
    setError(null);
    setAnalysisSuccess(false);
    setIsAnalyzing(false);
    if (referenceFileInputRef.current) {
      referenceFileInputRef.current.value = '';
    }
    addLog(
      'INFO',
      t.productGenerator.logReferenceRemoved,
    );
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
      addLog('ERROR', t.productGenerator.logRegenBearerMissing.replace('{message}', bearerTokenMissingMessage));
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(engineNotAvailableMessage);
      addLog('ERROR', t.productGenerator.logRegenEngineNotAvailable.replace('{message}', engineNotAvailableMessage));
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
      
      // Set placeholder dengan status generating dan countdown SEBELUM API call
      setAngleImages((prev) => {
        const next = [...prev];
        if (angleIdx >= 0 && angleIdx < next.length) {
          next[angleIdx] = {
            dataUrl: prev[angleIdx]?.dataUrl || '',
            status: 'generating' as const,
            startedAt: Date.now(),
            estimatedTotalSeconds: 300,
            prompt: prev[angleIdx]?.prompt || label,
          };
        }
        return next;
      });
      
      addLog('INFO', `${t.logMessages.character.regenerateStarted}: ${label}`);

      const aspectRatioKey = mapAspectRatioToEngineKey(aspectRatio);

      let modelRawBase64List: string[] = [];
      if (uploadedImage) {
        const base64 = await fileToBase64(uploadedImage.file);
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
        const message = response?.error || t.productGenerator.logEngineRegenInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      const result = results[0];

      if (!result || !result.success || !result.dataUrl) {
        const errMsg: string = result?.error || t.productGenerator.logEngineRegenFailed;
        setError(errMsg);
        addLog('ERROR', t.productGenerator.logRegenFailed.replace('{label}', label).replace('{error}', errMsg));
        return;
      }

      const newUrl: string = result.dataUrl;

      setAngleImages((prev) => {
        const next = [...prev];
        if (angleIdx >= 0 && angleIdx < next.length) {
          const existingImage = next[angleIdx];
          next[angleIdx] = {
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
      addLog('SUCCESS', `${t.logMessages.character.regenerateSuccess}: ${label}`);
    } catch (err: any) {
      const message = err?.message || t.productGenerator.logRegenError;
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
      .filter((item) => !!item.img?.dataUrl);

    if (!downloadTargets.length) return;

    addLog('INFO', t.logMessages.product.zipPreparing);

    // eslint-disable-next-line no-restricted-syntax
    for (const { img, index } of downloadTargets) {
      const url = img?.dataUrl || '';
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
        const filename = `product-${safeLabel}${setSuffix}.png`;

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
    link.setAttribute('download', 'product-gallery.zip');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);

    URL.revokeObjectURL(zipUrl);
    addLog('SUCCESS', t.logMessages.product.zipReady);
  };

  const handleRegenerateFailed = async () => {
    if (isLoading || regeneratingIndex !== null) return;

    const failedIndexes: number[] = angleImages
      .map((src, index) => ({ src, index }))
      .filter((item) => isAngleEnabled(item.index) && !item.src)
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
      addLog('ERROR', t.productGenerator.logEditOpenInvalidFormat.replace('{index}', String(index + 1)));
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
      addLog('ERROR', t.productGenerator.logEditRunInvalidFormat.replace('{index}', String(index + 1)));
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.editStoryFrame) {
      addLog(
        'ERROR',
        t.productGenerator.logEditEngineNotAvailable.replace('{index}', String(index + 1)),
      );
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey.trim()) {
      const message = bearerTokenMissingMessage;
      addLog('ERROR', t.productGenerator.logEditBearerMissing.replace('{index}', String(index + 1)).replace('{message}', message));
      setError(message);
      return;
    }

    const label = getAngleLabelByIndex(index);

    const editInstructionText = `Based on this instruction: "${editInstruction}", edit the following character portrait of the same subject. The result must be a SINGLE, unified character image (no collages, no multiple panels, no UI). CRITICAL RULE: The character's face, skin tone, hairstyle, outfit, and overall identity MUST remain identical to the other character images; only adjust body pose, camera angle, and subtle background details. The final image aspect ratio MUST BE exactly ${aspectRatio}.`;

    setCharacterEditModal((prev) => ({ ...prev, isSubmitting: true, isOpen: false }));
    setEditingIndex(index);
    
    // Set placeholder dengan status generating dan countdown SEBELUM API call
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
    
    addLog('INFO', t.productGenerator.logEditProcessing.replace('{label}', label));

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
        const message = (result && result.error) || t.productGenerator.logNewImageFailed;
        addLog('ERROR', t.productGenerator.logEditFailed.replace('{label}', label).replace('{error}', message));
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
      addLog('SUCCESS', t.productGenerator.logEditSuccess.replace('{label}', label));
      setCharacterEditModal((prev) => ({ ...prev, isSubmitting: false }));
    } catch (err: any) {
      const message = err?.message || String(err);
      addLog('ERROR', t.productGenerator.logEditFailed.replace('{label}', label).replace('{error}', message));
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
      addLog('ERROR', t.productGenerator.logExtendBearerMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(engineNotAvailableMessage);
      addLog('ERROR', t.productGenerator.logExtendEngineNotAvailable);
      return;
    }

    const mainPrompt = buildCharacterPrompt(formData);

    const totalExtendedAngles = EXTENDED_ANGLE_DESCRIPTIONS.length;
    const totalExtendedBatches = Math.ceil(totalExtendedAngles / CHARACTER_ANGLE_BATCH_SIZE);

    if (nextExtendedCharacterAngleIndex >= totalExtendedAngles) {
      addLog('INFO', t.productGenerator.logExtendAllDone);
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
        ? t.productGenerator.logExtendStarting
        : t.productGenerator.logExtendContinuing.replace('{batch}', String(currentExtendBatchIndexLocal)).replace('{total}', String(totalExtendedBatches)),
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
          addLog('INFO', t.productGenerator.logExtendPreparing.replace('{label}', labelBase));
        });

        if (items.length > 0) break;

        const groupIndex = 4 + Math.floor(batchStart / 4);
        const groupTitle = angleGroups[groupIndex]?.title || `Group ${groupIndex + 1}`;
        addLog(
          'INFO',
          t.productGenerator.logExtendSkipped.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalExtendedBatches)).replace('{group}', groupTitle),
        );
        cursor = batchEnd;
      }

      if (items.length === 0) {
        addLog('INFO', t.productGenerator.logExtendNoLabels);
        return;
      }

      {
        const groupIndex = 4 + Math.floor(batchStart / 4);
        const groupTitle = angleGroups[groupIndex]?.title || `Group ${groupIndex + 1}`;
        addLog(
          'INFO',
          t.productGenerator.logExtendRunning.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalExtendedBatches)).replace('{group}', groupTitle),
        );
      }

      const extendedAngleImages: string[] = (() => {
        const next = [...angleImages];
        const globalBatchEnd = PREVIEW_LABELS.length + batchEnd;
        if (next.length < globalBatchEnd) {
          const oldLength = next.length;
          next.length = globalBatchEnd;
          for (let i = oldLength; i < globalBatchEnd; i += 1) {
            next[i] = '';
          }
        }
        return next;
      })();

      let modelRawBase64List: string[] = [];
      if (uploadedImage) {
        const base64 = await fileToBase64(uploadedImage.file);
        modelRawBase64List = [base64];
      }

      addLog(
        'INFO',
        t.productGenerator.logExtendSending.replace('{count}', String(items.length)).replace('{ratio}', aspectRatio).replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalExtendedBatches)),
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
        const message = response?.error || t.productGenerator.logExtendEngineInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      if (!results.length) {
        throw new Error(t.productGenerator.logExtendNoResults);
      }

      const batchRequested = items.length;
      const batchReturned = results.length;

      const successLabels: string[] = [];
      let successCount = 0;
      let failedWithErrorCount = 0;

      for (let i = 0; i < Math.min(batchReturned, batchRequested); i += 1) {
        const r = results[i];
        const target = batchTargets[i];
        const localIndex = target?.localIndex ?? batchStart + i;
        const globalIndex = target?.globalIndex ?? PREVIEW_LABELS.length + localIndex;
        const labelBase =
          EXTENDED_PREVIEW_LABELS[localIndex] || `Extended angle ${localIndex + 1}`;
        const label = `${labelBase} · Set 2`;

        if (r && r.success && r.dataUrl) {
          extendedAngleImages[globalIndex] = r.dataUrl;
          successCount += 1;
          successLabels.push(labelBase);
        } else if (r) {
          failedWithErrorCount += 1;
          const errMsg: string =
            (typeof r.error === 'string' && r.error.trim()) ||
            t.productGenerator.logEngineFailedLabel;
          addLog('ERROR', t.productGenerator.logExtendFailed.replace('{label}', label).replace('{error}', errMsg));
        }
      }

      const missingCount = batchRequested > batchReturned ? batchRequested - batchReturned : 0;

      setAngleImages(extendedAngleImages);

      const firstBatchIndex = extendedAngleImages.findIndex((src, idx) => {
        const localIdx = idx - PREVIEW_LABELS.length;
        if (localIdx < batchStart || localIdx >= batchEnd) return false;
        if (!isAngleEnabled(idx)) return false;
        return !!src;
      });
      if (firstBatchIndex >= 0) {
        setSelectedPreviewImage(extendedAngleImages[firstBatchIndex]);
      }

      if (successCount > 0) {
        addLog(
          'SUCCESS',
          t.productGenerator.logExtendBatchComplete.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalExtendedBatches)).replace('{success}', String(successCount)).replace('{requested}', String(batchRequested)),
        );
        addLog('INFO', t.productGenerator.logExtendBatchAngles.replace('{labels}', successLabels.join('; ')));
      }

      if (failedWithErrorCount > 0 || missingCount > 0) {
        addLog(
          'INFO',
          t.productGenerator.logExtendBatchSummary.replace('{batch}', String(batchIndexDisplay)).replace('{requested}', String(batchRequested)).replace('{returned}', String(batchReturned)).replace('{success}', String(successCount)).replace('{failed}', String(failedWithErrorCount)).replace('{missing}', String(missingCount)),
        );
      }

      setNextExtendedCharacterAngleIndex(batchEnd);
    } catch (err: any) {
      const message = err?.message || t.productGenerator.logExtendError;
      setError(message);
      addLog('ERROR', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!authReady) {
      setError(statusNotReadyMessage);
      addLog('ERROR', statusNotReadyMessage);
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';

    if (!bearerKey) {
      setError(bearerTokenMissingMessage);
      addLog('ERROR', t.productGenerator.logGenerateBearerMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(engineNotAvailableMessage);
      addLog('ERROR', t.productGenerator.logGenerateEngineNotAvailable);
      return;
    }

    const mainPrompt = buildProductPrompt(formData, aspectRatio, !!uploadedImage);

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
      addLog('INFO', t.logMessages.product.generateStarted);
    }

    addLog(
      'INFO',
      isFirstBatch
        ? t.productGenerator.logGenerateDetermining
        : t.productGenerator.logGenerateContinuing.replace('{batch}', String(currentBatchIndex)).replace('{total}', String(totalBatches)),
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
          const label = PREVIEW_LABELS[globalIndex] || `Product shot ${globalIndex + 1}`;
          const fullPrompt = `${mainPrompt} Photoshoot concept ${
            globalIndex + 1
          }: ${angleText}. Maintain the exact same product, style, materials, color, and lighting as the original description and any reference images. Do NOT change the product design, logo placement, or branding; only adjust the camera angle, framing, or scene composition.`;
          items.push({ category: 'commercial', prompt: fullPrompt });
          addLog('INFO', t.productGenerator.logGeneratePreparing.replace('{label}', label));
        });

        if (items.length > 0) break;

        const groupIndex = Math.floor(batchStart / 4);
        const groupTitle = angleGroups[groupIndex]?.title || `Group ${groupIndex + 1}`;
        addLog(
          'INFO',
          t.productGenerator.logGenerateSkipped.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)).replace('{group}', groupTitle),
        );
        cursor = batchEnd;
      }

      if (items.length === 0) {
        addLog('INFO', t.productGenerator.logGenerateNoLabels);
        return;
      }

      {
        const groupIndex = Math.floor(batchStart / 4);
        const groupTitle = angleGroups[groupIndex]?.title || `Group ${groupIndex + 1}`;
        addLog(
          'INFO',
          t.productGenerator.logGenerateRunning.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)).replace('{group}', groupTitle),
        );
      }

      let modelRawBase64List: string[] = [];
      if (uploadedImage) {
        const base64 = await fileToBase64(uploadedImage.file);
        modelRawBase64List = [base64];
      }

      if (items.length === 0) {
        addLog(
          'INFO',
          t.productGenerator.logGenerateAllSkipped.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)),
        );
        setNextCharacterAngleIndex(batchEnd);
        return;
      }

      addLog(
        'INFO',
        t.productGenerator.logGenerateSending.replace('{count}', String(items.length)).replace('{ratio}', aspectRatio).replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)),
      );

      // Progressive placeholder creation dengan countdown (v1.2.0+)
      const placeholderImages: (CharacterImageOutput | null)[] = [...angleImages];
      if (placeholderImages.length < batchEnd) {
        const oldLength = placeholderImages.length;
        placeholderImages.length = batchEnd;
        for (let i = oldLength; i < batchEnd; i += 1) {
          placeholderImages[i] = null;
        }
      }

      batchTargets.forEach((target, idx) => {
        const { globalIndex, angleText } = target;
        const label = PREVIEW_LABELS[globalIndex] || `Product shot ${globalIndex + 1}`;
        
        // Set placeholder dengan status generating dan countdown
        placeholderImages[globalIndex] = {
          dataUrl: '',
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: 300,
          prompt: label,
        };

        // Progressive reveal dengan setTimeout
        const cardId = `product-image-${globalIndex}`;
        const timeout = setTimeout(() => {
          setVisibleCardIds((prevVisible) => new Set([...prevVisible, cardId]));
        }, idx * 2000); // 2 detik delay antar card
        cardRevealTimeouts.current.push(timeout);
      });

      setAngleImages(placeholderImages);

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
        const message = response?.error || t.productGenerator.logGenerateEngineInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      if (!results.length) {
        throw new Error(t.productGenerator.logGenerateNoResults);
      }

      const batchRequested = items.length;
      const batchReturned = results.length;

      const successLabels: string[] = [];
      let successCount = 0;
      let failedWithErrorCount = 0;

      for (let i = 0; i < Math.min(batchReturned, batchRequested); i += 1) {
        const r = results[i];
        const target = batchTargets[i];
        const globalIndex = target?.globalIndex ?? batchStart + i;
        const label = PREVIEW_LABELS[globalIndex] || `Product shot ${globalIndex + 1}`;

        if (r && r.success && r.dataUrl) {
          const existingImage = placeholderImages[globalIndex];
          placeholderImages[globalIndex] = {
            dataUrl: r.dataUrl,
            status: 'completed' as const,
            startedAt: existingImage?.startedAt,
            estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
            prompt: existingImage?.prompt || label,
          };
          successCount += 1;
          successLabels.push(label);
        } else if (r) {
          failedWithErrorCount += 1;
          const errMsg: string =
            (typeof r.error === 'string' && r.error.trim()) ||
            t.productGenerator.logEngineFailedLabel;
          addLog('ERROR', t.productGenerator.logEngineFailed.replace('{label}', label).replace('{error}', errMsg));
        }
      }

      const missingCount = batchRequested > batchReturned ? batchRequested - batchReturned : 0;

      setAngleImages(placeholderImages);

      const firstBatchIndex = placeholderImages.findIndex((img, idx) => {
        const inRange = idx >= batchStart && idx < batchEnd;
        if (!inRange) return false;
        if (!isAngleEnabled(idx)) return false;
        return !!img?.dataUrl;
      });
      if (firstBatchIndex >= 0) {
        setSelectedPreviewImage(placeholderImages[firstBatchIndex]?.dataUrl || null);
      } else if (isFirstBatch) {
        const firstAvailableIndex = placeholderImages.findIndex((img) => !!img?.dataUrl);
        if (firstAvailableIndex >= 0) {
          setSelectedPreviewImage(placeholderImages[firstAvailableIndex]?.dataUrl || null);
        }
      }

      const totalSuccessSoFar = placeholderImages.filter((img) => !!img?.dataUrl).length;

      if (successCount > 0) {
        addLog(
          'SUCCESS',
          t.productGenerator.logGenerateBatchComplete.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)).replace('{success}', String(successCount)).replace('{requested}', String(batchRequested)).replace('{totalSuccess}', String(totalSuccessSoFar)).replace('{totalAngles}', String(totalAngles)),
        );
        addLog('INFO', t.productGenerator.logGenerateBatchAngles.replace('{labels}', successLabels.join('; ')));
      }

      if (failedWithErrorCount > 0 || missingCount > 0) {
        addLog(
          'INFO',
          t.productGenerator.logGenerateBatchSummary.replace('{batch}', String(batchIndexDisplay)).replace('{requested}', String(batchRequested)).replace('{returned}', String(batchReturned)).replace('{success}', String(successCount)).replace('{failed}', String(failedWithErrorCount)).replace('{missing}', String(missingCount)),
        );
      }

      setNextCharacterAngleIndex(batchEnd);
    } catch (err: any) {
      const message = err?.message || t.productGenerator.logGenerateError;
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

  const handleGenerateByChecklist = async () => {
    if (anyLoading) return;

    if (hasAnyMainAngleGroupEnabled) {
      await handleGenerate();
      return;
    }

    if (hasAnyExtendedAngleGroupEnabled) {
      addLog(
        'INFO',
        t.productGenerator.logMainLabelsDisabled,
      );
      await handleExtendGenerate();
      return;
    }

    addLog('INFO', t.productGenerator.logNoAngleLabels);
  };

  const allPreviewImages: (CharacterImageOutput | null)[] = angleImages;
  const hasGeneratedOnce = allPreviewImages.length > 0;
  const successfulImageCount = allPreviewImages.filter((img) => img?.dataUrl).length;

  const visibleAngleEntries = allPreviewImages
    .map((img, index) => ({ src: img, index }))
    .filter(({ src, index }) => {
      const hasVideo = !!angleVideos[index];
      return isAngleEnabled(index) || !!src?.dataUrl || hasVideo;
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
    (src, idx) => idx >= PREVIEW_LABELS.length && !!src,
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

  const hasFailedAngles = angleImages.some((src, idx) => isAngleEnabled(idx) && !src);

  const mainPreviewImage: string | null =
    selectedPreviewImage || (allPreviewImages.length > 0 ? allPreviewImages.find((src) => !!src) || null : null);

  const getAngleLabelByIndex = (index: number): string => {
    if (index < 0) return t.productGenerator.noPhotoYet;
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

    // Clear card reveal timeouts (v1.2.0+)
    cardRevealTimeouts.current.forEach((timeout) => clearTimeout(timeout));
    cardRevealTimeouts.current = [];
    setVisibleCardIds(new Set());

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
    } catch {
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
      addLog('INFO', t.productGenerator.logVideoAngleDisabled.replace('{label}', getAngleLabelByIndex(index)));
      return;
    }

    const imageOutput = angleImages[index];
    const src = imageOutput?.dataUrl || '';
    const label = getAngleLabelByIndex(index) || `Angle ${index + 1}`;

    if (!src) {
      addLog('ERROR', t.productGenerator.logVideoNoPhoto.replace('{label}', label));
      return;
    }

    if (videoGeneratingIndexes.includes(index)) {
      return;
    }

    if (!src.startsWith('data:image')) {
      addLog(
        'ERROR',
        t.productGenerator.logVideoInvalidFormat.replace('{label}', label),
      );
      return;
    }

    const parts = src.split(',');
    if (parts.length < 2 || !parts[1].trim()) {
      addLog(
        'ERROR',
        t.productGenerator.logVideoInvalidData.replace('{label}', label),
      );
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.startAffiliateVideoWorkflow) {
      const message = t.productGenerator.logVideoEngineNotAvailable;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      const message = t.productGenerator.logVideoBearerMissing;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const downloadPath = localStorage.getItem('zeoStudio.folder.output') || '';
    if (!downloadPath.trim()) {
      const message = t.productGenerator.logVideoOutputMissing;
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
      
      // Set placeholder dengan status generating dan countdown SEBELUM API call
      setAngleVideos((prev) => {
        const next = [...prev];
        next[index] = {
          dataUrl: '',
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: 300,
          prompt: scenePrompt,
        };
        return next;
      });
      
      addLog('INFO', t.productGenerator.logVideoStarting.replace('{label}', label));

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
      const message = err?.message || t.productGenerator.logVideoError;
      setError(message);
      addLog('ERROR', message);
      setVideoGeneratingIndexes((prev) => prev.filter((i) => i !== index));
    }
  };

  const handleGenerateAllVideos = async () => {
    if (isBatchVideoRunning || anyLoading || videoGeneratingIndexes.length > 0) {
      addLog(
        'ERROR',
        t.productGenerator.logConvertAllBusy,
      );
      return;
    }

    const targets = angleImages
      .map((src, index) => ({ src, index }))
      .filter(({ src, index }) => isAngleEnabled(index) && !!src && !angleVideos[index]);

    if (!targets.length) {
      addLog(
        'INFO',
        t.productGenerator.logConvertAllNoTargets,
      );
      return;
    }

    const MAX_PARALLEL_VIDEO = 8;

    addLog(
      'INFO',
      t.productGenerator.logConvertAllStarting.replace('{count}', String(targets.length)).replace('{max}', String(MAX_PARALLEL_VIDEO)),
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
        t.productGenerator.logConvertAllComplete,
      );
    } catch (err: any) {
      const message =
        err?.message ||
        t.productGenerator.logConvertAllError;
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
        iconId="generate-product"
        iconClassName="h-6 w-6 mr-3 text-white"
        title={t.productGenerator.title}
        description={t.productGenerator.description}
        tutorialUrl={PRODUCT_TUTORIAL_URL}
        tutorialTitle="Tutorial Generate Product"
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
                  {t.productGenerator.uploadProductPhoto}
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  {t.productGenerator.uploadProductPhotoDesc}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <label className="w-28 h-28 bg-zinc-950 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center text-center text-gray-400 text-[11px] cursor-pointer hover:border-purple-500 transition shrink-0">
                    {uploadedImage ? (
                      <img
                        src={uploadedImage.preview}
                        alt="product reference"
                        className="w-full h-full object-cover rounded-md"
                      />
                    ) : (
                      <span>{t.productGenerator.clickToUpload}</span>
                    )}
                    <input
                      type="file"
                      ref={referenceFileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </label>
                  <div className="flex-grow flex flex-col gap-2 w-full">
                    {uploadedImage && (
                      <button
                        type="button"
                        onClick={handleClearReferenceImage}
                        className="w-full bg-zinc-700 hover:bg-zinc-600 text-white text-xs py-1.5 px-3 rounded-lg transition"
                      >
                        {t.productGenerator.removeProductPhoto}
                      </button>
                    )}
                    <div className="text-[11px] text-gray-400">
                      {t.productGenerator.noPhotoDesc}
                    </div>
                    {isAnalyzing && (
                      <div className="mt-1 text-[11px] text-purple-300 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                        <span>{t.productGenerator.analyzingProduct}</span>
                      </div>
                    )}
                    {!isAnalyzing && analysisSuccess && (
                      <div className="mt-1 text-[11px] text-emerald-300 flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>{t.productGenerator.analysisSuccess}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <h2 className="text-sm font-semibold text-gray-100">{t.productGenerator.productIdentity}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <LabeledInput
                    label={t.productGenerator.productType}
                    name="productType"
                    value={formData.productType}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.productGenerator.brandStyle}
                    name="brandStyle"
                    value={formData.brandStyle}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.productGenerator.mainMaterial}
                    name="mainMaterial"
                    value={formData.mainMaterial}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.productGenerator.color}
                    name="color"
                    value={formData.color}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.productGenerator.uniqueDetails}
                    name="uniqueDetails"
                    value={formData.uniqueDetails}
                    onChange={handleFormChange as any}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <h2 className="text-sm font-semibold text-gray-100">{t.productGenerator.compositionVisual}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <LabeledInput
                    label={t.productGenerator.angle}
                    name="angle"
                    value={formData.angle}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.productGenerator.focusDepth}
                    name="focus"
                    value={formData.focus}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.productGenerator.actionState}
                    name="actionState"
                    value={formData.actionState}
                    onChange={handleFormChange as any}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <h2 className="text-sm font-semibold text-gray-100">{t.productGenerator.environmentLighting}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <LabeledInput
                    label={t.productGenerator.background}
                    name="background"
                    value={formData.background}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.productGenerator.secondaryElements}
                    name="secondaryElements"
                    value={formData.secondaryElements}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.productGenerator.moodAtmosphere}
                    name="mood"
                    value={formData.mood}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.productGenerator.lighting}
                    name="lighting"
                    value={formData.lighting}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.productGenerator.shadows}
                    name="shadows"
                    value={formData.shadows}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.productGenerator.photoStyle}
                    name="photoStyle"
                    value={formData.photoStyle}
                    onChange={handleFormChange as any}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <div>
                  <span className="block text-xs font-semibold text-gray-300 mb-2">{t.productGenerator.aspectRatio}</span>
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
                    <span className="block text-xs font-semibold text-gray-300">{t.productGenerator.shotLabel}</span>
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
                        {t.productGenerator.clearBtn}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">
                    {t.productGenerator.shotLabelDesc}
                  </p>
                  <div className="text-[10px] mb-2 px-2 py-1.5 rounded-md bg-zinc-800/50 border border-zinc-700/50">
                    <span className={
                      enabledAngleGroups.filter(Boolean).length === 0 
                        ? 'text-red-400'
                        : enabledAngleGroups.filter(Boolean).length >= MAX_ANGLE_GROUPS 
                        ? 'text-emerald-400'
                        : 'text-gray-300'
                    }>
                      Dipilih: {enabledAngleGroups.filter(Boolean).length}/{MAX_ANGLE_GROUPS} label (min {MIN_ANGLE_GROUPS}, maks {MAX_ANGLE_GROUPS})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {angleGroups.map((group, idx) => {
                      const isActive = enabledAngleGroups[idx] !== false;
                      const currentCount = enabledAngleGroups.filter(Boolean).length;
                      const canToggle = isActive || currentCount < MAX_ANGLE_GROUPS;
                      
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => {
                            if (!canToggle) {
                              addLog('INFO', `Maksimal ${MAX_ANGLE_GROUPS} label sudah dipilih`);
                              return;
                            }
                            setEnabledAngleGroups((prev) => {
                              const next =
                                prev.length === angleGroups.length ? [...prev] : [...DEFAULT_ENABLED_ANGLE_GROUPS];
                              next[idx] = !isActive;
                              return next;
                            });
                          }}
                          disabled={!isActive && !canToggle}
                          className={`flex items-start justify-start gap-2 px-3 py-2 rounded-lg text-left text-[11px] font-medium border transition-all duration-200
                            bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700
                            ${
                              isActive
                                ? 'text-white border-transparent shadow-lg shadow-purple-500/30 ring-2 ring-purple-200/70'
                                : 'text-white/70 border-purple-500/30 hover:text-white opacity-60'
                            }
                            ${!isActive && !canToggle ? 'opacity-40 cursor-not-allowed' : ''}
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
                disabled={anyLoading || !authReady || enabledAngleGroups.filter(Boolean).length < MIN_ANGLE_GROUPS}
                className={`w-full min-h-[48px] px-4 rounded-lg text-white font-semibold text-sm flex items-center justify-center transition-all duration-200 btn-glass-primary
                           focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                           ${
                             anyLoading || !authReady || enabledAngleGroups.filter(Boolean).length < MIN_ANGLE_GROUPS
                               ? 'bg-zinc-600 cursor-not-allowed'
                               : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                           }`}
              >
                {isLoading
                  ? t.productGenerator.generatingProduct
                  : authReady
                  ? t.productGenerator.generateProductPhotoshoot
                  : t.productGenerator.testTokenFirst}
              </button>

              <div className="max-h-52 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-gray-200 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-gray-100">{t.activityLog.title}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyActivityLog}
                      disabled={activityLogs.length === 0}
                      className="px-2 py-0.5 rounded-md border border-zinc-600 text-[10px] text-gray-200 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      {activityLogCopyLabel}
                    </button>
                    <span className="text-[10px] text-gray-500">{activityLogs.length} {t.activityLog.entriesLabel}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                  {activityLogs.length === 0 ? (
                    <p className="text-[11px] text-gray-500">
                      {t.productGenerator.noActivity}
                    </p>
                  ) : (
                    activityLogs.map((log) => (
                      <div key={log.id} className="flex gap-2 items-start">
                        <span className="text-[10px] text-gray-500 min-w-[46px]">{log.timestamp}</span>
                        <span
                          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md border ${
                            log.type === 'ERROR'
                              ? 'border-red-500/60 text-red-300'
                              : log.type === 'SUCCESS'
                              ? 'border-emerald-500/60 text-emerald-300'
                              : 'border-zinc-500/60 text-gray-300'
                          }`}
                        >
                          {log.type}
                        </span>
                        <span className="text-[11px] text-gray-200 whitespace-pre-wrap break-words flex-1">
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
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
              <h3 className="text-lg font-semibold text-gray-50">{t.productGenerator.previewProduct}</h3>
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
                <span>{t.productGenerator.clearData}</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col px-6 py-4 min-h-0 overflow-y-auto custom-scrollbar">
              {anyLoading && !hasGeneratedOnce && (
                <div className="flex-1 flex items-center justify-center">
                  <GradientLoader 
                    size="md" 
                    text={t.productGenerator.generatingProduct}
                    subtitle="Mohon tunggu"
                    showLogo={false}
                  />
                </div>
              )}

              {!anyLoading && !hasGeneratedOnce && (
                <div className="flex-1 flex items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center text-xs p-4">
                  <p>
                    {t.productGenerator.previewHint}
                    {' '}
                    <span className="font-semibold text-gray-300">{t.productGenerator.generateProductPhotoshoot}</span>.
                  </p>
                </div>
              )}

              {!isLoading && hasGeneratedOnce && (
                <div className="mb-3 text-[11px] text-gray-300">
                  <span className="font-semibold text-gray-100">
                    {t.productGenerator.previewStatsTotal.replace('{count}', String(successfulImageCount))}
                  </span>
                  <span className="mx-1 text-gray-500">·</span>
                  <span className="text-gray-300">
                    {t.productGenerator.previewStatsShots.replace('{slots}', String(visibleAngleEntries.length)).replace('{batch}', String(Math.ceil(visibleAngleEntries.length / PREVIEW_LABELS.length))).replace('{label}', activeLabel)}
                  </span>
                  <p className="text-gray-500 mt-0.5">
                    {t.productGenerator.gridInstruction}
                  </p>
                </div>
              )}

              {hasGeneratedOnce && (
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-100">{t.productGenerator.photoshootTitle}</h4>
                      <p className="text-[10px] text-gray-500">
                        {t.productGenerator.photoshootDesc}
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
                          {isBatchVideoRunning ? t.productGenerator.processingStatus : t.productGenerator.convertAllToVideo}
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
                              ? t.productGenerator.processingStatus
                              : t.productGenerator.next4ShotsBatch.replace('{batch}', String(nextMainBatchIndex)).replace('{total}', String(totalMainBatches))}
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
                            className="flex items(center) gap-2 btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-1.5 px-3 min-w-[150px] rounded-lg text-[10px] transition disabled:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
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
                                ? t.productGenerator.processingStatus
                                : hasAnyExtendedImage
                                ? t.productGenerator.next4ExtendedShots.replace('{batch}', String(currentExtendBatchIndexUiGlobal)).replace('{total}', String(totalEnabledAngleBatchesUi))
                                : t.productGenerator.extendGenerate.replace('{total}', String(totalEnabledAngleBatchesUi))}
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
                          {isRegeneratingFailed ? t.productGenerator.processingStatus : t.productGenerator.regenerateFailed}
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
                        <span className="whitespace-nowrap">{t.productGenerator.downloadAllImages}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {visibleAngleEntries.map(({ src: imageOutput, index }) => {
                      const label = getAngleLabelByIndex(index);
                      const src = imageOutput?.dataUrl || '';
                      const isImageGenerating = imageOutput?.status === 'generating';
                      const isImageFailed = imageOutput?.status === 'failed';
                      const countdownMsg = getCountdownMessage(imageOutput);

                      const isActive = !!src && mainPreviewImage === src;
                      const isCardRegenerating = regeneratingIndex === index;
                      const isCardEditing = editingIndex === index;
                      const videoOutput = angleVideos[index] || null;
                      const videoUrl = getVideoFileUrl(videoOutput?.dataUrl || '');
                      const countdownMsgVideo = getCountdownMessage(videoOutput);
                      const videoUiState = getVideoUiState(index);
                      const viewMode: CharacterAngleViewMode =
                        angleViewModes[index] || (videoOutput ? 'video' : 'photo');
                      const isVideoGenerating = videoGeneratingIndexes.includes(index);
                      const isBusy = isCardRegenerating || isCardEditing || isVideoGenerating || isImageGenerating;
                      const cardId = `product-image-${index}`;
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

                      // Progressive reveal - jangan render card jika belum visible (v1.2.0+)
                      if (!isVisible) return null;

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
                              src={`${videoUrl}#t=0.5`}
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
                                  {t.productGenerator.generateVideoStatus}
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
                            </div>
                          ) : imageOutput?.status === 'completed' && src ? (
                            <img src={src} alt={label} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-[10px] text-gray-500">
                              <span>{isBusy ? '' : t.productGenerator.generateFailed}</span>
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
                                {t.productGenerator.fotoTab}
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
                                {t.productGenerator.videoTab}
                              </button>
                            </div>
                          </div>

                          {/* Editing loading state with countdown */}
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
                                <div className="mt-1 text-[10px] text-gray-200 px-2 text-center">Editing...</div>
                              </div>
                            </div>
                          )}
                          
                          {/* Regenerate loading state with countdown */}
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
                                <div className="mt-1 text-[10px] text-gray-200 px-2 text-center">Regenerasi...</div>
                              </div>
                            </div>
                          )}

                          {!isBusy && imageOutput?.status === 'completed' && src && (
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
                                        title={t.productGenerator.editBtn}
                                      >
                                        {t.productGenerator.editBtn}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleRegenerateImage(index);
                                        }}
                                        disabled={!authReady}
                                        className="px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition"
                                        title={t.productGenerator.regenerateBtn}
                                      >
                                        {t.productGenerator.regenerateBtn}
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
                                        title={t.productGenerator.downloadFoto}
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
                                        <span>{t.productGenerator.downloadFoto}</span>
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
                                          title={t.productGenerator.generateVideoBtn}
                                        >
                                          {t.productGenerator.generateVideoBtn}
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

                                  <div className="flex flex-col items-center gap-1 w-full">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleOpenVideoPromptModal(index);
                                      }}
                                      disabled={!src}
                                      className="w-full px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold btn-glass-primary btn-video-gradient transition disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={t.productGenerator.regenerateVideoBtn}
                                    >
                                      {t.productGenerator.regenerateVideoBtn}
                                    </button>

                                    {videoOutput && videoOutput.status === 'completed' && (
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
              <h3 className="text-sm font-semibold text-gray-100">{t.productGenerator.editProductTitle}</h3>
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
                <div className="text-[11px] font-semibold text-gray-200">{t.productGenerator.editProductInstruction}</div>
                <textarea
                  value={characterEditModal.instruction}
                  onChange={(e) =>
                    setCharacterEditModal((prev) => ({
                      ...prev,
                      instruction: e.target.value,
                    }))
                  }
                  placeholder={t.productGenerator.editProductPlaceholder}
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
                {characterEditModal.isSubmitting ? t.productGenerator.editProductProcessing : t.productGenerator.editProductApply}
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
                <h3 className="text-sm font-semibold text-gray-100">{t.productGenerator.videoPromptTitle}</h3>
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
                  <div className="text-[11px] font-semibold text-gray-200">{t.productGenerator.customPromptLabel}</div>
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
                    {t.productGenerator.clearBtn}
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
                  placeholder={t.productGenerator.videoPromptPlaceholder}
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
                {t.productGenerator.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleSaveVideoPromptModal}
                className="px-3 py-2 rounded-lg btn-glass-primary btn-video-gradient text-white text-xs font-semibold"
              >
                {t.productGenerator.generateVideoBtn}
              </button>
            </div>
          </div>
        </div>
      )}
      {isLightboxOpen && lightboxImage && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-auto max-w-[90vw] max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-gray-100">{t.productGenerator.previewProductTitle}</h3>
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
            <h2 className="text-base font-semibold text-gray-50 mb-2">{t.productGenerator.confirmResetTitle}</h2>
            <div className="space-y-2 text-sm text-gray-200 mb-4">
              <p>
                {t.productGenerator.confirmResetMessage}
              </p>
              <p className="text-gray-400 text-xs">{t.productGenerator.confirmResetWarning}</p>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-3 py-1.5 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
              >
                {t.productGenerator.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {t.productGenerator.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateProductPage;
