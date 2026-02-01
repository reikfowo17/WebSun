import React, { useState } from 'react';
import { AuthService } from '../services/api';

interface RegisterProps {
    onRegisterSuccess: () => void;
    onSwitchToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onSwitchToLogin }) => {
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

        if (password.length < 4) {
            setError('Mật khẩu phải có ít nhất 4 ký tự');
            return;
        }

        if (password !== confirmPass) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }

        setLoading(true);

        try {
            const res = await AuthService.register({
                username,
                name,
                password,
                store: store || undefined,
                role: 'EMPLOYEE' // Default to employee
            });

            if (res.success) {
                setSuccess(true);
                setTimeout(() => {
                    onRegisterSuccess();
                }, 1500);
            } else {
                setError(res.error || 'Đăng ký thất bại');
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
            <div className="absolute top-0 right-0 w-96 h-96 bg-green-100 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-yellow-50 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2"></div>

            <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-gray-100 p-10 relative z-10">
                <div className="w-20 h-20 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-200 -rotate-3">
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
                                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none transition-all font-semibold"
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
                                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none transition-all font-semibold"
                                placeholder="Nguyễn Văn A"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cửa hàng</label>
                            <select
                                value={store}
                                onChange={(e) => setStore(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none transition-all font-semibold"
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
                                    className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none transition-all font-semibold"
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
                                    className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none transition-all font-semibold"
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
                            className="w-full h-14 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-200/50 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                    <button
                        onClick={onSwitchToLogin}
                        className="text-sm text-gray-500 hover:text-primary font-medium"
                    >
                        Đã có tài khoản? <span className="text-primary font-bold">Đăng nhập</span>
                    </button>
                </div>

                <p className="text-center mt-6 text-xs text-gray-400 font-medium">© 2026 Sunmart Systems</p>
            </div>
        </div>
    );
};

export default Register;
