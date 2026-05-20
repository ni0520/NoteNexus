import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import NotesApp from "./components/NotesApp";
import { Toaster } from "./components/ui/toaster";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotesApp />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
