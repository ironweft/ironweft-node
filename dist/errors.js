/**
 * IronWeft SDK error hierarchy.
 */
export class IronWeftError extends Error {
    constructor(message) {
        super(message);
        this.name = "IronWeftError";
        // Maintain proper prototype chain in transpiled JS
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class AuthorizationDenied extends IronWeftError {
    action;
    agentId;
    reason;
    auditEventId;
    constructor(params) {
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
    constructor(params) {
        super(params);
        this.name = "AgentSuspended";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class AgentRetired extends IronWeftError {
    agentId;
    constructor(agentId) {
        super(`Agent ${agentId} is hard-locked and cannot act`);
        this.name = "AgentRetired";
        this.agentId = agentId;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
//# sourceMappingURL=errors.js.map