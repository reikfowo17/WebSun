/**
 * UserContext - Global User State Management
 * 
 * Replaces prop drilling throughout the app.
 * Provides user authentication state and actions.
 */
import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { AuthService } from '../services/auth';

// ===========================================================================
// TYPES
// ===========================================================================

interface UserContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    updateUser: (updates: Partial<User>) => void;
}

interface UserProviderProps {
    children: ReactNode;
}

// ===========================================================================
// CONTEXT
// ===========================================================================

const UserContext = createContext<UserContextType | undefined>(undefined);

// ===========================================================================
// PROVIDER
// ===========================================================================

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check session on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                const savedToken = sessionStorage.getItem('sunmart_token');
                const savedUser = sessionStorage.getItem('sunmart_user');

                if (savedToken && savedUser) {
                    const parsedUser = JSON.parse(savedUser) as User;
                    // TODO: Verify token with backend
                    setUser(parsedUser);
                }
            } catch (error) {
                console.error('[UserContext] Session check failed:', error);
                sessionStorage.clear();
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        try {
            const result = await AuthService.login(username, password);

            if (result.success && result.user && result.token) {
                setUser(result.user);
                sessionStorage.setItem('sunmart_token', result.token);
                sessionStorage.setItem('sunmart_user', JSON.stringify(result.user));
                return { success: true };
            }

            return { success: false, error: result.error || 'Đăng nhập thất bại' };
        } catch (error) {
            console.error('[UserContext] Login error:', error);
            return { success: false, error: 'Lỗi kết nối server' };
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await AuthService.logout();
        } catch (error) {
            console.error('[UserContext] Logout error:', error);
        } finally {
            setUser(null);
            sessionStorage.clear();
        }
    }, []);

    const updateUser = useCallback((updates: Partial<User>) => {
        setUser(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...updates };
            sessionStorage.setItem('sunmart_user', JSON.stringify(updated));
            return updated;
        });
    }, []);

    const value: UserContextType = {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        updateUser,
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

// ===========================================================================
// HOOK
// ===========================================================================

export const useUser = (): UserContextType => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};

// ===========================================================================
// CONVENIENCE HOOKS
// ===========================================================================

export const useCurrentUser = (): User | null => {
    const { user } = useUser();
    return user;
};

export const useIsAdmin = (): boolean => {
    const { user } = useUser();
    return user?.role === 'ADMIN';
};

export default UserContext;
