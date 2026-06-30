export interface PresetField {
  key: string;
  label: string;
  question: string;
  fieldType: string; // string | number | date
  required: boolean;
  sortOrder: number;
}

export interface Preset {
  slug: string;
  name: string;
  description: string;
  extractionMethod: string; // queries | expense
  fields: PresetField[];
}

/**
 * Shared document-type presets (organizationId = null → available to every org).
 * Add more here to enter new sectors (logistics, legal, manufacturing, ...).
 */
export const DOCUMENT_PRESETS: Preset[] = [
  {
    slug: "aerospace-part-certificate",
    name: "Aerospace Part Certificate",
    description:
      "Certificates of conformance / material certs — part number, supplier, machining date, heat/lot, material.",
    extractionMethod: "queries",
    fields: [
      { key: "part_number", label: "Part number", question: "What is the part number?", fieldType: "string", required: true, sortOrder: 0 },
      { key: "supplier", label: "Supplier / manufacturer", question: "Who is the supplier or manufacturer?", fieldType: "string", required: true, sortOrder: 1 },
      { key: "machining_date", label: "Machining / manufacture date", question: "What is the date of machining or manufacture?", fieldType: "date", required: false, sortOrder: 2 },
      { key: "heat_lot", label: "Heat / lot number", question: "What is the heat number or lot number?", fieldType: "string", required: false, sortOrder: 3 },
      { key: "material", label: "Material specification", question: "What is the material specification?", fieldType: "string", required: false, sortOrder: 4 },
      { key: "quantity", label: "Quantity", question: "What is the quantity?", fieldType: "number", required: false, sortOrder: 5 },
      { key: "work_order", label: "Work order number", question: "What is the work order number?", fieldType: "string", required: false, sortOrder: 6 },
    ],
  },
];
