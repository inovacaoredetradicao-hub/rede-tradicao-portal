import React, { useState } from 'react';
import { useAuth } from '@/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardCheck, PackageSearch, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export function Login() {
  const { login, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!username || !password) {
      setError('Preencha usuario e senha.');
      return;
    }

    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <div className="lg:w-1/2 bg-primary p-12 flex flex-col justify-between text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full -translate-y-1/2 translate-x-1/2 opacity-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/40 rounded-full translate-y-1/2 -translate-x-1/2 opacity-20 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <img
              src="/branding/logo-rede-tradicao.jpg"
              alt="Logo Rede Tradicao"
              className="h-12 w-12 rounded-xl bg-background object-cover shadow-lg"
            />
            <h1 className="text-2xl font-bold tracking-tight">Portal de Auditoria</h1>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-md"
          >
            <h2 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">
              Contagens ciclicas e auditoria operacional
            </h2>
            <p className="text-white/90 text-lg mb-8 leading-relaxed">
              Cadastre regras, acompanhe lotes disparados para o app, revise auditorias, checklists e devolucoes finalizadas.
            </p>

            <div className="space-y-4">
              {[
                { icon: PackageSearch, text: 'Regras e disparos por produto ou classificacao' },
                { icon: ClipboardCheck, text: 'Checklists e devolucoes sincronizados do app' },
                { icon: ShieldCheck, text: 'Resultados de auditoria com PDF e assinatura' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-white/90">
                  <item.icon className="w-5 h-5 text-white/60" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 text-sm text-white/70">
          © {new Date().getFullYear()} Grupo Tradição. Todos os direitos reservados.
        </div>
      </div>

      <div className="lg:w-1/2 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-card p-10 rounded-2xl shadow-xl border border-border"
        >
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-foreground mb-2">Acesse o portal</h3>
            <p className="text-muted-foreground">Use o mesmo usuario e senha do app de auditoria.</p>
          </div>

          {error && (
            <div className="mb-6 bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                autoFocus
                placeholder="adm"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={loading}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
