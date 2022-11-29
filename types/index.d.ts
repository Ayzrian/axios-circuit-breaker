import {Axios, AxiosError} from 'axios';

export interface IsFaultStrategy {
    (error: AxiosError | Error): boolean;
}

export interface Logger {
    (message: string): void;
}

export interface CircuitBreakerOptions {
    // By default, each Circuit Breaker will have auto-generated numeric id
    // though most of the time it is more convenient to have more meaningful id like "UserService", etc.
    id?: string;
    // Defines humber of requests that need to fail before
    // Circuit Breaker will open;
    threshold: number;
    // Defines period of time during which the threshold should be reached
    // to switch Circuit Breaker to OPEN state;
    thresholdPeriodMs: number;
    // Defines number of requests that successfully completed in HALF_OPEN state
    // to switch Circuit Breaker to CLOSED state;
    numRequestsToCloseCircuit: number;
    // Defines time required to switch Circuit Breaker from OPEN to HALF_OPEN;
    resetPeriodMs: number;
    // Defines a strategy that tells whether a request response should be counted
    // as fault; By default counts every request that has status code >= 500 as fault;
    isFault: IsFaultStrategy;
    // Defines a logger, that will log internal state of Circuit Breaker as well as
    // changed happening in it;
    logger: Logger;
}

export function axiosCircuitBreaker(axios: Axios, options: CircuitBreakerOptions): void;