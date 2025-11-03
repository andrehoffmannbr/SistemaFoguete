import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
          <Route path="/agendamentos" element={<Layout><Agendamentos /></Layout>} />
          <Route path="/clientes" element={<Layout><Clientes /></Layout>} />
          <Route path="/financeiro" element={<Layout><Financeiro /></Layout>} />
          <Route path="/relatorios" element={<Layout><Relatorios /></Layout>} />
          <Route path="/propostas" element={<Layout><Propostas /></Layout>} />
          <Route path="/assinaturas" element={<Layout><Assinaturas /></Layout>} />
          <Route path="/tarefas" element={<Layout><Tarefas /></Layout>} />
          <Route path="/estoque" element={<Layout><Estoque /></Layout>} />
          <Route path="/configuracoes" element={<Layout><Configuracoes /></Layout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
