const { CircuitBreaker } = require('./circuit-breaker');
const { CircuitBreakerOpenError } = require('./circuit-breaker-open.error');
const { CircuitBreakerHalfOpenError } = require('./circuit-breaker-half-open.error');

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
    let instance = new CircuitBreaker(options);

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
            instance.processSuccess();

            return response;
        },
        async (error) => {
            if (options.isFault(error)) {
                instance.processFault();
            }

            return Promise.reject(error);
        },
        {
            synchronous: false,
        }
    );
}

module.exports = {
    axiosCircuitBreaker,
    CircuitBreakerOpenError,
    CircuitBreakerHalfOpenError,
}
