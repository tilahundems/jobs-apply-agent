import { SINGLE_TENANT_ID } from "@et/db"
import { Injectable, type MessageEvent } from "@nestjs/common"
import { Observable } from "rxjs"

@Injectable()
export class NotificationStreamService {
  private readonly listeners = new Map<
    string,
    Set<(event: MessageEvent) => void>
  >()

  private key(userId: string, organizationId: string) {
    return `${organizationId}:${userId}`
  }

  stream(userId: string, organizationId = SINGLE_TENANT_ID) {
    return new Observable<MessageEvent>((subscriber) => {
      const listener = (event: MessageEvent) => subscriber.next(event)
      const key = this.key(userId, organizationId)
      const listeners = this.listeners.get(key) ?? new Set()
      listeners.add(listener)
      this.listeners.set(key, listeners)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) this.listeners.delete(key)
      }
    })
  }

  publish(
    userId: string,
    type: string,
    data: object,
    organizationId = SINGLE_TENANT_ID
  ) {
    for (const listener of this.listeners.get(
      this.key(userId, organizationId)
    ) ?? []) {
      listener({ type, data })
    }
  }
}
