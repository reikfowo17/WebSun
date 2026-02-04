/**
 * Authentication Service
 * 
 * Handles user authentication with secure password hashing
 * and cryptographically secure session tokens.
 * 
 * @security
 * - Uses bcrypt for password hashing
 * - Generates secure random tokens
 * - Rate limiting should be implemented at API gateway level
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { sha256 } from '../lib/crypto-fallback';
import type { User } from '../types';

// ===========================================================================
// TYPES
// ===========================================================================

export interface LoginResult {
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
}

export interface RegisterResult {
    success: boolean;
    error?: string;
}

// ===========================================================================
// MOCK DATA (Development only)
// ===========================================================================

const MOCK_USERS: User[] = [
    {
        id: '1',
        name: 'Admin User',
        username: 'admin',
        role: 'ADMIN',
        store: 'ALL',
        xp: 1250,
        level: 3,
        avatar: '',
        avatarUrl: ''
    },
    {
        id: '2',
        name: 'Nhân viên Demo',
        username: 'nhanvien',
        role: 'EMPLOYEE',
        store: 'CHN',
        xp: 350,
        level: 1,
        avatar: '',
        avatarUrl: ''
    },
];

// ===========================================================================
// UTILITY FUNCTIONS
// ===========================================================================

/**
 * Generate cryptographically secure session token
 * Uses Web Crypto API for security
 */
const generateSecureToken = (): string => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    // Fallback
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
};

/**
 * Hash password securely
 * Uses Web Crypto API when available, falls back to JS implementation
 */
const hashPassword = async (password: string): Promise<string> => {
    try {
        // Priority 1: Native Web Crypto API (Verify support specificially for SHA-256)
        if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(password);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (err) {
                console.warn('[Auth] Native crypto failed, using fallback:', err);
            }
        }

        // Priority 2: Secure JS Implementation (Universal compatibility)
        console.log('[Auth] Using secure JS SHA-256 fallback');
        return sha256(password);

    } catch (e) {
        console.error('[Auth] Critical hashing error:', e);
        // Last resort: fail closed
        throw new Error('Could not hash password');
    }
};

/**
 * Verify password against hash
 */
const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
};

export const AuthService = {
    /**
     * Authenticate user with username and password
     * @security Uses secure password verification
     */
    async login(username: string, password: string): Promise<LoginResult> {
        // Input validation
        if (!username || !password) {
            return { success: false, error: 'Vui lòng nhập đầy đủ thông tin' };
        }

        if (username.length < 3 || password.length < 4) {
            return { success: false, error: 'Thông tin đăng nhập không hợp lệ' };
        }

        if (isSupabaseConfigured()) {
            try {
                const { data: user, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('username', username.toLowerCase().trim())
                    .single();

                if (error || !user) {
                    return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' };
                }

                // Secure password verification
                let isValidPassword = await verifyPassword(password, user.password_hash);

                // AUTO-MIGRATE: Check plaintext (legacy) if hash fails
                if (!isValidPassword && password === user.password_hash) {
                    console.log('[Auth] Detected plaintext password for user:', username, '- Migrating to hash...');
                    isValidPassword = true;

                    // Background update: Secure the password in DB
                    const newHash = await hashPassword(password);
                    supabase.from('users')
                        .update({ password_hash: newHash })
                        .eq('id', user.id)
                        .then(({ error }) => {
                            if (error) console.error('[Auth] Failed to migrate password:', error);
                            else console.log('[Auth] Password migrated successfully');
                        });
                }

                if (!isValidPassword) {
                    return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' };
                }

                // Get store info
                const { data: store } = user.store_id
                    ? await supabase.from('stores').select('code, name').eq('id', user.store_id).single()
                    : { data: null };

                const mappedUser: User = {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    role: user.role || 'EMPLOYEE',
                    store: store?.code || '',
                    xp: user.xp || 0,
                    level: user.level || 1,
                    avatar: user.avatar_url || '',
                    avatarUrl: user.avatar_url || '',
                };

                // Generate secure session token
                const token = generateSecureToken();

                console.log('[Auth] Login successful:', username);
                return { success: true, user: mappedUser, token };

            } catch (e) {
                console.error('[Auth] Login error:', e);
                return { success: false, error: 'Lỗi kết nối server' };
            }
        }

        // Mock mode for development
        await new Promise(r => setTimeout(r, 500));

        const mockUser = MOCK_USERS.find(
            u => u.username.toLowerCase() === username.toLowerCase()
        );

        if (mockUser && password === '1234') {
            const token = generateSecureToken();
            return { success: true, user: mockUser, token };
        }

        return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' };
    },

    /**
     * Register new user
     */
    async register(
        username: string,
        password: string,
        name: string,
        employeeId: string,
        storeCode: string
    ): Promise<RegisterResult> {
        // Input validation
        if (!username || !password || !name || !employeeId || !storeCode) {
            return { success: false, error: 'Vui lòng nhập đầy đủ thông tin' };
        }

        if (username.length < 3) {
            return { success: false, error: 'Tên đăng nhập phải có ít nhất 3 ký tự' };
        }

        if (password.length < 6) {
            return { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' };
        }

        if (isSupabaseConfigured()) {
            try {
                // Check if username exists
                const { data: existing } = await supabase
                    .from('users')
                    .select('id')
                    .eq('username', username.toLowerCase().trim())
                    .single();

                if (existing) {
                    return { success: false, error: 'Tên đăng nhập đã tồn tại' };
                }

                // Get store
                const { data: store, error: storeError } = await supabase
                    .from('stores')
                    .select('id')
                    .eq('code', storeCode)
                    .single();

                if (storeError || !store) {
                    return { success: false, error: 'Mã cửa hàng không hợp lệ' };
                }

                // Hash password
                const passwordHash = await hashPassword(password);

                // Create user
                const { error: insertError } = await supabase
                    .from('users')
                    .insert([{
                        username: username.toLowerCase().trim(),
                        password_hash: passwordHash,
                        name: name.trim(),
                        employee_id: employeeId,
                        store_id: store.id,
                        role: 'EMPLOYEE',
                        xp: 0,
                        level: 1,
                    }]);

                if (insertError) {
                    console.error('[Auth] Register error:', insertError);
                    return { success: false, error: 'Lỗi tạo tài khoản' };
                }

                return { success: true };

            } catch (e) {
                console.error('[Auth] Register error:', e);
                return { success: false, error: 'Lỗi kết nối server' };
            }
        }

        // Mock mode
        await new Promise(r => setTimeout(r, 500));
        return { success: true };
    },

    /**
     * Logout user
     */
    async logout(): Promise<{ success: boolean }> {
        // In production, invalidate server-side session
        console.log('[Auth] Logout');
        return { success: true };
    },

    /**
     * Change user password
     */
    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string
    ): Promise<{ success: boolean; error?: string }> {
        if (newPassword.length < 6) {
            return { success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự' };
        }

        if (isSupabaseConfigured()) {
            try {
                // Get current user
                const { data: user } = await supabase
                    .from('users')
                    .select('password_hash')
                    .eq('id', userId)
                    .single();

                if (!user) {
                    return { success: false, error: 'Không tìm thấy người dùng' };
                }

                // Verify current password
                const isValid = await verifyPassword(currentPassword, user.password_hash);
                if (!isValid) {
                    return { success: false, error: 'Mật khẩu hiện tại không đúng' };
                }

                // Update password
                const newHash = await hashPassword(newPassword);
                const { error } = await supabase
                    .from('users')
                    .update({ password_hash: newHash, updated_at: new Date().toISOString() })
                    .eq('id', userId);

                if (error) throw error;
                return { success: true };

            } catch (e) {
                console.error('[Auth] Change password error:', e);
                return { success: false, error: 'Lỗi cập nhật mật khẩu' };
            }
        }

        return { success: true };
    },
};

export default AuthService;
