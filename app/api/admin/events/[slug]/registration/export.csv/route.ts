import { handleRegistrationsExport } from '@/lib/admin-export';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: { slug: string } }) {
  return handleRegistrationsExport(req, ctx.params.slug);
}
