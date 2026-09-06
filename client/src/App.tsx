import { QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn, queryClient } from "@/lib/queryClient";
import NotesApp from "./components/NotesApp";
import AuthScreen from "./components/AuthScreen";
import { Toaster } from "./components/ui/toaster";

interface AuthUser {
  id: number;
  username: string;
}

function AuthenticatedApp() {
  const authQuery = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const handleAuthenticated = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  if (authQuery.isLoading) {
    return <main className="min-h-screen flex items-center justify-center text-slate-500">載入中…</main>;
  }

  return authQuery.data
    ? <NotesApp username={authQuery.data.username} onLogout={handleAuthenticated} />
    : <AuthScreen onAuthenticated={handleAuthenticated} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthenticatedApp />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
