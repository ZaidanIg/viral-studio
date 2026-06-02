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

const CONCEPT_TUTORIAL_URL = 'https://www.youtube.com/embed/qVOQzZgU2rc?autoplay=1&mute=1&origin=http://localhost:3000';

// Image output dengan status tracking dan countdown (v1.2.0+)
type CharacterImageOutput = {
  dataUrl: string;
  status: 'generating' | 'completed' | 'failed';
  startedAt?: number;
  estimatedTotalSeconds?: number;
  prompt?: string;
  errorMessage?: string;
};

// Video output dengan status tracking dan countdown (v1.2.0+)
type CharacterAngleVideoOutput = {
  dataUrl: string;
  status: 'generating' | 'completed' | 'failed';
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

const buildConceptPrompt = (data: CharacterFormData): string => {
  const parts: string[] = [];

  // Untuk Generate Concept, pose dan angle dikendalikan oleh preset konsep dan angle-specific text,
  // sehingga kita tidak lagi memasukkan deskripsi tipe shot (close-up/full body) di sini.
  // Ini mencegah warisan pola pose dari halaman Generate Character.
  let identity = `${data.gayaSeni}, ${data.kualitas} concept photography of a`;
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

  if (data.gayaPakaian) parts.push(`Her clothing style is ${data.gayaPakaian}.`);

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

  parts.push(
    'This is a highly stylized concept photography image, designed with strong art direction, cinematic composition, and cohesive color grading.',
  );

  parts.push(
    'IMPORTANT: If a reference photo is provided, the person in this image MUST be the exact same individual as in the reference: same face, skin tone, hairstyle, and overall body proportions. Do NOT change their identity, gender, age, or ethnicity.',
  );

  parts.push(
    'IMPORTANT: The outfit and wardrobe must remain EXACTLY the same across all concept images: same garments (top, bottom, outerwear, shoes), same colors, same style, and same accessories. The model must never change clothes or appear in a different outfit.',
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

  const finalPrompt = parts.join(' ').replace(/,\./g, '.').replace(/\s+/g, ' ').trim();
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
  // I. Inferno Street Rebel – burning car alley
  'LABEL I – DOORWAY FOOT-FORWARD LOW ANGLE. Camera placed very low on the asphalt, tilting slightly upward toward the open driver door of the burning car. The subject sits in or just outside the doorway, leaning back with a strong, editorial posture as the nearer leg fully extends so the sole of the sneaker dominates the foreground, while the other leg is bent closer to the body. The gigantic fireball from inside the car erupts directly behind, sculpting a dramatic halo of light around the subject and matching the reference where the foot is the closest element to camera.',
  'LABEL I – SIDE SEATED IN DOOR. Medium shot from slightly below eye level along the side of the car. The subject sits sideways on the driver seat with one leg stepping out onto the asphalt and the other leg still inside the car, torso leaning back against the seat, chin slightly lifted, gaze locked past the lens with a poised, cinematic stare. The open door frames the silhouette while the interior and rear of the car are filled with bright orange flames.',
  'LABEL I – ASPHALT SIT BESIDE BURNING CAR. Camera at roughly knee height in a three-quarter view. The subject sits on the road just outside the open driver door, both knees bent, one foot closer to camera, forearms resting with deliberate composure on the raised knee. The burning car and towering flames rise behind and above, echoing the seated-on-asphalt reference frame as if a still from a fashion editorial set inside an action movie.',
  'LABEL I – UPRIGHT DOORSTEP PORTRAIT. Medium-full shot at eye level. The subject sits upright on the door sill of the open driver door, both feet planted on the asphalt with knees bent around ninety degrees. Torso angles slightly toward camera in a structured, confident pose, and the massive wall of fire exploding from the car interior wraps around the doorway behind like a clean, iconic album-cover portrait framed by metal and flame.',

  // II. Daisy Daydream – meadow poses
  'LABEL II – MEADOW LOW-ANGLE FULL BODY. Camera placed low among the daisies, looking slightly up toward the standing subject in the middle of the flower field. Foreground daisies appear as large, soft bokeh framing the bottom and sides of the frame. The subject stands in an oversized pastel blue ruffled sweater and soft cream high-waisted wide-leg trousers, holding a bouquet of daisies near the waist with a calm dreamy gaze under a bright blue sky with scattered clouds.',
  'LABEL II – BACKLIT DAISY PORTRAIT. Vertical framing from mid-thigh up, camera just above the flowers but still partially obscured by soft, out-of-focus daisies near the lens. The subject faces the camera with head slightly tilted, hugging the bouquet of daisies close to the chest. Sunlight from behind or above creates a gentle halo around the hair and lights the petals, emphasizing a soft, romantic, backlit mood in the daisy field.',
  'LABEL II – WIDE MEADOW CENTER FRAME. Camera set low in the daisy field, but pulled back so the subject appears a bit smaller and fully visible from head to toes. The subject stands centered in the frame, holding the bouquet with both hands, surrounded by a sea of daisies stretching to the horizon. Foreground daisy clusters stay anchored near the lower edge and along the sides of the frame, gently framing the legs while leaving the upper part of the blue sky clean and unobstructed.',
  'LABEL II – GOLDEN HOUR MEADOW PORTRAIT. Similar full-body composition in the daisy field, but during warm golden-hour light. The subject stands or slightly shifts weight on one leg, bouquet held in front, with the sun low in the sky casting soft orange highlights on the blue sweater, hair and white petals. Foreground daisies still blur softly around the lens, emphasizing a peaceful, nostalgic evening atmosphere.',

  // III. Cathedral City Chronicle – neo-gothic street fashion
  'LABEL III – LAMP POST GROUND SHOT. Camera placed at ground level near the subject’s sneakers, tilted upward along the stone sidewalk toward a tall black lamp post and the neo-gothic European building behind. The subject leans into the post with a deliberate editorial angle, oversized newspaper held in front of the torso, wide beige corduroy pants and chunky white sneakers filling most of the foreground while the face stays small but sharp near the top of frame.',
  'LABEL III – SIDEWALK STRIDE WITH NEWSPAPER. Low-angle full-body framing from slightly in front and to the side as the subject takes a slow step along the stone pavement, one leg extended toward the camera. The oversized newspaper is held loosely at chest or hip height, layered streetwear jacket and hoodie catching daylight, and the vertical lines of spires and arched windows rising behind create strong leading lines.',
  'LABEL III – ARCHWAY LEAN AND READ. Camera set low and a bit closer to the building, looking up at the subject who leans a shoulder into a carved stone arch or doorway, ankles crossed or one foot slightly ahead. The newspaper is opened or partially folded as if being read, with the arch curving above the head and ornate windows stacking into the sky.',
  'LABEL III – STEPS AND SKYLINE GAZE. Low camera position on stone steps or a small platform, pointing up so the subject’s sneakers and wide pants dominate the lower frame while the head and folded newspaper sit against a backdrop of spires and blue sky. The pose is composed and confident, weight anchored on one leg, gaze angled out toward the city as if caught between reading headlines and watching the street.',

  // IV. Skyline Bridge Muse – bridge editorial poses
  'LABEL IV – RAILING COVER GAZE. Medium shot from around waist height, camera slightly below eye level, facing the subject as they lean back against the thick gray bridge railing in a confident editorial pose. The head and shoulders are framed cleanly against the sky, with one hand resting on the rail while the other hovers with intent near a pocket, outer layer or blazer open over a dark top. The out-of-focus city and railing perspective recede behind, with clean blue sky and soft clouds filling the upper frame.',
  'LABEL IV – WALKWAY MID-STEP. Low to mid-height camera placed along the pedestrian path of the bridge, capturing the subject in a controlled, runway-like mid-step toward or slightly across the frame. The outfit and head styling must follow the base character description; do not introduce new garments, remove coverings, or change colors. The silhouette shows crisp, directional motion, one hand in a pocket or resting by the side, the other brushing the blazer or outer layer. Railing lines and distant city buildings create strong leading lines into the horizon.',
  'LABEL IV – SIDE RAIL LEAN. Camera positioned a bit lower and off to the side, looking at the subject in three-quarter profile as they lean a shoulder into the railing. The wardrobe remains perfectly consistent with the other Skyline Bridge Muse frames and with the base character design, while a hint of wind moves fabric or hair naturally. One hand hooks with purpose into a pocket while the other lightly touches the rail. The composition keeps generous negative-space sky above the head, with the bridge railing cutting diagonally through the frame and the city softly blurred beyond.',
  'LABEL IV – CITYLINE OVER-SHOULDER. Camera at similar height but shifted behind the subject, framing from mid-torso up as they turn to look back over a shoulder toward camera. The head and neck remain styled exactly as in the base character reference, keeping identity and wardrobe consistent across all frames. The gray railing runs diagonally away from the lens, leading to a soft city skyline and expansive blue sky filled with scattered clouds, emphasizing a contemplative, cinematic mood.',
];

// Set lanjutan untuk Extend Generate (pose & angle berbeda dari 16 awal)
const EXTENDED_ANGLE_DESCRIPTIONS: string[] = [
  // V. Close-Up & Portrait Variants
  'CLOSE-UP LAUGHING CANDID. Tight framing on face and shoulders, eyes slightly squinted from a controlled, editorial burst of laughter, head tilted back a bit, hair moving slightly as if caught mid-laugh on set, soft studio light from the side subtly sculpting cheekbones.',
  'CLOSE-UP 3/4 PORTRAIT. Camera at eye level, subject turned about 30 degrees away from camera, eyes looking back toward camera, one eyebrow slightly raised, subtle smirk, background softly blurred.',
  'CLOSE-UP LOOKING OFF-FRAME. Subject framed from shoulders up, gaze directed far to the left or right (off camera), expression thoughtful or dreamy, rim light on hair to separate from background.',
  'CLOSE-UP CHIN REST ON HAND. Face supported by one hand under the chin, elbow resting just out of frame, fingers relaxed, expression calm and introspective, soft beauty lighting from 45 degrees.',

  // VI. Medium Shot Storytelling
  'MEDIUM SHOT LEANING ON TABLE. Framing from waist up, subject posed at a sleek editorial table, leaning slightly forward with both forearms resting in a controlled, graphic line, one hand holding a prop like a magazine or cup as if in a high-end interview portrait.',
  'MEDIUM SHOT HIGH-ANGLE EDITORIAL. Camera slightly above eye level and close, cropping elegantly around shoulders and chest, arm or shoulder subtly in frame to suggest an over-the-shoulder capture, expression refined and enigmatic rather than playful, background softly blurred like a studio set.',
  'MEDIUM SHOT ARMS SCULPTED WIDE. Body facing camera, arms opened outward in a deliberate, sculptural gesture that shows the silhouette and outfit, chin slightly lifted, expression strong and editorial instead of friendly, torso perfectly centered in frame.',
  'MEDIUM SHOT HANDS IN POCKET. Body turned 30–45 degrees, both hands placed firmly in pockets or thumbs hooked with intention, posture tall and structured, subtle weight shift to one leg, expression cool, fashion-forward and confident.',

  // VII. Full Body Dynamic
  'FULL BODY JUMPING SHOT. Captured mid-air jump, knees slightly bent, one leg kicked back a bit, arms raised or out to the sides, expression joyful and energetic, camera at eye-level or slightly low.',
  'FULL BODY CROSSING STREET. Subject mid-step in a crosswalk or implied street scene, one foot forward, natural arm swing, head turned slightly to the side, urban background softly blurred.',
  'FULL BODY LEANING ON RAILING. Subject leaning sideways against a railing or ledge, one foot crossed over the other, arms held in a controlled, graphic line on the rail, expression composed, environment giving depth.',
  'FULL BODY SITTING SIDEWAYS ON CHAIR. Chair angled sideways to camera, subject sitting with legs to one side, one arm draped over chair back, posture poised and elegant.',

  // VIII. Creative & Cinematic
  'HALF-SILHOUETTE BACKLIGHT SHOT. Subject backlit by a bright window or light source, edges of body and hair glowing, face partially in shadow but still readable, cinematic mood.',
  'REFLECTION ON WET FLOOR OR PUDDLE. Camera low, focusing on reflection of the subject standing above a shiny or wet surface, only partial body directly visible, framing emphasizing symmetry.',
  'SHADOW PLAY ON WALL. Strong side light casting an interesting shadow of the subject on the wall, camera framing both the person and their shadow, pose chosen to create an interesting silhouette shape.',
  'CINEMATIC WALK-IN FRONT PROFILE. Camera slightly ahead and off to one side, framing from shoulders or mid-torso up as the subject walks slowly toward camera in a three-quarter front profile. The face must remain visible to camera (no back-of-head views), with eyes and expression clearly readable while the background lights or environment blur into soft cinematic bokeh.',
];

const PREVIEW_LABELS: string[] = [
  '1 · Inferno · Alley Stare',
  '1 · Inferno · Crosswalk Stride',
  '1 · Inferno · Neon Lean',
  '1 · Inferno · Rooftop Silhouette',
  '2 · Urban · Studio Contrast',
  '2 · Urban · Light Sweep',
  '2 · Urban · Backlight Silhouette',
  '2 · Urban · Rain Street',
  '3 · Cinematic · Head Turn',
  '3 · Cinematic · Walk Past',
  '3 · Cinematic · Deep Shadow',
  '3 · Cinematic · Hard Light',
  '4 · Noir · Shadow Beam',
  '4 · Noir · Rimlight Walk',
  '4 · Noir · Spotlight Pose',
  '4 · Noir · Smoke Alley',
];

// Label untuk set lanjutan (EXTENDED_ANGLE_DESCRIPTIONS)
const EXTENDED_PREVIEW_LABELS: string[] = [
  '5 · Neon · Reflection Lean',
  '5 · Neon · Soda Glow',
  '5 · Neon · Vanishing Line',
  '5 · Neon · Bus Stop',
  '6 · Portrait · Eye Contact',
  '6 · Portrait · 3/4 Gaze',
  '6 · Portrait · Laugh Candid',
  '6 · Portrait · Chin Rest',
  '7 · Street · Phone Call',
  '7 · Street · Bike Cruise',
  '7 · Street · Crosswalk POV',
  '7 · Street · Rain Blur',
  '8 · Cinematic · Suitcase',
  '8 · Cinematic · Taxi Door',
  '8 · Cinematic · Station Wait',
  '8 · Cinematic · Exit Stairs',
];

const MAIN_CONCEPT_PRESETS: string[] = [
  // I. Inferno Street Rebel (4 pose)
  'CONCEPT PRESET: I. Inferno Street Rebel. Extreme low-angle cinematic scene of the subject lit entirely by the orange glow of a burning car. The subject sits in the driver’s seat of a black vintage car engulfed in flames, fire violently consuming the hood and roof while the driver’s door hangs open. One leg is outside the car with the sneaker planted on the asphalt, body bending slightly forward and looking back toward camera with a cool, self-assured attitude. Wardrobe is an oversized basketball jersey, chunky sneakers and colorful striped socks. The mood is tense and suspenseful, with searing flames cutting against deep darkness and dramatic highlights on the subject. Captured on a Leica SL2-S with a fast 75mm editorial portrait lens, sharp focus on the subject, with fire and smoke billowing in cinematic depth behind, like a gritty editorial still from a high-budget action film.',
  'CONCEPT PRESET: I. Inferno Street Rebel. Same black vintage car engulfed in roaring flames, but framed more from the side: the driver’s door is wide open, interior glowing with fire, and the subject sits in a controlled, fashion-forward pose in the doorway with one leg stepping onto the asphalt and the other still inside. The subject leans back against the seat, chin slightly lifted, expression composed but fearless. Outfit remains the same oversized basketball jersey, striped socks and chunky sneakers. The palette is dominated by hot orange firelight, deep shadows and subtle reflections on metal. Captured on a Leica SL2-S with a fast 75mm editorial portrait lens, sharp focus on the subject, with fire and smoke receding into a rich cinematic background.',
  'CONCEPT PRESET: I. Inferno Street Rebel. The burning car is parked on an empty night road, flames blasting out of the open cabin and rising high into the sky. The subject sits low on or beside the asphalt just outside the open driver door, knees bent and one foot a bit closer to camera, forearms resting with deliberate control on the raised knee. The same basketball jersey, striped socks and chunky sneakers define the look. The composition heightens the scale of the fire against the darkness of the road, with embers and smoke drifting upward. Captured on a Leica SL2-S with a fast 75mm editorial portrait lens, sharp focus on the subject, with blazing fire and drifting smoke providing layered cinematic depth.',
  'CONCEPT PRESET: I. Inferno Street Rebel. A slightly tighter, more portrait-driven view at the open driver door of the same flaming vintage car. The subject is positioned near the door sill, both feet on the asphalt, knees bent, torso angled slightly toward camera as if pausing mid-escape. The jersey, socks and sneakers remain identical, but the framing brings more attention to facial expression and upper body while the fire fills the background like a wall of light. Captured on a Leica SL2-S with a fast 75mm editorial portrait lens, sharp focus on the subject, with fire, sparks and smoke forming a powerful cinematic backdrop.',

  // II. Daisy Daydream (4 pose)
  'CONCEPT PRESET: II. Daisy Daydream. High-fashion Vogue editorial photograph in a wild daisy meadow, shot from an extreme low angle through clusters of daisies in the foreground so blurred stems and petals frame the lens in an artistic composition. The subject stands gracefully among the flowers, hair tousled by the breeze with soft strands falling across the forehead, wearing a voluminous oversized light-blue ruffled sweater paired with soft cream high-waisted wide-leg trousers while holding a bouquet of fresh daisies. The meadow stretches into the distance beneath a vivid azure sky painted with glowing clouds, and natural daylight is softened by the foreground blooms into ethereal flares, airy haze and sculpted shadows that flatter the figure. Captured on a Leica SL2 with an APO-Summicron-SL 90mm f/2 lens at ISO 100, f/2, 1/250 sec.',
  'CONCEPT PRESET: II. Daisy Daydream. Same wild daisy meadow and couture wardrobe, but with the sun positioned behind the subject to create a bright backlit rim around the hair and daisy petals. The low-angle perspective still peers through glowing foreground daisies, while the oversized light-blue ruffled sweater and soft cream high-waisted wide-leg trousers catch subtle highlights and sculpted shadows. The atmosphere feels editorial yet dreamy, with airy haze, soft flares and crisp details balancing the organic field of flowers. Captured on a Leica SL2 with an APO-Summicron-SL 90mm f/2 lens at ISO 100, f/2, 1/250 sec.',
  'CONCEPT PRESET: II. Daisy Daydream. A slightly wider composition that reveals more of the endless meadow, with dense white daisies stretching toward the horizon while a few blossoms sit closer to the lens near the lower edge and along the sides for added depth, leaving the upper part of the blue sky clean and unobstructed. The subject remains in the same light-blue ruffled sweater and soft cream high-waisted wide-leg trousers, bouquet of daisies in hand, but appears a bit smaller in frame so more of the sky fills the upper part of the image without being blocked by flowers. Bright daytime clouds drift across the sky, and natural light keeps the scene clean, crisp and editorial while still wrapping softly around the subject. Captured on a Leica SL2 with an APO-Summicron-SL 90mm f/2 lens at ISO 100, f/2, 1/250 sec.',
  'CONCEPT PRESET: II. Daisy Daydream. A more intimate, portrait-leaning variation where the frame is partially obscured by large, out-of-focus daisy blossoms that form a soft halo around the subject’s face and upper body. The same blue ruffled sweater, soft cream high-waisted wide-leg trousers and daisy bouquet are present, but the composition pulls the viewer closer into expression, skin detail and gentle wind-blown hair. Light filters through petals and clouds to produce painterly tones, delicate flares and sculpted highlights that feel like a dreamy Vogue beauty spread. Captured on a Leica SL2 with an APO-Summicron-SL 90mm f/2 lens at ISO 100, f/2, 1/250 sec.',

  // III. Cathedral City Chronicle (4 pose)
  'CONCEPT PRESET: III. Cathedral City Chronicle. Hyper-realistic editorial street fashion scene on a stone-paved sidewalk in front of a grand neo-gothic European building with ornate spires and arched windows. The subject leans into a tall black lamp post with a controlled, editorial posture while holding an oversized newspaper across the torso. The camera is positioned at an extreme low ground-level wide-angle, looking upward so chunky white sneakers and wide beige corduroy pants dominate the foreground in razor-sharp detail, while the intense, focused face stays crisp near the top of frame. Fashion-forward layered streetwear styled with clean structure, natural daylight, sharp shadows, ultra-detailed textures and cinematic composition. Captured on a Leica SL2 with a 28mm f/1.4 Summilux-SL wide-angle lens to accentuate the towering architecture.',
  'CONCEPT PRESET: III. Cathedral City Chronicle. Same neo-gothic European facade and lamp post, but captured as the subject takes a deliberate, editorial step along the stone sidewalk. The oversized newspaper is held with controlled ease at chest or hip height, layered streetwear jacket and hoodie catching clean daylight. The low-angle camera emphasizes the stride, sneakers and wide beige corduroy pants in the lower frame while vertical lines of spires and arched windows rise dramatically behind, using the same Leica SL2 with 28mm Summilux-SL wide-angle setup to stretch perspective.',
  'CONCEPT PRESET: III. Cathedral City Chronicle. Variation framed closer to the architecture, where the subject leans a shoulder into a carved stone archway or doorway of the same building. The oversized newspaper is opened or partially unfolded as if being read, layered streetwear styling still visible. The camera remains low and wide, looking up through the arch so sculpted stone details, tall windows and sky stack above the subject, blending fashion editorial with architectural storytelling on the same Leica SL2 and 28mm wide-angle lens.',
  'CONCEPT PRESET: III. Cathedral City Chronicle. The subject stands on a short flight of stone steps or a slightly elevated platform near the cathedral, still holding the large newspaper while facing out toward the street. The low-angle perspective places chunky sneakers and flowing corduroy legs close to the lens, while the upper body and newspaper cut across a backdrop of soaring spires and blue sky. Natural daylight creates crisp shadows on the steps and facade, reinforcing a cinematic, city-chronicle mood captured on the same Leica SL2 with a 28mm Summilux-SL editorial wide-angle.',

  // IV. Skyline Bridge Muse (4 pose)
  'CONCEPT PRESET: IV. Skyline Bridge Muse. Editorial magazine-cover photograph on a modern bridge or overpass, with the subject leaning against a thick, smooth gray metal railing on a bright sunny day. The outfit, accessories and head styling must follow the base character description exactly; do not introduce new garments or remove existing coverings. The look reads as a sharp, modern city silhouette in a black-and-white pinstriped oversized blazer and matching tailored trousers over a dark top, plus clean eyewear and a thoughtful expression toward the camera. The background is an out-of-focus cityscape under a vast, clear, vibrant blue sky with scattered fluffy white clouds, lit by bright natural daylight that creates a slightly dreamy effect with soft shadows. The overall mood is contemplative, calm and cinematic, with a clean, modern aesthetic and a cool palette of blues, grays and whites, captured on a Leica SL2 with a 35mm f/1.4 Summilux-SL editorial lens for balanced perspective between subject and skyline.',
  'CONCEPT PRESET: IV. Skyline Bridge Muse. Same bridge environment and tailoring vibe, but with the subject shifting into a poised power stance along the railing. One shoulder angles toward camera while one hand rests in a pocket and the other adjusts the blazer lapel. Wardrobe and head styling must remain identical to the base character design throughout all Skyline Bridge Muse frames, while the camera frames more of the torso and hips, letting the parallel lines of railing and distant buildings lead into the soft-focus city backdrop and open sky, using the same Leica SL2 with 35mm Summilux-SL editorial setup.',
  'CONCEPT PRESET: IV. Skyline Bridge Muse. A wider composition that reveals more of the pedestrian walkway, keeping the subject slightly off-center so the rail and bridge structure create strong converging lines into the distance. The same pinstriped suit and base-character accessories anchor the look, but the pose is more turned to the side with one arm resting along the rail. The expansive blue sky and subtle city skyline occupy a larger portion of the frame, emphasizing negative space and a graphic, minimalist editorial feel rendered with the same Leica SL2 and 35mm Summilux-SL lens.',
  'CONCEPT PRESET: IV. Skyline Bridge Muse. A more intimate, over-shoulder variation where the subject stands near the railing facing down the bridge, then turns the head back toward camera. The blazer, trousers, glasses and head styling stay perfectly consistent from this angle, tracing a clean curve along the jawline and neck defined by the base character. The framing pulls in closer to face and upper torso while the rail and city skyline blur softly behind. The bright sky and clouds form a clean backdrop, enhancing the contemplative, cinematic mood of a solitary figure on a high city walkway, all captured on the same Leica SL2 with a 35mm editorial prime.',
];

const EXTENDED_CONCEPT_PRESETS: string[] = [
  // V. Neon Alley Reverie (4 pose)
  'CONCEPT PRESET: V. Neon Alley Reverie. Wong Kar-wai inspired urban noir portrait outside a late-night convenience store, with the subject styled in the same wardrobe and head look as the base character description. The camera is held at slightly below chest height and angled upward toward the glass storefront, capturing a mid-length view as she leans back into the rain-speckled window while laughing, round thin-rimmed glasses catching neon reflections. In one hand she holds a clear plastic cup of fizzy soda with ice and a striped straw, condensation catching emerald, magenta and amber light. Wet pavement and vertical signage recede softly into bokeh. Captured on a Leica SL2-S with a 35mm f/1.4 editorial lens, balancing the subject with the glowing reflections along the glass.',
  'CONCEPT PRESET: V. Neon Alley Reverie. Same 7-Eleven style streetscape and overall styling, but framed as a tighter three-quarter portrait from just below the shoulders. The camera is at near eye level and close to the subject, emphasizing her turned face and subtle smirk as she glances past camera, the soda cup lifted near chin height so ice and straw glow against the head and hair or head covering defined by the base character. Neon kanji signs and shop lights break into streaks and halos behind her, blurring into a painterly wall of color. Captured on a Leica SL2-S with a 50mm f/1.4 portrait lens for an intimate, compressed perspective.',
  'CONCEPT PRESET: V. Neon Alley Reverie. A wider environmental view down the wet sidewalk, where the subject becomes a smaller, graphic figure walking along the edge of the convenience-store awning. The camera is pulled far back at waist height with a strong diagonal perspective so the row of shopfronts, neon signs and reflections stretch deep into the distance. She walks in profile with the soda cup relaxed at her side, the silhouette and outfit matching the base character design against glowing billboards and car headlights. Captured on a Leica SL2-S with a 28mm editorial wide-angle lens to exaggerate the vanishing lines of the alley and emphasize the city environment.',
  'CONCEPT PRESET: V. Neon Alley Reverie. A quiet, contemplative close-up at the edge of the same neon-soaked street, framed from just above the chest to the top of the head. The camera is placed slightly higher than eye level, angling gently down as the subject leans her cheek against one hand, elbow resting just out of frame, gaze drifting toward the glowing street. The head and hair or any head covering stay exactly as defined in the base character, catching a rim of cyan and orange light from nearby signs, while the soda cup rests blurred in the lower foreground. Background neon panels and traffic dissolve into soft bokeh. Captured on a Leica SL2-S with a 75mm f/1.4 portrait lens for a tight, cinematic study of expression.',

  // VI. Sky Ramp Legend (4 pose)
  'CONCEPT PRESET: VI. Sky Ramp Legend. Editorial three-quarter portrait on the open-air deck of a sunlit skatepark ramp, with the camera held at mid-torso height a few meters back instead of at the wheels. The subject stands near the lip of the ramp with the skateboard resting on its wheels beside one foot rather than blocking the frame, body turned slightly toward camera so both the sweeping concrete curves and distant skyline are visible behind. Wardrobe is bold streetwear: an oversized basketball jersey layered over light blue distressed high-waisted denim shorts, chunky sneakers and striped sport socks. Shoulder-length dark hair is slightly messy from the wind, catching the sunlight against a bright blue sky with scattered fluffy white clouds. The mood is fearless, cool and cinematic, like the opening hero frame of a skate culture fashion editorial captured on a Leica SL2 with a 35mm f/1.4 Summilux-SL lens for a balanced environmental portrait.',
  'CONCEPT PRESET: VI. Sky Ramp Legend. Same skatepark ramp, outfit and skateboard, but with the camera pushed much closer down to deck level at an extreme low angle so the board and sneakers dominate the lower frame. The subject still stands on the deck edge, one foot planted near the tail of the board while the other steps slightly forward, creating a powerful stance. The low-angle view exaggerates the size of the skateboard graphic and trucks, while the subject’s face appears smaller but sharply defined against the sky. Sunlight creates subtle rim light along the legs and shoes, with soft cloud shapes wrapping the upper background. Captured on a Leica SL2-S with a 24mm editorial wide-angle lens for a bold, exaggerated perspective.',
  'CONCEPT PRESET: VI. Sky Ramp Legend. A slightly wider composition that reveals more of the skatepark environment: concrete curves, railings and a hint of trees or city skyline in the distance. The subject walks slowly along the ramp edge with the skateboard still held upright at one side, sneakers and striped socks catching the light with each step. The camera remains very low and angled upward, turning the ramp into a leading line toward the subject while the vivid blue sky and scattered clouds fill most of the frame. The overall feeling is dynamic but controlled, like a fashion editorial celebrating skate culture, captured on a Leica SL2-S with a 28mm wide-angle lens to emphasize the flow of the park.',
  'CONCEPT PRESET: VI. Sky Ramp Legend. A grounded seated variation where the subject sits with a deliberate editorial slouch on the lip of the ramp, one leg dangling downward and the skateboard propped upright beside or between the legs. The camera stays low, looking up past the board and sneakers toward the subject’s face, hair gently blown by the breeze. The same jersey, denim shorts, chunky sneakers and striped socks keep the styling consistent, while warm sunlight and the open sky create a dreamy, free-spirited summer atmosphere. Captured on a Leica SL2-S with a 50mm editorial lens for a slightly tighter, cinematic portrait of the seated pose.',

  // VII. Sunlit Plaza Muse (4 pose)
  'CONCEPT PRESET: VII. Sunlit Plaza Muse. Hyper-realistic extreme high-angle street fashion portrait on a sunlit city plaza paved with warm-neutral gray stones. The camera is positioned about one meter above the subject, looking straight down to create subtle distortion from head to toe while keeping the face in crisp focus. The subject stands centered in the frame, wearing exactly the same outfit and head styling as defined in the base character description, with any glasses or accessories from the base design catching light cleanly. Hands clasped behind the back, chin slightly lowered while she looks up directly into camera. Soft morning sunlight filters through tree leaves, casting speckled shadows across the subject and the paving stones. There are no cars, no vehicles and no fire anywhere in the scene—only open plaza, trees and architecture—so the atmosphere stays bright, calm and editorial.',
  'CONCEPT PRESET: VII. Sunlit Plaza Muse. Same stone plaza and wardrobe following the base character design, but framed a bit tighter so the upper body and head dominate while the legs and shoes drift toward the bottom of the frame. The camera remains in an extreme high-angle position just above the subject, emphasizing the gaze toward camera and subtle expression. Her hands are still clasped behind her back, shoulders angled slightly, and the mix of hard sunlight and leaf-filtered shade paints patterned highlights on the outfit and tiles below. Shallow depth of field keeps the background softly blurred while the subject’s features and accessories stay razor sharp, and the environment remains a clean pedestrian plaza with no cars or burning objects.',
  'CONCEPT PRESET: VII. Sunlit Plaza Muse. A slightly wider variation where the grid of gray paving stones and elongated late-morning shadows become more prominent in the composition. The subject takes a small, graceful step forward toward the camera, one foot slightly ahead of the other, casting a crisp silhouette against the bright ground. The extreme high angle and 35mm perspective stretch the legs and skirt or trousers subtly, while the same base-character outfit remains unchanged. Dappled sunlight from overhead trees scatters across the ground, enhancing a playful yet polished editorial mood on an open, car-free plaza.',
  'CONCEPT PRESET: VII. Sunlit Plaza Muse. A more graphic, shadow-driven variation where the subject is placed slightly off-center on the plaza, allowing her own long shadow and the tree shadows to sweep diagonally across the paving stones. The camera still looks down from above, but pulled back enough to show more negative space around the figure. Styling stays identical to the base character—including wardrobe, accessories and any head covering or hairstyle—while the interplay of light and shadow on the tiles becomes the main design element. The setting remains a quiet pedestrian plaza with warm sun and architectural surroundings, explicitly without any cars, roads, explosions or burning vehicles.',

  // VIII. Studio Athleisure Groove (4 pose)
  'CONCEPT PRESET: VIII. Studio Athleisure Groove. Ultra-realistic high-fashion sportswear studio photoshoot on a clean, minimal white backdrop. Bright evenly diffused lighting eliminates harsh shadows while preserving subtle contrast for depth, with soft highlights accentuating fabric texture and sheen and extremely high-resolution detail on clothing, shoes and loose hair strands. The subject wears a fitted black sports bra, a lightweight black track jacket loosely draped over the arms, wide-leg black track pants with a reflective side stripe detail, chunky white athletic sneakers, a black baseball cap and sleek wireless over-ear headphones. She holds a dynamic crouching pose with one knee bent deep and the other foot planted forward, torso angled slightly toward camera and gaze sharp and confident. Cinematic neutral color grading and a modern athleisure street-style mood.',
  'CONCEPT PRESET: VIII. Studio Athleisure Groove. Same seamless white studio environment, outfit and headphones, but the crouching pose rotates into more of a three-quarter side angle. One knee points toward the viewer while the other leg extends diagonally back, creating a strong triangular base. The track jacket hangs open off the shoulders, sleeves gathering near the wrists to show the fitted sports bra and defined arms. Lighting remains bright and evenly diffused, casting only soft contact shadows beneath the sneakers and gentle gradients across the folds of the track pants.',
  'CONCEPT PRESET: VIII. Studio Athleisure Groove. A standing variation where the subject rises from the crouch into a poised, athletic stance in the same white studio. One hip shifts slightly to the side, one hand resting near the waistband or jacket hem while the other drops loosely by the leg. The wide-leg track pants with reflective stripe fall in clean vertical lines, chunky sneakers grounded against the white floor, and the open jacket frames the fitted sports bra. The camera stays around mid-torso height and frames from head to shoes, while the neutral background and soft studio light keep all attention on the athleisure styling and confident posture.',
  'CONCEPT PRESET: VIII. Studio Athleisure Groove. A walk-in-place variation captured mid-step against the same clean white backdrop. The subject strides slowly toward camera, one foot just lifting or touching down while the wide-leg pants swing slightly and the open jacket flows gently around the torso. Headphones and cap stay perfectly consistent, expression effortlessly confident and self-assured as if moving to music. Even, high-key studio lighting wraps smoothly around the figure, with subtle motion in fabric folds and shoelaces adding a sense of rhythm to the modern sportswear editorial.',
];

type AngleGroupDef = { id: string; title: string; subtitle: string };

const ANGLE_GROUPS_BASE: AngleGroupDef[] = [
  { id: '1', title: '1 · Inferno Street Rebel', subtitle: 'Angles 1–4' },
  { id: '2', title: '2 · Daisy Daydream', subtitle: 'Angles 5–8' },
  { id: '3', title: '3 · Cathedral City Chronicle', subtitle: 'Angles 9–12' },
  { id: '4', title: '4 · Skyline Bridge Muse', subtitle: 'Angles 13–16' },
  { id: '5', title: '5 · Neon Alley Reverie', subtitle: 'Angles 17–20' },
  { id: '6', title: '6 · Sky Ramp Legend', subtitle: 'Angles 21–24' },
  { id: '7', title: '7 · Sunlit Plaza Muse', subtitle: 'Angles 25–28' },
  { id: '8', title: '8 · Studio Athleisure Groove', subtitle: 'Angles 29–32' },
];

const ANGLE_GROUPS_ID: AngleGroupDef[] = [
  { id: '1', title: '1 · Inferno Street Rebel', subtitle: 'Sudut 1–4' },
  { id: '2', title: '2 · Daisy Daydream', subtitle: 'Sudut 5–8' },
  { id: '3', title: '3 · Cathedral City Chronicle', subtitle: 'Sudut 9–12' },
  { id: '4', title: '4 · Skyline Bridge Muse', subtitle: 'Sudut 13–16' },
  { id: '5', title: '5 · Neon Alley Reverie', subtitle: 'Sudut 17–20' },
  { id: '6', title: '6 · Sky Ramp Legend', subtitle: 'Sudut 21–24' },
  { id: '7', title: '7 · Sunlit Plaza Muse', subtitle: 'Sudut 25–28' },
  { id: '8', title: '8 · Studio Athleisure Groove', subtitle: 'Sudut 29–32' },
];

const ANGLE_GROUPS_MS: AngleGroupDef[] = [
  { id: '1', title: '1 · Inferno Street Rebel', subtitle: 'Sudut 1–4' },
  { id: '2', title: '2 · Daisy Daydream', subtitle: 'Sudut 5–8' },
  { id: '3', title: '3 · Cathedral City Chronicle', subtitle: 'Sudut 9–12' },
  { id: '4', title: '4 · Skyline Bridge Muse', subtitle: 'Sudut 13–16' },
  { id: '5', title: '5 · Neon Alley Reverie', subtitle: 'Sudut 17–20' },
  { id: '6', title: '6 · Sky Ramp Legend', subtitle: 'Sudut 21–24' },
  { id: '7', title: '7 · Sunlit Plaza Muse', subtitle: 'Sudut 25–28' },
  { id: '8', title: '8 · Studio Athleisure Groove', subtitle: 'Sudut 29–32' },
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

const GenerateConceptPage: React.FC = () => {
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
  const [visibleCardIds, setVisibleCardIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<number>(Date.now());
  const cardRevealTimeouts = useRef<NodeJS.Timeout[]>([]);
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

  React.useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => {
      setError(null);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [error]);

  // Countdown timer for placeholders (v1.2.0+)
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
        if (elapsed > img.estimatedTotalSeconds + 30) {
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
        if (elapsed > vid.estimatedTotalSeconds + 30) {
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

  const getRemainingSecondsForImage = (image: CharacterImageOutput | null): number => {
    if (!image || !image.startedAt || !image.estimatedTotalSeconds) return 0;
    const elapsed = Math.floor((now - image.startedAt) / 1000);
    const remaining = Math.max(0, image.estimatedTotalSeconds - elapsed);
    return remaining;
  };

  const getCountdownMessage = (image: CharacterImageOutput | null): string | null => {
    if (!image || image.status !== 'generating') return null;
    const remaining = getRemainingSecondsForImage(image);
    if (remaining <= 0) return null;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isAngleEnabled = useCallback(
    (index: number) => {
      const groupIndex = getAngleGroupIndex(index);
      if (groupIndex < 0) return true;
      return enabledAngleGroups[groupIndex] !== false;
    },
    [enabledAngleGroups],
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
            const friendlyMessage = t.conceptGenerator.logVideoFilteredError;
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
    const prefixedMessage = `[Concept] ${message}`;
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
      addLog('INFO', t.logMessages.concept.analysisStarted);

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
          t.conceptGenerator.logAnalysisFailed;
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
      addLog('SUCCESS', t.logMessages.concept.analysisSuccess);
      setAnalysisSuccess(true);
    } catch (err: any) {
      const message =
        err?.message || t.conceptGenerator.logAnalysisError;
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
    addLog('INFO', t.logMessages.concept.photoRemoved);
  };

  const handleRegenerateImage = async (index: number, options?: { bypassGuard?: boolean }) => {
    if (!options?.bypassGuard && (isLoading || regeneratingIndex !== null)) return;

    if (!isAngleEnabled(index)) {
      addLog('INFO', t.logMessages.concept.angleDisabled);
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
      addLog('ERROR', t.conceptGenerator.logRegenBearerMissing.replace('{message}', bearerTokenMissingMessage));
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(engineNotAvailableMessage);
      addLog('ERROR', t.conceptGenerator.logRegenEngineNotAvailable.replace('{message}', engineNotAvailableMessage));
      return;
    }

    const mainPrompt = buildConceptPrompt(formData);

    const angleIdx = index;
    const isExtended = angleIdx >= PREVIEW_LABELS.length;

    let baseAngle: string;
    let label: string;
    let conceptPreset: string;

    if (!isExtended) {
      baseAngle =
        PROFESSIONAL_ANGLE_DESCRIPTIONS[angleIdx] || PROFESSIONAL_ANGLE_DESCRIPTIONS[0];
      label = PREVIEW_LABELS[angleIdx] || `Professional angle ${angleIdx + 1}`;
      conceptPreset = MAIN_CONCEPT_PRESETS[angleIdx] || '';
    } else {
      const localIndex = angleIdx - PREVIEW_LABELS.length;
      baseAngle =
        EXTENDED_ANGLE_DESCRIPTIONS[localIndex] || EXTENDED_ANGLE_DESCRIPTIONS[0];
      label = EXTENDED_PREVIEW_LABELS[localIndex] || `Extended angle ${localIndex + 1}`;
      conceptPreset = EXTENDED_CONCEPT_PRESETS[localIndex] || '';
    }

    const promptForIndex = `${mainPrompt} ${conceptPreset} CRITICAL: Ignore any example outfits or wardrobe variations described in this concept preset. The subject must wear the exact same outfit and accessories as described in the base character description; do not change any clothing items, colors, or accessories across all images. IMPORTANT: The person in this image MUST be the exact same subject as in the other images, with identical face, skin tone, hairstyle, outfit, and accessories. Do NOT change the identity or clothing at all. Only change the body pose and camera angle. Professional angle ${
      angleIdx + 1
    }: ${baseAngle}.`;

    try {
      setRegeneratingIndex(index);
      
      // Set placeholder dengan status generating dan countdown (v1.2.0+)
      setAngleImages((prev) => {
        const next = [...prev];
        if (angleIdx >= 0 && angleIdx < next.length) {
          next[angleIdx] = {
            dataUrl: prev[angleIdx]?.dataUrl || '',
            status: 'generating' as const,
            startedAt: Date.now(),
            estimatedTotalSeconds: 300,
            prompt: label,
          };
        }
        return next;
      });
      
      addLog('INFO', `${t.logMessages.concept.regenerateStarted}: ${label}`);

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
        const message = response?.error || t.conceptGenerator.logEngineRegenInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      const result = results[0];

      if (!result || !result.success || !result.dataUrl) {
        const errMsg: string = result?.error || t.conceptGenerator.logEngineRegenFailed;
        setError(errMsg);
        addLog('ERROR', t.conceptGenerator.logRegenFailed.replace('{label}', label).replace('{error}', errMsg));
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
            prompt: existingImage?.prompt || label,
          };
        }
        return next;
      });

      setSelectedPreviewImage(newUrl);
      setLightboxImage(newUrl);
      addLog('SUCCESS', `${t.logMessages.concept.regenerateSuccess}: ${label}`);
    } catch (err: any) {
      const message = err?.message || t.conceptGenerator.logRegenError;
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
      .map((src, index) => ({ src, index }))
      .filter((item) => !!item.src);

    if (!downloadTargets.length) return;

    addLog('INFO', t.logMessages.concept.zipPreparing);

    // eslint-disable-next-line no-restricted-syntax
    for (const { src, index } of downloadTargets) {
      const url = src as string;
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
        const filename = `concept-${safeLabel}${setSuffix}.png`;

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
    link.setAttribute('download', 'concept-turnaround.zip');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);

    URL.revokeObjectURL(zipUrl);
    addLog('SUCCESS', t.logMessages.concept.zipReady);
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
      addLog('ERROR', t.logMessages.concept.editOpenFailed);
      return;
    }

    if (!src.startsWith('data:image')) {
      addLog('ERROR', t.conceptGenerator.logEditOpenInvalidFormat.replace('{index}', String(index + 1)));
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
      addLog('ERROR', t.logMessages.concept.editInstructionEmpty);
      return;
    }

    if (!imageUrl.startsWith('data:image')) {
      addLog('ERROR', t.conceptGenerator.logEditRunInvalidFormat.replace('{index}', String(index + 1)));
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.editStoryFrame) {
      addLog(
        'ERROR',
        t.conceptGenerator.logEditEngineNotAvailable.replace('{index}', String(index + 1)),
      );
      return;
    }

    const bearerKey =
      typeof window !== 'undefined' ? localStorage.getItem('zeoStudio.bearerToken') || '' : '';
    if (!bearerKey.trim()) {
      const message = bearerTokenMissingMessage;
      addLog('ERROR', t.conceptGenerator.logEditBearerMissing.replace('{index}', String(index + 1)).replace('{message}', message));
      setError(message);
      return;
    }

    const label = getAngleLabelByIndex(index);

    const editInstructionText = `Based on this instruction: "${editInstruction}", edit the following concept fashion portrait of the same subject. The result must be a SINGLE, unified concept image (no collages, no multiple panels, no UI). CRITICAL RULE: The subject's face, skin tone, hairstyle, outfit, and overall identity MUST remain identical to the other concept images; only adjust body pose, camera angle, and subtle background details. The final image aspect ratio MUST BE exactly ${aspectRatio}.`;

    addLog('INFO', t.conceptGenerator.logEditProcessing.replace('{label}', label));

    setCharacterEditModal((prev) => ({ ...prev, isSubmitting: true, isOpen: false }));
    setEditingIndex(index);

    // Set placeholder dengan status generating dan countdown (v1.2.0+)
    setAngleImages((prev) => {
      const next = [...prev];
      if (index >= 0 && index < next.length) {
        next[index] = {
          dataUrl: prev[index]?.dataUrl || '',
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: 300,
          prompt: label,
        };
      }
      return next;
    });

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
        const message = (result && result.error) || t.conceptGenerator.logNewImageFailed;
        addLog('ERROR', t.conceptGenerator.logEditFailed.replace('{label}', label).replace('{error}', message));
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
            prompt: existingImage?.prompt || label,
          };
        }
        return next;
      });

      setSelectedPreviewImage(newUrl);
      setLightboxImage(newUrl);
      addLog('SUCCESS', t.conceptGenerator.logEditSuccess.replace('{label}', label));
      setCharacterEditModal((prev) => ({ ...prev, isSubmitting: false }));
    } catch (err: any) {
      const message = err?.message || String(err);
      addLog('ERROR', t.conceptGenerator.logEditFailed.replace('{label}', label).replace('{error}', message));
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
      addLog('ERROR', t.conceptGenerator.logExtendBearerMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(engineNotAvailableMessage);
      addLog('ERROR', t.conceptGenerator.logExtendEngineNotAvailable);
      return;
    }

    const mainPrompt = buildConceptPrompt(formData);

    const totalExtendedAngles = EXTENDED_ANGLE_DESCRIPTIONS.length;
    const totalExtendedBatches = Math.ceil(totalExtendedAngles / CHARACTER_ANGLE_BATCH_SIZE);

    if (nextExtendedCharacterAngleIndex >= totalExtendedAngles) {
      addLog('INFO', t.conceptGenerator.logExtendAllDone);
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
        ? t.conceptGenerator.logExtendStarting
        : t.conceptGenerator.logExtendContinuing.replace('{batch}', String(currentExtendBatchIndexLocal)).replace('{total}', String(totalExtendedBatches)),
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
          const conceptPreset = EXTENDED_CONCEPT_PRESETS[localIndex] || '';
          const basePrompt = `${mainPrompt} ${conceptPreset} CRITICAL: Ignore any example outfits or wardrobe variations described in this concept preset. The subject must wear the exact same outfit and accessories as described in the base character description; do not change any clothing items, colors, or accessories across all images. IMPORTANT: The person in this image MUST be the exact same subject as in the other images, with identical face, skin tone, hairstyle, outfit, and accessories. Do NOT change the identity or clothing at all. Only change the body pose and camera angle.`;
          const anglePrompt = `${basePrompt} Advanced angle ${localIndex + 1}: ${angleText}.`;
          items.push({ category: 'ugc', prompt: anglePrompt });
          addLog('INFO', t.conceptGenerator.logExtendPreparing.replace('{label}', labelBase));
        });

        if (items.length > 0) break;

        const groupIndex = 4 + Math.floor(batchStart / 4);
        const groupTitle = angleGroups[groupIndex]?.title || `Group ${groupIndex + 1}`;
        addLog(
          'INFO',
          t.conceptGenerator.logExtendSkipped.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalExtendedBatches)).replace('{group}', groupTitle),
        );
        cursor = batchEnd;
      }

      if (items.length === 0) {
        addLog('INFO', t.conceptGenerator.logExtendNoLabels);
        return;
      }

      {
        const groupIndex = 4 + Math.floor(batchStart / 4);
        const groupTitle = angleGroups[groupIndex]?.title || `Group ${groupIndex + 1}`;
        addLog(
          'INFO',
          t.conceptGenerator.logExtendRunning.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalExtendedBatches)).replace('{group}', groupTitle),
        );
      }

      let modelRawBase64List: string[] = [];
      if (uploadedImage) {
        const base64 = await fileToBase64(uploadedImage.file);
        modelRawBase64List = [base64];
      }

      addLog(
        'INFO',
        t.conceptGenerator.logExtendSending.replace('{count}', String(items.length)).replace('{ratio}', aspectRatio).replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalExtendedBatches)),
      );

      // Progressive placeholder creation dengan countdown (v1.2.0+)
      const extendedAngleImages: (CharacterImageOutput | null)[] = [...angleImages];
      const globalBatchEnd = PREVIEW_LABELS.length + batchEnd;
      if (extendedAngleImages.length < globalBatchEnd) {
        const oldLength = extendedAngleImages.length;
        extendedAngleImages.length = globalBatchEnd;
        for (let i = oldLength; i < globalBatchEnd; i += 1) {
          extendedAngleImages[i] = null;
        }
      }

      batchTargets.forEach((target, idx) => {
        const { globalIndex, localIndex } = target;
        const label = EXTENDED_PREVIEW_LABELS[localIndex] || `Extended angle ${localIndex + 1}`;

        // Set placeholder dengan status generating dan countdown
        extendedAngleImages[globalIndex] = {
          dataUrl: '',
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: 300,
          prompt: label,
        };

        // Progressive reveal dengan setTimeout
        const cardId = `concept-image-${globalIndex}`;
        const timeout = setTimeout(() => {
          setVisibleCardIds((prevVisible) => new Set([...prevVisible, cardId]));
        }, idx * 2000); // 2 detik delay antar card
        cardRevealTimeouts.current.push(timeout);
      });

      setAngleImages(extendedAngleImages);

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
        const message = response?.error || t.conceptGenerator.logExtendEngineInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      if (!results.length) {
        throw new Error(t.conceptGenerator.logExtendNoResults);
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
          const existingImage = extendedAngleImages[globalIndex];
          extendedAngleImages[globalIndex] = {
            dataUrl: r.dataUrl,
            status: 'completed' as const,
            startedAt: existingImage?.startedAt,
            estimatedTotalSeconds: existingImage?.estimatedTotalSeconds,
            prompt: existingImage?.prompt || labelBase,
          };
          successCount += 1;
          successLabels.push(labelBase);
        } else if (r) {
          failedWithErrorCount += 1;
          const errMsg: string =
            (typeof r.error === 'string' && r.error.trim()) ||
            t.conceptGenerator.logEngineFailedLabel;
          addLog('ERROR', t.conceptGenerator.logExtendFailed.replace('{label}', label).replace('{error}', errMsg));
        }
      }

      const missingCount = batchRequested > batchReturned ? batchRequested - batchReturned : 0;

      setAngleImages(extendedAngleImages);

      const firstBatchIndex = extendedAngleImages.findIndex((img, idx) => {
        const localIdx = idx - PREVIEW_LABELS.length;
        if (localIdx < batchStart || localIdx >= batchEnd) return false;
        if (!isAngleEnabled(idx)) return false;
        return !!img?.dataUrl;
      });
      if (firstBatchIndex >= 0) {
        setSelectedPreviewImage(extendedAngleImages[firstBatchIndex]?.dataUrl || null);
      }

      if (successCount > 0) {
        addLog(
          'SUCCESS',
          t.conceptGenerator.logExtendBatchComplete.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalExtendedBatches)).replace('{success}', String(successCount)).replace('{requested}', String(batchRequested)),
        );
        addLog('INFO', t.conceptGenerator.logExtendBatchAngles.replace('{labels}', successLabels.join('; ')));
      }

      if (failedWithErrorCount > 0 || missingCount > 0) {
        addLog(
          'INFO',
          t.conceptGenerator.logExtendBatchSummary.replace('{batch}', String(batchIndexDisplay)).replace('{requested}', String(batchRequested)).replace('{returned}', String(batchReturned)).replace('{success}', String(successCount)).replace('{failed}', String(failedWithErrorCount)).replace('{missing}', String(missingCount)),
        );
      }

      setNextExtendedCharacterAngleIndex(batchEnd);
    } catch (err: any) {
      const message = err?.message || t.conceptGenerator.logExtendError;
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
      addLog('ERROR', t.conceptGenerator.logGenerateBearerMissing);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.generateAffiliateImages) {
      setError(engineNotAvailableMessage);
      addLog('ERROR', t.conceptGenerator.logGenerateEngineNotAvailable);
      return;
    }

    const mainPrompt = buildConceptPrompt(formData);

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
      
      // Clear card reveal timeouts untuk progressive rendering (v1.2.0+)
      cardRevealTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      cardRevealTimeouts.current = [];
      setVisibleCardIds(new Set());
      
      addLog('INFO', t.conceptGenerator.logGenerateStarting);
    }

    addLog(
      'INFO',
      isFirstBatch
        ? t.conceptGenerator.logGenerateDetermining
        : t.conceptGenerator.logGenerateContinuing.replace('{batch}', String(currentBatchIndex)).replace('{total}', String(totalBatches)),
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
          const label = PREVIEW_LABELS[globalIndex] || `Professional angle ${globalIndex + 1}`;
          const conceptPreset = MAIN_CONCEPT_PRESETS[globalIndex] || '';
          const anglePrompt = `${mainPrompt} ${conceptPreset} CRITICAL: Ignore any example outfits or wardrobe variations described in this concept preset. The subject must wear the exact same outfit and accessories as described in the base character description; do not change any clothing items, colors, or accessories across all images. IMPORTANT: The person in this image MUST be the exact same subject as in the other images, with identical face, skin tone, hairstyle, outfit, and accessories. Do NOT change the identity or clothing at all. Only change the body pose and camera angle. Professional angle ${
            globalIndex + 1
          }: ${angleText}.`;
          items.push({ category: 'ugc', prompt: anglePrompt });
          addLog('INFO', t.conceptGenerator.logGeneratePreparing.replace('{label}', label));
        });

        if (items.length > 0) break;

        const groupIndex = Math.floor(batchStart / 4);
        const groupTitle = angleGroups[groupIndex]?.title || `Group ${groupIndex + 1}`;
        addLog('INFO', t.conceptGenerator.logGenerateSkipped.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)).replace('{group}', groupTitle));
        cursor = batchEnd;
      }

      if (items.length === 0) {
        addLog('INFO', t.conceptGenerator.logGenerateNoLabels);
        return;
      }

      {
        const groupIndex = Math.floor(batchStart / 4);
        const groupTitle = angleGroups[groupIndex]?.title || `Group ${groupIndex + 1}`;
        addLog('INFO', t.conceptGenerator.logGenerateRunning.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)).replace('{group}', groupTitle));
      }

      let modelRawBase64List: string[] = [];
      if (uploadedImage) {
        const base64 = await fileToBase64(uploadedImage.file);
        modelRawBase64List = [base64];
      }

      if (items.length === 0) {
        addLog(
          'INFO',
          t.conceptGenerator.logGenerateAllSkipped.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)),
        );
        setNextCharacterAngleIndex(batchEnd);
        return;
      }

      addLog(
        'INFO',
        t.conceptGenerator.logGenerateSending.replace('{count}', String(items.length)).replace('{ratio}', aspectRatio).replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)),
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
        const label = PREVIEW_LABELS[globalIndex] || `Professional angle ${globalIndex + 1}`;

        // Set placeholder dengan status generating dan countdown
        placeholderImages[globalIndex] = {
          dataUrl: '',
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: 300,
          prompt: label,
        };

        // Progressive reveal dengan setTimeout
        const cardId = `concept-image-${globalIndex}`;
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
        const message = response?.error || t.conceptGenerator.logGenerateEngineInvalid;
        throw new Error(message);
      }

      const results: any[] = Array.isArray(response.results) ? response.results : [];
      if (!results.length) {
        throw new Error(t.conceptGenerator.logGenerateNoResults);
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
        const label = PREVIEW_LABELS[globalIndex] || `Professional angle ${globalIndex + 1}`;

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
            t.conceptGenerator.logEngineFailedLabel;
          addLog('ERROR', t.conceptGenerator.logEngineFailed.replace('{label}', label).replace('{error}', errMsg));
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
          t.conceptGenerator.logGenerateBatchComplete.replace('{batch}', String(batchIndexDisplay)).replace('{total}', String(totalBatches)).replace('{success}', String(successCount)).replace('{requested}', String(batchRequested)).replace('{totalSuccess}', String(totalSuccessSoFar)).replace('{totalAngles}', String(totalAngles)),
        );
        addLog('INFO', t.conceptGenerator.logGenerateBatchAngles.replace('{labels}', successLabels.join('; ')));
      }

      if (failedWithErrorCount > 0 || missingCount > 0) {
        addLog(
          'INFO',
          t.conceptGenerator.logGenerateBatchSummary.replace('{batch}', String(batchIndexDisplay)).replace('{requested}', String(batchRequested)).replace('{returned}', String(batchReturned)).replace('{success}', String(successCount)).replace('{failed}', String(failedWithErrorCount)).replace('{missing}', String(missingCount)),
        );
      }

      setNextCharacterAngleIndex(batchEnd);
    } catch (err: any) {
      const message = err?.message || t.conceptGenerator.logGenerateError;
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
        t.conceptGenerator.logMainLabelsDisabled,
      );
      await handleExtendGenerate();
      return;
    }

    addLog('INFO', t.conceptGenerator.logNoAngleLabels);
  };

  const allPreviewImages = angleImages;
  const hasGeneratedOnce = allPreviewImages.length > 0;
  const successfulImageCount = allPreviewImages.filter((img) => !!img?.dataUrl).length;

  const visibleAngleEntries = allPreviewImages
    .map((img, index) => ({ src: img, index }))
    .filter(({ src: img, index }) => {
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
    (img, idx) => idx >= PREVIEW_LABELS.length && !!img?.dataUrl,
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

  const hasFailedAngles = angleImages.some((img, idx) => isAngleEnabled(idx) && !img?.dataUrl);

  const mainPreviewImage: string | null =
    selectedPreviewImage || (allPreviewImages.length > 0 ? allPreviewImages.find((img) => !!img?.dataUrl)?.dataUrl || null : null);

  const getAngleLabelByIndex = (index: number): string => {
    if (index < 0) return t.conceptGenerator.noPhotoYet;
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
      addLog('INFO', t.conceptGenerator.logVideoAngleDisabled.replace('{label}', getAngleLabelByIndex(index)));
      return;
    }

    const imageOutput = angleImages[index];
    const src = imageOutput?.dataUrl || '';
    const label = getAngleLabelByIndex(index) || `Angle ${index + 1}`;

    if (!src) {
      addLog('ERROR', t.conceptGenerator.logVideoNoPhoto.replace('{label}', label));
      return;
    }

    if (videoGeneratingIndexes.includes(index)) {
      return;
    }

    if (!src.startsWith('data:image')) {
      addLog(
        'ERROR',
        t.conceptGenerator.logVideoInvalidFormat.replace('{label}', label),
      );
      return;
    }

    const parts = src.split(',');
    if (parts.length < 2 || !parts[1].trim()) {
      addLog(
        'ERROR',
        t.conceptGenerator.logVideoInvalidData.replace('{label}', label),
      );
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI?.startAffiliateVideoWorkflow) {
      const message = t.conceptGenerator.logVideoEngineNotAvailable;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const bearerKey = localStorage.getItem('zeoStudio.bearerToken') || '';
    if (!bearerKey.trim()) {
      const message = t.conceptGenerator.logVideoBearerMissing;
      setError(message);
      addLog('ERROR', message);
      return;
    }

    const downloadPath = localStorage.getItem('zeoStudio.folder.output') || '';
    if (!downloadPath.trim()) {
      const message = t.conceptGenerator.logVideoOutputMissing;
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
      
      // Set video placeholder dengan countdown (v1.2.0+)
      setAngleVideos((prev) => {
        const next = [...prev];
        if (next.length <= index) {
          const oldLength = next.length;
          next.length = index + 1;
          for (let i = oldLength; i < next.length; i += 1) {
            next[i] = null;
          }
        }
        next[index] = {
          dataUrl: '',
          status: 'generating' as const,
          startedAt: Date.now(),
          estimatedTotalSeconds: 300,
          prompt: scenePrompt,
        };
        return next;
      });
      
      addLog('INFO', t.conceptGenerator.logVideoStarting.replace('{label}', label));

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
      const message = err?.message || t.conceptGenerator.logVideoError;
      setError(message);
      addLog('ERROR', message);
      setVideoGeneratingIndexes((prev) => prev.filter((i) => i !== index));
    }
  };

  const handleGenerateAllVideos = async () => {
    if (isBatchVideoRunning || anyLoading || videoGeneratingIndexes.length > 0) {
      addLog(
        'ERROR',
        t.conceptGenerator.logConvertAllBusy,
      );
      return;
    }

    const targets = angleImages
      .map((src, index) => ({ src, index }))
      .filter(({ src, index }) => isAngleEnabled(index) && !!src && !angleVideos[index]);

    if (!targets.length) {
      addLog(
        'INFO',
        t.conceptGenerator.logConvertAllNoTargets,
      );
      return;
    }

    const MAX_PARALLEL_VIDEO = 8;

    addLog(
      'INFO',
      t.conceptGenerator.logConvertAllStarting.replace('{count}', String(targets.length)).replace('{max}', String(MAX_PARALLEL_VIDEO)),
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
        t.conceptGenerator.logConvertAllComplete,
      );
    } catch (err: any) {
      const message =
        err?.message ||
        t.conceptGenerator.logConvertAllError;
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
        iconId="generate-concept"
        iconClassName="h-6 w-6 mr-3 text-white"
        title={t.conceptGenerator.title}
        description={t.conceptGenerator.description}
        tutorialUrl={CONCEPT_TUTORIAL_URL}
        tutorialTitle="Tutorial Generate Concept"
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
                  {t.conceptGenerator.sectionReferencePhoto}
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  {t.conceptGenerator.uploadReferencePhotoDesc}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="w-28 h-28 bg-zinc-950 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center text-center text-gray-400 text-[11px] cursor-pointer hover:border-purple-500 transition shrink-0">
                    <label className="w-full h-full flex items-center justify-center cursor-pointer">
                      {uploadedImage ? (
                        <img
                          src={uploadedImage.preview}
                          alt="concept reference"
                          className="w-full h-full object-cover rounded-md"
                        />
                      ) : (
                        <span>{t.conceptGenerator.clickToUpload}</span>
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
                        Remove Reference Photo
                      </button>
                    )}
                    <div className="text-[11px] text-gray-400">
                      {t.conceptGenerator.noPhotoWarning}
                    </div>
                    {isAnalyzing && (
                      <div className="text-[11px] text-purple-300 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                        <span>{t.logMessages.concept.analysisStarted}</span>
                      </div>
                    )}
                    {!isAnalyzing && analysisSuccess && (
                      <div className="mt-1 text-[11px] text-emerald-300 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>{t.logMessages.concept.analysisSuccess}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <h2 className="text-sm font-semibold text-gray-100">
                  {t.conceptGenerator.sectionIdentity}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <LabeledInput
                    label={t.conceptGenerator.labelConceptName}
                    name="namaKarakter"
                    value={formData.namaKarakter}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelSubjectType}
                    name="jenisKelamin"
                    value={formData.jenisKelamin}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelAge}
                    name="usia"
                    value={formData.usia}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelEthnicity}
                    name="etnis"
                    value={formData.etnis}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelSkinColor}
                    name="warnaKulit"
                    value={formData.warnaKulit}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelFaceShape}
                    name="bentukWajah"
                    value={formData.bentukWajah}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelEyeColor}
                    name="warnaMata"
                    value={formData.warnaMata}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelEyeShape}
                    name="bentukMata"
                    value={formData.bentukMata}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelEyeDetail}
                    name="detailMata"
                    value={formData.detailMata}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelNoseShape}
                    name="bentukHidung"
                    value={formData.bentukHidung}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelLipShape}
                    name="bentukBibir"
                    value={formData.bentukBibir}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelLipColor}
                    name="warnaBibir"
                    value={formData.warnaBibir}
                    onChange={handleFormChange as any}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <h2 className="text-sm font-semibold text-gray-100">
                  {t.conceptGenerator.sectionHairBody}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <LabeledInput
                    label={t.conceptGenerator.labelHairLength}
                    name="panjangRambut"
                    value={formData.panjangRambut}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelHairStyle}
                    name="gayaRambut"
                    value={formData.gayaRambut}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelStyleDetail}
                    name="detailGaya"
                    value={formData.detailGaya}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelHeight}
                    name="tinggiBadan"
                    value={formData.tinggiBadan}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelBodyShape}
                    name="bentukTubuh"
                    value={formData.bentukTubuh}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelTattoo}
                    name="tato"
                    value={formData.tato}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelBirthmark}
                    name="tandaLahir"
                    value={formData.tandaLahir}
                    onChange={handleFormChange as any}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <LabeledInput
                    label={t.conceptGenerator.labelClothingStyle}
                    name="gayaPakaian"
                    value={formData.gayaPakaian}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelTop}
                    name="atasan"
                    value={formData.atasan}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelBottom}
                    name="bawahan"
                    value={formData.bawahan}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelOuterwear}
                    name="outerwear"
                    value={formData.outerwear}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelFootwear}
                    name="alasKaki"
                    value={formData.alasKaki}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelColorPattern}
                    name="warnaPola"
                    value={formData.warnaPola}
                    onChange={handleFormChange as any}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <LabeledInput
                    label={t.conceptGenerator.labelEarrings}
                    name="anting"
                    value={formData.anting}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelNeckAccessory}
                    name="aksesorisLeher"
                    value={formData.aksesorisLeher}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelHandAccessory}
                    name="aksesorisTangan"
                    value={formData.aksesorisTangan}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelGlasses}
                    name="kacamata"
                    value={formData.kacamata}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelHeadwear}
                    name="penutupKepala"
                    value={formData.penutupKepala}
                    onChange={handleFormChange as any}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <h2 className="text-sm font-semibold text-gray-100">Expression, Environment & Visual Style</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <LabeledInput
                    label={t.conceptGenerator.labelExpression}
                    name="ekspresi"
                    value={formData.ekspresi}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelPosture}
                    name="postur"
                    value={formData.postur}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelCompanionObject}
                    name="bendaPendamping"
                    value={formData.bendaPendamping}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelEnvironment}
                    name="lingkungan"
                    value={formData.lingkungan}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelArtStyle}
                    name="gayaSeni"
                    value={formData.gayaSeni}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelQuality}
                    name="kualitas"
                    value={formData.kualitas}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelLighting}
                    name="pencahayaan"
                    value={formData.pencahayaan}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelColorPalette}
                    name="paletWarna"
                    value={formData.paletWarna}
                    onChange={handleFormChange as any}
                  />
                  <LabeledInput
                    label={t.conceptGenerator.labelShotType}
                    name="tipeShot"
                    value={formData.tipeShot}
                    onChange={handleFormChange as any}
                  />
                </div>

                <LabeledTextarea
                  label={t.conceptGenerator.labelNegativePrompt}
                  name="promptNegatif"
                  value={formData.promptNegatif}
                  onChange={handleFormChange as any}
                  rows={3}
                />
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-4">
                <div>
                  <span className="block text-xs font-semibold text-gray-300 mb-2">{t.conceptGenerator.aspectRatio}</span>
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
                    <span className="block text-xs font-semibold text-gray-300">{t.conceptGenerator.angleGroups}</span>
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
                  ? t.conceptGenerator.generatingConcept
                  : authReady
                  ? t.conceptGenerator.generateConceptTurnaround
                  : t.conceptGenerator.testTokenFirst}
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
                    <span className="text-[10px] text-gray-500">
                      {t.activityLog.entriesLabel.replace('{count}', String(activityLogs.length))}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                  {activityLogs.length === 0 ? (
                    <p className="text-[11px] text-gray-500">
                      {t.conceptGenerator.noActivity}
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
              <h3 className="text-lg font-semibold text-gray-50">{t.conceptGenerator.previewTitle}</h3>
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
                <span>{t.conceptGenerator.clearData}</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col px-6 py-4 min-h-0 overflow-y-auto custom-scrollbar">
              {isLoading && !hasGeneratedOnce && (
                <div className="flex-1 flex items-center justify-center">
                  <GradientLoader
                    size="md"
                    text={t.conceptGenerator.generatingConcept}
                    subtitle="Mohon tunggu"
                    showLogo={false}
                  />
                </div>
              )}

              {!isLoading && !hasGeneratedOnce && (
                <div className="flex-1 flex items-center justify-center bg-zinc-950/40 rounded-lg text-gray-500 text-center text-xs p-4">
                  <p>
                    {t.conceptGenerator.previewHint}
                    {' '}
                    <span className="font-semibold text-gray-300">{t.conceptGenerator.generateConceptTurnaround}</span>.
                  </p>
                </div>
              )}

              {!isLoading && hasGeneratedOnce && (
                <div className="mb-3 text-[11px] text-gray-300">
                  <span className="font-semibold text-gray-100">
                    {t.conceptGenerator.previewStatsTotal.replace('{count}', String(successfulImageCount))}
                  </span>
                  <span className="mx-1 text-gray-500">·</span>
                  <span className="text-gray-300">
                    {t.conceptGenerator.previewStatsAngles
                      .replace('{slots}', String(visibleAngleEntries.length))
                      .replace('{batch}', String(Math.ceil(visibleAngleEntries.length / PREVIEW_LABELS.length)))
                      .replace('{label}', activeLabel)}
                  </span>
                  <p className="text-gray-500 mt-0.5">
                    {t.conceptGenerator.gridInstruction}
                  </p>
                </div>
              )}

              {hasGeneratedOnce && (
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-100">{t.conceptGenerator.turnaroundTitle}</h4>
                      <p className="text-[10px] text-gray-500">
                        {t.conceptGenerator.turnaroundDesc}
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
                          {isBatchVideoRunning ? t.workflow.status.processing : t.conceptGenerator.convertAllToVideo}
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
                              : t.conceptGenerator.next4AnglesBatch
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
                                ? t.conceptGenerator.next4AnglesBatch
                                    .replace('{batch}', String(currentExtendBatchIndexUiGlobal))
                                    .replace('{total}', String(totalEnabledAngleBatchesUi))
                                : t.conceptGenerator.continue4AnglesBatch
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
                      const cardId = `concept-image-${index}`;
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
                                  {t.conceptGenerator.generateVideoStatus}
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
                                {countdownMsg && (
                                  <div className="text-sm text-purple-300 font-bold">{countdownMsg}</div>
                                )}
                                {(isCardRegenerating || isCardEditing) && (
                                  <div className="mt-1 text-[10px] text-gray-200 px-2 text-center">
                                    {isCardRegenerating ? 'Regenerasi...' : 'Editing...'}
                                  </div>
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
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-[10px] text-gray-500">
                              <span>{t.conceptGenerator.noPhotoYet}</span>
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
                                {t.conceptGenerator.fotoTab}
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
                                {t.conceptGenerator.videoTab}
                              </button>
                            </div>
                          </div>

                          {!isBusy && (
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
                                        title={t.conceptGenerator.editBtn}
                                      >
                                        {t.conceptGenerator.editBtn}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleRegenerateImage(index);
                                        }}
                                        disabled={!authReady}
                                        className="px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition"
                                        title={t.conceptGenerator.regenerateBtn}
                                      >
                                        {t.conceptGenerator.regenerateBtn}
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
                                        title={t.conceptGenerator.downloadFoto}
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
                                        <span>Download Foto</span>
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
                                          title={t.conceptGenerator.generateVideoBtn}
                                        >
                                          {t.conceptGenerator.generateVideoBtn}
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
                                      title={t.conceptGenerator.regenerateVideoBtn}
                                    >
                                      {t.conceptGenerator.regenerateVideoBtn}
                                    </button>

                                    {videoOutput && (videoOutput.status === 'completed' || videoOutput.dataUrl) && (
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
              <h3 className="text-sm font-semibold text-gray-100">{t.conceptGenerator.editConceptTitle}</h3>
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
                  alt="Preview Edit Concept"
                  className="max-h-[60vh] w-auto max-w-full object-contain"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-gray-200">{t.conceptGenerator.editConceptInstruction}</div>
                <textarea
                  value={characterEditModal.instruction}
                  onChange={(e) =>
                    setCharacterEditModal((prev) => ({
                      ...prev,
                      instruction: e.target.value,
                    }))
                  }
                  placeholder={t.conceptGenerator.editConceptPlaceholder}
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
                {characterEditModal.isSubmitting ? t.conceptGenerator.editConceptProcessing : t.conceptGenerator.editConceptApply}
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
                <h3 className="text-sm font-semibold text-gray-100">{t.conceptGenerator.videoPromptTitle}</h3>
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
                  <div className="text-[11px] font-semibold text-gray-200">{t.conceptGenerator.customPromptLabel}</div>
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
                    {t.conceptGenerator.clearBtn}
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
                  placeholder={t.conceptGenerator.videoPromptPlaceholder}
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
                {t.conceptGenerator.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleSaveVideoPromptModal}
                className="px-3 py-2 rounded-lg btn-glass-primary btn-video-gradient text-white text-xs font-semibold"
              >
                {t.conceptGenerator.generateVideoBtn}
              </button>
            </div>
          </div>
        </div>
      )}
      {isLightboxOpen && lightboxImage && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-auto max-w-[90vw] max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-gray-100">{t.conceptGenerator.previewConceptTitle}</h3>
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
            <h2 className="text-base font-semibold text-gray-50 mb-2">{t.conceptGenerator.confirmResetTitle}</h2>
            <div className="space-y-2 text-sm text-gray-200 mb-4">
              <p>
                {t.conceptGenerator.confirmResetMessage}
              </p>
              <p className="text-gray-400 text-xs">{t.conceptGenerator.confirmResetWarning}</p>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-3 py-1.5 rounded-md border border-zinc-600 text-gray-200 hover:bg-zinc-800"
              >
                {t.conceptGenerator.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {t.conceptGenerator.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateConceptPage;
