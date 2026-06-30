import {
  AnalyzeDocumentCommand,
  type TextractClient,
} from "@aws-sdk/client-textract";
import { getTextractClient } from "./aws";

export interface DocFieldDef {
  key: string;
  label: string;
  method: string; // query | form | table | regex
  question?: string | null;
  sortOrder?: number;
}

export interface ExtractedDocValue {
  fieldKey: string;
  label: string;
  value: string | null;
  confidence: number | null;
  page: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  sortOrder: number;
}

export interface ExtractedDocument {
  pageCount: number;
  confidence: number;
  values: ExtractedDocValue[];
  raw: unknown;
}

interface Block {
  Id?: string;
  BlockType?: string;
  Text?: string;
  Confidence?: number;
  Page?: number;
  Query?: { Text?: string; Alias?: string };
  Geometry?: { BoundingBox?: { Left: number; Top: number; Width: number; Height: number } };
  Relationships?: { Type?: string; Ids?: string[] }[];
}

/**
 * Run AWS Textract AnalyzeDocument with the Queries feature against a document,
 * answering each field's natural-language question. Returns one value per field
 * (with bounding-box geometry so the viewer can highlight it).
 */
export async function extractDocumentWithQueries(
  bytes: Uint8Array,
  fields: DocFieldDef[],
  client: TextractClient = getTextractClient()
): Promise<ExtractedDocument> {
  const queryFields = fields.filter(
    (f) => f.method === "query" && f.question
  );

  if (queryFields.length === 0) {
    throw new Error("No query-method fields with questions defined for this document type");
  }

  const command = new AnalyzeDocumentCommand({
    Document: { Bytes: bytes as unknown as Buffer },
    FeatureTypes: ["QUERIES"],
    QueriesConfig: {
      Queries: queryFields.map((f) => ({
        Text: f.question as string,
        Alias: f.key,
      })),
    },
  });

  const res = await client.send(command);
  const blocks: Block[] = (res.Blocks ?? []) as unknown as Block[];
  const pageCount =
    (res.Blocks?.find((b) => b.BlockType === "PAGE")?.Page as number) ?? 1;

  // Index QUERY_RESULT blocks by id so we can resolve each query's answer.
  const resultById = new Map<string, Block>();
  for (const b of blocks) {
    if (b.BlockType === "QUERY_RESULT") resultById.set(b.Id as string, b);
  }

  // Map alias -> result block.
  const answerByAlias = new Map<string, Block>();
  for (const b of blocks) {
    if (b.BlockType !== "QUERY") continue;
    const alias = b.Query?.Alias;
    if (!alias) continue;
    const answerIds =
      b.Relationships?.find((r) => r.Type === "ANSWER")?.Ids ?? [];
    for (const id of answerIds) {
      const r = resultById.get(id);
      if (r) {
        answerByAlias.set(alias, r);
        break;
      }
    }
  }

  const values: ExtractedDocValue[] = fields.map((f, i) => {
    const r = answerByAlias.get(f.key);
    const bb = r?.Geometry?.BoundingBox;
    return {
      fieldKey: f.key,
      label: f.label,
      value: r?.Text ?? null,
      confidence: r?.Confidence != null ? r.Confidence / 100 : null,
      page: r?.Page ?? 1,
      left: bb?.Left,
      top: bb?.Top,
      width: bb?.Width,
      height: bb?.Height,
      sortOrder: f.sortOrder ?? i,
    };
  });

  const confs = values
    .map((v) => v.confidence)
    .filter((c): c is number => c !== null);
  const confidence =
    confs.length > 0 ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;

  return { pageCount, confidence, values, raw: { blocks } };
}
