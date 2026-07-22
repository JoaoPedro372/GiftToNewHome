import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Save, Upload } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import {
  BUNDLED_GIFT_IMAGE_KEYS,
  resolveProductImage,
} from "@/lib/products";
import {
  createProductAdmin,
  listProductsAdmin,
  updateProductAdmin,
  uploadProductImageAdmin,
  type ProductAdmin,
} from "@/lib/products-admin";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminPassword: string;
};

type Draft = {
  id: string;
  name: string;
  description: string;
  imageKey: string;
  goal: string;
  sortOrder: string;
};

function toDraft(p: ProductAdmin): Draft {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    imageKey: p.imageKey,
    goal: String(p.goal),
    sortOrder: String(p.sortOrder),
  };
}

const emptyDraft = (): Draft => ({
  id: "",
  name: "",
  description: "",
  imageKey: BUNDLED_GIFT_IMAGE_KEYS[0],
  goal: "500",
  sortOrder: "10",
});

export function AdminProductsModal({
  open,
  onOpenChange,
  adminPassword,
}: Props) {
  const listProducts = useServerFn(listProductsAdmin);
  const updateProduct = useServerFn(updateProductAdmin);
  const createProduct = useServerFn(createProductAdmin);
  const uploadImage = useServerFn(uploadProductImageAdmin);

  const [products, setProducts] = useState<ProductAdmin[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [mode, setMode] = useState<"edit" | "create">("edit");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listProducts({ data: { adminPassword } });
      setProducts(rows);
      if (rows.length > 0) {
        setMode("edit");
        setSelectedId(rows[0].id);
        setDraft(toDraft(rows[0]));
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Erro ao carregar presentes"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when modal opens
  }, [open, adminPassword]);

  const selectProduct = (id: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setMode("edit");
    setSelectedId(id);
    setDraft(toDraft(product));
  };

  const startCreate = () => {
    setMode("create");
    setSelectedId(null);
    setDraft({
      ...emptyDraft(),
      sortOrder: String(
        products.reduce((max, p) => Math.max(max, p.sortOrder), 0) + 1,
      ),
    });
  };

  const save = async () => {
    const goal = Number(draft.goal.replace(",", "."));
    const sortOrder = Number(draft.sortOrder);
    if (!draft.name.trim() || !draft.description.trim() || !draft.imageKey.trim()) {
      toast.error("Preencha nome, descrição e imagem");
      return;
    }
    if (!Number.isFinite(goal) || goal <= 0) {
      toast.error("Meta inválida");
      return;
    }
    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
      toast.error("Ordem inválida");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        if (!draft.id.trim()) {
          toast.error("Informe um id (ex.: airfryer)");
          return;
        }
        const created = await createProduct({
          data: {
            adminPassword,
            id: draft.id.trim(),
            name: draft.name.trim(),
            description: draft.description.trim(),
            imageKey: draft.imageKey.trim(),
            goal,
            sortOrder,
          },
        });
        setProducts((prev) =>
          [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder),
        );
        setMode("edit");
        setSelectedId(created.id);
        setDraft(toDraft(created));
        toast.success("Presente criado");
      } else {
        if (!selectedId) return;
        const updated = await updateProduct({
          data: {
            adminPassword,
            id: selectedId,
            name: draft.name.trim(),
            description: draft.description.trim(),
            imageKey: draft.imageKey.trim(),
            goal,
            sortOrder,
          },
        });
        setProducts((prev) =>
          prev
            .map((p) => (p.id === updated.id ? updated : p))
            .sort((a, b) => a.sortOrder - b.sortOrder),
        );
        setDraft(toDraft(updated));
        toast.success("Presente atualizado");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível salvar"));
    } finally {
      setSaving(false);
    }
  };

  const preview = resolveProductImage(draft.imageKey || "sofa");
  const selected = products.find((p) => p.id === selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lista de presentes</DialogTitle>
          <DialogDescription>
            Edite nome, descrição, meta e imagem. O valor arrecadado continua
            vindo dos pagamentos.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="inline-flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando presentes…
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[200px_1fr]">
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={startCreate}
              >
                <Plus className="h-3.5 w-3.5" />
                Novo presente
              </Button>
              <ul className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-border p-1">
                {products.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => selectProduct(p.id)}
                      className={`w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                        mode === "edit" && selectedId === p.id
                          ? "bg-sage-soft font-medium"
                          : "hover:bg-muted"
                      }`}
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              {mode === "create" && (
                <div className="space-y-2">
                  <Label htmlFor="product-id">Id (único, sem espaços)</Label>
                  <Input
                    id="product-id"
                    placeholder="airfryer"
                    value={draft.id}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, id: e.target.value }))
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="product-name">Nome</Label>
                <Input
                  id="product-name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-desc">Descrição</Label>
                <Textarea
                  id="product-desc"
                  rows={3}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-goal">Meta (R$)</Label>
                  <Input
                    id="product-goal"
                    inputMode="decimal"
                    value={draft.goal}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, goal: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-order">Ordem na lista</Label>
                  <Input
                    id="product-order"
                    inputMode="numeric"
                    value={draft.sortOrder}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, sortOrder: e.target.value }))
                    }
                  />
                </div>
              </div>

              {mode === "edit" && selected && (
                <p className="text-xs text-muted-foreground">
                  Arrecadado:{" "}
                  {selected.raised.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}{" "}
                  (atualiza só com pagamentos)
                </p>
              )}

              <div className="space-y-2">
                <Label>Imagem pronta do site</Label>
                <Select
                  value={
                    (BUNDLED_GIFT_IMAGE_KEYS as readonly string[]).includes(
                      draft.imageKey,
                    )
                      ? draft.imageKey
                      : "__custom__"
                  }
                  onValueChange={(value) => {
                    if (value === "__custom__") return;
                    setDraft((d) => ({ ...d, imageKey: value }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma imagem" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUNDLED_GIFT_IMAGE_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {key}.jpg
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">
                      URL / chave personalizada…
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-upload">Enviar foto do computador</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="product-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      void (async () => {
                        const productId =
                          mode === "edit"
                            ? selectedId
                            : draft.id.trim() || "novo";
                        if (!productId) {
                          toast.error(
                            "Informe o id do presente antes de enviar a foto",
                          );
                          return;
                        }
                        if (file.size > 4_500_000) {
                          toast.error("Imagem muito grande (máx. ~4.5 MB)");
                          return;
                        }
                        setUploading(true);
                        try {
                          const buffer = await file.arrayBuffer();
                          const bytes = new Uint8Array(buffer);
                          let binary = "";
                          for (let i = 0; i < bytes.length; i++) {
                            binary += String.fromCharCode(bytes[i]!);
                          }
                          const base64 = btoa(binary);
                          const result = await uploadImage({
                            data: {
                              adminPassword,
                              productId,
                              fileName: file.name,
                              contentType: file.type || "image/jpeg",
                              base64,
                            },
                          });
                          setDraft((d) => ({
                            ...d,
                            imageKey: result.publicUrl,
                          }));
                          toast.success("Foto enviada");
                        } catch (error) {
                          toast.error(
                            getErrorMessage(error, "Falha no upload"),
                          );
                        } finally {
                          setUploading(false);
                        }
                      })();
                    }}
                  />
                  {uploading && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Upload className="h-3.5 w-3.5" />
                      Enviando…
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Google Drive não funciona bem como foto embutida. Prefira
                  enviar o arquivo aqui (fica no Supabase Storage).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-image">
                  Imagem (chave local ou URL)
                </Label>
                <Input
                  id="product-image"
                  placeholder="sofa  ou  https://…"
                  value={draft.imageKey}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, imageKey: e.target.value }))
                  }
                />
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-muted">
                <img
                  src={preview}
                  alt="Prévia"
                  className="h-40 w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                  }}
                  onLoad={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "1";
                  }}
                />
              </div>

              <Button
                type="button"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {mode === "create" ? "Criar presente" : "Salvar alterações"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
