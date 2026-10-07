import React from 'react';
import { useAuth } from '@/AuthContext';
import { LayoutDashboard, Settings2, ClipboardList, Undo2, Shirt, Barcode, LogOut, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, setIsOpen }) => {
  const { profile, logout } = useAuth();

  const navItems = [
    { id: 'overview', label: 'Visao geral', icon: LayoutDashboard, adminOnly: false },
    { id: 'management', label: 'Gestao de contagens', icon: Settings2, adminOnly: true },
    { id: 'checklists', label: 'Checklists', icon: ClipboardList, adminOnly: false },
    { id: 'returns', label: 'Devolucoes', icon: Undo2, adminOnly: false },
    { id: 'uniforms', label: 'Uniformes', icon: Shirt, adminOnly: false },
    { id: 'products', label: 'Produtos', icon: Barcode, adminOnly: true },
    { id: 'users', label: 'Usuarios', icon: UserCog, adminOnly: true, masterOnly: true },
  ];

  const visibleItems = navItems.filter(
    (item) =>
      (!item.adminOnly || profile?.role === 'admin') && (!('masterOnly' in item) || profile?.isMaster === true),
  );

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transition-all duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center gap-3">
            <img
              src="/branding/logo-rede-tradicao.jpg"
              alt="Logo Rede Tradicao"
              className="h-10 w-10 rounded-xl object-cover shadow-lg shadow-primary/20"
            />
            <div>
              <h1 className="font-bold text-foreground leading-tight tracking-tight">Portal de Auditoria</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rede Tradicao</p>
            </div>
          </div>

          <Separator className="mx-6 w-auto bg-border" />

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  activeTab === item.id
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 bg-secondary/50 border-t border-border">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {profile?.displayName?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{profile?.displayName}</p>
                <p className="text-xs text-muted-foreground truncate capitalize">{profile?.role}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20 transition-colors"
              onClick={logout}
            >
              <LogOut className="w-4 h-4" />
              Sair do portal
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};
