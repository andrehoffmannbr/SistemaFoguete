export const LoadingState = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-accent rounded-full animate-spin" 
           style={{ animationDelay: '150ms' }} />
    </div>
    <p className="text-lg font-medium text-muted-foreground animate-pulse">
      Carregando...
    </p>
  </div>
);
