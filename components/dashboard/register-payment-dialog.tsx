"use client";

import { useState, useEffect } from "react";
import { DollarSign, Loader2 } from "lucide-react";
import {
  useClientCycles as useClientCyclesHook,
  type BillingCycle,
} from "@/hooks/use-billing";
import { formatCurrency } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const statusConfig = {
  paid: {
    label: "Pago",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  pending: {
    label: "Pendente",
    className: "bg-muted text-muted-foreground border-border",
  },
  partial: {
    label: "Parcial",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  overdue: {
    label: "Vencido",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
  },
};

const monthNames = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

interface RegisterPaymentDialogProps {
  clientId: string;
  clientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectCycle: (cycle: BillingCycle) => void;
}

export function RegisterPaymentDialog({
  clientId,
  clientName,
  isOpen,
  onClose,
  onSelectCycle,
}: RegisterPaymentDialogProps) {
  const { cycles, isLoading, refetch } = useClientCyclesHook(clientId);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && clientId) {
      refetch();
    }
  }, [isOpen, clientId, refetch]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedCycleId(null);
    }
  }, [isOpen]);

  const getDaysOverdue = (dueDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const unpaidCycles = cycles
    .filter((c) => c.status !== "paid")
    .sort((a, b) => {
      const dateA = new Date(a.due_date).getTime();
      const dateB = new Date(b.due_date).getTime();
      return dateA - dateB;
    });
  const hasAnyCycles = unpaidCycles.length > 0;

  const handleConfirm = () => {
    const cycle = cycles.find((c) => c.id === selectedCycleId);
    if (cycle) {
      onSelectCycle(cycle);
      onClose();
    }
  };

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);

  const renderCycleItem = (cycle: BillingCycle) => {
    const status = statusConfig[cycle.status];
    const remaining = cycle.expected_amount - cycle.paid_amount;
    const daysOverdue =
      cycle.status === "overdue" ? getDaysOverdue(cycle.due_date) : 0;

    return (
      <button
        key={cycle.id}
        onClick={() => setSelectedCycleId(cycle.id)}
        className={`w-full rounded-lg border p-3 text-left transition-colors ${
          selectedCycleId === cycle.id
            ? "border-primary bg-primary/10"
            : "border-border hover:border-primary/50 hover:bg-secondary/30"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium ">
              {monthNames[cycle.cycle_month - 1]}/{cycle.cycle_year}
            </p>
            <p className="text-sm text-muted-foreground">
              Restante: {formatCurrency(remaining)}
              {daysOverdue > 0 && (
                <span className="text-red-500 ml-2">
                  ({daysOverdue} dia{daysOverdue !== 1 ? "s" : ""} em atraso)
                </span>
              )}
            </p>
          </div>
          <Badge className={status.className}>{status.label}</Badge>
        </div>
      </button>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
          <DialogDescription>
            Selecione o mês que deseja registrar o pagamento para {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasAnyCycles ? (
            <div className="py-8 text-center text-muted-foreground">
              <DollarSign className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>Nenhuma parcela encontrada</p>
            </div>
          ) : (
            <ScrollArea className="h-75 pr-4">
              <div className="space-y-2">
                <div className="space-y-2">
                  {unpaidCycles.filter((cycle) => cycle.status === "partial")
                    .length > 0 && (
                    <div className="text-sm space-y-2">
                      <p className="my-2">
                        pagamento parcial(
                        {
                          unpaidCycles.filter((c) => c.status === "partial")
                            .length
                        }
                        )
                      </p>
                      {unpaidCycles
                        .filter((c) => c.status === "partial")
                        .map((cycle) => renderCycleItem(cycle))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {unpaidCycles.filter((cycle) => cycle.status === "overdue")
                    .length > 0 && (
                    <div className="text-sm space-y-2">
                      <p className="my-2">
                        pagamento vencidos(
                        {
                          unpaidCycles.filter((c) => c.status === "overdue")
                            .length
                        }
                        )
                      </p>
                      {unpaidCycles
                        .filter((c) => c.status === "overdue")
                        .map((cycle) => renderCycleItem(cycle))}
                    </div>
                  )}
                </div>

                <div className="">
                  {unpaidCycles.filter((cycle) => cycle.status === "pending")
                    .length > 0 && (
                    <div className="text-sm space-y-2">
                      <p className="my-2">
                        pagamento pendentes(
                        {
                          unpaidCycles.filter((c) => c.status === "pending")
                            .length
                        }
                        )
                      </p>
                      {unpaidCycles
                        .filter((c) => c.status === "pending")
                        .map((cycle) => renderCycleItem(cycle))}
                    </div>
                  )}
                </div>
                {/*unpaidCycles.map((cycle) => renderCycleItem(cycle))*/}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedCycleId || !selectedCycle}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Registrar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
