import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TerminalLayout from "./components/terminal/TerminalLayout";
import Index from "./pages/Index";
import Market from "./pages/Market";
import HorseDetail from "./pages/HorseDetail";
import Portfolio from "./pages/Portfolio";
import BreedingLab from "./pages/BreedingLab";
import AgentPage from "./pages/AgentPage";
import OracleFeed from "./pages/OracleFeed";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <TerminalLayout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/market" element={<Market />} />
            <Route path="/horses/:id" element={<HorseDetail />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/breeding-lab" element={<BreedingLab />} />
            <Route path="/agent" element={<AgentPage />} />
            <Route path="/oracle" element={<OracleFeed />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TerminalLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
