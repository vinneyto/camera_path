"use client";
import { ApiError, orvalFetch } from "@camera-path/api/client/orval-fetch";
import type { ChallengeResponse } from "@camera-path/types/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";

interface AuthContextValue {
  canEdit: boolean;
  loading: boolean;
  username: string | null;
  error: Error | null;
  pending: boolean;
  challenge: ChallengeResponse | null;
  login: (username: string, password: string) => Promise<boolean>;
  verify: (code: string) => Promise<void>;
  resend: () => Promise<void>;
  cancelLogin: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_KEY = ["editor-session"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const session = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async ({ signal }) => {
      try {
        const response = await orvalFetch<{ data: { username: string } }>(
          "/api/v1/auth/session",
          { method: "GET", signal },
        );
        return response.data;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const expire = () => queryClient.setQueryData(SESSION_KEY, null);
    window.addEventListener("camera-path-auth-expired", expire);
    return () => window.removeEventListener("camera-path-auth-expired", expire);
  }, [queryClient]);

  async function login(username: string, password: string) {
    setPending(true);
    setError(null);
    await queryClient.cancelQueries({ queryKey: SESSION_KEY });
    try {
      const response = await orvalFetch<{
        data: ChallengeResponse | { expires_in: number };
      }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if ("challenge_id" in response.data) {
        setChallenge(response.data);
        queryClient.setQueryData(SESSION_KEY, null);
        return false;
      }
      setChallenge(null);
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      return true;
    } catch (error) {
      setError(error instanceof Error ? error : new Error("Sign in failed"));
      throw error;
    } finally {
      setPending(false);
    }
  }

  async function verify(code: string) {
    if (!challenge || pending) return;
    setPending(true);
    setError(null);
    try {
      await orvalFetch("/api/v1/auth/verify", {
        method: "POST",
        body: JSON.stringify({ challenge_id: challenge.challenge_id, code }),
      });
      setChallenge(null);
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    } catch (error) {
      setError(
        error instanceof Error ? error : new Error("Verification failed"),
      );
      throw error;
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    if (!challenge || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await orvalFetch<{ data: ChallengeResponse }>(
        "/api/v1/auth/resend",
        {
          method: "POST",
          body: JSON.stringify({ challenge_id: challenge.challenge_id }),
        },
      );
      setChallenge(response.data);
    } catch (error) {
      setError(error instanceof Error ? error : new Error("Resend failed"));
      throw error;
    } finally {
      setPending(false);
    }
  }

  function cancelLogin() {
    setChallenge(null);
    setError(null);
  }

  async function logout() {
    setPending(true);
    setError(null);
    await queryClient.cancelQueries({ queryKey: SESSION_KEY });
    try {
      await orvalFetch("/api/v1/auth/logout", { method: "POST" });
      queryClient.setQueryData(SESSION_KEY, null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        queryClient.setQueryData(SESSION_KEY, null);
      else
        setError(error instanceof Error ? error : new Error("Sign out failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        canEdit: !!session.data && !session.isError,
        loading: session.isPending,
        username: session.data?.username ?? null,
        error: error ?? session.error,
        pending,
        challenge,
        login,
        verify,
        resend,
        cancelLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
