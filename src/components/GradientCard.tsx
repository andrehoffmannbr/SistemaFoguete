import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GradientCardProps {
  children: React.ReactNode;
  gradient?: string;
  hover?: boolean;
  className?: string;
}

export const GradientCard = ({ 
  children, 
  gradient = "from-primary to-accent",
  hover = true,
  className = ""
}: GradientCardProps) => (
  <Card className={cn(
    "group relative overflow-hidden border-0 shadow-xl transition-all duration-500",
    hover && "hover:shadow-2xl hover:-translate-y-2",
    className
  )}>
    <div className={cn(
      "absolute inset-0 bg-gradient-to-br opacity-5",
      hover && "group-hover:opacity-10 transition-opacity duration-500",
      gradient
    )} />
    {children}
  </Card>
);
