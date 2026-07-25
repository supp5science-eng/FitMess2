import { createServerClient } from "@supabase/ssr";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";

import { buildReportDocument } from "@/lib/export/pdf-document";
import { buildReportModel } from "@/lib/export/report-model";
import { collectUserExport, ExportReadError } from "@/lib/export/user-data";
import type { Database } from "@/lib/types/db";

/**
 * `/api/export/pdf` -- the readable version of the data export.
 *
 * Same data as `/api/export` (one `collectUserExport` call, same own-row RLS
 * client built from this request's cookies), laid out as a document a person
 * can actually read instead of a JSON blob. The JSON route stays as the
 * machine-readable form.
 *
 * Node runtime, not edge: the PDF renderer needs Node APIs.
 */
export const runtime = "nodejs";

const EXPORT_PAGE_PATH = "/profil/moji-podaci";

export async function GET(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: src/middleware.ts already refreshed the session earlier in
          // this same request; a file download never needs to Set-Cookie.
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(
      new URL(`${EXPORT_PAGE_PATH}?greska=sesija`, request.url)
    );
  }

  try {
    const exportData = await collectUserExport(supabase, {
      id: user.id,
      email: user.email ?? null,
    });

    const buffer = await renderToBuffer(
      buildReportDocument(buildReportModel(exportData))
    );

    const filename = `fitmess-moji-podaci-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // The report is built per request from live data -- never cached by a
        // CDN, and never shared between users.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof ExportReadError) {
      console.error("[export pdf] failed to read user data:", err.message);
    } else {
      console.error("[export pdf] unexpected failure:", err);
    }
    return NextResponse.redirect(
      new URL(`${EXPORT_PAGE_PATH}?greska=pdf`, request.url)
    );
  }
}
