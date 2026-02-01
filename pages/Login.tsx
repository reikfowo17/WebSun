import React, { useState } from 'react';
import { runBackend } from '../services/api';

interface LoginProps {
  onLoginSuccess: (user: any, token: string) => void;
  onSwitchToRegister?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Pass username to login action
      const res = await runBackend('login', { username: username, password: pass });
      if (res.success) {
        onLoginSuccess(res.user, res.token);
      } else {
        setError(res.error || 'Đăng nhập thất bại');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden p-4">
      {/* Background Blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-100 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-yellow-50 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2"></div>

      <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-gray-100 p-10 relative z-10">
        <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-yellow-200 rotate-3">
          <span className="material-symbols-outlined text-4xl text-white material-symbols-fill">sunny</span>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-secondary mb-2 tracking-tight">Sunmart Portal</h1>
          <p className="text-gray-400 font-medium">Hệ thống quản lý cửa hàng</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tên đăng nhập</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-14 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-yellow-100 outline-none transition-all font-semibold"
              placeholder="Nhập tên đăng nhập..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mật khẩu</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full h-14 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-yellow-100 outline-none transition-all font-semibold"
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
            className="w-full h-14 bg-primary hover:bg-primary-dark text-secondary font-bold rounded-xl shadow-lg shadow-yellow-200/50 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : 'Vào hệ thống'}
          </button>
        </form>

        {onSwitchToRegister && (
          <div className="mt-6 text-center">
            <button
              onClick={onSwitchToRegister}
              className="text-sm text-gray-500 hover:text-primary font-medium"
            >
              Chưa có tài khoản? <span className="text-primary font-bold">Đăng ký ngay</span>
            </button>
          </div>
        )}

        <p className="text-center mt-8 text-xs text-gray-400 font-medium">© 2026 Sunmart Systems</p>
      </div>
    </div>
  );
};

export default Login;
