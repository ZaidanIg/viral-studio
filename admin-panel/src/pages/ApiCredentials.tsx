import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';

export default function ApiCredentials() {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New entry form
  const [bearerToken, setBearerToken] = useState('');
  const [flowProjectId, setFlowProjectId] = useState('');
  const [jenis, setJenis] = useState('lengkap');
  const [isAdding, setIsAdding] = useState(false);

  const fetchCredentials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('api_credentials')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCredentials(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleAddCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bearerToken.trim() || !flowProjectId.trim()) return;

    setIsAdding(true);
    const { error } = await supabase.from('api_credentials').insert([
      { 
        bearer_token: bearerToken.trim(), 
        flow_project_id: flowProjectId.trim(),
        jenis: jenis,
        status: 'ok'
      }
    ]);

    if (!error) {
      setBearerToken('');
      setFlowProjectId('');
      setJenis('lengkap');
      fetchCredentials();
    } else {
      alert('Error adding credential: ' + error.message);
    }
    setIsAdding(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    await supabase.from('api_credentials').update({ 
      status: newStatus,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    fetchCredentials();
  };

  const handleDelete = async (id: string) => {
    const confirm = window.confirm('Are you sure you want to delete this credential? Apps relying on it might fail.');
    if (!confirm) return;

    await supabase.from('api_credentials').delete().eq('id', id);
    fetchCredentials();
  };

  const renderStatusBadge = (status: string) => {
    switch(status) {
      case 'ok':
        return <span className="inline-flex items-center px-2 py-1 rounded bg-green-900/30 text-green-400 border border-green-800 text-xs font-bold"><ShieldCheck className="w-3 h-3 mr-1" /> OK / READY</span>;
      case 'limit':
        return <span className="inline-flex items-center px-2 py-1 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-800 text-xs font-bold"><ShieldAlert className="w-3 h-3 mr-1" /> LIMIT</span>;
      case 'failed':
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded bg-red-900/30 text-red-400 border border-red-800 text-xs font-bold"><ShieldX className="w-3 h-3 mr-1" /> FAILED</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">API Credentials</h1>
          <p className="text-gray-400 text-sm">Manage central Bearer Tokens and Flow IDs (Replaces Google Sheets)</p>
        </div>
      </div>

      {/* Add New Credential */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Add New Server Credential</h2>
        <form onSubmit={handleAddCredential} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400">Bearer Token</label>
            <input
              type="text"
              value={bearerToken}
              onChange={(e) => setBearerToken(e.target.value)}
              placeholder="ya29.c.c0AY_VpZ..."
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400">Flow Project ID</label>
            <input
              type="text"
              value={flowProjectId}
              onChange={(e) => setFlowProjectId(e.target.value)}
              placeholder="projects/904..."
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400">Tipe / Jenis</label>
            <select
              value={jenis}
              onChange={(e) => setJenis(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
            >
              <option value="lengkap">Lengkap</option>
              <option value="terbatas">Terbatas</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isAdding}
            className="bg-purple-600 hover:bg-purple-700 text-white h-10 rounded-lg font-medium flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isAdding ? 'Saving...' : 'Save Credential'}
          </button>
        </form>
      </div>

      {/* Credentials Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-800/50 text-gray-400 text-sm">
              <tr>
                <th className="px-6 py-4 font-medium">Server Data</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Last Updated</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Loading credentials...
                  </td>
                </tr>
              ) : credentials.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No credentials found. Application sync will return empty.
                  </td>
                </tr>
              ) : (
                credentials.map((cred) => (
                  <tr key={cred.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-zinc-800 text-gray-300 px-2 py-0.5 rounded border border-zinc-700 uppercase tracking-wider">{cred.jenis}</span>
                        </div>
                        <div className="text-xs text-gray-400 font-mono truncate max-w-xs" title={cred.bearer_token}>
                          Token: {cred.bearer_token.substring(0, 15)}...
                        </div>
                        <div className="text-xs text-gray-400 font-mono truncate max-w-xs" title={cred.flow_project_id}>
                          Flow: {cred.flow_project_id.substring(0, 15)}...
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2 items-start">
                        {renderStatusBadge(cred.status)}
                        <select
                          value={cred.status}
                          onChange={(e) => handleStatusChange(cred.id, e.target.value)}
                          className="bg-zinc-800 border border-zinc-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none"
                        >
                          <option value="ok">Mark OK</option>
                          <option value="limit">Mark LIMIT</option>
                          <option value="failed">Mark FAILED</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300">
                        {new Date(cred.updated_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(cred.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
