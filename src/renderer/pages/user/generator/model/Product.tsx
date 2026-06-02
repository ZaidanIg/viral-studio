import React, { useState } from 'react';
import { Sparkles, Loader2, Save, ArrowRight, Package, Upload, Settings2, Image as ImageIcon, Box } from 'lucide-react';
import { motion } from 'framer-motion';

// Mock types
interface FormData {
  namaProduk: string;
  kategori: string;
  penempatan: string;
  pencahayaan: string;
  latarBelakang: string;
  suasana: string;
}

const initialFormData: FormData = {
  namaProduk: '',
  kategori: 'Skincare',
  penempatan: 'On a marble pedestal',
  pencahayaan: 'Soft studio lighting, natural shadows',
  latarBelakang: 'Minimalist white studio',
  suasana: 'Clean, elegant, premium',
};

export default function ProductGenerator() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setReferenceImage(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!referenceImage) {
      setError('Please upload a reference product image first.');
      return;
    }

    setIsGenerating(true);
    setError('');
    
    try {
      const promptToGenerate = `Product photography of ${formData.namaProduk} (${formData.kategori}). Placed ${formData.penempatan}. Lighting: ${formData.pencahayaan}. Background: ${formData.latarBelakang}. Vibe: ${formData.suasana}. Photorealistic, 8k, hyper-detailed.`;

      // @ts-ignore
      if (typeof window !== 'undefined' && window.electron && window.electron.product) {
        setIsUploading(true);
        await new Promise(r => setTimeout(r, 1000));
        setIsUploading(false);

        // @ts-ignore
        const data = await window.electron.product.generateScene({
          prompt: promptToGenerate,
          imageModelName: 'GEM_PIX_2',
          imageInputs: []
        });

        let finalImageUrl = null;
        if (Array.isArray(data?.media) && data.media.length > 0) {
          const gen = data.media[0]?.image?.generatedImage;
          const encoded = gen?.encodedImage || gen?.imageBytes;
          if (encoded) finalImageUrl = `data:image/jpeg;base64,${encoded}`;
          else if (gen?.fifeUrl) finalImageUrl = gen.fifeUrl;
        }

        if (finalImageUrl) {
          setImages(prev => [finalImageUrl, ...prev]);
        } else {
          throw new Error('No valid image returned from API.');
        }
      } else {
        await new Promise(r => setTimeout(r, 2000));
        setImages(prev => [`https://source.unsplash.com/random/800x800/?product,${formData.kategori}`, ...prev]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-emerald-500/30">
      
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="w-[800px] h-[500px] bg-emerald-600/10 blur-[120px] rounded-full mt-[-200px]" />
      </div>

      <main className="relative max-w-7xl mx-auto px-6 py-12">
        
        {/* Header */}
        <header className="mb-10 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-xl border border-white/5 shadow-lg shadow-emerald-500/10">
              <Package className="w-6 h-6 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-400">
              Product Placement
            </h1>
          </div>
          <p className="text-zinc-400 text-sm max-w-xl leading-relaxed">
            Generate professional commercial photography. Upload your raw product image (no background) and let AI seamlessly place it into a photorealistic scene.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Settings */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Upload Card */}
            <section className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-5">
                <Upload className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-300">Raw Product Asset</h2>
              </div>
              
              <label className="group relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-zinc-700/50 hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer transition-all">
                <input type="file" accept="image/png" onChange={handleFileChange} className="hidden" />
                <div className="w-12 h-12 mb-3 rounded-full bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Box className="w-6 h-6 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                </div>
                {referenceImage ? (
                  <span className="text-sm font-medium text-emerald-400">{referenceImage.name}</span>
                ) : (
                  <>
                    <span className="text-sm font-medium text-zinc-300">Upload Product (Transparent PNG)</span>
                    <span className="text-xs text-zinc-500 mt-1">Required for accurate placement</span>
                  </>
                )}
              </label>
            </section>

            {/* Product Details */}
            <section className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-5">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-300">Scene Setup</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Product Name / Brand</label>
                  <input name="namaProduk" value={formData.namaProduk} onChange={handleChange} 
                    className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600" 
                    placeholder="e.g. Lumina Serum" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Category</label>
                    <input name="kategori" value={formData.kategori} onChange={handleChange} 
                      className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Placement Position</label>
                    <input name="penempatan" value={formData.penempatan} onChange={handleChange} 
                      className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Background Environment</label>
                  <input name="latarBelakang" value={formData.latarBelakang} onChange={handleChange} 
                    className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Lighting Setup</label>
                  <input name="pencahayaan" value={formData.pencahayaan} onChange={handleChange} 
                    className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Atmosphere / Vibe</label>
                  <input name="suasana" value={formData.suasana} onChange={handleChange} 
                    className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
              </div>
            </section>

            {/* Action */}
            <div className="pt-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || isUploading}
                className="relative w-full overflow-hidden group rounded-xl p-[1px]"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500 rounded-xl opacity-70 group-hover:opacity-100 transition-opacity blur-sm"></span>
                <div className="relative w-full flex items-center justify-center gap-2 bg-zinc-950 px-6 py-4 rounded-xl border border-white/10 transition-colors group-hover:bg-zinc-900/80">
                  {isGenerating || isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                      <span className="font-semibold">{isUploading ? 'Uploading Product...' : 'Synthesizing Scene...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                      <span className="font-semibold text-white tracking-wide">Generate Product Shot</span>
                      <ArrowRight className="w-4 h-4 ml-1 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </>
                  )}
                </div>
              </button>
              
              {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-2">
                  <span className="shrink-0">⚠️</span>
                  <p>{error}</p>
                </div>
              )}
            </div>

          </div>

          {/* Right Panel: Canvas / Preview */}
          <div className="lg:col-span-7">
            <div className="sticky top-12 bg-zinc-900/30 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 min-h-[600px] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-zinc-500" />
                  Product Studio
                </h2>
                <div className="px-3 py-1 bg-white/5 rounded-full text-xs font-medium text-zinc-400 border border-white/5">
                  {images.length} Generations
                </div>
              </div>

              {images.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                  <div className="w-24 h-24 mb-6 rounded-3xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center rotate-3 shadow-inner">
                    <Package className="w-10 h-10 text-zinc-600" />
                  </div>
                  <p className="text-zinc-400 font-medium text-lg mb-1">Canvas is empty</p>
                  <p className="text-sm max-w-[250px] text-center">Upload a product and adjust the scene to generate commercial photography.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {images.map((img, i) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.1, ease: 'easeOut' }}
                      key={i}
                      className="group relative aspect-square rounded-xl overflow-hidden bg-zinc-950 border border-white/10"
                    >
                      <img src={img} alt="Generated output" className="w-full h-full object-cover" />
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                        <button className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" /> Save Asset
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
