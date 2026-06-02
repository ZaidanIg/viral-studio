import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Power, PowerOff, MonitorOff } from 'lucide-react';

export default function Licenses() {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchLicenses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLicenses(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const handleAddLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setIsAdding(true);
    const { error } = await supabase.from('licenses').insert([
      { email: newEmail.trim().toLowerCase(), is_active: true }
    ]);

    if (!error) {
      setNewEmail('');
      fetchLicenses();
    } else {
      alert('Error adding license: ' + error.message);
    }
    setIsAdding(false);
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('licenses').update({ is_active: !currentStatus }).eq('id', id);
    fetchLicenses();
  };

  const handleClearMachine = async (id: string) => {
    const confirm = window.confirm('Clear machine ID for this license? This allows the user to login on a new device.');
    if (!confirm) return;
    
    await supabase.from('licenses').update({ machine_id: null }).eq('id', id);
    fetchLicenses();
  };

  const handleDelete = async (id: string) => {
    const confirm = window.confirm('Are you sure you want to delete this license?');
    if (!confirm) return;

    await supabase.from('licenses').delete().eq('id', id);
    fetchLicenses();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Licenses</h1>
          <p className="text-gray-400 text-sm">Manage user access and device binding</p>
        </div>
      </div>

      {/* Add New License */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Add New License</h2>
        <form onSubmit={handleAddLicense} className="flex gap-4">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            required
          />
          <button
            type="submit"
            disabled={isAdding}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium flex items-center transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isAdding ? 'Adding...' : 'Add License'}
          </button>
        </form>
      </div>

      {/* Licenses Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-800/50 text-gray-400 text-sm">
              <tr>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Machine Binding</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Loading licenses...
                  </td>
                </tr>
              ) : licenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No licenses found
                  </td>
                </tr>
              ) : (
                licenses.map((license) => (
                  <tr key={license.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-200">{license.email}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Added: {new Date(license.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(license.id, license.is_active)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          license.is_active
                            ? 'bg-green-900/30 border-green-800 text-green-400 hover:bg-green-900/50'
                            : 'bg-red-900/30 border-red-800 text-red-400 hover:bg-red-900/50'
                        }`}
                      >
                        {license.is_active ? (
                          <><Power className="w-3 h-3 mr-1" /> Active</>
                        ) : (
                          <><PowerOff className="w-3 h-3 mr-1" /> Inactive</>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      {license.machine_id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400 bg-zinc-800 px-2 py-1 rounded border border-zinc-700 truncate max-w-[120px]" title={license.machine_id}>
                            {license.machine_id}
                          </span>
                          <button
                            onClick={() => handleClearMachine(license.id)}
                            className="p-1.5 text-yellow-500 hover:bg-yellow-900/30 rounded-lg transition-colors"
                            title="Unbind Machine"
                          >
                            <MonitorOff className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 italic">Not bound yet</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(license.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete License"
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
