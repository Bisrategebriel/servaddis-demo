import "server-only";
import { PERSONAS, type PersonaKey } from "@/lib/demo";
import { now } from "../clock";
import { db } from "../db";
import { homePathFor } from "../services/auth";

/** The persona's user, creating Bruk on first use, and where that role lands. */
export async function resolvePersona(key: PersonaKey) {
  const { phone } = PERSONAS.find((p) => p.key === key)!;
  const at = now();
  const user =
    key === "bruk"
      ? await db.user.upsert({
          where: { phone },
          update: { lastLoginAt: at },
          create: {
            phone,
            name: "Bruk Tilahun",
            platformRole: "EMPLOYER",
            locale: "EN",
            createdAt: at,
            lastLoginAt: at,
          },
        })
      : await db.user.update({ where: { phone }, data: { lastLoginAt: at } });
  return { user, redirectTo: await homePathFor(user.id, user.platformRole) };
}
