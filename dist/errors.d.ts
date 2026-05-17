/**
 * IronWeft SDK error hierarchy.
 */
export declare class IronWeftError extends Error {
    constructor(message: string);
}
export declare class AuthorizationDenied extends IronWeftError {
    readonly action: string;
    readonly agentId: string;
    readonly reason: string;
    readonly auditEventId: string;
    constructor(params: {
        action: string;
        agentId: string;
        reason?: string;
        auditEventId?: string;
    });
}
export declare class AgentSuspended extends AuthorizationDenied {
    constructor(params: {
        action: string;
        agentId: string;
        reason?: string;
        auditEventId?: string;
    });
}
export declare class AgentRetired extends IronWeftError {
    readonly agentId: string;
    constructor(agentId: string);
}
//# sourceMappingURL=errors.d.ts.map