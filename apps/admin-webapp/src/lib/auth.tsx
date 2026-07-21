import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { apiFetch } from "./api";

export interface AuthContextType {
	token: string | null;
	isAuthenticated: boolean;
	login: (username: string, password: string) => Promise<void>;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [token, setToken] = useState<string | null>(null);

	const login = useCallback(async (username: string, password: string) => {
		const response = await apiFetch("/auth/login", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({ username, password }),
		});
		if (!response.ok) {
			if (response.status === 401) {
				throw new Error("Invalid credentials");
			}
			throw new Error("Login failed");
		}
		const data = await response.json();
		setToken(data.access_token);
	}, []);

	const logout = useCallback(() => {
		setToken(null);
	}, []);

	return (
		<AuthContext.Provider
			value={{ token, isAuthenticated: !!token, login, logout }}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthContextType {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
