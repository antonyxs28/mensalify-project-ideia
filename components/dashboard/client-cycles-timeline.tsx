"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Check,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  useClientCycles,
  useAddPayment,
  type BillingCycle,
} from "@/hooks/use-billing-cycles";
import { formatCurrency } from "@/lib/validation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase/client";
import {
  normalizeAndSortCycles,
  calculateStats,
  detectCurrentMonth,
  createVirtualCurrentCycle,
  getCurrentMonthKey,
  computeStatus,
} from "@/services/billing-cycles/normalize";
import type { NormalizedBillingCycle } from "@/services/billing-cycles/types";

async function getClientAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
    headers["x-refresh-token"] = session.refresh_token || "";
  }
  return headers;
}

const statusConfig = {
  paid: {
    label: "Pago",
    icon: CheckCircle2,
    className: "bg-success/10 text-success border-success/20",
  },
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "bg-muted text-muted-foreground border-border",
  },
  partial: {
    label: "Parcial",
    icon: Clock,
    className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  overdue: {
    label: "Vencido",
    icon: AlertCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

type CycleStatus = "pending" | "paid" | "overdue" | "partial";

interface CycleCardProps {
  cycle: NormalizedBillingCycle;
  onPayFull: () => void;
  onPayPartial: () => void;
  isProcessing: boolean;
}

function CycleCard({
  cycle,
  onPayFull,
  onPayPartial,
  isProcessing,
}: CycleCardProps) {
  const status =
    statusConfig[cycle.status as CycleStatus] || statusConfig.pending;
  const StatusIcon = status.icon;
  const progress =
    cycle.expectedAmount > 0
      ? (cycle.paidAmount / cycle.expectedAmount) * 100
      : 0;
  const remaining = cycle.expectedAmount - cycle.paidAmount;
  const referenceMonthName = cycle.referenceDate.toLocaleString("pt-BR", {
    month: "long",
  });
  const referenceYear = cycle.referenceDate.getFullYear();
  const isFuture = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cycleDue = new Date(cycle.dueDate);
    cycleDue.setHours(0, 0, 0, 0);
    return cycleDue > today;
  }, [cycle.dueDate]);
  const showPaymentActions = cycle.status !== "paid" && remaining > 0;
  const payPartialLabel =
    cycle.status === "partial" ? "Pagar Restante" : "Pagar Parcial";
  const payFullLabel =
    cycle.status === "partial" ? "Completar Pagamento" : "Pagar Total";

  const daysOverdue = useMemo(() => {
    if (cycle.status === "paid") return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(cycle.dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }, [cycle.dueDate, cycle.status]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50 ${cycle.isVirtual ? "border-primary/30 bg-primary/5" : ""} ${isFuture ? "opacity-50" : ""}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <Calendar className="h-5 w-5 text-primary" />
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium flex items-center gap-2">
              {referenceMonthName.charAt(0).toUpperCase() +
                referenceMonthName.slice(1)}{" "}
              {referenceYear}
              {cycle.isVirtual && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  Atual
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Vencimento: {cycle.dueDate.toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={status.className}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {status.label}
            </Badge>
            {daysOverdue > 0 && cycle.status !== "paid" && (
              <span className="text-xs text-destructive font-medium">
                {daysOverdue} dia{daysOverdue !== 1 ? "s" : ""} em atraso
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Progresso</span>
              <span>
                {formatCurrency(cycle.paidAmount)} /{" "}
                {formatCurrency(cycle.expectedAmount)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={`h-full ${progress >= 100 ? "bg-success" : "bg-primary"}`}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        {showPaymentActions && (
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onPayPartial}
              disabled={isProcessing}
              className="flex-1"
            >
              <Plus className="mr-1 h-4 w-4" />
              {payPartialLabel}
            </Button>
            <Button
              size="sm"
              onClick={onPayFull}
              disabled={isProcessing}
              className="flex-1"
            >
              <Check className="mr-1 h-4 w-4" />
              {payFullLabel}
            </Button>
          </div>
        )}

        {isFuture && remaining > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Vencimento em {cycle.dueDate.toLocaleDateString("pt-BR")}
          </p>
        )}

        {cycle.status === "partial" && remaining > 0 && (
          <p className="text-xs text-amber-600 mt-1">
            Falta pagar: {formatCurrency(remaining)}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">Nenhum ciclo de cobrança</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Os ciclos de cobrança serão criados automaticamente
      </p>
    </div>
  );
}

interface ClientSummaryProps {
  monthlyPrice: number;
  dueDay: number;
  stats: ReturnType<typeof calculateStats>;
}

function ClientSummary({ monthlyPrice, dueDay, stats }: ClientSummaryProps) {
  const progress =
    stats.totalExpected > 0 ? (stats.totalPaid / stats.totalExpected) * 100 : 0;
  const pending = stats.totalExpected - stats.totalPaid;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div>
          <p className="text-sm text-muted-foreground">Valor Mensal</p>
          <p className="text-lg font-semibold">
            {formatCurrency(monthlyPrice)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Dia de Vencimento</p>
          <p className="text-lg font-semibold">{dueDay}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total Recebido</p>
          <p className="text-lg font-semibold text-success">
            {formatCurrency(stats.totalPaid)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Pendente</p>
          <p className="text-lg font-semibold text-destructive">
            {formatCurrency(pending)}
          </p>
        </div>
      </div>
      {stats.totalCycles > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progresso Geral</span>
            <span>
              {stats.totalPaid.toFixed(0)} / {stats.totalExpected.toFixed(0)} (
              {progress.toFixed(0)}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-success"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface PaymentModalProps {
  isOpen: boolean;
  cycle: NormalizedBillingCycle | null;
  isFullPayment: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void>;
  isProcessing: boolean;
}

function PaymentModal({
  isOpen,
  cycle,
  isFullPayment,
  onClose,
  onSubmit,
  isProcessing,
}: PaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (cycle && isOpen) {
      const remaining = cycle.expectedAmount - cycle.paidAmount;
      setAmount(isFullPayment ? remaining.toString() : "");
    }
  }, [cycle, isOpen, isFullPayment]);

  const handleSubmit = async () => {
    if (!amount || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(parseFloat(amount));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !cycle) return null;

  const remaining = cycle.expectedAmount - cycle.paidAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {isFullPayment ? "Marcar como Pago" : "Registrar Pagamento Parcial"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Valor (R$)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-md border p-2"
              step="0.01"
              min="0"
              max={remaining.toString()}
              readOnly={isFullPayment}
              placeholder={isFullPayment ? "" : "Digite o valor"}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Total do ciclo: {formatCurrency(cycle.expectedAmount)}
          </p>
          {cycle.paidAmount > 0 && (
            <p className="text-sm text-muted-foreground">
              Já pago: {formatCurrency(cycle.paidAmount)}
            </p>
          )}
          {isFullPayment && (
            <p className="text-sm text-success font-medium">
              Valor restante: {formatCurrency(remaining)}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
              className="flex-1"
            >
              {isSubmitting
                ? "Salvando..."
                : isFullPayment
                  ? "Confirmar Pagamento"
                  : "Confirmar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ClientCyclesTimeline({
  clientId,
  clientName,
  monthlyPrice,
  dueDay = 5,
}: {
  clientId: string;
  clientName: string;
  monthlyPrice: number;
  dueDay?: number;
}) {
  const {
    cycles: dbCycles,
    isLoading,
    error,
    refetch,
  } = useClientCycles(clientId);
  const { addPayment, isLoading: isAddingPayment } = useAddPayment();
  const [selectedCycle, setSelectedCycle] =
    useState<NormalizedBillingCycle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFullPayment, setIsFullPayment] = useState(false);

  const normalizedCycles = useMemo(() => {
    console.log(
      "[ClientCyclesTimeline] Input dbCycles:",
      dbCycles?.length || 0,
    );
    console.log(
      "[ClientCyclesTimeline] monthlyPrice:",
      monthlyPrice,
      "dueDay:",
      dueDay,
    );

    if (!dbCycles || dbCycles.length === 0) {
      if (monthlyPrice > 0) {
        const virtualCycle = createVirtualCurrentCycle(
          monthlyPrice,
          dueDay,
          clientId,
        );
        console.log("[ClientCyclesTimeline] Created initial virtual cycle:", {
          id: virtualCycle.id,
          year: virtualCycle.year,
          month: virtualCycle.month,
        });
        return [virtualCycle];
      }
      return [];
    }

    const result = normalizeAndSortCycles(
      dbCycles,
      monthlyPrice,
      dueDay,
      clientId,
    );
    console.log(
      "[ClientCyclesTimeline] Output normalized cycles:",
      result.length,
    );
    return result;
  }, [dbCycles, monthlyPrice, dueDay, clientId]);

  const stats = useMemo(
    () => calculateStats(normalizedCycles),
    [normalizedCycles],
  );

  const handlePayFull = (cycle: NormalizedBillingCycle) => {
    setSelectedCycle(cycle);
    setIsFullPayment(true);
    setIsModalOpen(true);
  };

  const handlePayPartial = (cycle: NormalizedBillingCycle) => {
    setSelectedCycle(cycle);
    setIsFullPayment(false);
    setIsModalOpen(true);
  };

  const handleSubmitPayment = async (amount: number) => {
    if (!selectedCycle) return;

    try {
      const headers = await getClientAuthHeaders();

      if (selectedCycle.isVirtual) {
        const response = await fetch("/api/payments", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            client_id: clientId,
            amount: amount,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to process payment");
        }

        toast.success("Pagamento registrado com sucesso!");
      } else {
        const result = await addPayment(selectedCycle.id, amount);
        if (result.success) {
          toast.success("Pagamento registrado com sucesso!");
        } else {
          throw new Error(result.error);
        }
      }

      setIsModalOpen(false);
      setSelectedCycle(null);
      refetch();
    } catch (err) {
      console.error("[ClientCyclesTimeline] Payment error:", err);
      toast.error(
        err instanceof Error ? err.message : "Erro ao processar pagamento",
      );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ciclos de Cobrança</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Erro ao carregar ciclos: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Ciclos de Cobrança</span>
          <Badge variant="outline">{formatCurrency(monthlyPrice)}/mês</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ClientSummary
          monthlyPrice={monthlyPrice}
          dueDay={dueDay}
          stats={stats}
        />

        {normalizedCycles.length === 0 && monthlyPrice === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {normalizedCycles.map((cycle) => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                onPayFull={() => handlePayFull(cycle)}
                onPayPartial={() => handlePayPartial(cycle)}
                isProcessing={isAddingPayment}
              />
            ))}
          </div>
        )}
      </CardContent>

      <PaymentModal
        isOpen={isModalOpen}
        cycle={selectedCycle}
        isFullPayment={isFullPayment}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCycle(null);
        }}
        onSubmit={handleSubmitPayment}
        isProcessing={isAddingPayment}
      />
    </Card>
  );
}
