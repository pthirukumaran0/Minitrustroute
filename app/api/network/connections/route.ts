import { NextRequest, NextResponse } from 'next/server';
import { getNeo4jSession } from '@/src/lib/neo4j';
import { z } from 'zod';

const UpdateConnectionSchema = z.object({
  source: z.string().min(2),
  target: z.string().min(2),
  isAvailable: z.boolean().optional(),
  prohibited: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    // 1. Authorization Guard
    // As noted in project requirements, production systems require full IAM/Auth0/OAuth SSO.
    // For this prototype, we check the admin authorization key header.
    const adminKey = request.headers.get('x-admin-key');
    const validKey = process.env.ADMIN_INVITE_CODE || 'TRUSTROUTE-ADMIN-2026';

    if (!adminKey || adminKey !== validKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          details: 'Administrative authorization key is required in x-admin-key header.',
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = UpdateConnectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_FAILED',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { source, target, isAvailable, prohibited, status } = parsed.data;

    const session = getNeo4jSession();
    try {
      // Verify relationship exists
      const checkRes = await session.run(
        `
        MATCH (a:PaymentProvider { id: $source })-[r:CONNECTS_TO]->(b:PaymentProvider { id: $target })
        RETURN r
        `,
        { source, target }
      );

      if (checkRes.records.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'RELATIONSHIP_NOT_FOUND',
            details: `No CONNECTS_TO relationship found between '${source}' and '${target}'.`,
          },
          { status: 404 }
        );
      }

      // Safe parameter-controlled update
      await session.run(
        `
        MATCH (a:PaymentProvider { id: $source })-[r:CONNECTS_TO]->(b:PaymentProvider { id: $target })
        SET r.isAvailable = coalesce($isAvailable, r.isAvailable),
            r.prohibited = coalesce($prohibited, r.prohibited),
            r.status = coalesce($status, r.status),
            r.updatedAt = datetime()
        RETURN r
        `,
        {
          source,
          target,
          isAvailable: isAvailable ?? null,
          prohibited: prohibited ?? null,
          status: status ?? null,
        }
      );

      return NextResponse.json({
        success: true,
        message: `Successfully updated connection ${source} -> ${target}`,
        updated: { source, target, isAvailable, prohibited, status },
      });
    } finally {
      await session.close();
    }
  } catch (error: unknown) {
    console.error('Error updating connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal update error',
      },
      { status: 500 }
    );
  }
}

