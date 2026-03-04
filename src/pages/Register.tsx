import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthService } from '../services';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [store, setStore] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!username || !name || !password) {
            setError('Vui lòng nhập đầy đủ thông tin bắt buộc');
            return;
        }

        if (password.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }

        if (password !== confirmPass) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }

        setLoading(true);

        try {
            // Register requires: username, password, name, employeeId, storeCode
            const res = await AuthService.register(
                username,
                password,
                name,
                '', // employeeId - auto-generated or optional
                store || ''
            );

            if (res.success) {
                setSuccess(true);
                setTimeout(() => {
                    navigate('/login');
                }, 1500);
            } else {
                setError(res.error || 'Đăng ký thất bại');
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
            <div className="absolute top-0 right-0 w-96 h-96 bg-green-100 rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-50 rounded-full blur-3xl opacity-40 translate-y-1/2 -translate-x-1/2"></div>

            <div className="w-full max-w-md bg-white rounded-[32px] p-10 relative z-10" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8 -rotate-3" style={{ background: 'linear-gradient(135deg, #34D399, #059669)', boxShadow: '0 8px 20px rgba(5,150,105,0.25)' }}>
                    <span className="material-symbols-outlined text-4xl text-white">person_add</span>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-secondary mb-2 tracking-tight">Đăng Ký Tài Khoản</h1>
                    <p className="text-gray-400 font-medium">Tạo tài khoản nhân viên mới</p>
                </div>

                {success ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl text-green-600">check_circle</span>
                        </div>
                        <h3 className="text-xl font-bold text-green-600 mb-2">Đăng ký thành công!</h3>
                        <p className="text-gray-500">Đang chuyển về trang đăng nhập...</p>
                    </div>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                Tên đăng nhập <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl bg-white outline-none transition-all font-semibold focus:ring-2 focus:ring-amber-500/20"
                                style={{ border: '1.5px solid #EEEDE9' }}
                                placeholder="Nhập tên đăng nhập tùy chọn..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                Họ và tên <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl bg-white outline-none transition-all font-semibold focus:ring-2 focus:ring-amber-500/20"
                                style={{ border: '1.5px solid #EEEDE9' }}
                                placeholder="Nguyễn Văn A"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cửa hàng</label>
                            <select
                                value={store}
                                onChange={(e) => setStore(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl bg-white outline-none transition-all font-semibold focus:ring-2 focus:ring-amber-500/20"
                                style={{ border: '1.5px solid #EEEDE9' }}
                            >
                                <option value="">-- Chọn cửa hàng --</option>
                                <option value="BEE">SM BEE</option>
                                <option value="PLAZA">SM PLAZA</option>
                                <option value="MIỀN ĐÔNG">SM MIỀN ĐÔNG</option>
                                <option value="HT PEARL">SM HT PEARL</option>
                                <option value="GREEN TOPAZ">SM GREEN TOPAZ</option>
                                <option value="EMERALD">SM EMERALD</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Mật khẩu <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-12 px-4 rounded-xl bg-white outline-none transition-all font-semibold focus:ring-2 focus:ring-amber-500/20"
                                    style={{ border: '1.5px solid #EEEDE9' }}
                                    placeholder="••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Xác nhận <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    value={confirmPass}
                                    onChange={(e) => setConfirmPass(e.target.value)}
                                    className="w-full h-12 px-4 rounded-xl bg-white outline-none transition-all font-semibold focus:ring-2 focus:ring-amber-500/20"
                                    style={{ border: '1.5px solid #EEEDE9' }}
                                    placeholder="••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-500 text-sm font-bold text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 text-white font-bold rounded-xl transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{ background: 'linear-gradient(135deg, #34D399, #059669)', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
                        >
                            {loading ? (
                                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">how_to_reg</span>
                                    Đăng Ký
                                </>
                            )}
                        </button>
                    </form>
                )}

                <div className="mt-6 text-center">
                    <Link
                        to="/login"
                        className="text-sm text-gray-500 hover:text-primary font-medium"
                    >
                        Đã có tài khoản? <span className="text-primary font-bold">Đăng nhập</span>
                    </Link>
                </div>

                <p className="text-center mt-6 text-xs text-gray-400 font-medium">© 2026 Sunmart Systems</p>
            </div>
        </div>
    );
};

export default Register;
