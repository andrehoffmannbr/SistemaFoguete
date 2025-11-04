import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Layout from "./components/Layout";
import Agendamentos from "./pages/Agendamentos";
import Clientes from "./pages/Clientes";
import Configuracoes from "./pages/Configuracoes";
import Financeiro from "./pages/Financeiro";
import Relatorios from "./pages/Relatorios";
import Propostas from "./pages/Propostas";
import Assinaturas from "./pages/Assinaturas";
import Tarefas from "./pages/Tarefas";
import Estoque from "./pages/Estoque";
import NotFound from "./pages/NotFound";
import SubscriptionPage from "./pages/SubscriptionPage";
import SubscriptionSuccessPage from "./pages/SubscriptionSuccessPage";
import SubscriptionFailurePage from "./pages/SubscriptionFailurePage";
import SubscriptionPendingPage from "./pages/SubscriptionPendingPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          
          {/* Rotas de assinatura (sem proteção) */}
          <Route path="/subscription" element={<Layout><SubscriptionPage /></Layout>} />
          <Route path="/subscription/success" element={<Layout><SubscriptionSuccessPage /></Layout>} />
          <Route path="/subscription/failure" element={<Layout><SubscriptionFailurePage /></Layout>} />
          <Route path="/subscription/pending" element={<Layout><SubscriptionPendingPage /></Layout>} />
          
          {/* Rotas protegidas com SubscriptionGuard */}
          <Route path="/agendamentos" element={<Layout><SubscriptionGuard><Agendamentos /></SubscriptionGuard></Layout>} />
          <Route path="/clientes" element={<Layout><SubscriptionGuard><Clientes /></SubscriptionGuard></Layout>} />
          <Route path="/financeiro" element={<Layout><SubscriptionGuard><Financeiro /></SubscriptionGuard></Layout>} />
          <Route path="/relatorios" element={<Layout><SubscriptionGuard><Relatorios /></SubscriptionGuard></Layout>} />
          <Route path="/propostas" element={<Layout><SubscriptionGuard><Propostas /></SubscriptionGuard></Layout>} />
          <Route path="/assinaturas" element={<Layout><SubscriptionGuard><Assinaturas /></SubscriptionGuard></Layout>} />
          <Route path="/tarefas" element={<Layout><SubscriptionGuard><Tarefas /></SubscriptionGuard></Layout>} />
          <Route path="/estoque" element={<Layout><SubscriptionGuard><Estoque /></SubscriptionGuard></Layout>} />
          <Route path="/configuracoes" element={<Layout><SubscriptionGuard><Configuracoes /></SubscriptionGuard></Layout>} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
