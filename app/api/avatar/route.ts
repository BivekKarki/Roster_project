import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The signed-in user's profile photo. The URL carries ?v=<updated time> so it can be cached. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Not signed in", { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatar: true, avatarType: true } });
  if (!user?.avatar) return new Response("No photo", { status: 404 });
  return new Response(new Uint8Array(user.avatar), {
    headers: {
      "Content-Type": user.avatarType ?? "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
