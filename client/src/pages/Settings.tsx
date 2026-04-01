import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { LendingSettingsPanel } from "@/components/investments/LendingSettingsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Settings() {
  const { user, logout } = useAuth();
  const [search, setSearch] = useState("");

  const displayName = useMemo(() => user?.name ?? "User", [user?.name]);
  const displayEmail = useMemo(() => user?.email ?? "", [user?.email]);

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cài đặt</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Quản lý tài khoản và tùy chọn ứng dụng.</p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Tài khoản</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tên</Label>
                <Input value={displayName} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={displayEmail} readOnly />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                className="text-destructive border-destructive/40 hover:text-destructive"
                onClick={() => {
                  if (confirm("Đăng xuất khỏi ứng dụng?")) logout();
                }}
              >
                Đăng xuất
              </Button>
            </div>
          </CardContent>
        </Card>

        <LendingSettingsPanel />

        <Card>
          <CardHeader>
            <CardTitle>Bảng tính</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Tùy chọn liên quan đến cách hiển thị và quản lý các bảng trong ứng dụng.
            </p>
            <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
              (Đã bỏ thông tin “Bảng tính lãi xuất tiết kiệm” khỏi mục này theo yêu cầu.)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tra cứu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tìm kiếm</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nhập từ khóa để tra cứu..."
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  if (!search.trim()) return toast.info("Vui lòng nhập từ khóa.");
                  toast.info(`Tra cứu: ${search.trim()} (tạm thời).`);
                }}
              >
                Bắt đầu tra cứu
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

