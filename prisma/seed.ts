import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DOCUMENT_PRESETS } from "../src/lib/documentTypes";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 12);

  const org = await prisma.organization.upsert({
    where: { id: "demo-org" },
    update: {},
    create: {
      id: "demo-org",
      name: "Acme Inc.",
      plan: "pro",
      monthlyLimit: 500,
    },
  });

  await prisma.user.upsert({
    where: { email: "demo@acme.test" },
    update: {},
    create: {
      email: "demo@acme.test",
      name: "Demo Owner",
      passwordHash,
      role: "owner",
      organizationId: org.id,
    },
  });

  // Shared document-type presets (organizationId = null → available to all orgs).
  for (const preset of DOCUMENT_PRESETS) {
    const existing = await prisma.documentType.findFirst({
      where: { slug: preset.slug, organizationId: null },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.documentType.create({
      data: {
        organizationId: null,
        slug: preset.slug,
        name: preset.name,
        description: preset.description,
        extractionMethod: preset.extractionMethod,
        fields: {
          create: preset.fields.map((f) => ({
            key: f.key,
            label: f.label,
            method: "query",
            question: f.question,
            fieldType: f.fieldType,
            required: f.required,
            sortOrder: f.sortOrder,
          })),
        },
      },
    });
    console.log("  Seeded document type:", preset.name);
  }

  console.log("Seed complete.");
  console.log("  Login:    demo@acme.test");
  console.log("  Password: demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
