import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, User, Package, Image as ImageIcon, 
  Video, Film, TrendingUp, BookOpen, Settings, LogOut, ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';

const TOOLS = [
  {
    category: 'Models & Images',
    items: [
      { id: 'character', name: 'Character Studio', desc: 'Consistent hyper-realistic characters', icon: User, path: '/user/generator/model/character', color: 'from-purple-500 to-fuchsia-500', shadow: 'shadow-purple-500/20' },
      { id: 'product', name: 'Product Placement', desc: 'Commercial photography scenes', icon: Package, path: '/user/generator/model/product', color: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-500/20' },
      { id: 'poster', name: 'Poster Design', desc: 'Cinematic movie & promo posters', icon: ImageIcon, path: '/user/generator/model/poster', color: 'from-blue-500 to-cyan-500', shadow: 'shadow-blue-500/20' },
      { id: 'catalog', name: 'Catalog Generator', desc: 'Batch fashion & item catalogs', icon: BookOpen, path: '/user/generator/model/catalog', color: 'from-orange-500 to-amber-500', shadow: 'shadow-orange-500/20' },
    ]
  },
  {
    category: 'Video & Animation',
    items: [
      { id: 'storyteller', name: 'Story Teller', desc: 'AI talking avatars & narrators', icon: Video, path: '/user/generator/video/story-teller', color: 'from-pink-500 to-rose-500', shadow: 'shadow-pink-500/20' },
      { id: 'cinematic', name: 'Cinematic Film', desc: 'Text-to-video cinematic shots', icon: Film, path: '/user/generator/video/cinematic', color: 'from-indigo-500 to-blue-500', shadow: 'shadow-indigo-500/20' },
    ]
  },
  {
    category: 'Marketing & Copy',
    items: [
      { id: 'affiliate', name: 'Affiliate Content', desc: 'TikTok & Reels viral scripts', icon: TrendingUp, path: '/user/generator/marketing/affiliate', color: 'from-green-500 to-emerald-500', shadow: 'shadow-green-500/20' },
      { id: 'storytelling', name: 'Storyboarding', desc: 'Scene-by-scene visual planning', icon: Sparkles, path: '/user/generator/marketing/story-telling', color: 'from-yellow-500 to-orange-500', shadow: 'shadow-yellow-500/20' },
    ]
  }
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-purple-500/30 flex">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 bg-zinc-950/50 backdrop-blur-xl flex flex-col justify-between hidden md:flex">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Viral Studio</span>
          </div>

          <nav className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 text-zinc-100 font-medium">
              <Sparkles className="w-4 h-4" /> Hub
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-100 font-medium transition-colors">
              <Settings className="w-4 h-4" /> Settings
            </button>
          </nav>
        </div>

        <div className="p-6 border-t border-white/5">
          <div className="flex items-center justify-between group cursor-pointer" onClick={() => navigate('/user/login')}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10">
                <User className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-zinc-200">Zaidan</p>
                <p className="text-xs text-zinc-500">Pro Plan</p>
              </div>
            </div>
            <LogOut className="w-4 h-4 text-zinc-600 group-hover:text-red-400 transition-colors" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 pointer-events-none overflow-hidden flex justify-end w-full h-[500px]">
          <div className="w-[800px] h-[500px] bg-purple-600/5 blur-[120px] rounded-full mt-[-200px] mr-[-200px]" />
        </div>

        <div className="max-w-6xl mx-auto px-8 py-12 relative z-10">
          
          <header className="mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-2">
              Welcome back, Zaidan.
            </h1>
            <p className="text-zinc-400 text-lg">
              What do you want to create today?
            </p>
          </header>

          <div className="space-y-12">
            {TOOLS.map((section, sIdx) => (
              <section key={sIdx}>
                <h2 className="text-lg font-semibold text-zinc-300 mb-6 flex items-center gap-2">
                  {section.category}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {section.items.map((tool, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (sIdx * 0.1) + (i * 0.05) }}
                      onClick={() => navigate(tool.path)}
                      className="group cursor-pointer bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-5 hover:bg-zinc-800/60 transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-white/10 flex flex-col"
                    >
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-4 shadow-lg ${tool.shadow} group-hover:scale-110 transition-transform`}>
                        <tool.icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-semibold text-zinc-100 mb-1">{tool.name}</h3>
                      <p className="text-sm text-zinc-500 mb-4 flex-1">{tool.desc}</p>
                      
                      <div className="flex items-center text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">
                        Launch tool <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
          </div>

        </div>
      </main>

    </div>
  );
}
