import { createContext, useContext } from 'react';
const AuthContext = createContext(null);
export function AuthProvider({ children }) { return children; }
export function useAuth() { return { isAuthenticated: false, isLoading: false }; }
