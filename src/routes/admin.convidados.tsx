import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  Copy,
  Loader2,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { event } from "@/lib/event";
import {
  createGuestAdmin,
  createGuestsBulkAdmin,
  listGuestsAdmin,
  verifyAdminPassword,
  type GuestAdmin,
} from "@/lib/guests-admin";
import { inviteUrl, inviteWhatsAppUrl } from "@/lib/invite";

const STORAGE_KEY = "cha-admin-password";

export const Route = createFileRoute("/admin/convidados")({
  head: () => ({
    meta: [{ title: `Admin convidados · ${event.title}` }],
  }),
  component: AdminGuestsPage,
});

function AdminGuestsPage() {
  const verify = useServerFn(verifyAdminPassword);
  const listGuests = useServerFn(listGuestsAdmin);
  const createOne = useServerFn(createGuestAdmin);
  const createBulk = useServerFn(createGuestsBulkAdmin);

  const [password, setPassword] = useState("");
  const [authedPassword, setAuthedPassword] = useState<string | null>(null);
  const [appUrl, setAppUrl] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [guests, setGuests] = useState<GuestAdmin[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [singleName, setSingleName] = useState("");
  const [bulkNames, setBulkNames] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const origin =
    appUrl ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const stats = useMemo(() => {
    const confirmed = guests.filter((g) => g.status === "confirmed").length;
    return { total: guests.length, confirmed, pending: guests.length - confirmed };
  }, [guests]);

  const refresh = async (adminPassword: string) => {
    setLoadingList(true);
    try {
      const rows = await listGuests({ data: { adminPassword } });
      setGuests(rows);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível carregar convidados"));
      throw error;
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    void (async () => {
      try {
        const result = await verify({ data: { adminPassword: saved } });
        setAppUrl(result.appUrl);
        setAuthedPassword(saved);
        await refresh(saved);
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, []);

  const login = async () => {
    setLoginBusy(true);
    try {
      const result = await verify({ data: { adminPassword: password } });
      sessionStorage.setItem(STORAGE_KEY, password);
      setAppUrl(result.appUrl);
      setAuthedPassword(password);
      await refresh(password);
      toast.success("Acesso liberado");
    } catch (error) {
      toast.error(getErrorMessage(error, "Senha inválida"));
    } finally {
      setLoginBusy(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthedPassword(null);
    setPassword("");
    setGuests([]);
  };

  const copyText = async (text: string, code?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (code) {
        setCopiedCode(code);
        window.setTimeout(() => setCopiedCode(null), 1500);
      }
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const addOne = async () => {
    if (!authedPassword || !singleName.trim()) return;
    setCreating(true);
    try {
      const guest = await createOne({
        data: {
          adminPassword: authedPassword,
          displayName: singleName.trim(),
        },
      });
      setSingleName("");
      setGuests((prev) => [...prev, guest]);
      toast.success(`Convite criado: ${guest.displayName}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Erro ao criar convidado"));
    } finally {
      setCreating(false);
    }
  };

  const addBulk = async () => {
    if (!authedPassword || !bulkNames.trim()) return;
    setCreating(true);
    try {
      const result = await createBulk({
        data: {
          adminPassword: authedPassword,
          namesText: bulkNames,
        },
      });
      setBulkNames("");
      setGuests((prev) => [...prev, ...result.created]);
      toast.success(`${result.count} convites criados`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Erro no cadastro em lote"));
    } finally {
      setCreating(false);
    }
  };

  const copyAllLinks = async () => {
    const lines = guests.map(
      (g) => `${g.displayName}\t${inviteUrl(origin, g.inviteCode)}`,
    );
    await copyText(lines.join("\n"));
  };

  if (!authedPassword) {
    return (
      <div className="bg-hero flex min-h-svh items-center justify-center px-6">
        <Toaster position="top-center" richColors />
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Admin
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold">
              Convidados
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre com a senha de `ADMIN_PASSWORD` do .env
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-pass">Senha</Label>
            <Input
              id="admin-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void login();
              }}
            />
          </div>
          <Button
            className="w-full"
            disabled={loginBusy || !password}
            onClick={() => void login()}
          >
            {loginBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Entrar"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <Toaster position="top-center" richColors />

      <header className="border-b border-border bg-hero">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {event.coupleNames}
            </p>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">
              Convidados & convites
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loadingList}
              onClick={() => void refresh(authedPassword)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Total" value={stats.total} />
          <Stat label="Confirmados" value={stats.confirmed} />
          <Stat label="Pendentes" value={stats.pending} />
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="inline-flex items-center gap-2 font-display text-xl font-semibold">
              <Plus className="h-4 w-4 text-primary" />
              Adicionar um
            </h2>
            <div className="space-y-2">
              <Label htmlFor="single-name">Nome ou casal</Label>
              <Input
                id="single-name"
                placeholder="Ex.: Ana & Carlos"
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addOne();
                }}
              />
            </div>
            <Button
              disabled={creating || !singleName.trim()}
              onClick={() => void addOne()}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Criar convite"
              )}
            </Button>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="inline-flex items-center gap-2 font-display text-xl font-semibold">
              <Users className="h-4 w-4 text-primary" />
              Adicionar vários
            </h2>
            <p className="text-sm text-muted-foreground">
              Um nome (ou casal) por linha. Gera o link de cada um.
            </p>
            <Textarea
              rows={6}
              placeholder={"Maria\nPedro & Juliana\nTia Ana"}
              value={bulkNames}
              onChange={(e) => setBulkNames(e.target.value)}
            />
            <Button
              disabled={creating || !bulkNames.trim()}
              onClick={() => void addBulk()}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Criar todos"
              )}
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold sm:text-2xl">
                Links dos convites
              </h2>
              <p className="text-sm text-muted-foreground">
                Copie o link ou abra o WhatsApp com a mensagem pronta. Os links
                usam o <code className="text-xs">APP_URL</code> do servidor
                {appUrl ? ` (${appUrl})` : ""}.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={guests.length === 0}
              onClick={() => void copyAllLinks()}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar todos (nome + link)
            </Button>
          </div>

          {loadingList ? (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </p>
          ) : guests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum convidado ainda. Adicione em lote acima.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {guests.map((guest) => {
                const url = inviteUrl(origin, guest.inviteCode);
                const wa = inviteWhatsAppUrl(origin, guest);
                return (
                  <li
                    key={guest.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{guest.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {url}
                      </p>
                      <p className="mt-1 text-xs">
                        {guest.status === "confirmed" ? (
                          <span className="text-primary">Confirmado</span>
                        ) : (
                          <span className="text-muted-foreground">Pendente</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void copyText(url, guest.inviteCode)}
                      >
                        {copiedCode === guest.inviteCode ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        Copiar link
                      </Button>
                      <Button size="sm" variant="secondary" asChild>
                        <a href={wa} target="_blank" rel="noreferrer">
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
