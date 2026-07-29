"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BarcodeScanner } from "@/components/scan/barcode-scanner";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/locale-provider";

// F035 / AS-064: the admin "scan barcode to create or open" entry point. Reuses
// the unmodified F030 `BarcodeScanner` (same `onDetected(gtin)` contract the
// user-facing `ScanScreen` uses). On a decode it asks the existing barcode
// lookup whether a food with that GTIN already exists: HIT -> open its editor;
// MISS -> open the create form with the GTIN pre-filled (mark-verified-on-save).

export function AdminScanButton() {
  const { t } = useT();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);

  async function onDetected(gtin: string) {
    setScanning(false);
    try {
      const response = await fetch(
        `/api/foods/barcode/${encodeURIComponent(gtin)}`
      );
      const body = (await response.json()) as {
        ok?: boolean;
        data?: { id: string } | null;
      };
      if (response.ok && body.ok && body.data) {
        router.push(`/admin/hrana/${body.data.id}`);
        return;
      }
    } catch {
      // Fall through to create -- a lookup failure shouldn't trap the admin.
    }
    router.push(`/admin/hrana/novi?barkod=${encodeURIComponent(gtin)}`);
  }

  if (scanning) {
    return (
      <div className="flex flex-col gap-2">
        <BarcodeScanner onDetected={onDetected} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setScanning(false)}
          className="self-start"
        >
          {t("admin.scan.cancel")}
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" onClick={() => setScanning(true)}>
      {t("admin.scan.button")}
    </Button>
  );
}
