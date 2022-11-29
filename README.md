# axios-circuit-breaker
Axios interceptor that implements [Circuit Breaker](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker) pattern.

## How to use?

### Applying Circuit Breaker

For each target server that you want to control independently you need to create separate axios instance,
and apply `axiosCircuitBreaker` interceptor to it.

For example, you want to have two circuit breakers, one for requests to test.com another for test2.com

```javascript
    const axios = require('axios');
    const { axiosCircuitBreaker, CircuitBreakerOpenError } = require('./index');

    const instanceTest1 =  axios.create({
        url: 'http://test1.com'
    });

    axiosCircuitBreaker(instanceTest1);

    const instanceTest2 =  axios.create({
        url: 'http://test2.com'
    });
    
    axiosCircuitBreaker(instanceTest2);
```

### Configuring Circuit Breaker

In the example below, you can see that our function accepts second parameter with options; In the
code snipped you can see default values for it, all of them are optional when you pass them;

```javascript
    axiosCircuitBreaker(axios, {
        // By default, each Circuit Breaker will have auto-generated numeric id
        // though most of the time it is more convenient to have more meaningful id like "UserService", etc.
        // This ID is used in the logs that CircuitBreaker producing.
        id: "UserService",
        // Defines number of requests that need to fail before
        // Circuit Breaker will open;
        threshold: 50,
        // Defines period of time during which the threshold should be reached
        // to switch Circuit Breaker to OPEN state; 
        thresholdPeriodMs: 5000,
        // Defines number of requests that successfully completed in HALF_OPEN state
        // to switch Circuit Breaker to CLOSED state;
        numRequestsToCloseCircuit: 20,
        // Defines time required to switch Circuit Breaker from OPEN to HALF_OPEN;
        resetPeriodMs: 10000,
        // Defines a strategy that tells whether a request response should be counted
        // as fault; By default counts every request that has status code >= 500 as fault;
        isFault: (error) => error.response?.status >= 500,
        // Defines a logger that enables logging of internal state changes inside Circuit Breaker
        // By default, logger is disabled.
        logger: (message) => console.log(message)
    });
```

### Behavior

Circuit Breaker starts in `CLOSED` state, that means any request can get to the server.

Circuit Breaker will count failed requests using `isFault` strategy defined in configuration to determine whether a request is failed.

When number of requests failed during `thresholdPeriodMs` crosses number defined in `threshold` option, it will enter `OPEN` state. 

In `OPEN` state Circuit Breaker will prevent any request from happening and will throw `CircuitBreakerOpenError`.

After `resetPeriodMs` Circuit Breaker will enter `HALF_OPEN` state and will allow `numRequestsToCloseCircuit` number of requests
to reach out to the server. Other requests will be cancelled with `CicuitBreakerHalfOpenError`. If at least one of requests fail, it will reset back to `OPEN` state.

When all requests in `HALF_OPEN` state succeed, it will go back to `CLOSED` state. 