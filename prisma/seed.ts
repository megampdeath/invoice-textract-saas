import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
