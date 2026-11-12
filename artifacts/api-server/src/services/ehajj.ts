import { z } from "zod";
import { decryptSetting } from "./registration/config";

export const ehajjPermissions = [
  "pilgrims",
  "operations",
  "finance",
  "documents",
] as const;
export type EhajjPermission = (typeof ehajjPermissions)[number];
export const ehajjId = z
  .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
  .pipe(z.number().int().positive().max(2147483647));
export const ehajjDetail = z.enum([
  "profile",
  "payments",
  "travel",
  "accommodation",
  "services",
  "group",
  "documents",
]);
type Detail = z.infer<typeof ehajjDetail>;
export const ehajjDetailPermission: Record<Detail, EhajjPermission> = {
  profile: "pilgrims",
  payments: "finance",
  travel: "operations",
  accommodation: "operations",
  services: "operations",
  group: "operations",
  documents: "documents",
};
const detailEndpoints: Record<Detail, string> = {
  profile: "getPelerinDetails",
  payments: "getPelerinVersement",
  travel: "getVoyagePelerin",
  accommodation: "getHebergementPelerin",
  services: "getPelerinServiceAdd",
  group: "getPelerinGroupe",
  documents: "getDocumentsPelerin",
};
export const agencyKeyField = "ehajj:agencyKey";
export const jwtField = "ehajj:jwt";

export class EhajjError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function ehajjBaseUrl() {
  const value = process.env.EHAJJ_API_BASE_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.hostname.includes(".") &&
      !url.hostname.endsWith(".local")
    ) {
      return url.href.replace(/\/+$/, "");
    }
  } catch {
    // A malformed deployment URL leaves the integration unavailable.
  }
  return null;
}

type Connection = {
  baseUrl: string;
  enabled: boolean;
  agencyKey: string | null;
  jwt: string | null;
};
const record = z.record(z.unknown());
const envelope = z.object({
  code: z.number().int(),
  message: z.string().optional(),
  data: z.unknown(),
});
const productRows = z.array(
  z.object({
    id_produit: ehajjId,
    libelle_produit: z.string(),
    description_produit: z.string().nullish(),
    activite_produit: z.string(),
    edition: z.union([z.string(), z.number()]).nullish(),
  }),
);
const pilgrimRows = z.array(record.and(z.object({ id_pelerin: ehajjId })));

async function readResponse(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing response body");
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4 * 1024 * 1024)
        throw new Error("Response exceeded size limit");
      body += decoder.decode(value, { stream: true });
    }
    return envelope.parse(JSON.parse(body + decoder.decode()));
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

type SourceRecord = Record<string, unknown>;
type Fields = Record<string, string>;
type Section = { title: string; fields: Fields };

function fields(source: SourceRecord, labels: Record<string, string>): Fields {
  const result: Fields = {};
  for (const [key, label] of Object.entries(labels)) {
    const value = source[key];
    if (typeof value === "string" && value.trim())
      result[label] = value.slice(0, 2000);
    if (typeof value === "number" && Number.isFinite(value))
      result[label] = String(value);
  }
  return result;
}

function objectOrEmpty(value: unknown) {
  return record.nullish().parse(value) ?? {};
}

function maskIdentifier(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.length > 4 ? "••••" + value.slice(-4) : "••••";
}

function projectDetail(
  kind: Detail,
  data: unknown,
  permissions: Set<EhajjPermission>,
): Section[] {
  const section = (
    title: string,
    source: SourceRecord,
    labels: Record<string, string>,
  ) => ({
    title,
    fields: fields(source, labels),
  });
  if (kind === "documents") {
    return z
      .array(record)
      .parse(data)
      .map((item, index) =>
        section(
          "Document " + (index + 1),
          {
            ...item,
            attachment:
              typeof item.piece_jointe === "string" && item.piece_jointe.trim()
                ? "Reported by EHajj"
                : "Unavailable",
          },
          {
            id_document: "Reference",
            description: "Description",
            attachment: "Attachment",
          },
        ),
      );
  }
  if (kind === "services") {
    if (typeof data === "string" && /^aucun service additionnel/i.test(data))
      return [];
    return z
      .array(record)
      .parse(data)
      .map((item, index) =>
        section("Service " + (index + 1), item, {
          description: "Description",
          ...(permissions.has("finance")
            ? {
                total_a_payer: "Amount due",
                total_verse: "Amount paid",
                reste: "Balance",
                etat: "Payment status",
              }
            : {}),
        }),
      );
  }
  const source = record.parse(data);
  if (kind === "profile") {
    const result = [
      section("Identity", objectOrEmpty(source.civilite_pelerin), {
        numero_pelerin: "Pilgrim number",
        nom: "Last name",
        prenom: "First name",
        sexe: "Sex",
        date_naissance: "Birth date",
        nationalite: "Nationality",
      }),
      section("Package", objectOrEmpty(source.package), {
        designation: "Package",
        categorie: "Category",
        ...(permissions.has("finance")
          ? { tarif: "Tariff", type_tarif: "Tariff type" }
          : {}),
      }),
    ];
    if (permissions.has("documents")) {
      const passport = objectOrEmpty(source.passeport);
      result.push(
        section(
          "Passport",
          { ...passport, numero: maskIdentifier(passport.numero) },
          {
            numero: "Passport number",
            date_delivrance: "Issued",
            date_expiration: "Expires",
          },
        ),
      );
    }
    return result;
  }
  if (kind === "payments") {
    return [
      section("External balance", source, {
        total_a_payer: "Amount due",
        total_verse: "Amount paid",
        reste_a_payer: "Balance",
      }),
      ...z
        .array(record)
        .parse(source.versements)
        .map((item, index) =>
          section("Payment entry " + (index + 1), item, {
            code_versement: "Code",
            montant: "Amount",
            reference: "Reference",
            date_versement: "Date",
            moyen_paiement: "Method",
            type_versement: "Type",
            etat: "Status",
          }),
        ),
    ];
  }
  if (kind === "travel") {
    return [
      section("Outbound", source, {
        type_vol: "Trip type",
        date_depart_aller: "Departure",
        date_arrivee_aller: "Arrival",
        lieu_depart_aller: "From",
        lieu_arrivee_aller: "To",
        airline_aller: "Airline",
      }),
      section("Return", source, {
        date_depart_retour: "Departure",
        date_arrivee_retour: "Arrival",
        lieu_depart_retour: "From",
        lieu_arrivee_retour: "To",
        airline_retour: "Airline",
      }),
    ];
  }
  if (kind === "group") {
    if (
      typeof source.groupe === "string" &&
      /^ce p[eé]lerin ne dispose pas de groupe/i.test(source.groupe)
    )
      return [];
    return [
      section("Assigned group", record.parse(source.groupe), {
        id_groupe: "Group reference",
        nom_groupe: "Name",
        activite: "Activity",
      }),
    ];
  }
  return (["hebergement_makkah", "hebergement_medine"] as const).map(
    (key, index) => {
      const title = index === 0 ? "Makkah" : "Madinah";
      const value = source[key];
      if (
        typeof value === "string" &&
        /^non attribu[eé]$/i.test(value.trim())
      ) {
        return { title, fields: { Assignment: "Unassigned" } };
      }
      return section(title, record.parse(value), {
        batiment: "Building",
        numero_etage: "Floor",
        numero_chambre: "Room",
        date_entree: "Check-in",
        date_sortie: "Check-out",
        restauration: "Meals",
      });
    },
  );
}

function parse<T>(project: () => T): T {
  try {
    return project();
  } catch {
    throw new EhajjError(502, "EHajj returned an unexpected response.");
  }
}

export function ehajjClient(connection: Connection) {
  if (
    !connection.enabled ||
    !connection.agencyKey ||
    connection.baseUrl !== ehajjBaseUrl()
  ) {
    throw new EhajjError(
      503,
      "EHajj needs an active connection. Contact your Super Admin.",
    );
  }
  async function read(
    path: string,
    requiresJwt = false,
    roster = false,
    body?: FormData,
  ) {
    if (requiresJwt && !connection.jwt) {
      throw new EhajjError(
        503,
        "This view requires an EHajj JWT. Contact your Super Admin.",
      );
    }
    const headers: Record<string, string> = { Accept: "application/json" };
    try {
      headers.AuthorizationAgenceKey = decryptSetting(
        connection.agencyKey!,
        agencyKeyField,
      );
      if (requiresJwt)
        headers.Authorization =
          "Bearer " + decryptSetting(connection.jwt!, jwtField);
    } catch {
      throw new EhajjError(
        503,
        "EHajj credentials could not be opened. Contact your Super Admin.",
      );
    }
    let response: Response;
    let payload: z.infer<typeof envelope>;
    try {
      response = await fetch(connection.baseUrl + "/api/" + path, {
        method: body ? "POST" : "GET",
        headers,
        signal: AbortSignal.timeout(body ? 60_000 : 12_000),
        redirect: "error",
        cache: "no-store",
        ...(body ? { body } : {}),
      });
      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel();
        throw new EhajjError(502, "EHajj rejected the saved credentials.");
      }
      payload = await readResponse(response);
    } catch (error) {
      if (error instanceof EhajjError) throw error;
      throw new EhajjError(
        502,
        "EHajj could not be reached or returned an unreadable response.",
      );
    }
    if (payload.code === 401 || payload.code === 403) {
      throw new EhajjError(502, "EHajj rejected the saved credentials.");
    }
    if (
      roster &&
      (response.status === 404 || (response.ok && payload.code === 404)) &&
      /^aucun p[eé]lerin trouv[eé] pour ce produit\.?$/i.test(
        payload.message?.trim() ?? "",
      )
    )
      return [];
    if (response.status === 404 || (response.ok && payload.code === 404)) {
      throw new EhajjError(404, "This record is unavailable in EHajj.");
    }
    if (!response.ok || payload.code !== 200) {
      throw new EhajjError(502, "EHajj could not complete this request.");
    }
    return payload.data;
  }
  return {
    async banks() {
      const data = await read("getAllBanquesAgence");
      return parse(() =>
        z
          .array(
            z.object({
              id_banque: ehajjId,
              nom_banque: z.string(),
            }),
          )
          .parse(data)
          .map((bank) => ({ id: bank.id_banque, name: bank.nom_banque })),
      );
    },
    async bankAccounts() {
      const data = await read("getAllComptesBancairesAgence");
      return parse(() =>
        z
          .array(
            z.object({
              id_compte_bancaire: ehajjId,
              libelle_compte_bancaire: z.string(),
              numero_compte_bancaire: z.string(),
              nom_banque: z.string(),
            }),
          )
          .parse(data)
          .map((account) => ({
            id: account.id_compte_bancaire,
            name: account.libelle_compte_bancaire,
            number: account.numero_compte_bancaire,
            bankName: account.nom_banque,
          })),
      );
    },
    async registerPilgrim(input: Record<string, string>) {
      const form = new FormData();
      for (const [key, value] of Object.entries(input)) form.set(key, value);
      const data = await read("addPelerin", false, false, form);
      return parse(() =>
        z
          .object({
            id_pelerin: ehajjId,
            numero_pelerin: ehajjId,
            pelerin_uuid: z.string().min(1).max(128),
            id_versement_pelerin: ehajjId,
            code_versement_pelerin: ehajjId,
            reste_a_verse: z
              .union([z.string(), z.number()])
              .refine(
                (v) =>
                  /^\d+(?:\.\d+)?$/.test(String(v)) &&
                  Number.isFinite(Number(v)),
              ),
          })
          .parse(data),
      );
    },
    async products() {
      const data = await read("getAllProduitsAgence");
      return parse(() =>
        productRows.parse(data).map((product) => ({
          id: product.id_produit,
          name: product.libelle_produit,
          description: product.description_produit ?? "",
          activity: product.activite_produit,
          edition: product.edition == null ? "" : String(product.edition),
        })),
      );
    },
    async pilgrims(productId: number, finance: boolean) {
      const data = await read("getPelerinsByProduit/" + productId, false, true);
      return parse(() =>
        pilgrimRows.parse(data).map((pilgrim) => ({
          id: pilgrim.id_pelerin,
          fields: fields(pilgrim, {
            numero_pelerin: "Pilgrim number",
            nom_pelerin: "Last name",
            prenom_pelerin: "First name",
            nom_package: "Package",
            statut: "Status",
            ...(finance
              ? {
                  tarif_fixe: "Tariff",
                  amount_paid: "Amount paid",
                  rest: "Balance",
                }
              : {}),
          }),
        })),
      );
    },
    async detail(
      kind: Detail,
      pilgrimId: number,
      permissions: Set<EhajjPermission>,
    ) {
      const data = await read(detailEndpoints[kind] + "/" + pilgrimId, true);
      return parse(() =>
        projectDetail(kind, data, permissions).filter(
          (item) => Object.keys(item.fields).length,
        ),
      );
    },
  };
}
