const nock = require('nock');
const axios = require('axios');
const { axiosCircuitBreaker, CircuitBreakerOpenError, CircuitBreakerHalfOpenError} = require('./index');
const {AxiosError} = require("axios");

describe('axios-circuit-breaker', () => {
    afterAll( () => {
        nock.restore()
    })

    afterEach(() => {
        nock.cleanAll();
    })

    it('should transit to OPEN state and do not let any requests to get to the server', async () => {
       const instance =  axios.create({
           baseURL: 'http://www.test.com',
       });

       axiosCircuitBreaker(instance, {
           threshold: 3,
           logger: console.log
       });

       // 1 failure
       nock('http://www.test.com')
           .get('/data')
           .reply(502);
       await expect(instance.get(`/data`)).rejects.toBeInstanceOf(axios.AxiosError);

       // 2 failure
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance.get(`/data`)).rejects.toBeInstanceOf(axios.AxiosError);

        // 3 failure
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance.get(`/data`)).rejects.toBeInstanceOf(axios.AxiosError);


        await expect(() => instance.get(`/data`)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
    });

    it('should not transit to OPEN state unless all errors happened during thresholdPeriodMs', async () => {
        const instance =  axios.create();

        axiosCircuitBreaker(instance, {
            threshold: 3,
            thresholdPeriodMs: 200,
            logger: console.log
        });

        Date.now = () => 100;

        // 1 failure
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance.get(`http://www.test.com/data`)).rejects.toBeInstanceOf(axios.AxiosError);

        // 2 failure
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance.get(`http://www.test.com/data`)).rejects.toBeInstanceOf(axios.AxiosError);

        Date.now = () => 400;

        // 1 failure after time was reset
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance.get(`http://www.test.com/data`)).rejects.toBeInstanceOf(axios.AxiosError);


        // 2 failure
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance.get(`http://www.test.com/data`)).rejects.toBeInstanceOf(axios.AxiosError);

        // 3 failure
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance.get(`http://www.test.com/data`)).rejects.toBeInstanceOf(axios.AxiosError);

        Date.now = () => 500

        await expect(() => instance.get(`http://www.test.com/data`)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
    });

    it('should transit to CLOSED state if all requests succeeded during HALF_OPEN state', async () => {
        const instance =  axios.create({
            baseURL: 'http://www.test.com',
            logger: console.log
        });

        axiosCircuitBreaker(instance, {
            threshold: 1,
            numRequestsToCloseCircuit: 2,
            resetPeriodMs: 1000
        });

        Date.now = () => 1000;

        // 1 failure
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance.get(`/data`)).rejects.toBeInstanceOf(axios.AxiosError);

        Date.now = () => 1500;

        await expect(instance.get(`/data`)).rejects.toBeInstanceOf(CircuitBreakerOpenError);

        Date.now = () => 2001;

        // 1 success
        nock('http://www.test.com')
            .get('/data')
            .reply(200);

        await expect(instance.get(`/data`)).resolves.toBeInstanceOf(Object);

        // 2 success
        nock('http://www.test.com')
            .get('/data')
            .reply(200);

        await expect(instance.get(`/data`)).resolves.toBeInstanceOf(Object);

        // 3 should success since Circuit Breaker should enter CLOSED state.
        nock('http://www.test.com')
            .get('/data')
            .reply(200);

        await expect(instance.get(`/data`)).resolves.toBeInstanceOf(Object);
    });

    it('should transit to OPEN state if at least one request failed during HALF_OPEN state', async () => {
        const instance =  axios.create({
            baseURL: 'http://www.test.com',
        });

        axiosCircuitBreaker(instance, {
            threshold: 1,
            numRequestsToCloseCircuit: 2,
            resetPeriodMs: 1000,
            logger: console.log
        });

        Date.now = () => 1000;

        // 1 failure
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance.get(`/data`)).rejects.toBeInstanceOf(axios.AxiosError);

        Date.now = () => 1500;

        await expect(instance.get(`/data`)).rejects.toBeInstanceOf(CircuitBreakerOpenError);

        Date.now = () => 2001;

        // 1 success
        nock('http://www.test.com')
            .get('/data')
            .reply(200);

        await expect(instance.get(`/data`)).resolves.toBeInstanceOf(Object);

        // 2 fault
        nock('http://www.test.com')
            .get('/data')
            .reply(502);

        await expect(instance.get(`/data`)).rejects.toBeInstanceOf(AxiosError);

        await expect(instance.get(`/data`)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
    });

    it('should cancel requests that are more than numRequestsToCloseCircuit in HALF_OPEN state ', async () => {
        const instance =  axios.create({
            baseURL: 'http://www.test.com',
        });

        axiosCircuitBreaker(instance, {
            threshold: 1,
            numRequestsToCloseCircuit: 2,
            resetPeriodMs: 1000,
            logger: console.log
        });

        Date.now = () => 1000;

        // 1 failure
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance.get(`/data`)).rejects.toBeInstanceOf(axios.AxiosError);

        Date.now = () => 1500;

        await expect(instance.get(`/data`)).rejects.toBeInstanceOf(CircuitBreakerOpenError);

        Date.now = () => 2001;

        nock('http://www.test.com')
            .get('/data')
            .delayConnection(300)
            .reply(200)
            .get('/data')
            .delayConnection(300)
            .reply(200)
            .get('/data')
            .delayConnection(100)
            .reply(200);

        const r1 = instance.get(`/data`);
        const r2 = instance.get(`/data`);
        const r3 = instance.get(`/data`);

        await expect(r3).rejects.toBeInstanceOf(CircuitBreakerHalfOpenError);
        await expect(r1).resolves.toBeInstanceOf(Object);
        await expect(r2).resolves.toBeInstanceOf(Object);
    });

    it('two Circuit Breakers should have separate state', async () => {
        const instance1 =  axios.create({
            baseURL: 'http://www.test.com',
        });

        axiosCircuitBreaker(instance1, {
            id: 'TestService1',
            threshold: 3,
            logger: console.log
        });

        const instance2 =  axios.create({
            baseURL: 'http://www.test2.com',
        });

        axiosCircuitBreaker(instance2, {
            id: 'TestService2',
            threshold: 3,
            logger: console.log
        });

        // 1 failure
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance1.get(`/data`)).rejects.toBeInstanceOf(axios.AxiosError);

        // 2 failure
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance1.get(`/data`)).rejects.toBeInstanceOf(axios.AxiosError);

        // 3 failure
        nock('http://www.test.com')
            .get('/data')
            .reply(502);
        await expect(instance1.get(`/data`)).rejects.toBeInstanceOf(axios.AxiosError);

        await expect(instance1.get(`/data`)).rejects.toBeInstanceOf(CircuitBreakerOpenError);

        // 1 success for second breaker
        nock('http://www.test2.com')
            .get('/data')
            .reply(200);
        await expect(instance2.get(`/data`)).resolves.toBeInstanceOf(Object);
    });
})