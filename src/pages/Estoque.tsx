import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, AlertTriangle, TrendingDown, TrendingUp, History } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface InventoryItem {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  cost_price: number;
  sale_price: number;
  is_kit: boolean;
  kit_items: any;
}

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  reason: string;
  previous_stock: number;
  new_stock: number;
  created_at: string;
  inventory_items: { name: string };
}

const Estoque = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string>("");
  
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    sku: "",
    category: "",
    unit: "unit",
    current_stock: "0",
    minimum_stock: "0",
    cost_price: "",
    sale_price: "",
    is_kit: false,
  });

  const [movement, setMovement] = useState({
    type: "in",
    quantity: "",
    reason: "",
  });

  useEffect(() => {
    checkAuth();
    fetchItems();
    fetchMovements();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Erro ao carregar itens",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const fetchMovements = async () => {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast({
        title: "Erro ao carregar movimentações",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Fetch item names separately
      const movementsWithNames = await Promise.all(
        (data || []).map(async (mov) => {
          const { data: item } = await supabase
            .from("inventory_items")
            .select("name")
            .eq("id", mov.item_id)
            .single();
          return {
            ...mov,
            inventory_items: item || { name: "Item removido" },
          };
        })
      );
      setMovements(movementsWithNames as any);
    }
  };

  const handleCreateItem = async () => {
    if (!newItem.name) {
      toast({
        title: "Erro",
        description: "Preencha o nome do item",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("inventory_items").insert([{
      user_id: user.id,
      name: newItem.name,
      description: newItem.description,
      sku: newItem.sku,
      category: newItem.category,
      unit: newItem.unit,
      current_stock: parseFloat(newItem.current_stock) || 0,
      minimum_stock: parseFloat(newItem.minimum_stock) || 0,
      cost_price: newItem.cost_price ? parseFloat(newItem.cost_price) : null,
      sale_price: newItem.sale_price ? parseFloat(newItem.sale_price) : null,
      is_kit: newItem.is_kit,
    }]);

    if (error) {
      toast({
        title: "Erro ao criar item",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Item criado com sucesso!",
      });
      setIsDialogOpen(false);
      setNewItem({
        name: "",
        description: "",
        sku: "",
        category: "",
        unit: "unit",
        current_stock: "0",
        minimum_stock: "0",
        cost_price: "",
        sale_price: "",
        is_kit: false,
      });
      fetchItems();
    }
  };

  const handleStockMovement = async () => {
    if (!selectedItem || !movement.quantity) {
      toast({
        title: "Erro",
        description: "Selecione um item e informe a quantidade",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.rpc("update_inventory_stock", {
      p_item_id: selectedItem,
      p_quantity: parseFloat(movement.quantity),
      p_type: movement.type,
      p_reason: movement.reason,
      p_reference_type: "manual",
    });

    if (error) {
      toast({
        title: "Erro ao movimentar estoque",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Estoque atualizado!",
      });
      setIsMovementDialogOpen(false);
      setMovement({ type: "in", quantity: "", reason: "" });
      setSelectedItem("");
      fetchItems();
      fetchMovements();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const isLowStock = (item: InventoryItem) => {
    return item.current_stock <= item.minimum_stock && item.minimum_stock > 0;
  };

  const stats = {
    total: items.length,
    lowStock: items.filter(isLowStock).length,
    totalValue: items.reduce((sum, item) => sum + (item.current_stock * (item.cost_price || 0)), 0),
  };

  if (loading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Estoque</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus itens, kits e movimentações
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <History className="mr-2 h-4 w-4" />
                Movimentar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Movimentar Estoque</DialogTitle>
                <DialogDescription>
                  Registre entrada, saída ou ajuste de estoque
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="item">Item *</Label>
                  <Select value={selectedItem} onValueChange={setSelectedItem}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um item" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} (Estoque: {item.current_stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="type">Tipo de Movimentação</Label>
                  <Select value={movement.type} onValueChange={(value) => setMovement({ ...movement, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Entrada</SelectItem>
                      <SelectItem value="out">Saída</SelectItem>
                      <SelectItem value="adjustment">Ajuste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="quantity">Quantidade *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={movement.quantity}
                    onChange={(e) => setMovement({ ...movement, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="reason">Motivo</Label>
                  <Textarea
                    id="reason"
                    value={movement.reason}
                    onChange={(e) => setMovement({ ...movement, reason: e.target.value })}
                    placeholder="Descreva o motivo da movimentação"
                  />
                </div>
                <Button onClick={handleStockMovement} className="w-full">
                  Confirmar Movimentação
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Novo Item</DialogTitle>
                <DialogDescription>
                  Adicione um novo item ao estoque
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sku">SKU/Código</Label>
                    <Input
                      id="sku"
                      value={newItem.sku}
                      onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Categoria</Label>
                    <Input
                      id="category"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unidade</Label>
                    <Select value={newItem.unit} onValueChange={(value) => setNewItem({ ...newItem, unit: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unit">Unidade</SelectItem>
                        <SelectItem value="kg">Quilograma (kg)</SelectItem>
                        <SelectItem value="liter">Litro (L)</SelectItem>
                        <SelectItem value="meter">Metro (m)</SelectItem>
                        <SelectItem value="box">Caixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="current_stock">Estoque Inicial</Label>
                    <Input
                      id="current_stock"
                      type="number"
                      step="0.01"
                      value={newItem.current_stock}
                      onChange={(e) => setNewItem({ ...newItem, current_stock: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="minimum_stock">Estoque Mínimo</Label>
                    <Input
                      id="minimum_stock"
                      type="number"
                      step="0.01"
                      value={newItem.minimum_stock}
                      onChange={(e) => setNewItem({ ...newItem, minimum_stock: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cost_price">Preço de Custo</Label>
                    <Input
                      id="cost_price"
                      type="number"
                      step="0.01"
                      value={newItem.cost_price}
                      onChange={(e) => setNewItem({ ...newItem, cost_price: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sale_price">Preço de Venda</Label>
                    <Input
                      id="sale_price"
                      type="number"
                      step="0.01"
                      value={newItem.sale_price}
                      onChange={(e) => setNewItem({ ...newItem, sale_price: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_kit"
                    checked={newItem.is_kit}
                    onCheckedChange={(checked) => setNewItem({ ...newItem, is_kit: checked as boolean })}
                  />
                  <Label htmlFor="is_kit" className="cursor-pointer">
                    Este item é um kit
                  </Label>
                </div>
                <Button onClick={handleCreateItem} className="w-full">
                  Criar Item
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens com Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.lowStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total em Estoque</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items">Itens</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          {items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <p className="text-muted-foreground mb-4">Nenhum item cadastrado</p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeiro Item
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Card key={item.id} className={isLowStock(item) ? "border-destructive" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      {item.is_kit && <Badge>Kit</Badge>}
                    </div>
                    {item.category && (
                      <CardDescription>{item.category}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Estoque:</span>
                        <span className={`font-bold ${isLowStock(item) ? "text-destructive" : ""}`}>
                          {item.current_stock} {item.unit}
                        </span>
                      </div>
                      {item.minimum_stock > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Mínimo:</span>
                          <span>{item.minimum_stock} {item.unit}</span>
                        </div>
                      )}
                      {item.cost_price && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Custo:</span>
                          <span>{formatCurrency(item.cost_price)}</span>
                        </div>
                      )}
                      {item.sale_price && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Venda:</span>
                          <span>{formatCurrency(item.sale_price)}</span>
                        </div>
                      )}
                      {isLowStock(item) && (
                        <Badge variant="destructive" className="w-full justify-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Estoque Baixo
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Movimentações</CardTitle>
              <CardDescription>Últimas 50 movimentações de estoque</CardDescription>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma movimentação registrada
                </p>
              ) : (
                <div className="space-y-3">
                  {movements.map((mov) => (
                    <div key={mov.id} className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-3">
                        {mov.type === "in" ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium">{mov.inventory_items?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {mov.reason || (mov.type === "in" ? "Entrada" : mov.type === "out" ? "Saída" : "Ajuste")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">
                          {mov.type === "out" ? "-" : "+"}{mov.quantity}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(mov.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Estoque;
