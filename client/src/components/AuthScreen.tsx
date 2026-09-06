import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

interface AuthScreenProps {
  onAuthenticated: () => void;
}

function getApiError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const match = message.match(/\{.*"message"\s*:\s*"([^"]+)".*\}/);
  return match?.[1] ?? "操作失敗，請稍後再試。";
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await apiRequest(isRegistering ? "POST" : "POST", isRegistering ? "/api/auth/register" : "/api/auth/login", {
        username,
        password,
      });
      onAuthenticated();
    } catch (submitError) {
      setError(getApiError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">小筆記 Pro</CardTitle>
          <p className="text-sm text-slate-500">
            {isRegistering ? "建立帳號，安全保存你的筆記" : "登入以查看你的筆記與雲端備份"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium">使用者名稱</label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="3–40 個英數字、底線、點或連字號"
                autoComplete="username"
                required
                minLength={3}
                maxLength={40}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium">密碼</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 8 個字元"
                autoComplete={isRegistering ? "new-password" : "current-password"}
                required
                minLength={8}
                maxLength={128}
              />
            </div>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "處理中…" : isRegistering ? "建立帳號" : "登入"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 w-full text-sm text-slate-600 underline hover:text-slate-900"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError("");
            }}
          >
            {isRegistering ? "已經有帳號？登入" : "還沒有帳號？建立帳號"}
          </button>
        </CardContent>
      </Card>
    </main>
  );
}