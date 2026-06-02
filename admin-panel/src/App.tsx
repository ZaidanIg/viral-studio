import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Licenses from './pages/Licenses';
import ApiCredentials from './pages/ApiCredentials';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/" element={session ? <Dashboard /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/licenses" />} />
          <Route path="licenses" element={<Licenses />} />
          <Route path="credentials" element={<ApiCredentials />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
