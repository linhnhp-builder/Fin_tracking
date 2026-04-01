import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { InvestmentCard } from "./InvestmentCard";

type TermUnit = "week" | "month" | "year";

const TERM_UNIT_LABELS: Record<TermUnit, string> = {
  week: "Tuần",
  month: "Tháng",
  year: "Năm",
};

function formatInputNumber(val: string): string {
  const raw = val.replace(/[^0-9]/g, "");
  if (!raw) return "";
  return parseInt(raw, 10).toLocaleString("vi-VN");
}

function parseFormattedNumber(val: string): number {
  return parseFloat(val.replace(/\./g, "").replace(/,/g, "")) || 0;
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder={placeholder ?? "VD: 50.000.000"}
      value={value}
      onChange={(e) => onChange(formatInputNumber(e.target.value))}
      className="num"
    />
  );
}

type LendingForm = {
  name: string;
  totalInvested: string;
  lendingRatePct: string;
  lendingTermValue: string;
  lendingTermUnit: TermUnit;
  dueDate: string;
};

function getDefaultLendingForm(): LendingForm {
  return {
    name: "",
    totalInvested: "",
    lendingRatePct: "",
    lendingTermValue: "",
    lendingTermUnit: "month",
    dueDate: "",
  };
}

export function LendingSettingsPanel() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<LendingForm>(getDefaultLendingForm);
  const utils = trpc.useUtils();
  const { data: investments = [] } = trpc.investment.list.useQuery();
const { data: marketPrices } = trpc.market.prices.useQuery();

  const lendingList = useMemo(
    () =>
      investments
        .filter((inv) => inv.assetType === "lending")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [investments]
  );

  const createMutation = trpc.investment.create.useMutation({
    onSuccess: () => {
      utils.investment.list.invalidate();
      toast.success("Đã thêm khoản cho vay");
      setDialogOpen(false);
      setForm(getDefaultLendingForm());
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.investment.delete.useMutation({
    onSuccess: () => {
      utils.investment.list.invalidate();
      toast.success("Đã xóa khoản cho vay");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    if (!form.name.trim()) return toast.error("Tên khoản không được để trống");
    const investedNum = parseFormattedNumber(form.totalInvested);
    if (investedNum <= 0) return toast.error("Số tiền không hợp lệ");

    const metadata: Record<string, unknown> = {};
    if (form.lendingRatePct) metadata.rate_pct = parseFloat(form.lendingRatePct);
    if (form.lendingTermValue) {
      metadata.term_value = parseFloat(form.lendingTermValue);
      metadata.term_unit = TERM_UNIT_LABELS[form.lendingTermUnit];
    }
    if (form.dueDate) metadata.due_date = form.dueDate;

    createMutation.mutate({
      name: form.name.trim(),
      assetType: "lending",
      unit: "VNĐ",
      totalInvested: investedNum,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cho vay</CardTitle>
        <CardDescription>
          Quản lý các khoản cho vay. Vẫn được tính trong tổng tài sản tại mục Tài sản.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              setForm(getDefaultLendingForm());
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Tạo mới
          </Button>
        </div>
        {lendingList.length === 0 ? (
          <p className="text-xs text-muted-foreground">Chưa có khoản cho vay.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {lendingList.map((inv) => (
              <InvestmentCard
                key={inv.id}
                inv={inv}
                marketPrices={marketPrices ?? null}
                onDelete={(id) => {
                  if (confirm("Xóa khoản cho vay này?")) deleteMutation.mutate({ id });
                }}
              />
            ))}
          </div>
        )}
      </CardContent>

      <Drawer open={dialogOpen} onOpenChange={setDialogOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Tạo khoản cho vay</DrawerTitle>
            <DrawerDescription>Nhập thông tin khoản cho vay.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2 max-h-[65vh] overflow-y-auto space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tên khoản *</Label>
              <Input
                placeholder="VD: Cho vay ngắn hạn"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Số tiền (VNĐ) *</Label>
              <MoneyInput
                value={form.totalInvested}
                onChange={(v) => setForm({ ...form, totalInvested: v })}
                placeholder="50.000.000"
              />
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Lãi suất (%/năm)</Label>
                <Input
                  type="number"
                  placeholder="VD: 12"
                  value={form.lendingRatePct}
                  onChange={(e) => setForm({ ...form, lendingRatePct: e.target.value })}
                  step="0.1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Số kỳ hạn</Label>
                  <Input
                    type="number"
                    placeholder="VD: 3"
                    value={form.lendingTermValue}
                    onChange={(e) => setForm({ ...form, lendingTermValue: e.target.value })}
                    min="1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Đơn vị</Label>
                  <Select
                    value={form.lendingTermUnit}
                    onValueChange={(v) => setForm({ ...form, lendingTermUnit: v as TermUnit })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Tuần</SelectItem>
                      <SelectItem value="month">Tháng</SelectItem>
                      <SelectItem value="year">Năm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Ngày đáo hạn (tùy chọn)</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DrawerFooter>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Hủy
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                Lưu
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Card>
  );
}
