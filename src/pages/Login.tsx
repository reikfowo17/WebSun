import React, { useState } from 'react';
import { useUser } from '../contexts';
import { useNavigate, Link } from 'react-router-dom';

const Login: React.FC = () => {
  const { login } = useUser();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await login(username, pass);
      if (res.success) {
        navigate('/', { replace: true });
      } else {
        setError(res.error || 'Đăng nhập thất bại');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4" style={{ background: '#F8F7F4' }}>
      {/* Background Blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-100 rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-50 rounded-full blur-3xl opacity-40 translate-y-1/2 -translate-x-1/2"></div>

      <div className="w-full max-w-md bg-white rounded-[32px] p-10 relative z-10" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8 rotate-3" style={{ background: 'linear-gradient(135deg, #FACC15, #F59E0B)', boxShadow: '0 8px 20px rgba(245,158,11,0.25)' }}>
          <span className="material-symbols-outlined text-4xl text-white material-symbols-fill">sunny</span>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-widest uppercase">SUNMART</h1>
          <p className="text-gray-400 font-medium text-sm">Đăng nhập vào hệ thống quản lý</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tên đăng nhập</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-14 px-4 rounded-xl bg-white outline-none transition-all font-semibold focus:ring-2 focus:ring-amber-500/20"
              style={{ border: '1.5px solid #EEEDE9' }}
              placeholder="Nhập tên đăng nhập..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mật khẩu</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full h-14 px-4 rounded-xl bg-white outline-none transition-all font-semibold focus:ring-2 focus:ring-amber-500/20"
              style={{ border: '1.5px solid #EEEDE9' }}
              placeholder="••••••"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-500 text-sm font-bold text-center animate-pulse">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-gray-900 font-bold rounded-xl transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(180deg, #FACC15, #F59E0B)', boxShadow: '0 4px 14px rgba(245,158,11,0.3)' }}
          >
            {loading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : (
              <>
                Đăng Nhập
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/register"
            className="text-sm text-gray-500 hover:text-primary font-medium"
          >
            Chưa có tài khoản? <span className="text-primary font-bold">Đăng ký ngay</span>
          </Link>
        </div>

        <p className="text-center mt-8 text-xs text-gray-400 font-medium">© 2026 Sunmart Systems</p>
      </div>
    </div>
  );
};

export default Login;
