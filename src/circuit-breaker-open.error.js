const { AxiosError } = require('axios');

class CircuitBreakerOpenError extends AxiosError {
}

module.exports = {
    CircuitBreakerOpenError,
}