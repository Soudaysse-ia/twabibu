import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import { ApiException } from '../common/api-exception.js';
import { SESSION_COOKIE, readCookie } from '../common/cookies.js';
import { AuthService } from './auth.service.js';
import type { AuthedRequest, SessionUser } from './auth.types.js';

/** Reads the session from the `tw_session` cookie (web) or `Authorization: Bearer` (mobile apps). */
export async function sessionFromRequest(auth: AuthService, req: AuthedRequest): Promise<SessionUser | null> {
  if (req.user) return req.user;
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  const token = bearer ?? readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const user = await auth.resolveSession(token);
  if (user) req.user = user;
  return user;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!(await sessionFromRequest(this.auth, req))) throw new ApiException('UNAUTHENTICATED', 'Sign in required');
    return true;
  }
}

/** Requires a signed-in patient (a user with a patient profile). */
@Injectable()
export class PatientGuard extends AuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user?.patientProfileId) throw new ApiException('FORBIDDEN', 'Patient account required');
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): SessionUser => {
  return context.switchToHttp().getRequest<AuthedRequest>().user!;
});
