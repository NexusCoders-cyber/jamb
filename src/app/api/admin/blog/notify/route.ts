import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { notifyEveryone, sendPush } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/**
 * POST { postId, force? } — tell students about a published article: an in-app notification for everyone and a
 * phone notification for everyone who switched "New articles" on. A post is announced once; `force` announces again.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;
  const b = (await request.json().catch(() => null)) as { postId?: unknown; force?: unknown } | null;
  if (typeof b?.postId !== "string") return NextResponse.json({ error: "postId is required" }, { status: 400 });

  const { data: post, error } = await ctx.admin.from("blog_posts").select("id, slug, title, excerpt, is_published, notified_at").eq("id", b.postId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (!post.is_published) return NextResponse.json({ error: "Publish the post first." }, { status: 409 });
  if (post.notified_at && b.force !== true) {
    return NextResponse.json({ error: "Students were already told about this post.", alreadyNotified: true }, { status: 409 });
  }

  // Claim it first so two quick clicks don't notify twice
  const claim = await ctx.admin.from("blog_posts").update({ notified_at: new Date().toISOString() }).eq("id", post.id);
  if (claim.error) return NextResponse.json({ error: claim.error.message }, { status: 500 });

  const url = `/news/${post.slug}`;
  const title = `New article: ${post.title}`;
  const body = post.excerpt || "Tap to read it.";
  const [inApp, push] = await Promise.all([
    notifyEveryone(ctx.admin, { title, body, url }),
    sendPush(ctx.admin, "blog", { title: post.title, body, url, tag: `blog-${post.slug}` }),
  ]);
  return NextResponse.json({ ok: true, inApp, push });
}
