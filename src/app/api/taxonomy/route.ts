import { parseRoleTemplateDefaults } from "@/lib/role-template";
import { db } from "@/server/db";
import { apiHandler } from "@/server/http/handler";

// Public reference data (TRD §7): launch cities, sub-cities, role templates and skills.
export const GET = apiHandler(async (req) => {
  // Reading the request keeps this a per-request handler. Without it Next prerenders the GET at
  // build time (it does not see Prisma queries) and serves build-time data from then on.
  void req.headers;
  const [cities, roleTemplates, skills] = await Promise.all([
    db.city.findMany({
      where: { isLaunch: true },
      select: {
        slug: true,
        nameEn: true,
        nameAm: true,
        subCities: {
          select: { slug: true, nameEn: true, nameAm: true },
          orderBy: { nameEn: "asc" },
        },
      },
    }),
    db.roleTemplate.findMany({ orderBy: { sortOrder: "asc" } }),
    db.skill.findMany({
      select: { slug: true, nameEn: true, nameAm: true, group: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);
  return Response.json(
    {
      cities,
      roleTemplates: roleTemplates.map((t) => ({
        slug: t.slug,
        nameEn: t.nameEn,
        nameAm: t.nameAm,
        family: t.family,
        defaults: parseRoleTemplateDefaults(t.defaults),
      })),
      skills,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
});
