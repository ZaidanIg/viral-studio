import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Users, KeyRound, LogOut, LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-zinc-800">
          <LayoutDashboard className="w-6 h-6 text-purple-500 mr-3" />
          <span className="text-lg font-bold text-white">Viral Studio</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/licenses"
            className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
              location.pathname === '/licenses'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <Users className="w-5 h-5 mr-3" />
            Users & Licenses
          </Link>
          <Link
            to="/credentials"
            className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
              location.pathname === '/credentials'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <KeyRound className="w-5 h-5 mr-3" />
            API Credentials
          </Link>
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
