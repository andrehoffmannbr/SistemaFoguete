import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GradientCard } from "./GradientCard";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  gradient: string;
  trend?: {
    value: number;
    positive: boolean;
  };
}

export const StatCard = ({ title, value, icon: Icon, gradient, trend }: StatCardProps) => (
  <GradientCard gradient={gradient}>
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </CardTitle>
      <div className={cn(
        "p-2 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform",
        gradient
      )}>
        <Icon className="w-4 h-4 text-white" />
      </div>
    </CardHeader>
    <CardContent className="space-y-1 pb-4">
      <div className="text-2xl font-bold">{value}</div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium",
          trend.positive ? "text-accent" : "text-destructive"
        )}>
          {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{Math.abs(trend.value)}%</span>
        </div>
      )}
    </CardContent>
    <div className={cn(
      "absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r opacity-50 group-hover:opacity-100 transition-opacity",
      gradient
    )} />
  </GradientCard>
);
