import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule, SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AuthController } from './auth.controller';
import { RestaurantController } from './restaurant.controller';
import { config } from './config';
@Controller('health')
class HealthController {
  constructor(private db: PrismaService) {}
  @Get() @SkipThrottle()
  async health() { await this.db.$queryRaw`SELECT 1`; return { status: 'ok' }; }
}
@Module({
  imports: [JwtModule.registerAsync({ useFactory: () => ({ secret: config().secret, signOptions: { expiresIn: config().accessSeconds, issuer: 'tavixo', audience: 'tavixo-web', algorithm: 'HS256' }, verifyOptions: { issuer: 'tavixo', audience: 'tavixo-web', algorithms: ['HS256'] } }) }), ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
  controllers: [AuthController, RestaurantController, HealthController],
  providers: [PrismaService, AuthService, AuthGuard, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
