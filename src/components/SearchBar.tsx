import { useState, useEffect } from "react";
import { Search, Calendar, Users, FileText, DollarSign, CheckSquare, Package, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function SearchBar() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Adicionar atalho Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", search],
    queryFn: async () => {
      if (!search || search.length < 2) return { 
        appointments: [], 
        customers: [], 
        proposals: [], 
        transactions: [],
        tasks: [],
        inventory: [],
        subscriptions: []
      };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { 
        appointments: [], 
        customers: [], 
        proposals: [], 
        transactions: [],
        tasks: [],
        inventory: [],
        subscriptions: []
      };

      const searchPattern = `%${search.toLowerCase()}%`;

      // Buscar agendamentos - melhorado para buscar também pelo nome do cliente
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, title, start_time, description, customer_id, customers(name)")
        .eq("user_id", user.id)
        .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .order("start_time", { ascending: false })
        .limit(10);

      // Buscar clientes
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, phone, email, notes")
        .eq("user_id", user.id)
        .or(`name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern},notes.ilike.${searchPattern}`)
        .order("created_at", { ascending: false })
        .limit(10);

      // Buscar propostas - melhorado
      const { data: proposals } = await supabase
        .from("proposals")
        .select("id, title, status, description, customer_id, customers(name)")
        .eq("user_id", user.id)
        .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .order("created_at", { ascending: false })
        .limit(10);

      // Buscar transações
      const { data: transactions } = await supabase
        .from("financial_transactions")
        .select("id, description, amount, type, payment_method")
        .eq("user_id", user.id)
        .or(`description.ilike.${searchPattern},payment_method.ilike.${searchPattern}`)
        .order("transaction_date", { ascending: false })
        .limit(10);

      // Buscar tarefas
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, description, status, priority")
        .eq("user_id", user.id)
        .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .order("created_at", { ascending: false })
        .limit(10);

      // Buscar estoque
      const { data: inventory } = await supabase
        .from("inventory_items")
        .select("id, name, description, category, sku")
        .eq("user_id", user.id)
        .or(`name.ilike.${searchPattern},description.ilike.${searchPattern},category.ilike.${searchPattern},sku.ilike.${searchPattern}`)
        .order("created_at", { ascending: false })
        .limit(10);

      // Buscar assinaturas com informações do cliente e plano
      const { data: subscriptionsRaw } = await supabase
        .from("subscriptions")
        .select("id, status, customer_id, plan_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      // Buscar informações complementares se houver assinaturas
      let subscriptions: any[] = [];
      if (subscriptionsRaw && subscriptionsRaw.length > 0) {
        const customerIds = [...new Set(subscriptionsRaw.map(s => s.customer_id))];
        const planIds = [...new Set(subscriptionsRaw.map(s => s.plan_id))];

        const [customersData, plansData] = await Promise.all([
          supabase.from("customers").select("id, name").in("id", customerIds),
          supabase.from("subscription_plans").select("id, name").in("id", planIds)
        ]);

        subscriptions = subscriptionsRaw.map(sub => ({
          ...sub,
          customer_name: customersData.data?.find(c => c.id === sub.customer_id)?.name,
          plan_name: plansData.data?.find(p => p.id === sub.plan_id)?.name
        }));
      }

      // Filtrar agendamentos e propostas também pelo nome do cliente
      const filteredAppointments = appointments?.filter(apt => 
        apt.title?.toLowerCase().includes(search.toLowerCase()) ||
        apt.description?.toLowerCase().includes(search.toLowerCase()) ||
        apt.customers?.name?.toLowerCase().includes(search.toLowerCase())
      );

      const filteredProposals = proposals?.filter(prop => 
        prop.title?.toLowerCase().includes(search.toLowerCase()) ||
        prop.description?.toLowerCase().includes(search.toLowerCase()) ||
        prop.customers?.name?.toLowerCase().includes(search.toLowerCase())
      );

      const filteredSubscriptions = subscriptions?.filter(sub => 
        sub.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        sub.plan_name?.toLowerCase().includes(search.toLowerCase()) ||
        sub.status?.toLowerCase().includes(search.toLowerCase())
      );

      return {
        appointments: filteredAppointments || [],
        customers: customers || [],
        proposals: filteredProposals || [],
        transactions: transactions || [],
        tasks: tasks || [],
        inventory: inventory || [],
        subscriptions: filteredSubscriptions || [],
      };
    },
    enabled: search.length >= 2,
  });

  const handleSelect = (type: string, id: string) => {
    setOpen(false);
    setSearch("");
    
    switch (type) {
      case "appointment":
        navigate("/agendamentos");
        break;
      case "customer":
        navigate("/clientes");
        break;
      case "proposal":
        navigate("/propostas");
        break;
      case "transaction":
        navigate("/financeiro");
        break;
      case "task":
        navigate("/tarefas");
        break;
      case "inventory":
        navigate("/estoque");
        break;
      case "subscription":
        navigate("/assinaturas");
        break;
    }
  };

  return (
    <>
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar em todo o sistema..."
          className="w-full h-9 pl-9 pr-20 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          onClick={() => setOpen(true)}
          readOnly
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Buscar em todo o sistema..." 
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {isLoading && search.length >= 2 && (
            <div className="p-4 text-sm text-center text-muted-foreground">
              Buscando...
            </div>
          )}
          
          {!isLoading && search.length >= 2 && (
            <>
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

              {results?.customers && results.customers.length > 0 && (
                <CommandGroup heading="Clientes">
                  {results.customers.map((customer: any) => (
                    <CommandItem
                      key={customer.id}
                      onSelect={() => handleSelect("customer", customer.id)}
                      className="cursor-pointer"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {customer.phone || customer.email}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results?.appointments && results.appointments.length > 0 && (
                <CommandGroup heading="Atendimentos">
                  {results.appointments.map((apt: any) => (
                    <CommandItem
                      key={apt.id}
                      onSelect={() => handleSelect("appointment", apt.id)}
                      className="cursor-pointer"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{apt.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {apt.customers?.name}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results?.proposals && results.proposals.length > 0 && (
                <CommandGroup heading="Orçamentos">
                  {results.proposals.map((proposal: any) => (
                    <CommandItem
                      key={proposal.id}
                      onSelect={() => handleSelect("proposal", proposal.id)}
                      className="cursor-pointer"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{proposal.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {proposal.customers?.name} • {proposal.status}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results?.transactions && results.transactions.length > 0 && (
                <CommandGroup heading="Transações">
                  {results.transactions.map((transaction: any) => (
                    <CommandItem
                      key={transaction.id}
                      onSelect={() => handleSelect("transaction", transaction.id)}
                      className="cursor-pointer"
                    >
                      <DollarSign className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{transaction.description}</div>
                        <div className="text-xs text-muted-foreground">
                          R$ {transaction.amount} • {transaction.type === "income" ? "Receita" : "Despesa"}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results?.tasks && results.tasks.length > 0 && (
                <CommandGroup heading="Tarefas">
                  {results.tasks.map((task: any) => (
                    <CommandItem
                      key={task.id}
                      onSelect={() => handleSelect("task", task.id)}
                      className="cursor-pointer"
                    >
                      <CheckSquare className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {task.status} • {task.priority}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results?.inventory && results.inventory.length > 0 && (
                <CommandGroup heading="Estoque">
                  {results.inventory.map((item: any) => (
                    <CommandItem
                      key={item.id}
                      onSelect={() => handleSelect("inventory", item.id)}
                      className="cursor-pointer"
                    >
                      <Package className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.category} {item.sku ? `• SKU: ${item.sku}` : ''}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results?.subscriptions && results.subscriptions.length > 0 && (
                <CommandGroup heading="Assinaturas">
                  {results.subscriptions.map((sub: any) => (
                    <CommandItem
                      key={sub.id}
                      onSelect={() => handleSelect("subscription", sub.id)}
                      className="cursor-pointer"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{sub.customer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {sub.plan_name} • {sub.status}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}

          {search.length < 2 && (
            <div className="p-4 text-sm text-center text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
