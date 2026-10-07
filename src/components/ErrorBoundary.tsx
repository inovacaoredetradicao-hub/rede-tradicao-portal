import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private getFriendlyMessage(error: Error | null): string {
    if (!error) return 'Ocorreu um erro inesperado.';

    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error && parsed.error.includes('permission')) {
        return 'Você não tem permissão para realizar esta ação ou acessar estes dados. Verifique seu nível de acesso com o administrador.';
      }
      if (parsed.error && parsed.error.includes('offline')) {
        return 'Parece que você está offline. Verifique sua conexão com a internet.';
      }
      if (parsed.error && parsed.error.includes('quota')) {
        return 'O limite de uso diário foi atingido. Tente novamente mais tarde.';
      }
    } catch {
      // Not a JSON error
    }

    if (error.message.includes('network')) {
      return 'Erro de rede. Verifique sua conexão.';
    }

    return 'Algo deu errado. Nossa equipe técnica já foi notificada.';
  }

  public render() {
    if (this.state.hasError) {
      const message = this.getFriendlyMessage(this.state.error);

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-destructive/20 shadow-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">Ops! Algo deu errado</CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                {message}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mt-4 p-3 bg-secondary rounded-lg overflow-auto max-h-40">
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {this.state.error.stack || this.state.error.message}
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button 
                onClick={this.handleReset} 
                className="w-full gap-2 bg-primary text-primary-foreground"
              >
                <RefreshCcw className="w-4 h-4" />
                Tentar Novamente
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => window.location.href = '/'} 
                className="w-full gap-2"
              >
                <Home className="w-4 h-4" />
                Voltar para o Início
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
