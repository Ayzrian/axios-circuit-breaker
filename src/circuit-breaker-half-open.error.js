const { AxiosError } = require('axios');

class CircuitBreakerHalfOpenError extends AxiosError {
}

module.exports = {
    CircuitBreakerHalfOpenError,
}