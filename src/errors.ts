/**
 * IronWeft SDK error hierarchy.
 */

export class IronWeftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IronWeftError";
    // Maintain proper prototype chain in transpiled JS
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthorizationDenied extends IronWeftError {
  readonly action: string;
  readonly agentId: string;
  readonly reason: string;
  readonly auditEventId: string;

  constructor(params: {
    action: string;
    agentId: string;
    reason?: string;
    auditEventId?: string;
  }) {
    const { action, agentId, reason = "", auditEventId = "" } = params;
    super(`Action '${action}' denied for agent ${agentId}: ${reason}`);
    this.name = "AuthorizationDenied";
    this.action = action;
    this.agentId = agentId;
    this.reason = reason;
    this.auditEventId = auditEventId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AgentSuspended extends AuthorizationDenied {
  constructor(params: {
    action: string;
    agentId: string;
    reason?: string;
    auditEventId?: string;
  }) {
    super(params);
    this.name = "AgentSuspended";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AgentRetired extends IronWeftError {
  readonly agentId: string;

  constructor(agentId: string) {
    super(`Agent ${agentId} is hard-locked and cannot act`);
    this.name = "AgentRetired";
    this.agentId = agentId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
