import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { wordmarkLetterColors } from "@/lib/brand/wordmark";
import { PDF_FONT_FAMILY, PDF_FONT_SOURCES } from "@/lib/export/pdf-font";
import type { ReportField, ReportModel, ReportTable } from "@/lib/export/report-model";

/**
 * The printable "Moji podaci" report.
 *
 * Server-only: `@react-pdf/renderer` is rendered to a buffer inside the
 * `/api/export/pdf` route, so none of this reaches the phone's bundle.
 *
 * Layout choices are made for a page, not a screen: a fixed table header that
 * repeats across pages, rows that never split mid-line, and a footer with page
 * numbers -- a 12-page food log is useless if page 7 starts with unlabeled
 * columns.
 */

Font.register({ family: PDF_FONT_FAMILY, fonts: PDF_FONT_SOURCES });

// A hyphen-less font subset would break long food names across pages oddly;
// disabling hyphenation keeps Serbian words intact.
Font.registerHyphenationCallback((word) => [word]);

const BRAND = "#17d1a8";
const INK = "#14181a";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const ZEBRA = "#f7f8f8";

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    color: INK,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 8,
    marginBottom: 16,
  },
  wordmark: { fontSize: 20, fontWeight: 700 },
  headerRight: { fontSize: 8, color: MUTED, textAlign: "right" },
  title: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  intro: { fontSize: 8.5, color: MUTED, marginBottom: 14, lineHeight: 1.4 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
  },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  field: { width: "50%", flexDirection: "row", paddingVertical: 2.5 },
  fieldLabel: { color: MUTED, width: 90 },
  fieldValue: { fontWeight: 700 },

  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 3,
    marginBottom: 1,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 3,
  },
  tableRowAlt: { backgroundColor: ZEBRA },
  cell: { paddingHorizontal: 3 },
  cellHead: { fontWeight: 700, fontSize: 8.5 },
  note: { fontSize: 8, color: MUTED, marginTop: 4, fontStyle: "normal" },
  warning: {
    fontSize: 8.5,
    color: INK,
    backgroundColor: "#fff7ed",
    borderLeftWidth: 2,
    borderLeftColor: "#f59e0b",
    padding: 6,
    marginBottom: 10,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: MUTED,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 6,
  },
});

/** Column widths per table, so numbers line up instead of drifting. */
function columnWidths(table: ReportTable): string[] {
  const count = table.columns.length;
  if (count === 7) return ["19%", "31%", "8%", "10%", "10%", "11%", "11%"];
  if (count === 6) return ["18%", "22%", "15%", "15%", "15%", "15%"];
  if (count === 3) return ["62%", "14%", "24%"];
  if (count === 2) return ["55%", "45%"];
  return Array.from({ length: count }, () => `${100 / count}%`);
}

function Fields({ items }: { items: ReportField[] }) {
  return (
    <View style={styles.fieldGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.field}>
          <Text style={styles.fieldLabel}>{item.label}</Text>
          <Text style={styles.fieldValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Table({ table }: { table: ReportTable }) {
  const widths = columnWidths(table);

  return (
    <View>
      <Text style={styles.sectionTitle}>{table.title}</Text>

      {table.emptyNote ? (
        <Text style={styles.note}>{table.emptyNote}</Text>
      ) : (
        <View>
          {/* `fixed` repeats the header on every page the table spills onto. */}
          <View style={styles.tableHeader} fixed>
            {table.columns.map((column, index) => (
              <Text
                key={column}
                style={[
                  styles.cell,
                  styles.cellHead,
                  {
                    width: widths[index],
                    textAlign: table.numeric[index] ? "right" : "left",
                  },
                ]}
              >
                {column}
              </Text>
            ))}
          </View>

          {table.rows.map((row, rowIndex) => (
            <View
              key={`${table.title}-${rowIndex}`}
              style={[
                styles.tableRow,
                ...(rowIndex % 2 === 1 ? [styles.tableRowAlt] : []),
              ]}
              wrap={false}
            >
              {row.map((value, index) => (
                <Text
                  key={index}
                  style={[
                    styles.cell,
                    {
                      width: widths[index],
                      textAlign: table.numeric[index] ? "right" : "left",
                    },
                  ]}
                >
                  {value}
                </Text>
              ))}
            </View>
          ))}

          {table.truncatedNote ? (
            <Text style={styles.note}>{table.truncatedNote}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

/**
 * Builds the report document.
 *
 * A plain function rather than a React component on purpose: `renderToBuffer`
 * is typed to take a `<Document>` element specifically, and a component
 * wrapper -- even one that returns exactly that -- widens the type into a
 * generic element the renderer's signature rejects.
 */
/**
 * "Mess" in the pear's iridescent shell, letter by letter.
 *
 * The report used to print it in flat teal while every screen in the app
 * shimmered -- the one place the brand mark didn't match itself.
 * `@react-pdf/renderer` has no gradient text (only a solid `color` per
 * `<Text>`), so the gradient is sampled once per letter; the light stops are
 * used because this lands on white paper.
 */
const MESS_LETTERS = ["M", "e", "s", "s"];
const MESS_COLORS = wordmarkLetterColors(MESS_LETTERS.length, "light");

function WordmarkAccent() {
  return (
    <>
      {MESS_LETTERS.map((letter, index) => (
        <Text key={`${letter}-${index}`} style={{ color: MESS_COLORS[index] }}>
          {letter}
        </Text>
      ))}
    </>
  );
}

export function buildReportDocument(model: ReportModel) {
  return (
    <Document
      title="FitMess — Moji podaci"
      author="FitMess"
      language="sr-Latn-RS"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.wordmark}>
            Fit
            <WordmarkAccent />
          </Text>
          <Text style={styles.headerRight}>
            Izveštaj napravljen{"\n"}
            {model.generatedAt}
          </Text>
        </View>

        <Text style={styles.title}>Moji podaci</Text>
        <Text style={styles.intro}>
          Ovo je pregled svega što FitMess čuva o tebi. Slike obroka nisu deo
          izveštaja jer se automatski brišu otprilike dan po unosu — kalorije i
          makroi tog obroka ostaju u tabeli unosa. Ako ti treba mašinski čitljiv
          oblik (za drugu aplikaciju), u Podešavanjima postoji i .json izvoz.
        </Text>

        {model.missingNote ? (
          <Text style={styles.warning}>{model.missingNote}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>Nalog</Text>
        <Fields items={model.account} />

        <Text style={styles.sectionTitle}>Profil</Text>
        <Fields items={model.profile} />

        {model.plan.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Trenutni plan</Text>
            <Fields items={model.plan} />
          </View>
        ) : null}

        {model.tables.map((table) => (
          <Table key={table.title} table={table} />
        ))}

        <View style={styles.footer} fixed>
          <Text>FitMess · fitmess.app</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Strana ${pageNumber} od ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
