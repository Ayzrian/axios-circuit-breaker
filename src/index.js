const { AxiosError } = require('axios');

class CircuitBreakerOpenError extends AxiosError {
}

class CircuitBreakerHalfOpenError extends AxiosError {
}

class CircuitBreaker {
    static idCounter = 0;
    static NOT_STARTED = -1;
    static OPEN = 'OPEN';
    static CLOSED = 'CLOSED';
    static HALF_OPEN = 'HALF_OPEN';


    constructor(settings) {
        this.id = settings.id ? settings.id : String(CircuitBreaker.idCounter++);
        this.state = CircuitBreaker.CLOSED;
        this.faultCount = 0;
        this.successCount = 0;
        this.inFlightOpenRequests = 0;
        this.numRequestsToCloseCircuit = settings.numRequestsToCloseCircuit;
        this.threshold = settings.threshold;
        this.thresholdPeriodMs = settings.thresholdPeriodMs;
        this.faultCountStartedMs = CircuitBreaker.NOT_STARTED;
        this.resetPeriodMs = settings.resetPeriodMs;
        this.openModeStartMs = CircuitBreaker.NOT_STARTED;
        this.logger = settings.logger
    }

    call(config) {
        this._log(`Call to third-party. state=${this.state}.`);
        switch (this.state) {
            case CircuitBreaker.CLOSED:
                break;
            case CircuitBreaker.OPEN:
                if (Date.now() >= this.openModeStartMs + this.resetPeriodMs) {
                    this._log(`Switching to HALF_OPEN state.`)
                    this.faultCount = 0;
                    this.state = CircuitBreaker.HALF_OPEN;

                    if (this._canTry()) {
                        this._log(`Allow request in.`)
                        this._increaseInFlightCounter();
                    } else {
                        this._log(`Do not allow request in. Max cap of requests reached for ${CircuitBreaker.HALF_OPEN}.`)
                        throw new CircuitBreakerHalfOpenError(`Request was cancelled by Circuit Breaker. State=${CircuitBreaker.HALF_OPEN}.`, '425', config);
                    }
                } else {
                    this._log(`Reject request due to ${CircuitBreaker.OPEN} state.`)
                    throw new CircuitBreakerOpenError(`Request was cancelled by Circuit Breaker. State=${CircuitBreaker.OPEN}`, '425', config);
                }
                break;
            case CircuitBreaker.HALF_OPEN:
                if (this._canTry()) {
                    this._log(`Allow request in.`)
                    this._increaseInFlightCounter();
                } else {
                    this._log(`Do not allow request in. Max cap of requests reached reached for ${CircuitBreaker.HALF_OPEN}.`)
                    throw new CircuitBreakerHalfOpenError(`Request was cancelled by Circuit Breaker. State=${CircuitBreaker.HALF_OPEN}`, '425', config);
                }
                break;
        }
    }

    processFault() {
        this._log(`Processing fault. state=${this.state}`)
        switch (this.state) {
            case CircuitBreaker.CLOSED:
                if (this.faultCountStartedMs === CircuitBreaker.NOT_STARTED) {
                    this.faultCountStartedMs = Date.now()
                } else if (Date.now() > this.faultCountStartedMs + this.thresholdPeriodMs) {
                    this._log('Threshold period passed. Reset the fault count to 0.')
                    this.faultCount = 0;
                    this.faultCountStartedMs = Date.now();
                }

                // Count faults until threshold is met.
                this.faultCount++
                if (this.faultCount >= this.threshold) {
                    this._log(`Crossed the threshold of faults. Switching to ${CircuitBreaker.OPEN} state.`)
                    this._switchToOpenState();
                }
                break;
            case CircuitBreaker.HALF_OPEN:
                this._log(`Encountered a fault during ${CircuitBreaker.HALF_OPEN} state. Switching to ${CircuitBreaker.OPEN} state.`)
                this._switchToOpenState()
                break;
        }
    }

    processSuccess() {
        this._log(`Processing success. state=${this.state}`)
        if (this.state === CircuitBreaker.HALF_OPEN) {
            this._log(`Increase success counter.`)
            this.successCount++;

            if (this.successCount >= this.numRequestsToCloseCircuit) {
                this._log(`Handled ${this.successCount} requests during ${CircuitBreaker.HALF_OPEN} state. Switching to ${CircuitBreaker.CLOSED} state.`)
                this._switchToClosedState();
            }
        }
    }

    _switchToOpenState() {
        // Reset to zero if at least one failed during HALF_OPEN
        this.successCount = 0;
        this.inFlightOpenRequests = 0;
        this.state = CircuitBreaker.OPEN;
        this.openModeStartMs = Date.now();
    }

    _switchToClosedState() {
        this.state = CircuitBreaker.CLOSED;
        this.successCount = 0;
        this.inFlightOpenRequests = 0;
    }

    _increaseInFlightCounter() {
        this.inFlightOpenRequests++;
    }

    _canTry() {
        return this.inFlightOpenRequests < this.numRequestsToCloseCircuit;
    }

    _log(message) {
        this.logger(`CircuitBreaker[id=${this.id}]: ${message}`)
    }
}

const defaultOptions = {
    threshold: 50,
    numRequestsToCloseCircuit: 20,
    thresholdPeriodMs: 5000,
    resetPeriodMs: 10000,
    // TODO: Need to count Timeouts as well.
    isFault: (error) => error.response?.status >= 500,
    // By default, we are not logging a thing
    logger: (_message) => null,
}

function axiosCircuitBreaker(axios, userOptions) {
    const options = Object.assign(defaultOptions, userOptions);
    let instance = new CircuitBreaker(options)

    axios.interceptors.request.use(async (config) => {
        instance.call(config);
        return config;
    }, async (e) => {
        throw e;
    }, {
        synchronous: false
    });


    axios.interceptors.response.use(
        async (response) => {
            instance.processSuccess()

            return response;
        },
        async (error) => {
            if (options.isFault(error)) {
                instance.processFault()
            }

            return Promise.reject(error)
        },
        {
            synchronous: false,
        }
    );
}

module.exports = {
    axiosCircuitBreaker,
    CircuitBreakerOpenError,
    CircuitBreakerHalfOpenError
}
