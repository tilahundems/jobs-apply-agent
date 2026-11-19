import { type DynamicModule, Module } from "@nestjs/common"
import { AuthzService } from "./authz.service.js"
import { AccessGuard } from "./decorators.js"
import { AUTHZ_OPTIONS, type AuthzOptions } from "./types.js"

@Module({})
export class AuthzModule {
  static forRoot(options: AuthzOptions): DynamicModule {
    return {
      module: AuthzModule,
      global: true,
      providers: [
        { provide: AUTHZ_OPTIONS, useValue: options },
        AuthzService,
        AccessGuard,
      ],
      exports: [AuthzService, AccessGuard],
    }
  }
}
