import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
  type: 'access' | 'refresh';
}

export interface RequestUser {
  userId: string;
  tenantId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: Buffer.from(process.env['JWT_PUBLIC_KEY'] ?? '', 'base64').toString(),
      algorithms: ['RS256'],
    });
  }

  validate(payload: JwtPayload): RequestUser {
    if (payload.type !== 'access') throw new UnauthorizedException();
    return { userId: payload.sub, tenantId: payload.tenant_id, role: payload.role };
  }
}
